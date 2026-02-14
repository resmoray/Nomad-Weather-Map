import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateStaticDataset, readRegionCatalog, STATIC_REFRESH_DIR } from "./staticRefreshLib.ts";

const regions = readRegionCatalog();
const report = validateStaticDataset(regions);

console.log("Static validation summary:");
console.log(`- layoutMode: ${report.layoutMode}`);
console.log(`- checkedRegions: ${report.checkedRegions}`);
console.log(`- checkedEntries: ${report.checkedEntries}`);
console.log(`- errors: ${report.errors.length}`);

if (report.errors.length > 0) {
  const preview = report.errors.slice(0, 25);
  for (const error of preview) {
    console.error(`  - ${error}`);
  }
  if (report.errors.length > preview.length) {
    console.error(`  ... ${report.errors.length - preview.length} additional errors`);
  }
}

const reportPath = resolve(STATIC_REFRESH_DIR, "validation-report.json");
const payload = {
  generatedAt: new Date().toISOString(),
  ...report,
};
mkdirSync(STATIC_REFRESH_DIR, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

if (report.errors.length > 0) {
  process.exitCode = 1;
}
