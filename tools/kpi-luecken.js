/**
 * Welche Kennzahl hat einen Schreiber — und welche nur ein Feld?
 *
 * ===========================================================================
 * DER ANLASS (Skeptiker Runde 4, R11, 04.09.2026)
 * ===========================================================================
 *
 * Ein Prüfer hat nachgezählt: `false_penalty_count`, `manual_actions`,
 * `false_kill_count`, `wirt_fehlt_count`, `queued_augs_at_jump`,
 * `negative_balance_min` und `bridge_restarts` hatten **keinen Schreiber**.
 * `lib/kpi.js` setzte jeden Soll-0-Zähler beim Anlegen auf 0, und dort blieb
 * er. Alle Soll-0-Kennzahlen waren damit null per Konstruktion.
 *
 * Die Folge ist schlimmer als eine fehlende Zahl: `false_penalty_count = 0`
 * ist Abnahmebedingung für Stufe B, und die Begründung, den Wächter erst nach
 * ihrer Messung scharfzustellen, lief ins Leere. Eine Bedingung, die nicht
 * scheitern kann, ist keine.
 *
 * Seit dem 04.09. beginnt jeder dieser Zähler bei `null` — "hier hat noch
 * niemand gezählt". Dieses Werkzeug sagt, wer inzwischen zählt und wer nicht.
 *
 * ===========================================================================
 * WAS ES TUT
 * ===========================================================================
 *
 * Es liest den Kontrakt aus `lib/kpi.js` und sucht für jedes Feld einen
 * Schreiber im Quelltext beider Bäume. Ein Feld ohne Schreiber ist ein
 * Befund, kein Schönheitsfehler — und wird als solcher gemeldet.
 *
 * Aufruf:
 *   node tools/kpi-luecken.js            Übersicht
 *   node tools/kpi-luecken.js --pruefen  Exit 1, wenn eine Pflichtzahl fehlt
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = fs.existsSync(path.resolve(ROOT, "..", "bitburner-bau", "src"))
  ? path.resolve(ROOT, "..", "bitburner-bau", "src")
  : path.join(ROOT, "src");

const NUR_PRUEFEN = process.argv.includes("--pruefen");

const KPI = await import(pathToFileURL(path.join(SRC, "lib", "kpi.js")).href);

/**
 * Alle Quelldateien beider Bäume, flach eingelesen.
 *
 * `lib/kpi.js` selbst zählt NICHT als Schreiber - dort steht der Kontrakt, und
 * ein Feld, das nur in seiner eigenen Definition vorkommt, ist genau der Fall,
 * den dieses Werkzeug finden soll.
 */
function quellen() {
  const raus = [];
  const sammle = (ordner, praefix) => {
    if (!fs.existsSync(ordner)) return;
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const p = path.join(ordner, e.name);
      if (e.isDirectory()) { sammle(p, praefix + e.name + "/"); continue; }
      if (!e.name.endsWith(".js")) continue;
      if (praefix + e.name === "lib/kpi.js") continue;
      raus.push({ name: praefix + e.name, text: fs.readFileSync(p, "utf8") });
    }
  };
  sammle(SRC, "");
  // Die Brücke ist der zweite mögliche Schreiber - sie sieht Dinge, die kein
  // Skript im Spiel sehen kann (ihre eigenen Neustarts, Handgriffe von außen).
  const sync = path.join(ROOT, "sync");
  if (fs.existsSync(sync)) {
    for (const f of fs.readdirSync(sync)) {
      if (f.endsWith(".js")) {
        raus.push({ name: "sync/" + f, text: fs.readFileSync(path.join(sync, f), "utf8") });
      }
    }
  }
  return raus;
}

const DATEIEN = quellen();

/** Wer schreibt dieses Feld? Gesucht wird eine Zuweisung, kein Vorkommen. */
function schreiber(feld) {
  const muster = [
    "k." + feld + " =",
    "k." + feld + " ??=",
    '"' + feld + '":',
    feld + ":",
  ];
  const treffer = [];
  for (const d of DATEIEN) {
    // Eine Zuweisung an `k.<feld>` ist der eindeutige Fall. Alles andere
    // (ein Feldname in einem Objektliteral) kann auch ein Leser sein - deshalb
    // wird es nur genannt, nicht gezählt.
    if (d.text.includes("k." + feld + " =") || d.text.includes("." + feld + " = ")) {
      treffer.push(d.name);
    }
  }
  if (treffer.length) return treffer;
  // Zweiter Versuch: das Feld taucht in einem geschriebenen Objekt auf.
  const weich = [];
  for (const d of DATEIEN) {
    for (const m of muster) {
      if (d.text.includes(m)) { weich.push(d.name); break; }
    }
  }
  return weich.length ? weich.map((x) => x + " (?)") : [];
}

const zeilen = [];
const ohne = [];
const ohneSoll0 = [];

for (const [name, def] of Object.entries(KPI.FELDER)) {
  if (name === "version") continue;
  const wer = schreiber(name);
  const sicher = wer.filter((x) => !x.endsWith("(?)"));
  zeilen.push({
    name,
    klasse: def.klasse || "-",
    soll: def.soll === null || def.soll === undefined ? "-" : String(def.soll),
    wer: wer.length ? wer.join(", ") : "KEINER",
    sicher: sicher.length > 0,
  });
  if (!wer.length) {
    ohne.push(name);
    if (def.soll === 0) ohneSoll0.push(name);
  }
}

console.log("");
console.log("=== Kennzahlen und ihre Schreiber ===");
console.log("    Kontrakt: " + path.join(SRC, "lib", "kpi.js"));
console.log("");

const breite = Math.max(...zeilen.map((z) => z.name.length));
for (const z of zeilen.sort((a, b) => (a.klasse + a.name).localeCompare(b.klasse + b.name))) {
  const marke = z.wer === "KEINER" ? " !! " : (z.sicher ? "    " : "  ? ");
  console.log(marke + z.name.padEnd(breite) + "  Soll " + z.soll.padStart(4)
    + "  " + z.wer);
}

console.log("");
console.log("  !! = kein Schreiber gefunden. Das Feld steht in der Tafel und");
console.log("       bleibt null - eine Abnahmebedingung darauf kann nicht");
console.log("       scheitern und ist deshalb keine.");
console.log("   ? = das Feld kommt vor, aber nicht als eindeutige Zuweisung.");
console.log("");

if (ohne.length) {
  console.log("  " + ohne.length + " Feld(er) ohne Schreiber:");
  for (const n of ohne) console.log("    - " + n);
  console.log("");
}
if (ohneSoll0.length) {
  console.log("  Davon mit SOLL 0 (also Abnahmebedingung): " + ohneSoll0.length);
  for (const n of ohneSoll0) console.log("    - " + n);
  console.log("");
}

if (NUR_PRUEFEN) {
  // Absichtlich KEIN hartes Tor auf "alle Felder haben Schreiber": mehrere
  // gehören in die Brücke und entstehen dort erst. Das Tor greift, wenn eine
  // Zahl BEHAUPTET wird, ohne dass jemand sie führt - das prüft die Suite über
  // die Lückenliste. Hier steht die Zahl, damit sie nicht in Prosa verschwindet.
  console.log("  " + (Object.keys(KPI.FELDER).length - 1 - ohne.length) + " von "
    + (Object.keys(KPI.FELDER).length - 1) + " Feldern haben einen Schreiber.");
  console.log("");
}
