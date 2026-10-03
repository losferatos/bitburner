// Unterscheidet 3.0.1 und 3.0.2-dev ueber Felder, die nur eine Fassung schreibt.
// Nur lesen. Aufruf: node tools/audit/version-live2.mjs [anzahl]
// Merkmal 1: SettingsSave.EnableSaveDataBackupReminder (nur dev, Settings.ts:72-73 der dev-Fassung)
// Merkmal 2: Skripte im AllServersSave mit ramUsage fuer Funktionen, deren Kosten sich geaendert haben
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");
const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
const n = Number(process.argv[2] || 14);

function load(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}
const rows = [];
for (const r of idx) {
  const f = r[10] && fs.existsSync(r[10]) ? r[10] : path.join(dir, r[1]);
  if (fs.existsSync(f)) rows.push({ ts: r[0], bn: r[4], lauf: r[5], f });
}
const pick = new Set();
for (let i = 0; i < n; i++) pick.add(Math.floor((i * (rows.length - 1)) / Math.max(1, n - 1)));
const out = [];
for (const i of [...pick].sort((a, b) => a - b)) {
  const r = rows[i];
  let s;
  try { s = load(r.f); } catch (e) { out.push({ ts: r.ts, fehler: e.message }); continue; }
  const set = JSON.parse(s.data.SettingsSave);
  out.push({
    ts: r.ts.slice(0, 16), bn: r.bn, lauf: r.lauf,
    ver: s.data.VersionSave,
    backupReminder: set.EnableSaveDataBackupReminder,
    settingsKeys: Object.keys(set).length,
  });
}
console.log("verfuegbare Dateien:", rows.length, "von", idx.length);
console.log(JSON.stringify(out));
const last = load(rows[rows.length - 1].f);
const set = JSON.parse(last.data.SettingsSave);
console.log("Settings-Schluessel (letzter Stand):", Object.keys(set).join(","));
