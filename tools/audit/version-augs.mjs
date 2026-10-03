// VERSION-AUGS (Audit 03.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// 1. Vergleicht die Augmentierungstabelle des Spiels v3.0.1 (LIVE) mit dev (3.0.2) - Namen, Preise,
//    Fraktionen, Voraussetzungen, Multiplikatoren.
// 2. Vergleicht die statische Tabelle AUG_TABLE in src/buyaugs.js mit beiden.
// 3. EICHUNG gegen echte Spielstaende: Player.mults.charisma ist das Produkt der Aug-Faktoren (NFG je
//    Stufe) mal Quellsatz-Faktoren. Zwischen zwei Staenden mit GLEICHER Quelldatei-Menge kuerzt sich
//    der Quellsatz-Faktor heraus: Verhaeltnis = Produkt der neu hinzugekommenen Aug-Faktoren. Das
//    wird fuer v301-Daten und dev-Daten vorhergesagt und mit dem gespeicherten Wert verglichen.
//
// Der Lader aus tools/audit/aug-data.mjs wird zur Laufzeit gepatcht (nur SRC-Pfad), nicht kopiert.
// Aufruf: node tools/audit/version-augs.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL, fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");
const loaderText = fs.readFileSync(path.join(HIER, "aug-data.mjs"), "utf8");
const MUSTER = 'const SRC = path.resolve(here, "../../reference/bitburner-src/src");';
if (!loaderText.includes(MUSTER)) throw new Error("aug-data.mjs: SRC-Zeile hat sich geaendert");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bb-vaug-"));
async function lader(srcDir, name) {
  const t = loaderText.replace(MUSTER, "const SRC = " + JSON.stringify(srcDir) + ";");
  const f = path.join(tmp, name + ".mjs");
  fs.writeFileSync(f, t);
  return (await import(pathToFileURL(f).href)).loadAugs;
}
const loadLive = await lader(path.join(ROOT, "reference", "v301", "src"), "live");
const loadDev = await lader(path.join(ROOT, "reference", "bitburner-src", "src"), "dev");
const live = loadLive();
const dev = loadDev();

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
console.log("Augmentierungen: live(v301) " + Object.keys(live).length + ", dev " + Object.keys(dev).length);
const unterschiede = [];
for (const n of new Set([...Object.keys(live), ...Object.keys(dev)])) {
  const a = live[n], b = dev[n];
  if (!a || !b) { unterschiede.push({ n, art: a ? "nur live" : "nur dev" }); continue; }
  for (const k of ["repCost", "moneyCost", "isSpecial"]) if (a[k] !== b[k]) unterschiede.push({ n, art: k, live: a[k], dev: b[k] });
  if (!eq([...a.factions].sort(), [...b.factions].sort())) unterschiede.push({ n, art: "factions", live: a.factions.join("|"), dev: b.factions.join("|") });
  if (!eq([...a.prereqs].sort(), [...b.prereqs].sort())) unterschiede.push({ n, art: "prereqs", live: a.prereqs.join("|"), dev: b.prereqs.join("|") });
  for (const k of new Set([...Object.keys(a.mults), ...Object.keys(b.mults)])) {
    const x = a.mults[k], y = b.mults[k];
    if (x === undefined || y === undefined || Math.abs(x - y) > 1e-12) unterschiede.push({ n, art: "mult." + k, live: x, dev: y });
  }
}
console.log("\nUNTERSCHIEDE live(v301) <-> dev: " + unterschiede.length);
for (const u of unterschiede) console.log("  " + u.n.padEnd(40) + u.art.padEnd(22) + "live=" + u.live + "  dev=" + u.dev);

// ------------------------------------------------------------------ bot-Tabelle
const bu = fs.readFileSync(path.join(ROOT, "src", "buyaugs.js"), "utf8");
const a0 = bu.indexOf("const AUG_TABLE = [");
const a1 = bu.indexOf("\n];", a0);
const tabText = bu.slice(a0 + "const AUG_TABLE = ".length, a1 + 2);
const AUG_TABLE = Function("return (" + tabText + ")")();
console.log("\nbuyaugs.js AUG_TABLE: " + AUG_TABLE.length + " Eintraege (Zeile " + (bu.slice(0, a0).split("\n").length) + ")");
function gegen(ref, name) {
  const abw = [];
  for (const [n, rep, geld, fak, pre, mults] of AUG_TABLE) {
    const r = ref[n];
    if (!r) { abw.push(n + ": nicht im Spiel " + name); continue; }
    if (r.repCost !== rep && !(rep === Infinity && r.repCost === Infinity)) abw.push(n + ": repCost bot=" + rep + " " + name + "=" + r.repCost);
    if (r.moneyCost !== geld) abw.push(n + ": moneyCost bot=" + geld + " " + name + "=" + r.moneyCost);
    for (const k of new Set([...Object.keys(mults), ...Object.keys(r.mults)])) {
      const x = mults[k], y = r.mults[k];
      if (x === undefined || y === undefined || Math.abs(x - y) > 1e-9) abw.push(n + ": mult." + k + " bot=" + x + " " + name + "=" + y);
    }
  }
  return abw;
}
const gl = gegen(live, "live");
const gd = gegen(dev, "dev");
console.log("AUG_TABLE gegen LIVE (v301): " + gl.length + " Abweichungen");
for (const l of gl) console.log("   " + l);
console.log("AUG_TABLE gegen dev: " + gd.length + " Abweichungen");
for (const l of gd.slice(0, 30)) console.log("   " + l);

// ------------------------------------------------------------------ Eichung gegen Spielstaende
const idx = fs.readFileSync(path.join(ROOT, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
const dateien = [];
for (const r of idx) {
  const f = [r[9], r[10], path.join(ROOT, "backups", r[1])].find((x) => x && fs.existsSync(x));
  if (f) dateien.push({ ts: r[0], f, bn: r[4], lauf: r[5] });
}
function holeStand(f) {
  const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
  const p = JSON.parse(s.data.PlayerSave).data;
  const sf = p.sourceFiles && p.sourceFiles.data ? Object.fromEntries(p.sourceFiles.data) : {};
  return { augs: p.augmentations, mults: p.mults, sf, exp: p.exploits, entropy: p.entropy };
}
const NFG = "NeuroFlux Governor";
// Faktor der Augs (nur charisma); NFG je Stufe. donations: NFG-Faktor 1.01+donationBonus ist im Lader mit
// donations=262 gerechnet; die Abweichung ist < 3e-6 je Stufe und kuerzt sich bei gleicher Stufe heraus.
function augFaktor(ref, list) {
  let f = 1;
  for (const a of list) {
    const d = ref[a.name];
    if (!d) return NaN;
    const m = d.mults.charisma ?? 1;
    f *= a.name === NFG ? Math.pow(m, a.level) : m;
  }
  return f;
}
const gesehen = new Set();
const paare = [];
let vorher = null;
for (const d of dateien) {
  let st;
  try { st = holeStand(d.f); } catch { continue; }
  const key = JSON.stringify(st.sf) + "|" + JSON.stringify(st.exp) + "|" + st.entropy;
  if (vorher && vorher.key === key && vorher.bn === d.bn && vorher.lauf === d.lauf) {
    // nur Staende, deren Aug-Menge sich geaendert hat
    const na = new Set(st.augs.map((a) => a.name + ":" + a.level));
    const va = new Set(vorher.st.augs.map((a) => a.name + ":" + a.level));
    const gleich = na.size === va.size && [...na].every((x) => va.has(x));
    if (!gleich) {
      const hinzu = st.augs.filter((a) => !va.has(a.name + ":" + a.level) && !(a.name === NFG));
      const nfgNeu = (st.augs.find((a) => a.name === NFG) || { level: 0 }).level - (vorher.st.augs.find((a) => a.name === NFG) || { level: 0 }).level;
      const weg = vorher.st.augs.filter((a) => !na.has(a.name + ":" + a.level) && a.name !== NFG);
      if (!weg.length) paare.push({ von: vorher.ts, nach: d.ts, hinzu: hinzu.map((a) => a.name), nfgNeu, a: vorher.st, b: st });
    }
  }
  vorher = { key, st, ts: d.ts, bn: d.bn, lauf: d.lauf };
}
console.log("\nEICHUNG gegen Spielstaende: " + paare.length + " Paare mit gleicher Quelldatei-Menge und wachsender Aug-Menge");
const DIFFNAMEN = new Set(unterschiede.filter((u) => u.art === "mult.charisma").map((u) => u.n));
let gez = 0;
const zeilen = [];
for (const p of paare) {
  const rA = Number(p.a.mults.charisma), rB = Number(p.b.mults.charisma);
  if (!(rA > 0 && rB > 0)) continue;
  const ist = rB / rA;
  // vorhergesagt: neu hinzugekommene Augs + NFG-Stufen
  const addAugs = p.b.augs.filter((x) => p.hinzu.includes(x.name)).map((x) => ({ name: x.name, level: 1 }));
  const nfg = Math.max(0, p.nfgNeu);
  const faktor = (ref) => augFaktor(ref, addAugs) * Math.pow(ref[NFG].mults.charisma ?? 1, nfg);
  const pl = faktor(live), pd = faktor(dev);
  const beruehrt = p.hinzu.some((n) => DIFFNAMEN.has(n));
  zeilen.push({ von: p.von.slice(0, 16), nach: p.nach.slice(0, 16), beruehrt, ist, live: pl, dev: pd, fl: Math.abs(ist / pl - 1), fd: Math.abs(ist / pd - 1), hinzu: p.hinzu.filter((n) => DIFFNAMEN.has(n)).join(",") });
  gez++;
}
const b = zeilen.filter((z) => z.beruehrt);
const nb = zeilen.filter((z) => !z.beruehrt);
const maxF = (arr, k) => arr.length ? Math.max(...arr.map((z) => z[k])) : NaN;
console.log("  Paare ohne betroffene Aug (Kontrollgruppe): " + nb.length + "  max |Ist/Soll-1| live=" + maxF(nb, "fl").toExponential(2) + " dev=" + maxF(nb, "fd").toExponential(2));
console.log("  Paare MIT betroffener Aug: " + b.length);
for (const z of b.slice(0, 40)) {
  console.log("    " + z.von + " -> " + z.nach + "  +" + z.hinzu + "  Ist=" + z.ist.toFixed(6) + "  Soll live=" + z.live.toFixed(6) + " (Abw " + z.fl.toExponential(1) + ")  Soll dev=" + z.dev.toFixed(6) + " (Abw " + z.fd.toExponential(1) + ")");
}
console.log("  max Abweichung betroffen: live=" + maxF(b, "fl").toExponential(2) + "  dev=" + maxF(b, "fd").toExponential(2));
fs.rmSync(tmp, { recursive: true, force: true });

// ------------------------------------------------------------------ lib/hackaugs.js (im Bot-Registry)
{
  const m = await import(pathToFileURL(path.join(ROOT, "src", "lib", "hackaugs.js")).href);
  const pruefe = (tab, tname) => {
    let nL = 0, nD = 0, fehlt = 0;
    const meld = [];
    for (const [n, mults] of Object.entries(tab)) {
      for (const [side, ref, cnt] of [["live", live, "L"], ["dev", dev, "D"]]) {
        const r = ref[n];
        if (!r) { if (side === "live") fehlt++; meld.push(tname + " " + n + ": nicht in " + side); continue; }
        for (const [k, v] of Object.entries(mults)) {
          const w = r.mults[k];
          if (w === undefined || Math.abs(w - v) > 1e-9) {
            if (cnt === "L") nL++; else nD++;
            meld.push(tname + " " + n + "." + k + " bot=" + v + " " + side + "=" + w);
          }
        }
      }
    }
    console.log("\n" + tname + ": " + Object.keys(tab).length + " Eintraege; Abweichungen live=" + nL + ", dev=" + nD + ", fehlt=" + fehlt);
    for (const x of meld.slice(0, 20)) console.log("   " + x);
  };
  if (m.HACK_AUGS) pruefe(m.HACK_AUGS, "HACK_AUGS");
  if (m.COMBAT_AUGS) pruefe(m.COMBAT_AUGS, "COMBAT_AUGS");
}
