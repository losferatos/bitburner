// Bot-Simulator: die BOT-Skripte aus bau/src laufen gegen die ECHTE Spielquelle 3.0.1.
// Aufruf (aus reference/v301):
//   node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/bau/tests/jest.config.cjs -i botsim
const path = require("path");
const base = require("../../sim/jest.config.cjs");
const BAU = path.resolve(__dirname, "..");
const ROOT = path.resolve(__dirname, "../../../..");
module.exports = {
  ...base,
  roots: [...base.roots.filter((r) => !r.includes("corp-2026-10-05")), __dirname, BAU + "/src/"],
  testPathIgnorePatterns: [...base.testPathIgnorePatterns, "/sim/"],
  moduleNameMapper: {
    "^lib/(corplib|corpact|corptick)\.js$": BAU + "/src/lib/$1.js",
    "^lib/(herzschlag|hostdatei)\.js$": ROOT + "/src/lib/$1.js",
    ...base.moduleNameMapper,
  },
  cacheDirectory: path.join(require("os").tmpdir(), "jest-corp-bot"),
};
