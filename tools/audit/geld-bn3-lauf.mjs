// Audit geldwert BN3 (05.10.2026): Laufzeit eines BN3-V2-Laufs mit/ohne Zusatzgeld, mit/ohne Grafting.
// Rangmodell wie geld-bn3-zeit.mjs (Band ueber den Exponenten a, je a neu auf BN2.3 geeicht):
//   dR/dt = A * (R/24000)^a * K^beta
// k je Zyklus aus geld-bn3-zyklus.mjs / geld-bn3-kmax.mjs (Kauf mit BN3-Preisen x3, Ruf x3, Ruf-Verlauf BN2.3).
// Annahmen (GESCHAETZT): Tor 1 bei 12,4 h, Wiederaufbau 0,4 h, weitere Tore 12 h nach Wiederaufbau-Ende
// (endspurt.js:322-333); kein Einbau, wenn Rang 400k binnen 3,1 h erreicht wird (einbauErlaubt 186 min);
// Restgeld verfaellt beim Einbau; Grundgeld spaeterer Zyklen 10 Mrd; Black-Op-Chancen nicht modelliert
// (bei kleinem K zu optimistisch -> Basis eher zu schnell, Ersparnis eher zu klein).
// Grafting: Preis Grundpreis x3 ohne BN-Aufschlag (GraftableAugmentation.ts:20-21), Dauer (log2(Summe Mults)+0,5)/2 h
// / (Int-Bonus 1,094 x Fokus 0,8) (GraftingWork.tsx:40-45), wirkt sofort, Entropie x0,98 je Graft (:62-63); ohne
// Simulacrum steht der Rang waehrend des Grafts (Bladeburner.ts:177-180). Nur lesen.
import { loadBot, loadState, AUGS, makeRoundModel, beamRound } from "./gang-p2b-lib.mjs";
import { kOf } from "./geld-bn3-kist.mjs";
const bot = await loadBot();
const S = loadState("LIVE_197f4d61481686_BN2L3_2026-10-05T19-26_pre-install.json.gz");
const bbs = Object.fromEntries(S.bb.skills.data || Object.entries(S.bb.skills));
const kSet = (names) => kOf(bot, S.p.skills, bbs["Reaper"], bbs["Evasive System"], [...names].map(n => bot.COMBAT_AUGS[n]).filter(Boolean), "OperationTyphoon").k;

// ---------------- Rangmodell (Band) ----------------
const OBS = [[6.8, 4567], [7.8, 6051], [8.8, 9899], [9.8, 15512], [10.8, 19053], [11.8, 23399], [12.4, 28767]];
const EARLY = [[0, 0], [1.8, 130], [2.8, 853], [3.8, 1204], [4.8, 2085], [5.8, 2926], [6.8, 4567]];
export function mk(a) {
  const integ = (p, R, t0, t1, K) => { for (let t = t0; t < t1 - 1e-9; t += 0.005) R += p.A * Math.pow(R / 24000, a) * Math.pow(K, p.beta) * 0.005; return R; };
  let best = null;
  for (let A = 2000; A <= 14000; A += 20) {
    let e = 0, R = 4567, t = 6.8;
    for (const [th, Ro] of OBS.slice(1)) { R = integ({ A, beta: 1 }, R, t, th, 1); t = th; e += Math.log(R / Ro) ** 2; }
    if (!best || e < best.e) best = { A, e };
  }
  const t400 = 14.2 + 0.3 * Math.log(400000 / 246737) / Math.log(458657 / 246737);
  let lo = 0, hi = 4;
  for (let i = 0; i < 40; i++) {
    const b = (lo + hi) / 2; const p = { A: best.A, beta: b };
    let R = integ(p, 28767, 12.4, 12.8, 1), t = 12.8;
    while (R < 400000 && t < 100) { R += p.A * Math.pow(R / 24000, a) * Math.pow(4.782, b) * 0.005; t += 0.005; }
    if (t > t400) lo = b; else hi = b;
  }
  return { a, A: best.A, beta: (lo + hi) / 2, rms: Math.sqrt(best.e / 6) };
}

// ---------------- Graft-Daten ----------------
const GRAFT_SPEED = (1 + Math.pow(155, 0.8) / 600) * 0.8;
export const gTime = (n) => { const m = Object.values(AUGS[n].mults || {}).filter(x => x !== 1); const s = Math.max(1, m.reduce((x, y) => x + y, 0)); return (Math.log2(s) + 0.5) / 2 / GRAFT_SPEED; };
const gCost = (n) => AUGS[n].moneyCost * 3;
const PLAN = ["SPTN-97 Gene Modification", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Synthetic Heart", "Photosynthetic Cells", "CordiARC Fusion Reactor"];
const SIM = "The Blade's Simulacrum";
const SIM_T = 0.5 / 2 / GRAFT_SPEED;

// ---------------- Kauf je spaeterem Zyklus (Torrunde-Optimum = obere Schranke der Kaufschleife) ----------------
const BB = Object.values(AUGS).filter(a => a.factions.includes("Bladeburners") && bot.COMBAT_AUGS[a.name] && a.name !== SIM).map(a => a.name);
const SMALL = ["Wired Reflexes", "Augmented Targeting I", "Neurotrainer I"];
function bestBuy(owned, money) {
  const C = [];
  for (const n of [...BB, ...SMALL]) {
    if (owned.has(n)) continue; const a = AUGS[n];
    C.push({ aug: n, faktion: "x", rep: 1e12, repReq: 0, preis: a.moneyCost * 3, prereq: a.prereqs.filter(p => !owned.has(p)), mults: bot.COMBAT_AUGS[n] });
  }
  if (!C.length || money <= 0) return [];
  const model = makeRoundModel(bot, C, owned, { skills: S.p.skills, reaper: bbs["Reaper"], evasive: bbs["Evasive System"], opName: "OperationTyphoon", step: 1.9 });
  return beamRound(model, money, 20).seq;
}

// ---------------- Laufsimulation ----------------
const early = (x) => { for (let i = 1; i < EARLY.length; i++) if (x <= EARLY[i][0]) { const [x0, y0] = EARLY[i - 1], [x1, y1] = EARLY[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return EARLY[EARLY.length - 1][1]; };
function run(model, sc) {
  const rate = (R, K) => model.A * Math.pow(Math.max(R, 1000) / 24000, model.a) * Math.pow(K, model.beta);
  const dt = 0.005;
  let tau = 0;
  let t = 0, R = 0, K = 1, entropy = 0, gi = 0, gEnd = null, gName = null;
  let gBudget = sc.graft ? 0 : 0, simul = sc.graft && sc.graft.sim ? false : null;
  const owned = new Set();
  const gates = [12.4];
  let gIdx = 0, rebuildUntil = -1, kBeforeInstall = 1;
  const log = [];
  let grafted = 0, graftHours = 0;
  while (t < 150) {
    if (sc.graft && t >= sc.graft.from && !sc._paid) { gBudget += sc.graft.budget; sc._paid = true; }
    if (sc.graft && gEnd === null && t >= sc.graft.from) {
      if (simul === false && gBudget >= 450e9) { gBudget -= 450e9; gName = SIM; gEnd = t + SIM_T; }
      else if (simul !== false && gi < PLAN.length && gBudget >= gCost(PLAN[gi])) { gBudget -= gCost(PLAN[gi]); gName = PLAN[gi]; gEnd = t + gTime(PLAN[gi]); gi++; }
    }
    if (gEnd !== null && t >= gEnd) {
      if (gName === SIM) simul = true;
      else { owned.add(gName); entropy++; grafted++; graftHours += gTime(gName); K = kSet(owned) * Math.pow(0.98, entropy); }
      log.push(`${t.toFixed(1)}h Graft fertig: ${gName} K=${K.toFixed(2)} Rang ${Math.round(R)}`); gEnd = null; gName = null;
    }
    const paused = gEnd !== null && simul !== true;
    if (!paused) {
      if (tau < 6.8) {
        // Fruehphase: gemessene BN2.3-Kurve ueber der AKTIVEN Bladeburner-Zeit tau (ein Graft ohne
        // Simulacrum haelt sie an), Zuwachs x K^(earlyExp x beta)
        R += (early(Math.min(6.8, tau + dt)) - early(tau)) * Math.pow(K, sc.earlyExp * model.beta);
      } else R += rate(R, t < rebuildUntil ? kBeforeInstall : K) * dt;
      tau += dt;
    }
    if (R >= 400000) { delete sc._paid; return { tExit: t + 0.2, log, K, grafted, graftHours }; }
    if (gIdx < gates.length && t >= gates[gIdx]) {
      let Rf = R, tf = t;
      while (Rf < 400000 && tf < t + 3.1) { Rf += rate(Rf, K) * dt; tf += dt; }
      const bought = gIdx === 0 ? sc.cyc1.filter(n => !owned.has(n)) : bestBuy(owned, sc.money2);
      if (Rf < 400000 && bought.length >= 3) {
        for (const n of bought) owned.add(n);
        kBeforeInstall = K; K = kSet(owned) * Math.pow(0.98, entropy);
        log.push(`${t.toFixed(1)}h Einbau ${gIdx + 1}: ${bought.length} Stuecke, K=${K.toFixed(2)}, Rang ${Math.round(R)}`);
        rebuildUntil = t + 0.4;
        gates.push(t + 0.4 + 12);
      } else {
        log.push(`${t.toFixed(1)}h Tor ${gIdx + 1}: kein Einbau (${bought.length < 3 ? "< 3 Stuecke" : "Ausgang < 3,1 h"})`);
        gates.push(t + 12);
      }
      gIdx++;
    }
    t += dt;
  }
  delete sc._paid; delete sc._lastEarly;
  return { tExit: Infinity, log, K, grafted, graftHours };
}

// Zyklus-1-Kaeufe aus geld-bn3-zyklus.mjs (Kaufschleife des heutigen Bots, bn4rep.js:2298-2305)
const LOOP = {
  basis: ["Neurotrainer I", "Wired Reflexes", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "Augmented Targeting I"],
  g100: ["Neurotrainer I", "Wired Reflexes", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Augmented Targeting I"],
  g450: ["Neurotrainer I", "Wired Reflexes", "EsperTech Bladeburner Eyewear", "EMS-4 Recombination", "ORION-MKIV Shoulder", "Hyperion Plasma Cannon V1", "BLADE-51b Tesla Armor", "Augmented Targeting I"],
  g1000: ["Neurotrainer I", "Wired Reflexes", "EsperTech Bladeburner Eyewear", "Augmented Targeting I", "Blade's Runners", "Hyperion Plasma Cannon V1", "Vangelis Virus", "EMS-4 Recombination"],
  unb: [...new Set([...BB.filter(n => AUGS[n].repCost * 3 <= 79031), ...SMALL, "EsperTech Bladeburner Eyewear"])],
};
// Torrunden-Optimum aus geld-bn3-zyklus.mjs (Strahlsuche, teuerste zuerst, keine Vorkaeufe)
const TOR100 = ["Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2", "BLADE-51b Tesla Armor", "ORION-MKIV Shoulder", "EMS-4 Recombination", "EsperTech Bladeburner Eyewear", "Augmented Targeting I", "Wired Reflexes"];
const SC = [
  { name: "Basis (heutiger Bot)", cyc1: LOOP.basis, money2: 10e9 },
  { name: "+100 Mrd nach 0,5 h", cyc1: LOOP.g100, money2: 10e9 },
  { name: "+450 Mrd nach 3 h", cyc1: LOOP.g450, money2: 10e9 },
  { name: "+1 Bio nach 12 h", cyc1: LOOP.g1000, money2: 10e9 },
  { name: "unbegrenzt ab 6 h", cyc1: LOOP.unb, money2: 1e30 },
  { name: "T: Torrunde ohne Gang, Basis 10 Mrd", cyc1: ["BLADE-51b Tesla Armor", "ORION-MKIV Shoulder", "EsperTech Bladeburner Eyewear", "Augmented Targeting I", "Wired Reflexes"], money2: 10e9 },
  { name: "T: Torrunde, +100 Mrd nach 0,5 h", cyc1: TOR100, money2: 10e9 },
  { name: "T: Torrunde, +450 Mrd nach 3 h", cyc1: [...TOR100, "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Power Cells Upgrade"], money2: 10e9 },
  { name: "T: Torrunde, +1 Bio nach 12 h", cyc1: [...TOR100, "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "BLADE-51b Tesla Armor: Power Cells Upgrade", "Vangelis Virus"], money2: 10e9 },
  { name: "G: +100 Mrd nach 0,5 h, nur Grafts", cyc1: LOOP.basis, money2: 10e9, graft: { from: 0.5, budget: 100e9 } },
  { name: "G: +450 Mrd nach 3 h, nur Grafts", cyc1: LOOP.basis, money2: 10e9, graft: { from: 3, budget: 450e9 } },
  { name: "G: +450 Mrd nach 3 h, Simulacrum zuerst", cyc1: LOOP.basis, money2: 10e9, graft: { from: 3, budget: 450e9, sim: true } },
  { name: "G: +1 Bio nach 12 h, nur Grafts", cyc1: LOOP.basis, money2: 10e9, graft: { from: 12, budget: 1e12 } },
  { name: "G: +1 Bio nach 12 h, Simulacrum zuerst", cyc1: LOOP.basis, money2: 10e9, graft: { from: 12, budget: 1e12, sim: true } },
  { name: "G: unbegrenzt ab 6 h, Simulacrum zuerst", cyc1: LOOP.unb, money2: 1e30, graft: { from: 6, budget: 1e30, sim: true } },
  { name: "G: unbegrenzt ab 6 h, nur Grafts", cyc1: LOOP.unb, money2: 1e30, graft: { from: 6, budget: 1e30 } },
];
if (process.argv[1].endsWith("geld-bn3-lauf.mjs")) {
  const models = [0.5, 0.6, 0.7].map(mk);
  for (const m of models) console.log(`Modell a=${m.a}: A=${m.A}, beta=${m.beta.toFixed(2)} (RMS Zyklus 1 ${m.rms.toFixed(3)})`);
  console.log("Graftdauern h:", PLAN.map(n => n.split(" ")[0] + " " + gTime(n).toFixed(2)).join(", "), "Simulacrum", SIM_T.toFixed(2));
  const ee = process.argv.includes("--frueh1") ? 1 : 0;
  console.log("Fruehphase (aktive BB-Zeit < 6,8 h): Zuwachs x K^(" + ee + " x beta)");
  const res = SC.map(sc => ({ sc, r: models.map(m => run(m, { ...sc, earlyExp: ee })) }));
  const base = res[0].r.map(x => x.tExit);
  console.log("\nSzenario | Ausgang h (a=0,5 / 0,6 / 0,7) | gespart gegen Basis | Grafts");
  for (const { sc, r } of res) console.log(`${sc.name.padEnd(44)} | ${r.map(x => x.tExit.toFixed(1)).join(" / ").padEnd(18)} | ${r.map((x, i) => (base[i] - x.tExit).toFixed(1)).join(" / ").padEnd(18)} | ${r[1].grafted}`);
  if (process.argv.includes("--log")) for (const { sc, r } of res) console.log("\n" + sc.name + "  (a=0,6)\n  " + r[1].log.join("\n  "));
}
