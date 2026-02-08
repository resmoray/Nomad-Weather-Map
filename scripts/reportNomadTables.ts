import { initializeNomadDataSchema, openNomadDataStore } from "../server/nomadDataStore.ts";

const db = openNomadDataStore();

interface CountRow {
  count: number;
}

interface CoverageRow {
  month: number;
  total: number;
  withCoreClimate: number;
  withAir: number;
  withMarine: number;
}

function getCount(query: string): number {
  const row = db.prepare(query).get() as CountRow | undefined;
  return row?.count ?? 0;
}

function printSection(title: string): void {
  console.log(`\n${title}`);
}

try {
  initializeNomadDataSchema(db);

  const cityCount = getCount("SELECT COUNT(*) AS count FROM city");
  const rawCount = getCount("SELECT COUNT(*) AS count FROM city_month_raw");
  const derivedCount = getCount("SELECT COUNT(*) AS count FROM city_month_derived");
  const yearRows = db
    .prepare("SELECT year, COUNT(*) AS count FROM city_month_raw GROUP BY year ORDER BY year DESC")
    .all() as Array<{ year: number; count: number }>;

  printSection("Nomad data tables");
  console.log(`city: ${cityCount}`);
  console.log(`city_month_raw: ${rawCount}`);
  console.log(`city_month_derived: ${derivedCount}`);

  printSection("Rows by year");
  if (yearRows.length === 0) {
    console.log("no rows found");
  } else {
    for (const row of yearRows) {
      console.log(`${row.year}: ${row.count}`);
    }
  }

  const latestYear = yearRows[0]?.year ?? new Date().getUTCFullYear();
  const monthlyCoverage = db
    .prepare(`
      SELECT
        month,
        COUNT(*) AS total,
        SUM(
          CASE
            WHEN temp_avg_c IS NOT NULL
              AND rain_mm IS NOT NULL
              AND humidity_pct IS NOT NULL
              AND wind_avg_kph IS NOT NULL
            THEN 1 ELSE 0
          END
        ) AS withCoreClimate,
        SUM(CASE WHEN pm25_ug_m3 IS NOT NULL AND aqi_avg IS NOT NULL AND uv_index_avg IS NOT NULL THEN 1 ELSE 0 END) AS withAir,
        SUM(CASE WHEN wave_height_avg_m IS NOT NULL AND wave_interval_avg_s IS NOT NULL THEN 1 ELSE 0 END) AS withMarine
      FROM city_month_raw
      WHERE year = ?
      GROUP BY month
      ORDER BY month
    `)
    .all(latestYear) as CoverageRow[];

  printSection(`Coverage by month (${latestYear})`);
  if (monthlyCoverage.length === 0) {
    console.log("no rows found");
  } else {
    for (const row of monthlyCoverage) {
      console.log(
        `m${String(row.month).padStart(2, "0")}: total=${row.total}, climate=${row.withCoreClimate}, air=${row.withAir}, marine=${row.withMarine}`,
      );
    }
  }
} finally {
  db.close();
}
