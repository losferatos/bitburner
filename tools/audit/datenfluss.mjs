// DATENFLUSS (Audit 03.10.2026, Robustheitspruefung "Fluss")
//
// Frage: Welche Dateien, Felder und Kanaele werden geschrieben, aber nie gelesen
// (toter Kanal wie `truppAnfrage` bis zum 03.10.), und welche werden gelesen,
// aber nie geschrieben (der Leser wartet ewig oder der Standardwert greift still)?
//
// Vorgehen (AST mit acorn, nicht grep) - Motor in datenfluss-lib.mjs:
//   1. SPIEL-SEITE (src/**): jeder ns.write/read/fileExists/rm/scp/mv/ls/exec und
//      jeder Port-Aufruf. Der Dateiname wird als Konstante aufgeloest (const-Tabellen,
//      Vorlagen, Verkettung, for-of ueber Listen, Importe, Funktionen, die eine
//      Zeichenkette zurueckgeben). Funktionen, die einen Parameter bis zu
//      ns.write/ns.read durchreichen (lib/hostdatei.js usw.), werden als WRAPPER
//      erkannt - ihre Aufrufer zaehlen als Schreiber/Leser (Fixpunkt).
//      Nicht aufloesbare Namen stehen als Muster mit {?}.
//   2. HOST-SEITE (sync/**, tools/**, dashboard): rpc getFile/pushFile/deleteFile
//      (Spieldateien) und fs.* (Hostdateien), ebenfalls mit Wrapper-Erkennung.
//   3. STATISCHE SCHREIBER: jede Nicht-.js-Datei in src/ wird von der Bruecke ins Spiel
//      geschoben (graftplan.json, route.json ...) und gilt als Schreiber.
//   4. FELDER (--felder): bei JSON-Schreibern die Schluessel des geschriebenen Objekts,
//      bei Lesern die verfolgten Zugriffe auf das gelesene Objekt.
//   5. SELBSTPROBE (--selbstprobe): ein eingebauter toter Kanal, ein blinder Leser und ein
//      totes Feld muessen gefunden werden, sonst gilt "kein Fund" nicht.
//
// Aufruf:  node tools/audit/datenfluss.mjs [--md <datei>] [--json <datei>] [--src <verz>]
//                                          [--felder] [--selbstprobe] [--skripte] [--kurz]
// src/ wird nur GELESEN.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neuesterStand, homeTextdateien } from "./fluss-save.mjs";
import {
  Welt, analysiereSpiel, analysiereHost, ev, holeKnoten, entpacke, walk, istFn, paramName, keyName,
  parse, norm, passt, Q, uniq, aufloesen,
} from "./datenfluss-lib.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const SRC = path.resolve(opt("--src", path.join(ROOT, "src")));

function sammle(dir, rel = "", filter = () => true) {
  const out = [];
  if (!fs.existsSync(path.join(dir, rel))) return out;
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) { if (e.name === "node_modules") continue; out.push(...sammle(dir, r, filter)); }
    else if (filter(r)) out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------
export function ladeSpiel(srcDir) {
  const W = new Welt(srcDir, "src");
  for (const f of sammle(srcDir, "", (r) => r.endsWith(".js"))) {
    if (f === "NetscriptDefinitions.d.ts") continue;
    W.lade(f, fs.readFileSync(path.join(srcDir, f), "utf8"));
  }
  return W;
}
function ladeHost() {
  const W = new Welt(ROOT, "host");
  const dateien = [
    ...sammle(path.join(ROOT, "sync"), "", (r) => r.endsWith(".js")).map((r) => "sync/" + r),
    ...sammle(path.join(ROOT, "tools"), "", (r) => r.endsWith(".js") && !/(^|\/)test-/.test(r) && !r.startsWith("mock/") && !r.startsWith("audit/")).map((r) => "tools/" + r),
  ];
  for (const f of dateien) W.lade(f, fs.readFileSync(path.join(ROOT, f), "utf8"));
  return W;
}
function ladeTests() {
  const W = new Welt(ROOT, "test");
  const dateien = sammle(path.join(ROOT, "tools"), "", (r) => r.endsWith(".js") && (/(^|\/)test-/.test(r) || r.startsWith("mock/"))).map((r) => "tools/" + r);
  for (const f of dateien) W.lade(f, fs.readFileSync(path.join(ROOT, f), "utf8"));
  return W;
}
function dashboardSkript() {
  const p = path.join(ROOT, "dashboard", "index.html");
  if (!fs.existsSync(p)) return null;
  const html = fs.readFileSync(p, "utf8");
  const teile = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return { html, code: teile.join("\n;\n") };
}

// ---------------------------------------------------------------------------
// Zeilen der Tabelle
// ---------------------------------------------------------------------------
const istCode = (n) => /\.js$/.test(n);
const istProgramm = (n) => /\.exe$/i.test(n);

function baueTabelle(spielSites, hostSites, srcStatisch, registry, testSites) {
  const zeilen = new Map(); // name -> row
  const hole = (name) => {
    if (!zeilen.has(name)) zeilen.set(name, { name, W: [], A: [], R: [], X: [], D: [], T: [], M: [], L: [], testR: [], testW: [] });
    return zeilen.get(name);
  };
  const ordne = (herkunft, s) => {
    for (const n of s.datei) {
      if (n === Q || n === "") continue;
      if (istProgramm(n)) continue;
      const r = hole(n);
      const eintrag = { wo: herkunft, rel: s.rel, zeile: s.zeile, via: s.via, host: s.host || null };
      const op = s.op === "W?" ? "W" : s.op;
      if (r[op]) r[op].push(eintrag);
    }
  };
  for (const s of spielSites) if (s.art === "datei") ordne("src", s);
  for (const s of hostSites) if (s.art === "spiel" && s.datei) ordne(s.rel.startsWith("sync/") ? "sync" : "tools", s);
  for (const s of testSites) if (s.art === "spiel" && s.datei) for (const n of s.datei) { if (n === Q) continue; const r = hole(n); (s.op === "W" ? r.testW : r.testR).push({ rel: s.rel, zeile: s.zeile }); }
  for (const f of srcStatisch) hole(f).W.push({ wo: "bruecke", rel: "src/" + f, zeile: 0, via: "pushFile (statisch)" });
  // Registry: telemetryFile wird von guard.js/bn4net.js gelesen; Vorbedingungen von lib/reg.js
  for (const e of registry.eintraege) {
    if (e.telemetryFile) hole(e.telemetryFile).R.push({ wo: "registry", rel: "registry.json", zeile: 0, via: "telemetryFile von " + e.name + " (guard.js:417, bn4net.js:5112)" });
    const p = e.precondition || {};
    if (p.requiresFile) hole(p.requiresFile).X.push({ wo: "registry", rel: "registry.json", zeile: 0, via: "requiresFile von " + e.name + " (lib/reg.js:171)" });
    if (p.forbidsFile) hole(p.forbidsFile).X.push({ wo: "registry", rel: "registry.json", zeile: 0, via: "forbidsFile von " + e.name + " (lib/reg.js:174)" });
  }
  return zeilen;
}

/** Alle Zeilen, deren Name zu `name` passt (gleich oder Muster), ohne `name` selbst. */
function verwandte(zeilen, name) {
  const out = [];
  for (const [n, r] of zeilen) { if (n !== name && passt(n, name)) out.push(r); }
  return out;
}

const zaehle = (a) => a.length;

export function bewerte(zeilen) {
  // Muster-Zeilen ({?}) werden auf konkrete Zeilen verteilt, damit "gelesen" nicht verlorengeht.
  const ergebnis = [];
  for (const [name, r] of zeilen) {
    const eff = { W: [...r.W], A: [...r.A], R: [...r.R], X: [...r.X], D: [...r.D], T: [...r.T], M: [...r.M], L: [...r.L], testR: [...r.testR], testW: [...r.testW] };
    for (const v of verwandte(zeilen, name)) {
      for (const k of ["W", "A", "R", "X", "D", "T", "M", "testR", "testW"]) for (const e of v[k]) eff[k].push({ ...e, ueber: v.name });
    }
    const schreiber = eff.W.length + eff.A.length;
    const leser = eff.R.length + eff.X.length;
    let klasse = "ok";
    if (schreiber && !leser) klasse = "NUR_GESCHRIEBEN";
    else if (leser && !schreiber) klasse = "NUR_GELESEN";
    else if (!schreiber && !leser) klasse = "NUR_ANDERES";
    ergebnis.push({ name, eff, eigen: r, schreiber, leser, klasse, muster: name.includes(Q) });
  }
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Wirtepruefung: Lesen/Schreiben auf einem Wirt, der nicht home ist
// ---------------------------------------------------------------------------
// ns.read liest IMMER lokal (NetscriptFunctions.ts:1120-1122), ns.write schreibt lokal. Ein Werkzeug mit
// hostRule werkbank/any laeuft nicht zwingend auf home. Direkt gelesene Dateien anderer Schreiber muessen
// vorher mit ns.scp geholt werden (oder ueber lib/hostdatei.js), direkt geschriebene Dateien mit Lesern
// anderswo muessen nach home kopiert werden.
function wirtepruefung(sp, registry, bew, starterKlasse) {
  const hostRule = new Map(registry.eintraege.map((e) => [e.name, e.hostRule]));
  const zeileVon = new Map(bew.map((b) => [b.name, b]));
  const out = [];
  const skripte = new Set(sp.sites.map((x) => x.rel).filter((r) => !r.startsWith("lib/") && !r.startsWith("worker/")));
  for (const S of skripte) {
    const regel = hostRule.get(S);
    const klasse = starterKlasse[S];
    if (regel === "home") continue;
    if (!["LIVE", "LISTE"].includes(klasse)) continue;
    const meine = sp.sites.filter((x) => x.rel === S && x.art === "datei");
    const kopien = meine.filter((x) => x.op === "T");
    const holtVonHome = (name) => kopien.some((k) => k.datei.some((d) => d === name || passt(d, name)) && /home/.test(k.quelleHost || "") )
      || meine.some((x) => x.via.startsWith("wrapper") && x.ops && x.ops.includes("T") && x.op === "R" && x.datei.some((d) => d === name || passt(d, name)));
    const bringtNachHome = (name) => kopien.some((k) => k.datei.some((d) => d === name || passt(d, name)) && /home/.test(k.host || "") && !/home/.test(k.quelleHost || "x"));
    const selbstGeschrieben = new Set(meine.filter((x) => ["W", "A"].includes(x.op)).flatMap((x) => x.datei));
    for (const x of meine) {
      if (!["R", "X"].includes(x.op) || !x.via.startsWith("direkt")) continue;
      for (const n of x.datei) {
        if (n.includes(Q) || istCode(n) || !n.startsWith("data/")) continue;
        const b = zeileVon.get(n);
        if (!b) continue;
        const fremdeSchreiber = [...b.eff.W, ...b.eff.A].filter((w) => w.rel !== S);
        if (!fremdeSchreiber.length) continue;
        if (x.op === "X" && /home/.test(x.host || "")) {
          // fileExists(.., "home") ist korrekt, solange danach per scp geholt oder per liesVonHome gelesen wird
          if (holtVonHome(n)) continue;
          out.push({ art: "X-home-ohne-Holen", skript: S, regel: regel || "(nicht in Registry)", rel: x.rel, zeile: x.zeile, datei: n, schreiber: fremdeSchreiber.slice(0, 3).map(fm) });
          continue;
        }
        if (selbstGeschrieben.has(n)) continue;
        if (holtVonHome(n)) continue;
        out.push({ art: "R-lokal-ohne-Holen", skript: S, regel: regel || "(nicht in Registry)", rel: x.rel, zeile: x.zeile, datei: n, schreiber: fremdeSchreiber.slice(0, 3).map(fm) });
      }
    }
    for (const x of meine) {
      if (!["W", "A"].includes(x.op) || !x.via.startsWith("direkt")) continue;
      for (const n of x.datei) {
        if (n.includes(Q) || istCode(n) || !n.startsWith("data/")) continue;
        const b = zeileVon.get(n);
        if (!b) continue;
        const fremdeLeser = [...b.eff.R, ...b.eff.X].filter((r) => r.rel !== S && r.wo !== "registry");
        if (!fremdeLeser.length) continue;
        if (bringtNachHome(n)) continue;
        out.push({ art: "W-lokal-ohne-Heimkopie", skript: S, regel: regel || "(nicht in Registry)", rel: x.rel, zeile: x.zeile, datei: n, leser: fremdeLeser.slice(0, 3).map(fm) });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Argumentvertrag: ns.exec/run/spawn(script, ...args)  gegen  ns.args / ns.flags im Zielskript
// ---------------------------------------------------------------------------
function argumentVertrag(sp, WS, srcAlle) {
  const bekannt = new Set(srcAlle.filter((f) => f.endsWith(".js")));
  // Was das Zielskript von seinen Argumenten erwartet
  const erwartung = new Map();
  for (const F of WS.dateien.values()) {
    if (!F.ast) continue;
    const e = { maxIdx: -1, flags: false, flagsSchema: null, ganz: false, destruct: 0 };
    walk(F.ast, (n, anc) => {
      // ns.args[k]
      if (n.type === "MemberExpression" && n.object.type === "MemberExpression" && n.object.object.type === "Identifier" && n.object.object.name === "ns"
          && !n.object.computed && n.object.property.name === "args") {
        if (n.computed && n.property.type === "Literal") e.maxIdx = Math.max(e.maxIdx, Number(n.property.value));
        else e.ganz = true;
      } else if (n.type === "MemberExpression" && n.object.type === "Identifier" && n.object.name === "ns" && !n.computed && n.property.name === "args") {
        const p = anc[anc.length - 1];
        if (p && p.type === "MemberExpression" && p.object === n) { /* ns.args[k] oben behandelt; ns.args.length u. a. */ if (!(p.computed)) e.ganz = true; }
        else if (p && p.type === "VariableDeclarator" && p.init === n && p.id.type === "ArrayPattern") { e.destruct = Math.max(e.destruct, p.id.elements.length); e.maxIdx = Math.max(e.maxIdx, p.id.elements.length - 1); }
        else e.ganz = true;
      }
      if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.type === "Identifier" && n.callee.object.name === "ns"
          && n.callee.property.name === "flags") {
        e.flags = true;
        const a = n.arguments[0];
        if (a && a.type === "ArrayExpression") e.flagsSchema = a.elements.map((x) => (x && x.type === "ArrayExpression" && x.elements[0] && x.elements[0].type === "Literal") ? String(x.elements[0].value) : "?");
      }
    });
    erwartung.set(F.rel, e);
  }
  const ausgabe = [];
  for (const x of sp.sites) {
    if (x.art !== "skript" || x.op !== "E") continue;
    for (const s of x.datei) {
      if (!bekannt.has(s)) continue;
      const call = x.call;
      const m = x.via;
      const start = m === "exec" ? 3 : 2; // exec(script, host, threads, ...args) / run, spawn (script, threads, ...args)
      const args = call.arguments.slice(start);
      const spread = args.some((a) => a.type === "SpreadElement");
      const e = erwartung.get(s);
      const art = e.flags ? "flags" : (e.ganz ? "variabel" : (e.maxIdx >= 0 ? "positionell" : "keine"));
      let urteil = "ok";
      if (!spread && !e.flags && !e.ganz) {
        if (args.length < e.maxIdx + 1) urteil = "ZU WENIG (" + args.length + " statt >= " + (e.maxIdx + 1) + ")";
        else if (args.length > e.maxIdx + 1) urteil = "ZU VIEL (" + args.length + " statt " + (e.maxIdx + 1) + ", Rest wird ignoriert)";
      }
      if (e.flags && !spread) {
        const texte = args.filter((a) => a.type === "Literal" && typeof a.value === "string" && a.value.startsWith("--")).map((a) => a.value.slice(2));
        const bad = texte.filter((t) => e.flagsSchema && !e.flagsSchema.includes(t));
        if (bad.length) urteil = "UNBEKANNTES FLAG " + bad.join(",");
      }
      ausgabe.push({ aufrufer: x.rel + ":" + x.zeile, ziel: s, methode: m, uebergeben: spread ? "..." : args.length, erwartet: art + (e.maxIdx >= 0 ? " max[" + e.maxIdx + "]" : "") + (e.flagsSchema ? " flags(" + e.flagsSchema.join(",") + ")" : ""), urteil });
    }
  }
  return ausgabe;
}

// ---------------------------------------------------------------------------
// Skripte: wer startet wen
// ---------------------------------------------------------------------------
function skriptBezuege(Ws, srcDateien, registry) {
  const bekannt = new Set(srcDateien.filter((f) => f.endsWith(".js")));
  const refs = new Map(); // skript -> [{rel, zeile, art}]
  for (const f of bekannt) refs.set(f, []);
  const alle = [];
  for (const W of Ws) for (const F of W.dateien.values()) alle.push(F);
  for (const F of alle) {
    if (!F.ast) continue;
    const istHost = F.rel.startsWith("tools/") || F.rel.startsWith("sync/");
    walk(F.ast, (n, anc) => {
      if (n.type !== "Literal" || typeof n.value !== "string") return;
      const p = anc[anc.length - 1];
      if (p && (p.type === "ImportDeclaration" || p.type === "ExportAllDeclaration" || p.type === "ExportNamedDeclaration")) return;
      const v = n.value.replace(/^\/+/, "");
      if (!bekannt.has(v)) return;
      if (v === F.rel) return;
      let art = istHost ? "tools" : "andere";
      if (istHost) { refs.get(v).push({ rel: F.rel, zeile: n.loc.start.line, art }); return; }
      const call = [...anc].reverse().find((a) => a.type === "CallExpression");
      if (call && call.callee.type === "MemberExpression" && call.callee.object.type === "Identifier" && call.callee.object.name === "ns") {
        const m = call.callee.property.name;
        if (["exec", "run", "spawn"].includes(m)) art = "START";
        else if (m === "scp") art = "kopie";
        else if (["fileExists", "read", "write", "rm"].includes(m)) art = "datei";
        else if (["getScriptRam", "scriptRunning", "isRunning", "kill", "scriptKill"].includes(m)) art = "abfrage";
        else art = "andere-ns";
      } else if (anc.some((a) => a.type === "ArrayExpression")) art = "liste";
      else if (anc.some((a) => a.type === "BinaryExpression")) art = "vergleich";
      refs.get(v).push({ rel: F.rel, zeile: n.loc.start.line, art });
    });
  }
  for (const e of registry.eintraege) if (refs.has(e.name)) refs.get(e.name).push({ rel: "registry.json", zeile: 0, art: "REGISTRY" });
  return refs;
}

// ---------------------------------------------------------------------------
// Felder
// ---------------------------------------------------------------------------
function elternKarte(F) {
  if (F._eltern) return F._eltern;
  const m = new Map();
  walk(F.ast, (n, anc) => { m.set(n, anc[anc.length - 1] || null); });
  F._eltern = m;
  return m;
}

/** Schluessel eines Objektausdrucks (punktiert bis Tiefe 2). Rueckgabe {keys:Set, ungenau:Set} */
function objektSchluessel(W, F, node, tiefe = 0, besucht = new Set()) {
  const keys = new Set(), ungenau = new Set();
  if (!node) { ungenau.add("(kein Ausdruck)"); return { keys, ungenau }; }
  node = entpacke(node);
  if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.object.name === "JSON"
      && node.callee.property.name === "stringify") return objektSchluessel(W, F, node.arguments[0], tiefe, besucht);
  if (node.type === "Identifier") {
    const key = F.rel + ":" + node.name;
    if (besucht.has(key)) return { keys, ungenau };
    besucht.add(key);
    const kn = holeKnoten(W, F, node.name, new Set(), 0);
    let gefunden = false;
    for (const { F: F2, n } of kn) {
      const e = entpacke(n);
      if (e.type === "ObjectExpression") {
        gefunden = true;
        const r = objektSchluessel(W, F2, e, tiefe, besucht);
        r.keys.forEach((k) => keys.add(k)); r.ungenau.forEach((k) => ungenau.add(k));
      } else if (e.type === "Identifier" || e.type === "CallExpression" || e.type === "ConditionalExpression" || e.type === "LogicalExpression") {
        const r = objektSchluessel(W, F2, e.type === "ConditionalExpression" ? e.consequent : e, tiefe, besucht);
        if (r.keys.size) { gefunden = true; r.keys.forEach((k) => keys.add(k)); }
        r.ungenau.forEach((k) => ungenau.add(k));
      }
    }
    // spaeter gesetzte Felder  name.feld = ...  /  name["feld"] = ...  /  Object.assign(name, {...})
    walk(F.ast, (n) => {
      if (n.type === "AssignmentExpression" && n.left.type === "MemberExpression" && n.left.object.type === "Identifier" && n.left.object.name === node.name) {
        if (!n.left.computed && n.left.property.type === "Identifier") { keys.add(n.left.property.name); gefunden = true; }
        else if (n.left.computed && n.left.property.type === "Literal") { keys.add(String(n.left.property.value)); gefunden = true; }
        else ungenau.add(node.name + "[dyn]");
      }
      if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.name === "Object" && n.callee.property.name === "assign"
          && n.arguments[0] && n.arguments[0].type === "Identifier" && n.arguments[0].name === node.name) {
        for (const a of n.arguments.slice(1)) { const r = objektSchluessel(W, F, a, tiefe, besucht); r.keys.forEach((k) => keys.add(k)); r.ungenau.forEach((k) => ungenau.add(k)); gefunden = true; }
      }
    });
    if (!gefunden) ungenau.add("(" + node.name + " nicht aufloesbar)");
    return { keys, ungenau };
  }
  if (node.type === "ObjectExpression") {
    for (const p of node.properties) {
      if (p.type === "SpreadElement") {
        const r = objektSchluessel(W, F, p.argument, tiefe, besucht);
        r.keys.forEach((k) => keys.add(k)); r.ungenau.forEach((k) => ungenau.add(k));
        if (!r.keys.size) ungenau.add("...spread");
        continue;
      }
      const k = keyName(p);
      if (!k) { ungenau.add("[berechneter Schluessel]"); continue; }
      keys.add(k);
      if (tiefe < 1) {
        const v = entpacke(p.value);
        if (v.type === "ObjectExpression") {
          const r = objektSchluessel(W, F, v, tiefe + 1, besucht);
          r.keys.forEach((x) => keys.add(k + "." + x)); r.ungenau.forEach((x) => ungenau.add(k + "." + x));
        }
      }
    }
    return { keys, ungenau };
  }
  if (node.type === "ConditionalExpression") {
    const a = objektSchluessel(W, F, node.consequent, tiefe, besucht), b = objektSchluessel(W, F, node.alternate, tiefe, besucht);
    for (const k of [...a.keys, ...b.keys]) keys.add(k);
    for (const k of [...a.ungenau, ...b.ungenau]) ungenau.add(k);
    return { keys, ungenau };
  }
  if (node.type === "LogicalExpression") {
    const a = objektSchluessel(W, F, node.left, tiefe, besucht), b = objektSchluessel(W, F, node.right, tiefe, besucht);
    for (const k of [...a.keys, ...b.keys]) keys.add(k);
    for (const k of [...a.ungenau, ...b.ungenau]) ungenau.add(k);
    return { keys, ungenau };
  }
  if (node.type === "ArrayExpression") { ungenau.add("(Liste)"); return { keys, ungenau }; }
  if (node.type === "Literal" || node.type === "TemplateLiteral" || node.type === "BinaryExpression") { ungenau.add("(Text)"); return { keys, ungenau }; }
  if (node.type === "CallExpression") {
    // lokale Funktion, die ein Objekt zurueckgibt
    const c = node.callee;
    if (c.type === "Identifier") {
      const z = aufloesen(W, F, c.name);
      const fn = z && z.G.funcs.get(z.name);
      if (fn) {
        const rets = [];
        if (fn.body.type !== "BlockStatement") rets.push(fn.body);
        else walk(fn.body, (n, anc) => { if (n.type === "ReturnStatement" && n.argument && !anc.some(istFn)) rets.push(n.argument); });
        let any = false;
        for (const r of rets) { const res = objektSchluessel(W, z.G, r, tiefe, besucht); res.keys.forEach((k) => keys.add(k)); res.ungenau.forEach((k) => { if (!/spread|nicht aufloesbar/.test(k)) ungenau.add(k); }); any = any || res.keys.size > 0; }
        // Objektargumente fliessen (per Spread) in das Ergebnis: obere Schranke = Vereinigung
        for (const a of node.arguments) {
          if (a.type === "ObjectExpression" || a.type === "Identifier") {
            const res = objektSchluessel(W, F, a, tiefe, besucht);
            res.keys.forEach((k) => keys.add(k)); res.ungenau.forEach((k) => ungenau.add(k));
            any = any || res.keys.size > 0;
          }
        }
        if (!any) ungenau.add("(Funktion " + c.name + " ohne Objektliteral)");
        return { keys, ungenau };
      }
    }
    ungenau.add("(Aufruf)");
    return { keys, ungenau };
  }
  ungenau.add("(" + node.type + ")");
  return { keys, ungenau };
}

function istJsonParse(n) {
  return n && n.type === "CallExpression" && n.callee.type === "MemberExpression" && n.callee.object.type === "Identifier"
    && n.callee.object.name === "JSON" && n.callee.property.name === "parse";
}

/**
 * Welche Felder liest der Code am Ergebnis dieser Lese-Stelle?
 *
 * Verfolgt wird der Wert vom Lesen (ns.read / rpc getFile / Wrapper) ueber JSON.parse in eine
 * Variable, von dort ueber Zugriffe (v.feld, v["feld"], Destrukturierung), in aufgeloeste lokale
 * Funktionen hinein (Parameter), bei "return" zu den Aufrufern der Funktion. Alles, was nicht
 * verfolgbar ist (Methodenaufruf auf fremdem Objekt, Spread, Object.keys ...), setzt "ganz"
 * (das Objekt wird als Ganzes verbraucht) bzw. "untracked".
 */
function leserFelder(F, site, W = null) {
  const res = { keys: new Set(), bare: new Set(), ganz: false, untracked: false, roh: false, gedeckt: false, grund: "", rohLeser: new Set() };
  // Wrapper, die selbst JSON.parse / .json() aufrufen, liefern schon ein Objekt
  let json = false;
  if (site.wrapperFn && site.wrapperF) {
    walk(site.wrapperFn, (n) => {
      if (istJsonParse(n)) json = true;
      if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed && n.callee.property.name === "json") json = true;
      // Wrapper, der einen anderen JSON-Wrapper aufruft (liesJson -> lies ist roh; spielJson -> spieldatei roh)
    });
  }
  nutzung(W, F, site.call, res, 0, true, json);
  return res;
}

const METHODEN = new Set(["length", "toFixed", "startsWith", "endsWith", "includes", "filter", "map", "push", "shift", "unshift", "pop", "slice", "splice", "join", "split",
  "find", "findIndex", "some", "every", "reduce", "forEach", "sort", "trim", "replace", "indexOf", "lastIndexOf", "concat", "toString", "match", "padStart", "padEnd",
  "toLocaleString", "flat", "flatMap", "at", "keys", "values", "entries", "hasOwnProperty", "toISOString", "toUpperCase", "toLowerCase", "reverse", "fill", "localeCompare"]);
function schluesselName(q) {
  if (!q.computed && q.property.type === "Identifier") return q.property.name;
  if (q.computed && q.property.type === "Literal") return String(q.property.value);
  return null;
}

/** Wert startNode (roh oder geparst) wird wie benutzt? Ergebnisse in res. */
function nutzung(W, F, startNode, res, tiefe, roh0, json0 = false) {
  const eltern = elternKarte(F);
  let cur = startNode;
  let json = json0;
  for (let i = 0; i < 12; i++) {
    const p = eltern.get(cur);
    if (!p) break;
    if (p.type === "AwaitExpression" || p.type === "ChainExpression" || p.type === "ParenthesizedExpression") { cur = p; continue; }
    if (p.type === "LogicalExpression" && (p.operator === "||" || p.operator === "??") && p.left === cur) { cur = p; continue; }
    if (p.type === "ConditionalExpression" && (p.consequent === cur || p.alternate === cur)) { cur = p; continue; }
    if (istJsonParse(p) && p.arguments[0] === cur) { cur = p; json = true; continue; }
    if (p.type === "MemberExpression" && p.object === cur && !p.computed && ["trim", "toString"].includes(p.property.name)) {
      const c = eltern.get(p); if (c && c.type === "CallExpression" && c.callee === p) { cur = c; continue; }
    }
    break;
  }
  const p = eltern.get(cur);
  if (!p) { res.untracked = true; res.grund = "kein Ziel"; return; }
  const scopeVon = (n) => { let x = eltern.get(n); while (x && !istFn(x)) x = eltern.get(x); return x || F.ast; };
  if (p.type === "VariableDeclarator" && p.init === cur) {
    if (p.id.type === "Identifier") verfolge(W, F, p.id.name, scopeVon(p), json, res, tiefe);
    else if (p.id.type === "ObjectPattern") {
      for (const pr of p.id.properties) { if (pr.type === "RestElement") res.ganz = true; else { const k = keyName(pr); if (k) { res.keys.add(k); res.bare.add(k); } } }
    } else { res.untracked = true; res.grund = "Muster " + p.id.type; }
  } else if (p.type === "AssignmentExpression" && p.right === cur && p.left.type === "Identifier") {
    verfolge(W, F, p.left.name, scopeVon(p), json, res, tiefe);
  } else if (p.type === "AssignmentExpression" && p.right === cur && p.left.type === "MemberExpression") {
    res.untracked = true; res.grund = "in Objektfeld abgelegt";
  } else if (p.type === "MemberExpression" && p.object === cur) {
    const k = schluesselName(p);
    if (k) { res.keys.add(k); res.bare.add(k); } else res.ganz = true;
  } else if (p.type === "ReturnStatement" || (p.type === "ArrowFunctionExpression" && p.body === cur)) {
    folgeRueckgabe(W, F, p, json, res, tiefe);
  } else if (p.type === "CallExpression" || p.type === "NewExpression") {
    folgeArgument(W, F, p, cur, json, res, tiefe);
  } else if (p.type === "ExpressionStatement") {
    res.gedeckt = true; res.grund = "Ergebnis verworfen";
  } else if (p.type === "ObjectExpression" || p.type === "Property" || p.type === "ArrayExpression" || p.type === "SpreadElement") {
    res.untracked = true; res.grund = "in Struktur eingebettet";
  } else if (p.type === "BinaryExpression" || p.type === "TemplateLiteral") {
    res.roh = true; res.rohLeser.add(F.rel + ":" + (p.loc ? p.loc.start.line : 0));
  } else { res.untracked = true; res.grund = p.type; }
}

function folgeRueckgabe(W, F, p, json, res, tiefe) {
  const eltern = elternKarte(F);
  let fn = eltern.get(p);
  if (p.type === "ArrowFunctionExpression") fn = p;
  else while (fn && !istFn(fn)) fn = eltern.get(fn);
  const nm = fn && F.fnName.get(fn);
  if (!fn || !nm || !W || tiefe > 3) { res.untracked = true; res.grund = "zurueckgegeben (Funktion " + (nm || "anonym") + ")"; return; }
  let gefunden = 0;
  for (const G of W.dateien.values()) {
    if (!G.ast) continue;
    for (const { node: call } of G.calls) {
      if (call.callee.type !== "Identifier") continue;
      const z = aufloesen(W, G, call.callee.name);
      if (!z || z.G !== F || z.name !== nm) continue;
      gefunden++;
      nutzung(W, G, call, res, tiefe + 1, false);
    }
  }
  if (!gefunden) { res.untracked = true; res.grund = "Rueckgabe ohne Aufrufer (" + nm + ")"; }
}

function folgeArgument(W, F, call, argNode, json, res, tiefe) {
  const idx = call.arguments.indexOf(argNode);
  const c = call.callee;
  // Standardfunktionen, die das Objekt als Ganzes verbrauchen oder nichts lesen
  if (c && c.type === "MemberExpression" && c.object.type === "Identifier") {
    const o = c.object.name, m = c.property.name;
    if (o === "JSON" && m === "stringify") { res.ganz = true; return; }
    if (o === "Object" && ["keys", "entries", "values", "assign"].includes(m)) { res.ganz = true; return; }
    if (o === "Array" && m === "isArray") return;
    if (o === "Number" || o === "String") return;
  }
  if (c && c.type === "Identifier" && ["Number", "String", "Boolean", "parseInt", "parseFloat", "isFinite", "isNaN"].includes(c.name)) return;
  if (c && c.type === "Identifier" && W && tiefe <= 3) {
    const z = aufloesen(W, F, c.name);
    const fn = z && z.G.funcs.get(z.name);
    if (fn && idx >= 0) {
      const pn = paramName(fn.params[idx]);
      if (pn) { verfolge(W, z.G, pn, fn, json, res, tiefe + 1); return; }
      const pat = fn.params[idx];
      if (pat && pat.type === "ObjectPattern") { for (const pr of pat.properties) { if (pr.type === "RestElement") res.ganz = true; else { const k = keyName(pr); if (k) { res.keys.add(k); res.bare.add(k); } } } return; }
    }
  }
  if (json) res.ganz = true; else res.roh = true;
  res.grund = "an " + (c && c.type === "Identifier" ? c.name : "Aufruf") + " weitergereicht";
}

function verfolge(W, F, varName, scope, istJson, res, tiefe) {
  if (tiefe > 4) { res.untracked = true; res.grund = "Tiefe"; return; }
  walk(scope, (n, anc) => {
    if (n.type !== "Identifier" || n.name !== varName) return;
    const q = anc[anc.length - 1];
    if (!q) return;
    if (q.type === "VariableDeclarator" && q.id === n) return;
    if (q.type === "Property" && q.key === n && !q.computed && !q.shorthand) return;
    if (q.type === "MemberExpression" && q.property === n && !q.computed) return;
    if (q.type === "FunctionDeclaration" || (istFn(q) && q.params.includes(n))) return;
    if (q.type === "MemberExpression" && q.object === n) {
      if (!istJson) { res.roh = true; res.rohLeser.add(F.rel + ":" + n.loc.start.line); return; }
      const key = schluesselName(q);
      if (key === null) { res.ganz = true; return; }
      const g = anc[anc.length - 2];
      // Methoden/Eigenschaften von Feldern, Listen und Zeichenketten sind keine Datenfelder
      if (METHODEN.has(key)) { if (key !== "length") res.ganz = true; return; }
      res.keys.add(key);
      if (g && g.type === "MemberExpression" && g.object === q) {
        const k2 = schluesselName(g);
        if (k2 !== null && !METHODEN.has(k2)) res.keys.add(key + "." + k2); else res.bare.add(key);
      } else if (g && g.type === "CallExpression" && g.callee === q) { res.ganz = true; }
      else res.bare.add(key);
      return;
    }
    if (q.type === "VariableDeclarator" && q.init === n && q.id.type === "ObjectPattern") {
      for (const pr of q.id.properties) { if (pr.type === "RestElement") res.ganz = true; else { const k = keyName(pr); if (k) { res.keys.add(k); res.bare.add(k); } } }
      return;
    }
    if (q.type === "VariableDeclarator" && q.init === n && q.id.type === "Identifier") { verfolge(W, F, q.id.name, scope, istJson, res, tiefe + 1); return; }
    if (q.type === "CallExpression" && istJsonParse(q) && q.arguments[0] === n) { nutzung(W, F, q, res, tiefe + 1, false); return; }
    if (q.type === "CallExpression" || q.type === "NewExpression") {
      if (q.callee === n) return;
      folgeArgument(W, F, q, n, istJson, res, tiefe); return;
    }
    if (q.type === "ReturnStatement") { folgeRueckgabe(W, F, q, istJson, res, tiefe); return; }
    if (q.type === "ForOfStatement" || q.type === "ForInStatement") { res.ganz = true; return; }
    if (q.type === "BinaryExpression" || q.type === "LogicalExpression" || q.type === "UnaryExpression" || q.type === "IfStatement"
        || q.type === "ConditionalExpression" || q.type === "TemplateLiteral" || q.type === "AwaitExpression") {
      if (!istJson) { res.roh = true; res.rohLeser.add(F.rel + ":" + n.loc.start.line); }
      return;
    }
    if (q.type === "SpreadElement" || q.type === "Property" || q.type === "ObjectExpression" || q.type === "ArrayExpression") {
      if (istJson) res.ganz = true;
      return;
    }
    if (istJson) res.ganz = true; else res.roh = true;
  });
}

/** Alle Namen von Eigenschaftszugriffen/Schluesseln in einem Teilbaum (grobe Rueckfallebene). */
function tokenMenge(node) {
  const s = new Set();
  walk(node, (n) => {
    if (n.type === "MemberExpression") {
      if (!n.computed && n.property.type === "Identifier") s.add(n.property.name);
      else if (n.computed && n.property.type === "Literal") s.add(String(n.property.value));
    } else if (n.type === "Property" && !n.computed) {
      const k = keyName(n); if (k) s.add(k);
    }
  });
  return s;
}

// ---------------------------------------------------------------------------
// Hauptprogramm
// ---------------------------------------------------------------------------
export async function hauptprogramm() {
  const registry = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
  const WS = ladeSpiel(SRC);
  const WH = ladeHost();
  const WT = ladeTests();
  const srcAlle = sammle(SRC);
  const srcStatisch = srcAlle.filter((f) => !f.endsWith(".d.ts"));
  const sp = analysiereSpiel(WS);
  const ho = analysiereHost(WH);
  const te = analysiereHost(WT);

  const zeilen = baueTabelle(sp.sites, ho.sites, srcStatisch, registry, te.sites);
  const bew = bewerte(zeilen);

  const out = { stand: new Date().toISOString(), srcDateien: WS.dateien.size, hostDateien: WH.dateien.size, wrapper: sp.wrappers.length, sites: sp.sites.length, hostSites: ho.sites.length };
  out.zeilen = bew.map((b) => ({
    name: b.name, klasse: b.klasse, muster: b.muster,
    W: b.eff.W.map(fm), A: b.eff.A.map(fm), R: b.eff.R.map(fm), X: b.eff.X.map(fm), D: b.eff.D.map(fm), T: b.eff.T.length, M: b.eff.M.map(fm), testR: b.eff.testR.length,
  }));
  out.unaufgeloest = sp.sites.filter((s) => s.art === "datei" && !["T", "X"].includes(s.op) && s.datei.some((d) => d.includes(Q))).map((s) => ({ rel: s.rel, zeile: s.zeile, op: s.op, datei: s.datei, via: s.via }));
  out.unaufgeloestHost = ho.sites.filter((s) => s.art === "spiel" && s.datei.some((d) => d.includes(Q))).map((s) => ({ rel: s.rel, zeile: s.zeile, op: s.op, datei: s.datei, via: s.via }));
  out.wrapperListe = sp.wrappers.map((w) => ({ rel: w.rel, name: w.name, idx: w.idx, op: w.op }));
  out.hostWrapper = ho.wrappers.map((w) => ({ rel: w.rel, name: w.name, idx: w.idx, op: w.op, art: w.art }));
  const ht = hostTabelle(ho);
  // Host-Dateien liegen nicht nur unter data/: Planungsdokumente stehen in nodes/ (auch tiefer), Anleitungen in
  // doku/, Sicherungen unter backups/. Vorhanden = der Basisname existiert in einem dieser Orte.
  const hostOrte = ["data", "nodes", "doku", "backups", "."].filter((d) => fs.existsSync(path.join(ROOT, d)));
  const hostNamen = new Set();
  const sammleNamen = (dir, tiefe) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (tiefe > 0 && !["node_modules", "archiv", "reference"].includes(e.name)) sammleNamen(path.join(dir, e.name), tiefe - 1); }
      else hostNamen.add(e.name);
    }
  };
  for (const d of hostOrte) sammleNamen(path.join(ROOT, d), d === "." ? 0 : 3);
  out.hostDateien2 = [...ht.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, r]) => ({
    name, W: [...new Set(r.W)].slice(0, 4), R: [...new Set(r.R)].slice(0, 4), D: r.D.slice(0, 2),
    vorhanden: name.includes(Q) ? null : hostNamen.has(name),
  }));
  out.ports = sp.sites.filter((s) => s.art === "port").map((s) => ({ rel: s.rel, zeile: s.zeile, op: s.op, datei: s.datei }));

  const refs = skriptBezuege([WS, WH], srcAlle, registry);
  out.skripte = [...refs.entries()].map(([name, r]) => ({ name, refs: r }));
  // Starter-Klasse je Skript: LIVE (START/REGISTRY/Liste in src), HOST (nur tools/sync), KEINER
  const starter = (name) => {
    const r = refs.get(name) || [];
    if (r.some((x) => ["START", "REGISTRY"].includes(x.art))) return "LIVE";
    if (r.some((x) => x.art === "liste")) return "LISTE";
    if (r.some((x) => x.art === "tools")) return "HOST";
    if (r.length) return "ERWAEHNT";
    return "KEINER";
  };
  out.starterKlasse = Object.fromEntries([...refs.keys()].map((k) => [k, starter(k)]));
  out.live = liveMenge(refs, registry);
  out.wirte = wirtepruefung(sp, registry, bew, out.starterKlasse);
  out.argumente = argumentVertrag(sp, WS, srcAlle);
  for (const z of out.zeilen) {
    const schr = new Set([...z.W, ...z.A].map((e) => e.split(":")[0]));
    z.schreiberStarter = [...schr].map((rel) => rel + "=" + (rel.startsWith("tools/") || rel.startsWith("sync/") || rel.startsWith("src/") ? "-" : starter(rel)));
  }
  if (flag("--felder")) out.felder = berechneFelder(WS, WH, sp, ho, registry);

  if (flag("--spielstand")) {
    const stand = opt("--spielstand") && !opt("--spielstand").startsWith("--") ? opt("--spielstand") : neuesterStand();
    const tf = homeTextdateien(stand);
    out.spielstand = path.basename(stand);
    out.spielDateien = tf.size;
    const real = [...tf.keys()];
    for (const z of out.zeilen) {
      const treffer = real.filter((r) => r === z.name || passt(z.name, r));
      z.imSpiel = treffer.map((r) => r + " (" + tf.get(r).length + " B)");
    }
    out.waisen = real.filter((r) => !out.zeilen.some((z) => z.name === r || passt(z.name, r)))
      .map((r) => ({ name: r, bytes: tf.get(r).length }));
    if (out.felder) {
      for (const f of out.felder) {
        const t = tf.get(f.datei);
        if (t === undefined) { f.imSpiel = null; continue; }
        try {
          const j = JSON.parse(t);
          if (j && typeof j === "object" && !Array.isArray(j)) {
            const real0 = Object.keys(j);
            f.imSpiel = { keys: real0, nurImSpiel: real0.filter((k) => !f.keysListe.includes(k)), nurStatisch: f.keysListe.filter((k) => !k.includes(".") && !real0.includes(k)),
              gelesenNichtImSpiel: (f.gelesenKeys || []).filter((k) => !k.includes(".") && !real0.includes(k)) };
          } else f.imSpiel = { liste: Array.isArray(j) };
        } catch { f.imSpiel = { keinJson: true, bytes: t.length }; }
      }
    }
  }

  if (flag("--selbstprobe")) out.selbstprobe = await selbstprobe();
  if (flag("--eichung-alt")) out.eichungAlt = await eichungAlterStand();

  const jsonDatei = opt("--json");
  if (jsonDatei) fs.writeFileSync(jsonDatei, JSON.stringify(out, null, 1));
  const md = baueMarkdown(out, bew);
  const mdDatei = opt("--md");
  if (mdDatei) fs.writeFileSync(mdDatei, md);
  if (!flag("--kurz")) console.log(md);
  return out;
}
const fm = (e) => `${e.rel}:${e.zeile}${e.via ? " [" + e.via + "]" : ""}${e.ueber ? " ~" + e.ueber : ""}`;

/**
 * LIVE-MENGE: alle Skripte, die der Bot ohne Menschen startet. Wurzeln sind boot.js, bn4net.js, guard.js,
 * ausgang.js, exit.js und jeder Registry-Eintrag; Kanten sind Zeichenketten-Verweise in src/ (nicht tools/,
 * nicht Importe). Eine Ueberschaetzung ist beabsichtigt (jeder Verweis zaehlt als Start): ein Skript, das
 * HIER fehlt, wird sicher nicht autonom gestartet - nur per tools/task.js, tools/hand.js oder gar nicht.
 * Ein Schreiber ausserhalb der Live-Menge ist deshalb ein Handwerkzeug und seine Datei ein Messergebnis.
 */
export function liveMenge(refs, registry) {
  const kanten = new Map();
  for (const [name, r] of refs) for (const x of r) {
    if (x.rel.startsWith("tools/") || x.rel.startsWith("sync/") || x.rel === "registry.json") continue;
    if (!kanten.has(x.rel)) kanten.set(x.rel, new Set());
    kanten.get(x.rel).add(name);
  }
  const live = new Set(["boot.js", "bn4net.js", "guard.js", "ausgang.js", "exit.js", ...registry.eintraege.map((e) => e.name)]);
  const stapel = [...live];
  while (stapel.length) {
    const x = stapel.pop();
    for (const y of kanten.get(x) || []) if (!live.has(y)) { live.add(y); stapel.push(y); }
  }
  return [...live].sort();
}

/**
 * EICHUNG GEGEN EINEN BEKANNTEN FUND: Am 03.10.2026 wurde `truppAnfrage` in data/blade.json als Feld ohne
 * Leser gefunden (BAUSTELLEN.md, Commit fe3b013). Der Stand VOR diesem Commit wird per `git archive`
 * (nur lesend) in ein Temp-Verzeichnis entpackt und durch dieselbe Feldanalyse geschickt; das Feld muss
 * als "NUR im Schreiber" auftauchen. Faellt das aus, taugt die Feldanalyse nicht und jeder "kein Fund"
 * ist wertlos.
 */
export async function eichungAlterStand(commit = "fe3b013", datei = "data/blade.json", feld = "truppAnfrage") {
  const { execFileSync } = await import("node:child_process");
  const os = await import("node:os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fluss-eich-"));
  try {
    // Nur lesende git-Aufrufe (ls-tree, show), ohne Shell: "~1" und Pfade mit Doppelpunkt sind dann unkritisch
    // (ein "tar -C C:\..." scheitert unter GNU tar am Laufwerksdoppelpunkt).
    const dateien = execFileSync("git", ["ls-tree", "-r", "--name-only", commit + "~1", "src"], { cwd: ROOT, encoding: "utf8" })
      .split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean);
    for (const f of dateien) {
      const ziel = path.join(tmp, f);
      fs.mkdirSync(path.dirname(ziel), { recursive: true });
      fs.writeFileSync(ziel, execFileSync("git", ["show", commit + "~1:" + f], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }));
    }
    const srcDir = path.join(tmp, "src");
    const registry = JSON.parse(fs.readFileSync(path.join(srcDir, "registry.json"), "utf8"));
    const WS = ladeSpiel(srcDir);
    const WH = ladeHost();
    const sp = analysiereSpiel(WS);
    const ho = analysiereHost(WH);
    const f = berechneFelder(WS, WH, sp, ho, registry).find((x) => x.datei === datei);
    const gefunden = !!f && f.nurSchreiber.includes(feld);
    console.log((gefunden ? "  ok    " : "  ROT   ") + `Eichung ${commit}~1: ${feld} in ${datei} als "NUR im Schreiber" gefunden`
      + (f ? " (nurSchreiber: " + f.nurSchreiber.join(",") + ")" : " (Datei nicht in Analyse)"));
    return gefunden;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function hostTabelle(ho) {
  const tab = new Map();
  for (const s of ho.sites) {
    if (s.art !== "host") continue;
    for (const n of s.datei) {
      if (n === Q) continue;
      const b = n.split("/").pop();
      if (!/\.(json|txt|md|log|pid)(\.tmp)?$/.test(b) && !b.includes(Q)) continue;
      if (!tab.has(b)) tab.set(b, { W: [], R: [], D: [] });
      const r = tab.get(b);
      const e = s.rel + ":" + s.zeile;
      if (["W", "A", "M"].includes(s.op)) r.W.push(e); else if (["R", "X"].includes(s.op)) r.R.push(e); else r.D.push(e);
    }
  }
  return tab;
}

function baueMarkdown(out, bew) {
  const L = [];
  const sortiert = [...bew].filter((b) => !istCode(b.name)).sort((a, b) => a.name.localeCompare(b.name));
  const rel = (e) => e.split(":")[0];
  L.push("# Datenfluss-Tabelle (erzeugt von tools/audit/datenfluss.mjs)");
  L.push("");
  L.push(`Stand ${out.stand}. ${out.srcDateien} Spiel-Dateien (src/), ${out.hostDateien} Host-Dateien (sync/, tools/), ${out.wrapper} Wrapper-Eintraege, ${out.sites} Spiel-Sites, ${out.hostSites} Host-Sites.`);
  if (out.spielstand) L.push(`Eichung gegen den Spielstand ${out.spielstand} (${out.spielDateien} Textdateien auf home).`);
  L.push("");
  L.push("Lesehilfe: Schreiber/Leser stehen als `Datei:Zeile [Weg]`. `~name` heisst: ueber ein Namensmuster mit {?} getroffen. R = ns.read / getFile, X = fileExists (Flagdatei), `wrapper:` = ueber lib/hostdatei.js oder eine lokale Huelle. `Spiel` = Eintrag im Spielstand (Bytes).");
  L.push("");
  for (const klasse of ["NUR_GESCHRIEBEN", "NUR_GELESEN", "ok"]) {
    const gruppe = sortiert.filter((b) => b.klasse === klasse);
    const titel = { NUR_GESCHRIEBEN: "Geschrieben, nie gelesen", NUR_GELESEN: "Gelesen, nie geschrieben", ok: "Schreiber und Leser vorhanden" }[klasse];
    L.push(`## ${titel} (${gruppe.length})`);
    L.push("");
    L.push("| Datei | Schreiber Datei:Zeile | Leser Datei:Zeile | Spiel | Betrieb |");
    L.push("|---|---|---|---|---|");
    const zeileVon = new Map((out.zeilen || []).map((z) => [z.name, z]));
    const liveSet = new Set(out.live || []);
    for (const b of gruppe) {
      const wr = [...b.eff.W, ...b.eff.A].map(fm);
      const relW = [...new Set([...b.eff.W, ...b.eff.A].map((e) => e.rel))];
      const betrieb = relW.some((r) => liveSet.has(r)) ? "LIVE" : relW.some((r) => r.startsWith("lib/")) ? "lib" : relW.some((r) => r.startsWith("sync/") || r.startsWith("tools/")) ? "Host" : "Handwerkzeug";
      const rd = [...b.eff.R.map((e) => "R " + fm(e)), ...b.eff.X.map((e) => "X " + fm(e))];
      const kuerz = (a) => (a.length > 5 ? a.slice(0, 5).join("<br>") + `<br>... (+${a.length - 5})` : a.join("<br>"));
      const z = zeileVon.get(b.name);
      const im = z && z.imSpiel ? (z.imSpiel.length ? z.imSpiel.slice(0, 2).map((x) => x.replace(/^.*\((\d+ B)\)$/, "$1")).join(", ") : "nicht im Spiel") : "";
      L.push(`| \`${b.name}\` | ${kuerz(wr) || "-"} | ${kuerz(rd) || "-"} | ${im} | ${betrieb} |`);
    }
    L.push("");
  }
  if (out.hostDateien2) {
    L.push(`## Host-Dateien (data/ im Projekt, von sync/ und tools/ geschrieben und gelesen)`);
    L.push("");
    L.push("| Datei | Schreiber | Leser | Vorhanden |");
    L.push("|---|---|---|---|");
    for (const h of out.hostDateien2) L.push(`| \`${h.name}\` | ${h.W.join("<br>") || "-"} | ${h.R.join("<br>") || "-"} | ${h.vorhanden === null ? "" : (h.vorhanden ? "ja" : "nein")} |`);
    L.push("");
  }
  if (out.waisen && out.waisen.length) {
    L.push(`## Waisen im Spielstand (Datei liegt auf home, kein Schreiber und kein Leser in src/ oder tools/) (${out.waisen.length})`);
    L.push("");
    L.push(out.waisen.map((w) => `\`${w.name}\` (${w.bytes} B)`).join(", "));
    L.push("");
  }
  if (out.felder) {
    L.push("## Felder ohne Leser (JSON-Dateien)");
    L.push("");
    L.push("Ein Feld gilt als \"NUR im Schreiber\", wenn sein Name in keiner anderen Datei als Eigenschaftszugriff oder Schluessel vorkommt (src/, sync/, tools/, dashboard). Das schliesst Zugriffe ueber berechnete Schluessel und Objekte aus, die als Ganzes ausgegeben werden (Anzeige fuer Menschen).");
    L.push("");
    L.push("| Datei | Felder | NUR im Schreiber | Leser-Stellen |");
    L.push("|---|---|---|---|");
    for (const f of out.felder) {
      if (!f.nurSchreiber.length && !f.gelesenNichtGeschrieben.filter((k) => !k.includes(".")).length) continue;
      L.push(`| \`${f.datei}\` | ${f.felder} | ${f.nurSchreiber.join(", ") || "-"} | ${f.leser.length ? f.leser.slice(0, 4).join(", ") + (f.leser.length > 4 ? ", ..." : "") : "keine"} |`);
    }
    L.push("");
  }
  if (out.wirte) {
    L.push(`## Wirtepruefung (${out.wirte.length} Treffer vor manueller Sichtung)`);
    L.push("");
    for (const w of out.wirte.filter((x) => !["boot.js", "autopilot.js"].includes(x.skript))) L.push(`- ${w.art}: ${w.rel}:${w.zeile} ${w.datei}`);
    L.push("");
  }
  if (out.argumente) {
    L.push("## Argumentvertrag exec/run/spawn gegen ns.args");
    L.push("");
    for (const a of out.argumente.filter((x) => x.urteil !== "ok")) L.push(`- ${a.aufrufer} -> ${a.ziel}: uebergeben ${a.uebergeben}, erwartet ${a.erwartet} => ${a.urteil}`);
    L.push("");
  }
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Feldanalyse
// ---------------------------------------------------------------------------
function berechneFelder(WS, WH, sp, ho, registry) {
  const dash = dashboardSkript();
  const dashTokens = new Set();
  if (dash) {
    try { walk(parse(dash.code, "script"), (n) => { if (n.type === "MemberExpression" && !n.computed && n.property.type === "Identifier") dashTokens.add(n.property.name); else if (n.type === "MemberExpression" && n.computed && n.property.type === "Literal") dashTokens.add(String(n.property.value)); }); }
    catch { for (const m of dash.code.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)/g)) dashTokens.add(m[1]); }
  }
  // Tier C: Namen, die irgendwo in Code als Zugriff oder Schluessel vorkommen
  const global = new Map(); // name -> Menge der Dateien, die ihn als Zugriff/Schluessel verwenden
  const zaehlGlobal = (W) => { for (const F of W.dateien.values()) if (F.ast) for (const t of tokenMenge(F.ast)) { if (!global.has(t)) global.set(t, new Set()); global.get(t).add(F.rel); } };
  zaehlGlobal(WS); zaehlGlobal(WH);
  for (const t of dashTokens) { if (!global.has(t)) global.set(t, new Set()); global.get(t).add("dashboard/index.html"); }

  // Schreiber je Datei (nur konkrete Namen)
  const schreiber = new Map();
  for (const s of sp.sites) {
    if (s.art !== "datei" || !["W", "A"].includes(s.op) || !s.inhalt) continue;
    const F = WS.dateien.get(s.rel);
    for (const n of s.datei) {
      if (n.includes(Q) || istCode(n)) continue;
      const k = objektSchluessel(WS, F, s.inhalt);
      if (!schreiber.has(n)) schreiber.set(n, []);
      schreiber.get(n).push({ rel: s.rel, zeile: s.zeile, keys: k.keys, ungenau: k.ungenau });
    }
  }
  // Leser je Datei
  const leser = new Map();
  const sammleLeser = (W, sites, wo) => {
    for (const s of sites) {
      if (s.op !== "R" || !(s.art === "datei" || s.art === "spiel")) continue;
      const F = W.dateien.get(s.rel);
      if (!F) continue;
      for (const n of s.datei) {
        if (n.includes(Q) || istCode(n)) continue;
        const rf = leserFelder(F, s, W);
        const scope = s.fns && s.fns.length ? s.fns[s.fns.length - 1] : F.ast;
        rf.tokens = tokenMenge(scope);
        if (!leser.has(n)) leser.set(n, []);
        leser.get(n).push({ wo, rel: s.rel, zeile: s.zeile, ...rf });
      }
    }
  };
  sammleLeser(WS, sp.sites, "src");
  sammleLeser(WH, ho.sites, "host");
  const ergebnis = [];
  for (const [datei, ws] of schreiber) {
    const alleKeys = new Set(); const ungenau = new Set();
    for (const w of ws) { w.keys.forEach((k) => alleKeys.add(k)); w.ungenau.forEach((k) => ungenau.add(k)); }
    if (!alleKeys.size) continue;
    const ls = leser.get(datei) || [];
    const gelesen = new Set(); let ganz = 0, untracked = 0, rohN = 0; const lokation = []; const gruende = new Set();
    for (const l of ls) {
      l.keys.forEach((k) => gelesen.add(k)); l.bare.forEach((k) => gelesen.add(k));
      if (l.ganz) ganz++;
      if (l.untracked) { untracked++; gruende.add(l.grund); }
      if (l.roh) rohN++;
      lokation.push(l.rel + ":" + l.zeile + (l.ganz ? "[ganz]" : "") + (l.untracked ? "[?]" : "") + (l.roh ? "[roh]" : ""));
    }
    const ungelesen = [], vielleicht = [], nurSchreiber = [];
    for (const k of alleKeys) {
      const praefix = k.split(".")[0];
      const unterLeser = [...gelesen].some((g) => g.startsWith(praefix + "."));
      const gedeckt = gelesen.has(k) || (k.includes(".") && gelesen.has(praefix) && !unterLeser);
      if (gedeckt) continue;
      const einfach = k.split(".").pop();
      if (datei === "data/bn4net.json" && dashTokens.has(einfach)) continue;
      const wset = new Set(ws.map((w) => w.rel));
      const andere = [...(global.get(einfach) || [])].filter((r) => !wset.has(r));
      if (!andere.length) nurSchreiber.push(k);
      if (ganz) vielleicht.push(k + "{ganz-Leser}");
      else if (untracked) vielleicht.push(k + "{untracked}");
      else ungelesen.push(k + (andere.length ? "{Name auch in " + andere.length + " anderen Dateien}" : "{NUR im Schreiber}"));
    }
    ergebnis.push({
      datei, schreiber: ws.map((w) => w.rel + ":" + w.zeile), felder: alleKeys.size, keysListe: [...alleKeys].sort(), ungenau: [...ungenau],
      leser: lokation, ungelesen: ungelesen.sort(), vielleicht: vielleicht.sort(), nurSchreiber: nurSchreiber.sort(), ganz, untracked, roh: rohN, gruende: [...gruende],
      gelesenNichtGeschrieben: [...gelesen].filter((g) => !alleKeys.has(g)).sort(),
      gelesenKeys: [...gelesen].sort(),
      leserDetail: ls.map((l) => ({ stelle: l.rel + ":" + l.zeile, keys: [...l.keys].sort(), ganz: l.ganz, untracked: l.untracked, roh: l.roh, grund: l.grund })),
    });
  }
  // Dateien, die gelesen werden, deren Schreiber aber kein Objektliteral hat (Felder unbekannt)
  return ergebnis.sort((a, b) => a.datei.localeCompare(b.datei));
}

// ---------------------------------------------------------------------------
// Selbstprobe
// ---------------------------------------------------------------------------
export async function selbstprobe() {
  const ergebnisse = [];
  const W = new Welt("probe", "src");
  W.lade("lib/probe-hilfe.js", [
    "export const PFAD = \"data/hilfs-\";",
    "export function schreibeHilfe(ns, name, obj) { ns.write(PFAD + name + \".json\", JSON.stringify(obj), \"w\"); }",
    "export function liesHilfe(ns, name) { return ns.fileExists(PFAD + name + \".json\", \"home\") ? JSON.parse(ns.read(PFAD + name + \".json\")) : null; }",
  ].join("\n"));
  W.lade("probe-a.js", [
    "import { schreibeHilfe, liesHilfe } from \"lib/probe-hilfe.js\";",
    "const TOT = \"data/probe-tot.json\";          // wird geschrieben, nie gelesen",
    "const BLIND = \"data/probe-blind.txt\";       // wird gelesen, nie geschrieben",
    "const BEIDE = [\"data/probe-liste-a.json\", \"data/probe-liste-b.json\"];",
    "export async function main(ns) {",
    "  ns.write(TOT, JSON.stringify({ zeit: 1, toterWert: 2 }), \"w\");",
    "  const b = ns.read(BLIND);",
    "  for (const d of BEIDE) ns.write(d, JSON.stringify({ zeit: 1, feldA: 1, feldB: 2 }), \"w\");",
    "  schreibeHilfe(ns, \"x\", { zeit: 1, hilfeFeld: 3 });",
    "  const antrag = { gesehen: 1, truppAnfrage: true };",
    "  ns.write(\"data/probe-antrag.json\", JSON.stringify(antrag), \"w\");",
    "}",
  ].join("\n"));
  W.lade("probe-b.js", [
    "import { liesHilfe } from \"lib/probe-hilfe.js\";",
    "export async function main(ns) {",
    "  for (const d of [\"data/probe-liste-a.json\", \"data/probe-liste-b.json\"]) { const j = JSON.parse(ns.read(d)); if (j.feldA) ns.print(j.zeit); }",
    "  const h = liesHilfe(ns, \"x\");",
    "  const a = JSON.parse(ns.read(\"data/probe-antrag.json\")); ns.print(a.gesehen);",
    "  ns.print(ns.read(\"data/probe-nur-gelesen2.txt\"));",
    "}",
  ].join("\n"));
  const sp = analysiereSpiel(W);
  const zeilen = new Map();
  const hole = (n) => { if (!zeilen.has(n)) zeilen.set(n, { name: n, W: [], A: [], R: [], X: [], D: [], T: [], M: [], L: [], testR: [], testW: [] }); return zeilen.get(n); };
  for (const s of sp.sites) if (s.art === "datei") for (const n of s.datei) { const r = hole(n); if (r[s.op === "W?" ? "W" : s.op]) r[s.op === "W?" ? "W" : s.op].push({ rel: s.rel, zeile: s.zeile, via: s.via }); }
  const bew = bewerte(zeilen);
  const klasse = (n) => (bew.find((b) => b.name === n) || {}).klasse;
  const pruefe = (name, ok, detail = "") => { ergebnisse.push({ name, ok, detail }); console.log((ok ? "  ok    " : "  ROT   ") + name + (detail ? "  (" + detail + ")" : "")); };
  pruefe("toter Kanal (const + ns.write) gefunden", klasse("data/probe-tot.json") === "NUR_GESCHRIEBEN", klasse("data/probe-tot.json"));
  pruefe("blinder Leser (const + ns.read) gefunden", klasse("data/probe-blind.txt") === "NUR_GELESEN", klasse("data/probe-blind.txt"));
  pruefe("Liste (for-of) als ok erkannt", klasse("data/probe-liste-a.json") === "ok" && klasse("data/probe-liste-b.json") === "ok", klasse("data/probe-liste-a.json"));
  pruefe("Wrapper-Schreiber und -Leser (Vorlage mit Parameter) treffen sich", [...zeilen.keys()].some((n) => n.includes("data/hilfs-") ), [...zeilen.keys()].filter((n) => n.includes("hilfs")).join(","));
  const hilfs = bew.find((b) => b.name.includes("hilfs-"));
  pruefe("Wrapper-Datei als ok bewertet", hilfs && hilfs.klasse === "ok", hilfs ? hilfs.klasse : "keine Zeile");
  pruefe("Datei nur gelesen ueber Literal gefunden", klasse("data/probe-nur-gelesen2.txt") === "NUR_GELESEN", klasse("data/probe-nur-gelesen2.txt"));
  // Felder: toterWert im toten Kanal nicht relevant; wohl aber antrag.truppAnfrage (Identifier-Objekt + nie gelesenes Feld)
  const F = W.dateien.get("probe-a.js");
  const antragSite = sp.sites.find((s) => s.datei.includes("data/probe-antrag.json") && s.op === "W");
  const k = objektSchluessel(W, F, antragSite.inhalt);
  pruefe("Schluessel eines per Variable geschriebenen Objekts gelesen", k.keys.has("truppAnfrage") && k.keys.has("gesehen"), [...k.keys].join(","));
  const lesSite = sp.sites.find((s) => s.datei.includes("data/probe-antrag.json") && s.op === "R");
  const rf = leserFelder(W.dateien.get("probe-b.js"), lesSite, W);
  pruefe("Leser sieht 'gesehen', aber NICHT 'truppAnfrage' (totes Feld)", rf.keys.has("gesehen") && !rf.keys.has("truppAnfrage") && !rf.ganz && !rf.untracked, [...rf.keys].join(",") + (rf.ganz ? " ganz" : "") + (rf.untracked ? " untracked" : ""));
  const lesListe = sp.sites.find((s) => s.datei.includes("data/probe-liste-a.json") && s.op === "R");
  const rl = leserFelder(W.dateien.get("probe-b.js"), lesListe, W);
  pruefe("Leser in for-of-Schleife: feldA und zeit, nicht feldB", rl.keys.has("feldA") && rl.keys.has("zeit") && !rl.keys.has("feldB"), [...rl.keys].join(","));
  return ergebnisse;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await hauptprogramm();
}
