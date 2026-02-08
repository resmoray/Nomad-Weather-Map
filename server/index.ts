import { createServer } from "node:http";
import { URL } from "node:url";
import {
  buildSeasonSummary,
  getCrowdIndexByMonth,
  getPriceIndexByMonth,
} from "./seasonService.ts";

const PORT = Number.parseInt(process.env.SEASON_SERVER_PORT ?? "8787", 10);

function sendJson(response: import("node:http").ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  });
  response.end(JSON.stringify(payload));
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
});
