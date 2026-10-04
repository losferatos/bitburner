// G09-Betrieb, Teil C: das LP des Sleeve-Audits (sleeve-lp.mjs) nachgebaut und auf die Betriebsfrage
// "wie viele Sleeves muessen auf Infiltrate, damit der Mangel weg ist?" angewandt.
// Unveraendert uebernommen: die Zeit-/Ausdauer-/Chaos-Gleichungen aus tools/audit/sleeve-lp.mjs (dort geeicht).
// NEU hier: Sleeves im Gym zaehlen 0 (G), Konfigurationen mit 1 oder 2 Infiltrate-Sleeves + Rest im Gym.
// Aufruf: node tools/audit/verify-g09-betrieb-lp.mjs [07-33_hourly|08-33_hourly|09-19_pre-hotswap]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { successChance, actionTime, rankGain, rankLoss, stateOf, ACT, diffMult } from "./sleeve-bb.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STAND = process.argv[2] || "08-33_hourly";
const S = stateOf(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T" + STAND + ".json.gz"));
const st = { ...S, stamina: S.maxStamina };
const f = (x, n = 1) => x.toFixed(n);
const LR = S.level.Raid, LC = S.level.Retirement;
const pR = successChance(ACT.Raid, LR, S.player, st), tR = actionTime(ACT.Raid, LR, S.player, st);
const eR = pR * rankGain(ACT.Raid, LR) - (1 - pR) * rankLoss(ACT.Raid, LR);
const sR = 0.285 * diffMult(ACT.Raid.baseDifficulty * Math.pow(ACT.Raid.difficultyFac, LR - 1));
const pC = successChance(ACT.Retirement, LC, S.player, st), tC = actionTime(ACT.Retirement, LC, S.player, st);
const eC = pC * rankGain(ACT.Retirement, LC);
const sC = 0.285 * diffMult(ACT.Retirement.baseDifficulty * Math.pow(ACT.Retirement.difficultyFac, LC - 1));
const sm = S.sm;
const effAgi = S.player.skills.agility * sm("EffAgi");
const regenPerH = (0.0085 + S.maxStamina / 70000) * Math.pow(effAgi, 0.17) * sm("Stamina") * 3600;
const chamberPerMin = S.maxStamina * 0.01;
// Sleeve-Vertragswert je Sleeve: aus dem Sleeve mit den meisten Kampfwerten (Gym-Stand des Zeitpunkts)
const sleeveContract = Math.max(...["Tracking", "Bounty Hunter", "Retirement"].map((n) => {
  const sl = S.sleeves[1], L = S.level[n];
  return successChance(ACT[n], L, sl, st) * rankGain(ACT[n], L) / actionTime(ACT[n], L, sl, st) * 3600;
}));
const infil = (n) => (n > 0 ? n * Math.pow(n, -0.5) / 2 * 60 : 0);
const raidNatural = 2.1 / 480 * 3600;
function fill(T, A) {
  const k = chamberPerMin;
  let h = (sC * T - tC * A) / (sC * 60 + tC * k);
  if (!(h > 0)) h = 0;
  if (A + k * h < 0) h = -A / k;
  if (60 * h > T) return null;
  const c = Math.max(0, Math.min((T - 60 * h) / tC, (A + k * h) / sC));
  return { c, h };
}
// Raid-Vorrat als Nebenbedingung (r <= natuerlich + Infiltrate), Stealth Retirement frei (wie im Audit-LP)
function solve(nI, nK, nC, rMaxOverride) {
  let best = { v: -1 };
  const rMax = rMaxOverride ?? raidNatural + infil(nI);
  for (let r = 0; r <= rMax + 1e-9; r += rMax / 200 || 1) {
    for (let sr = 0; sr <= 45; sr += 0.5) {
      const T = 3600 - r * tR - sr * 81;
      if (T < 0) continue;
      const A = regenPerH + chamberPerMin * 60 * nK - r * sR - sr * 0.285 * diffMult(1000);
      const x = fill(T, A);
      if (!x) continue;
      const eS = 1.72; // Stealth Retirement L1 (sleeve-lp.mjs: p 0,155 t 81 s E 1,72) - hier nur Hintergrund
      const v = r * eR + sr * eS + x.c * eC + nC * sleeveContract;
      if (v > best.v) best = { v, r, sr, c: x.c, h: x.h };
    }
  }
  return best;
}
console.log(`Stand ${STAND}: Raid L${LR} p ${f(pR, 3)} t ${tR}s E ${f(eR, 2)} | Retirement L${LC} p ${f(pC, 3)} E ${f(eC, 2)} | Vertrag je Sleeve ${f(sleeveContract)} Rang/h | Raid-Vorrat ${f(S.count.Raid)}`);
// Eichung wie im Audit: Spieler allein
{
  const a = solve(0, 0, 0);
  console.log(`EICHUNG Spieler allein: Soll Audit 124 (07:33) / 134 (08:33) / 166 (09:19), hier ${f(a.v, 0)} Rang/h (Raids ${f(a.r)}/h)`);
}
const cfg = [
  ["Spieler allein, 3 Sleeves im Gym", 0, 0, 0],
  ["1 Infiltrate, 2 im Gym", 1, 0, 0],
  ["2 Infiltrate, 1 im Gym", 2, 0, 0],
  ["3 Infiltrate", 3, 0, 0],
  ["1 Infiltrate + 1 Kammer, 1 im Gym", 1, 1, 0],
  ["2 Infiltrate + 1 Kammer", 2, 1, 0],
  ["1 Infiltrate + 2 Vertrag (Gym fertig)", 1, 0, 2],
  ["2 Infiltrate + 1 Vertrag (Gym fertig)", 2, 0, 1],
  ["3 Vertrag (Gym fertig)", 0, 0, 3],
];
const base = solve(0, 0, 0).v;
for (const [name, nI, nK, nC] of cfg) {
  const b = solve(nI, nK, nC);
  console.log(`${name.padEnd(42)} ${f(b.v, 0).padStart(5)} Rang/h  (+${f(b.v - base, 0)} gegen allein)  Raids ${f(b.r)}/h Retirement ${f(b.c)}/h Kammer ${f(b.h)} min/h`);
}
