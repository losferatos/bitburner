// G09-Betrieb, Teil B: wie oft und wie lange gibt es das "Hungerfenster" (Raid-Vorrat leer, solange die Sleeves noch im Gym stehen)?
//
// Modell (geeicht in verify-g09-betrieb-vorrat.mjs: Soll/Ist +-0,2 in 6 von 8 Intervallen):
//   Vorrat(t) = S0 + g*t - Versuche(t),  g = 2,1/480 je Spielsekunde = 15,75/h  (Raid growthFunction Mittel 2,1)
//   Anfangsvorrat S0 = getRandomIntInclusive(minCount 1, maxCount 150)   (Actions/LevelableAction.ts:23-24, 40, 68)
//   Versuche des Spielers: c = 37..40 je Stunde (gemessen: BN2.1 37, BN2.2 40; ein Raid dauert 71-77 s)
//   Hunger beginnt, wenn der Vorrat 1 erreicht; er endet, wenn der erste Sleeve Kampfwert 40 hat (altes Gate)
//   -> dann greifen Vertraege/D5 (sleeve.js:768ff.)
// Die Gym-Dauer bis Kampfwert 40 ist gemessen (BN2.1 38 bei 3,85 h, 40 bei ~4,1 h; BN2.2 24 bei 2,65 h = gleiche Steigung
// 11,5/h) und skaliert mit dem Kampf-LevelMultiplier wie im Audit (Rechnung 7: 3,93 / 5,57 / 8,38 h).
// Aufruf: node tools/audit/verify-g09-betrieb-hunger.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateOf } from "./sleeve-bb.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const B = (n) => path.join(root, "backups", "LIVE_197f4d61481686_" + n + ".json.gz");
const f = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : String(x));
const G = 2.1 / 480 * 3600;   // 15,75 je Stunde

// 1) Anfangsvorrat der beiden bekannten Knoten rueckgerechnet (Zaehler sind seit Knotenstart exakt)
for (const [tag, n] of [["BN2.1", "BN2L1_2026-10-03T05-33_hourly"], ["BN2.2", "BN2L2_2026-10-04T11-17_hourly"]]) {
  const s = stateOf(B(n));
  const versuche = s.sc.Raid.s + s.sc.Raid.f;
  console.log(`${tag}: Vorrat ${f(s.count.Raid, 1)}, bisherige Raid-Versuche ${versuche} -> S0 (Knotenstart) = Vorrat + Versuche - g*t`
    + ` (t aus playtimeSinceLastBitnode unten) -- siehe Zeitreihe`);
}
// Knotenzeit aus den Spielstaenden (playtimeSinceLastBitnode) statt aus der Wanduhr
import { loadSave } from "./sleeve-save.mjs";
const nodeH = (n) => loadSave(B(n)).player.playtimeSinceLastBitnode / 3.6e6;
for (const [tag, n] of [["BN2.1", "BN2L1_2026-10-03T05-33_hourly"], ["BN2.2", "BN2L2_2026-10-04T11-17_hourly"]]) {
  const s = stateOf(B(n)); const t = nodeH(n);
  const s0 = s.count.Raid + (s.sc.Raid.s + s.sc.Raid.f) - G * t;
  console.log(`${tag}: Knotenzeit ${f(t, 2)} h, S0 geschaetzt ${f(s0, 0)} (Erwartung: gleichverteilt 1..150)`);
}

// 2) Monte Carlo: Hunger-Stunden je Knotenklasse. Zufall deterministisch (LCG), 200k Zuege je Fall.
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function lauf(gymH, tRaid, cons) {
  let sum = 0, haengt = 0, n = 200000;
  const dist = [];
  for (let i = 0; i < n; i++) {
    const S0 = 1 + Math.floor(rnd() * 150);                   // 1..150
    // Vorrat zum Raid-Start
    const sRaid = S0 + G * tRaid;
    const tEmpty = tRaid + (sRaid - 1) / (cons - G);          // Vorrat 1 erreicht
    const th = Math.max(0, gymH - tEmpty);
    sum += th; if (th > 0.25) haengt++;
    dist.push(th);
  }
  dist.sort((a, b) => a - b);
  return { mean: sum / n, pHunger: haengt / n, p90: dist[Math.floor(n * 0.9)], max: dist[n - 1] };
}
console.log("\n=== Hunger-Stunden je Knoten (Gym-Ende = Kampfwert 40 des ersten Sleeves) ===");
console.log("Klasse                         Gym-Ende  Raid-Start  Verbrauch  P(Hunger>15min)  E[Hunger h]  P90 h   Max h");
for (const [name, gym] of [["BN2/3/11/6/7 (LevelMult 1)", 4.1], ["BN13/15 (0,7)", 4.1 * 5.57 / 3.93], ["BN14 (0,5)", 4.1 * 8.38 / 3.93]]) {
  for (const tRaid of [0.3, 1.5]) {
    for (const cons of [37, 40]) {
      const r = lauf(gym, tRaid, cons);
      console.log(`${name.padEnd(30)} ${f(gym, 1).padStart(5)} h   ${f(tRaid, 1).padStart(5)} h   ${String(cons).padStart(5)}/h    ${f(r.pHunger * 100, 0).padStart(6)} %       ${f(r.mean, 2).padStart(6)}     ${f(r.p90, 2).padStart(5)}  ${f(r.max, 2).padStart(5)}`);
    }
  }
}
// 3) Die beiden Beobachtungen gegen das Modell (Vorhersage statt Rueckschau)
{
  const tR = 0.0, S0 = 56;          // BN2.1: aus der Rueckrechnung oben
  const tEmpty = tR + (S0 + G * tR - 1) / (38.5 - G);
  console.log(`\nBN2.1 Modell: Vorrat leer nach ${f(tEmpty, 2)} h Knotenzeit (Messung: 0,7 bei 2,85 h, 17,8 bei 1,85 h -> leer ca. 2,7 h); Gym-Ende ~4,1 h -> Hunger ${f(Math.max(0, 4.1 - tEmpty), 2)} h`);
  const s2 = 114;                    // BN2.2: aus der Rueckrechnung oben
  const t2 = 1.5 + (s2 + G * 1.5 - 1) / (40 - G);
  console.log(`BN2.2 Modell: Vorrat leer nach ${f(t2, 2)} h Knotenzeit; Gym-Ende ~4,1 h -> Hunger ${f(Math.max(0, 4.1 - t2), 2)} h  (Vorhersage: Vorrat bei 4,65 h ~ ${f(107.1 - (40 - G) * (4.65 - 2.65), 0)})`);
}
