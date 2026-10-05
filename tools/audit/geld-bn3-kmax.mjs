// Audit geldwert BN3 (05.10.2026): Obergrenzen von k je nach erreichbarer Aug-Menge (Ruf-Schranke) und Grafting.
// k wie geld-bn3-kist.mjs (Competence-Verhaeltnis, Gewichte der naechsten Black Op, Stufen BN2.3 19:26). Nur lesen.
import { loadBot, loadState, AUGS } from "./gang-p2b-lib.mjs";
import { kOf } from "./geld-bn3-kist.mjs";
const bot = await loadBot();
const S = loadState("LIVE_197f4d61481686_BN2L3_2026-10-05T19-26_pre-install.json.gz");
const bbs = Object.fromEntries(S.bb.skills.data || Object.entries(S.bb.skills));
const k = (names, op = "OperationTyphoon") => kOf(bot, S.p.skills, bbs["Reaper"], bbs["Evasive System"], names.map(n => bot.COMBAT_AUGS[n]).filter(Boolean), op).k;
const C = bot.COMBAT_AUGS;
const bb = Object.values(AUGS).filter(a => a.factions.includes("Bladeburners") && C[a.name] && a.name !== "The Blade's Simulacrum");
const small = ["Wired Reflexes", "Augmented Targeting I", "EsperTech Bladeburner Eyewear", "Neurotrainer I"];
const repBB = (lim) => bb.filter(a => a.repCost * 3 <= lim).map(a => a.name);
// Kosten einer Menge, teuerste zuerst, Preis x3 x 1,9^i
const cost = (names, pm = 3) => names.map(n => AUGS[n].moneyCost * pm).sort((a, b) => b - a).reduce((s, p, i) => s + p * Math.pow(1.9, i), 0);
const show = (lab, names) => console.log(`${lab.padEnd(58)} n=${String(names.length).padStart(2)}  k=${k(names).toFixed(3)}  Kosten Torrunde ${(cost(names)/1e9).toFixed(0)} Mrd`);
console.log("Bladeburner-Augs (ohne Simulacrum):", bb.map(a => `${a.name} ${a.repCost*3/1000}k/${(a.moneyCost*3/1e9).toFixed(2)}`).join("; "));
for (const lim of [79e3, 150e3, 200e3, 400e3]) show(`BB-Ruf ${lim/1000}k + Kleinkram (alles Erreichbare)`, [...new Set([...repBB(lim), ...small])]);
// BN2.3-Runde als Referenz
const q23 = S.p.queuedAugmentations.map(a => a.name);
show("Referenz BN2.3 Einbau (13 Stuecke aus der Gang-Faktion)", q23);
// Grafting: ruffrei, Preis = Grundpreis x 3 OHNE BN-Aufschlag (GraftableAugmentation.ts:20-21), keine 1,9-Kette
const graftTime = (n) => { const m = Object.values(AUGS[n].mults || {}).filter(x => x !== 1); const s = Math.max(1, m.reduce((a, b) => a + b, 0)); return (Math.log2(s) + 0.5) / 2; };
const plan = ["SPTN-97 Gene Modification", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Synthetic Heart", "Photosynthetic Cells", "CordiARC Fusion Reactor"];
let acc = [], h = 0, c = 0;
console.log("\nGraft-Reihe (graftplan.json-Reihenfolge, ohne Voraussetzungen-Pruefung), kumulativ, Entropie 0,98^n auf alle Mults:");
for (const n of plan) {
  acc.push(n); h += graftTime(n); c += AUGS[n].moneyCost * 3;
  const kk = k(acc) * Math.pow(0.98, acc.length) ** 0.8;   // Entropie wirkt auf Stufen, Zerfall 0,8
  console.log(`  + ${n.padEnd(34)} Graftzeit ${graftTime(n).toFixed(2)} h  kum. ${h.toFixed(1)} h  kum. Kosten ${(c/1e9).toFixed(1)} Mrd  k(nur Grafts) ~${kk.toFixed(2)}`);
}
