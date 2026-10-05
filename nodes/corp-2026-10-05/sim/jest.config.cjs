// Fuehrt die ECHTE Spielquelle 3.0.1 (reference/v301, nur gelesen) unter Jest aus.
// Aufruf (aus reference/v301, damit node_modules gefunden werden):
//   node node_modules/jest/bin/jest.js -c ../../nodes/corp-2026-10-05/sim/jest.config.cjs -i <muster>
// Schreibt nichts nach reference/ (Cache im Temp-Ordner).
const path = require("path");
const V = path.resolve(__dirname, "../../../reference/v301");
module.exports = {
  rootDir: V,
  roots: [V + "/src/", V + "/test/", __dirname],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  transform: { "^.+\\.(js|jsx|ts|tsx|cjs|mjs)$": V + "/test/jest/config/babelTransform.js" },
  transformIgnorePatterns: ["node_modules/(?!react-markdown)/"],
  testPathIgnorePatterns: [".cypress", "node_modules", "dist", "/reference/v301/test/", "/reference/v301/src/"],
  testEnvironment: V + "/FixJSDOMEnvironment.ts",
  setupFiles: [V + "/jest.polyfills.js"],
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": V + "/test/__mocks__/fileMock.js",
    "\\.(css|less)$": V + "/test/__mocks__/NullMock.js",
    ".*?raw$": V + "/test/__mocks__/fileMock.js",
    "@player": V + "/src/Player",
    "@enums": V + "/src/Enums",
    "@nsdefs": V + "/src/ScriptEditor/NetscriptDefinitions.d.ts",
    "^monaco-editor$": V + "/test/__mocks__/NullMock.js",
    "^monaco-vim$": V + "/test/__mocks__/NullMock.js",
    "/utils/Protections$": V + "/test/__mocks__/NullMock.js",
    "@swc/wasm-web": "@swc/core",
  },
  testTimeout: 7200000,
  cacheDirectory: path.join(require("os").tmpdir(), "jest-corp-sim"),
};
