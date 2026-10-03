// Audit 03.10.2026, Bereich SING (Orchestrierung): unaufgeloeste Namen, die
// NIRGENDS in der Datei deklariert und kein Laufzeit-Global sind.
//
// tools/test-scope-tot.js meldet nur Namen, die IRGENDWO in derselben Datei
// deklariert sind (geborgter Scope). Ein schlichter Tippfehler oder ein
// vergessener Import ("liesVonHome" ohne import) faellt dort durch - und in
// einem try/catch stirbt er genauso still. Diese Probe schliesst die Luecke.
//
// Selbstprobe: ein Kleinstbeispiel mit vergessenem Import MUSS gefunden
// werden, sonst gilt "0 Funde" nichts.
// Aufruf: node tools/audit/sing-undef.mjs [datei ...]   (ohne Argument: ganz src/)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAcorn } from "../lib/scope-tot.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GLOBALS = new Set(("Math JSON Date Number String Object Array Set Map WeakMap WeakSet Promise globalThis "
  + "console isNaN isFinite parseInt parseFloat Infinity NaN undefined Error TypeError RangeError SyntaxError "
  + "ReferenceError RegExp Boolean Symbol BigInt setTimeout clearTimeout setInterval clearInterval performance "
  + "window document navigator Intl Reflect Proxy encodeURIComponent decodeURIComponent encodeURI decodeURI "
  + "structuredClone queueMicrotask TextEncoder TextDecoder Uint8Array Int32Array Float64Array ArrayBuffer "
  + "DataView atob btoa fetch URL Blob KeyboardEvent MouseEvent Event InputEvent HTMLElement Node "
  + "requestAnimationFrame localStorage indexedDB Worker MessageChannel AbortController arguments eval "
  + "Function AggregateError FinalizationRegistry WeakRef crypto location history").split(/\s+/));

const ac = await loadAcorn();
if (!ac) { console.log("acorn fehlt (reference/v301/node_modules)"); process.exit(2); }

function names(p, out) {
  if (!p) return out;
  if (p.type === "Identifier") out.push(p.name);
  else if (p.type === "ObjectPattern") for (const pr of p.properties) names(pr.type === "RestElement" ? pr.argument : pr.value, out);
  else if (p.type === "ArrayPattern") for (const e of p.elements) names(e, out);
  else if (p.type === "RestElement") names(p.argument, out);
  else if (p.type === "AssignmentPattern") names(p.left, out);
  return out;
}
export function undeclared(code) {
  const ast = ac.parse(code, { ecmaVersion: "latest", sourceType: "module", locations: true });
  const decl = new Set();
  const walk = (n, f) => {
    if (!n || typeof n.type !== "string") return;
    f(n);
    for (const k of Object.keys(n)) {
      if (k === "loc") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && walk(c, f));
      else if (v && typeof v.type === "string") walk(v, f);
    }
  };
  walk(ast, (n) => {
    if ((n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ClassDeclaration"
      || n.type === "ClassExpression") && n.id) decl.add(n.id.name);
    if (n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression")
      for (const p of n.params) names(p, []).forEach((x) => decl.add(x));
    if (n.type === "VariableDeclarator") names(n.id, []).forEach((x) => decl.add(x));
    if (n.type === "CatchClause") names(n.param, []).forEach((x) => decl.add(x));
    if (n.type === "ImportDeclaration") n.specifiers.forEach((s) => decl.add(s.local.name));
  });
  const funde = [];
  const visit = (n, parent, key) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Identifier") {
      const notRef = (parent?.type === "MemberExpression" && key === "property" && !parent.computed)
        || ((parent?.type === "Property" || parent?.type === "MethodDefinition" || parent?.type === "PropertyDefinition")
          && key === "key" && !parent.computed)
        || ((parent?.type === "LabeledStatement" || parent?.type === "BreakStatement" || parent?.type === "ContinueStatement") && key === "label")
        || parent?.type === "MetaProperty" || /^Import|^Export/.test(parent?.type || "");
      if (!notRef && !decl.has(n.name) && !GLOBALS.has(n.name)) funde.push({ name: n.name, line: n.loc.start.line });
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === "loc") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && visit(c, n, k));
      else if (v && typeof v.type === "string") visit(v, n, k);
    }
  };
  visit(ast, null, null);
  return funde;
}

// Selbstprobe
const probe = undeclared("import { a } from 'x';\nexport async function main(ns) {\n  try { liesVonHome('y'); } catch { }\n  a(); Math.max(1); const q = 1; q;\n}\n");
console.log("Selbstprobe (vergessener Import muss gefunden werden):", probe.map((f) => f.name + ":" + f.line).join(",") || "NICHTS - Probe ungueltig");

const args = process.argv.slice(2);
const files = args.length ? args : (function sammle(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? sammle(path.join(d, e.name))
    : e.name.endsWith(".js") ? [path.join(d, e.name)] : []);
})(path.join(ROOT, "src"));
let n = 0;
for (const f of files) {
  let funde;
  try { funde = undeclared(fs.readFileSync(f, "utf8")); } catch (e) { console.log(path.relative(ROOT, f), "PARSE", String(e).slice(0, 80)); continue; }
  const u = [...new Map(funde.map((x) => [x.name, x])).values()];
  if (u.length) { n += u.length; console.log(path.relative(ROOT, f).replace(/\\/g, "/"), u.map((x) => x.name + ":" + x.line).join(", ")); }
}
console.log("Summe unaufgeloester Namen:", n, "in", files.length, "Dateien");
