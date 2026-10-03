// Liest aus dem juengsten Spielstand (backups/INDEX.tsv) die LAUFENDEN Skripte samt Log und die
// Textdateien auf home (data/*.json = die Telemetrie des Bots, wie das Spiel sie sieht).
// Zweck im Audit "Scope": ein verschluckter Fehler hinterlaesst Spuren in der Telemetrie
// (Felder, die nie anspringen) und im Log. Nur lesen.
// Aufruf: node tools/audit/scope-livelogs.mjs [--logs] [--datei data/blade.json] [--save <pfad>]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
function latest() {
  const idx = fs.readFileSync(path.join(root, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
  return path.join(root, "backups", idx[idx.length - 1].split("\t")[1]);
}
const file = opt("--save") ?? latest();
const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
const servers = JSON.parse(save.data.AllServersSave);
const unwrap = (x) => (x && x.data !== undefined && x.ctor ? x.data : x);
const out = { file: path.basename(file), servers: Object.keys(servers).length };
const home = unwrap(servers.home);
out.homeKeys = Object.keys(home);
const texte = unwrap(home.textFiles);
const skripte = unwrap(home.scripts);
const lauf = unwrap(home.runningScripts) ?? [];
const text = new Map();
const rek = (t) => {
  if (!t) return;
  if (Array.isArray(t)) for (const e of t) { const v = Array.isArray(e) && e.length === 2 ? e[1] : e; const d = unwrap(v); if (d && d.fn) text.set(d.fn, d.text); else if (Array.isArray(e) && typeof e[0] === "string") text.set(e[0], unwrap(e[1])?.text ?? unwrap(e[1])); }
};
rek(texte);
out.textFiles = text.size;
if (argv.includes("--liste")) { console.log([...text.keys()].sort().join("\n")); process.exit(0); }
const dat = opt("--datei");
if (dat) { console.log(text.get(dat) ?? "(nicht vorhanden; vorhanden: " + [...text.keys()].filter((k) => k.includes(dat.split("/").pop().slice(0, 4))).join(", ") + ")"); process.exit(0); }
console.log(JSON.stringify(out));
console.log("laufende Skripte auf home: " + (Array.isArray(lauf) ? lauf.length : "?"));
export { save, servers, unwrap };
