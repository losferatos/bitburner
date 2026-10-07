// Hash-Rang nach dem ersten Einbau, Teil (b): was ist ein Rang-Vorsprung durch Skillpunkte WERT?
// Aufruf: node tools/hashrang-sp.mjs
//
// Der Offset-Teil steht in tools/hashrang-rechnung.mjs (untere Schranke). Hier der zweite Weg:
// 1 SP je 3 Rang (RanksPerSkillPoint). Rang aus Hashes bringt also frueh SP, die die Basislinie erst
// spaeter hat. Gemessen mit dem geeichten Rangmodell tools/bbrank/sim.mjs, KALTSTART (Rang 0, Stufe 1),
// in Stundenschritten: jede Stunde werden die verfuegbaren SP gierig verteilt (Skill mit dem hoechsten
// Rangzuwachs der naechsten 4 h je SP), dann 1 h simuliert. SP-Quelle der Basislinie = maxRank/3.
// Die Variante bekommt zum Start zusaetzlich D/3 SP (und D Rang), Rest identisch.
// Gemessen wird: Stunden bis Rang 10k / 100k der Basislinie gegen die Variante.
// Stats (Kampfwerte) bleiben fest wie im Eichstand - das ist fuer den DIFFERENZ-Vergleich gleich fuer beide.
import { simulate } from "./bbrank/sim.mjs";

const skills = { hacking: 341, strength: 100, defense: 100, dexterity: 109, agility: 107, charisma: 80, intelligence: 106 };
const env = { pop: 1564094106, comms: 131, chaos: 6.922924430015252, teamCount: 0, bbSuccessMult: 1 };
const COST = { "Blade's Intuition": [3, 2.1], "Cloak": [2, 1.1], "Short-Circuit": [2, 2.1], "Digital Observer": [2, 2.1],
  "Tracer": [2, 2.1], "Overclock": [3, 1.4], "Reaper": [2, 2.1], "Evasive System": [2, 2.1], "Datamancer": [3, 1],
  "Cyber's Edge": [1, 3], "Hyperdrive": [1, 2.5] };
const MAXLVL = { "Overclock": 90 };
const NAMES = ["Tracking", "Bounty Hunter", "Retirement", "Investigation", "Undercover Operation", "Sting Operation",
  "Raid", "Stealth Retirement Operation", "Assassination"];

function runChunk(st, hours) {
  const r = simulate({ skills, bbSkills: st.bb, levels: st.lvl, successes: st.succ, env, rank: st.rank, staminaBonus: 0,
    bnRankMult: st.brank, hours, policy: "greedy" });
  return r;
}
function allocate(st) {
  for (;;) {
    let best = null;
    const base = runChunk(st, 4).rank;
    for (const [n, [b, inc]] of Object.entries(COST)) {
      const lv = st.bb[n] ?? 0;
      const c = Math.ceil((b + inc * lv) * st.costMult);
      if (c > st.sp || lv >= (MAXLVL[n] ?? 1e9)) continue;
      const t = { ...st, bb: { ...st.bb, [n]: lv + 1 } };
      const g = (runChunk(t, 4).rank - base) / c;
      if (!best || g > best.g) best = { n, c, g };
    }
    if (!best || best.g <= 0) return;
    st.sp -= best.c; st.bb[best.n] = (st.bb[best.n] ?? 0) + 1;
  }
}
function timeToRank(brank, costMult, gift, targets) {
  const lvl = {}, succ = {};
  for (const n of NAMES) { lvl[n] = 1; succ[n] = 0; }
  const st = { brank, costMult, bb: {}, lvl, succ, rank: gift, maxRank: gift, sp: Math.floor(gift / 3), spGot: Math.floor(gift / 3) };
  const out = {};
  for (let h = 0; h < 400 && Object.keys(out).length < targets.length; h++) {
    allocate(st);
    const r = runChunk(st, 1);
    st.rank = r.rank; st.maxRank = Math.max(st.maxRank, r.rank); st.lvl = r.lvl; st.succ = r.succ;
    const total = Math.floor(st.maxRank / 3);
    st.sp += total - st.spGot; st.spGot = total;
    for (const t of targets) if (out[t] === undefined && st.rank >= t) out[t] = h + 1;
  }
  return out;
}
const T = [1000, 10000, 100000];
// EICHUNG des Kaltstarts: BN10 (Rangfaktor 0,8, Skillpreis 1) gegen die gemessene Kurve doku/rangkurve-bn10.json
// (Rang 1000 bei ~27 h, 7465 bei 46,8 h; Nullpunkt = erster Rang-Messpunkt, nicht der Beitritt).
if (process.argv[2] === "eich") {
  for (const [bn, brank, cm] of [["BN10", 0.8, 1], ["BN4", 1, 1], ["BN9", 0.9, 1.2]]) {
    const b = timeToRank(brank, cm, 0, T);
    console.log(bn + " Kaltstart-Modell: Stunden bis Rang " + T.map((t) => t + " = " + (b[t] ?? ">400")).join(", "));
  }
  process.exit(0);
}
const NODES = process.argv[2] === "kalib" ? { "BN2-Kalib (f=1, SP-Preis 1)": { brank: 1, cm: 1 } } : { BN15: { brank: 0.2, cm: 3 }, BN13: { brank: 0.45, cm: 2 } };
for (const [bn, nd] of Object.entries(NODES)) {
  const base = timeToRank(nd.brank, nd.cm, 0, T);
  console.log(bn + " Basislinie: Stunden bis Rang " + T.map((t) => t + " = " + (base[t] ?? ">400")).join(", "));
  for (const D of [1000, 2000, 4000, 8000]) {
    const v = timeToRank(nd.brank, nd.cm, D, T);
    console.log("  Hash-Rang " + D + ": " + T.map((t) => t + " = " + (v[t] ?? ">400") + " (spart " + ((base[t] ?? 400) - (v[t] ?? 400)) + " h)").join(", "));
  }
}
