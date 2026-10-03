// Audit 03.10.2026, Bereich STGO: liest GoSave und StaneksGiftSave aus allen
// Spielstaenden unter backups/ und zeigt, ob IPvGO oder Stanek je benutzt
// wurden. Nur lesen, nichts schreiben.
// Aufruf: node tools/audit/stgo-save-scan.mjs [--all]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");

export function readSave(file) {
  const buf = fs.readFileSync(file);
  let txt;
  try {
    txt = zlib.gunzipSync(buf).toString("utf8");
  } catch (e) {
    // manche Dateien sind latin1-gzip (siehe sync/backup.js) - Rueckfall
    txt = zlib.gunzipSync(Buffer.from(buf.toString("latin1"), "latin1")).toString("utf8");
  }
  let obj = JSON.parse(txt);
  // Spielstand ist evtl. base64 oder doppelt verpackt
  if (typeof obj === "string") obj = JSON.parse(obj);
  return obj;
}

function parseMaybe(s) {
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return s; }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

function main() {
const all = process.argv.includes("--all");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).sort();
const pick = all ? files : files.filter((_, i) => i % 10 === 0 || i === files.length - 1);
for (const f of pick) {
  let save;
  try { save = readSave(path.join(dir, f)); } catch (e) { console.log(f, "LESEFEHLER", e.message); continue; }
  const d = save.data ?? save;
  const go = parseMaybe(d.GoSave);
  const st = parseMaybe(d.StaneksGiftSave);
  const goStats = go?.stats ?? go?.data?.stats;
  const prev = go?.previousGame ?? go?.data?.previousGame;
  const statsTxt = goStats ? JSON.stringify(goStats) : "-";
  const frags = st?.data?.fragments?.length ?? "-";
  console.log(f.padEnd(70), "go.stats=", statsTxt.slice(0, 160), "prevGame=", prev ? "ja" : "nein", "stanekFrags=", frags);
}
}
