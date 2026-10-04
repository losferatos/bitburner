// FLUSS-WRITEMODE (Audit 04.10.2026): ns.write ohne Modus-Argument haengt an ("a" ist der Standard) statt zu ersetzen.
//
// Frage: Eine JSON-Datei, die mit ns.write(datei, text) (zwei Argumente) geschrieben wird, waechst bei jedem Aufruf um
// ein weiteres Objekt und ist ab dem zweiten Schreiben kein gueltiges JSON mehr - der Leser faellt still auf seinen
// Standardwert. Das Skript listet jeden ns.write mit weniger als drei Argumenten in src/ (AST, acorn) samt Zieldatei.
//
// Eichung: Standard von ns.write laut Spielquelle (NetscriptFunctions.ts, write: mode default "a") - die Zeile wird ausgegeben.
//
// Aufruf: node tools/audit/fluss-writemode.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);

// Eichung gegen den Spielquelltext
const nsf = fs.readFileSync(path.join(ROOT, "reference", "bitburner-src", "src", "NetscriptFunctions.ts"), "utf8").split(/\r?\n/);
const zi = nsf.findIndex((z) => /^\s*write: \(ctx,/.test(z));
console.log("Spielquelle write:", "NetscriptFunctions.ts:" + (zi + 1), nsf.slice(zi + 1, zi + 4).map((z) => z.trim()).join(" "));

function dateien(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) out.push(...dateien(dir, r)); else if (r.endsWith(".js")) out.push(r);
  }
  return out;
}
function walk(n, f) { if (!n || typeof n.type !== "string") return; f(n); for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((x) => x && x.type && walk(x, f)); else if (v && typeof v.type === "string") walk(v, f); } }
let n = 0;
for (const f of dateien(path.join(ROOT, "src"))) {
  const code = fs.readFileSync(path.join(ROOT, "src", f), "utf8");
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true }); } catch { continue; }
  walk(ast, (c) => {
    if (c.type !== "CallExpression" || c.callee.type !== "MemberExpression" || c.callee.object.type !== "Identifier" || c.callee.object.name !== "ns" || c.callee.property.name !== "write") return;
    if (c.arguments.length >= 3) return;
    n++;
    const a = c.arguments[0];
    const ziel = a && a.type === "Literal" ? a.value : (a ? code.slice(a.start, a.end) : "?");
    console.log("  ", f + ":" + c.loc.start.line, "args=" + c.arguments.length, String(ziel).slice(0, 60));
  });
}
console.log("ns.write mit weniger als drei Argumenten:", n);
