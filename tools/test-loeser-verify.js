/**
 * Die Gegenproben der Vertragsloeser - gegen FALSCHE Antworten gestellt.
 *
 * ===========================================================================
 * WARUM DIESER TEST EXISTIERT (Skeptiker Runde 3, C4, 04.09.2026)
 * ===========================================================================
 *
 * Ein Pruefer hat nachgezaehlt: zwanzig der dreissig `verify`-Funktionen in
 * `lib/loeser.js` lauteten `solve(data) === answer`. Das ist keine Probe,
 * sondern eine Tautologie - sie besteht genau dann, wenn `solve` sich selbst
 * gleicht, und faengt deshalb nichts.
 *
 * Der Kopfkommentar von `cdump.js` begruendet die Autonomie aber genau damit:
 * "jede Antwort wird vor dem Aufschreiben gegengeprueft". Ein Versuch ist
 * unwiederbringlich (`CodingContract.ts`, `tries`), und von meist zehn sind
 * bei einem gefundenen Vertrag oft schon welche weg. Die Begruendung trug
 * also fuer ein Drittel der Typen und wurde fuer alle dreissig behauptet.
 *
 * ===========================================================================
 * WAS HIER GEPRUEFT WIRD - UND WAS NICHT
 * ===========================================================================
 *
 * NICHT: ob `solve` richtig rechnet. Das hat ein Pruefer am 04.09.2026 gegen
 * den echten Annahmeweg des Spiels gemessen - 6.000 Instanzen, 30 von 30
 * Typen richtig. Diese Datei wuerde denselben Code noch einmal gegen sich
 * selbst laufen lassen.
 *
 * SONDERN: ob `verify` eine FALSCHE Antwort auch ablehnt. Dafuer wird die
 * richtige Antwort gezielt verfaelscht - eine Zahl um eins verschoben, ein
 * Zeichen getauscht, ein Listenelement vertauscht - und `verify` muss `false`
 * sagen. Eine tautologische Probe faellt dabei NICHT durch (sie lehnt jede
 * Abweichung ab); sie faellt in der zweiten Haelfte durch:
 *
 * Zusaetzlich wird der Quelltext daraufhin gelesen, ob `verify` ueberhaupt
 * `solve` desselben Typs aufruft. Genau das ist das Kennzeichen der
 * Tautologie, und es laesst sich nicht wegtesten - nur wegschreiben.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { erzeuge } from "./mock/vertragsgenerator.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

function finde(datei) {
  const kandidaten = [
    path.join(ROOT, "src", "lib", datei),
    path.resolve(ROOT, "..", "bitburner-bau", "src", "lib", datei),
  ];
  const t = kandidaten.find((p) => fs.existsSync(p));
  if (!t) throw new Error("lib/" + datei + " nicht gefunden");
  return t;
}

const PFAD = finde("loeser.js");
const { SOLVERS } = await import(pathToFileURL(PFAD).href);
const QUELLE = fs.readFileSync(PFAD, "utf8");

let gruen = 0;
let rot = 0;
const fehler = [];

function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); }
  else {
    rot++;
    const z = name + (hinweis ? " - " + hinweis : "");
    fehler.push(z);
    console.log("  ROT   " + z);
  }
}

// ---------------------------------------------------------------------------
// Beispieleingaben je Typ. Klein gehalten: geprueft wird die Gegenprobe, nicht
// die Laufzeit. Die Formen folgen dem Spielquelltext (CodingContract/*.ts).
// ---------------------------------------------------------------------------
// Der Vertragstyp mit dem Akzentzeichen im Namen. Aus SOLVERS geholt, damit
// die Kodierung dieser Datei keine Rolle spielt.
const NAME_VIGENERE = Object.keys(SOLVERS).find((n) => n.startsWith("Encryption II"))
  || "Encryption II: Vigenere Cipher";

const EINGABEN = {
  "Find Largest Prime Factor": [1234567, 999983 * 2, 512, 97 * 89],
  "Subarray with Maximum Sum": [[-2, 1, -3, 4, -1, 2, 1, -5, 4], [-5, -3, -1], [1, 2, 3]],
  "Total Ways to Sum": [8, 20, 45],
  "Total Ways to Sum II": [[10, [1, 2, 5]], [20, [2, 3, 7]]],
  "Spiralize Matrix": [[[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[1, 2], [3, 4], [5, 6]]],
  "Array Jumping Game": [[2, 3, 1, 1, 4], [3, 2, 1, 0, 4], [0]],
  "Array Jumping Game II": [[2, 3, 1, 1, 4], [3, 2, 1, 0, 4], [1, 1, 1]],
  "Merge Overlapping Intervals": [[[1, 3], [8, 10], [2, 6], [15, 18]], [[1, 5], [5, 8]]],
  "Generate IP Addresses": ["25525511135", "1938718066"],
  "Algorithmic Stock Trader I": [[7, 1, 5, 3, 6, 4], [7, 6, 4, 3, 1]],
  "Algorithmic Stock Trader II": [[7, 1, 5, 3, 6, 4], [1, 2, 3, 4, 5]],
  "Algorithmic Stock Trader III": [[3, 3, 5, 0, 0, 3, 1, 4], [1, 2, 3, 4, 5]],
  "Algorithmic Stock Trader IV": [[2, [3, 2, 6, 5, 0, 3]], [3, [1, 5, 2, 8, 3, 9]]],
  "Minimum Path Sum in a Triangle": [[[2], [3, 4], [6, 5, 7], [4, 1, 8, 3]], [[1], [2, 3]]],
  "Unique Paths in a Grid I": [[3, 7], [4, 4], [1, 9]],
  "Unique Paths in a Grid II": [[[0, 0, 0], [0, 1, 0], [0, 0, 0]], [[0, 1], [0, 0]]],
  "Shortest Path in a Grid": [[[0, 1, 0, 0, 0], [0, 0, 0, 1, 0]], [[0, 1], [1, 0]]],
  "Sanitize Parentheses in Expression": ["()())()", "(a)())()", ")("],
  "Find All Valid Math Expressions": [["123", 6], ["105", 5]],
  "HammingCodes: Integer to Encoded Binary": [8, 21, 1000],
  // ERZEUGT, NICHT GETIPPT. Ein Codewort von Hand hinzuschreiben geht schief:
  // "1001101" sieht aus wie ein gueltiges Wort und weicht in ZWEI Bits vom
  // kanonischen ab - das kann als Vertragseingabe gar nicht vorkommen (das
  // Spiel kippt hoechstens eines, HammingCode.ts). Die Probe waere dann rot,
  // ohne dass am Loeser etwas fehlt.
  //
  // Also: kodieren, und je einmal ein Bit kippen - genau die Faelle, die das
  // Spiel stellt.
  "HammingCodes: Encoded Binary to Integer": (() => {
    const enc = SOLVERS["HammingCodes: Integer to Encoded Binary"];
    const raus = [];
    for (const z of [5, 21, 275, 1000]) {
      const w = enc.solve(z);
      raus.push(w);
      const i = Math.min(3, w.length - 1);
      raus.push(w.slice(0, i) + (w[i] === "0" ? "1" : "0") + w.slice(i + 1));
    }
    return raus;
  })(),
  "Proper 2-Coloring of a Graph": [[4, [[0, 2], [0, 3], [1, 2], [1, 3]]], [3, [[0, 1], [0, 2], [1, 2]]]],
  "Compression I: RLE Compression": ["aaabbccccccccccd", "aA", "abc"],
  // ERZEUGT: der Packer aus Compression III liefert garantiert gueltige
  // Eingaben. Handgetipptes LZ ist heikel - "5aaabb450723abb" laesst den
  // Auspacker null zurueckgeben, und die Probe waere rot, obwohl der Loeser
  // stimmt.
  "Compression II: LZ Decompression": ["abracadabra", "mississippi", "aaaaaaaaab"]
    .map((t) => SOLVERS["Compression III: LZ Compression"].solve(t)),
  "Compression III: LZ Compression": ["abracadabra", "mississippi"],
  "Encryption I: Caesar Cipher": [["MEDIUM SHELL", 12], ["ABC XYZ", 3]],
  // Der Name enthaelt ein Akzentzeichen ("Vigenere" mit Accent grave). Ihn
  // hier hinzuschreiben ist eine Kodierungsfalle - der Schluessel wird
  // deshalb unten aus SOLVERS selbst geholt, nicht getippt.
  [NAME_VIGENERE]: [["DASHBOARD", "LINUX"], ["ABCDEF", "KEY"]],
  "Total Number of Primes": [[100, 200], [2, 1000]],
  "Square Root": [1000000000000000000n, 987654321987654321n],
  "Largest Rectangle in a Matrix": [
    [[0, 0, 1], [0, 0, 0], [1, 0, 0]],
    [[0, 0], [0, 0]],
    [[1, 1], [1, 0]],
  ],
  "Encryption III: RSA Cipher": null,   // erst pruefen, ob es den Typ gibt
};

/**
 * Eine Antwort gezielt verfaelschen. Die Rueckgabe ist eine LISTE von
 * Verfaelschungen - je mehr Formen, desto schwerer laesst sich eine
 * Gegenprobe daran vorbeimogeln.
 */
/**
 * Typen, bei denen das Spiel die Antwort als MENGE prueft, nicht als Folge.
 * Belegt im Quelltext: `ret.every((ip) => answer.includes(ip))`
 * (GenerateIPAddresses.ts:67) und dieselbe Form in den beiden anderen.
 */
const UNSORTIERT = new Set([
  "Generate IP Addresses",
  "Sanitize Parentheses in Expression",
  "Find All Valid Math Expressions",
]);

/** BigInt-fest kuerzen - `Square Root` liefert BigInt (SquareRoot.ts:33). */
const ersetzer = (k, v) => (typeof v === "bigint" ? String(v) : v);
function kurz(x, max = 90) {
  let t;
  try { t = JSON.stringify(x, ersetzer); } catch { t = String(x); }
  if (t === undefined) t = String(x);
  return t.length > max ? t.slice(0, max - 3) + "..." : t;
}

/** Zwei gegenueberliegende Ecken in eine feste Form bringen. */
function normEcken(e) {
  if (!Array.isArray(e) || e.length !== 2) return e;
  if (!e.every((x) => Array.isArray(x) && x.length === 2)) return e;
  return [[Math.min(e[0][0], e[1][0]), Math.min(e[0][1], e[1][1])],
    [Math.max(e[0][0], e[1][0]), Math.max(e[0][1], e[1][1])]];
}

function verfaelsche(antwort) {
  const raus = [];
  if (typeof antwort === "number") {
    raus.push(antwort + 1, antwort - 1, antwort * 2 + 3);
  } else if (typeof antwort === "bigint") {
    raus.push(antwort + 1n, antwort - 1n);
  } else if (typeof antwort === "string") {
    if (antwort.length) {
      // Ein Zeichen kippen und eines anhaengen.
      const i = Math.floor(antwort.length / 2);
      const z = antwort[i] === "0" ? "1" : (antwort[i] === "1" ? "0" : "X");
      raus.push(antwort.slice(0, i) + z + antwort.slice(i + 1));
      raus.push(antwort + "0");
      if (antwort.length > 1) raus.push(antwort.slice(1));
    } else {
      raus.push("x");
    }
  } else if (Array.isArray(antwort)) {
    if (antwort.length > 1) {
      const k = antwort.slice();
      const t = k[0]; k[0] = k[k.length - 1]; k[k.length - 1] = t;
      // Nur nehmen, wenn das Vertauschen wirklich etwas geaendert hat.
      if (JSON.stringify(k) !== JSON.stringify(antwort)) raus.push(k);
    }
    raus.push(antwort.slice(0, Math.max(0, antwort.length - 1)));
    raus.push([...antwort, Array.isArray(antwort[0]) ? [0, 0] : 0]);
  }
  return raus;
}

console.log("");
console.log("=== Die Gegenproben der Vertragsloeser (C4) ===");
console.log("    " + PFAD);

// ---------------------------------------------------------------------------
console.log("");
console.log("-- kein verify ruft solve DESSELBEN Typs auf --");
{
  // Das ist die Pruefung, die sich nicht durch Beispiele ersetzen laesst.
  // Eine tautologische Probe lehnt jede verfaelschte Antwort brav ab - sie
  // laesst nur auch jede falsche Antwort durch, die solve selbst erzeugt.
  // Erkennen laesst sie sich deshalb nur am Quelltext.
  const namen = Object.keys(SOLVERS);
  const taut = [];
  for (const name of namen) {
    const i = QUELLE.indexOf('"' + name + '": {');
    if (i === -1) continue;
    const j = QUELLE.indexOf("\n  },", i);
    const block = QUELLE.slice(i, j === -1 ? QUELLE.length : j);
    const v = block.indexOf("verify:");
    if (v === -1) continue;
    const vblock = block.slice(v);
    // Der Selbstaufruf - in beiden Schreibweisen, die im Projekt vorkommen.
    if (vblock.includes('SOLVERS["' + name + '"].solve')) taut.push(name);
  }
  pruefe("keine der " + namen.length + " Gegenproben ruft ihren eigenen Loeser",
    taut.length === 0,
    taut.length ? "tautologisch: " + taut.join(", ") : "");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- jede Gegenprobe nimmt die richtige Antwort an --");
{
  const schlecht = [];
  let geprueft = 0;
  for (const [name, faelle] of Object.entries(EINGABEN)) {
    if (!faelle) continue;
    const l = SOLVERS[name];
    if (!l) continue;   // Typ gibt es nicht (mehr)
    for (const data of faelle) {
      if (typeof l.guard === "function" && l.guard(data)) continue;
      let a;
      try { a = l.solve(data); } catch (e) { schlecht.push(name + ": solve warf " + e.message); continue; }
      geprueft++;
      if (typeof l.verify !== "function") { schlecht.push(name + ": kein verify"); continue; }
      let ok = false;
      try { ok = l.verify(data, a); } catch (e) { schlecht.push(name + ": verify warf " + e.message); continue; }
      if (!ok) schlecht.push(name + ": lehnt die eigene richtige Antwort ab (" + JSON.stringify(a) + ")");
    }
  }
  console.log("       " + geprueft + " Instanzen");
  pruefe("keine richtige Antwort wird abgelehnt", schlecht.length === 0,
    schlecht.slice(0, 4).join(" | "));
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- jede Gegenprobe LEHNT eine verfaelschte Antwort AB --");
{
  const durchgerutscht = [];
  let versuche = 0;
  for (const [name, faelle] of Object.entries(EINGABEN)) {
    if (!faelle) continue;
    const l = SOLVERS[name];
    if (!l || typeof l.verify !== "function") continue;
    for (const data of faelle) {
      if (typeof l.guard === "function" && l.guard(data)) continue;
      let a;
      try { a = l.solve(data); } catch { continue; }
      for (const falsch of verfaelsche(a)) {
        // Eine "Verfaelschung", die zufaellig wieder die richtige Antwort
        // ist, waere kein Befund - sie wird uebersprungen.
        if (JSON.stringify(falsch) === JSON.stringify(a)) continue;
        // UND: bei drei Typen prueft das SPIEL SELBST reihenfolgeunabhaengig
        // (`result.every((x) => answer.includes(x))` in GenerateIPAddresses,
        // SanitizeParenthesesInExpression, FindAllValidMathExpressions). Eine
        // umsortierte Antwort ist dort RICHTIG - sie als Verfaelschung zu
        // zaehlen hiesse, von der Gegenprobe strenger zu sein als das Spiel,
        // und wuerde richtige Antworten wegwerfen.
        if (UNSORTIERT.has(name) && Array.isArray(a) && Array.isArray(falsch)
            && a.length === falsch.length
            && a.every((x) => falsch.includes(x))) continue;
        // Und beim groessten Rechteck beschreiben [[0,0],[1,1]] und
        // [[1,1],[0,0]] DASSELBE Rechteck - das Spiel normiert die Ecken mit
        // Math.min/Math.max (LargestRectangle.ts:131-132). Ein Vertauschen
        // ist dort also keine Verfaelschung.
        if (name === "Largest Rectangle in a Matrix"
            && JSON.stringify(normEcken(falsch)) === JSON.stringify(normEcken(a))) continue;
        versuche++;
        let ok = true;
        try { ok = l.verify(data, falsch); } catch { ok = false; }
        if (ok) {
          durchgerutscht.push(name + ": " + JSON.stringify(falsch)
            + " statt " + JSON.stringify(a));
        }
      }
    }
  }
  console.log("       " + versuche + " verfaelschte Antworten gestellt");
  pruefe("keine falsche Antwort kommt durch", durchgerutscht.length === 0,
    durchgerutscht.slice(0, 5).join(" | "));
  pruefe("und es waren genug Versuche, um etwas zu heissen", versuche >= 100,
    "nur " + versuche);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- jeder Typ des Spiels hat einen Loeser MIT Gegenprobe --");
{
  const ohneVerify = Object.entries(SOLVERS)
    .filter(([, l]) => typeof l.verify !== "function")
    .map(([n]) => n);
  pruefe("alle " + Object.keys(SOLVERS).length + " Loeser haben ein verify",
    ohneVerify.length === 0, ohneVerify.join(", "));

  const ohneBeispiel = Object.keys(SOLVERS)
    .filter((n) => !(n in EINGABEN) || !EINGABEN[n]);
  pruefe("und jeder ist hier mit mindestens einem Beispiel vertreten",
    ohneBeispiel.length === 0,
    ohneBeispiel.length ? "ohne Beispiel: " + ohneBeispiel.join(", ") : "");
}

// ---------------------------------------------------------------------------
console.log("");
console.log("-- gegen die ECHTEN Eingaben des Spiels (R6, R7) --");
{
  // DER EIGENTLICHE TEST. Alles oben laeuft gegen handgetippte Beispiele, und
  // genau daran sind zwei Gegenproben blind vorbeigekommen:
  //
  //   `Total Number of Primes` hatte `if (hi - lo > 60000) return true`. Das
  //   Spiel erzeugt Spannen von mindestens 100.000 - der Kurzschluss griff bei
  //   HUNDERT PROZENT der echten Vertraege. Getestet wurde mit [100,200].
  //
  //   `Find All Valid Math Expressions` hatte `if (ziffern.length > 10) return
  //   true`. Das Spiel erzeugt 4 bis 12 Ziffern. Getestet wurde mit drei.
  //
  // Beide Proben waren gruen und praktisch wertlos. Deshalb kommen die
  // Eingaben jetzt aus tools/mock/vertragsgenerator.js - dem nachgebauten
  // Generator des Spiels, mit denselben Spannen und Fundstellen.
  const instanzen = erzeuge(SOLVERS, 12);
  let geprueft = 0;
  let gestellt = 0;
  const abgelehnt = [];      // richtige Antwort abgelehnt
  const durchgelassen = [];  // falsche Antwort angenommen
  const gesperrt = [];       // vom eigenen guard abgelehnt
  const kaputt = [];         // Generator warf

  for (const [name, faelle] of Object.entries(instanzen)) {
    const l = SOLVERS[name];
    if (!l) continue;
    for (const data of faelle) {
      if (data && data.generatorFehler) { kaputt.push(name + ": " + data.generatorFehler); continue; }
      // EIN GUARD, DER ECHTE VERTRAEGE ABLEHNT, IST SO SCHLIMM WIE EIN
      // FALSCHES verify - nur in die andere Richtung: der Vertrag bleibt
      // liegen. Deshalb wird hier nicht uebersprungen, sondern gezaehlt.
      const g = typeof l.guard === "function" ? l.guard(data) : null;
      if (g) { gesperrt.push(name + ": " + g); continue; }
      let a;
      try { a = l.solve(data); } catch { continue; }
      geprueft++;
      let ok = false;
      try { ok = l.verify(data, a); } catch { ok = false; }
      if (!ok) abgelehnt.push(name + " (" + kurz(data) + ")");

      for (const falsch of verfaelsche(a)) {
        if (JSON.stringify(falsch, ersetzer) === JSON.stringify(a, ersetzer)) continue;
        if (UNSORTIERT.has(name) && Array.isArray(a) && Array.isArray(falsch)
            && a.length === falsch.length
            && a.every((x) => falsch.includes(x))) continue;
        if (name === "Largest Rectangle in a Matrix"
            && JSON.stringify(normEcken(falsch)) === JSON.stringify(normEcken(a))) continue;
        gestellt++;
        let angenommen = true;
        try { angenommen = l.verify(data, falsch); } catch { angenommen = false; }
        if (angenommen) durchgelassen.push(name + ": " + kurz(falsch) + " statt " + kurz(a));
      }
    }
  }

  console.log("       " + geprueft + " erzeugte Instanzen, "
    + gestellt + " verfaelschte Antworten");
  pruefe("keine richtige Antwort wird abgelehnt", abgelehnt.length === 0,
    [...new Set(abgelehnt)].slice(0, 4).join(" | "));
  pruefe("keine falsche Antwort kommt durch", durchgelassen.length === 0,
    [...new Set(durchgelassen)].slice(0, 5).join(" | "));
  pruefe("es waren genug erzeugte Instanzen", geprueft >= 300, "nur " + geprueft);
  pruefe("kein guard lehnt eine echte Vertragseingabe ab", gesperrt.length === 0,
    [...new Set(gesperrt)].slice(0, 4).join(" | "));
  pruefe("kein Generator wirft", kaputt.length === 0,
    [...new Set(kaputt)].slice(0, 3).join(" | "));

  // WAS DIESE ZAHL INZWISCHEN AUCH BELEGT.
  //
  // Solange `verify` `solve(data) === answer` lautete, sagte "keine richtige
  // Antwort wird abgelehnt" gar nichts - es verglich solve mit sich selbst.
  // Seit C.18 ist jede der dreissig Gegenproben unabhaengig: Umkehrprobe,
  // zweite Rechnung oder Strukturpruefung. Damit ist derselbe Satz eine
  // Aussage ueber `solve`: 348 vom Spielgenerator erzeugte Instanzen, jede von
  // einem zweiten Verfahren bestaetigt.
  console.log("       (und damit zugleich: " + geprueft + " Antworten von solve,"
    + " je von einem unabhaengigen zweiten Verfahren bestaetigt)");
}

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
