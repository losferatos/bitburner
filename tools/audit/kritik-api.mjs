// Vollstaendigkeitskritik (Audit 04.10.2026): jede Netscript-Funktion der LIVE-Fassung (v3.0.1)
// gegen alle Inventarberichte pruefen. Nur lesen.
//
// Quelle: reference/v301/src/ScriptEditor/NetscriptDefinitions.d.ts (laufendes Spiel, siehe
// robust-version.md Abschnitt 2) und zum Vergleich reference/bitburner-src (dev).
// Vorgehen: jede "export interface X {"-Klammer lesen, Methoden-Signaturen "  name(" bzw.
// "  name: (" auf Einrueckungsebene 2 sammeln, Namespaces ueber die NS-Felder
// ("readonly gang: Gang;") zuordnen. Danach jeden Namen in nodes/audit-2026-10-03/
// inventar-*.md, bn-*.md, robust-*.md suchen (Wortgrenze).
//
// Selbstprobe: ein erfundener Name MUSS als "fehlt" gemeldet werden, ein bekannter
// (purchaseAugmentation) als "gefunden" - sonst bricht das Skript ab.
//
// Aufruf: node tools/audit/kritik-api.mjs [--dev] [--all]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const useDev = process.argv.includes("--dev");
const DTS = useDev
  ? path.join(ROOT, "reference", "bitburner-src", "src", "ScriptEditor", "NetscriptDefinitions.d.ts")
  : path.join(ROOT, "reference", "v301", "src", "ScriptEditor", "NetscriptDefinitions.d.ts");
const AUD = path.join(ROOT, "nodes", "audit-2026-10-03");

const text = fs.readFileSync(DTS, "utf8");
const lines = text.split(/\r?\n/);

// Interfaces mit ihren Methoden einsammeln
const ifaces = {};
for (let i = 0; i < lines.length; i++) {
  const m = /^(?:export )?interface (\w+)[^{]*\{\s*$/.exec(lines[i]);
  if (!m) continue;
  const name = m[1];
  const methods = [];
  const fields = [];
  let depth = 1;
  for (let j = i + 1; j < lines.length && depth > 0; j++) {
    const l = lines[j];
    // Kommentarzeilen (JSDoc mit {@link ...}) nicht zaehlen, sonst stimmt die Klammertiefe nicht
    if (/^\s*(\/\*\*|\*|\*\/)/.test(l)) continue;
    const code = l.replace(/\/\/.*$/, "");
    if (depth === 1) {
      let mm = /^ {2}(\w+)\??\s*(<[^>]*>)?\(/.exec(code);
      if (mm) methods.push(mm[1]);
      mm = /^ {2}(\w+)\??\s*:\s*\(/.exec(code);
      if (mm) methods.push(mm[1]);
      mm = /^ {2}(?:readonly )?(\w+)\??\s*:\s*(\w+)\s*;/.exec(code);
      if (mm) fields.push([mm[1], mm[2]]);
    }
    for (const ch of code) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }
  ifaces[name] = { methods: [...new Set(methods)], fields };
}

// Namespaces ueber NS-Felder aufloesen (rekursiv eine Ebene: formulas.*, corporation ...)
const ns = ifaces.NS;
if (!ns) throw new Error("NS-Interface nicht gefunden");
const groups = { ns: ns.methods };
const visit = (prefix, ifName, d) => {
  const it = ifaces[ifName];
  if (!it || d > 2) return;
  groups[prefix] = it.methods;
  for (const [f, t] of it.fields) if (ifaces[t] && ifaces[t].methods.length) visit(prefix + "." + f, t, d + 1);
};
for (const [f, t] of ns.fields) if (ifaces[t] && ifaces[t].methods.length) visit("ns." + f, t, 1);

// Inventartexte
const files = fs.readdirSync(AUD).filter((f) => /^(inventar|bn|robust)-.*\.md$/.test(f));
const corpus = files.map((f) => [f, fs.readFileSync(path.join(AUD, f), "utf8")]);
const where = (name) => {
  const re = new RegExp("(^|[^A-Za-z0-9_])" + name + "([^A-Za-z0-9_]|$)");
  return corpus.filter(([, t]) => re.test(t)).map(([f]) => f.replace(/\.md$/, ""));
};

// Selbstprobe
if (where("purchaseAugmentation").length === 0) throw new Error("Selbstprobe: bekannter Name nicht gefunden");
if (where("zzErfundeneFunktionQq").length !== 0) throw new Error("Selbstprobe: erfundener Name gefunden");

let total = 0, missing = 0;
const out = [];
for (const [g, ms] of Object.entries(groups)) {
  const miss = [];
  for (const m of ms) {
    total++;
    const w = where(m);
    if (w.length === 0) { missing++; miss.push(m); }
    else if (process.argv.includes("--all")) out.push(`  ${g}.${m}: ${w.join(",")}`);
  }
  out.push(`${g}: ${ms.length} Funktionen, ohne Fundstelle ${miss.length}${miss.length ? ": " + miss.join(", ") : ""}`);
}
console.log(`Quelle: ${path.relative(ROOT, DTS)}; Berichte: ${files.length}`);
console.log(out.join("\n"));
console.log(`SUMME: ${total} Funktionen, ${missing} ohne jede Fundstelle in den Inventaren`);
