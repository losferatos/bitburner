/**
 * NOT_EXECUTABLE-Frist in ausgang.js (Uhren-Audit 08.10.2026). Befund: die
 * Startzeit kam aus data/ausgang.json, die jede Runde VOR der Pruefung ohne
 * das Feld neu geschrieben wurde - die 1-h-Frist begann jede Runde von vorn,
 * der Befund in events.json war toter Code. Gegen den alten Stand ROT.
 * Aufruf: node tools/test-notexec-frist.js [repo]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gruen = 0, rot = 0;
const pruefe = (name, ok) => { if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name); } };
console.log("\n=== NOT_EXECUTABLE-Frist ===\n");
const src = fs.readFileSync(path.join(ROOT, "src", "ausgang.js"), "utf8").replace(/\r/g, "");
const schleife = src.indexOf("while (true) {");
const decl = src.indexOf("let notExecSince = null;");
pruefe("Fristbeginn lebt ausserhalb der Runde", decl > 0 && decl < schleife);
pruefe("die Rundenpruefung liest die Frist nicht mehr aus der eben ueberschriebenen Datei", !src.includes("alt3.notExecutableSeit"));
// Der Rundenbericht (der mit exit_abgelehnt) muss das Feld mitschreiben, sonst
// verliert ein Neustart die Frist.
const bStart = src.indexOf("exit_abgelehnt: exitAbgelehnt,", schleife);
const ersterBericht = bStart > 0 ? [src.slice(bStart, src.indexOf("}));", bStart))] : null;
pruefe("Rundenbericht schreibt notExecutableSeit mit", !!ersterBericht && ersterBericht[0].includes("notExecutableSeit: notExecSince"));
pruefe("Frist wird gesetzt, nicht jede Runde neu begonnen", src.includes("if (notExecSince === null) notExecSince = Date.now();"));
pruefe("Frist endet, sobald exit.js passt", /continue;\n\s*\}\n\s*notExecSince = null;/.test(src));
const guard = fs.readFileSync(path.join(ROOT, "src", "guard.js"), "utf8").replace(/\r/g, "");
pruefe("guard.js glaubt nur einem frischen NOT_EXECUTABLE (Stummschaltung der Leiter)",
  /nichtAusfuehrbar: !!\(ausgangLage && ausgangLage\.notExecutable\s*&& Number\.isFinite\(ausgangLage\.zeit\) && Date\.now\(\) - ausgangLage\.zeit < 600000\)/.test(guard));
console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
