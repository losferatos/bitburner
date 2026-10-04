// FLUSS-REGISTRY (Audit 03.10.2026): Welche Felder der Registry (src/registry.json) liest irgendein Code?
//
// Frage: Jedes Feld eines Registry-Eintrags ist ein Kanal vom Bauwerkzeug (tools/registry-bauen.js) zum
// Kern. Ein Feld, das kein Leser nennt, ist Konfiguration ohne Wirkung (der Pflegeaufwand laeuft ins Leere,
// und ein Mensch, der den Wert aendert, glaubt etwas zu steuern). Gemessen wird per AST (acorn): ein Feld
// gilt als gelesen, wenn irgendwo ein Eigenschaftszugriff .feld, ["feld"] oder eine Destrukturierung {feld}
// mit diesem Namen steht - in den Dateien, die die Registry laden.
//
// Eichung (Selbstprobe, --selbstprobe): ein erfundenes Feld "zzzNiemandLiest" im Eintrag muss als
// ungelesen auftauchen, ein bekanntes ("hostRule", gelesen in lib/reg.js) als gelesen.
//
// Aufruf: node tools/audit/fluss-registry.mjs [--selbstprobe]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const acorn = await import(pathToFileURL(path.join(ROOT, "reference", "v301", "node_modules", "acorn", "dist", "acorn.mjs")).href);

function sammle(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? rel + "/" + e.name : e.name;
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "archiv") out.push(...sammle(dir, r)); }
    else if (r.endsWith(".js")) out.push(r);
  }
  return out;
}

/** Alle Eigenschaftsnamen, die in einer Datei als Zugriff, Schluessel oder Muster vorkommen. */
function namen(code) {
  const s = new Set();
  const ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module", allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
  const gehe = (n) => {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "MemberExpression") {
      if (!n.computed && n.property.type === "Identifier") s.add(n.property.name);
      else if (n.computed && n.property.type === "Literal") s.add(String(n.property.value));
    } else if (n.type === "Property" && !n.computed) {
      if (n.key.type === "Identifier") s.add(n.key.name);
      else if (n.key.type === "Literal") s.add(String(n.key.value));
    }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(gehe); else if (v && typeof v.type === "string") gehe(v);
    }
  };
  gehe(ast);
  return s;
}

export function pruefeRegistry(registry, dateien) {
  const felder = new Set();
  for (const e of registry.eintraege) for (const k of Object.keys(e)) felder.add(k);
  const praecond = new Set();
  for (const e of registry.eintraege) for (const k of Object.keys(e.precondition || {})) praecond.add(k);
  const leser = new Map(); // feld -> Dateien
  for (const [rel, code] of dateien) {
    let ns;
    try { ns = namen(code); } catch { continue; }
    for (const f of [...felder, ...praecond]) if (ns.has(f)) { if (!leser.has(f)) leser.set(f, []); leser.get(f).push(rel); }
  }
  return { felder: [...felder], praecond: [...praecond], leser };
}

const argv = process.argv.slice(2);
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "registry.json"), "utf8"));

if (argv.includes("--selbstprobe")) {
  const probe = JSON.parse(JSON.stringify(registry));
  probe.eintraege[0].zzzNiemandLiest = 1;
  const dateien = sammle(path.join(ROOT, "src")).map((r) => [r, fs.readFileSync(path.join(ROOT, "src", r), "utf8")]);
  const r = pruefeRegistry(probe, dateien);
  const ok1 = !r.leser.has("zzzNiemandLiest");
  const ok2 = r.leser.has("hostRule");
  console.log((ok1 ? "  ok    " : "  ROT   ") + "erfundenes Feld wird als ungelesen gefunden");
  console.log((ok2 ? "  ok    " : "  ROT   ") + "hostRule wird als gelesen erkannt: " + (r.leser.get("hostRule") || []).join(","));
  process.exit(ok1 && ok2 ? 0 : 1);
}

// src/ zaehlt als Leser im Spiel; tools/ und sync/ als Leser auf dem Host
const srcD = sammle(path.join(ROOT, "src")).map((r) => ["src/" + r, fs.readFileSync(path.join(ROOT, "src", r), "utf8")]);
const hostD = [];
for (const d of ["tools", "sync"]) {
  for (const r of sammle(path.join(ROOT, d))) {
    if (/(^|\/)test-/.test(r) || r.startsWith("audit/") || r.startsWith("mock/")) continue;
    hostD.push([d + "/" + r, fs.readFileSync(path.join(ROOT, d, r), "utf8")]);
  }
}
const imSpiel = pruefeRegistry(registry, srcD);
const amHost = pruefeRegistry(registry, hostD);
console.log("Feld".padEnd(20), "Leser in src/ (Spiel)".padEnd(50), "Leser in tools/ + sync/");
for (const f of [...imSpiel.felder, ...imSpiel.praecond.map((p) => "precondition." + p)]) {
  const k = f.replace("precondition.", "");
  const a = imSpiel.leser.get(k) || [];
  const b = amHost.leser.get(k) || [];
  console.log(f.padEnd(20), (a.length ? a.slice(0, 4).join(",") + (a.length > 4 ? ",+" + (a.length - 4) : "") : "KEINER").padEnd(50),
    b.length ? b.slice(0, 3).join(",") + (b.length > 3 ? ",+" + (b.length - 3) : "") : "-");
}
