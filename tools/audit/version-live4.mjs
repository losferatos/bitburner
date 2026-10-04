// VERSION-LIVE4 (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2"): dritter, unabhaengiger Fassungsbeleg.
//
// version-live3.mjs trennt ueber zwei Felder (scriptKey, EnableSaveDataBackupReminder). Hier ein drittes Merkmal
// aus ANDERER Quelle: dev legt beim Aufbau der NPC-Server (initForeignServers, ServerHelpers.ts dev :400-412) bei
// zehn Servern "entdeckbare Skripte" ab (Commit b48eb628, 16.07.2026; Servertabelle Server/data/servers.ts dev
// :268,:297,:312,:381,:663,:836,:1176,:1484 - hostnames fulcrumtech, Fulcrum Secret Technologies, stormtech, helios,
// applied-energetics, lexo-corp, n00dles, NiteSec). In 3.0.1 gibt es sie nicht. Ein Stand, der in dev gebaut
// wurde, enthielte diese Dateien auf diesen Servern - es sei denn, der Bot hat sie geloescht; er loescht aber nur
// Wirtsdateien in worker/ und lib/ (Gegenprobe unten: Anzahl Dateien dieser Namen im Bot-Quelltext).
//
// Eichung: (1) die Namen werden aus dem dev-Quelltext gelesen (Literature/Enums.ts), nicht aus dem Kopf;
// (2) Gegenprobe "Merkmal ist nachweisbar": derselbe Suchlauf auf einen synthetisch erzeugten AllServersSave-Text,
// der einen dieser Namen enthaelt, MUSS ihn finden; (3) die Namen duerfen im Bot nicht vorkommen.
//
// Aufruf: node tools/audit/version-live4.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const enumText = fs.readFileSync(path.join(ROOT, "reference", "bitburner-src", "src", "Literature", "Enums.ts"), "utf8");
const block = /DiscoverableScriptName = \{([\s\S]*?)\} as const/.exec(enumText)[1];
const namen = [...block.matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
console.log("Namen aus dev-Quelltext: " + namen.length + " -> " + namen.join(", "));

// (3) Gegenprobe: kommen die Namen im Bot vor?
let imBot = 0;
for (const d of ["src", path.join("src", "lib"), path.join("src", "worker")]) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(js|json)$/.test(f)) continue;
    const t = fs.readFileSync(path.join(dir, f), "utf8");
    for (const n of namen) if (t.includes(n)) imBot++;
  }
}
console.log("Treffer der Namen im Bot-Quelltext: " + imBot + " (muss 0 sein)");

// (2) Merkmal nachweisbar
const synth = JSON.stringify({ ctor: "JSONMap", data: [["n00dles", { scripts: { ctor: "JSONMap", data: [[namen[0], {}]] } }]] });
const nachweisbar = namen.some((n) => synth.includes(n));
console.log("Suchlauf findet synthetisches Merkmal: " + nachweisbar);
if (!nachweisbar || imBot !== 0) { console.log("EICHUNG ROT"); process.exit(2); }

// Zensus
const idx = fs.readFileSync(path.join(ROOT, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
let gelesen = 0, mitMerkmal = 0, ersterNeuer = null;
const dateien = new Set();
for (const r of idx) {
  const f = [r[9], r[10], path.join(ROOT, "backups", r[1])].find((x) => x && fs.existsSync(x));
  if (f) dateien.add(f);
}
for (const f of dateien) {
  let s;
  try {
    const roh = fs.readFileSync(f);
    s = JSON.parse((f.endsWith(".gz") ? zlib.gunzipSync(roh) : roh).toString("utf8"));
  } catch { continue; }
  const a = s.data && s.data.AllServersSave;
  if (!a) continue;
  gelesen++;
  if (namen.some((n) => a.includes(n))) { mitMerkmal++; ersterNeuer = ersterNeuer || f; }
}
console.log("Staende gelesen " + gelesen + ", davon mit entdeckbaren dev-Skripten auf NPC-Servern: " + mitMerkmal + (ersterNeuer ? " (erster: " + ersterNeuer + ")" : ""));
console.log(mitMerkmal === 0 ? "-> drittes Merkmal bestaetigt: kein Stand stammt aus dem dev-Baum" : "-> WIDERSPRUCH");
