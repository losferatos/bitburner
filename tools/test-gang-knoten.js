/**
 * Gang-Telemetrie aus dem Vorknoten zaehlt nicht (Befund BN3.1, 05.10.2026:
 * gang.json aus BN2 erzeugte "gang.js laeuft nicht" und einen falschen
 * TORRUNDE-BEFUND). Gegen den alten Stand ROT: gangImKnoten fehlt.
 * Aufruf: node tools/test-gang-knoten.js [repo-verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok) => { if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name); } };
console.log("\n=== Gang-Telemetrie je Knoten ===\n");

const lib = await import(pathToFileURL(path.join(ROOT, "tools", "lib", "gangzeile.js")).href);
const f = lib.gangImKnoten;
pruefe("gangImKnoten exportiert", typeof f === "function");
if (typeof f === "function") {
  const tel = { wall: 1000, inGang: true, faction: "Slum Snakes" };
  pruefe("Telemetrie vor dem Knotenwechsel -> null", f(tel, 2000) === null);
  pruefe("Telemetrie nach dem Knotenwechsel bleibt", f(tel, 500) === tel);
  pruefe("ohne nodeReset bleibt sie (alter Weg)", f(tel, undefined) === tel);
  pruefe("keine Datei bleibt null", f(null, 2000) === null);
  pruefe("Telemetrie ohne Zeitstempel bleibt (gangZeile meldet sie)", f({ inGang: true }, 2000) !== null);
}
const checkin = fs.readFileSync(path.join(ROOT, "tools", "checkin.js"), "utf8");
pruefe("checkin.js filtert beide gang.json-Leser",
  (checkin.match(/gangImKnoten\(await holeJson\("data\/gang\.json"\), netz && netz\.nodeReset\)/g) || []).length === 2);
console.log("\n=== " + gruen + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
