/**
 * Handschlag: letzter Blick nach dem letzten Schlaf (Uhren-Audit 08.10.2026).
 * Im verdeckten Tab dauert ns.sleep(2000) bis ~60 s; die Warteschleife endete
 * nach dem Schlaf, ohne die eben eingetroffene Antwort zu lesen, und fiel auf
 * die Altersregel zurueck (ohne junge Sicherung: Einbau abgelehnt).
 * Verhaltenstest mit dem Spiel-Mock. Gegen den alten Stand ROT.
 * Aufruf: node tools/test-handschlag-nachblick.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeAusBeiden } from "./mock/lader.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok, info = "") => { if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name + (info ? " - " + info : "")); } };
console.log("\n=== Handschlag: Nachblick nach dem letzten Schlaf ===\n");

const WALL = 1_700_000_000_000;
const NODE_RESET = 1_600_000_000_000;
let schlaefe = 0;
let m = null;
m = neuerMock({
  host: "home", wall: WALL, nodeReset: NODE_RESET, knoten: 10,
  // Verdeckter Tab: jeder Schlaf dauert 60 s. Nach dem zweiten Schlaf
  // (t = 120 s, also hinter der 90-s-Frist) liegt die Antwort der Bruecke da.
  beiSchlaf: (ms, z, vor) => {
    vor(60000);
    schlaefe++;
    if (schlaefe === 2) {
      m.ns.write("data/backup-ok.txt", JSON.stringify({ ts: Date.now(), anlass: "pre-install", datei: "test.json.gz" }), "w");
    }
  },
  server: { home: { ram: 32, used: 0, root: true, geld: 0, cores: 1, ports: 0, hackLevel: 1 } },
  maxSchlaf: 10,
});
const { modul } = await ladeAusBeiden(ROOT, "lib/handschlag.js");
const zurueck = m.uhrStellen();
let erg = null, fehler = null;
try {
  erg = await modul.handschlag(m.ns, "install", "bn4rep", NODE_RESET, () => {});
} catch (e) { fehler = e; } finally { zurueck(); }
pruefe("handschlag laeuft durch", !fehler, String(fehler));
pruefe("Antwort nach dem letzten Schlaf wird noch gelesen (darf, frisch gesichert)",
  !!erg && erg.darf === true && erg.gesichert === true, JSON.stringify(erg));
console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
