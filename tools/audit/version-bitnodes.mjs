// VERSION-BITNODES (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// src/lib/bitnodes.json wird von tools/bitnodes-tabelle.js aus reference/bitburner-src (dev) erzeugt;
// der Kopfkommentar dort behauptet "das Spiel laeuft auf 3.0.2". Der Spielstand zeigt 3.0.1.
// Dieses Werkzeug laesst DENSELBEN Generator (Quelltext zur Laufzeit gepatcht: nur Quellverzeichnis und
// Ausgabeziel) einmal gegen v301 und einmal gegen dev laufen - ohne src/ zu beruehren - und vergleicht
// beide Tabellen mit der eingecheckten src/lib/bitnodes.json.
//
// Eichung: Der dev-Lauf MUSS die eingecheckte Tabelle (bis auf erzeugtAm) reproduzieren; sonst ist der
// Generator nicht derselbe und der v301-Lauf wertlos.
//
// Aufruf: node tools/audit/version-bitnodes.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const gen = fs.readFileSync(path.join(ROOT, "tools", "bitnodes-tabelle.js"), "utf8");

const ersetze = (text, von, nach) => {
  if (!text.includes(von)) throw new Error("Muster fehlt im Generator: " + von.slice(0, 60));
  return text.replace(von, nach);
};
let p = gen;
p = ersetze(p, 'const REF = path.join(ROOT, "reference", "bitburner-src", "src", "BitNode");', "const REF = process.env.VB_REF;");
p = ersetze(p, 'fs.writeFileSync(ziel, JSON.stringify(ausgabe, null, 1), "utf8");', 'fs.writeFileSync(process.env.VB_OUT, JSON.stringify(ausgabe, null, 1), "utf8");');
// "weg"-Pruefung gegen die bestehende Tabelle ueberspringen (Ziel zeigt sonst auf src/)
p = ersetze(p, "if (fs.existsSync(ziel) && !process.argv.includes", "if (false && fs.existsSync(ziel) && !process.argv.includes");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bb-vbn-"));
const genDatei = path.join(tmp, "gen.mjs");
fs.writeFileSync(genDatei, p);
function lauf(name, ref) {
  const out = path.join(tmp, name + ".json");
  const r = spawnSync(process.execPath, [genDatei], { env: { ...process.env, VB_REF: ref, VB_OUT: out }, encoding: "utf8" });
  if (r.status !== 0) { console.log("Generator-Lauf " + name + " fehlgeschlagen:\n" + r.stdout + r.stderr); process.exit(2); }
  return JSON.parse(fs.readFileSync(out, "utf8"));
}
const live = lauf("live", path.join(ROOT, "reference", "v301", "src", "BitNode"));
const dev = lauf("dev", path.join(ROOT, "reference", "bitburner-src", "src", "BitNode"));
const bot = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "bitnodes.json"), "utf8"));

const flach = (t) => {
  const o = {};
  for (const [k, v] of Object.entries(t.standard)) o["standard." + k] = v;
  for (const [n, f] of Object.entries(t.knoten)) for (const [k, v] of Object.entries(f)) o["BN" + n + "." + k] = v;
  for (const [n, st] of Object.entries(t.knotenLevel || {})) for (const [s, f] of Object.entries(st)) for (const [k, v] of Object.entries(f)) o["BN" + n + ".L" + s + "." + k] = v;
  return o;
};
const fl = flach(live), fd = flach(dev), fb = flach(bot);
const diff = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const k of [...keys].sort()) {
    const x = a[k], y = b[k];
    if (x === undefined) out.push({ k, a: "fehlt", b: y });
    else if (y === undefined) out.push({ k, a: x, b: "fehlt" });
    else if (Math.abs(x - y) > 1e-12 * Math.max(1, Math.abs(x))) out.push({ k, a: x, b: y });
  }
  return out;
};
const eichung = diff(fd, fb);
console.log("EICHUNG dev-Lauf gegen eingecheckte src/lib/bitnodes.json: " + eichung.length + " Abweichungen " + (eichung.length === 0 ? "(OK: Generator reproduziert die Tabelle)" : "ROT"));
for (const d of eichung) console.log("   " + d.k + "  dev=" + d.a + "  bot=" + d.b);
console.log("\nv301 (LIVE) gegen eingecheckte Tabelle (bot):");
const d1 = diff(fl, fb);
for (const d of d1) console.log("   " + d.k + "  live(v301)=" + d.a + "  bot=" + d.b);
console.log("   -> " + d1.length + " Abweichungen");
console.log("Anzahl Felder: live " + Object.keys(fl).length + ", dev " + Object.keys(fd).length + ", bot " + Object.keys(fb).length);
fs.rmSync(tmp, { recursive: true, force: true });
