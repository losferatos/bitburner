// VERSION-CHA (Audit 04.10.2026, Robustheit "Version 3.0.1 -> 3.0.2").
//
// Folge des Befunds "fuenf Charisma-Augmentierungen weichen zwischen dem LAUFENDEN Spiel (v301) und dem dev-Baum
// ab" (version-augs.mjs: 23 Spielstandpaare, Ist = Soll(v301) auf 5,6e-16, Soll(dev) bis 14 % daneben).
// netz-lab.mjs (NETZ-4, Audit 03.10.) rechnete die Charisma-Erfahrung fuer das Darknet-Labyrinth in BN15 mit dem
// dev-Katalog (Produkt aller kaeuflichen Charisma-Augs x22,51). Hier dieselbe Rechnung mit dem v301-Katalog.
//
// Eichung: (1) der dev-Lauf MUSS die Zahlen aus inventar-netz.md reproduzieren (Produkt 22,51; EternalLab-Zeile
// 3,8e30 / 4,5e16 / 4,8e9 / 8,4e3), sonst ist es nicht dieselbe Rechnung; (2) die Skill-Formel
// calculateSkill (skill.ts:7-15) wird gegen den juengsten Spielstand an Charisma, Hacking und Staerke geeicht.
//
// Aufruf: node tools/audit/version-cha.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bb-vcha-"));
async function lader(srcDir, name) {
  const f = path.join(tmp, name + ".mjs");
  fs.writeFileSync(f, loaderText.replace(MUSTER, "const SRC = " + JSON.stringify(srcDir) + ";"));
  return (await import(pathToFileURL(f).href)).loadAugs;
}
const live = (await lader(path.join(ROOT, "reference", "v301", "src"), "live"))();
const dev = (await lader(path.join(ROOT, "reference", "bitburner-src", "src"), "dev"))();

const calcSkill = (exp, mult) => Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
const calcExp = (skill, mult) => Math.exp((skill / mult + 200) / 32) - 534.6;

function kennzahlen(augs) {
  const cha = Object.values(augs).filter((a) => a.mults.charisma && a.mults.charisma > 1);
  const kaeuflich = cha.filter((a) => !a.isSpecial && a.factions.length);
  return { n: cha.length, alle: cha.reduce((s, a) => s * a.mults.charisma, 1), kaeuflich: kaeuflich.reduce((s, a) => s * a.mults.charisma, 1), nKauf: kaeuflich.length, liste: kaeuflich };
}
const kl = kennzahlen(live), kd = kennzahlen(dev);

// Spielstand (derselbe wie in netz-lab.mjs) fuer die Eichung der Skill-Formel und den Grundmult
const idx = fs.readFileSync(path.join(ROOT, "backups", "INDEX.tsv"), "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split("\t"));
const datei = path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T17-17_hourly.json.gz"); // derselbe Stand wie netz-lab.mjs
const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(datei)).toString("utf8"));
const p = JSON.parse(save.data.PlayerSave).data;
const bnLvl = { 2: { hacking: 0.8 } }[p.bitNodeN] || {};
let eichOk = 0, eichN = 0;
for (const s of ["hacking", "strength", "defense", "dexterity", "agility", "charisma"]) {
  const mult = p.mults[s] * (bnLvl[s] ?? 1);
  const ist = calcSkill(p.exp[s], mult);
  eichN++;
  if (ist === p.skills[s]) eichOk++;
}
console.log("Spielstand " + path.basename(datei) + " BN" + p.bitNodeN + ": Skill-Formel " + eichOk + "/" + eichN + " exakt (Eichung)");
if (eichOk !== eichN) { console.log("EICHUNG ROT"); process.exit(2); }

const BN15_CHA = 1.1;
const grund = p.mults.charisma;
const LABS = [["NormalLab 300", 300], ["CruelLab 600", 600], ["MercilessLab 1500", 1500], ["UberLab 2500", 2500], ["EternalLab 3000 (TRP)", 3000]];
function tabelle(name, k) {
  const mults = [1, 2, 4, Math.min(k.kaeuflich, 50)];
  console.log("\n" + name + ": " + k.n + " Charisma-Augs, Produkt aller " + k.alle.toFixed(2) + ", kaeuflich " + k.nKauf + " Stueck x" + k.kaeuflich.toFixed(2));
  console.log("  " + "Labor".padEnd(24) + mults.map((m) => ("Augs x" + m.toFixed(1)).padStart(14)).join(""));
  const out = {};
  for (const [lab, cha] of LABS) {
    const zeile = mults.map((m) => calcExp(cha, BN15_CHA * grund * m));
    out[lab] = zeile;
    console.log("  " + lab.padEnd(24) + zeile.map((v) => v.toExponential(1).padStart(14)).join(""));
  }
  return out;
}
const td = tabelle("dev (Grundlage netz-lab.mjs)", kd);
const tl = tabelle("v301 (LAUFENDES Spiel)", kl);

// Eichung gegen den Bericht: dev muss 22,51 und die EternalLab-Zeile liefern
const soll = { produkt: 22.51, eternal: [3.8e30, 4.5e16, 4.8e9, 8.4e3] };
const eternalDev = td["EternalLab 3000 (TRP)"];
const nah = (a, b) => Math.abs(a / b - 1) < 0.06;
const okDev = Math.abs(kd.kaeuflich - soll.produkt) < 0.01 && eternalDev.every((v, i) => nah(v, soll.eternal[i]));
console.log("\nEICHUNG dev gegen inventar-netz.md 4.3 (22,51; 3,8e30/4,5e16/4,8e9/8,4e3): " + (okDev ? "OK" : "ROT"));
if (!okDev) process.exit(2);

console.log("\nUnterschied der kaeuflichen Charisma-Augs (v301 gegen dev):");
for (const a of kl.liste) {
  const d = dev[a.name];
  if (d && d.mults.charisma !== a.mults.charisma) console.log("  " + a.name.padEnd(30) + "v301 x" + a.mults.charisma + "  dev x" + d.mults.charisma);
}
const el = tl["EternalLab 3000 (TRP)"], ed = td["EternalLab 3000 (TRP)"];
console.log("\nEternalLab 3000 bei vollem kaeuflichem Satz: v301 " + el[3].toExponential(2) + " exp, dev " + ed[3].toExponential(2) + " exp, Faktor " + (ed[3] / el[3]).toFixed(2));
const faktorProdukt = kl.kaeuflich / kd.kaeuflich;
console.log("Produkt kaeuflicher Charisma-Augs: v301 " + kl.kaeuflich.toFixed(2) + " / dev " + kd.kaeuflich.toFixed(2) + " = x" + faktorProdukt.toFixed(3));

// ---- Zusatz: wie viele kaeufliche Charisma-Augs (groesste zuerst) braucht EternalLab 3000 bei gegebenem Erfahrungsbudget?
function benoetigt(k, budgetExp) {
  // Mult m, so dass calcExp(3000, BN15_CHA * grund * m) = budget  (calcExp ist in m monoton fallend)
  const m = 3000 / (32 * Math.log(budgetExp + 534.6) - 200) / (BN15_CHA * grund);
  const sortiert = k.liste.map((a) => a.mults.charisma).sort((x, y) => y - x);
  let prod = 1, n = 0;
  for (const f of sortiert) { if (prod >= m) break; prod *= f; n++; }
  return { m, n, prod };
}
console.log("\nEternalLab 3000 (BN15, TRP): benoetigter Aug-Mult und Zahl der groessten Charisma-Augs");
for (const b of [1e7, 1e8, 1e9, 1e10]) {
  const l = benoetigt(kl, b), d = benoetigt(kd, b);
  console.log("  Erfahrungsbudget " + b.toExponential(0) + ": Mult >= " + l.m.toFixed(2) + "  -> v301 " + l.n + " Augs (Produkt " + l.prod.toFixed(2) + "), dev " + d.n + " Augs (Produkt " + d.prod.toFixed(2) + ")");
}
