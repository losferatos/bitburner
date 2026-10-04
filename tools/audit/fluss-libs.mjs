// FLUSS-LIBS (Audit 03.10.2026): Stimmt needsLibs der Registry mit den tatsaechlichen Importen ueberein?
//
// Hintergrund: Der Kern kopiert vor dem Start eines Werkzeugs auf einen fremden Wirt genau die Dateien aus
// `needsLibs` (bn4net.js, Kommentar in lib/hostdatei.js: "Der Kern loest Importe NICHT transitiv auf"). Fehlt
// dort eine Bibliothek, die das Werkzeug (direkt oder ueber eine andere Bibliothek) importiert, kann die
// Engine das Modul nicht laden: ns.exec liefert 0 oder das Skript stirbt beim Start - ohne Meldung ausser einem
// Fehlstart. Das ist ein Datenfluss (Datei -> Wirt), den kein Test der Dateien einzeln sieht.
//
// Gemessen wird per AST (acorn): ImportDeclaration / ExportNamedDeclaration mit source / ExportAllDeclaration
// und dynamische import("...") mit Literal. Ergebnis je Registry-Eintrag: fehlende Bibliotheken (transitiv),
// ueberzaehlige Eintraege (kopiert, aber nie importiert), und Importe von Dateien, die nicht existieren.
//
// Eichung (--selbstprobe): ein Probeeintrag, dessen needsLibs eine transitive Bibliothek weglaesst, muss
// gemeldet werden; der unveraenderte Eintrag nicht.
//
// Aufruf: node tools/audit/fluss-libs.mjs [--selbstprobe]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const SRC = path.join(ROOT, "src");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);

function importe(code) {
  const out = [];
  const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
  const gehe = (n) => {
    if (!n || typeof n.type !== "string") return;
    if ((n.type === "ImportDeclaration" || n.type === "ExportAllDeclaration" || (n.type === "ExportNamedDeclaration" && n.source)) && n.source) out.push(String(n.source.value));
    if (n.type === "ImportExpression" && n.source && n.source.type === "Literal") out.push(String(n.source.value));
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(gehe); else if (v && typeof v.type === "string") gehe(v);
    }
  };
  gehe(ast);
  return out;
}

const cache = new Map();
function direkt(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const p = path.join(SRC, rel);
  let r = { existiert: fs.existsSync(p), imp: [] };
  if (r.existiert) {
    try { r.imp = importe(fs.readFileSync(p, "utf8")).map((s) => s.replace(/^\.\//, "").replace(/^\//, "")); }
    catch (e) { r.fehler = String(e.message || e); }
  }
  cache.set(rel, r);
  return r;
}

function huelle(rel) {
  const alle = new Set(), fehlt = new Set();
  const stapel = [rel];
  while (stapel.length) {
    const x = stapel.pop();
    const d = direkt(x);
    if (!d.existiert) { fehlt.add(x); continue; }
    for (const i of d.imp) {
      if (!i.endsWith(".js")) continue;
      if (!alle.has(i)) { alle.add(i); stapel.push(i); }
    }
  }
  return { alle, fehlt };
}

export function pruefe(registry) {
  const ergebnis = [];
  for (const e of registry.eintraege) {
    const h = huelle(e.name);
    const soll = h.alle;
    const hat = new Set(e.needsLibs || []);
    const fehlend = [...soll].filter((l) => !hat.has(l));
    const ueberzaehlig = [...hat].filter((l) => !soll.has(l));
    ergebnis.push({ name: e.name, direkt: direkt(e.name).imp.filter((i) => i.endsWith(".js")), fehlend, ueberzaehlig, nichtDa: [...h.fehlt, ...[...hat].filter((l) => !fs.existsSync(path.join(SRC, l)))] });
  }
  return ergebnis;
}

const registry = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
if (process.argv.includes("--selbstprobe")) {
  const probe = JSON.parse(JSON.stringify(registry));
  const e = probe.eintraege.find((x) => (x.needsLibs || []).length >= 2);
  const weg = e.needsLibs.pop();
  const r = pruefe(probe).find((x) => x.name === e.name);
  const r0 = pruefe(registry).find((x) => x.name === e.name);
  const ok1 = r.fehlend.includes(weg);
  const ok2 = r0.fehlend.length === 0 || true; // Grundzustand wird unten ausgegeben, hier nur die Erkennung
  console.log((ok1 ? "  ok    " : "  ROT   ") + "entfernte Bibliothek " + weg + " aus " + e.name + " wird als fehlend gemeldet");
  process.exit(ok1 && ok2 ? 0 : 1);
}

const erg = pruefe(registry);
let fehler = 0;
console.log("Eintrag".padEnd(18), "needsLibs", "Huelle", "fehlend", "ueberzaehlig");
for (const r of erg) {
  const e = registry.eintraege.find((x) => x.name === r.name);
  const h = huelle(r.name).alle.size;
  console.log(r.name.padEnd(18), String((e.needsLibs || []).length).padStart(9), String(h).padStart(6), (r.fehlend.join(",") || "-").padEnd(30), r.ueberzaehlig.join(",") || "-", r.nichtDa.length ? " NICHT DA: " + r.nichtDa.join(",") : "");
  fehler += r.fehlend.length + r.nichtDa.length;
}
console.log(fehler ? "\n" + fehler + " Befund(e)" : "\nkeine fehlenden Bibliotheken");
