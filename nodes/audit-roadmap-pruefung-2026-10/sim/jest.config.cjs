// Corp je BitNode (Roadmap-Pruefung 10/2026). Aufruf aus reference/v301:
//   CORP_NODE=11 CORP_HOURS=36 CORP_SCEN=C4B_KF,C4A_KF node node_modules/jest/bin/jest.js -c ../../nodes/audit-roadmap-pruefung-2026-10/sim/jest.config.cjs -i knoten
// Ergebnis nach ./out (nicht eingecheckt); Zusammenfassung der Laeufe vom 07.10.2026 in ergebnisse.json.
const path = require("path");
const V = path.resolve(__dirname, "../../../reference/v301");
const base = require("../../corp-2026-10-05/sim/jest.config.cjs");
module.exports = {
  ...base,
  roots: [V + "/src/", V + "/test/", __dirname],
  cacheDirectory: path.join(require("os").tmpdir(), "jest-corp-knoten"),
};
