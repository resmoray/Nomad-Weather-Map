import {
  determineLayoutMode,
  exportStaticDataset,
  loadCanonicalStore,
  loadRefreshState,
  readRegionCatalog,
  saveRefreshState,
} from "./staticRefreshLib.ts";

const regions = readRegionCatalog();
const regionIds = regions.map((region) => region.id);
const canonical = loadCanonicalStore();
const state = loadRefreshState(regionIds);

const stats = exportStaticDataset({
  regions,
  canonical,
  state,
});

const nextState = {
  ...state,
  layoutMode: determineLayoutMode(regions.length),
};
saveRefreshState(nextState);

console.log("Static export summary:");
console.log(`- generatedAt: ${stats.generatedAt}`);
console.log(`- datasetVersion: ${stats.datasetVersion}`);
console.log(`- layoutMode: ${stats.layoutMode}`);
console.log(`- regionCount: ${stats.regionCount}`);
console.log(`- monthCount: ${stats.monthCount}`);
console.log(`- writtenFiles: ${stats.writtenFiles}`);
console.log(`- missingEntries: ${stats.missingEntries}`);

if (stats.missingEntries > 0) {
  process.exitCode = 1;
}
