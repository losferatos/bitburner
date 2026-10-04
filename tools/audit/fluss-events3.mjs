// FLUSS-EVENTS3 (Audit 04.10.2026): Wer fuellt den Ereignisstrom? Rate je Notiz-Text ueber alle Tagesstaende.
//
// Frage: fluss-events.mjs zeigt, dass im Strom fast nur `note` steht und die bleibenden Arten fehlen. Hier: welcher Text,
// wie viele Eintraege je Stand, ueber welche Spanne (Eintraege je Stunde), und wie viele Eintraege sind Duplikate.
//
// Eichung: die Summe der Texte je Stand muss die Gesamtzahl der Eintraege ergeben (Ausgabe "Summe == Eintr").
//
// Aufruf: node tools/audit/fluss-events3.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const dir = path.join(ROOT, "backups");
const zeilen = fs.readFileSync(path.join(dir, "INDEX.tsv"), "utf8").trim().split(/\r?\n/);
const kopf = zeilen[0].split("\t");
const ix = (n) => kopf.indexOf(n);
const eintraege = zeilen.slice(1).map((z) => z.split("\t")).filter((c) => c[ix("datei")] && fs.existsSync(path.join(dir, c[ix("datei")])));
const jeTag = new Map();
for (const c of eintraege) jeTag.set(c[ix("ts")].slice(0, 10), c);

function strom(datei) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, datei))).toString("utf8"));
  const servers = JSON.parse(save.data.AllServersSave);
  const home = servers.home && servers.home.data ? servers.home.data : servers.home;
  const tf = home.textFiles;
  for (const [n, f] of tf.ctor === "JSONMap" ? tf.data : Object.entries(tf)) {
    if (n === "data/events.json") {
      const t = f && f.data !== undefined && f.ctor ? f.data : f;
      return JSON.parse(typeof t === "string" ? t : (t && (t.text ?? t.content ?? t.data)) ?? "");
    }
  }
  return null;
}
for (const [tag, c] of jeTag) {
  let s = null;
  try { s = strom(c[ix("datei")]); } catch { continue; }
  if (!s) continue;
  const k = {};
  for (const e of s.eintraege) {
    const schl = e.art + " | " + String(e.text).replace(/\d+([.,]\d+)?/g, "#").slice(0, 60);
    k[schl] = (k[schl] || 0) + 1;
  }
  const w0 = s.eintraege[0].wall, w1 = s.eintraege[s.eintraege.length - 1].wall;
  const std = Math.max(0.01, (w1 - w0) / 3600000);
  const top = Object.entries(k).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const summe = Object.values(k).reduce((a, b) => a + b, 0);
  console.log(tag, (c[ix("bitNode")] + "L" + c[ix("lauf")]).padEnd(6), "Eintr", String(s.eintraege.length).padStart(3), "Summe==Eintr", summe === s.eintraege.length, "Spanne", std.toFixed(1) + " h",
    top.map(([t, n]) => n + "x " + t + " (" + (n / std).toFixed(1) + "/h)").join("  ||  "));
}
