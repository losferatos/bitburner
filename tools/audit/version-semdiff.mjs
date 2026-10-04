// VERSION-SEMDIFF (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Einheitenweiser Vergleich beliebiger Spielquelldateien zwischen reference/v301 (LAUFENDES Spiel, 3.0.1) und
// reference/bitburner-src (dev, "3.0.2"). Einheit = Funktionsdeklaration, Konstante/Variable auf Dateiebene,
// Klassenmitglied (Methode/Eigenschaft/Getter) oder Eintrag eines Objektliteral-Initialisierers erster Ebene.
// Kommentare und Leerraum werden entfernt; was dann noch verschieden ist, wird gemeldet.
//
// Eichung (SELBSTPROBE): zwei synthetische Quellen - reine Umformatierung/Kommentar MUSS gleich sein,
// geaenderte Zahl in einer Klassenmethode MUSS erkannt werden.
//
// Aufruf: node tools/audit/version-semdiff.mjs <datei.ts> [<datei2.ts> ...] [--voll] [--max N]
//         (Pfade relativ zu reference/*/src)
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
const VOLL = argv.includes("--voll");
const dateien = argv.filter((a) => !a.startsWith("--") && !/^\d+$/.test(a));

function normal(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1")
    .replace(/\s+/g, "")
    .replace(/,([)\]}])/g, "$1");
}

function einheiten(code, name) {
  const kind = name.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, kind);
  const out = new Map();
  const put = (k, node) => { let key = k, i = 2; while (out.has(key)) key = k + "#" + i++; out.set(key, { text: node.getText(sf), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 }); };
  const nm = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) ? n.text : n ? n.getText(sf) : "?");
  const objekt = (obj, prefix) => {
    for (const p of obj.properties) {
      const k = prefix + "." + (p.name ? nm(p.name) : "?");
      put(k, p);
    }
  };
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st)) put("fn:" + (st.name ? st.name.text : "default"), st);
    else if (ts.isClassDeclaration(st)) {
      const cn = st.name ? st.name.text : "klasse";
      for (const m of st.members) put("class:" + cn + "." + (m.name ? nm(m.name) : ts.SyntaxKind[m.kind]), m);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const n = nm(d.name);
        if (d.initializer && ts.isObjectLiteralExpression(d.initializer) && d.initializer.properties.length > 2) objekt(d.initializer, "obj:" + n);
        else if (d.initializer && ts.isArrayLiteralExpression(d.initializer) && d.initializer.elements.length > 2) {
          d.initializer.elements.forEach((e, i) => put("arr:" + n + "[" + i + "]", e));
        } else put("const:" + n, d);
      }
    } else if (ts.isEnumDeclaration(st)) {
      for (const m of st.members) put("enum:" + st.name.text + "." + nm(m.name), m);
    } else if (ts.isExportAssignment(st) || ts.isExpressionStatement(st)) put("stmt:" + st.getText(sf).slice(0, 40), st);
  }
  return out;
}

function vergleiche(a, b) {
  const geaendert = [], nurLive = [], nurDev = [];
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb) { nurLive.push(k); continue; }
    if (normal(va.text) !== normal(vb.text)) geaendert.push({ k, va, vb });
  }
  for (const k of b.keys()) if (!a.has(k)) nurDev.push(k);
  return { geaendert, nurLive, nurDev };
}

// Selbstprobe
{
  const alt = "class A { /* x */ f(n: number) { return n * 3; }   g = 5; }\nexport const T = { a: 1, b: 2, c: 3 };";
  const neu = "class A {\n  f(n: number) {\n    // Kommentar\n    return n * 4;\n  }\n  g = 5;\n}\nexport const T = {\n  a: 1,\n  b: 2,\n  c: 3,\n};";
  const r = vergleiche(einheiten(alt, "p.ts"), einheiten(neu, "p.ts"));
  const ok = r.geaendert.length === 1 && r.geaendert[0].k === "class:A.f" && !r.nurLive.length && !r.nurDev.length;
  console.log("SELBSTPROBE: " + (ok ? "OK (Umformatierung gleich, geaenderte Zahl erkannt)" : "FEHLER " + JSON.stringify(r)));
  if (!ok) process.exit(2);
}

for (const rel of dateien) {
  const lesen = (dir) => {
    for (const ext of [rel, rel.endsWith("x") ? rel.slice(0, -1) : rel + "x"]) {
      const f = path.join(dir, ext);
      if (fs.existsSync(f)) return { code: fs.readFileSync(f, "utf8"), name: ext };
    }
    return null;
  };
  const l = lesen(LIVE), d = lesen(DEV);
  console.log("\n=== " + rel + (l && d ? "" : (l ? "  (nur live)" : d ? "  (nur dev)" : "  (fehlt)")));
  if (!l || !d) continue;
  const r = vergleiche(einheiten(l.code, l.name), einheiten(d.code, d.name));
  for (const k of r.nurLive) console.log("  NUR LIVE: " + k);
  for (const k of r.nurDev) console.log("  NUR DEV:  " + k);
  for (const g of r.geaendert) {
    console.log("  GEAENDERT " + g.k + "  (live :" + g.va.line + ", dev :" + g.vb.line + ")");
    if (VOLL) console.log("      LIVE: " + g.va.text.replace(/\s+/g, " ").slice(0, 700) + "\n      DEV:  " + g.vb.text.replace(/\s+/g, " ").slice(0, 700));
  }
}
