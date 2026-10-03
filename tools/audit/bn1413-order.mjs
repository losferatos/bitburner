// Audit 03.10.2026, Gruppe BN14-13: zwei Rechnungen, die der STGO-Bericht
// (nodes/audit-2026-10-03/inventar-stgo.md) offen laesst.
//
// (1) IPvGO in BN14.2/14.3: dort ist SF14.1 aktiv, der Go-Bonus ist also
//     GoPower 4 x SF14-Bonus 2 = x8 (Go/effects/effect.ts:16-22, :18
//     sourceFileBonus = activeSourceFileLvl(14) ? 2 : 1). stgo-gain.mjs rechnet
//     alle drei BN14-Laeufe mit x4.
// (2) Reihenfolge BN14 -> BN13 (Route) gegen BN13 -> BN14: Was bringt SF14 in
//     BN13 (Go x2 statt x1) gegen SF13.3 in BN14 (Stanek mit Power 0,5,
//     Gitter 9-1+3 = 11 -> 6x6, BitNode.tsx:1078-1079, StaneksGift.ts:22-31)?
//
// Kette (geeicht in stgo-blade.mjs, hier am selben Spielstand neu geeicht):
//   Stufen-Faktor f -> Stufen (skill.ts) -> Typhoon-Chance (Action.ts:169-196).
// Ungeeicht: Go-Formel, Spielstaerke (stgo-go.mjs simulate), Stanek-Formel,
// und die Umrechnung Chance-Faktor -> Stunden (Modell aus stgo-gain.mjs:
// h = Vorphasenanteil x Laufdauer x ln(k) / ln(K)).
//
// Aufruf: node tools/audit/bn1413-order.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadState, blackOpChance, TYPHOON, skillsWithCombatFactor } from "./stgo-blade.mjs";
import { simulate, calculateEffect } from "./stgo-go.mjs";
import { effect as stanekEffect, gridSize } from "./stgo-stanek.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FILE = path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");

function homeFile(d, name) {
  const all = JSON.parse(d.AllServersSave);
  const home = all.home?.data ?? all.home;
  const tf = home.textFiles;
  const list = Array.isArray(tf) ? tf : (tf.data ?? Object.entries(tf));
  for (const e of list) {
    const n = e?.data?.filename ?? e?.[0] ?? e?.filename;
    const t = e?.data?.text ?? e?.[1]?.data?.text ?? e?.text;
    if (n === name) return t;
  }
  return null;
}

const { d, p, bb } = loadState(FILE);
const team = bb.blackOperations?.["Operation Typhoon"]?.data?.teamCount ?? 0;
const base = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
const baseLive = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.stamina, bb.maxStamina, team);
const soll = JSON.parse(homeFile(d, "data/blade.json")).boChancen?.["Operation Typhoon"];
console.log(`Eichung Typhoon-Chance (Spielstand ${path.basename(FILE)}): gerechnet ${baseLive.toFixed(4)}  blade.json ${soll}  `
  + `Abw. ${(100 * (baseLive / soll - 1)).toFixed(2)} %  ${Math.abs(baseLive / soll - 1) < 0.01 ? "OK" : "ABWEICHUNG"}`);

const chanceFactor = (f) => blackOpChance(TYPHOON, skillsWithCombatFactor(p, f), bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team) / base;

// Stundenmodell wie stgo-gain.mjs (dort begruendet): K = 0,9/0,0867, Vorphase 46,6/69,7
const K = 0.9 / 0.0867;
const SHARE = 46.6 / 69.7;
const hours = (k, T) => SHARE * T * Math.log(k) / Math.log(K);
const T_LO = 50, T_HI = 100; // gemessene V2-Laufdauern BN9L3 53,6 h ... BN10L2 > 105 h (bn1413-eta.mjs)

const SZ = [
  { name: "pessimistisch", sec: 30, pWin: 0.15, scoreWin: 22, scoreLoss: 6 },
  { name: "mittel", sec: 25, pWin: 0.35, scoreWin: 25, scoreLoss: 10 },
  { name: "optimistisch", sec: 20, pWin: 0.6, scoreWin: 28, scoreLoss: 12 },
];
// Mittel ueber einen 12-h-Einbauzyklus (Bestand waechst; Reset bei Einbau, Go.ts:160-190)
const goMean = (s, goPower, sf14) => simulate({ opp: "Tetrads", secPerGame: s.sec, pWin: s.pWin, scoreWin: s.scoreWin,
  scoreLoss: s.scoreLoss, hours: 12, goPower, sf14 }).effectMean;

console.log("\n(1) Go Tetrads, 12-h-Zyklusmittel -> Chance-Faktor k -> Stunden je Lauf (T 50..100 h)");
console.log("    Fall                         Szenario        Stufen-Faktor  k(Chance)  h je Lauf");
const rows1 = [["BN14.1  (GoPower 4, SF14.0)", 4, 0], ["BN14.2/3 (GoPower 4, SF14.1+)", 4, 1],
  ["BN13 mit SF14 (Route)", 1, 1], ["BN13 ohne SF14 (umgedreht)", 1, 0]];
const res = {};
for (const [lab, gp, sf] of rows1) {
  for (const s of SZ) {
    const f = goMean(s, gp, sf);
    const k = chanceFactor(f);
    const h = [hours(k, T_LO), hours(k, T_HI)];
    (res[lab] ||= {})[s.name] = h;
    console.log(`    ${lab.padEnd(30)} ${s.name.padEnd(14)} x${f.toFixed(3).padStart(6)}     x${k.toFixed(3)}    ${h[0].toFixed(1)}-${h[1].toFixed(1)}`);
  }
}
console.log("    STGO-1 (stgo-gain.mjs) setzte fuer ALLE drei BN14-Laeufe k 1,40-1,65 an -> "
  + `${hours(1.40, 60).toFixed(1)}-${hours(1.65, 60).toFixed(1)} h je Lauf (T 60 h).`);

console.log("\n(2) Stanek in BN14 nur bei umgedrehter Reihenfolge (SF13.3 aktiv): Power 0,5, ExtraSize -1");
const g = gridSize(-1, 3);
console.log(`    Gitter BN14 mit SF13.3: base ${g.base} -> ${g.w}x${g.h} (StaneksGift.ts:22-31)`);
const rows2 = [];
for (const T of [250, 1000, 5000]) {
  // Kampf-Fragment power 2 (Fragment.ts:149-187), ein Booster 1,1, N = 200 Ladungen, Genesis 0,9
  const fNet = stanekEffect(T, 200, 2, 1.1, 0.5) * 0.9;
  const k = chanceFactor(fNet);
  rows2.push([T, fNet, k]);
  console.log(`    ${String(T).padStart(5)} Faeden: Stufen-Faktor netto x${fNet.toFixed(3)}  k x${k.toFixed(3)}  `
    + `h je Lauf ${hours(Math.max(k, 1), T_LO).toFixed(1)}-${hours(Math.max(k, 1), T_HI).toFixed(1)}${k < 1 ? "  (Verlust - Genesis frisst den Bonus)" : ""}`);
}
// Break-even Faeden in BN14
let be = null;
for (let T = 1; T < 1e6; T = Math.ceil(T * 1.05)) { if (stanekEffect(T, 200, 2, 1.1, 0.5) * 0.9 >= 1) { be = T; break; } }
console.log(`    Break-even gegen Genesis 0,9: ${be} Faeden`);

console.log("\n(3) Reihenfolge: Route (BN14 -> BN13) minus umgedreht (BN13 -> BN14), 3 Laeufe je Knoten");
for (const s of SZ) {
  const goGain = [0, 1].map((i) => 3 * (res["BN13 mit SF14 (Route)"][s.name][i] - res["BN13 ohne SF14 (umgedreht)"][s.name][i]));
  const stk = [0, 1].map((i) => 3 * hours(Math.max(rows2[1][2], 1), i ? T_HI : T_LO)); // 1000 Faeden
  console.log(`    ${s.name.padEnd(14)} Go x2 in BN13: +${goGain[0].toFixed(1)}..${goGain[1].toFixed(1)} h  `
    + `gegen Stanek(1000 Faeden) in BN14: ${stk[0].toFixed(1)}..${stk[1].toFixed(1)} h  -> Route besser um `
    + `${(goGain[0] - stk[0]).toFixed(1)}..${(goGain[1] - stk[1]).toFixed(1)} h`);
}

console.log("\n(4) Korrektur STGO-1 fuer BN14.2/14.3 (x8 statt x4), Szenario mittel:");
const m = res["BN14.2/3 (GoPower 4, SF14.1+)"].mittel, m4 = res["BN14.1  (GoPower 4, SF14.0)"].mittel;
console.log(`    je Lauf x8 ${m[0].toFixed(1)}-${m[1].toFixed(1)} h gegen x4 ${m4[0].toFixed(1)}-${m4[1].toFixed(1)} h -> `
  + `zwei Laeufe zusaetzlich +${(2 * (m[0] - m4[0])).toFixed(1)}..${(2 * (m[1] - m4[1])).toFixed(1)} h`);
console.log(`    Kontrolle Formel: Effekt bei nodePower 30000 x4 ${(calculateEffect(30000, 0.7, 4, 0)).toFixed(3)}, x8 ${(calculateEffect(30000, 0.7, 4, 1)).toFixed(3)}`);
