// SCOPE-ALLE (Audit 03.10.2026, Robustheitspruefung "Scope").
//
// Ausgangslage: tools/lib/scope-tot.js findet Namen, die im Aufruf-Scope fehlen
// und nur woanders in DERSELBEN Datei stehen. Das hat die vier toten Black-Op-
// Aufrufe in blade.js gefunden. Dieses Werkzeug weitet die Frage auf alles aus,
// was ein Aufruf still totmachen kann:
//
//   1. TSC      Kopie von src/ wird mit dem TypeScript-Pruefer gegen die ECHTEN Definitionen 3.0.2
//               geprueft (NetscriptDefinitions.d.ts): unbekannte Namen (2304), fehlende Exporte/Module
//               (2305/2307/2614/2724), ns-Funktionen, die es nicht gibt (2339/2551 auf NS und allen
//               Unter-Namensraeumen), falsche Argumentzahl (2554/2555), Nutzung vor Deklaration (2448/2454).
//   2. SCOPE    dieselbe Pruefung wie tools/test-scope-tot.js, ueber alle Dateien.
//   3. TDZ      Aufruf VOR der Initialisierung: eine Funktion wird in Anweisung i aufgerufen und liest
//               eine let/const/class, die erst in Anweisung j >= i initialisiert wird (Totzone ueber
//               Funktionsgrenzen, die tsc nicht verfolgt).
//   4. VERWEISE Skriptnamen in Zeichenketten, die es in src/ nicht gibt.
//   5. ENUM     Zeichenketten, die einem Spiel-Enum-Wert bis auf Schreibweise/einen Buchstaben gleichen
//               (der Spiel-Abgleich ist exakt - ein Fast-Treffer wirft).
//   6. TABELLEN Namenslisten (Staedte, Faktionen, Faehigkeiten ...), die zu >= 60 % aus Mitgliedern
//               eines Enums bestehen: der Rest wird gemeldet.
//   7. ENUMARG  Literalnamen aus Tabellen, die an enum-typisierte ns-Parameter gehen (tsc im
//               Literal-Modus: jedes Array-/Objektliteral der Kopie wird als `const` gelesen).
//   8. FLIEGEND Promises ohne await; verworfene boolean-Ergebnisse von ns-Aufrufen.
//   9. KILLFALLE Schleifen, deren einziger await in einem still schluckenden try steht
//               (nach ns.kill wirft jeder ns-Aufruf, der catch schluckt es: Endlosschleife).
//  10. HOSTSCOPE ns.read auf Dateien, die ein anderer Rechner schreibt, ohne scp von home.
//  11. TOTCODE  nie benutzte Deklarationen, unerreichbarer Code, verworfene Ergebnisse reiner Methoden.
//  12. LESEFELDER Felder, die ein Leser aus JSON.parse(<data/-Datei>) holt und die kein Schreiber setzt.
//  13. CATCH    Inventar aller try/catch mit Klassifikation (LEER, DEFAULT, LOG, SPEICHERT, RETHROW).
//
// Jede Pruefung hat eine SELBSTPROBE: ein eingebauter Fehler muss gefunden
// werden, sonst gilt "kein Fund" nicht (globale CLAUDE.md, Negativbefunde).
//
// Aufruf:  node tools/audit/scope-alle.mjs [--teil tsc,scope,tdz,verweise,enum,tabellen,enumarg,fliegend,killfalle,
//                                           hostscope,totcode,lesefelder,catch] [--json <datei>] [--ausfuehrlich] [--gate]
//          --gate: Exit 1, wenn ein Fund ausserhalb der ERLAUBT-Liste steht (Name, Import, ns-API, Scope, TDZ, Killfalle, Promise).
// src/ wird nur GELESEN. Die tsc-Kopie liegt in os.tmpdir() (oder SCOPE_TSC_DIR).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
// --src <ordner>: einen anderen Baum pruefen (Eichung gegen einen frueheren Stand, z. B. git show <commit>:src/blade.js)
const SRC = process.argv.includes("--src") ? path.resolve(process.argv[process.argv.indexOf("--src") + 1]) : path.join(ROOT, "src");
const require = createRequire(import.meta.url);
const V301 = path.join(ROOT, "reference", "v301", "node_modules");
const ts = require(path.join(V301, "typescript"));
const acorn = await import(pathToFileURL(path.join(V301, "acorn", "dist", "acorn.mjs")).href);
const { findOutOfScope } = await import(pathToFileURL(path.join(ROOT, "tools", "lib", "scope-tot.js")).href);

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const TEILE = new Set((opt("--teil") ?? "tsc,scope,tdz,verweise,enum,tabellen,enumarg,fliegend,killfalle,hostscope,totcode,lesefelder,catch").split(","));
const AUSFUEHRLICH = argv.includes("--ausfuehrlich");
const WORK_BASIS = process.env.SCOPE_TSC_DIR || path.join(os.tmpdir(), "bb-scope-tsc");
let WORK = WORK_BASIS;

const ergebnis = { selbstprobe: [], tsc: [], scope: [], tdz: [], verweise: [], enum: [], enumarg: [], catch: [] };
const probe = (name, ok, detail = "") => {
  ergebnis.selbstprobe.push({ name, ok, detail });
  console.log((ok ? "  ok    " : "  ROT   ") + name + (detail ? "  (" + detail + ")" : ""));
};

// ---------------------------------------------------------------------------
// Dateien
// ---------------------------------------------------------------------------
function sammle(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...sammle(dir, r));
    else out.push(r);
  }
  return out;
}
const alleDateien = sammle(SRC);
const jsDateien = alleDateien.filter((f) => f.endsWith(".js"));
const quellen = new Map(jsDateien.map((f) => [f, fs.readFileSync(path.join(SRC, f), "utf8")]));

const parseOpt = { ecmaVersion: "latest", sourceType: "module", locations: true };

// ===========================================================================
// 1. TSC
// ===========================================================================
function nsEinfuegepunkte(code) {
  const ast = acorn.parse(code, parseOpt);
  const punkte = new Set();
  const hatNs = (fn) => fn.params.some((p) => (p.type === "Identifier" && p.name === "ns")
    || (p.type === "AssignmentPattern" && p.left.type === "Identifier" && p.left.name === "ns"));
  const walk = (node, stmt) => {
    if (!node || typeof node.type !== "string") return;
    let s = stmt;
    if (/Statement$|Declaration$/.test(node.type) && node.type !== "VariableDeclarator") s = node;
    if (node.type === "Property" || node.type === "MethodDefinition" || node.type === "PropertyDefinition") s = node;
    const fn = node.type === "FunctionDeclaration" || node.type === "FunctionExpression"
      || node.type === "ArrowFunctionExpression";
    if (fn && hatNs(node)) {
      const ziel = node.type === "FunctionDeclaration"
        ? (stmt && /^Export/.test(stmt.type) ? stmt : node) : (s ?? node);
      punkte.add(ziel.start);
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") walk(c, s); }
      else if (v && typeof v.type === "string") walk(v, s);
    }
  };
  walk(ast, null);
  return [...punkte].sort((a, b) => b - a);
}

// Selbstprobe-Datei: jeder Fehler steht in einer bekannten Zeile.
const PROBE_DATEI = "zz_selbstprobe.js";
const PROBE_CODE = [
  /* 1 */ 'import { gibtEsNicht } from "lib/route.js";',
  /* 2 */ 'import nix from "lib/gibtsnicht.js";',
  /* 3 */ "export async function main(ns) {",
  /* 4 */ "  const waehle = () => { const innen = () => 1; return innen(); };",
  /* 5 */ "  try { innen(); } catch { /* still */ }",
  /* 6 */ '  ns.purchaseServer("x", 8);',
  /* 7 */ "  ns.singularity.gibtEsNicht();",
  /* 8 */ "  ns.scp(\"a.js\");",
  /* 9 */ "  const bb = ns.bladeburner; bb.nixda();",
  /* 10 */ "  const { gibtEs } = ns.singularity;",
  /* 11 */ '  ns.bladeburner.startAction("Black Operation", "x");',
  /* 12 */ "  ns.getPlayer(1);",
  /* 13 */ "  const spaeter = () => zuSpaet; const zuSpaet = 1; return [waehle, nix, gibtEsNicht, gibtEs, spaeter];",
  /* 14 */ '  const TAB = ["Reaper", "Nonsense Skill"]; for (const n of TAB) ns.bladeburner.getSkillLevel(n);',
  /* 15 */ "  ns.sleep(10);",
  /* 16 */ "}",
].join("\n");
const PROBE_ERWARTET = [
  [1, 2305], [2, 2307], [5, 2304], [6, 2339], [7, 2339], [8, 2554], [9, 2339], [10, 2339], [11, 2345], [12, 2554],
];

// Literal-Modus: jedes aeusserste Array-/Objektliteral wird in der Kopie als `const` gelesen,
// damit Zeichenketten aus Tabellen als Literaltypen beim ns-Aufruf ankommen und tsc
// FALSCHE NAMEN (nicht nur "irgendein string") melden kann.
function konstBereiche(code) {
  const ast = acorn.parse(code, parseOpt);
  const bereiche = [];
  const walk = (node, eltern, key) => {
    if (!node || typeof node.type !== "string") return;
    if ((node.type === "ArrayExpression" || node.type === "ObjectExpression")
      && !(eltern?.type === "SpreadElement")) {
      bereiche.push([node.start, node.end]);
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") walk(c, node, k); }
      else if (v && typeof v.type === "string") walk(v, node, k);
    }
  };
  walk(ast, null, null);
  return bereiche;
}

function laufeTsc(literal = false) {
  const WORK = literal ? WORK_BASIS + "-lit" : WORK_BASIS;
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  const roots = [];
  const schreibe = (rel, code) => {
    const ziel = path.join(WORK, rel);
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    const tiefe = rel.split("/").length - 1;
    const bis = tiefe === 0 ? "." : Array(tiefe).fill("..").join("/");
    const eins = nsEinfuegepunkte(code).map((p) => [p, 1, '/** @param {import("' + bis + '/NetscriptDefinitions").NS} ns */ ']);
    if (literal) for (const [a, e] of konstBereiche(code)) { eins.push([a, 0, "/** @type {const} */ ("]); eins.push([e, 2, ")"]); }
    // von hinten nach vorn einsetzen, damit die Positionen vorn stimmen
    eins.sort((x, y) => y[0] - x[0] || y[1] - x[1]);
    for (const [p, , text] of eins) code = code.slice(0, p) + text + code.slice(p);
    fs.writeFileSync(ziel, code);
    roots.push(ziel);
  };
  for (const rel of alleDateien) {
    if (rel.endsWith(".js")) schreibe(rel, quellen.get(rel));
    else {
      const ziel = path.join(WORK, rel);
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.copyFileSync(path.join(SRC, rel), ziel);
    }
  }
  schreibe(PROBE_DATEI, PROBE_CODE);
  const glob = path.join(WORK, "_globals.d.ts");
  fs.writeFileSync(glob, [
    'type NS = import("./NetscriptDefinitions").NS;',
    'type NetscriptPort = import("./NetscriptDefinitions").NetscriptPort;',
    'type Server = import("./NetscriptDefinitions").Server;',
  ].join(String.fromCharCode(10)) + String.fromCharCode(10));
  roots.push(glob);
  const optionen = {
    allowJs: true, checkJs: true, noEmit: true, strict: false, noImplicitAny: false,
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: WORK, resolveJsonModule: true, skipLibCheck: true,
    lib: ["lib.esnext.d.ts", "lib.dom.d.ts"], types: [],
  };
  const programm = ts.createProgram({ rootNames: roots, options: optionen });
  const diag = ts.getPreEmitDiagnostics(programm);
  const liste = [];
  for (const d of diag) {
    if (!d.file) continue;
    const rel = path.relative(WORK, d.file.fileName).split(path.sep).join("/");
    if (rel.endsWith(".d.ts")) continue;
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    liste.push({ file: rel, line: line + 1, col: character + 1, code: d.code,
      msg: ts.flattenDiagnosticMessageText(d.messageText, "\n").split("\n")[0] });
  }
  return { programm, liste };
}

// ===========================================================================
// 2./3. SCOPE + TDZ (acorn)
// ===========================================================================
function patternNames(p, out = []) {
  if (!p) return out;
  switch (p.type) {
    case "Identifier": out.push(p.name); break;
    case "ObjectPattern": for (const pr of p.properties) patternNames(pr.type === "RestElement" ? pr.argument : pr.value, out); break;
    case "ArrayPattern": for (const el of p.elements) patternNames(el, out); break;
    case "RestElement": patternNames(p.argument, out); break;
    case "AssignmentPattern": patternNames(p.left, out); break;
    default: break;
  }
  return out;
}
const isFn = (n) => n && (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression");

// Alle untergeordneten Knoten (ohne loc) durchlaufen; `besuche(knoten, eltern, schluessel)`
// liefert false, wenn der Teilbaum uebersprungen werden soll.
function geheDurch(node, besuche, eltern = null, key = null) {
  if (!node || typeof node.type !== "string") return;
  if (besuche(node, eltern, key) === false) return;
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end") continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") geheDurch(c, besuche, node, k); }
    else if (v && typeof v.type === "string") geheDurch(v, besuche, node, k);
  }
}

const EAGER_METHODEN = new Set(["map", "filter", "forEach", "some", "every", "find", "findIndex", "reduce",
  "sort", "flatMap", "findLast", "reduceRight"]);

// Freie Bezeichner im AUSGEFUEHRTEN Teil einer Funktion: Verschachtelte Funktionen zaehlen nur,
// wenn sie als Rueckruf direkt an eine Array-Methode gehen (laufen sofort) oder als IIFE.
function freieNamenEager(fn) {
  const refs = [];
  const aufrufe = [];
  const lokal = new Set(fn.params.flatMap((p) => patternNames(p)));
  // Lokale Deklarationen (grob: alle in der Funktion, ausser in verschachtelten Funktionen) maskieren Namen.
  geheDurch(fn.body, (n, eltern) => {
    if (n !== fn.body && isFn(n)) {
      if (n.type === "FunctionDeclaration" && n.id) lokal.add(n.id.name);
      const rueckruf = eltern && eltern.type === "CallExpression" && eltern.arguments.includes(n)
        && eltern.callee.type === "MemberExpression" && EAGER_METHODEN.has(eltern.callee.property.name);
      const iife = eltern && eltern.type === "CallExpression" && eltern.callee === n;
      if (!rueckruf && !iife) return false;
      for (const p of n.params) patternNames(p).forEach((x) => lokal.add(x));
      return true;
    }
    if (n.type === "VariableDeclarator") patternNames(n.id).forEach((x) => lokal.add(x));
    if (n.type === "ClassDeclaration" && n.id) lokal.add(n.id.name);
    if (n.type === "CatchClause" && n.param) patternNames(n.param).forEach((x) => lokal.add(x));
    return true;
  });
  geheDurch(fn.body, (n, eltern, key) => {
    if (n !== fn.body && isFn(n)) {
      const rueckruf = eltern && eltern.type === "CallExpression" && eltern.arguments.includes(n)
        && eltern.callee.type === "MemberExpression" && EAGER_METHODEN.has(eltern.callee.property.name);
      const iife = eltern && eltern.type === "CallExpression" && eltern.callee === n;
      return rueckruf || iife;
    }
    if (n.type === "Identifier") {
      const keineRef = (eltern?.type === "MemberExpression" && key === "property" && !eltern.computed)
        || ((eltern?.type === "Property" || eltern?.type === "MethodDefinition" || eltern?.type === "PropertyDefinition")
          && key === "key" && !eltern.computed)
        || (eltern?.type === "VariableDeclarator" && key === "id")
        || (eltern?.type === "LabeledStatement" || eltern?.type === "BreakStatement" || eltern?.type === "ContinueStatement");
      if (!keineRef && !lokal.has(n.name)) refs.push({ name: n.name, line: n.loc.start.line });
    }
    if (n.type === "CallExpression" && n.callee.type === "Identifier") aufrufe.push(n.callee.name);
    return true;
  });
  return { refs, aufrufe, lokal };
}

// TDZ-Pruefung je Anweisungsliste (Programm oder Funktionsrumpf).
function findeTdz(code) {
  const ast = acorn.parse(code, parseOpt);
  const funde = [];
  const pruefeListe = (stmts) => {
    const unwrap = (s) => (s.type === "ExportNamedDeclaration" && s.declaration ? s.declaration : s);
    const decl = new Map();      // Name -> {index, art, line}
    const fns = new Map();       // Name -> {node, availableFrom}
    stmts.forEach((s0, i) => {
      const s = unwrap(s0);
      if (s.type === "VariableDeclaration") {
        for (const d of s.declarations) {
          for (const n of patternNames(d.id)) {
            if (s.kind !== "var") decl.set(n, { index: i, art: s.kind, line: d.loc.start.line });
            if (d.init && isFn(d.init) && d.id.type === "Identifier") fns.set(n, { node: d.init, from: i });
          }
        }
      } else if (s.type === "ClassDeclaration" && s.id) decl.set(s.id.name, { index: i, art: "class", line: s.loc.start.line });
      else if (s.type === "FunctionDeclaration" && s.id) fns.set(s.id.name, { node: s, from: -1 });
    });
    if (!decl.size) return;
    // Wirkung einer Funktion: Namen, die sie (eager, transitiv) liest.
    const cache = new Map();
    const liest = (name, tief = 0, besucht = new Set()) => {
      if (besucht.has(name) || tief > 8) return new Map();
      besucht.add(name);
      const f = fns.get(name);
      if (!f) return new Map();
      if (!cache.has(f.node)) cache.set(f.node, freieNamenEager(f.node));
      const { refs, aufrufe } = cache.get(f.node);
      const out = new Map();
      for (const r of refs) if (!out.has(r.name)) out.set(r.name, { via: [name], line: r.line });
      for (const a of aufrufe) {
        if (a === name) continue;
        for (const [n, w] of liest(a, tief + 1, besucht)) if (!out.has(n)) out.set(n, { via: [name, ...w.via], line: w.line });
      }
      return out;
    };
    stmts.forEach((s0, i) => {
      const s = unwrap(s0);
      if (isFn(s)) return;                           // Deklaration allein ruft nichts auf
      // Namen, die INNERHALB dieser Anweisung neu deklariert werden, beschatten die aeusseren.
      const innen = new Set();
      geheDurch(s, (x) => {
        if (x.type === "VariableDeclarator") patternNames(x.id).forEach((nm) => innen.add(nm));
        if (isFn(x)) { x.params.forEach((q) => patternNames(q).forEach((nm) => innen.add(nm))); if (x.id) innen.add(x.id.name); }
        if (x.type === "CatchClause" && x.param) patternNames(x.param).forEach((nm) => innen.add(nm));
        if (x.type === "ClassDeclaration" && x.id) innen.add(x.id.name);
        return true;
      });
      const aufrufe = [];
      geheDurch(s, (n, eltern) => {
        if (n !== s && isFn(n)) {
          const rueckruf = eltern && eltern.type === "CallExpression" && eltern.arguments.includes(n)
            && eltern.callee.type === "MemberExpression" && EAGER_METHODEN.has(eltern.callee.property.name);
          const iife = eltern && eltern.type === "CallExpression" && eltern.callee === n;
          if (!rueckruf && !iife) return false;
          if (rueckruf || iife) {
            const fe = freieNamenEager(n);
            for (const r of fe.refs) {
              const dd = decl.get(r.name);
              if (dd && dd.index >= i && !innen.has(r.name)) {
                funde.push({ name: r.name, kind: "Rueckruf", line: r.line, declLine: dd.line, aufrufLine: n.loc.start.line, via: [] });
              }
            }
            for (const a of fe.aufrufe) aufrufe.push({ name: a, line: n.loc.start.line });
          }
          return false;
        }
        if (n.type === "CallExpression" && n.callee.type === "Identifier") aufrufe.push({ name: n.callee.name, line: n.loc.start.line });
        return true;
      });
      for (const a of aufrufe) {
        const f = fns.get(a.name);
        if (!f || f.from >= i || innen.has(a.name)) continue;             // const-Funktion noch nicht initialisiert: das meldet tsc (2448)
        for (const [n, w] of liest(a.name)) {
          const dd = decl.get(n);
          if (dd && dd.index >= i) {
            funde.push({ name: n, kind: "Aufruf", line: w.line, declLine: dd.line, aufrufLine: a.line, via: w.via });
          }
        }
      }
    });
  };
  geheDurch(ast, (n) => {
    if (n.type === "Program") pruefeListe(n.body);
    else if (isFn(n) && n.body && n.body.type === "BlockStatement") pruefeListe(n.body.body);
    else if (n.type === "BlockStatement") pruefeListe(n.body);
    return true;
  });
  // Doppelte (gleiche Zeilen) entfernen.
  const seen = new Set();
  return funde.filter((f) => { const k = f.name + "|" + f.line + "|" + f.aufrufLine; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ===========================================================================
// 5. ENUM-Beinahe-Treffer
// ===========================================================================
function enumUniversum(programm) {
  const ch = programm.getTypeChecker();
  const sf = programm.getSourceFiles().find((f) => f.fileName.endsWith("/NetscriptDefinitions.d.ts") || f.fileName.endsWith("\\NetscriptDefinitions.d.ts"));
  const out = {};
  ts.forEachChild(sf, (n) => {
    if (ts.isTypeAliasDeclaration(n)) {
      const t = ch.getTypeAtLocation(n.name);
      const alts = t.isUnion() ? t.types : [t];
      if (alts.length >= 2 && alts.every((x) => x.isStringLiteral())) out[n.name.text] = alts.map((x) => x.value);
    }
  });
  return out;
}
const norm = (s) => s.toLowerCase().replace(/[ -]+/g, "");
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return m[a.length][b.length];
}

// ===========================================================================
// 6. CATCH-Inventar
// ===========================================================================
const LOG_NAME = /(^|\.)(print|tprint|tprintf|printf|log|warn|error|info|debug|sag|say|melde|meldung|ereignis\w*|protokolliere|logge|toast|alert|schreibeLog|anhaengen|haengeAnHome|nachHome|write|appendFile)$/i;

function calleeText(c) {
  if (!c) return "";
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression") {
    const p = c.computed ? "[]" : c.property.name;
    return calleeText(c.object) + "." + p;
  }
  if (c.type === "ThisExpression") return "this";
  if (c.type === "CallExpression") return calleeText(c.callee) + "()";
  return "?";
}

function catchInventar(datei, code) {
  const kommentare = [];
  const ast = acorn.parse(code, { ...parseOpt, onComment: kommentare });
  // ns-Aliase: const X = ns.a.b ;  const {..} = ns.a
  const alias = new Map();
  geheDurch(ast, (n) => {
    if (n.type === "VariableDeclarator" && n.init && n.id.type === "Identifier") {
      const t = calleeText(n.init);
      if (/^ns(\.[A-Za-z]+)*$/.test(t) && t !== "ns") alias.set(n.id.name, t);
    }
    return true;
  });
  const nsPfad = (t) => {
    const teile = t.split(".");
    if (teile[0] === "ns") return t;
    if (alias.has(teile[0])) return [alias.get(teile[0]), ...teile.slice(1)].join(".");
    return null;
  };
  const out = [];
  geheDurch(ast, (n, eltern) => {
    if (n.type !== "TryStatement" || !n.handler) return true;
    const h = n.handler;
    const hb = h.body.body;
    const param = h.param ? patternNames(h.param)[0] : null;
    // Handler auswerten
    let refsErr = false; let wirft = false; const hCalls = [];
    geheDurch(h.body, (x, el, key) => {
      if (x.type === "ThrowStatement") wirft = true;
      if (param && x.type === "Identifier" && x.name === param
        && !(el?.type === "MemberExpression" && key === "property" && !el.computed)) refsErr = true;
      if (x.type === "CallExpression") hCalls.push({ t: calleeText(x.callee), argErr: param ? x.arguments.some((a) => {
        let hit = false; geheDurch(a, (y) => { if (y.type === "Identifier" && y.name === param) hit = true; return !hit; }); return hit; }) : false });
      return true;
    });
    const loggt = hCalls.some((c) => LOG_NAME.test(c.t));
    const kommTexte = kommentare.filter((c) => c.start >= h.body.start && c.end <= h.body.end).map((c) => c.value.trim().replace(/\s+/g, " "));
    let klasse;
    if (wirft) klasse = "RETHROW";
    else if (hb.length === 0) klasse = "LEER";
    else if (loggt) klasse = "LOG";
    else if (refsErr) klasse = "SPEICHERT";           // Fehlerwert wird weiterverwendet (Feld, Rueckgabe, Text)
    else klasse = "DEFAULT";
    const verschluckt = klasse === "LEER" || klasse === "DEFAULT";
    // Rumpf auswerten
    const nsCalls = new Set(); const idCalls = new Set(); const sonst = new Set(); let awaits = 0; let jsonParse = false;
    let dom = false; let stmts = 0; let propReads = 0; let ifs = 0; let loops = 0;
    geheDurch(n.block, (x) => {
      if (isFn(x)) return false;                       // verschachtelte Funktionen laufen hier nicht
      if (/Statement$|Declaration$/.test(x.type) && x.type !== "BlockStatement") stmts++;
      if (x.type === "IfStatement") ifs++;
      if (/^(For|While|DoWhile)/.test(x.type)) loops++;
      if (x.type === "AwaitExpression") awaits++;
      if (x.type === "MemberExpression") propReads++;
      if (x.type === "CallExpression") {
        const t = calleeText(x.callee);
        if (t === "JSON.parse") jsonParse = true;
        if (/\b(document|doc|querySelector|querySelectorAll|getElementById|dispatchEvent|click)\b/.test(t)) dom = true;
        const p = nsPfad(t);
        if (p) nsCalls.add(p.replace(/^ns\./, ""));
        else if (x.callee.type === "Identifier") idCalls.add(t);
        else sonst.add(t);
      }
      return true;
    });
    out.push({
      file: datei, line: n.loc.start.line, endLine: n.block.loc.end.line, handlerLine: h.loc.start.line,
      handlerEnd: h.body.loc.end.line,
      param: param ?? "-", klasse, verschluckt, wirft,
      stmts, awaits, jsonParse, dom, ifs, loops, propReads,
      ns: [...nsCalls].sort(), ids: [...idCalls].sort(), sonst: [...sonst].sort(),
      kommentar: kommTexte.join(" | ").slice(0, 220),
      hStmts: hb.length,
      hText: code.slice(h.body.start, h.body.end).replace(/\s+/g, " ").slice(0, 140),
      hatFinally: !!n.finalizer,
    });
    return true;
  });
  return out;
}

// ===========================================================================
// Lauf
// ===========================================================================
console.log("");
console.log("=== SCOPE-ALLE  " + new Date().toISOString().slice(0, 19) + "  src: " + jsDateien.length + " Dateien, "
  + [...quellen.values()].reduce((s, t) => s + t.split("\n").length, 0) + " Zeilen ===");

let tsRes = null;
if (TEILE.has("tsc") || TEILE.has("enum") || TEILE.has("fliegend")) {
  tsRes = laufeTsc();
}

// ---- 1. TSC -------------------------------------------------------------
if (TEILE.has("tsc")) {
  console.log("\n=== 1. TSC gegen NetscriptDefinitions 3.0.2 ===");
  const pf = tsRes.liste.filter((d) => d.file === PROBE_DATEI);
  for (const [zeile, code] of PROBE_ERWARTET) {
    const treffer = pf.find((d) => d.line === zeile && d.code === code);
    probe("tsc findet Probe Zeile " + zeile + " (TS" + code + ")", !!treffer, treffer ? treffer.msg.slice(0, 70) : "NICHT GEFUNDEN");
  }
  const echt = tsRes.liste.filter((d) => d.file !== PROBE_DATEI);
  // Klassifizieren
  const NS_TYP = /type '(NS|Singularity|Hacknet|Bladeburner|Sleeve|Gang|Corporation|Stanek|Go|Cloud|Format|Formulas|Grafting|CodingContract|Stock|UserInterface|Darknet|Infiltration|Formulas)\b/;
  for (const d of echt) {
    let kat = null;
    if (d.code === 2304) kat = "NAME";
    else if ([2305, 2307, 2614, 2724, 2459, 2306].includes(d.code)) kat = "IMPORT";
    else if ([2339, 2551].includes(d.code) && NS_TYP.test(d.msg)) kat = "NS-API";
    else if ([2554, 2555].includes(d.code)) kat = "ARITAET";
    else if ([2448, 2454, 2449].includes(d.code)) kat = "TDZ";
    else if (d.code === 2349) kat = "NICHT-AUFRUFBAR";
    if (kat) ergebnis.tsc.push({ ...d, kat });
  }
  const proKat = {};
  for (const d of ergebnis.tsc) proKat[d.kat] = (proKat[d.kat] ?? 0) + 1;
  console.log("  Diagnosen gesamt (ohne Probe): " + echt.length + "; davon laufzeitrelevant: " + ergebnis.tsc.length
    + " " + JSON.stringify(proKat));
  for (const d of ergebnis.tsc) console.log("  " + d.kat.padEnd(14) + d.file + ":" + d.line + "  TS" + d.code + "  " + d.msg.slice(0, 120));
  // Abdeckung: ns-Zugriffe, die tsc nicht als NS sieht
  const ch = tsRes.programm.getTypeChecker();
  let ok = 0; const blind = [];
  for (const sf of tsRes.programm.getSourceFiles()) {
    const fn = sf.fileName.split(path.sep).join("/");
    if (!fn.startsWith(WORK.split(path.sep).join("/")) || fn.endsWith(".d.ts")) continue;
    const rel = path.relative(WORK, sf.fileName).split(path.sep).join("/");
    if (rel === PROBE_DATEI) continue;
    const besuche = (n) => {
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "ns") {
        const t = ch.typeToString(ch.getTypeAtLocation(n.expression));
        if (t === "NS") ok++; else blind.push(rel + ":" + (sf.getLineAndCharacterOfPosition(n.getStart()).line + 1));
      }
      ts.forEachChild(n, besuche);
    };
    besuche(sf);
  }
  probe("Abdeckung: jeder `ns.`-Zugriff hat den Typ NS", blind.length === 0, ok + " Zugriffe, blind: " + blind.length + (blind.length ? " " + blind.slice(0, 5).join(" ") : ""));
}

// ---- 2. SCOPE -----------------------------------------------------------
if (TEILE.has("scope")) {
  console.log("\n=== 2. SCOPE (tools/lib/scope-tot.js ueber alle Dateien) ===");
  const kleinst = [
    "export async function main(ns) {",
    "  const waehle = () => { const blackOpChance = (n) => 0.9; return blackOpChance('x'); };",
    "  try { if (blackOpChance('y') > 0.5) ns.print('raus'); } catch { /* still */ }",
    "}",
  ].join("\n");
  probe("scope-tot findet Name aus Schwesterscope", findOutOfScope(kleinst, acorn).length === 1);
  for (const [f, code] of quellen) {
    try { for (const x of findOutOfScope(code, acorn)) ergebnis.scope.push({ file: f, ...x }); }
    catch (e) { ergebnis.scope.push({ file: f, name: "(parse)", line: 0, error: String(e.message) }); }
  }
  console.log("  Funde: " + ergebnis.scope.length);
  for (const x of ergebnis.scope) console.log("  " + x.file + ":" + x.line + "  " + x.name + (x.declaredAt ? "  deklariert in Zeile " + x.declaredAt.join(",") : ""));
}

// ---- 3. TDZ -------------------------------------------------------------
if (TEILE.has("tdz")) {
  console.log("\n=== 3. TDZ: Aufruf vor Initialisierung ===");
  const bug = [
    "export async function main(ns) {",        // 1
    "  const a = () => lesen();",              // 2
    "  function lesen() { return spaeter + 1; }", // 3
    "  try { a(); } catch { /* still */ }",    // 4
    "  const spaeter = 5;",                    // 5
    "  const gut = 1; function ok() { return gut; } ok();", // 6
    "}",
  ].join("\n");
  const pf = findeTdz(bug);
  probe("TDZ-Pruefung findet Aufruf vor const (spaeter, Zeile 3)", pf.length === 1 && pf[0].name === "spaeter", JSON.stringify(pf.map((x) => x.name + ":" + x.line)));
  for (const [f, code] of quellen) {
    try { for (const x of findeTdz(code)) ergebnis.tdz.push({ file: f, ...x }); }
    catch (e) { ergebnis.tdz.push({ file: f, name: "(parse)", line: 0, error: String(e.message) }); }
  }
  console.log("  Funde: " + ergebnis.tdz.length);
  for (const x of ergebnis.tdz) console.log("  " + x.file + ":" + x.line + "  " + x.name + " (" + x.kind + " Zeile " + x.aufrufLine + ", deklariert " + x.declLine + ", via " + x.via.join(">") + ")");
}

// ---- 4. VERWEISE --------------------------------------------------------
if (TEILE.has("verweise")) {
  console.log("\n=== 4. VERWEISE: Skriptnamen, die es in src/ nicht gibt ===");
  const vorhanden = new Set(alleDateien);
  const kandidat = /^\/?([A-Za-z0-9_\-./]+\.js)$/;
  const probeCode = 'export async function main(ns) { ns.run("gibtsnicht.js"); }';
  const pn = [];
  geheDurch(acorn.parse(probeCode, parseOpt), (n) => { if (n.type === "Literal" && typeof n.value === "string" && kandidat.test(n.value) && !vorhanden.has(n.value.replace(/^\//, ""))) pn.push(n.value); return true; });
  probe("Verweis-Pruefung findet fehlende Skriptdatei", pn.length === 1);
  for (const [f, code] of quellen) {
    const ast = acorn.parse(code, parseOpt);
    geheDurch(ast, (n, eltern) => {
      const wert = n.type === "Literal" && typeof n.value === "string" ? n.value
        : n.type === "TemplateElement" ? n.value.cooked : null;
      if (wert === null) return true;
      const m = kandidat.exec(wert);
      if (!m) return true;
      const name = m[1];
      // nur einzelne Dateinamen / lib/-Pfade, keine Prosa
      if (name.includes(" ")) return true;
      if (!vorhanden.has(name)) ergebnis.verweise.push({ file: f, line: n.loc.start.line, name, kontext: eltern ? calleeText(eltern.callee ?? eltern) : "" });
      return true;
    });
  }
  console.log("  Funde: " + ergebnis.verweise.length);
  for (const x of ergebnis.verweise) console.log("  " + x.file + ":" + x.line + "  " + x.name + "  [" + x.kontext + "]");
}

// ---- 5. ENUM ------------------------------------------------------------
if (TEILE.has("enum")) {
  console.log("\n=== 5. ENUM: Zeichenketten, die einem Spiel-Enum-Wert fast gleichen ===");
  const uni = enumUniversum(tsRes.programm);
  const alleWerte = new Map();                       // exakt -> [enum...]
  const normMap = new Map();                         // norm -> Set(exakter Wert)
  for (const [name, werte] of Object.entries(uni)) for (const v of werte) {
    if (!alleWerte.has(v)) alleWerte.set(v, []);
    alleWerte.get(v).push(name);
    if (!normMap.has(norm(v))) normMap.set(norm(v), new Set());
    normMap.get(norm(v)).add(v);
  }
  console.log("  Enum-Universum: " + Object.keys(uni).length + " Typen, " + alleWerte.size + " Werte");
  const nm = (s) => {
    if (s.length < 4 || alleWerte.has(s)) return null;
    const n = norm(s);
    if (normMap.has(n) && !normMap.get(n).has(s)) return { art: "Schreibweise", soll: [...normMap.get(n)][0] };
    if (s.length >= 7) for (const [v] of alleWerte) if (v.length >= 7 && lev(s, v) === 1) return { art: "ein Buchstabe", soll: v };
    return null;
  };
  probe("Enum-Pruefung findet 'black operations' statt 'Black Operations'", nm("black operations")?.soll === "Black Operations", JSON.stringify(nm("black operations")));
  for (const [f, code] of quellen) {
    const ast = acorn.parse(code, parseOpt);
    geheDurch(ast, (n) => {
      if (n.type === "Literal" && typeof n.value === "string" && n.value.length <= 60) {
        const r = nm(n.value);
        if (r) ergebnis.enum.push({ file: f, line: n.loc.start.line, wert: n.value, ...r });
      }
      return true;
    });
  }
  console.log("  Funde: " + ergebnis.enum.length);
  for (const x of ergebnis.enum) console.log("  " + x.file + ":" + x.line + "  \"" + x.wert + "\"  ~  \"" + x.soll + "\"  (" + x.art + ")");
}

// ---- 6. TABELLEN: Listen/Schluesselmengen, die fast nur Enum-Mitglieder enthalten ----
// Ein Tippfehler in einer Namensliste faellt nirgends auf: Der Spiel-Abgleich wirft erst beim
// Aufruf, und der steht meist in einem try/catch. Eine Liste, die zu >= 60 % aus Mitgliedern
// EINES Enums besteht, soll vollstaendig aus Mitgliedern bestehen; der Rest wird gemeldet.
if (TEILE.has("tabellen")) {
  console.log("\n=== 6. TABELLEN: Namenslisten mit Fremdkoerpern ===");
  const lit0 = tsRes ?? laufeTsc();
  const uni = enumUniversum(lit0.programm);
  const stringsOf = (node) => {
    const out = [];
    if (node.type === "ArrayExpression") {
      for (const e of node.elements) {
        if (e && e.type === "Literal" && typeof e.value === "string") out.push([e.value, e.loc.start.line]);
        else if (e && e.type === "ArrayExpression" && e.elements[0]?.type === "Literal" && typeof e.elements[0].value === "string") out.push([e.elements[0].value, e.loc.start.line]);
      }
    } else if (node.type === "ObjectExpression") {
      for (const p of node.properties) {
        if (p.type !== "Property") continue;
        if (!p.computed && p.key.type === "Literal" && typeof p.key.value === "string") out.push([p.key.value, p.loc.start.line]);
        else if (!p.computed && p.key.type === "Identifier" && /^[A-Z]/.test(p.key.name)) out.push([p.key.name, p.loc.start.line]);
      }
    }
    return out;
  };
  const pruefe = (name, code) => {
    const funde = [];
    geheDurch(acorn.parse(code, parseOpt), (n) => {
      if (n.type !== "ArrayExpression" && n.type !== "ObjectExpression") return true;
      const liste = stringsOf(n);
      if (liste.length < 3) return true;
      let beste = null;
      for (const [en, werte] of Object.entries(uni)) {
        const treffer = liste.filter(([w]) => werte.includes(w)).length;
        if (!beste || treffer > beste.treffer) beste = { en, treffer };
      }
      if (beste && beste.treffer / liste.length >= 0.6 && beste.treffer < liste.length) {
        const fremd = liste.filter(([w]) => !uni[beste.en].includes(w));
        funde.push({ line: n.loc.start.line, enum: beste.en, von: liste.length, fremd: fremd.map(([w, l]) => w + "@" + l) });
      }
      return true;
    });
    return funde;
  };
  const tp = pruefe("probe", 'const A = ["Sector-12", "Aevum", "Volhaven", "Chongqing", "New Tokyo", "Ischima"];');
  probe("TABELLEN findet 'Ischima' in Staedteliste", tp.length === 1 && tp[0].fremd[0].startsWith("Ischima"), JSON.stringify(tp));
  ergebnis.tabellen = [];
  for (const [f, code] of quellen) for (const x of pruefe(f, code)) ergebnis.tabellen.push({ file: f, ...x });
  console.log("  Funde: " + ergebnis.tabellen.length);
  for (const x of ergebnis.tabellen) console.log("  " + x.file + ":" + x.line + "  " + x.enum + " (" + x.von + " Eintraege)  fremd: " + x.fremd.join(", "));
}

// ---- 7. ENUMARG: falsche Namen in Tabellen, die an enum-typisierte Parameter gehen -----
if (TEILE.has("enumarg")) {
  console.log("\n=== 7. ENUMARG: Literalnamen aus Tabellen gegen die Parametertypen ===");
  const lit = laufeTsc(true);
  const uni = enumUniversum(lit.programm);
  const haeuf = /Argument of type '(.+)' is not assignable to parameter of type '([A-Za-z]+)'/;
  const holeLiterale = (t) => [...t.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  let probeGefunden = false; let ausgewertet = 0;
  for (const d of lit.liste) {
    if (d.code !== 2345) continue;
    const m = haeuf.exec(d.msg);
    if (!m) continue;
    const werte = holeLiterale(m[1]);
    const soll = uni[m[2]];
    if (!werte.length || !soll) continue;
    ausgewertet++;
    const schlecht = werte.filter((w) => !soll.includes(w));
    if (d.file === PROBE_DATEI) { if (d.line === 14 && schlecht.join() === "Nonsense Skill") probeGefunden = true; continue; }
    if (schlecht.length) ergebnis.enumarg.push({ file: d.file, line: d.line, param: m[2], schlecht, alle: werte.length });
  }
  probe("ENUMARG findet 'Nonsense Skill' in Tabelle (Zeile 14)", probeGefunden);
  console.log("  Aufrufe mit Literaltypen ausgewertet: " + ausgewertet + "; Funde: " + ergebnis.enumarg.length);
  for (const x of ergebnis.enumarg) console.log("  " + x.file + ":" + x.line + "  " + x.param + "  falsch: " + x.schlecht.map((w) => JSON.stringify(w)).join(", ") + "  (von " + x.alle + ")");
  // Nicht ausgewertet: Argumente vom Typ `string`/any bleiben ungeprueft; Zahl melden.
  const roh = lit.liste.filter((d) => d.code === 2345 && /Argument of type 'string'/.test(d.msg) && d.file !== PROBE_DATEI).length;
  console.log("  Aufrufe, deren Argument weiter nur `string` ist (nicht pruefbar): " + roh);
  ergebnis.enumargBlind = roh;
}

// ---- 8. FLIEGEND: nicht erwartete Promises und ignorierte Erfolgswerte von ns-Aufrufen ----
// (a) Ein async-Aufruf ohne await/return/void/catch laeuft ungesteuert weiter: Fehler gehen in eine
//     "unhandled rejection", die Reihenfolge stimmt nicht, `ns.sleep` ohne await wird zur Busy-Schleife.
// (b) Ein ns-Aufruf, der boolean liefert (gekauft? gestartet? beigetreten?), dessen Ergebnis als
//     Anweisung verworfen wird, kann scheitern, OHNE zu werfen - dann merkt auch kein catch etwas.
if (TEILE.has("fliegend")) {
  console.log("\n=== 8. FLIEGEND: Promises ohne await, verworfene Erfolgswerte ===");
  const prog = tsRes.programm; const ch = prog.getTypeChecker();
  const istPromise = (t) => { const s = t.getSymbol?.() ?? t.symbol; return !!s && s.getName() === "Promise"; };
  const calleePfad = (e) => {
    // ns.a.b.c(...) -> "a.b.c"; sonst null
    const teile = []; let x = e;
    while (ts.isPropertyAccessExpression(x)) { teile.unshift(x.name.text); x = x.expression; }
    return ts.isIdentifier(x) && x.text === "ns" ? teile.join(".") : null;
  };
  // Selbstprobe in der Probe-Datei steht nicht - eigene Mini-Programme nur fuer die Probe.
  ergebnis.fliegend = []; ergebnis.verworfen = [];
  for (const sf of prog.getSourceFiles()) {
    const fn = sf.fileName.split(path.sep).join("/");
    if (!fn.startsWith(WORK.split(path.sep).join("/")) || fn.endsWith(".d.ts")) continue;
    const rel = path.relative(WORK, sf.fileName).split(path.sep).join("/");
    const besuche = (n) => {
      if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)) {
        const call = n.expression;
        const t = ch.getTypeAtLocation(call);
        const zeile = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        const text = n.getText().replace(/\s+/g, " ").slice(0, 90);
        if (istPromise(t)) ergebnis.fliegend.push({ file: rel, line: zeile, text, probe: rel === PROBE_DATEI });
        else {
          const p = calleePfad(call.expression);
          if (rel !== PROBE_DATEI && p && (t.flags & ts.TypeFlags.Boolean || (t.isUnion && t.isUnion() && t.types.some((u) => u.flags & ts.TypeFlags.BooleanLiteral))
            || t.flags & ts.TypeFlags.BooleanLiteral)) ergebnis.verworfen.push({ file: rel, line: zeile, api: p, text });
        }
      }
      ts.forEachChild(n, besuche);
    };
    besuche(sf);
  }
  const pf = ergebnis.fliegend.filter((x) => x.probe);
  probe("FLIEGEND findet Promise ohne await in der Probe", pf.length >= 1, JSON.stringify(pf.map((x) => x.line)));
  ergebnis.fliegend = ergebnis.fliegend.filter((x) => !x.probe);
  console.log("  Promises ohne await: " + ergebnis.fliegend.length);
  for (const x of ergebnis.fliegend) console.log("  " + x.file + ":" + x.line + "  " + x.text);
  const proApi = {};
  for (const x of ergebnis.verworfen) proApi[x.api] = (proApi[x.api] ?? 0) + 1;
  console.log("  Verworfene boolean-Ergebnisse von ns-Aufrufen: " + ergebnis.verworfen.length + "  " + JSON.stringify(proApi));
  if (AUSFUEHRLICH) for (const x of ergebnis.verworfen) console.log("  " + x.file + ":" + x.line + "  " + x.api + "  " + x.text);
}

// ---- 10. HOSTSCOPE: ns.read/fileExists auf einer Datei, die ein ANDERER Rechner schreibt ----
// `ns.read` hat keinen Host-Parameter: es liest IMMER vom Rechner des laufenden Skripts
// (NetscriptFunctions.ts:1120-1122, siehe auch lib/endspurt.js:78-90). Zehn Registry-Eintraege laufen auf
// der Werkbank, vier auf "any". Liest eines davon eine Datei, die ein Skript auf home schrieb, ohne sie vorher
// per ns.scp(datei, ns.getHostname(), "home") zu holen, bekommt es "" - ohne Wurf, ohne Log.
// Geprueft wird je ns.read-Stelle mit Literalpfad: holt dieselbe Funktion die Datei von home, oder schreibt
// die Datei dasselbe Skript selbst (eigene Telemetrie)?
if (TEILE.has("hostscope")) {
  console.log("\n=== 10. HOSTSCOPE: ns.read auf Dateien anderer Rechner ohne scp von home ===");
  const regEintraege = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8")).eintraege;
  const hostRegel = new Map(regEintraege.map((e) => [e.name, e.hostRule]));
  ergebnis.hostscope = [];
  const analysiere = (name, code) => {
    const ast = acorn.parse(code, parseOpt);
    const konst = new Map();
    geheDurch(ast, (n) => { if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init && n.init.type === "Literal" && typeof n.init.value === "string") konst.set(n.id.name, n.init.value); return true; });
    const lit = (a) => (a && a.type === "Literal" && typeof a.value === "string") ? a.value : (a && a.type === "Identifier" && konst.has(a.name)) ? konst.get(a.name) : null;
    // Schreibt die Datei selbst? (ns.write / nachHome / haengeAnHome mit demselben Pfad)
    const schreibt = new Set();
    geheDurch(ast, (n) => {
      if (n.type === "CallExpression") {
        const t = calleeText(n.callee).split(".").pop();
        if (/(write|nachhome|anhome|appendFile)/i.test(t)) for (const a of n.arguments) { const l = lit(a); if (l) schreibt.add(l); }
      }
      return true;
    });
    const funde = [];
    const besuche = (fn, kopf) => {
      // Aufrufe direkt in dieser Funktion (ohne verschachtelte Funktionen, die zaehlt eigene Pruefung) + deren Kinder
      const reads = []; let holtVonHome = false;
      geheDurch(fn, (n) => {
        if (n !== fn && isFn(n)) return false;
        if (n.type === "CallExpression") {
          const t = calleeText(n.callee);
          if (t === "ns.scp" && n.arguments[2] && lit(n.arguments[2]) === "home") holtVonHome = true;
          if (t === "ns.scp" && n.arguments.length === 2 && lit(n.arguments[1]) && false) holtVonHome = true;
          if (/^(liesVonHome|holeVonHome|lesenVonHome)$/.test(t)) holtVonHome = true;
          if (t === "ns.read" || (t === "ns.fileExists" && !(n.arguments[1] && lit(n.arguments[1]) === "home"))) reads.push({ line: n.loc.start.line, pfad: lit(n.arguments[0]), art: t.slice(3), roh: n.arguments[0] ? code.slice(n.arguments[0].start, n.arguments[0].end).slice(0, 40) : "" });
        }
        return true;
      });
      for (const r of reads) funde.push({ datei: name, line: r.line, pfad: r.pfad, art: r.art, roh: r.roh, holt: holtVonHome, schreibtSelbst: r.pfad ? schreibt.has(r.pfad) : false, funktion: kopf });
    };
    // Programm + jede Funktion einzeln
    besuche(ast, "(Modul)");
    geheDurch(ast, (n) => { if (isFn(n)) besuche(n, n.id ? n.id.name : "(anonym)" + n.loc.start.line); return true; });
    return funde;
  };
  const probeF = analysiere("probe.js", 'export async function main(ns) { const j = ns.read("data/fremd.json"); const s = ns.read("data/eigen.json"); ns.write("data/eigen.json", "x", "w"); }');
  probe("HOSTSCOPE meldet fremde Datei ohne scp, nicht die eigene", probeF.filter((f) => f.funktion === "main").length === 2
    && probeF.filter((f) => f.funktion === "main" && !f.holt && !f.schreibtSelbst).length === 1, JSON.stringify(probeF.filter((f) => f.funktion === "main").map((f) => [f.pfad, f.holt, f.schreibtSelbst])));
  for (const [f, code] of quellen) {
    let r; try { r = analysiere(f, code); } catch { continue; }
    // doppelte Zaehlung (Modul-Ebene sieht auch alles unterhalb): nur die engste Funktion behalten
    const sehen = new Map();
    for (const x of r) { const k = x.line + "|" + x.pfad; if (!sehen.has(k) || x.funktion !== "(Modul)") sehen.set(k, x); }
    for (const x of sehen.values()) ergebnis.hostscope.push({ ...x, regel: hostRegel.get(f) ?? (f.startsWith("lib/") ? "lib" : "nicht in Registry") });
  }
  const verdaechtig = ergebnis.hostscope.filter((x) => !x.holt && !x.schreibtSelbst && x.regel !== "home");
  console.log("  ns.read/fileExists-Stellen gesamt: " + ergebnis.hostscope.length + "; ohne Holen von home und ohne eigenes Schreiben, in Skripten ausserhalb von home: " + verdaechtig.length);
  for (const x of verdaechtig) console.log("  " + x.datei + ":" + x.line + "  [" + x.regel + "] " + x.art + "(" + (x.pfad ?? x.roh) + ") in " + x.funktion);
}

// ---- 9. KILLFALLE: Schleifen, deren einziger await in einem still schluckenden try steht ----
// Wird ein Skript beendet (ns.kill, Prestige), wirft JEDER weitere ns-Aufruf sofort (checkEnvFlags,
// NetscriptHelpers.tsx:451-454, "Failed to run due to script being killed"). Steht der await einer
// Schleife (meist ns.sleep) allein in einem try mit stillem catch, schluckt der catch genau diese
// Ausnahme, die Schleife dreht weiter und jeder Durchlauf ist eine sofort abgelehnte Zusage:
// eine Endlosschleife ohne Pause im Browser-Thread, die Spiel und Skript einfriert.
if (TEILE.has("killfalle")) {
  console.log("\n=== 9. KILLFALLE: Schleife ohne await ausserhalb eines still schluckenden try ===");
  ergebnis.killfalle = [];
  const PURE_ID = new Set(["Number", "String", "Boolean", "parseInt", "parseFloat", "isFinite", "isNaN", "Array", "Object", "BigInt", "Symbol"]);
  const pruefeSchleifen = (name, code) => {
    const ast = acorn.parse(code, parseOpt);
    const funde = [];
    geheDurch(ast, (n) => {
      if (!/^(While|DoWhile|For)Statement$/.test(n.type) && n.type !== "ForOfStatement" && n.type !== "ForInStatement") return true;
      // Alle await-Ausdruecke des Schleifenrumpfs (ohne verschachtelte Funktionen) samt der try-Bloecke, in denen sie stehen.
      const awaits = []; let aussen = 0;
      const lauf = (x, tryStack) => {
        if (!x || typeof x.type !== "string") return;
        if (isFn(x)) return;
        if (x.type === "AwaitExpression") { awaits.push({ node: x, stack: tryStack.slice() }); }
        if (x.type === "CallExpression" && !tryStack.some((v) => v === true)) {
          const t = calleeText(x.callee);
          if (/^ns(\.|$)/.test(t) || (x.callee.type === "Identifier" && !PURE_ID.has(t))) aussen++;
        }
        if (x.type === "ForOfStatement" && x.await) awaits.push({ node: x, stack: tryStack.slice() });
        if (x.type === "TryStatement") {
          const h = x.handler;
          let still = false;
          if (h) {
            let bricht = false;
            geheDurch(h.body, (y) => { if (y.type === "ThrowStatement" || y.type === "ReturnStatement" || y.type === "BreakStatement") bricht = true; return !isFn(y); });
            // Der Handler gilt als still, wenn er nicht abbricht UND keinen await enthaelt
            // (ein await im Handler ist selbst ein Ausstiegspunkt, der erneut wirft).
            let hatAwait = false; let hatAufruf = false;
            geheDurch(h.body, (y) => {
              if (y.type === "AwaitExpression") hatAwait = true;
              if (y.type === "CallExpression") {
                const t = calleeText(y.callee);
                if (/^ns(\.|$)/.test(t) || (y.callee.type === "Identifier" && !PURE_ID.has(t))) hatAufruf = true;
              }
              return !isFn(y);
            });
            // Ein ns-Aufruf (auch ueber eine Hilfsfunktion wie sag()) im Handler wirft nach dem Kill erneut
            // und beendet die Schleife - dann ist der catch nicht "still" im Sinn der Falle.
            still = !bricht && !hatAwait && !hatAufruf;
          }
          lauf(x.block, [...tryStack, still]);
          if (x.handler) lauf(x.handler.body, tryStack);
          if (x.finalizer) lauf(x.finalizer, tryStack);
          return;
        }
        for (const k of Object.keys(x)) {
          if (k === "loc" || k === "start" || k === "end") continue;
          const v = x[k];
          if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") lauf(c, tryStack); }
          else if (v && typeof v.type === "string") lauf(v, tryStack);
        }
      };
      lauf(n.body, []);
      if (awaits.length && aussen === 0 && awaits.every((a) => a.stack.some((s) => s === true))) {
        funde.push({ datei: name, line: n.loc.start.line, awaits: awaits.length });
      }
      return true;
    });
    return funde;
  };
  const probeCode = "export async function main(ns) { while (true) { try { await ns.sleep(10); work(); } catch { } } }";
  probe("KILLFALLE findet Schleife mit await nur im still schluckenden try", pruefeSchleifen("probe.js", probeCode).length === 1);
  probe("KILLFALLE ignoriert Schleife mit await ausserhalb des try",
    pruefeSchleifen("probe.js", "export async function main(ns) { while (true) { try { work(); } catch { } await ns.sleep(10); } }").length === 0);
  for (const [f, code] of quellen) { try { ergebnis.killfalle.push(...pruefeSchleifen(f, code)); } catch { /* egal */ } }
  console.log("  Funde: " + ergebnis.killfalle.length);
  for (const x of ergebnis.killfalle) console.log("  " + x.datei + ":" + x.line + "  Schleife, " + x.awaits + " await nur in still schluckendem try");
}

// ---- 11. TOTCODE: nie benutzte Deklarationen und unerreichbare Anweisungen ----
if (TEILE.has("totcode")) {
  console.log("\n=== 11. TOTCODE: Deklarationen ohne Verwendung, Code nach return/throw ===");
  ergebnis.totcode = []; ergebnis.unerreichbar = []; ergebnis.verworfeneReine = [];
  // Importe aus anderen Dateien (src + tools + sync) zaehlen als Verwendung eines Exports.
  const importiert = new Set();
  const alleCodes = [...quellen.entries()].map(([f, c]) => ["src/" + f, c]);
  for (const verz of ["tools", "sync"]) {
    const rek = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "einmal") rek(p); } else if (/\.(m?js)$/.test(e.name)) alleCodes.push([path.relative(ROOT, p), fs.readFileSync(p, "utf8")]); } };
    rek(path.join(ROOT, verz));
  }
  for (const [, code] of alleCodes) {
    let ast; try { ast = acorn.parse(code, parseOpt); } catch { continue; }
    const nsNamen = new Set();
    geheDurch(ast, (n) => {
      if (n.type === "ImportDeclaration") for (const sp of n.specifiers) {
        if (sp.type === "ImportSpecifier") importiert.add(sp.imported.name);
        else if (sp.type === "ImportNamespaceSpecifier") nsNamen.add(sp.local.name);
      }
      return true;
    });
    if (nsNamen.size) geheDurch(ast, (n) => {
      if (n.type === "MemberExpression" && n.object.type === "Identifier" && nsNamen.has(n.object.name)) {
        if (!n.computed && n.property.type === "Identifier") importiert.add(n.property.name);
        else if (n.computed && n.property.type === "Literal") importiert.add(String(n.property.value));
      }
      return true;
    });
  }
  const pruefeDatei = (name, code) => {
    const ast = acorn.parse(code, parseOpt);
    const decl = new Map();                      // Name -> {line, exportiert, art}
    const refs = new Map();
    const zaehle = (nm) => refs.set(nm, (refs.get(nm) ?? 0) + 1);
    geheDurch(ast, (n, eltern, key) => {
      if (n.type === "FunctionDeclaration" && n.id) decl.set(n.id.name + "@" + n.id.start, { name: n.id.name, line: n.loc.start.line, art: "Funktion", exp: eltern?.type === "ExportNamedDeclaration" || eltern?.type === "ExportDefaultDeclaration" });
      if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && !(n.id.name.startsWith("_"))) {
        decl.set(n.id.name + "@" + n.id.start, { name: n.id.name, line: n.loc.start.line, art: n.init && isFn(n.init) ? "Funktion" : "Konstante", exp: eltern?.type === "VariableDeclaration" && false });
      }
      if (n.type === "Identifier") {
        const keineRef = (eltern?.type === "MemberExpression" && key === "property" && !eltern.computed)
          || ((eltern?.type === "Property" || eltern?.type === "MethodDefinition" || eltern?.type === "PropertyDefinition") && key === "key" && !eltern.computed && !eltern.shorthand)
          || (eltern?.type === "VariableDeclarator" && key === "id") || (eltern?.type === "FunctionDeclaration" && key === "id")
          || (isFn(eltern) && key === "params") || eltern?.type === "ImportSpecifier" || eltern?.type === "LabeledStatement"
          || eltern?.type === "BreakStatement" || eltern?.type === "ContinueStatement";
        if (!keineRef) zaehle(n.name);
      }
      return true;
    });
    // Exporte erkennen
    const exportiert = new Set();
    geheDurch(ast, (n) => {
      if (n.type === "ExportNamedDeclaration") {
        if (n.declaration?.type === "FunctionDeclaration") exportiert.add(n.declaration.id.name);
        if (n.declaration?.type === "VariableDeclaration") for (const d of n.declaration.declarations) patternNames(d.id).forEach((x) => exportiert.add(x));
        for (const sp of n.specifiers ?? []) exportiert.add(sp.local.name);
      }
      return true;
    });
    const funde = [];
    for (const d of decl.values()) {
      if ((refs.get(d.name) ?? 0) > 0) continue;
      if (exportiert.has(d.name)) {
        if (importiert.has(d.name) || name.endsWith("main")) continue;
        if (d.name === "main") continue;
        funde.push({ ...d, datei: name, export: true });
      } else funde.push({ ...d, datei: name, export: false });
    }
    // unerreichbarer Code
    const un = [];
    geheDurch(ast, (n) => {
      const liste = n.type === "BlockStatement" || n.type === "Program" ? n.body : n.type === "SwitchCase" ? n.consequent : null;
      if (liste) for (let i = 0; i < liste.length - 1; i++) {
        const t = liste[i].type;
        if (t === "ReturnStatement" || t === "ThrowStatement" || t === "BreakStatement" || t === "ContinueStatement") {
          const rest = liste.slice(i + 1).filter((x) => x.type !== "FunctionDeclaration" && !(x.type === "VariableDeclaration" && x.kind === "var" && x.declarations.every((d) => !d.init)));
          if (rest.length) un.push({ datei: name, line: rest[0].loc.start.line, nach: liste[i].loc.start.line, art: t });
        }
      }
      return true;
    });
    // Ergebnis reiner Methoden verworfen (Zeichenketten und Arrays aendern sich nicht in place)
    const REIN = new Set(["replace", "replaceAll", "trim", "trimStart", "trimEnd", "slice", "substring", "concat", "map", "filter",
      "flat", "flatMap", "toFixed", "padStart", "padEnd", "toLowerCase", "toUpperCase", "repeat", "join", "split", "toString",
      "indexOf", "includes", "startsWith", "endsWith", "parse", "stringify", "max", "min", "round", "floor", "ceil", "abs"]);
    const verworfen = [];
    geheDurch(ast, (n) => {
      if (n.type === "ExpressionStatement" && n.expression.type === "CallExpression"
        && n.expression.callee.type === "MemberExpression" && !n.expression.callee.computed
        && REIN.has(n.expression.callee.property.name)) {
        const obj = n.expression.callee.object;
        const istMathJson = obj.type === "Identifier" && (obj.name === "Math" || obj.name === "JSON");
        verworfen.push({ datei: name, line: n.loc.start.line, text: calleeText(n.expression.callee), mathJson: istMathJson });
      }
      if (n.type === "AssignmentExpression" && n.operator === "=" && n.left.type === "Identifier" && n.right.type === "Identifier" && n.left.name === n.right.name) {
        verworfen.push({ datei: name, line: n.loc.start.line, text: "Selbstzuweisung " + n.left.name, mathJson: false });
      }
      return true;
    });
    return { funde, un, verworfen };
  };
  const t1 = pruefeDatei("probe.js", "export function main(ns) { const nieGenutzt = 1; function tot() { return 2; } return 3; ns.print('x'); }");
  probe("TOTCODE findet ungenutzte Konstante, ungenutzte Funktion, Code nach return",
    t1.funde.length === 2 && t1.un.length === 1, JSON.stringify([t1.funde.map((f) => f.name), t1.un.length]));
  for (const [f, code] of quellen) {
    let r; try { r = pruefeDatei(f, code); } catch { continue; }
    ergebnis.totcode.push(...r.funde); ergebnis.unerreichbar.push(...r.un); ergebnis.verworfeneReine.push(...r.verworfen);
  }
  console.log("  nie verwendet: " + ergebnis.totcode.length + " (davon Exporte ohne Importeur: " + ergebnis.totcode.filter((x) => x.export).length + "); unerreichbar: " + ergebnis.unerreichbar.length);
  for (const x of ergebnis.totcode) console.log("  " + x.datei + ":" + x.line + "  " + x.art + " " + x.name + (x.export ? "  (exportiert, kein Importeur)" : ""));
  for (const x of ergebnis.unerreichbar) console.log("  " + x.datei + ":" + x.line + "  UNERREICHBAR nach " + x.art + " in Zeile " + x.nach);
  const tp = pruefeDatei("probe.js", "export function main(ns) { const s = 'a'; s.replace('a', 'b'); ns.print(s); }");
  probe("TOTCODE findet verworfenes replace()", tp.verworfen.length === 1, JSON.stringify(tp.verworfen.map((v) => v.text)));
  console.log("  verworfene Ergebnisse reiner Methoden: " + ergebnis.verworfeneReine.length);
  for (const x of ergebnis.verworfeneReine) console.log("  " + x.datei + ":" + x.line + "  " + x.text);
}

// ---- 12. LESEFELDER: Felder, die ein Leser aus einer JSON-Datei holt und die NIRGENDS gesetzt werden ----
// Anlass (Kommentar bn4net.js, Block backup_age_h): "Das Feld hiess nie so ... der catch hat es verschluckt."
// Ein Leser, der ein Feld liest, das kein Schreiber je setzt, bekommt `undefined` - kein Fehler, nur ein Kennwert,
// der nie anspringt. TypeScript sieht das nicht (JSON.parse liefert `any`). Hier: Variablen, die aus
// JSON.parse(<Lesen einer data/-Datei>) stammen; jedes gelesene Feld muss als Schluessel oder Zuweisung
// IRGENDWO in src/, tools/ oder sync/ vorkommen.
if (TEILE.has("lesefelder")) {
  console.log("\n=== 12. LESEFELDER: gelesen, aber nirgends geschrieben ===");
  // Schluesselkorpus
  const korpusDateien = [...jsDateien.map((f) => ["src/" + f, quellen.get(f)])];
  for (const verz of ["tools", "sync"]) {
    const abs = path.join(ROOT, verz);
    const rek = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "audit" && e.name !== "einmal") rek(p); } else if (/\.(m?js)$/.test(e.name)) korpusDateien.push([path.relative(ROOT, p), fs.readFileSync(p, "utf8")]); } };
    rek(abs);
  }
  // Je Datei: Schluessel, die sie setzt; Pfade, die sie schreibt; ihre Importe.
  const schluesselVon = new Map(); const schreibtVon = new Map(); const importeVon = new Map();
  const WRITE_NAME = /(write|nachhome|anhome|schreib|speicher|sicher|append|persist)/i;
  const analysiere = (name, code) => {
    let ast;
    try { ast = acorn.parse(code, parseOpt); } catch { return; }
    const konst = new Map();
    geheDurch(ast, (n) => { if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init && n.init.type === "Literal" && typeof n.init.value === "string") konst.set(n.id.name, n.init.value); return true; });
    const keys = new Set(); const pfade = new Set(); const imps = new Set();
    geheDurch(ast, (n) => {
      if (n.type === "Property" && !n.computed) {
        if (n.key.type === "Identifier") keys.add(n.key.name); else if (n.key.type === "Literal") keys.add(String(n.key.value));
      }
      if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression") {
        if (!n.left.computed && n.left.property.type === "Identifier") keys.add(n.left.property.name);
        else if (n.left.computed && n.left.property.type === "Literal") keys.add(String(n.left.property.value));
      }
      if (n.type === "ImportDeclaration") imps.add(n.source.value);
      if (n.type === "CallExpression" && WRITE_NAME.test(calleeText(n.callee).split(".").pop())) {
        for (const arg of n.arguments) {
          if (arg.type === "Literal" && typeof arg.value === "string" && /\.(json|txt)$/.test(arg.value)) pfade.add(arg.value);
          else if (arg.type === "Identifier" && konst.has(arg.name) && /\.(json|txt)$/.test(konst.get(arg.name))) pfade.add(konst.get(arg.name));
        }
      }
      return true;
    });
    schluesselVon.set(name, keys); schreibtVon.set(name, pfade); importeVon.set(name, imps);
  };
  for (const [name, code] of korpusDateien) analysiere(name, code);
  const schreiberKorpus = (pfad) => {
    const dateien = [...schreibtVon.entries()].filter(([, ps]) => ps.has(pfad)).map(([n]) => n);
    const keys = new Set(); const quelle = new Set(dateien);
    for (const d of dateien) for (const i of importeVon.get(d) ?? []) {
      const r = i.replace(/^\.?\//, "").replace(/(\.js)?$/, ".js"); quelle.add("src/" + r);
    }
    for (const d of quelle) for (const k of schluesselVon.get(d) ?? []) keys.add(k);
    return { dateien, keys };
  };
  const lesen = (code, datei) => {
    const ast = acorn.parse(code, parseOpt);
    const konst = new Map();
    geheDurch(ast, (n) => {
      if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.init && n.init.type === "Literal" && typeof n.init.value === "string") konst.set(n.id.name, n.init.value);
      return true;
    });
    const pfadVon = (ausdruck) => {
      let treffer = null;
      geheDurch(ausdruck, (x) => {
        if (treffer) return false;
        if (x.type === "Literal" && typeof x.value === "string" && /\.(json|txt)$/.test(x.value)) treffer = x.value;
        else if (x.type === "Identifier" && konst.has(x.name) && /\.(json|txt)$/.test(konst.get(x.name))) treffer = konst.get(x.name);
        return !treffer;
      });
      return treffer;
    };
    const jsonPfad = (init) => {
      if (!init) return null;
      let jp = null;
      geheDurch(init, (x) => { if (x.type === "CallExpression" && calleeText(x.callee) === "JSON.parse") jp = x; return !jp; });
      if (!jp) return null;
      const direkt = pfadVon(jp.arguments[0] ?? jp);
      if (direkt) return direkt;
      // JSON.parse(roh), roh = liesVonHome(ns, "data/x.json") weiter oben
      let ident = null;
      geheDurch(jp.arguments[0] ?? jp, (x) => { if (!ident && x.type === "Identifier") ident = x.name; return !ident; });
      return ident ? suche("raw:" + ident) : null;
    };
    const felder = [];
    // Gueltigkeitsbereiche: Stapel von Maps (Name -> Pfad | null). Funktionen, Bloecke, for und catch oeffnen einen.
    const stapel = [new Map()];
    const suche = (name) => { for (let i = stapel.length - 1; i >= 0; i--) if (stapel[i].has(name)) return stapel[i].get(name); return null; };
    const deklariere = (name, pfad) => stapel[stapel.length - 1].set(name, pfad);
    const besuch = (n) => {
      if (!n || typeof n.type !== "string") return;
      const oeffnet = isFn(n) || n.type === "BlockStatement" || n.type === "ForStatement" || n.type === "ForInStatement"
        || n.type === "ForOfStatement" || n.type === "CatchClause" || n.type === "SwitchStatement";
      if (oeffnet) stapel.push(new Map());
      if (isFn(n)) {
        if (n.type === "FunctionDeclaration" && n.id) stapel[stapel.length - 2].set(n.id.name, null);
        for (const p of n.params) patternNames(p).forEach((x) => deklariere(x, null));
      }
      if (n.type === "CatchClause" && n.param) patternNames(n.param).forEach((x) => deklariere(x, null));
      if (n.type === "VariableDeclarator") {
        // Zuerst die rechte Seite besuchen (sie sieht die neue Bindung noch nicht), dann binden.
        besuch(n.init);
        const pfad = jsonPfad(n.init);
        if (n.id.type === "Identifier" && n.init && !pfad) { const rp = n.init ? pfadVon(n.init) : null; if (rp) deklariere("raw:" + n.id.name, rp); }
        if (n.id.type === "Identifier") deklariere(n.id.name, pfad);
        else {
          patternNames(n.id).forEach((x) => deklariere(x, null));
          if (pfad && n.id.type === "ObjectPattern") {
            for (const pr of n.id.properties) if (pr.type === "Property" && pr.key.type === "Identifier") felder.push({ datei, pfad, feld: pr.key.name, zeile: pr.loc.start.line });
          }
        }
        if (oeffnet) stapel.pop();
        return;
      }
      if (n.type === "AssignmentExpression" && n.left.type === "Identifier") {
        const pfad = jsonPfad(n.right);
        // Neu zuweisen: in der Map ersetzen, die den Namen kennt (sonst im aktuellen Bereich).
        let gesetzt = false;
        for (let i = stapel.length - 1; i >= 0; i--) if (stapel[i].has(n.left.name)) { stapel[i].set(n.left.name, pfad); gesetzt = true; break; }
        if (!gesetzt) deklariere(n.left.name, pfad);
      }
      if (n.type === "MemberExpression" && n.object.type === "Identifier") {
        const pfad = suche(n.object.name);
        if (pfad) {
          let feld = null;
          if (!n.computed && n.property.type === "Identifier") feld = n.property.name;
          else if (n.computed && n.property.type === "Literal") feld = String(n.property.value);
          if (feld !== null) felder.push({ datei, pfad, feld, zeile: n.loc.start.line });
        }
      }
      for (const k of Object.keys(n)) {
        if (k === "loc" || k === "start" || k === "end") continue;
        const v = n[k];
        if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") besuch(c); }
        else if (v && typeof v.type === "string") besuch(v);
      }
      if (oeffnet) stapel.pop();
    };
    besuch(ast);
    return felder;
  };
  // Selbstprobe: ein gelesenes Feld, das kein Schreiber kennt
  const sp = lesen('const a = JSON.parse(ns.read("data/x.json")); const b = a.gibtEsNirgends; const c = a.zeit;', "probe.js");
  probe("LESEFELDER erkennt gelesene Felder aus JSON.parse(ns.read(data/...))", sp.length === 2 && sp[0].feld === "gibtEsNirgends", JSON.stringify(sp.map((s) => s.feld)));
  const fs0 = new Set(["length", "map", "filter", "forEach", "push", "slice", "includes", "some", "every", "find", "keys", "values", "entries", "join", "indexOf", "reduce", "sort", "toString", "toFixed", "has", "get", "set", "size", "add", "delete", "concat", "flat", "findIndex", "splice", "shift", "pop", "unshift", "reverse", "at", "trim", "split", "startsWith", "endsWith", "padStart", "padEnd", "replace", "constructor", "hasOwnProperty", "toLowerCase", "toUpperCase", "substring", "charAt", "lastIndexOf", "match", "test", "name", "message"]);
  ergebnis.lesefelder = [];
  const OBJ = new Set(["length", "map", "filter", "forEach", "push", "slice", "includes", "some", "every", "find", "keys", "values", "entries", "join", "indexOf", "reduce", "sort", "toString", "toFixed", "has", "get", "set", "size", "add", "delete", "concat", "flat", "findIndex", "splice", "shift", "pop", "unshift", "reverse", "at", "trim", "split", "startsWith", "endsWith", "padStart", "padEnd", "replace", "constructor", "hasOwnProperty", "toLowerCase", "toUpperCase", "substring", "charAt", "lastIndexOf", "match", "test", "message"]);
  let geprueft = 0; let geprueftStatisch = 0; const ohneSchreiber = new Set();
  for (const [f, code] of quellen) {
    let r; try { r = lesen(code, f); } catch { continue; }
    const gesehen = new Set();
    for (const x of r) {
      if (OBJ.has(x.feld)) continue;
      const w = schreiberKorpus(x.pfad);
      geprueft++;
      if (!w.dateien.length) {
        // Statische Datei (src/lib/*.json, src/route.json ...): die echten Schluessel pruefen.
        const dp = path.join(SRC, x.pfad);
        if (fs.existsSync(dp)) {
          const keys = new Set();
          const rek = (o) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { keys.add(k); rek(v); } };
          try { rek(JSON.parse(fs.readFileSync(dp, "utf8"))); } catch { /* egal */ }
          if (!keys.has(x.feld)) ergebnis.lesefelder.push({ ...x, schreiber: ["(statische Datei " + x.pfad + ")"] });
          else geprueftStatisch++;
        } else ohneSchreiber.add(x.pfad);
        continue;
      }
      if (w.keys.has(x.feld)) continue;
      const k = x.pfad + "|" + x.feld + "|" + x.datei;
      if (gesehen.has(k)) continue; gesehen.add(k);
      ergebnis.lesefelder.push({ ...x, schreiber: w.dateien });
    }
  }
  console.log("  geprueft: " + geprueft + " Lesezugriffe auf Felder (davon " + geprueftStatisch + " gegen statische JSON-Dateien); Pfade ohne auffindbaren Schreiber: " + [...ohneSchreiber].join(", "));
  console.log("  Funde: " + ergebnis.lesefelder.length);
  for (const x of ergebnis.lesefelder) console.log("  " + x.datei + ":" + x.zeile + "  " + x.pfad + "  Feld \"" + x.feld + "\" kommt in keinem Schreiber vor (" + x.schreiber.join(", ") + ")");
}

// ---- 13. CATCH -----------------------------------------------------------
if (TEILE.has("catch")) {
  console.log("\n=== 13. CATCH-Inventar ===");
  const t = catchInventar("probe.js", [
    "export async function main(ns) {",
    "  try { ns.nuke('x'); } catch { }",
    "  try { ns.nuke('x'); } catch (e) { ns.print(e); }",
    "  try { ns.nuke('x'); } catch (e) { return null; }",
    "  try { ns.nuke('x'); } catch (e) { throw e; }",
    "}",
  ].join("\n"));
  probe("catch-Klassifikation: LEER, LOG, DEFAULT, RETHROW",
    t.map((x) => x.klasse).join(",") === "LEER,LOG,DEFAULT,RETHROW", t.map((x) => x.klasse).join(","));
  for (const [f, code] of quellen) ergebnis.catch.push(...catchInventar(f, code));
  const z = {};
  for (const c of ergebnis.catch) z[c.klasse] = (z[c.klasse] ?? 0) + 1;
  console.log("  try/catch gesamt: " + ergebnis.catch.length + "  " + JSON.stringify(z)
    + "  verschluckt: " + ergebnis.catch.filter((c) => c.verschluckt).length);
}

const rot =ergebnis.selbstprobe.filter((p) => !p.ok).length;
console.log("\n=== Selbstproben: " + (ergebnis.selbstprobe.length - rot) + " ok, " + rot + " ROT ===");

// --gate: harte Funde ausserhalb der begruendeten Ausnahmen. Jede Ausnahme nennt den Grund.
let gateRot = 0;
if (argv.includes("--gate")) {
  const ERLAUBT = {
    // tsc kennt die versteckten Funktionen exploit/bypass/rainbow nicht (Extra.ts:11-14, im Spiel vorhanden)
    "exploit.js:35": "ns.exploit ist im Spiel vorhanden (NetscriptFunctions/Extra.ts:20), nur nicht in der .d.ts",
    "exploit.js:36": "ns.rainbow: Extra.ts:53",
    "exploit.js:37": "ns.bypass: Extra.ts:21",
    // zwei Messwerkzeuge, kein Teil des Bots (nirgends gestartet): echte Fehler, bewusst nicht repariert
    "formcheck.js:105": "ns.getFactionFavor gibt es nur als ns.singularity.getFactionFavor - Messwerkzeug, nicht im Bot",
    "torprobe.js:23": "ns.formatNumber ist seit 3.0.0 entfernt (NetscriptFunctions.ts:1495) - Messwerkzeug, nicht im Bot",
    "boprobe.js:10": "Typ \"Blackops\" gibt es nicht, der Spiel-Abgleich ist exakt (EnumHelper.ts:60-70): \"Black Operations\" - einmaliges Messwerkzeug, Fehler landet in data/boprobe.json",
    "boprobe.js:12": "wie boprobe.js:10",
  };
  const hart = [];
  for (const d of ergebnis.tsc) {
    if (d.kat === "ARITAET" || d.kat === "NICHT-AUFRUFBAR") continue;     // Tippfehler-Rauschen von Standardparametern/Tupeln (siehe Bericht)
    if (ERLAUBT[d.file + ":" + d.line]) continue;
    hart.push("tsc " + d.kat + " " + d.file + ":" + d.line + " " + d.msg);
  }
  for (const x of ergebnis.scope) hart.push("scope " + x.file + ":" + x.line + " " + x.name);
  for (const x of ergebnis.tdz) hart.push("tdz " + x.file + ":" + x.line + " " + x.name);
  for (const x of ergebnis.killfalle ?? []) hart.push("killfalle " + x.datei + ":" + x.line);
  for (const x of ergebnis.fliegend ?? []) hart.push("promise " + x.file + ":" + x.line + " " + x.text);
  for (const x of ergebnis.enumarg) { if (!ERLAUBT[x.file + ":" + x.line]) hart.push("enumarg " + x.file + ":" + x.line + " " + x.schlecht.join(",")); }
  console.log("\n=== GATE: " + hart.length + " harte Funde ===");
  for (const h of hart) console.log("  " + h);
  gateRot = hart.length ? 1 : 0;
}
const ausJson2 = opt("--json");
if (ausJson2) fs.writeFileSync(ausJson2, JSON.stringify(ergebnis, null, 1));
process.exit(rot || gateRot ? 1 : 0);
