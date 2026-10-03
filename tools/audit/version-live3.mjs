// VERSION-LIVE3 (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2"): Zensus ueber ALLE Spielstaende.
//
// Welche Spielfassung hat die Staende geschrieben? VersionSave ist es NICHT (51 in 3.0.1 UND in dev,
// Constants.ts:10 beider Baeume). Trennscharf sind zwei Felder, die nur eine Fassung schreibt:
//   - RunningScript.scriptKey: 3.0.1 schreibt es mit (RunningScript.ts, Feld "scriptKey"); dev hat das Feld
//     seit b0ef5098 (13.06.2026) NICHT mehr -> in einem dev-Stand waere "scriptKey" nie zu finden.
//   - SettingsSave.EnableSaveDataBackupReminder: dev-only seit 864e9ca5 (18.07.2026), Settings.ts:72-73.
// Beide Aussagen zusammen: Stand gehoert zu v3.0.1 (bzw. einem dev-Stand bis 24.05.2026).
//
// Eichung: das Muster "scriptKey" wird gegen den Quelltext beider Baeume geprueft (muss in v301/
// RunningScript.ts vorkommen und in bitburner-src/ fehlen) - sonst waere die Trennung eine Annahme.
//
// Aufruf: node tools/audit/version-live3.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");

// Eichung am Quelltext
const live = fs.readFileSync(path.join(ROOT, "reference", "v301", "src", "Script", "RunningScript.ts"), "utf8");
const dev = fs.readFileSync(path.join(ROOT, "reference", "bitburner-src", "src", "Script", "RunningScript.ts"), "utf8");
const setLive = fs.readFileSync(path.join(ROOT, "reference", "v301", "src", "Settings", "Settings.ts"), "utf8");
const setDev = fs.readFileSync(path.join(ROOT, "reference", "bitburner-src", "src", "Settings", "Settings.ts"), "utf8");
const eich = {
  scriptKeyFeldLive: /^\s*scriptKey = /m.test(live),
  scriptKeyFeldDev: /^\s*scriptKey = /m.test(dev),
  backupReminderLive: /EnableSaveDataBackupReminder/.test(setLive),
  backupReminderDev: /EnableSaveDataBackupReminder/.test(setDev),
};
console.log("EICHUNG am Quelltext:", JSON.stringify(eich), eich.scriptKeyFeldLive && !eich.scriptKeyFeldDev && !eich.backupReminderLive && eich.backupReminderDev ? "-> beide Merkmale trennen v301 von dev" : "-> ROT: Merkmal trennt nicht");

// Zensus
const idx = fs.readFileSync(path.join(ROOT, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
const dateien = new Map();
for (const r of idx) {
  const f = [r[9], r[10], path.join(ROOT, "backups", r[1])].find((x) => x && fs.existsSync(x));
  if (f) dateien.set(f, r[0]);
}
for (const n of fs.readdirSync(path.join(ROOT, "backups"))) {
  if (/\.json(\.gz)?$/.test(n)) { const f = path.join(ROOT, "backups", n); if (![...dateien.keys()].some((k) => path.basename(k) === n)) dateien.set(f, "?"); }
}
let n = 0, ohneRS = 0, mitKey = 0, ohneKey = 0, rsGes = 0, keyGes = 0, mitReminder = 0, versionen = {}, fehler = 0;
let erster = null, letzter = null;
for (const [f, ts] of dateien) {
  let s;
  try {
    const roh = fs.readFileSync(f);
    const text = f.endsWith(".gz") ? zlib.gunzipSync(roh).toString("utf8") : roh.toString("utf8");
    s = JSON.parse(text);
  } catch { fehler++; continue; }
  if (!s.data || !s.data.AllServersSave) { fehler++; continue; }
  n++;
  const a = s.data.AllServersSave;
  const rs = (a.match(/"ctor":"RunningScript"/g) || []).length;
  const key = (a.match(/"scriptKey":/g) || []).length;
  rsGes += rs; keyGes += key;
  if (rs === 0) ohneRS++; else if (key === rs) mitKey++; else ohneKey++;
  try { if ("EnableSaveDataBackupReminder" in JSON.parse(s.data.SettingsSave)) mitReminder++; } catch { /* egal */ }
  versionen[s.data.VersionSave] = (versionen[s.data.VersionSave] || 0) + 1;
  if (ts !== "?") { if (!erster || ts < erster) erster = ts; if (!letzter || ts > letzter) letzter = ts; }
}
console.log("Staende gelesen: " + n + " (nicht lesbar: " + fehler + "), Zeitraum " + erster + " .. " + letzter);
console.log("VersionSave-Werte: " + JSON.stringify(versionen) + "  (51 in beiden Baeumen -> trennt nicht)");
console.log("RunningScript gesamt " + rsGes + ", davon mit scriptKey " + keyGes + "; Staende: alle RS mit scriptKey " + mitKey + ", teils/ohne " + ohneKey + ", ohne RS " + ohneRS);
console.log("Staende mit SettingsSave.EnableSaveDataBackupReminder: " + mitReminder + " von " + n);
