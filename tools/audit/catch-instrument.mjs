// CATCH-INSTRUMENT (Audit 03.10.2026): macht verschluckte Fehler in einer KOPIE von src/ sichtbar.
//
// Zweck: Ein leerer catch kann alles verbergen - einen erwarteten Spielfehler ("braucht SF4") genauso
// wie einen TypeError im eigenen Code. Statisch laesst sich das nicht trennen. Dynamisch schon: laeuft
// eine Testsuite mit ns-Mock durch die Kopie, meldet der Haken bei jedem betretenen catch die
// Fehlerklasse und -meldung. Ein TypeError/ReferenceError/RangeError im eigenen Code ist ein Fund;
// "x is not a function" auf dem Mock ist eine Mock-Luecke (wird getrennt ausgewiesen).
//
// WICHTIG: bearbeitet NUR die Kopie. Niemals src/ des Projekts (die Bruecke schiebt src/ ins Spiel).
//
// Aufruf:  node tools/audit/catch-instrument.mjs <kopie-von-src>
//
// Haken: globalThis.__ct(datei, zeile) zaehlt den Eintritt in einen try-Block, globalThis.__cc(datei, zeile, fehler)
// den Eintritt in den catch. Beide kommen von tools/audit/catch-hook.mjs bereitgestellt
// (node --import <hook>), sonst passiert nichts (der Aufruf ist mit && abgesichert).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);

const ziel = path.resolve(process.argv[2] ?? "");
if (!ziel || path.resolve(ziel) === path.resolve(ROOT, "src") || !fs.existsSync(ziel)) {
  console.error("Aufruf: node catch-instrument.mjs <KOPIE von src> - nie das echte src/ des Projekts");
  process.exit(2);
}
if (!ziel.toLowerCase().includes("dynroot") && !process.env.CATCH_INSTRUMENT_OK) {
  console.error("Sicherung: der Zielpfad enthaelt nicht 'dynroot'. Mit CATCH_INSTRUMENT_OK=1 trotzdem.");
  process.exit(2);
}

function sammle(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sammle(p)); else if (e.name.endsWith(".js")) out.push(p);
  }
  return out;
}

let n = 0;
for (const datei of sammle(ziel)) {
  const rel = path.relative(ziel, datei).split(path.sep).join("/");
  let code = fs.readFileSync(datei, "utf8");
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true }); }
  catch { continue; }
  const stellen = [];     // {pos, text}
  const besuche = (node) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "TryStatement" && node.handler) {
      const h = node.handler;
      const zeile = node.loc.start.line;               // Schluessel = Zeile des `try` (wie im Inventar)
      // Eintrittszaehler am Anfang des try-Blocks
      stellen.push({ pos: node.block.start + 1, text: ' globalThis.__ct && globalThis.__ct("' + rel + '", ' + zeile + ");" });
      const bodyStart = h.body.start;                  // Position der "{"
      if (!h.param) {
        // catch { -> catch (__ce) {
        const kopf = code.slice(h.start, bodyStart);
        const pos = h.start + kopf.indexOf("catch") + 5;
        stellen.push({ pos, text: " (__ce)" });
        stellen.push({ pos: bodyStart + 1, text: ' globalThis.__cc && globalThis.__cc("' + rel + '", ' + zeile + ", __ce);" });
      } else if (h.param.type === "Identifier") {
        stellen.push({ pos: bodyStart + 1, text: ' globalThis.__cc && globalThis.__cc("' + rel + '", ' + zeile + ", " + h.param.name + ");" });
      }
      n++;
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") besuche(c); }
      else if (v && typeof v.type === "string") besuche(v);
    }
  };
  besuche(ast);
  stellen.sort((a, b) => b.pos - a.pos);
  for (const s of stellen) code = code.slice(0, s.pos) + s.text + code.slice(s.pos);
  fs.writeFileSync(datei, code);
}
console.log("catch-Klauseln instrumentiert: " + n + " in " + ziel);
