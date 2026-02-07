interface AmadeusToken {
  accessToken: string;
  expiresAt: number;
}

interface MonthlyIndexResult {
  byMonth: Record<number, number | null>;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
}

const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const REQUEST_DELAY_MS = 250;

function monthTemplate(): Record<number, number | null> {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
    11: null,
    12: null,
  };
}

function normalizeAscending(valuesByMonth: Record<number, number | null>): Record<number, number | null> {
  const numericValues = Object.values(valuesByMonth).filter(
    (value): value is number => typeof value === "number" && !Number.isNaN(value),
  );

  if (numericValues.length === 0) {
    return valuesByMonth;
  }

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);

  if (min === max) {
    const normalized = monthTemplate();
    for (const [month, value] of Object.entries(valuesByMonth)) {
      normalized[Number(month)] = value === null ? null : 50;
    }
    return normalized;
  }

  const normalized = monthTemplate();
  for (const [month, value] of Object.entries(valuesByMonth)) {
    if (value === null) {
      normalized[Number(month)] = null;
      continue;
    }

    normalized[Number(month)] = Math.round(((value - min) / (max - min)) * 100);
  }

  return normalized;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export class AmadeusClient {
  private tokenCache: AmadeusToken | null = null;

  private queue: Promise<void> = Promise.resolve();

  private readonly isLiveEnabled: boolean;

  private readonly clientId: string;

  private readonly clientSecret: string;

  private readonly baseUrl: string;

  constructor() {
    this.isLiveEnabled = (process.env.SEASON_ENABLE_LIVE_AMADEUS ?? "false").toLowerCase() === "true";
    this.clientId = process.env.AMADEUS_CLIENT_ID ?? "";
    this.clientSecret = process.env.AMADEUS_CLIENT_SECRET ?? "";
    this.baseUrl = process.env.AMADEUS_BASE_URL ?? "https://test.api.amadeus.com";
  }

  canUseLiveAmadeus(): boolean {
    return this.isLiveEnabled && Boolean(this.clientId) && Boolean(this.clientSecret);
  }

  private async scheduleRequest<T>(requestFactory: () => Promise<T>): Promise<T> {
    const runAfter = this.queue;
    let release: () => void = () => {
      // noop
    };

    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await runAfter;

    try {
      return await requestFactory();
    } finally {
      setTimeout(() => release(), REQUEST_DELAY_MS);
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && now < this.tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
      return this.tokenCache.accessToken;
    }

    const tokenUrl = `${this.baseUrl}/v1/security/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Amadeus OAuth failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!payload.access_token || !payload.expires_in) {
      throw new Error("Amadeus OAuth returned incomplete token payload");
    }

    this.tokenCache = {
      accessToken: payload.access_token,
      expiresAt: now + payload.expires_in * 1000,
    };

    return payload.access_token;
  }

  private async requestJson(pathWithQuery: string): Promise<unknown> {
    if (!this.canUseLiveAmadeus()) {
      throw new Error("Amadeus live mode disabled or credentials missing");
    }

    return this.scheduleRequest(async () => {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}${pathWithQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Amadeus request failed with status ${response.status}`);
      }

      return response.json();
    });
  }

  async getMonthlyPriceIndex(
    originIata: string,
    destinationIata: string,
    year: number,
  ): Promise<MonthlyIndexResult | null> {
    try {
      const path = `/v1/shopping/flight-dates?origin=${encodeURIComponent(originIata)}&destination=${encodeURIComponent(destinationIata)}&oneWay=true`;
      const payload = (await this.requestJson(path)) as {
        data?: Array<{ departureDate?: string; price?: { total?: string | number } }>;
      };

      const byMonthRaw = monthTemplate();

      for (const item of payload.data ?? []) {
        const date = parseDate(item.departureDate);
        if (!date || date.getUTCFullYear() !== year) {
          continue;
        }

        const month = date.getUTCMonth() + 1;
        const price = parsePrice(item.price?.total);

        if (price === null) {
          continue;
        }

        const existing = byMonthRaw[month];
        byMonthRaw[month] = existing === null ? price : Math.min(existing, price);
      }

      const hasAnyData = Object.values(byMonthRaw).some((value) => value !== null);
      if (!hasAnyData) {
        return null;
      }

      return {
        byMonth: normalizeAscending(byMonthRaw),
        sourceName: "Amadeus Flight Dates API",
        sourceUrl: "https://developers.amadeus.com/self-service/category/flights/api-doc/flight-cheapest-date-search",
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getMonthlyCrowdIndex(cityIata: string, year: number): Promise<MonthlyIndexResult | null> {
    const byMonthRaw = monthTemplate();
    let successCount = 0;

    for (let month = 1; month <= 12; month += 1) {
      const mm = String(month).padStart(2, "0");

      try {
        const path = `/v1/travel/analytics/air-traffic/traveled?originCityCode=${encodeURIComponent(cityIata)}&period=${year}-${mm}`;
        const payload = (await this.requestJson(path)) as {
          data?: Array<{
            analytics?: {
              travelers?: {
                score?: number;
              };
            };
          }>;
        };

        const score = payload.data?.[0]?.analytics?.travelers?.score;
        if (typeof score === "number" && !Number.isNaN(score)) {
          byMonthRaw[month] = score;
          successCount += 1;
        }
      } catch {
        // Ignore individual month failures. We fallback below when there is no useful signal.
      }
    }

    if (successCount === 0) {
      return null;
    }

    return {
      byMonth: normalizeAscending(byMonthRaw),
      sourceName: "Amadeus Air Traffic Analytics API",
      sourceUrl: "https://developers.amadeus.com/self-service/category/trip/api-doc/travel-predictions",
      lastUpdated: new Date().toISOString(),
    };
  }
}
