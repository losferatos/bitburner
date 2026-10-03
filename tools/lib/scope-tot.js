// SCOPE-PRUEFUNG: NAMEN, DIE AUSSERHALB IHRES GUELTIGKEITSBEREICHS STEHEN
// (03.10.2026, Befund aus Commit fe3b013).
//
// Warum es das braucht: In src/blade.js riefen zwei Stellen `blackOpChance()`
// und `blackOpSchwelle()` auf, die nur INNERHALB von `waehle()` als const
// existierten. Zur Laufzeit gibt das einen ReferenceError - und weil beide
// Stellen in try/catch stehen, verschluckt der catch ihn still. Der Code sah
// lebendig aus und war tot. `node --check` und tools/syntax.js sehen das
// nicht, denn syntaktisch ist ein unbekannter Name voellig in Ordnung (er
// koennte ja global sein).
//
// Was hier geprueft wird: Jeder Bezeichner in Ausdrucksposition wird durch
// die Kette der umschliessenden Scopes aufgeloest (Funktion, Block, for,
// catch, Klasse, Modul). Bleibt er unaufgeloest, ist er entweder ein
// Laufzeit-Global (Math, JSON, ns gibt es nicht - ns ist Parameter) - oder
// er ist IRGENDWO ANDERS in derselben Datei deklariert. Nur der zweite Fall
// wird gemeldet: Dann ist es mit an Sicherheit grenzender Wahrscheinlichkeit
// genau dieser Fehler, ein Name, der aus einem fremden Scope geborgt wird.
// Globale, die zufaellig auch lokal deklariert sind, waeren ein Fehlalarm -
// in src/ kommt das nicht vor, und falls doch, wird es hier ausdruecklich
// mit Begruendung freigegeben statt die Pruefung aufzuweichen.
//
// Grenze: Die zeitliche Totzone (const vor seiner Zeile benutzt) prueft das
// NICHT. Ein Aufruf aus einer Funktion heraus, die erst nach der
// Initialisierung laeuft, ist korrekt, und das kann eine statische Pruefung
// nicht unterscheiden.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const ACORN = path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs");

let acorn = null;
export async function loadAcorn() {
  if (acorn) return acorn;
  if (!fs.existsSync(ACORN)) return null;
  acorn = await import(pathToFileURL(ACORN).href);
  return acorn;
}

// Bezeichner aus einem Muster (Destrukturierung, Rest, Vorgabewert).
function patternNames(p, out) {
  if (!p) return out;
  switch (p.type) {
    case "Identifier": out.push(p.name); break;
    case "ObjectPattern":
      for (const pr of p.properties) patternNames(pr.type === "RestElement" ? pr.argument : pr.value, out);
      break;
    case "ArrayPattern": for (const el of p.elements) patternNames(el, out); break;
    case "RestElement": patternNames(p.argument, out); break;
    case "AssignmentPattern": patternNames(p.left, out); break;
    default: break;
  }
  return out;
}

const isFn = (n) => n.type === "FunctionDeclaration" || n.type === "FunctionExpression"
  || n.type === "ArrowFunctionExpression";

// Prueft den Quelltext. Rueckgabe: Liste {name, line, declaredAt:[Zeilen]}.
export function findOutOfScope(code, ac) {
  const ast = ac.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true });
  // Pass 1: Scopes bauen. Jeder Scope: {parent, names:Set, isFunction}.
  const scopeOf = new Map();     // Knoten -> Scope, den er eroeffnet
  const allDecl = new Map();     // Name -> [Zeilen], ueber die ganze Datei
  const noteDecl = (scope, name, line) => {
    scope.names.add(name);
    if (!allDecl.has(name)) allDecl.set(name, []);
    allDecl.get(name).push(line);
  };
  const mk = (parent, isFunction) => ({ parent, names: new Set(), isFunction });
  const fnScope = (s) => { while (!s.isFunction) s = s.parent; return s; };

  const build = (node, scope) => {
    if (!node || typeof node.type !== "string") return;
    let inner = scope;
    if (node.type === "Program") {
      inner = mk(null, true); scopeOf.set(node, inner);
    } else if (isFn(node)) {
      if (node.type === "FunctionDeclaration" && node.id) noteDecl(scope, node.id.name, node.loc.start.line);
      inner = mk(scope, true); scopeOf.set(node, inner);
      if (node.type === "FunctionExpression" && node.id) noteDecl(inner, node.id.name, node.loc.start.line);
      for (const p of node.params) for (const n of patternNames(p, [])) noteDecl(inner, n, node.loc.start.line);
    } else if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      if (node.type === "ClassDeclaration" && node.id) noteDecl(scope, node.id.name, node.loc.start.line);
      inner = mk(scope, false); scopeOf.set(node, inner);
      if (node.type === "ClassExpression" && node.id) noteDecl(inner, node.id.name, node.loc.start.line);
    } else if (node.type === "BlockStatement" || node.type === "SwitchStatement"
      || node.type === "ForStatement" || node.type === "ForInStatement" || node.type === "ForOfStatement"
      || node.type === "StaticBlock") {
      inner = mk(scope, false); scopeOf.set(node, inner);
    } else if (node.type === "CatchClause") {
      inner = mk(scope, false); scopeOf.set(node, inner);
      for (const n of patternNames(node.param, [])) noteDecl(inner, n, node.loc.start.line);
    } else if (node.type === "VariableDeclaration") {
      const target = node.kind === "var" ? fnScope(scope) : scope;
      for (const d of node.declarations) for (const n of patternNames(d.id, [])) noteDecl(target, n, d.loc.start.line);
    } else if (node.type === "ImportDeclaration") {
      for (const s of node.specifiers) noteDecl(scope, s.local.name, node.loc.start.line);
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const v = node[key];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") build(c, inner); }
      else if (v && typeof v.type === "string") build(v, inner);
    }
  };
  build(ast, null);

  // Pass 2: Bezeichner in Ausdrucksposition aufloesen.
  const funde = [];
  const resolves = (scope, name) => { for (let s = scope; s; s = s.parent) if (s.names.has(name)) return true; return false; };
  const visit = (node, scope, parent, key) => {
    if (!node || typeof node.type !== "string") return;
    const inner = scopeOf.get(node) ?? scope;
    if (node.type === "Identifier") {
      // Keine Referenzen: Eigenschaftsnamen, Schluessel, Marken, Deklarationen.
      const notRef = (parent?.type === "MemberExpression" && key === "property" && !parent.computed)
        || ((parent?.type === "Property" || parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition")
          && key === "key" && !parent.computed)
        || ((parent?.type === "LabeledStatement" || parent?.type === "BreakStatement"
          || parent?.type === "ContinueStatement") && key === "label")
        || (parent?.type === "MetaProperty")
        || parent?.type === "ImportSpecifier" || parent?.type === "ImportDefaultSpecifier"
        || parent?.type === "ImportNamespaceSpecifier" || parent?.type === "ExportSpecifier";
      if (!notRef && !resolves(scope, node.name) && allDecl.has(node.name)) {
        funde.push({ name: node.name, line: node.loc.start.line, declaredAt: allDecl.get(node.name) });
      }
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end") continue;
      // Deklarationsseiten nicht als Referenz zaehlen; Vorgabewerte darin schon.
      if ((node.type === "VariableDeclarator" && k === "id")
        || (isFn(node) && (k === "id" || k === "params"))
        || ((node.type === "ClassDeclaration" || node.type === "ClassExpression") && k === "id")
        || (node.type === "CatchClause" && k === "param")) {
        const muster = k === "params" ? node[k] : [node[k]];
        for (const m of muster) visitPatternDefaults(m, inner);
        continue;
      }
      const v = node[k];
      if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") visit(c, inner, node, k); }
      else if (v && typeof v.type === "string") visit(v, inner, node, k);
    }
  };
  // In Mustern sind nur Vorgabewerte und berechnete Schluessel Referenzen.
  const visitPatternDefaults = (p, scope) => {
    if (!p) return;
    switch (p.type) {
      case "AssignmentPattern": visitPatternDefaults(p.left, scope); visit(p.right, scope, p, "right"); break;
      case "ObjectPattern":
        for (const pr of p.properties) {
          if (pr.type === "RestElement") { visitPatternDefaults(pr.argument, scope); continue; }
          if (pr.computed) visit(pr.key, scope, pr, "computedKey");
          visitPatternDefaults(pr.value, scope);
        }
        break;
      case "ArrayPattern": for (const el of p.elements) visitPatternDefaults(el, scope); break;
      case "RestElement": visitPatternDefaults(p.argument, scope); break;
      default: break;
    }
  };
  visit(ast, null, null, null);
  return funde;
}

// Alle .js-Dateien eines Ordners pruefen, Unterordner eingeschlossen
// (src/lib/ gehoert dazu). Rueckgabe: {file (relativ, mit /), name, line, declaredAt}.
export function scanDir(dir, ac) {
  const sammle = (o) => {
    const raus = [];
    for (const e of fs.readdirSync(o, { withFileTypes: true })) {
      const p = path.join(o, e.name);
      if (e.isDirectory()) raus.push(...sammle(p));
      else if (e.name.endsWith(".js")) raus.push(p);
    }
    return raus;
  };
  const out = [];
  for (const p of sammle(dir).sort()) {
    const f = path.relative(dir, p).split(path.sep).join("/");
    try {
      for (const fund of findOutOfScope(fs.readFileSync(p, "utf8"), ac)) out.push({ file: f, ...fund });
    } catch (e) {
      out.push({ file: f, name: "(parse)", line: e.loc?.line ?? 0, declaredAt: [], error: String(e.message) });
    }
  }
  return out;
}
