// Audit 03.10.2026, Bereich BOERSE: Wie viel BARGELD laesst boerse.js liegen?
// BARBESTAND 0,15 (src/boerse.js:101) gilt je Runde nur auf das Bargeld zu
// Rundenbeginn (:239-240); die Kaufschleife (:246-265) rechnet `frei` je
// Kandidat neu aus dem schrumpfenden Bargeld. Gemessen: Anteil Bargeld am
// Vermoegen nach jeder Runde, und wie oft das Bargeld eine Schwelle
// erreicht (bn4rep kauft Augs/spendet nur aus Bargeld; Daedalus verlangt
// 100 Mrd BARGELD, Faction/FactionInfo.tsx:143, FactionJoinCondition.ts:134-143).
// Aufruf: node tools/audit/boerse-bargeld.mjs [--seeds N]
import { run, makeBotStrategy } from "./boerse-sim.mjs";
const a = process.argv.slice(2);
const SEEDS = a.includes("--seeds") ? Number(a[a.indexOf("--seeds") + 1]) : 8;
for (const mode of [{ lab: "4S (nach dem Kauf), Start 250 Mio, 0-16 h", fourS: true, cash: 250e6, h: 16 },
                    { lab: "Phase 1 (Historie), Start 250 Mio, 0-16 h", fourS: false, cash: 250e6, h: 16 }]) {
  const ratios = [];
  let n = 0, wBig = 0, c100 = 0, c1 = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const strat = makeBotStrategy({ fourS: mode.fourS, buy4S: false });
    run({ seed: 2000 + seed, cash: mode.cash, ticks: mode.h * 600, strategy: strat, sampleEvery: 600, onTick: (m, acc) => {
      const w = acc.wealth(m);
      if (w < 1e9) return; // erst ab 1 Mrd Vermoegen zaehlen
      n++;
      ratios.push(acc.cash / w);
      if (w >= 100e9) { wBig++; if (acc.cash >= 100e9) c100++; }
      if (acc.cash >= 1e9) c1++;
    } });
  }
  ratios.sort((x, y) => x - y);
  const q = (p) => (ratios[Math.floor(p * (ratios.length - 1))] * 100).toFixed(2) + " %";
  console.log(mode.lab);
  console.log("   Bargeld/Vermoegen nach der Runde: Median", q(0.5), " 90-%-Quantil", q(0.9), " 99-%-Quantil", q(0.99));
  console.log("   Runden mit Bargeld >= 1 Mrd:", (100 * c1 / n).toFixed(1), "%;  bei Vermoegen >= 100 Mrd: Bargeld >= 100 Mrd in",
    wBig ? (100 * c100 / wBig).toFixed(1) + " %" : "-", "der Runden (" + wBig + " Runden)");
}
