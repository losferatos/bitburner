// FLUSS-EVENTS (Audit 03.10.2026): Was steht im Ereignisstrom data/events.json - ueber die Zeit?
//
// Frage: lib/events.js verspricht, dass Ereignisse der Klasse `bleibt` (jump, install, penalty, gate) bis zu
// 60 Stueck in den Ringpuffer ueberleben, weil daraus jump_latency_min, queued_augs_at_jump und
// ladder_rungs_ge3_per_week gerechnet werden. Das gilt nur fuer Schreiber, die lib/events.js benutzen.
// Schreiber, die selbst in strom.eintraege schieben und mit shift()/slice() kuerzen (figwatch.js, graftauto.js,
// popups.js, punish.js), kennen `bleibt` nicht. Gemessen wird an den Sicherungen (backups/INDEX.tsv): je Tag
// ein Stand, Anzahl der Eintraege je Art, Alter des aeltesten Eintrags, und - als unabhaengiger Sollwert - die
// Zahl der Knotenwechsel laut INDEX.tsv (Spalte bitNode/lauf) seit dem ersten Stand.
//
// Eichung: die Zahl der Knotenwechsel kommt aus INDEX.tsv, nicht aus dem Strom. Ein Strom, der die
// `bleibt`-Zusage hielte, muesste bis zu 60 jump-Eintraege tragen, also mindestens die Zahl der Wechsel
// (hier 14), solange sie unter 60 liegt.
//
// Aufruf: node tools/audit/fluss-events.mjs [--alle]   (Standard: eine Sicherung je Kalendertag)
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

// Knotenwechsel laut INDEX.tsv (bitNode UND lauf als Paar)
let wechsel = 0, vorher = null;
const wechselAb = new Map(); // Tag -> kumulierte Wechsel
for (const c of eintraege) {
  const k = c[ix("bitNode")] + "L" + c[ix("lauf")];
  if (vorher !== null && k !== vorher) wechsel++;
  vorher = k;
  wechselAb.set(c[ix("ts")].slice(0, 10), wechsel);
}

// eine Sicherung je Tag (die letzte), die den Strom enthaelt
const jeTag = new Map();
for (const c of eintraege) jeTag.set(c[ix("ts")].slice(0, 10), c);
const auswahl = process.argv.includes("--alle") ? eintraege : [...jeTag.values()];

function strom(datei) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, datei))).toString("utf8"));
  const servers = JSON.parse(save.data.AllServersSave);
  const home = servers.home && servers.home.data ? servers.home.data : servers.home;
  const tf = home.textFiles;
  const liste = tf.ctor === "JSONMap" ? tf.data : Object.entries(tf);
  for (const [n, f] of liste) {
    if (n === "data/events.json") {
      const t = f && f.data !== undefined && f.ctor ? f.data : f;
      const text = typeof t === "string" ? t : (t && (t.text ?? t.content ?? t.data)) ?? "";
      return JSON.parse(text);
    }
  }
  return null;
}

console.log("Tag        Sicherung".padEnd(60), "Eintr", "Bytes/Eintr", "jump", "install", "penalty", "gate", "note", "boot", "blocked", "aeltester");
for (const c of auswahl) {
  let s = null;
  try { s = strom(c[ix("datei")]); } catch (e) { console.log(c[ix("ts")].slice(0, 16), "Fehler", String(e.message).slice(0, 60)); continue; }
  if (!s) { console.log(c[ix("ts")].slice(0, 16).padEnd(17), c[ix("datei")].slice(0, 40).padEnd(42), "kein Strom"); continue; }
  const z = {};
  for (const e of s.eintraege) z[e.art] = (z[e.art] || 0) + 1;
  const alt = s.eintraege.length ? new Date(s.eintraege[0].wall || s.eintraege[0].ts || 0).toISOString().slice(5, 16) : "-";
  console.log(c[ix("ts")].slice(0, 16).padEnd(17), (c[ix("bitNode")] + "L" + c[ix("lauf")]).padEnd(8), ("Wechsel bis hier: " + (wechselAb.get(c[ix("ts")].slice(0, 10)) ?? "?")).padEnd(32),
    String(s.eintraege.length).padStart(5), String(z.jump || 0).padStart(5), String(z.install || 0).padStart(7), String(z.penalty || 0).padStart(7),
    String(z.gate || 0).padStart(4), String(z.note || 0).padStart(5), String(z.boot || 0).padStart(5), String(z.blocked || 0).padStart(7), alt);
}
console.log("\nKnotenwechsel laut INDEX.tsv zwischen erstem und letztem Stand:", wechsel);
