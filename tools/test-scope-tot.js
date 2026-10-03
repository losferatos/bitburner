/**
 * Ebene -1, zweite Stufe: kein Name in src/ steht ausserhalb seines Scopes.
 *
 * Gefunden am 03.10.2026 (Befund aus fe3b013): In src/blade.js riefen vier
 * Stellen ausserhalb von `waehle()` Funktionen auf, die nur INNERHALB von
 * `waehle()` als const existierten (`blackOpChance`, `blackOpSchwelle`,
 * `spanneGenau`). Jeder Aufruf warf einen ReferenceError, und jedes Mal
 * schluckte ein try/catch ihn still - der Gym-Ausstieg fuer Black Ops war
 * vom ersten Tag an (28.08.) tot, die D2-Sonden seit dem 27.09. Weder
 * `node --check` noch tools/syntax.js koennen das sehen: Ein unbekannter Name
 * ist syntaktisch einwandfrei, er koennte ja global sein.
 *
 * Diese Pruefung loest jeden Bezeichner durch seine Scope-Kette auf und
 * meldet ihn, wenn er unaufgeloest bleibt, aber IRGENDWO SONST in derselben
 * Datei deklariert ist - das Muster genau dieses Fehlers. Die Logik steht in
 * tools/lib/scope-tot.js.
 *
 * Damit der Ausschluss gilt ("kein Fund"), muss die Pruefung den Fall
 * ueberhaupt melden KOENNEN. Deshalb zuerst eine Selbstprobe: der Fehler von
 * heute als Kleinstbeispiel muss gefunden werden, die korrekten Varianten
 * (Hoisting, Schatten, Destrukturierung, Klassen, Marken) duerfen es nicht.
 *
 * Aufruf: node tools/test-scope-tot.js [--src <ordner>]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAcorn, findOutOfScope, scanDir } from "./lib/scope-tot.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const i = process.argv.indexOf("--src");
const SRC = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, "src");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(text, bedingung, zusatz = "") {
  if (bedingung) { gruen++; console.log("  ok    " + text + (zusatz ? "  (" + zusatz + ")" : "")); }
  else { rot++; fehler.push(text + (zusatz ? " - " + zusatz : "")); console.log("  ROT   " + text + (zusatz ? " - " + zusatz : "")); }
}

const ac = await loadAcorn();
if (!ac) {
  console.log("acorn nicht gefunden (reference/v301/node_modules/acorn) - ohne Referenzkopie laeuft diese Pruefung nicht.");
  process.exit(1);
}

console.log("");
console.log("=== Selbstprobe ===");
const namen = (code) => findOutOfScope(code, ac).map((f) => f.name + ":" + f.line);
{
  // Der Fehler vom 03.10. als Kleinstbeispiel: Gym-Zweig ruft eine
  // Funktion aus dem Rumpf von waehle().
  const code = [
    "export async function main(ns) {",
    "  const waehle = () => {",
    "    const blackOpChance = (n) => 0.9;",
    "    return blackOpChance('x');",
    "  };",
    "  try { if (blackOpChance('y') > 0.5) ns.print('raus'); } catch { /* still */ }",
    "}",
  ].join("\n");
  const f = namen(code);
  pruefe("Aufruf ausserhalb des Scopes wird gefunden (Zeile 6)", f.length === 1 && f[0] === "blackOpChance:6", f.join(", "));
}
{
  const code = [
    "export async function main(ns) {",
    "  const a = () => b();",              // spaeter deklariert, aber im selben Scope
    "  const b = () => 1;",
    "  function c() { return d; }",
    "  var d = 2;",
    "  const e = (x) => { const f = 1; return x + f; };",
    "  const g = ({ h, i: [j, ...k] = [] }, l = h) => h + j + l + k.length;",
    "  class K { m() { return K; } }",
    "  for (let n = 0; n < 2; n++) { const o = n; ns.print(o); }",
    "  try { a(); } catch (err) { ns.print(err); }",
    "  aussen: for (const p of [1]) { if (p) continue aussen; }",
    "  const q = { r: 1, s() { return 2; } }; ns.print(q.r, q.s(), c(), e(1), g({ h: 1 }), new K());",
    "  const t = function u() { return u; }; ns.print(t);",
    "}",
  ].join("\n");
  const f = namen(code);
  pruefe("korrekte Faelle (Hoisting, var, Muster, Klasse, for, catch, Marke, Eigenschaft) melden nichts",
    f.length === 0, f.join(", ") || "keine");
}
{
  // Ein Name, der innen deklariert ist, aber aussen als Eigenschaft oder
  // Schluessel vorkommt, ist kein Fehler.
  const code = "function f() { const x = 1; return x; }\nconst o = { x: 2 }; console.log(o.x);";
  const f = namen(code);
  pruefe("Eigenschaftsnamen gleichen Namens sind keine Referenz", f.length === 0, f.join(", ") || "keine");
}
{
  // Schatten in einer Schwesterfunktion: dort aufgeloest, also kein Fund -
  // in der anderen nicht aufgeloest, also Fund.
  const code = "function a() { const z = 1; return z; }\nfunction b() { return z; }";
  const f = namen(code);
  pruefe("Name aus der Schwesterfunktion wird gefunden", f.length === 1 && f[0] === "z:2", f.join(", "));
}

console.log("");
console.log("=== " + path.relative(ROOT, SRC).split(path.sep).join("/") + " ===");
const funde = scanDir(SRC, ac);
const parse = funde.filter((f) => f.name === "(parse)");
const echt = funde.filter((f) => f.name !== "(parse)");
pruefe("alle Dateien parsen", parse.length === 0, parse.map((f) => f.file + ":" + f.line).join(", "));
for (const f of echt) {
  console.log("  FUND  " + f.file + ":" + f.line + "  `" + f.name + "` ist hier nicht im Scope (deklariert in Zeile "
    + f.declaredAt.join(", ") + ")");
}
pruefe("kein Name ausserhalb seines Scopes", echt.length === 0, echt.length + " Funde");

console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");
if (rot) { console.log(""); for (const f of fehler) console.log("  ROT: " + f); }
console.log("");
process.exit(rot ? 1 : 0);
