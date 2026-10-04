// VERSION-NSDIFF (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Semantischer Vergleich der ns-Funktionen zwischen dem LAUFENDEN Spiel (reference/v301, 3.0.1) und dem
// dev-Baum (reference/bitburner-src, "3.0.2"). Zwischen beiden Baeumen wurde die Wrapper-Form umgestellt:
//   v301:  name: (ctx) => (a, b) => { ... }
//   dev:   name: (ctx, a, b) => { ... }
// Ein Textdiff ist deshalb voller Rauschen (Einrueckung). Dieses Werkzeug parst beide Baeume mit dem
// TypeScript-Compiler, holt je ns-Funktion (Pfad "singularity.upgradeHomeRam") Parameterliste und Rumpf,
// entfernt Kommentare/Leerraum und meldet nur Funktionen, deren Rumpf oder Parameter sich unterscheiden.
//
// Eichung (SELBSTPROBE): zwei synthetische Quellen - gleiche Funktion in alter/neuer Wrapper-Form MUSS als
// gleich gelten, eine mit geaendertem Literal MUSS als geaendert gelten. Sonst ist das Werkzeug blind.
//
// Aufruf: node tools/audit/version-nsdiff.mjs [--zeige datei.ts] [--max N]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const require = createRequire(import.meta.url);
const ts = require(path.join(ROOT, "reference", "v301", "node_modules", "typescript"));
const LIVE = path.join(ROOT, "reference", "v301", "src");
const DEV = path.join(ROOT, "reference", "bitburner-src", "src");
const argv = process.argv.slice(2);
const ZEIGE = argv.includes("--zeige") ? argv[argv.indexOf("--zeige") + 1] : null;

function normal(text) {
  // Kommentare und Leerraum entfernen (Strings bleiben, weil wir nur auf Gleichheit pruefen)
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
    .replace(/\s+/g, "")
    // Komma vor schliessender Klammer (Prettier-Trailing-Comma) ist Formatierung
    .replace(/,([)\]}])/g, "$1");
}

// Liefert Map: Pfad -> { params: string, body: string, text: string }
function extrahiere(code, dateiname) {
  const sf = ts.createSourceFile(dateiname, code, ts.ScriptTarget.Latest, true, dateiname.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = new Map();
  const nameOf = (n) => {
    if (!n) return null;
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
    if (ts.isComputedPropertyName(n)) return "[" + n.expression.getText(sf) + "]";
    return null;
  };
  // innerste Funktion bei curried (ctx) => (a) => {...}
  const funktion = (init) => {
    if (!init) return null;
    if (!(ts.isArrowFunction(init) || ts.isFunctionExpression(init))) return null;
    let f = init;
    const ctxStil = f.parameters.length <= 1 && f.parameters[0] && f.parameters[0].name.getText(sf) === "ctx";
    const keinParam = f.parameters.length === 0;
    // curried: Rumpf ist ein Pfeil (ohne Block)
    if ((ctxStil || keinParam) && ts.isArrowFunction(f) && f.body && !ts.isBlock(f.body) && ts.isArrowFunction(f.body)) {
      const inner = f.body;
      const params = [...(ctxStil ? ["ctx"] : []), ...inner.parameters.map((p) => p.getText(sf))].join(",");
      return { params, body: inner.body.getText(sf), curried: true };
    }
    return { params: f.parameters.map((p) => p.getText(sf)).join(","), body: f.body ? f.body.getText(sf) : "", curried: false };
  };
  const walkObj = (obj, prefix) => {
    for (const p of obj.properties) {
      const nm = nameOf(p.name);
      if (nm == null) continue;
      const pfad = prefix ? prefix + "." + nm : nm;
      if (ts.isPropertyAssignment(p)) {
        if (ts.isObjectLiteralExpression(p.initializer)) { walkObj(p.initializer, pfad); continue; }
        const f = funktion(p.initializer);
        if (f) out.set(pfad, f);
        else out.set(pfad + "#wert", { params: "", body: p.initializer.getText(sf), curried: false });
      } else if (ts.isMethodDeclaration(p)) {
        out.set(pfad, { params: p.parameters.map((x) => x.getText(sf)).join(","), body: p.body ? p.body.getText(sf) : "", curried: false });
      } else if (ts.isShorthandPropertyAssignment(p)) {
        out.set(pfad + "#kurz", { params: "", body: p.name.getText(sf), curried: false });
      }
    }
  };
  const besuche = (n) => {
    // Top-Level: const x: InternalAPI<..> = { ... } oder return { ... } in Funktionen
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      walkObj(n.initializer, "");
    } else if (ts.isReturnStatement(n) && n.expression && ts.isObjectLiteralExpression(n.expression)) {
      walkObj(n.expression, "");
    }
    ts.forEachChild(n, besuche);
  };
  // Nur oberste Funktionsebene durchsuchen (Namespaces sind in eigenen Dateien)
  besuche(sf);
  // Auch freie Funktionen/Konstanten (Helfer): Name -> Rumpf
  const frei = new Map();
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name && /^Netscript[A-Z]/.test(st.name.text) && st.body) {
      // Fabrikfunktion eines Namensraums: Hilfsanweisungen VOR dem ns-Objekt einzeln vergleichen (das Objekt selbst
      // vergleicht die ns-Tabelle oben Mitglied fuer Mitglied)
      st.body.statements.forEach((inner, i) => {
        if (ts.isReturnStatement(inner)) return;
        let nm = "stmt" + i;
        if (ts.isFunctionDeclaration(inner) && inner.name) nm = inner.name.text;
        else if (ts.isVariableStatement(inner)) nm = inner.declarationList.declarations.map((d) => d.name.getText(sf)).join("+");
        // Objektliterale mit ns-Mitgliedern ueberspringen (werden oben verglichen)
        if (ts.isVariableStatement(inner) && inner.declarationList.declarations.some((d) => d.initializer && ts.isObjectLiteralExpression(d.initializer) && d.initializer.properties.length > 3)) return;
        frei.set("inner:" + st.name.text + ":" + nm, { params: "", body: inner.getText(sf), curried: false });
      });
      continue;
    }
    if (ts.isFunctionDeclaration(st) && st.name) frei.set("fn:" + st.name.text, { params: st.parameters.map((x) => x.getText(sf)).join(","), body: st.body ? st.body.getText(sf) : "", curried: false });
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (d.initializer && !ts.isObjectLiteralExpression(d.initializer)) frei.set("const:" + d.name.getText(sf), { params: "", body: d.initializer.getText(sf), curried: false });
      }
    }
  }
  return { ns: out, frei };
}

function vergleiche(a, b) {
  const geaendert = [], nurLive = [], nurDev = [];
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb) { nurLive.push(k); continue; }
    const pa = normal(va.params).replace(/^ctx,?/, ""), pb = normal(vb.params).replace(/^ctx,?/, "");
    const ba = normal(va.body), bb = normal(vb.body);
    if (pa !== pb || ba !== bb) geaendert.push({ k, paramsGleich: pa === pb, va, vb });
  }
  for (const k of b.keys()) if (!a.has(k)) nurDev.push(k);
  return { geaendert, nurLive, nurDev };
}

// ---- Selbstprobe
{
  const alt = "const x: T = { a: (ctx) => (n) => { const v = helpers.number(ctx, 'n', n); return v + 1; }, b: (ctx) => () => 5, c: (ctx) => (n) => n * 3 };";
  const neu = "const x: T = {\n a: (ctx, n) => {\n  const v = helpers.number(ctx, 'n', n); // Kommentar\n  return v + 1;\n },\n b: (ctx) => 5,\n c: (ctx, n) => n * 4,\n};";
  const r = vergleiche(extrahiere(alt, "p.ts").ns, extrahiere(neu, "p.ts").ns);
  const ok = r.geaendert.length === 1 && r.geaendert[0].k === "c" && r.nurLive.length === 0 && r.nurDev.length === 0;
  console.log("SELBSTPROBE ns-Wrapper-Umstellung: " + (ok ? "OK (a,b gleich erkannt; c geaendert erkannt)" : "FEHLER " + JSON.stringify({ g: r.geaendert.map((x) => x.k), l: r.nurLive, d: r.nurDev })));
  if (!ok) process.exit(2);
}

const DATEIEN = [];
function sammle(dir, rel = "") {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) sammle(dir, r);
    else if (/^NetscriptFunctions(\.ts|\/.*\.tsx?)$/.test(r)) DATEIEN.push(r);
  }
}
sammle(DEV);
sammle(LIVE);
const alleDateien = [...new Set(DATEIEN.map((d) => d.replace(/x$/, "")))].sort();
const gesamt = { geaendert: 0, nurLive: 0, nurDev: 0 };
const bericht = [];
for (const d of alleDateien) {
  const lies = (dir) => {
    for (const ext of ["", "x"]) {
      const f = path.join(dir, d + ext);
      if (fs.existsSync(f)) return { code: fs.readFileSync(f, "utf8"), name: d + ext };
    }
    return null;
  };
  const l = lies(LIVE), v = lies(DEV);
  if (!l || !v) { bericht.push({ d, hinweis: l ? "nur live" : "nur dev" }); continue; }
  const a = extrahiere(l.code, l.name), b = extrahiere(v.code, v.name);
  const r = vergleiche(a.ns, b.ns);
  const rf = vergleiche(a.frei, b.frei);
  gesamt.geaendert += r.geaendert.length; gesamt.nurLive += r.nurLive.length; gesamt.nurDev += r.nurDev.length;
  bericht.push({ d, ns: r, frei: rf, anzahl: [a.ns.size, b.ns.size] });
}
for (const b of bericht) {
  if (b.hinweis) { console.log(b.d + ": " + b.hinweis); continue; }
  const { ns, frei } = b;
  console.log(`\n== ${b.d}  (ns-Eintraege live ${b.anzahl[0]} / dev ${b.anzahl[1]})`);
  if (ns.nurLive.length) console.log("  NUR LIVE (in dev entfernt/umbenannt): " + ns.nurLive.join(", "));
  if (ns.nurDev.length) console.log("  NUR DEV (neu): " + ns.nurDev.join(", "));
  for (const g of ns.geaendert) console.log("  GEAENDERT " + g.k + (g.paramsGleich ? "" : "  [Parameter: " + g.va.params + " -> " + g.vb.params + "]"));
  if (frei.geaendert.length) console.log("  Helfer geaendert: " + frei.geaendert.map((g) => g.k).join(", "));
  if (frei.nurLive.length) console.log("  Helfer nur live: " + frei.nurLive.join(", "));
  if (frei.nurDev.length) console.log("  Helfer nur dev: " + frei.nurDev.join(", "));
  if (ZEIGE && ZEIGE === b.d) {
    for (const g of ns.geaendert) {
      console.log("\n--- " + g.k + "\nLIVE: " + g.va.body.replace(/\n\s*/g, "\n") + "\nDEV:  " + g.vb.body.replace(/\n\s*/g, "\n"));
    }
  }
}
console.log("\nGESAMT geaendert " + gesamt.geaendert + ", nur live " + gesamt.nurLive + ", nur dev " + gesamt.nurDev);
