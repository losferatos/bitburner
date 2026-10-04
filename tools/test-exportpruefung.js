/**
 * Ebene 0: die Pruefung benannter Importe gegen die Exporte
 * (tools/lib/exportpruefung.js, benutzt von tools/importpruefung.js).
 *
 * WARUM (P2d, Skeptiker B2, 04.10.2026): src/bn4rep.js importiert vier neue Namen
 * aus lib/einbau.js. Mit der alten lib/einbau.js im Spiel starb bn4rep.js beim
 * Linken, und importpruefung.js sagte "ok", weil es nur die Dateien prueft.
 *
 * Geprueft wird:
 *   - die Zerlegung (Importe mit Kommentaren in der Klammer, `as`, Standard- und
 *     Namensraumimport; Exporte in allen im Projekt vorkommenden Formen, ein
 *     auskommentierter Export zaehlt nicht);
 *   - der Fall des Skeptikers: alte Zieldatei -> die vier Namen fehlen, neue -> keiner;
 *   - die GEGENPROBE an der Wirklichkeit: jeder benannte Import jeder Datei in
 *     src/, dessen Ziel in src/ liegt, ist dort exportiert. Ein Fehlalarm hier
 *     hiesse, dass die Pruefung eine gesunde Stufe blockiert - dann wird sie
 *     umgangen. Dazu ein Mutant: ein entfernter Export wird gefunden.
 *
 * Aufruf: node tools/test-exportpruefung.js
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseImports, parseExports, missingExports, normalizePath } from "./lib/exportpruefung.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HIER, "..", "src");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); return; }
  rot++;
  fehler.push(name + (hinweis ? " - " + hinweis : ""));
  console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
}
const J = (x) => JSON.stringify(x);

console.log("");
console.log("=== Benannte Importe gegen Exporte ===");

console.log("\n-- Importe zerlegen --");
{
  const src = [
    "/**",
    " * import { nichtGemeint } from \"kommentar.js\";",
    " */",
    "import { a, b as c } from \"lib/x.js\";",
    "import {",
    "  eins, zwei,",
    "  // P2d: ein Kommentar in der Klammer, mit Komma, und ein Wort wie import",
    "  drei,   /* noch einer */ vier,",
    "} from \"./lib/y.js\";",
    "import def, { n } from \"/lib/z.js\";",
    "import onlyDefault from \"lib/d.js\";",
    "import * as ns from \"lib/ns.js\";",
    "import \"lib/seiteneffekt.js\";",
    "// import { auskommentiert } from \"lib/aus.js\";",
    "const s = 'import { x } from \"nicht-am-anfang.js\"';",
  ].join("\n");
  const imps = parseImports(src);
  pruefe("vier Importe mit Namen oder Standard (kein Namensraum, kein reiner Seiteneffekt, kein Kommentar)",
    imps.length === 4, J(imps));
  pruefe("a, b as c -> importiert werden a und b (vor dem 'as')",
    J(imps[0]) === J({ from: "lib/x.js", names: ["a", "b"], defaultName: null }), J(imps[0]));
  pruefe("mehrzeilig mit Zeilen- und Blockkommentar in der Klammer: eins, zwei, drei, vier; './' faellt weg",
    J(imps[1]) === J({ from: "lib/y.js", names: ["eins", "zwei", "drei", "vier"], defaultName: null }), J(imps[1]));
  pruefe("Standard plus benannt: def und n; fuehrender '/' faellt weg",
    J(imps[2]) === J({ from: "lib/z.js", names: ["n"], defaultName: "def" }), J(imps[2]));
  pruefe("nur Standardimport", J(imps[3]) === J({ from: "lib/d.js", names: [], defaultName: "onlyDefault" }), J(imps[3]));
  pruefe("normalizePath wie importpruefung.js", normalizePath("./a.js") === "a.js" && normalizePath("/a.js") === "a.js" && normalizePath("lib/a.js") === "lib/a.js");
}

console.log("\n-- Exporte zerlegen --");
{
  const src = [
    "/**",
    " * export const imKopf = 1;",
    " */",
    "export const A = 1;",
    "export let B = 2;",
    "export function f() {}",
    "export async function g() {}",
    "export function* gen() {}",
    "  export class K {}",
    "export { h, i as j };",
    "export {",
    "  k, // Kommentar",
    "  l as m,",
    "};",
    "export { r as s } from \"lib/andere.js\";",
    "// export const auskommentiert = 1;",
    "const t = \"export const imText = 1;\";",
  ].join("\n");
  const ex = parseExports(src);
  const soll = ["A", "B", "f", "g", "gen", "K", "j", "m", "s", "h", "k"].sort();
  pruefe("alle Formen erkannt (const, let, function, async, function*, class, Liste mit as, mehrzeilig, Re-Export)",
    J([...ex.names].sort()) === J(soll), J([...ex.names].sort()));
  pruefe("Block-/Zeilenkommentar und Text zaehlen nicht; der 'as'-Quellname (i, l, r) ist nicht exportiert",
    !ex.names.has("imKopf") && !ex.names.has("auskommentiert") && !ex.names.has("imText")
    && !ex.names.has("i") && !ex.names.has("l") && !ex.names.has("r"));
  pruefe("kein Standardexport, nicht offen", ex.hasDefault === false && ex.open === false);
  pruefe("export default und export * werden erkannt",
    parseExports("export default function () {}").hasDefault === true && parseExports("export * from \"x.js\";").open === true);
}

console.log("\n-- missingExports: der Fall des Skeptikers --");
{
  const neu = [
    "import {",
    "  waehleTorRunde, gangBonusWait,",
    "  // P2d (04.10.2026): Rufbedarf der Gang fuer den Geldmodus von gang.js.",
    "  REP_NEED_BUDGET_FACTOR, repNeedKandidaten, gangRepNeed, gangFactionFromTelemetry,",
    "} from \"lib/einbau.js\";",
  ].join("\n");
  const alteLib = "export function waehleTorRunde() {}\nexport const gangBonusWait = 1;\n";
  const neueLib = alteLib + "export const REP_NEED_BUDGET_FACTOR = 4;\nexport function repNeedKandidaten() {}\n"
    + "export function gangRepNeed() {}\nexport function gangFactionFromTelemetry() {}\n";
  const alt = missingExports(neu, { "lib/einbau.js": alteLib });
  pruefe("alte lib/einbau.js: genau die vier neuen Namen fehlen",
    J(alt.map((x) => x.name)) === J(["REP_NEED_BUDGET_FACTOR", "repNeedKandidaten", "gangRepNeed", "gangFactionFromTelemetry"]), J(alt));
  pruefe("neue lib/einbau.js: nichts fehlt", missingExports(neu, { "lib/einbau.js": neueLib }).length === 0);
  pruefe("Map statt Objekt: dasselbe Ergebnis", missingExports(neu, new Map([["lib/einbau.js", alteLib]])).length === 4);
  pruefe("Ziel ohne Quelltext (unbekannt): nicht geprueft, nichts gemeldet", missingExports(neu, {}).length === 0 && missingExports(neu, null).length === 0);
  pruefe("Stern-Export im Ziel: nicht beurteilbar, nichts gemeldet", missingExports(neu, { "lib/einbau.js": "export * from \"lib/anders.js\";" }).length === 0);
  pruefe("Standardimport ohne Standardexport wird gemeldet",
    missingExports("import d from \"lib/q.js\";", { "lib/q.js": "export const x = 1;" }).length === 1
    && missingExports("import d from \"lib/q.js\";", { "lib/q.js": "export default 1;" }).length === 0);
  let wirft = "";
  for (const m of [null, undefined, 5, {}, "", "import {", "import { a } from", "export {"]) {
    try { missingExports(m, { x: m }); parseExports(m); parseImports(m); } catch (e) { wirft += String(e && e.message ? e.message : e) + "; "; }
  }
  pruefe("Muell als Quelltext: keine Ausnahme", wirft === "", wirft);
}

console.log("\n-- die Gegenprobe an src/ --");
{
  const dateien = [];
  const lauf = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) lauf(p);
      else if (e.name.endsWith(".js")) dateien.push(p);
    }
  };
  lauf(SRC);
  let importe = 0;
  let namen = 0;
  const luecken = [];
  const quellen = new Map();
  for (const f of dateien) quellen.set(path.relative(SRC, f).split(path.sep).join("/"), fs.readFileSync(f, "utf8"));
  for (const [rel, text] of quellen) {
    const imps = parseImports(text);
    importe += imps.length;
    for (const i of imps) namen += i.names.length;
    for (const l of missingExports(text, quellen)) luecken.push(rel + " <- " + l.from + ": " + l.why);
  }
  pruefe("src/ hat " + dateien.length + " Dateien, " + importe + " benannte Importe, " + namen + " Namen (die Probe ist nicht leer)",
    dateien.length > 100 && importe >= 59 && namen >= 150, dateien.length + "/" + importe + "/" + namen);
  pruefe("kein benannter Import in src/ fehlt in seiner Zieldatei (kein Fehlalarm der Pruefung)", luecken.length === 0, luecken.slice(0, 5).join(" | "));

  // Mutant: einer der echten Exporte, die bn4rep.js braucht, wird entfernt.
  const einbau = quellen.get("lib/einbau.js");
  const bn4rep = quellen.get("bn4rep.js");
  pruefe("lib/einbau.js und bn4rep.js sind in src/ vorhanden", typeof einbau === "string" && typeof bn4rep === "string");
  if (einbau && bn4rep) {
    const ohne = einbau.replace(/^export function gangRepNeed\b/m, "function gangRepNeed");
    pruefe("Mutant: 'export' von gangRepNeed entfernt -> bn4rep.js meldet genau diesen Namen",
      ohne !== einbau && J(missingExports(bn4rep, { "lib/einbau.js": ohne }).map((x) => x.name)) === J(["gangRepNeed"]),
      J(missingExports(bn4rep, { "lib/einbau.js": ohne })));
    const ohne2 = einbau.replace(/^export const REP_NEED_BUDGET_FACTOR\b/m, "const REP_NEED_BUDGET_FACTOR");
    pruefe("Mutant: 'export' von REP_NEED_BUDGET_FACTOR entfernt -> gemeldet",
      ohne2 !== einbau && missingExports(bn4rep, { "lib/einbau.js": ohne2 }).some((x) => x.name === "REP_NEED_BUDGET_FACTOR"));
  }
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
