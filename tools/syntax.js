/**
 * Ebene -1: parst jede Skriptdatei und meldet Syntaxfehler.
 *
 * ===========================================================================
 * WARUM DAS UEBERHAUPT NOETIG IST
 * ===========================================================================
 *
 * Bitburner uebersetzt ein Skript erst beim Start. Eine fehlende Klammer faellt
 * damit nicht beim Speichern auf, sondern im Spiel - und dort still: `ns.exec`
 * gibt 0 zurueck, `ns.getScriptRam` gibt 0, und der Starter im Kern meldet
 * "getScriptRam gibt 0, warte" und wartet weiter. Ein Tippfehler sieht also
 * aus wie Speichermangel.
 *
 * Am 04.09.2026 ist genau das zweimal an einem Nachmittag passiert: einmal
 * eine `if`-Klammer in `shop.js`, die beim Umbau eines `else if` zu `else {`
 * offen blieb, und einmal ein Regex, den ein Python-Heredoc zerlegt hatte.
 * Beides haette der Bot erst im Spiel gemerkt - im ersten Fall waere der
 * Rechnerkauf ausgefallen, im zweiten der ganze Generator.
 *
 * ===========================================================================
 * WAS ER NICHT PRUEFT
 * ===========================================================================
 *
 * Nur die Grammatik. Ob ein Import auflaesbar ist, ob eine Variable existiert,
 * ob die Reihenfolge stimmt - das findet der Ebene-2-Test mit dem ns-Mock,
 * nicht dieser hier. Er ist die billigste Stufe und soll das auch bleiben:
 * er laeuft in unter einer Sekunde ueber den ganzen Baum.
 *
 * Aufruf:
 *   node tools/syntax.js              alle Skripte in src/ (Worktree bevorzugt)
 *   node tools/syntax.js <datei> ...  nur die genannten
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

// acorn liegt in der Referenzkopie des Spiels - dieselbe Fassung, die
// Bitburner selbst zum Uebersetzen und RAM-Rechnen benutzt
// (RamCalculations.ts). Ein anderer Parser koennte etwas durchlassen, was das
// Spiel ablehnt, oder umgekehrt.
const ACORN = path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs");
if (!fs.existsSync(ACORN)) {
  console.log("acorn nicht gefunden: " + ACORN);
  console.log("Ohne die Referenzkopie des Spiels laeuft diese Pruefung nicht.");
  process.exit(1);
}
const acorn = await import(pathToFileURL(ACORN).href);

/** Der Worktree hat Vorrang: dort wird gebaut, dort muss geprueft werden. */
const WORKTREE = path.resolve(ROOT, "..", "bitburner-bau", "src");
const SRC = fs.existsSync(WORKTREE) ? WORKTREE : path.join(ROOT, "src");

function sammle(ordner) {
  const raus = [];
  for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) raus.push(...sammle(p));
    else if (e.name.endsWith(".js")) raus.push(p);
  }
  return raus;
}

const argumente = process.argv.slice(2);
const dateien = argumente.length
  ? argumente.map((a) => (path.isAbsolute(a) ? a : path.join(SRC, a)))
  : sammle(SRC).sort();

let rot = 0;
const fehler = [];

for (const datei of dateien) {
  const kurz = path.relative(SRC, datei).replace(/\\/g, "/");
  if (!fs.existsSync(datei)) {
    rot++; fehler.push(kurz + ": Datei fehlt");
    console.log("  ROT  " + kurz + " - Datei fehlt");
    continue;
  }
  try {
    acorn.parse(fs.readFileSync(datei, "utf8"), {
      ecmaVersion: 2023,
      sourceType: "module",
      allowAwaitOutsideFunction: true,
    });
  } catch (e) {
    rot++;
    // Die Zeilennummer ist der eigentliche Wert dieser Pruefung: acorn nennt
    // sie, das Spiel nicht.
    const wo = e.loc ? " (Zeile " + e.loc.line + ", Spalte " + e.loc.column + ")" : "";
    fehler.push(kurz + wo + ": " + e.message);
    console.log("  ROT  " + kurz + wo);
    console.log("       " + e.message);
  }
}

console.log("");
console.log("=== Syntax: " + (dateien.length - rot) + " von " + dateien.length
  + " gruen" + (rot ? ", " + rot + " ROT" : "") + " ===");
console.log("    " + SRC);
if (rot) {
  console.log("");
  for (const f of fehler) console.log("  ROT: " + f);
}
console.log("");
process.exit(rot ? 1 : 0);
