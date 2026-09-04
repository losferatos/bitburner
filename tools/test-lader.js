/**
 * Ebene 0: der Lader des Pruefstands (`tools/mock/lader.js`).
 *
 * ===========================================================================
 * WARUM DER LADER SELBST GEPRUEFT WIRD
 * ===========================================================================
 *
 * Er ist kein Werkzeug des Bots - er ist das, WOMIT geprueft wird. Ein Fehler
 * in ihm sieht aus wie ein Fehler im geprueften Code, und man sucht ihn an
 * der falschen Stelle. Am 04.09.2026 ist genau das zweimal passiert:
 *
 *   - Eine Escape-Kette machte aus `\\b` ein Rueckschritt-Zeichen. Der Lader
 *     schrieb Kopien, deren Importe niemand mehr fand.
 *   - Die transitiven Kopien trugen KEINE Prozessnummer im Namen (R29).
 *     `lib/figur.js` wurde schlicht zu `lib/figur.mjs` - zwei gleichzeitige
 *     Laeufe schrieben dieselbe Datei und loeschten im `finally` die des
 *     jeweils anderen, mitten in dessen Import.
 *
 * Das zweite fiel nicht auf, weil `test-alles.js` seriell laeuft. Das ist
 * eine Eigenschaft des Laeufers, keine der Sache.
 *
 * ===========================================================================
 * WAS HIER AUF DEM SPIEL STEHT
 * ===========================================================================
 *
 * Die Kopien liegen unter `src/`, weil nur dort die relativen Pfade stimmen.
 * `src/` geht ueber die Bruecke ins laufende Spiel. Eine liegengebliebene
 * `.mock`-Datei ist damit kein Schoenheitsfehler.
 *
 * Aufruf: node tools/test-lader.js
 */

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(was, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + was + (zusatz ? "  (" + zusatz + ")" : ""));
  } else {
    rot++;
    fehler.push(was + (zusatz ? " - " + zusatz : ""));
    console.log("  ROT   " + was + (zusatz ? " - " + zusatz : ""));
  }
}

/** Der Ordner, in dem der Lader arbeitet: bevorzugt der Worktree. */
function srcOrdner() {
  const k = [
    path.join(ROOT, "src"),
    path.resolve(ROOT, "..", "bitburner-bau", "src"),
  ];
  return k.find((p) => fs.existsSync(p)) || null;
}

console.log("");
console.log("=== Der Lader des Pruefstands ===");

const SRC = srcOrdner();
if (!SRC) {
  console.log("\n  Kein src-Ordner gefunden.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- er schreibt den Spielstil in Node-Importe um --");
{
  const { ladeSpielskript } = await import("./mock/lader.js");
  // `lib/figurns.js` importiert `lib/figur.js` im Spielstil - das ist die
  // Kette, an der die einstufige Fassung zerbrach.
  const m = await ladeSpielskript(path.join(SRC, "lib", "figurns.js"));
  pruefe("ein Modul mit transitivem Spielstil-Import laedt", !!m);
  pruefe("und exportiert etwas", Object.keys(m).length > 0,
    Object.keys(m).slice(0, 4).join(", "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- ZWEI LAEUFE GLEICHZEITIG (R29) --");
{
  // DIE VORFUEHRUNG. Vorher schrieben beide Laeufe `lib/figur.mjs`, und
  // wessen `finally` zuerst kam, riss dem anderen die Datei unter dem Import
  // weg.
  //
  // WIE STARK DIESE PROBE IST - gemessen, nicht geschaetzt (04.09.2026): in
  // einem gesonderten Versuch mit zwei WIRKLICH gleichzeitigen Prozessen fiel
  // der alte Lader in 2 von 16 Laeufen um, der neue in 0 von 16. Bei zwoelf
  // Laeufen hier bleibt der alte Fehler also mit rund 20 % Wahrscheinlichkeit
  // unentdeckt. Das ist zu wenig fuer ein Tor.
  //
  // Und bis zum selben Tag war diese Probe ueberhaupt nicht gleichzeitig -
  // siehe unten. Die Zahl stammte aus dem gesonderten Versuch, nicht von hier.
  //
  // Deshalb ist NICHT diese Probe die Absicherung, sondern die
  // Strukturpruefung darunter - die kann nicht durch Glueck bestehen. Diese
  // hier zeigt, dass die Strukturpruefung ueber etwas Echtes wacht.
  const skript = path.join(os.tmpdir(), "lader-probe-" + process.pid + ".mjs");
  fs.writeFileSync(skript, [
    'import { pathToFileURL } from "node:url";',
    'const { ladeSpielskript } = await import(pathToFileURL(process.argv[2]).href);',
    "const m = await ladeSpielskript(process.argv[3]);",
    'if (!m || !Object.keys(m).length) { console.log("LEER"); process.exit(2); }',
    'console.log("OK");',
  ].join("\n"), "utf8");

  const laderUrl = path.join(HIER, "mock", "lader.js");
  const ziel = path.join(SRC, "lib", "figurns.js");

  // ECHT GLEICHZEITIG (Skeptiker Runde 5, W2).
  //
  // Hier stand `execFileSync` in einem `map`. Das blockiert die Event-Loop:
  // gemessen startete der zweite Prozess exakt in dem Moment, in dem der erste
  // endete (0->458 ms, 458->907 ms). Er sah die Kopien des ersten nie - die
  // Kollision, die vorgefuehrt werden soll, konnte per Konstruktion nicht
  // auftreten. Die ganze Datei brauchte 0,94 s fuer angeblich zwoelf
  // nebenlaeufige Prozesse; das haette auffallen muessen.
  //
  // `process.execPath` statt "node": findet die Umgebung `node` nicht auf dem
  // PATH, feuert bei `spawn` kein `exit`, und der Test haengt.
  const starte = () => new Promise((res) => {
    execFile(process.execPath, [skript, laderUrl, ziel],
      { encoding: "utf8", cwd: ROOT, timeout: 30000 },
      (err, out, errOut) => res({
        ok: !err && String(out).includes("OK"),
        text: ((out || "") + (errOut || "")).trim().slice(0, 200),
      }));
  });

  let paare = 0;
  let fehlgeschlagen = 0;
  let letzterFehler = "";
  for (let i = 0; i < 6; i++) {
    // Zwei echte Prozesse, gleichzeitig gestartet - im selben Prozess gaebe es
    // die Kollision nicht, weil dann beide dieselbe Prozessnummer traegen.
    const laeufe = await Promise.all([starte(), starte()]);
    paare++;
    for (const l of laeufe) {
      if (!l.ok) { fehlgeschlagen++; letzterFehler = l.text; }
    }
  }
  try { fs.unlinkSync(skript); } catch { /* egal */ }

  pruefe(paare + " Paare gleichzeitiger Laeufe, keiner bricht ab",
    fehlgeschlagen === 0,
    fehlgeschlagen ? fehlgeschlagen + " Fehlschlag(e): " + letzterFehler : "");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- Leichen frueherer Laeufe werden weggeraeumt (W1) --");
{
  // Das `finally` des Laders laeuft bei Strg-C, kill oder Absturz NICHT.
  // Danach sind sechs Ebene-2-Tests rot, ohne dass am geprueften Code etwas
  // fehlt - sie pruefen zu Recht, dass nichts unter src/ liegen bleibt.
  //
  // Zwei Koeder: einer mit einer Prozessnummer, die es sicher nicht gibt, und
  // einer mit der EIGENEN. Der zweite ist die Gegenprobe - wer alles wegraeumt,
  // was `.mock-` heisst, reisst dem gerade laufenden Nachbarlauf die Dateien
  // unter dem Import weg. Genau das war der Fehler, den R29 behoben hat.
  const tote = path.join(SRC, ".mock-leiche-999999.mjs");
  const eigene = path.join(SRC, ".mock-leiche-" + process.pid + ".mjs");
  fs.writeFileSync(tote, "// alt", "utf8");
  fs.writeFileSync(eigene, "// meine", "utf8");
  try {
    const { ladeSpielskript } = await import("./mock/lader.js");
    await ladeSpielskript(path.join(SRC, "lib", "figurns.js"));
    pruefe("die Leiche eines toten Prozesses ist weg", !fs.existsSync(tote));
    pruefe("die eigene Datei bleibt", fs.existsSync(eigene),
      "sonst reisst ein Lauf dem anderen die Kopien weg");
  } finally {
    for (const f of [tote, eigene]) { try { fs.unlinkSync(f); } catch { /* egal */ } }
  }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- die Prozessnummer steht in JEDEM Kopienamen --");
{
  // Strukturprobe statt Verhaltensprobe: der Wettlauf oben kann bestanden
  // werden, ohne dass die Ursache weg ist (er ist zeitabhaengig). Diese hier
  // kann es nicht.
  const txt = fs.readFileSync(path.join(HIER, "mock", "lader.js"), "utf8");
  // Gezaehlt wird die Verkettung, nicht das blosse Vorkommen von ".mock-":
  // die Zeichenkette steht auch in Kommentaren, und ein Test, der an einem
  // Kommentar scheitert, wird abgeschaltet statt gelesen.
  pruefe("es gibt genau EINE Stelle, die Kopienamen bildet",
    (txt.match(/"\.mock-" \+/g) || []).length === 1,
    "sonst laufen die Ebenen wieder auseinander");
  // NICHT ueber 120 Zeichen hinweg suchen (Skeptiker Runde 5, K5): `.mock-`
  // steht auch in den Kommentaren dieser Datei, und ein Treffer dort haette
  // genuegt. Geprueft wird die Verkettung selbst, in einer Zeile.
  pruefe("und sie traegt process.pid",
    // Zusammengesetzt, weil der Ausdruck selbst ein Escape fuer den
    // Zeilenumbruch enthaelt - eine Regex mit echtem Umbruch darin ist keine.
    new RegExp('"[.]mock-"[^' + "\\" + 'n]*process[.]pid').test(txt),
    "die Namensbildung und die Prozessnummer muessen dieselbe Zeile sein");
  pruefe("kein blosses .replace(/\\.js$/, \".mjs\") mehr",
    !txt.includes('.replace(/\\.js$/, ".mjs")'),
    "das war die Zeile, die den Prozessanteil verlor");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- keine Kopie bleibt liegen (zuletzt geprueft) --");
{
  // DIESER ABSCHNITT STAND FRUEHER GANZ OBEN (Skeptiker Runde 5, K5) - also
  // vor dem Wettlauf, dem Abschnitt, der am ehesten Reste hinterlaesst. Er
  // prueft jetzt, was NACH allem uebrig ist.
  const reste = [];
  const suche = (ordner, tiefe = 0) => {
    if (tiefe > 3) return;
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      if (e.isDirectory()) suche(path.join(ordner, e.name), tiefe + 1);
      else if (e.name.startsWith(".mock-") || e.name.endsWith(".mjs")) {
        reste.push(path.relative(SRC, path.join(ordner, e.name)));
      }
    }
  };
  suche(SRC);
  pruefe("weder .mock- noch .mjs unter src/", reste.length === 0,
    reste.join(", "));
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
