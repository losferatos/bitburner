/**
 * Ebene 0: kein Skript ausser exit.js darf w0r1d_d43m0n beenden (26.09.2026).
 *
 * installBackdoor auf w0r1d_d43m0n schickt das Spiel auf die BitVerse-Auswahl
 * (Singularity.ts:525-526); dort laeuft nichts mehr, und nach der Auswahl von
 * Hand startet boot.js nicht. BN5.2 endete so, weil bn4door.js ihn in seiner
 * Zielliste hatte. Geprueft wird: jede Datei, die installBackdoor ruft, nennt
 * w0r1d_d43m0n nicht (ausser in Kommentaren).
 *
 * Aufruf: node tools/test-kein-wd-backdoor.js [verzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src");

function dateien(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...dateien(p));
    else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

// Kommentare entfernen, damit die Begruendung im Code nicht anschlaegt.
const ohneKommentare = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

let rot = 0;
// backdoor.js nimmt beliebige Ziele per Handauftrag an: es muss w0r1d_d43m0n
// ausdruecklich ablehnen (Skeptiker 26.09.2026).
const bd = path.join(SRC, "backdoor.js");
if (fs.existsSync(bd) && !/ziel === "w0r1d_d43m0n"\) return/.test(fs.readFileSync(bd, "utf8"))) {
  rot++;
  console.log("  ROT   backdoor.js lehnt w0r1d_d43m0n nicht ab");
}
for (const f of dateien(SRC)) {
  if (path.basename(f) === "exit.js") continue;
  const code = ohneKommentare(fs.readFileSync(f, "utf8"));
  if (code.includes("installBackdoor") && code.includes("w0r1d_d43m0n")) {
    rot++;
    console.log("  ROT   " + path.relative(ROOT, f) + " ruft installBackdoor und nennt w0r1d_d43m0n");
  }
}
if (!rot) console.log("  ok    kein Backdoor-Skript zielt auf w0r1d_d43m0n");
console.log("\n=== " + (rot ? 0 : 1) + " gruen, " + rot + " rot ===\n");
process.exit(rot ? 1 : 0);
