// DATENFLUSS-BIBLIOTHEK (Audit 03.10.2026, Robustheitspruefung "Fluss") - Motor fuer datenfluss.mjs
//
// Frage: Welche Dateien, Felder und Kanaele werden geschrieben, aber nie gelesen
// (toter Kanal wie `truppAnfrage` bis zum 03.10.), und welche werden gelesen,
// aber nie geschrieben (der Leser wartet ewig oder der Standardwert greift still)?
//
// Vorgehen (AST mit acorn, nicht grep):
//   1. SPIEL-SEITE (src/**): jeder ns.write/read/fileExists/rm/scp/mv/ls/exec und
//      jeder Port-Aufruf. Der Dateiname wird als Konstante aufgeloest (const-Tabellen,
//      Vorlagen, Verkettung, for-of ueber Listen, Importe). Funktionen, die einen
//      Parameter bis zu ns.write/ns.read durchreichen (lib/hostdatei.js usw.), werden
//      als WRAPPER erkannt - ihre Aufrufer zaehlen als Schreiber/Leser (Fixpunkt).
//      Nicht aufloesbare Namen stehen als Muster mit {?} und werden gesondert gezaehlt.
//   2. HOST-SEITE (sync/**, tools/**, dashboard/**): Dateinamen-Literale und ihr
//      Kontext (rpc getFile/pushFile/deleteFile = Spieldatei, fs.* = Hostdatei).
//   3. FELDER: bei JSON-Schreibern die Schluessel des geschriebenen Objekts, bei
//      Lesern die Zugriffe auf das gelesene Objekt (variablenverfolgt, mit grober
//      Rueckfalleben "Name kommt irgendwo in der Leserdatei als Zugriff vor").
//   4. SELBSTPROBE: ein eingebauter toter Kanal und ein eingebauter blinder Leser
//      muessen gefunden werden, sonst gilt "kein Fund" nicht.
//
// Aufruf:  node tools/audit/datenfluss.mjs [--md] [--json <datei>] [--src <verz>]
//                                          [--felder] [--selbstprobe] [--skripte]
// src/ wird nur GELESEN.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);

const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const Q = "{?}"; // nicht aufloesbarer Teil eines Namens

// ---------------------------------------------------------------------------
// AST-Hilfen
// ---------------------------------------------------------------------------
function kinder(node) {
  const out = [];
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end" || k === "type") continue;
    const v = node[k];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === "string") out.push(c); }
    else if (v && typeof v.type === "string") out.push(v);
  }
  return out;
}
function walk(node, pre, anc = []) {
  pre(node, anc);
  anc.push(node);
  for (const c of kinder(node)) walk(c, pre, anc);
  anc.pop();
}
const istFn = (n) => n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression";
const paramName = (p) => {
  if (!p) return null;
  if (p.type === "Identifier") return p.name;
  if (p.type === "AssignmentPattern") return paramName(p.left);
  if (p.type === "RestElement") return paramName(p.argument);
  return null;
};
const keyName = (p) => {
  if (!p || p.computed) return null;
  if (p.key.type === "Identifier") return p.key.name;
  if (p.key.type === "Literal") return String(p.key.value);
  return null;
};

function parse(code, sourceType = "module") {
  return acorn.parse(code, { ecmaVersion: "latest", sourceType, locations: true, allowHashBang: true, allowReturnOutsideFunction: true });
}

// ---------------------------------------------------------------------------
// Dateimodell
// ---------------------------------------------------------------------------
/**
 * Eine Quelldatei einlesen: Deklarationen, Importe, Exporte, Funktionen, Aufrufe.
 */
function ladeDatei(rel, code, sourceType = "module") {
  const F = {
    rel, code, ast: null,
    decls: new Map(),      // name -> [Knoten (init)]
    loopVars: new Map(),   // name -> [Knoten (Liste, ueber die iteriert wird)]
    imports: new Map(),    // lokal -> {von, name}  (name "*" = Namensraum)
    exports: new Map(),    // exportName -> lokalerName
    funcs: new Map(),      // name -> Funktionsknoten
    fnName: new Map(),     // Funktionsknoten -> name
    calls: [],             // {node, fns: [Funktionsknoten ...]}
    exprs: [],             // oberste Verkettungen/Vorlagen (fuer URL-Muster)
    parseFehler: null,
  };
  try { F.ast = parse(code, sourceType); } catch (e) {
    if (sourceType === "module") {
      try { F.ast = parse(code, "script"); } catch (e2) { F.parseFehler = e2.message; return F; }
    } else { F.parseFehler = e.message; return F; }
  }
  const blockBereich = (anc) => {
    for (let i = anc.length - 1; i >= 0; i--) {
      const t = anc[i].type;
      if (t === "BlockStatement" || t === "Program" || t === "ForStatement" || t === "ForOfStatement" || t === "ForInStatement" || t === "StaticBlock") return [anc[i].start, anc[i].end];
    }
    return null;
  };
  const addDecl = (name, init, fns, blk) => { if (!F.decls.has(name)) F.decls.set(name, []); F.decls.get(name).push({ n: init, fns, blk }); };
  walk(F.ast, (n, anc) => {
    switch (n.type) {
      case "ImportDeclaration":
        for (const s of n.specifiers) {
          if (s.type === "ImportSpecifier") F.imports.set(s.local.name, { von: n.source.value, name: s.imported.name });
          else if (s.type === "ImportDefaultSpecifier") F.imports.set(s.local.name, { von: n.source.value, name: "default" });
          else F.imports.set(s.local.name, { von: n.source.value, name: "*" });
        }
        break;
      case "ExportNamedDeclaration":
        if (n.declaration) {
          if (n.declaration.type === "VariableDeclaration") {
            for (const d of n.declaration.declarations) if (d.id.type === "Identifier") F.exports.set(d.id.name, d.id.name);
          } else if (n.declaration.id) F.exports.set(n.declaration.id.name, n.declaration.id.name);
        }
        for (const s of n.specifiers || []) F.exports.set(s.exported.name, s.local.name);
        break;
      case "VariableDeclarator":
        if (n.id.type === "Identifier" && n.init) {
          addDecl(n.id.name, n.init, anc.filter(istFn), blockBereich(anc));
          if (istFn(n.init)) { F.funcs.set(n.id.name, n.init); F.fnName.set(n.init, n.id.name); }
        }
        break;
      case "AssignmentExpression":
        if (n.operator === "=" && n.left.type === "Identifier") addDecl(n.left.name, n.right, anc.filter(istFn), null);
        break;
      case "FunctionDeclaration":
        if (n.id) { F.funcs.set(n.id.name, n); F.fnName.set(n, n.id.name); }
        break;
      case "Property":
        if (n.value && istFn(n.value)) { const k = keyName(n); if (k) F.fnName.set(n.value, k); }
        break;
      case "ForOfStatement":
        if (n.left.type === "VariableDeclaration" && n.left.declarations[0].id.type === "Identifier") {
          const nm = n.left.declarations[0].id.name;
          if (!F.loopVars.has(nm)) F.loopVars.set(nm, []);
          F.loopVars.get(nm).push({ n: n.right, fns: anc.filter(istFn), blk: [n.start, n.end] });
        }
        break;
      case "BinaryExpression":
      case "TemplateLiteral": {
        const p = anc[anc.length - 1];
        if (n.type === "TemplateLiteral" || (n.operator === "+" && !(p && p.type === "BinaryExpression" && p.operator === "+"))) {
          F.exprs.push({ node: n, fns: anc.filter(istFn) });
        }
        break;
      }
      case "NewExpression": {
        F.calls.push({ node: n, fns: anc.filter(istFn) });
        break;
      }
      case "CallExpression": {
        const fns = anc.filter(istFn);
        F.calls.push({ node: n, fns });
        // Liste.forEach((x) => ...) / .map / .filter / .some / .every / .find: x iteriert ueber Liste
        const c = n.callee;
        if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier"
            && ["forEach", "map", "filter", "some", "every", "find", "flatMap"].includes(c.property.name)
            && n.arguments[0] && istFn(n.arguments[0])) {
          const p0 = paramName(n.arguments[0].params[0]);
          if (p0) { if (!F.loopVars.has(p0)) F.loopVars.set(p0, []); F.loopVars.get(p0).push({ n: c.object, fns: [...anc.filter(istFn), n.arguments[0]], blk: [n.arguments[0].start, n.arguments[0].end] }); }
        }
        break;
      }
      default: break;
    }
    // Funktion in einer Zuweisung "obj.name = function"
  });
  return F;
}

// ---------------------------------------------------------------------------
// Konstantenauswertung
// ---------------------------------------------------------------------------
class Welt {
  constructor(root, verz) {
    this.root = root;
    this.verz = verz;      // z. B. "src"
    this.dateien = new Map();
  }
  lade(rel, code, st) { const f = ladeDatei(rel, code, st); this.dateien.set(rel, f); return f; }
  /** "lib/hostdatei.js" -> Dateimodell */
  finde(spez, von) {
    let s = spez.replace(/^\.?\//, "");
    if (!s.endsWith(".js")) s += ".js";
    if (this.dateien.has(s)) return this.dateien.get(s);
    if (von) {
      const dir = path.posix.dirname(von.rel);
      const r = path.posix.normalize(dir + "/" + spez);
      const r2 = r.endsWith(".js") ? r : r + ".js";
      if (this.dateien.has(r2)) return this.dateien.get(r2);
    }
    return null;
  }
}

function kartesisch(listen, deckel = 48) {
  let acc = [""];
  for (const l of listen) {
    const nxt = [];
    for (const a of acc) for (const b of l) { nxt.push(a + b); if (nxt.length >= deckel) break; if (nxt.length >= deckel) break; }
    acc = nxt.length ? nxt : [Q];
    if (acc.length >= deckel) acc = acc.slice(0, deckel);
  }
  return acc;
}
const uniq = (a) => [...new Set(a)];

/**
 * Wert eines Ausdrucks als Menge von Zeichenketten. {?} steht fuer Unbekanntes.
 * params: Menge der Parameternamen der umschliessenden Funktion (Schatten).
 */
function ev(W, F, node, params = new Set(), seen = new Set(), tiefe = 0) {
  if (!node || tiefe > 12) return [Q];
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") return [node.value];
      if (typeof node.value === "number" || typeof node.value === "boolean") return [String(node.value)];
      return [Q];
    case "TemplateLiteral": {
      const teile = [];
      for (let i = 0; i < node.quasis.length; i++) {
        teile.push([node.quasis[i].value.cooked ?? node.quasis[i].value.raw]);
        if (i < node.expressions.length) teile.push(ev(W, F, node.expressions[i], params, seen, tiefe + 1));
      }
      return uniq(kartesisch(teile));
    }
    case "BinaryExpression":
      if (node.operator === "+") {
        return uniq(kartesisch([ev(W, F, node.left, params, seen, tiefe + 1), ev(W, F, node.right, params, seen, tiefe + 1)]));
      }
      return [Q];
    case "ConditionalExpression":
      return uniq([...ev(W, F, node.consequent, params, seen, tiefe + 1), ...ev(W, F, node.alternate, params, seen, tiefe + 1)]);
    case "LogicalExpression":
      return uniq([...ev(W, F, node.left, params, seen, tiefe + 1), ...ev(W, F, node.right, params, seen, tiefe + 1)]);
    case "ParenthesizedExpression": return ev(W, F, node.expression, params, seen, tiefe + 1);
    case "Identifier":
      if (params.has(node.name)) return [Q];
      return evName(W, F, node.name, seen, tiefe + 1, params.fns || [], node.start);
    case "MemberExpression": {
      // KONSTANTE.feld  oder  LISTE[i]
      let objs = null;
      if (node.object.type === "Identifier" && !params.has(node.object.name)) objs = holeKnoten(W, F, node.object.name, new Set(), 0, params.fns || [], node.object.start);
      else if (node.object.type === "ObjectExpression" || node.object.type === "ArrayExpression") objs = [{ F, n: node.object }];
      if (!objs) return [Q];
      const out = [];
      for (const { F: F2, n } of objs) {
        const o = entpacke(n);
        if (o.type === "ObjectExpression") {
          let key = null;
          if (!node.computed && node.property.type === "Identifier") key = node.property.name;
          else if (node.computed && node.property.type === "Literal") key = String(node.property.value);
          for (const p of o.properties) {
            if (p.type !== "Property") continue;
            const kn = keyName(p);
            if (key === null || kn === key) out.push(...ev(W, F2, p.value, new Set(), seen, tiefe + 1));
          }
        } else if (o.type === "ArrayExpression") {
          for (const e of o.elements) if (e) out.push(...ev(W, F2, e, new Set(), seen, tiefe + 1));
        }
      }
      return out.length ? uniq(out) : [Q];
    }
    case "CallExpression": {
      const c = node.callee;
      // path.join / path.resolve / encodeURIComponent / String(x): Wert durchreichen
      if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier"
          && (c.property.name === "join" || c.property.name === "resolve")
          && c.object.type === "Identifier" && c.object.name === "path") {
        const teile = [];
        node.arguments.forEach((a, i) => { if (i) teile.push(["/"]); teile.push(ev(W, F, a, params, seen, tiefe + 1)); });
        return uniq(kartesisch(teile));
      }
      if (c.type === "Identifier" && (c.name === "encodeURIComponent" || c.name === "String") && node.arguments[0]) {
        return ev(W, F, node.arguments[0], params, seen, tiefe + 1);
      }
      if (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier"
          && c.property.name === "toString" && node.arguments.length === 0) return ev(W, F, c.object, params, seen, tiefe + 1);
      // lokale Funktion, die eine Zeichenkette zurueckgibt: Rueckgabe mit Parametern als {?} auswerten
      if (c.type === "Identifier" && !params.has(c.name)) {
        const z = aufloesen(W, F, c.name);
        const fn = z && z.G.funcs.get(z.name);
        const key = "fn:" + (z ? z.G.rel + ":" + z.name : "");
        if (fn && !seen.has(key)) {
          const seen2 = new Set(seen); seen2.add(key);
          const ps = new Set(fn.params.map(paramName).filter(Boolean));
          const rets = [];
          if (fn.body.type !== "BlockStatement") rets.push(fn.body);
          else walk(fn.body, (n, anc) => { if (n.type === "ReturnStatement" && n.argument && !anc.some((a) => istFn(a))) rets.push(n.argument); });
          const out = [];
          for (const r of rets) out.push(...ev(W, z.G, r, ps, seen2, tiefe + 1));
          if (out.length) return uniq(out);
        }
      }
      return [Q];
    }
    default: return [Q];
  }
}
function entpacke(n) {
  // Object.freeze({...}) / as-Casts gibt es in JS nicht
  if (n && n.type === "CallExpression" && n.callee.type === "MemberExpression"
      && n.callee.object.type === "Identifier" && n.callee.object.name === "Object"
      && n.callee.property.name === "freeze" && n.arguments[0]) return n.arguments[0];
  return n;
}
/** Aus den Deklarationen eines Namens die im Aufruf-Scope sichtbaren waehlen (Block, dann Funktion, dann Modul). */
function waehleScope(liste, fns, pos) {
  if (!liste.length) return liste;
  if (Number.isFinite(pos)) {
    const drin = liste.filter((d) => d.blk && d.blk[0] <= pos && pos < d.blk[1]);
    if (drin.length) {
      const kleinste = Math.min(...drin.map((d) => d.blk[1] - d.blk[0]));
      const innen = drin.filter((d) => d.blk[1] - d.blk[0] === kleinste);
      // Zuweisungen ohne eigenen Block (x = ...) zaehlen zur selben Funktion mit
      const zuw = liste.filter((d) => !d.blk && fns.length && d.fns.length && d.fns[d.fns.length - 1] === fns[fns.length - 1]);
      return [...innen, ...zuw];
    }
  }
  for (let i = fns.length - 1; i >= 0; i--) {
    const m = liste.filter((d) => d.fns.includes(fns[i]) && d.fns[d.fns.length - 1] === fns[i]);
    if (m.length) return m;
  }
  const modul = liste.filter((d) => d.fns.length === 0);
  if (modul.length) return modul;
  return liste;
}
const mitFns = (fns) => { const p = new Set(); p.fns = fns || []; return p; };
/** Alle Knoten, die einen Namen in F (ggf. ueber Importe) definieren: [{F, n, fns}]. */
function holeKnoten(W, F, name, seen, tiefe, fns = [], pos = NaN) {
  const key = F.rel + ":" + name;
  if (seen.has(key) || tiefe > 6) return [];
  seen.add(key);
  const out = [];
  for (const d of waehleScope(F.decls.get(name) || [], fns, pos)) out.push({ F, n: d.n, fns: d.fns });
  const imp = F.imports.get(name);
  if (imp && imp.name !== "*") {
    const G = W.finde(imp.von, F);
    if (G) {
      const lokal = G.exports.get(imp.name);
      if (lokal) out.push(...holeKnoten(W, G, lokal, seen, tiefe + 1, []));
    }
  }
  return out;
}
function evName(W, F, name, seen, tiefe, fns = [], pos = NaN) {
  const key = F.rel + ":" + name;
  if (seen.has(key)) return [Q];
  const knoten = holeKnoten(W, F, name, new Set(), 0, fns, pos);
  const out = [];
  const seen2 = new Set(seen); seen2.add(key);
  for (const { F: F2, n, fns: f2 } of knoten) out.push(...ev(W, F2, n, mitFns(f2), seen2, tiefe + 1));
  for (const lv of waehleScope(F.loopVars.get(name) || [], fns, pos)) {
    const r = lv.n;
    if (r.type === "ArrayExpression") {
      for (const e of r.elements) if (e) out.push(...ev(W, F, e, mitFns(lv.fns), seen2, tiefe + 1));
    } else if (r.type === "Identifier") {
      let any = false;
      for (const { F: F2, n, fns: f2 } of holeKnoten(W, F, r.name, new Set(), 0, lv.fns, r.start)) {
        const arr = entpacke(n);
        if (arr.type === "ArrayExpression") { any = true; for (const e of arr.elements) if (e) out.push(...ev(W, F2, e, mitFns(f2), seen2, tiefe + 1)); }
      }
      if (!any) out.push(Q);
    } else if (r.type === "CallExpression" && r.callee.type === "MemberExpression" && r.callee.object.type === "Identifier"
               && r.callee.object.name === "ns" && r.callee.property.name === "ls") {
      // ns.ls(host, teil): Dateien, deren Name den Teil enthaelt
      const t = r.arguments[1] ? ev(W, F, r.arguments[1], mitFns(lv.fns), seen2, tiefe + 1) : [""];
      for (const x of t) out.push(Q + x + Q);
    } else out.push(Q);
  }
  return out.length ? uniq(out) : [Q];
}

// ---------------------------------------------------------------------------
// Senken (Sinks) im Spiel: ns.*
// ---------------------------------------------------------------------------
const NS_DATEI = {
  write: "W", read: "R", fileExists: "X", rm: "D", mv: "M", scp: "T", ls: "L",
  exec: "E", run: "E", spawn: "E", getScriptRam: "G", kill: "K", scriptKill: "K", scriptRunning: "N", isRunning: "N",
};
const NS_PORT = {
  writePort: "PW", tryWritePort: "PW", readPort: "PR", peek: "PP", clearPort: "PC", nextPortWrite: "PN", getPortHandle: "PH",
};

/** Siehe ev(): liefert zu einem Aufruf ns.X(...) die Senke oder null. */
function nsAufruf(call) {
  const c = call.callee;
  if (c.type !== "MemberExpression" || c.computed || c.object.type !== "Identifier" || c.object.name !== "ns") return null;
  const m = c.property.name;
  if (NS_DATEI[m]) return { methode: m, op: NS_DATEI[m], art: "datei" };
  if (NS_PORT[m]) return { methode: m, op: NS_PORT[m], art: "port" };
  return null;
}

function schreibModus(call) {
  // ns.write(datei, inhalt, modus) - Vorgabe "a" (angehaengt)
  const m = call.arguments[2];
  if (!m) return "A";
  if (m.type === "Literal") return m.value === "w" ? "W" : "A";
  return "W?";
}

function ersterNamensparam(fn, name) {
  return fn.params.findIndex((p) => paramName(p) === name);
}

/**
 * Hauptanalyse der Spiel-Seite. Liefert {sites, wrappers}.
 * site: {art, op, datei: [..], rel, zeile, via, host, inhaltKnoten, F}
 */
function analysiereSpiel(W) {
  const sites = [];
  const wrappers = new Map(); // "rel:name" -> {rel,name,idx,op,via}
  const pl = (F, call) => call.node.loc.start.line;

  // --- Pass 1: direkte Senken + Wrapper-Erkennung (Fixpunkt)
  const wrapperZaehler = () => wrappers.size;
  const dateiArgIdx = (info) => 0;

  let veraendert = true;
  let runde = 0;
  const direkt = [];
  while (veraendert && runde < 8) {
    veraendert = false; runde++;
    for (const F of W.dateien.values()) {
      if (!F.ast) continue;
      for (const { node: call, fns } of F.calls) {
        // (a) direkte ns.*-Senke
        const ns = nsAufruf(call);
        if (ns && ns.art === "datei" && !["E", "G", "K", "N"].includes(ns.op)) {
          const argN = ns.op === "M" ? 1 : 0;
          const arg = call.arguments[argN];
          if (!arg) continue;
          // Parameter durchgereicht?  (nur Identifier, sonst abgeleiteter Name)
          if (arg.type === "Identifier") {
            for (let i = fns.length - 1; i >= 0; i--) {
              const idx = ersterNamensparam(fns[i], arg.name);
              if (idx >= 0) {
                const nm = F.fnName.get(fns[i]);
                if (nm) {
                  const key = F.rel + ":" + nm;
                  const op = ns.op === "W" ? schreibModus(call) : ns.op;
                  const wk = key + "#" + idx + "#" + op;
                  if (![...wrappers.keys()].includes(wk)) {
                    wrappers.set(wk, { rel: F.rel, name: nm, idx, op, via: ns.methode, zeile: call.loc.start.line, fnKnoten: fns[i] });
                    veraendert = true;
                  }
                }
                break;
              }
            }
          }
        }
        // (b) Aufruf eines bekannten Wrappers durchreicht seinerseits einen Parameter
        const callee = call.callee;
        let ziel = null;
        if (callee.type === "Identifier") ziel = aufloesen(W, F, callee.name);
        else if (callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier"
                 && callee.property.type === "Identifier") {
          const imp = F.imports.get(callee.object.name);
          if (imp && imp.name === "*") { const G = W.finde(imp.von, F); if (G) ziel = { G, name: callee.property.name }; }
        }
        if (ziel) {
          for (const w of [...wrappers.values()]) {
            if (w.rel !== ziel.G.rel || w.name !== ziel.name) continue;
            const arg = call.arguments[w.idx];
            if (arg && arg.type === "Identifier") {
              for (let i = fns.length - 1; i >= 0; i--) {
                const idx = ersterNamensparam(fns[i], arg.name);
                if (idx >= 0) {
                  const nm = F.fnName.get(fns[i]);
                  if (nm && !(F.rel === w.rel && nm === w.name)) {
                    const wk = F.rel + ":" + nm + "#" + idx + "#" + w.op;
                    if (![...wrappers.keys()].includes(wk)) {
                      wrappers.set(wk, { rel: F.rel, name: nm, idx, op: w.op, via: "wrapper:" + w.name, zeile: call.loc.start.line, fnKnoten: fns[i] });
                      veraendert = true;
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  // --- Pass 2: alle Stellen als Sites erfassen
  const wrapperFns = new Set([...wrappers.values()].map((w) => w.fnKnoten));
  const inWrapper = [];
  const primaer = (ops) => {
    if (ops.has("W") || ops.has("W?")) return "W";
    if (ops.has("A")) return "A";
    if (ops.has("R")) return "R";
    if (ops.has("D")) return "D";
    if (ops.has("M")) return "M";
    if (ops.has("L")) return "L";
    if (ops.has("X")) return "X";
    return [...ops][0];
  };
  for (const F of W.dateien.values()) {
    if (!F.ast) continue;
    for (const { node: call, fns } of F.calls) {
      const params = new Set();
      for (const fn of fns) for (const p of fn.params) { const n = paramName(p); if (n) params.add(n); }
      params.fns = fns;
      const ns = nsAufruf(call);
      if (ns) {
        if (ns.art === "datei") {
          if (["E", "G", "K", "N"].includes(ns.op)) {
            sites.push({ art: "skript", op: ns.op, datei: ev(W, F, call.arguments[0], params).map(norm), rel: F.rel, zeile: call.loc.start.line, via: ns.methode, call, fns });
          } else {
            const argN = (ns.op === "M" || ns.op === "L") ? 1 : 0;
            const arg = call.arguments[argN];
            if (!arg) { if (ns.op === "L") sites.push({ art: "datei", op: "L", ops: ["L"], datei: [Q], rel: F.rel, zeile: call.loc.start.line, via: "direkt:ls", call, fns }); continue; }
            // Senke im Rumpf eines Wrappers: zaehlt ueber die Aufrufer, nicht hier
            if (arg.type === "Identifier") {
              const fn = [...fns].reverse().find((f) => ersterNamensparam(f, arg.name) >= 0);
              if (fn && wrapperFns.has(fn)) { inWrapper.push({ rel: F.rel, zeile: call.loc.start.line, op: ns.op, fn: F.fnName.get(fn) }); continue; }
            }
            let namen;
            if (ns.op === "T" && arg.type === "ArrayExpression") namen = uniq(arg.elements.flatMap((e) => e ? ev(W, F, e, params) : [Q]));
            else if (ns.op === "T" && arg.type === "Identifier") {
              const k = holeKnoten(W, F, arg.name, new Set(), 0, fns, arg.start).map((x) => entpacke(x.n));
              const arr = k.find((x) => x.type === "ArrayExpression");
              namen = arr ? uniq(arr.elements.flatMap((e) => e ? ev(W, F, e, params) : [Q])) : ev(W, F, arg, params);
            } else namen = ev(W, F, arg, params);
            if (ns.op === "L") namen = namen.map((x) => (x === Q ? Q : Q + x + Q));
            const op = ns.op === "W" ? schreibModus(call) : ns.op;
            const hostArg = ns.op === "X" || ns.op === "D" ? call.arguments[1] : (ns.op === "T" ? call.arguments[1] : null);
            sites.push({
              art: "datei", op: op === "W?" ? "W" : op, ops: [op], datei: namen.map(norm), rel: F.rel, zeile: call.loc.start.line,
              via: "direkt:" + ns.methode, host: hostArg ? W_text(F, hostArg) : null,
              quelleHost: ns.op === "T" && call.arguments[2] ? W_text(F, call.arguments[2]) : null, call, fns,
              inhalt: ns.op === "W" ? call.arguments[1] : null,
            });
          }
        } else {
          sites.push({ art: "port", op: ns.op, datei: ev(W, F, call.arguments[0], params).map(String), rel: F.rel, zeile: call.loc.start.line, via: ns.methode, call, fns });
        }
        continue;
      }
      // Wrapper-Aufruf: ein Site je Aufruf, Operationen vereinigt
      const callee = call.callee;
      let ziel = null;
      if (callee.type === "Identifier") ziel = aufloesen(W, F, callee.name);
      else if (callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier"
               && callee.property.type === "Identifier") {
        const imp = F.imports.get(callee.object.name);
        if (imp && imp.name === "*") { const G = W.finde(imp.von, F); if (G) ziel = { G, name: callee.property.name }; }
      }
      if (!ziel) continue;
      const ws = [...wrappers.values()].filter((w) => w.rel === ziel.G.rel && w.name === ziel.name);
      if (!ws.length) continue;
      const idx = ws[0].idx;
      const arg = call.arguments[idx];
      if (!arg) continue;
      // Aufruf IM Rumpf eines Wrappers (Parameter wird durchgereicht): zaehlt ueber dessen Aufrufer
      if (arg.type === "Identifier") {
        const fn = [...fns].reverse().find((f) => ersterNamensparam(f, arg.name) >= 0);
        if (fn && wrapperFns.has(fn)) { inWrapper.push({ rel: F.rel, zeile: call.loc.start.line, op: "via", fn: F.fnName.get(fn) }); continue; }
      }
      const ops = new Set(ws.map((w) => w.op));
      sites.push({
        art: "datei", op: primaer(ops), ops: [...ops], datei: ev(W, F, arg, params).map(norm), rel: F.rel, zeile: call.loc.start.line,
        via: "wrapper:" + ws[0].name, wrapperFn: ws[0].fnKnoten, wrapperF: W.dateien.get(ws[0].rel), call, fns,
        inhalt: (ops.has("W") || ops.has("W?") || ops.has("A")) ? call.arguments[idx + 1] : null,
      });
    }
  }

  return { sites, wrappers: [...wrappers.values()], inWrapper };
}
function W_text(F, n) { return F.code.slice(n.start, n.end).replace(/\s+/g, " ").slice(0, 60); }
function aufloesen(W, F, name) {
  if (F.funcs.has(name)) return { G: F, name };
  const imp = F.imports.get(name);
  if (imp && imp.name !== "*") {
    const G = W.finde(imp.von, F);
    if (G) { const lokal = G.exports.get(imp.name) || imp.name; return { G, name: lokal }; }
  }
  return null;
}
const norm = (s) => (typeof s === "string" ? s.replace(/^\/+/, "") : s);

// ---------------------------------------------------------------------------
// Senken auf der Host-Seite (sync/, tools/): rpc getFile/pushFile und fs.*
// ---------------------------------------------------------------------------
const SPIEL_METHODE = { getFile: "R", pushFile: "W", deleteFile: "D", getFileNames: "L", getFileMetadata: "R" };
const FS_METHODE = {
  readFile: "R", readFileSync: "R", createReadStream: "R", writeFile: "W", writeFileSync: "W", createWriteStream: "W",
  appendFile: "A", appendFileSync: "A", copyFileSync: "W", copyFile: "W", existsSync: "X", statSync: "X", stat: "X",
  rename: "M", renameSync: "M", rm: "D", rmSync: "D", unlink: "D", unlinkSync: "D", watch: "R",
};
function flach(node) {
  if (node.type === "BinaryExpression" && node.operator === "+") return [...flach(node.left), ...flach(node.right)];
  if (node.type === "TemplateLiteral") {
    const out = [];
    node.quasis.forEach((q, i) => { out.push({ type: "Literal", value: q.value.cooked ?? q.value.raw, _q: true }); if (i < node.expressions.length) out.push(node.expressions[i]); });
    return out;
  }
  return [node];
}
const calleeName = (c) => (c.type === "Identifier" ? c.name : (c.type === "MemberExpression" && !c.computed && c.property.type === "Identifier" ? c.property.name : null));

/** Host-Senke eines Knotens oder null: {art:"spiel"|"host", op, fileNode} */
function hostSenke(node, fns = [], F = null) {
  if (node.type === "BinaryExpression" || node.type === "TemplateLiteral") {
    const teile = flach(node);
    let methode = null, fi = -1;
    teile.forEach((t, i) => {
      if (t.type === "Literal" && typeof t.value === "string") {
        const mm = /method=(\w+)/.exec(t.value);
        if (mm) methode = mm[1];
        if (t.value.includes("filename=") && fi < 0) fi = i;
      }
    });
    if (methode && SPIEL_METHODE[methode] && fi >= 0) {
      const tail = teile[fi].value.slice(teile[fi].value.indexOf("filename=") + 9);
      return { art: "spiel", op: SPIEL_METHODE[methode], fileNode: tail ? { type: "Literal", value: tail.split("&")[0] } : (teile[fi + 1] || null) };
    }
    return null;
  }
  const call = node;
  const args = call.arguments;
  const m0 = args[0] && args[0].type === "Literal" && typeof args[0].value === "string" ? args[0].value : null;
  if (m0 && SPIEL_METHODE[m0]) {
    for (const a of args) {
      if (a.type !== "ObjectExpression") continue;
      const p = a.properties.find((q) => q.type === "Property" && keyName(q) === "filename");
      if (p) return { art: "spiel", op: SPIEL_METHODE[m0], fileNode: p.value };
    }
    return { art: "spiel", op: SPIEL_METHODE[m0], fileNode: null };
  }
  for (const a of args) {
    if (a.type !== "ObjectExpression") continue;
    const pm = a.properties.find((q) => q.type === "Property" && keyName(q) === "method" && q.value.type === "Literal");
    if (pm && SPIEL_METHODE[pm.value.value]) {
      const p = a.properties.find((q) => q.type === "Property" && keyName(q) === "filename");
      return { art: "spiel", op: SPIEL_METHODE[pm.value.value], fileNode: p ? p.value : null };
    }
  }
  const n = call.type === "CallExpression" ? calleeName(call.callee) : null;
  // url.searchParams.set("filename", datei) + irgendwo set("method", "getFile") in derselben Funktion
  if (n === "set" && args[0] && args[0].type === "Literal" && args[0].value === "filename" && args[1] && F) {
    const fn = fns[fns.length - 1];
    const text = fn ? F.code.slice(fn.start, fn.end) : F.code;
    const mm = /["']method["']\s*,\s*["'](\w+)["']/.exec(text);
    if (mm && SPIEL_METHODE[mm[1]]) return { art: "spiel", op: SPIEL_METHODE[mm[1]], fileNode: args[1] };
  }
  if (n && FS_METHODE[n] && args[0]) return { art: "host", op: FS_METHODE[n], fileNode: args[0], fsName: n };
  return null;
}

export function analysiereHost(W) {
  const sites = [];
  const wrappers = new Map();
  const inWrapper = [];
  let veraendert = true, runde = 0;
  const wrapperFns = new Set();
  const entwirre = (n) => {
    while (n && n.type === "CallExpression" && n.callee.type === "Identifier"
           && (n.callee.name === "encodeURIComponent" || n.callee.name === "String") && n.arguments[0]) n = n.arguments[0];
    return n;
  };
  const identParam = (arg0, fns) => {
    const arg = entwirre(arg0);
    if (!arg || arg.type !== "Identifier") return null;
    for (let i = fns.length - 1; i >= 0; i--) { const idx = ersterNamensparam(fns[i], arg.name); if (idx >= 0) return { fn: fns[i], idx }; }
    return null;
  };
  while (veraendert && runde < 8) {
    veraendert = false; runde++;
    for (const F of W.dateien.values()) {
      if (!F.ast) continue;
      for (const { node: call, fns } of [...F.calls, ...F.exprs]) {
        const sk = hostSenke(call, fns, F);
        if (sk && sk.fileNode) {
          const ip = identParam(sk.fileNode, fns);
          const nm = ip && F.fnName.get(ip.fn);
          if (ip && nm) {
            const wk = F.rel + ":" + nm + "#" + ip.idx + "#" + sk.op + "#" + sk.art;
            if (!wrappers.has(wk)) { wrappers.set(wk, { rel: F.rel, name: nm, idx: ip.idx, op: sk.op, art: sk.art, fnKnoten: ip.fn }); wrapperFns.add(ip.fn); veraendert = true; }
          }
        }
        const callee = call.callee;
        const ziel = callee && callee.type === "Identifier" ? aufloesen(W, F, callee.name) : null;
        if (ziel) {
          for (const w of [...wrappers.values()]) {
            if (w.rel !== ziel.G.rel || w.name !== ziel.name) continue;
            const ip = identParam(call.arguments[w.idx], fns);
            const nm = ip && F.fnName.get(ip.fn);
            if (ip && nm && !(F.rel === w.rel && nm === w.name)) {
              const wk = F.rel + ":" + nm + "#" + ip.idx + "#" + w.op + "#" + w.art;
              if (!wrappers.has(wk)) { wrappers.set(wk, { rel: F.rel, name: nm, idx: ip.idx, op: w.op, art: w.art, fnKnoten: ip.fn }); wrapperFns.add(ip.fn); veraendert = true; }
            }
          }
        }
      }
    }
  }
  for (const F of W.dateien.values()) {
    if (!F.ast) continue;
    for (const { node: call, fns } of [...F.calls, ...F.exprs]) {
      const params = new Set();
      for (const fn of fns) for (const p of fn.params) { const n = paramName(p); if (n) params.add(n); }
      params.fns = fns;
      const sk = hostSenke(call, fns, F);
      if (sk) {
        if (sk.fileNode) {
          const ip = identParam(sk.fileNode, fns);
          if (ip && wrapperFns.has(ip.fn)) { inWrapper.push({ rel: F.rel, zeile: call.loc.start.line }); continue; }
        }
        sites.push({ art: sk.art, op: sk.op, datei: sk.fileNode ? ev(W, F, sk.fileNode, params).map(norm) : [], rel: F.rel, zeile: call.loc.start.line, via: "direkt:" + (sk.fsName || "rpc"), call, fns });
        continue;
      }
      const callee = call.callee;
      const ziel = callee && callee.type === "Identifier" ? aufloesen(W, F, callee.name) : null;
      if (!ziel) continue;
      const ws = [...wrappers.values()].filter((w) => w.rel === ziel.G.rel && w.name === ziel.name);
      for (const w of ws) {
        const arg = call.arguments[w.idx];
        if (!arg) continue;
        const ip = identParam(arg, fns);
        if (ip && wrapperFns.has(ip.fn)) { inWrapper.push({ rel: F.rel, zeile: call.loc.start.line }); continue; }
        sites.push({ art: w.art, op: w.op, datei: ev(W, F, arg, params).map(norm), rel: F.rel, zeile: call.loc.start.line, via: "wrapper:" + w.name, wrapperFn: w.fnKnoten, wrapperF: W.dateien.get(w.rel), call, fns });
      }
    }
  }
  return { sites, wrappers: [...wrappers.values()], inWrapper };
}

// ---------------------------------------------------------------------------
// Muster-Abgleich zweier Namen (mit {?})
// ---------------------------------------------------------------------------
const reCache = new Map();
function alsRegex(muster) {
  if (reCache.has(muster)) return reCache.get(muster);
  const re = new RegExp("^" + muster.split(Q).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  reCache.set(muster, re);
  return re;
}
function passt(a, b) {
  if (a === b) return true;
  const ua = a.includes(Q), ub = b.includes(Q);
  if (!ua && !ub) return false;
  if (a === Q || b === Q) return false; // vollstaendig unbekannt matcht nichts (sonst alles)
  if (ua && alsRegex(a).test(b)) return true;
  if (ub && alsRegex(b).test(a)) return true;
  return false;
}

export { Welt, ladeDatei, analysiereSpiel, ev, holeKnoten, entpacke, walk, kinder, istFn, paramName, keyName, parse, norm, passt, Q, uniq, nsAufruf, aufloesen };

