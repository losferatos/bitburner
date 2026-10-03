// Liest aus Spielstaenden (backups/*.json.gz) die Spielversion, mit der der Stand geschrieben wurde.
// Nur lesen. Aufruf: node tools/audit/version-live.mjs [anzahl_stichproben]
// Quelle der Felder: SaveObject.ts (VersionSave) und Settings/Constants.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

function load(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, file))).toString("utf8"));
}

const idx = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1);
const rows = idx.map((l) => l.split("\t"));
const n = Number(process.argv[2] || 12);
// gleichmaessig verteilte Stichprobe ueber die Indexzeilen + die letzten drei
const pick = new Set();
for (let i = 0; i < n; i++) pick.add(Math.floor((i * (rows.length - 1)) / Math.max(1, n - 1)));
for (let i = rows.length - 3; i < rows.length; i++) pick.add(i);
const out = [];
for (const i of [...pick].sort((a, b) => a - b)) {
  const r = rows[i];
  try {
    const s = load(r[1]);
    const keys = Object.keys(s.data || {});
    const ver = s.data.VersionSave;
    out.push({ ts: r[0].slice(0, 16), bn: r[4], lauf: r[5], ver, hatVersionSave: keys.includes("VersionSave"), nKeys: keys.length });
  } catch (e) {
    out.push({ ts: r[0], datei: r[1], fehler: String(e.message).slice(0, 80) });
  }
}
console.log(JSON.stringify(out, null, 1));
const last = load(rows[rows.length - 1][1]);
console.log("Top-Level:", Object.keys(last), "data-Keys:", Object.keys(last.data));
