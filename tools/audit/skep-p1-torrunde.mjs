// Skeptiker P1 / AUG-4 (03.10.2026): Gegenprobe zu waehleTorRunde
// (Klon C:\Users\erche\Desktop\claude_projecto-bb-p1, Branch audit-p1-kaufaufschub).
//
// 1. COMBAT_AUGS gegen Augmentations.ts: fehlen Stuecke der Gang-Faktion, oder
//    stimmen Faktoren nicht?
// 2. Planer-Zuwachs gegen echte Competence (Action.ts:169-195 inkl.
//    getEffectiveSkillLevel, Bladeburner.ts:757-772 - Reaper/Evasive System).
// 3. Kosten der Planrunde / Konto (= Anteil des Kontos, den data/geldbedarf.txt
//    im gesperrten Zustand reserviert) bei voll verdientem Angebot.
// 4. Grenznutzen: letztes Stueck der Runde gegen eine NFG-Stufe.
//
// Aufruf: node tools/audit/skep-p1-torrunde.mjs [Spielstand]
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseAugs, gangOffer } from "./gang-augs.mjs";

const KLON = "C:/Users/erche/Desktop/claude_projecto-bb-p1";
const ROOT = "C:/Users/erche/Desktop/claude_projecto/bitburner";
const E = await import(pathToFileURL(path.join(KLON, "src/lib/einbau.js")).href);
const H = await import(pathToFileURL(path.join(KLON, "src/lib/hackaugs.js")).href);
const BO = JSON.parse(fs.readFileSync(path.join(KLON, "src/lib/blackops.json"), "utf8"));

const saveFile = process.argv[2]
  || path.join(ROOT, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T23-17_hourly.json.gz");
const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(saveFile)).toString("utf8"));
const p = JSON.parse(save.data.PlayerSave).data;
const bb = p.bladeburner.data || p.bladeburner;
const sk = bb.skills || {};
const effStr = (1 + 0.02 * (sk.Reaper || 0));
const effDex = effStr * (1 + 0.04 * (sk["Evasive System"] || 0));
const EFF = { strength: effStr, defense: effStr, dexterity: effDex, agility: effDex };

// ---- 1. COMBAT_AUGS gegen Spieldaten -------------------------------------
const SRCDIR = path.join(ROOT, "reference/bitburner-src/src");
const augTxt = fs.readFileSync(path.join(SRCDIR, "Augmentation/Augmentations.ts"), "utf8");
const augs = parseAugs();
const hackOf = (key) => {
  const i = augTxt.indexOf("[AugmentationName." + key + "]:");
  if (i < 0) return undefined;
  const body = augTxt.slice(i, i + 3000).split(/\n\s*\[AugmentationName\./)[0];
  const m = body.match(/\n\s*hacking:\s*([0-9.]+)\s*,/);
  return m ? Number(m[1]) : undefined;
};
const KEYS = ["strength", "defense", "dexterity", "agility"];
let fehlend = [], abweichend = [];
const offer = gangOffer(augs, 2, 1);
for (const a of [...offer, ...augs.filter((x) => x.factions.includes("Bladeburners"))]) {
  const relevant = KEYS.some((k) => (a[k] || 1) > 1) || (a.bb_success || 1) > 1;
  if (!relevant) continue;
  const c = H.COMBAT_AUGS[a.name];
  if (!c) { fehlend.push(a.name); continue; }
  for (const k of KEYS) if ((a[k] || 1) !== (c[k] || 1)) abweichend.push(a.name + " " + k + " spiel " + a[k] + " tabelle " + c[k]);
  if ((a.bb_success || 1) !== (c.bladeburner_success_chance || 1)) abweichend.push(a.name + " bb_success spiel " + a.bb_success + " tabelle " + c.bladeburner_success_chance);
  const h = hackOf(a.key);
  if ((h || 1) !== (c.hacking || 1)) abweichend.push(a.name + " hacking spiel " + h + " tabelle " + c.hacking);
}
console.log("== 1. COMBAT_AUGS gegen Augmentations.ts ==");
console.log("fehlend (" + fehlend.length + "): " + fehlend.join(", "));
console.log("abweichend (" + abweichend.length + "): " + abweichend.join(" | "));

// ---- 2. Planer gegen echte Competence -------------------------------------
const owned = new Set([...(p.augmentations || []), ...(p.queuedAugmentations || [])].map((a) => a.name));
const q0 = (p.queuedAugmentations || []).length;
const queued = (p.queuedAugmentations || []).map((a) => a.name);
const byName = Object.fromEntries(augs.map((a) => [a.name, a]));
const cand = offer.filter((a) => a.name !== "The Red Pill" && !owned.has(a.name)
  && H.kampfknotenNuetzlich(a.name, true) && H.COMBAT_AUGS[a.name])
  .map((a) => ({ aug: a.name, faktion: "Slum Snakes", rep: 1e12, repReq: a.repCost,
    preis: a.moneyCost * Math.pow(1.9, q0), prereq: a.prereqs, mults: H.COMBAT_AUGS[a.name] }));
const ty = E.blackOpWeights(BO, "Operation Typhoon");
const levels = { ...p.skills };
const startMults = E.gateMultsProduct(queued.map((n) => H.COMBAT_AUGS[n]));

// Echte Competence (ohne gemeinsame Faktoren): sum w*(eff*L*m)^d * bsc
function trueComp(extra, eff) {
  let c = 0;
  for (const s of Object.keys(ty.weights)) {
    const w = ty.weights[s]; if (!(w > 0)) continue;
    c += w * Math.pow((eff[s] || 1) * levels[s] * (extra[s] || 1), ty.decays[s]);
  }
  return c * (extra.bladeburner_success_chance || 1);
}
console.log("\n== 2. Planer gegen echte Competence (Reaper " + (sk.Reaper || 0) + ", Evasive " + (sk["Evasive System"] || 0)
  + ", eff Str " + effStr.toFixed(3) + ", eff Dex/Agi " + effDex.toFixed(3) + ", q0 " + q0 + ") ==");
const effLevels = { ...levels };
for (const k of KEYS) effLevels[k] = levels[k] * EFF[k];
for (const budget of [10e9, 30e9, 60e9, 150e9]) {
  const a = E.waehleTorRunde(cand, budget, owned, { skills: levels, weights: ty.weights, decays: ty.decays, startMults, priceStep: 1.9 });
  const b = E.waehleTorRunde(cand, budget, owned, { skills: effLevels, weights: ty.weights, decays: ty.decays, startMults, priceStep: 1.9 });
  const ex = (set) => E.gateMultsProduct([startMults, ...set.map((n) => H.COMBAT_AUGS[n])]);
  const real = (set) => trueComp(ex(set), EFF) / trueComp(ex([]), EFF);
  const same = a.seq.join("|") === b.seq.join("|");
  console.log("Budget " + (budget / 1e9) + " Mrd: Planer x" + a.gain.toFixed(3) + " (" + a.seq.length + " St., Kosten "
    + (a.cost / 1e9).toFixed(1) + "), echt x" + real(a.seq).toFixed(3)
    + " | mit eff-Stufen geplant: " + b.seq.length + " St., echt x" + real(b.seq).toFixed(3)
    + (same ? " (gleiche Runde)" : " (ANDERE Runde: " + b.seq.filter((n) => !a.seq.includes(n)).join(",") + " statt " + a.seq.filter((n) => !b.seq.includes(n)).join(",") + ")"));
}

// ---- 3. Reserve-Anteil: Plankosten / Konto ---------------------------------
console.log("\n== 3. data/geldbedarf.txt im gesperrten Zustand: Plankosten / Konto (alles verdient, q0 " + q0 + ") ==");
for (const budget of [1e9, 3e9, 10e9, 30e9, 100e9, 300e9]) {
  const a = E.waehleTorRunde(cand, budget, owned, { skills: levels, weights: ty.weights, decays: ty.decays, startMults, priceStep: 1.9 });
  const half = E.waehleTorRunde(cand, budget / 2, owned, { skills: levels, weights: ty.weights, decays: ty.decays, startMults, priceStep: 1.9 });
  console.log("Konto " + (budget / 1e9).toFixed(0).padStart(4) + " Mrd: Reserve " + (100 * a.cost / budget).toFixed(1) + " % ("
    + a.seq.length + " St., x" + a.gain.toFixed(3) + ") | halbes Konto: x" + half.gain.toFixed(3) + " (" + half.seq.length + " St.)"
    + " -> Verlust " + (100 * (1 - Math.log(half.gain) / Math.log(a.gain))).toFixed(1) + " % des log-Zuwachses");
}

// ---- 4. Letztes Planstueck gegen NFG --------------------------------------
console.log("\n== 4. Grenznutzen: letztes Planstueck gegen eine NFG-Stufe ==");
const nfgLvl = (p.augmentations || []).filter((a) => a.name === "NeuroFlux Governor").map((a) => a.level || 1)[0] || 0;
for (const budget of [30e9, 100e9]) {
  const a = E.waehleTorRunde(cand, budget, owned, { skills: levels, weights: ty.weights, decays: ty.decays, startMults, priceStep: 1.9 });
  const n = a.seq.length;
  const lastPrice = a.steps[n - 1].price;
  const without = E.waehleTorRunde(cand.filter((c) => c.aug !== a.seq[n - 1]), budget, owned, { skills: levels, weights: ty.weights, decays: ty.decays, startMults, priceStep: 1.9 });
  // NFG: Grundpreis 750k * 1.14^lvl, x1.9^(q0+n); alle Werte x1.01
  const nfgPrice = 750e3 * Math.pow(1.14, nfgLvl) * Math.pow(1.9, q0 + n);
  const nfgGain = Math.log(1.01) * 0.8; // grob: Kampfwerte dominieren, Exponent 0.8
  console.log("Budget " + (budget / 1e9) + " Mrd: letztes Stueck " + a.seq[n - 1] + " kostet " + (lastPrice / 1e9).toFixed(2)
    + " Mrd; NFG-Stufe " + (nfgLvl + 1) + " am Ende kostet " + (nfgPrice / 1e9).toFixed(2) + " Mrd, d log C je Stufe ~" + nfgGain.toFixed(4));
}
