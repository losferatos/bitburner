// Sleeve-Aufteilung in der Raid-Phase (BN2L1, Stand 09:19) als kleines LP.
// Ressourcen des SPIELERS je Stunde: Zeit, Ausdauer, Raid-Vorrat, Chaos.
// Sleeves (3): Infiltrate (nI), Kammer (nH), Vertrag (nC), Diplomacy (nD).
// Alle Einzelformeln aus dem Quellcode, Fundstellen in sleeve-bb.mjs bzw. unten.
// Aufruf: node tools/audit/sleeve-lp.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { successChance, actionTime, rankGain, rankLoss, stateOf, ACT, diffMult } from "./sleeve-bb.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const STAND = process.argv[2] || "09-19_pre-hotswap";
const S = stateOf(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T" + STAND + ".json.gz"));
console.log("Stand " + STAND);
const st = { ...S, stamina: S.maxStamina };
const f = (x, n = 1) => x.toFixed(n);

// Spieler-Aktionen (geeicht in sleeve-bb.mjs Abschnitt 3: Raid p, Dauer, Rang)
const LR = S.level.Raid, LC = S.level.Retirement;
const pR = successChance(ACT.Raid, LR, S.player, st), tR = actionTime(ACT.Raid, LR, S.player, st);
const eR = pR * rankGain(ACT.Raid, LR) - (1 - pR) * rankLoss(ACT.Raid, LR);
const sR = 0.285 * diffMult(ACT.Raid.baseDifficulty * Math.pow(ACT.Raid.difficultyFac, LR - 1)); // Bladeburner.ts:919-925
const pC = successChance(ACT.Retirement, LC, S.player, st), tC = actionTime(ACT.Retirement, LC, S.player, st);
const eC = pC * rankGain(ACT.Retirement, LC);
const sC = 0.285 * diffMult(ACT.Retirement.baseDifficulty * Math.pow(ACT.Retirement.difficultyFac, LC - 1));
// Ausdauer: Bladeburner.ts:1317-1325 (geeicht 08:30:25 -> 08:31:25: 0,02543/s Ist gegen 0,02546/s Soll)
const sm = S.sm;
const effAgi = S.player.skills.agility * sm("EffAgi");
const regenPerH = (0.0085 + S.maxStamina / 70000) * Math.pow(effAgi, 0.17) * sm("Stamina") * 3600;
const chamberPerMin = S.maxStamina * 0.01; // HrcStaminaGain 1 % je 60 s (Bladeburner.ts:1197-1202), fuer Spieler UND Sleeve
// Chaos: Raid *(1+U(1..5)%) (Bladeburner.ts:829-842), Diplomacy *(1 - pct/100) je 60 s (Bladeburner.ts:735-743, 1185-1195)
const lnRaid = Math.log(1.03);
const dipl = (cha) => Math.pow(cha, 0.045) + cha / 1e3;
const lnDiplPlayer = -Math.log(1 - dipl(S.player.skills.charisma) / 100);
const lnDiplSleeve = -Math.log(1 - dipl(2) / 100);
// Sleeve-Vertrag: bester der drei aus sleeve-bb.mjs Abschnitt 5 (geeicht Abschnitt 2)
const sleeveContract = Math.max(...["Tracking", "Bounty Hunter", "Retirement"].map((n) => {
  const sl = S.sleeves[1], L = S.level[n];
  return successChance(ACT[n], L, sl, st) * rankGain(ACT[n], L) / actionTime(ACT[n], L, sl, st) * 3600;
}));
const infil = (n) => (n > 0 ? n * Math.pow(n, -0.5) / 2 * 60 : 0); // je Stunde und Aktionsart
const raidNatural = 2.1 / 480 * 3600;

console.log(`Spieler: Raid p ${f(pR, 3)} t ${tR}s E ${f(eR, 2)} Ausd ${f(sR, 2)} | Retirement p ${f(pC, 3)} t ${tC}s E ${f(eC, 2)} Ausd ${f(sC, 2)}`);
console.log(`Ausdauer passiv ${f(regenPerH)}/h, Kammer ${f(chamberPerMin, 3)}/min, Sleeve-Vertrag ${f(sleeveContract)} Rang/h, Raid natuerlich ${f(raidNatural, 2)}/h`);
console.log(`Chaos ln je Raid ${f(lnRaid, 4)}, Diplomacy Spieler ${f(lnDiplPlayer, 4)}/min, Sleeve ${f(lnDiplSleeve, 4)}/min\n`);

// Stealth Retirement (data/Operations.ts:152-188) als Aufraeum-Operation des Spielers:
// Chaos *(1 - U(1..3)%) unabhaengig vom Erfolg (Bladeburner.ts:843-851), Rang bei Erfolg.
const SR = { kind: "O", baseDifficulty: 1000, difficultyFac: 1.05, rewardFac: 1.11, rankGain: 22, rankLoss: 2,
  weights: { hacking: 0.1, strength: 0.1, defense: 0.1, dexterity: 0.3, agility: 0.3, charisma: 0, intelligence: 0.1 },
  decays: { hacking: 0.7, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, charisma: 0, intelligence: 0.9 },
  isStealth: true, isKill: true };
const pS = successChance(SR, 1, S.player, st), tS = actionTime(SR, 1, S.player, st);
const eS = pS * rankGain(SR, 1) - (1 - pS) * rankLoss(SR, 1);
const sS = 0.285 * diffMult(1000);
const lnSR = -Math.log(0.98);
console.log(`Spieler Stealth Retirement L1: p ${f(pS, 3)} t ${tS}s E ${f(eS, 2)} Ausd ${f(sS, 2)} Chaos-ln ${f(lnSR, 4)} je Lauf
`);

// Rest-Zeit T und Rest-Ausdauer A gehen in Retirement (c) und Spieler-Kammer (h, Minuten):
// max c mit tC*c + 60h <= T, sC*c <= A + k*h. Geschlossen: Schnittpunkt oder h = 0.
function fill(T, A) {
  const k = chamberPerMin;
  let h = (sC * T - tC * A) / (sC * 60 + tC * k);
  if (!(h > 0)) h = 0;
  if (A + k * h < 0) h = -A / k;
  if (60 * h > T) return null;
  const c = Math.max(0, Math.min((T - 60 * h) / tC, (A + k * h) / sC));
  return { c, h };
}
function solve(nI, nH, nC, nD, chaosBalance) {
  let best = { v: -1 };
  const rMax = raidNatural + infil(nI);
  for (let r = 0; r <= rMax + 1e-9; r += rMax / 200 || 1) {
    for (let sr = 0; sr <= 45; sr += 0.5) {             // Stealth-Retirement-Laeufe je Stunde
      for (let dP = 0; dP <= 60; dP += 1) {             // Spieler-Diplomacy-Minuten je Stunde
        if (chaosBalance && r * lnRaid > sr * lnSR + dP * lnDiplPlayer + nD * 60 * lnDiplSleeve + 1e-12) continue;
        const T = 3600 - r * tR - sr * tS - 60 * dP;
        if (T < 0) continue;
        const A = regenPerH + chamberPerMin * 60 * nH - r * sR - sr * sS;
        const x = fill(T, A);
        if (!x) continue;
        const v = r * eR + sr * eS + x.c * eC + nC * sleeveContract;
        if (v > best.v) best = { v, r, sr, c: x.c, h: x.h, dP };
      }
    }
  }
  return best;
}
{
  // Eichung des Zeit-/Ausdauermodells: Spieler allein, Raid nur natuerlicher Vorrat, Rest Retirement/Kammer.
  const rNat = raidNatural;
  const T = 3600 - rNat * tR;
  const A = regenPerH - rNat * sR;
  const x = fill(T, A);
  console.log(`EICHUNG Spieler allein: Soll Raids ${f(rNat)}/h, Retirement ${f(x.c)}/h, Kammer ${f(x.h)} min/h, Rang ${f(rNat * eR + x.c * eC, 0)}/h`);
  console.log(`         Ist 07:33-08:33 (Konsole): Raids 17/h (8 Erfolge), Retirement 51/h, Kammer 23 x 60 s = 23 min/h, Rang +593/h (Raid-Glueck 8/17)
`);
}
{
  // Eichung des Chaos-Modells (Bladeburner.ts:841 Raid *(1+U(1..5)/100), :878-885 Bounty +0,02 / Retirement +0,04 je Erfolg)
  const names = ["06-33_hourly", "07-33_hourly", "08-33_hourly", "09-19_pre-hotswap", "09-33_hourly", "09-46_connect", "09-59_pre-hotswap"];
  const st2 = names.map((n) => stateOf(path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T" + n + ".json.gz")));
  let lnMean = 0; for (let k = 1; k <= 5; k++) lnMean += Math.log(1 + k / 100) / 5;
  const out = [];
  for (let i = 1; i < st2.length; i++) {
    const A = st2[i - 1], Z = st2[i];
    const nRaid = (Z.sc.Raid.s + Z.sc.Raid.f) - (A.sc.Raid.s + A.sc.Raid.f);
    const add2 = 0.04 * (Z.sc.Retirement.s - A.sc.Retirement.s) + 0.02 * (Z.sc["Bounty Hunter"].s - A.sc["Bounty Hunter"].s);
    const soll = A.chaos * Math.exp(nRaid * lnMean) + add2;
    out.push(`${names[i - 1].slice(0, 5)}->${names[i].slice(0, 5)}: ${nRaid} Raids, Soll ${f(soll, 2)} Ist ${f(Z.chaos, 2)}`);
  }
  console.log("EICHUNG Chaos Sector-12: " + out.join(" | "));
  console.log("");
}
for (const chaosBalance of [false, true]) {
  console.log(chaosBalance ? "MIT Chaos-Gleichgewicht (Raid-Chaos muss abgebaut werden):" : "OHNE Chaos-Nebenbedingung:");
  const rows = [];
  for (let nI = 0; nI <= 3; nI++) for (let nH = 0; nH <= 3 - nI; nH++) for (let nD = 0; nD <= 3 - nI - nH; nD++) {
    const nC = 3 - nI - nH - nD;
    const b = solve(nI, nH, nC, nD, chaosBalance);
    rows.push({ nI, nH, nC, nD, ...b });
  }
  rows.sort((a, b) => b.v - a.v);
  for (const x of rows) {
    console.log(`  I${x.nI} K${x.nH} V${x.nC} D${x.nD}: ${f(x.v, 0)} Rang/h  (Raids ${f(x.r)}, SR ${f(x.sr)}, Retirement ${f(x.c)}, Spieler-Kammer ${f(x.h)} min, Spieler-Diplomacy ${f(x.dP)} min)`);
  }
}
