// FLUSS-FRISCHE (Audit 03.10.2026): Prueft gegen den neuesten Spielstand, ob jede Telemetriedatei der
// Registry das Zeitfeld traegt, das der Leser erwartet (bn4net.js Registry-Zaehlwerk: erstes endliches von
// zeit/ts/wall) und wie alt sie relativ zur freshnessMs ist. Eichung: der Stand selbst - bn4net.json muss
// frisch sein (Alter < 60 s), sonst ist der Stand-Zeitpunkt falsch gewaehlt.
//
// Aufruf: node tools/audit/fluss-frische.mjs [<datei.json.gz>]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuesterStand, homeTextdateien } from "./fluss-save.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));
const arg = process.argv[2] && process.argv[2].endsWith(".gz") ? process.argv[2] : neuesterStand();
const tf = homeTextdateien(arg);
console.log("Spielstand:", path.basename(arg));

// Bezugszeit: juengster Zeitstempel in bn4net.json (zeit)
let bezug = 0;
try { bezug = JSON.parse(tf.get("data/bn4net.json")).zeit; } catch { /* ohne Bezug */ }
console.log("Bezug (bn4net.json zeit):", new Date(bezug).toISOString());

console.log("\nname".padEnd(18), "telemetryFile".padEnd(24), "frist_s", "feld".padEnd(6), "alter_s", "urteil");
for (const e of reg.eintraege) {
  if (!e.telemetryFile) continue;
  const t = tf.get(e.telemetryFile);
  if (t === undefined) { console.log(e.name.padEnd(18), e.telemetryFile.padEnd(24), String((e.freshnessMs || 600000) / 1000).padStart(7), "-".padEnd(6), "-".padStart(7), "DATEI FEHLT"); continue; }
  let d = null;
  try { d = JSON.parse(t); } catch { console.log(e.name.padEnd(18), e.telemetryFile.padEnd(24), "KEIN JSON"); continue; }
  const feld = ["zeit", "ts", "wall"].find((k) => Number.isFinite(d[k]));
  const w = feld ? d[feld] : null;
  const alter = w ? Math.round((bezug - w) / 1000) : null;
  const frist = (e.freshnessMs || 600000) / 1000;
  const urteil = !feld ? "KEIN ZEITFELD (Leser: nie frisch)" : alter > frist ? "ALT" : "frisch";
  console.log(e.name.padEnd(18), e.telemetryFile.padEnd(24), String(frist).padStart(7), (feld || "-").padEnd(6), String(alter).padStart(7), urteil);
}
