import { createServer } from "node:http";
import { URL } from "node:url";
import {
  buildSeasonSummary,
  getCrowdIndexByMonth,
  getPriceIndexByMonth,
} from "./seasonService.ts";
import {
  getWeatherSummaryForRegionMonth,
  startWeatherSnapshotAutoUpdater,
} from "./weatherSummaryService.ts";

const PORT = Number.parseInt(process.env.SEASON_SERVER_PORT ?? "8787", 10);
const WEATHER_PROXY_CACHE_TTL_MS = Number.parseInt(process.env.WEATHER_PROXY_CACHE_TTL_MS ?? "21600000", 10);
const WEATHER_PROXY_STALE_MAX_AGE_MS = Number.parseInt(
  process.env.WEATHER_PROXY_STALE_MAX_AGE_MS ?? "604800000",
  10,
);
const WEATHER_PROXY_TIMEOUT_MS = Number.parseInt(process.env.WEATHER_PROXY_TIMEOUT_MS ?? "15000", 10);
const WEATHER_PROXY_ALLOWED_HOSTS = new Set([
  "climate-api.open-meteo.com",
  "historical-forecast-api.open-meteo.com",
  "archive-api.open-meteo.com",
  "air-quality-api.open-meteo.com",
  "marine-api.open-meteo.com",
]);

interface CachedWeatherResponse {
  statusCode: number;
  contentType: string;
  body: string;
  cachedAt: number;
  expiresAt: number;
}

const weatherProxyCache = new Map<string, CachedWeatherResponse>();

function sendJson(response: import("node:http").ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function sendText(
  response: import("node:http").ServerResponse,
  statusCode: number,
  body: string,
  contentType: string,
  extraHeaders?: Record<string, string>,
): void {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...(extraHeaders ?? {}),
  });
  response.end(body);
}

function parseYear(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) {
    return new Date().getUTCFullYear();
  }

  return parsed;
}

function parseMonth(raw: string | null): number | undefined {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 12) {
    return undefined;
  }

  return parsed;
}

function parseBoolean(raw: string | null, fallback: boolean): boolean {
  if (raw === null) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return fallback;
}

function getFreshCachedWeather(cacheKey: string, now: number): CachedWeatherResponse | null {
  const cached = weatherProxyCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt > now) {
    return cached;
  }

  return null;
}

function getStaleCachedWeather(cacheKey: string, now: number): CachedWeatherResponse | null {
  const cached = weatherProxyCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (now - cached.cachedAt <= WEATHER_PROXY_STALE_MAX_AGE_MS) {
    return cached;
  }

  weatherProxyCache.delete(cacheKey);
  return null;
}

function pruneWeatherCache(now: number): void {
  if (weatherProxyCache.size < 4000) {
    return;
  }

  for (const [cacheKey, cached] of weatherProxyCache.entries()) {
    if (now - cached.cachedAt > WEATHER_PROXY_STALE_MAX_AGE_MS) {
      weatherProxyCache.delete(cacheKey);
    }
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEATHER_PROXY_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Invalid request URL" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://localhost:${PORT}`);

  try {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    if (url.pathname === "/api/weather/summary") {
      const regionId = (url.searchParams.get("regionId") ?? "").trim();
      const month = parseMonth(url.searchParams.get("month"));
      const includeMarine = parseBoolean(url.searchParams.get("includeMarine"), true);
      const refresh = parseBoolean(url.searchParams.get("refresh"), false);
      const forceRefresh = parseBoolean(url.searchParams.get("forceRefresh"), false);
      const allowStale = parseBoolean(url.searchParams.get("allowStale"), true);

      if (!regionId) {
        sendJson(response, 400, { error: "regionId is required" });
        return;
      }

      if (!month) {
        sendJson(response, 400, { error: "month must be between 1 and 12" });
        return;
      }

      const summary = await getWeatherSummaryForRegionMonth({
        regionId,
        month,
        includeMarine,
        mode: forceRefresh ? "force_refresh" : refresh ? "refresh_if_stale" : "verified_only",
        allowStaleSnapshot: allowStale,
      });
      sendJson(response, 200, summary);
      return;
    }

    if (url.pathname === "/api/weather/open-meteo") {
      const rawTargetUrl = (url.searchParams.get("url") ?? "").trim();
      if (!rawTargetUrl) {
        sendJson(response, 400, { error: "url is required" });
        return;
      }

      let targetUrl: URL;
      try {
        targetUrl = new URL(rawTargetUrl);
      } catch {
        sendJson(response, 400, { error: "url must be a valid absolute URL" });
        return;
      }

      if (targetUrl.protocol !== "https:") {
        sendJson(response, 400, { error: "Only https URLs are allowed" });
        return;
      }

      if (!WEATHER_PROXY_ALLOWED_HOSTS.has(targetUrl.hostname)) {
        sendJson(response, 403, { error: "Host not allowed for weather proxy" });
        return;
      }

      const cacheKey = targetUrl.toString();
      const now = Date.now();

      pruneWeatherCache(now);

      const freshCached = getFreshCachedWeather(cacheKey, now);
      if (freshCached) {
        sendText(response, freshCached.statusCode, freshCached.body, freshCached.contentType, {
          "X-Weather-Proxy-Cache": "HIT",
          "X-Weather-Proxy-Cached-At": new Date(freshCached.cachedAt).toISOString(),
        });
        return;
      }

      try {
        const upstream = await fetchWithTimeout(cacheKey);
        const body = await upstream.text();
        const contentType = upstream.headers.get("content-type") ?? "application/json";

        if (upstream.ok) {
          weatherProxyCache.set(cacheKey, {
            statusCode: upstream.status,
            contentType,
            body,
            cachedAt: now,
            expiresAt: now + WEATHER_PROXY_CACHE_TTL_MS,
          });

          sendText(response, upstream.status, body, contentType, {
            "X-Weather-Proxy-Cache": "MISS",
            "X-Weather-Proxy-Cached-At": new Date(now).toISOString(),
          });
          return;
        }

        const staleCached = getStaleCachedWeather(cacheKey, now);
        if (staleCached) {
          sendText(response, staleCached.statusCode, staleCached.body, staleCached.contentType, {
            "X-Weather-Proxy-Cache": "STALE",
            "X-Weather-Proxy-Upstream-Status": String(upstream.status),
            "X-Weather-Proxy-Cached-At": new Date(staleCached.cachedAt).toISOString(),
          });
          return;
        }

        sendText(response, upstream.status, body, contentType, {
          "X-Weather-Proxy-Cache": "BYPASS",
        });
        return;
      } catch (error) {
        const staleCached = getStaleCachedWeather(cacheKey, now);
        if (staleCached) {
          sendText(response, staleCached.statusCode, staleCached.body, staleCached.contentType, {
            "X-Weather-Proxy-Cache": "STALE",
            "X-Weather-Proxy-Upstream-Status": "network-error",
            "X-Weather-Proxy-Cached-At": new Date(staleCached.cachedAt).toISOString(),
          });
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown weather proxy error";
        sendJson(response, 502, { error: message });
        return;
      }
    }

    if (url.pathname === "/api/season/price-index") {
      const originIata = (url.searchParams.get("originIata") ?? "").trim().toUpperCase();
      const destinationIata = (url.searchParams.get("destinationIata") ?? "").trim().toUpperCase();
      const year = parseYear(url.searchParams.get("year"));

      if (!originIata || !destinationIata) {
        sendJson(response, 400, { error: "originIata and destinationIata are required" });
        return;
      }

      const result = await getPriceIndexByMonth(originIata, destinationIata, year);
      sendJson(response, 200, {
        originIata,
        destinationIata,
        year,
        byMonth: result.byMonth,
        source: {
          name: result.sourceName,
          url: result.sourceUrl,
          lastUpdated: result.lastUpdated,
        },
      });
      return;
    }

    if (url.pathname === "/api/season/crowd-index") {
      const cityIata = (url.searchParams.get("cityIata") ?? "").trim().toUpperCase();
      const year = parseYear(url.searchParams.get("year"));

      if (!cityIata) {
        sendJson(response, 400, { error: "cityIata is required" });
        return;
      }

      const result = await getCrowdIndexByMonth(cityIata, year);
      sendJson(response, 200, {
        cityIata,
        year,
        byMonth: result.byMonth,
        source: {
          name: result.sourceName,
          url: result.sourceUrl,
          lastUpdated: result.lastUpdated,
        },
      });
      return;
    }

    if (url.pathname === "/api/season/summary") {
      const regionId = (url.searchParams.get("regionId") ?? "").trim();
      const year = parseYear(url.searchParams.get("year"));
      const month = parseMonth(url.searchParams.get("month"));
      const weatherByMonthRaw = url.searchParams.get("weatherByMonth");
      const presetId = (url.searchParams.get("presetId") ?? "perfectTemp:cityTrip").trim();

      if (!regionId) {
        sendJson(response, 400, { error: "regionId is required" });
        return;
      }

      const result = await buildSeasonSummary({
        regionId,
        year,
        month,
        weatherByMonthRaw,
      });

      sendJson(response, 200, {
        ...result,
        presetId,
      });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    sendJson(response, 500, { error: message });
  }
}).listen(PORT, () => {
  console.log(`Season API proxy running on http://localhost:${PORT}`);
  console.log(
    `Weather proxy cache enabled (ttl=${WEATHER_PROXY_CACHE_TTL_MS}ms, staleMaxAge=${WEATHER_PROXY_STALE_MAX_AGE_MS}ms)`,
  );
  startWeatherSnapshotAutoUpdater();
});
