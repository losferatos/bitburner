// G09: Eichung 2 - Raid-Erfolge je Fenster: beobachtet (successes-Zaehler) gegen Modell (Summe p).
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { ACT, ctxOf, chance } from "./verify-g09-model.mjs";
const run = process.argv[2] || "BN2L1";
let prev = null, totS = 0, totE = 0, totN = 0, varSum = 0;
console.log("fenster | h | Raid-Versuche | Erfolge Ist | Soll Sum p (Anfang/Ende-Mittel, gedeckelt bei Stamina voll) | z");
for (const f of listRun(run)) {
  const { p } = readSave(f);
  const { ctx, levels, bb } = ctxOf(p);
  const R = levels["Raid"];
  const h = p.playtimeSinceLastBitnode / 3.6e6;
  const full = { ...ctx, stamina: ctx.maxStamina };      // Stamina-Strafe 1 (Band 51/56 % -> fast immer >= 50 %)
  const pNow = chance(ACT["Raid"], R.level, full);
  if (prev && h - prev.h < 2.0 && h > prev.h) {
    const n = (R.successes + R.failures) - (prev.R.successes + prev.R.failures);
    const s = R.successes - prev.R.successes;
    const pm = (pNow + prev.pNow) / 2;
    const e = n * pm, v = n * pm * (1 - pm);
    totS += s; totE += e; totN += n; varSum += v;
    console.log(`${f.slice(25, 41)} | ${fmt(prev.h, 2)}-${fmt(h, 2)} | n=${n} | s=${s} | ${fmt(e, 2)} (p ${fmt(pm, 3)}, L${prev.R.level}->${R.level}, chaos ${fmt(prev.chaos,1)}->${fmt(ctx.city.chaos,1)}) | z=${fmt((s - e) / Math.sqrt(Math.max(v, 1e-9)), 2)}`);
  }
  prev = { h, R, pNow, chaos: ctx.city.chaos };
}
console.log(`Summe: n=${totN} Ist ${totS} Soll ${fmt(totE, 2)} sigma ${fmt(Math.sqrt(varSum), 2)} z=${fmt((totS - totE) / Math.sqrt(varSum), 2)}`);
