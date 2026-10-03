// Audit 03.10.2026, Bereich STGO: IPvGO-Ertragsrechner.
//
// Formeln 1:1 aus reference/bitburner-src/src (3.0.2):
//   CalculateEffect        Go/effects/effect.ts:16-22
//   getMaxRep              Go/effects/effect.ts:30-44
//   getWinstreakMultiplier Go/effects/effect.ts:119-130
//   getDifficultyMultiplier Go/effects/effect.ts:132-135
//   nodePower-Zuwachs, Favor je zweitem Serien-Sieg  Go/boardAnalysis/scoring.ts:46-99
//   repToFavor / addRepToFavor  Faction/formulas/favor.ts
//   opponentDetails (komi, bonusPower)  Go/Constants.ts:211-275
//   GoPower BN14 = 4  BitNode/BitNode.tsx:1042, sonst 1 (BitNodeMultipliers.ts:97)
//
// NICHT GEEICHT: Kein Spielstand hat je Go-Daten (tools/audit/stgo-save-scan.mjs:
// alle 21 geprueften Staende go.stats = {}). Die Spielstaerke eines einfachen
// Skripts (Siegquote, Punkte je Partie, Sekunden je Partie) ist GESCHAETZT und
// steht als Parameter oben. Die Kette Stufen-Multiplikator -> Black-Op-Chance
// ist dagegen geeicht (tools/audit/stgo-blade.mjs).
//
// Aufruf: node tools/audit/stgo-go.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadState, blackOpChance, TYPHOON, skillsWithCombatFactor, calculateExp } from "./stgo-blade.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const OPP = {
  Netburners: { komi: 1.5, power: 1.3, bonus: "hacknet_node_money" },
  "Slum Snakes": { komi: 3.5, power: 1.2, bonus: "crime_success" },
  "The Black Hand": { komi: 3.5, power: 0.9, bonus: "hacking_money" },
  Tetrads: { komi: 5.5, power: 0.7, bonus: "str/def/dex/agi (Stufe)" },
  Daedalus: { komi: 5.5, power: 1.1, bonus: "faction_rep+company_rep" },
  Illuminati: { komi: 7.5, power: 0.7, bonus: "hacking_speed" },
  w0r1d_d43m0n: { komi: 9.5, power: 2, bonus: "hacking (Stufe), nur mit TRP" },
};

export function calculateEffect(nodes, power, goPower = 1, sf14 = 0) {
  const sourceFileBonus = sf14 ? 2 : 1;
  return 1 + Math.log(nodes + 1) * Math.pow(nodes + 1, 0.3) * 0.002 * power * goPower * sourceFileBonus;
}
export function getMaxRep(sf14) {
  if (sf14 === 1) return 200_000;
  if (sf14 === 2) return 300_000;
  if (sf14 >= 3) return 400_000;
  return 100_000;
}
export function getWinstreakMultiplier(winStreak, previousWinStreak) {
  if (winStreak < 0) return 0.5;
  if (previousWinStreak < 0 && winStreak > 0) return 1 + 0.5 * Math.min(-previousWinStreak, 8);
  return 1 + 0.25 * Math.min(winStreak, 8);
}
export function getDifficultyMultiplier(komi, boardSize, illuminatiKomi = 7.5) {
  return boardSize === 5 && komi === illuminatiKomi ? 8 : (komi + 0.5) * 0.25;
}
const log1point02 = 0.019802627296179712;
export const repToFavor = (r) => Math.log1p(r / 25000) / log1point02;
export const favorToRep = (f) => 25000 * Math.expm1(log1point02 * f);

// deterministischer Zufall fuer wiederholbare Laeufe
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Simuliert einen Partienstrom gegen EINEN Gegner nach scoring.ts:46-99.
 * Gibt nodePower und Favor-Rep nach `hours` zurueck, dazu das zeitgemittelte
 * Effektmittel (Bestand waechst - das Mittel ueber den Zyklus ist kleiner als
 * der Endwert; "Rate oder Bestand").
 */
export function simulate({ opp, boardSize = 7, secPerGame, pWin, scoreWin, scoreLoss, hours, goPower = 1, sf14 = 0, member = true, seed = 7 }) {
  const o = OPP[opp];
  const r = rng(seed);
  const games = Math.floor((hours * 3600) / secPerGame);
  let nodePower = 0, winStreak = 0, oldWinStreak = 0, rep = 0, wins = 0, effSum = 0;
  const diff = getDifficultyMultiplier(o.komi, boardSize);
  for (let g = 0; g < games; g++) {
    const win = r() < pWin;
    let score;
    if (!win) {
      // resetWinstreak(gameComplete=true): scoring.ts:118-128
      oldWinStreak = winStreak;
      winStreak = winStreak >= 0 ? -1 : winStreak - 1;
      score = scoreLoss;
    } else {
      wins++;
      oldWinStreak = winStreak;
      winStreak = oldWinStreak < 0 ? 1 : winStreak + 1;
      if (member && winStreak % 2 === 0 && rep < getMaxRep(sf14)) rep += getMaxRep(sf14) / 200;
      score = scoreWin;
    }
    nodePower += score * diff * getWinstreakMultiplier(winStreak, oldWinStreak);
    effSum += calculateEffect(nodePower, o.power, goPower, sf14);
  }
  return {
    games, wins, nodePower,
    effectEnd: calculateEffect(nodePower, o.power, goPower, sf14),
    effectMean: games ? effSum / games : 1,
    favorFromRep: repToFavor(rep), rep,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // 1) Effekt gegen nodePower - reine Formel
  console.log("1) Bonus in % gegen nodePower (Formel effect.ts:16-22)");
  const grid = [100, 1000, 3000, 10000, 30000, 100000];
  console.log("   " + "Gegner/Knoten".padEnd(30) + grid.map((n) => String(n).padStart(9)).join(""));
  for (const [opp, label, gp, sf] of [
    ["Tetrads", "Tetrads normal", 1, 0], ["Tetrads", "Tetrads BN14 (GoPower 4)", 4, 0],
    ["Tetrads", "Tetrads mit SF14", 1, 1], ["Tetrads", "Tetrads BN14.2/3 (4 x SF14)", 4, 1],
    ["Daedalus", "Daedalus normal", 1, 0], ["Netburners", "Netburners normal", 1, 0],
    ["w0r1d_d43m0n", "w0r1d_d43m0n mit SF14 (BN8)", 1, 1],
  ]) {
    const row = grid.map((n) => ((calculateEffect(n, OPP[opp].power, gp, sf) - 1) * 100).toFixed(1).padStart(8) + "%");
    console.log("   " + label.padEnd(30) + row.join(""));
  }

  // 2) Partienstrom - GESCHAETZTE Spielstaerke eines einfachen Skripts
  // Sekunden je Partie: KI-Zug = 4-7 waitCycle a 200 ms (goAI.ts:176-212,
  // 849-883, 98) -> ~1 s; 7x7 ~ 20-25 KI-Zuege. Echtzeit-Timer, kein Nachholen
  // ausser Offline-Zeit (Go.ts:196-200, engine.tsx:335).
  const SZ = [
    { name: "pessimistisch", sec: 30, pWin: 0.15, scoreWin: 22, scoreLoss: 6 },
    { name: "mittel", sec: 25, pWin: 0.35, scoreWin: 25, scoreLoss: 10 },
    { name: "optimistisch", sec: 20, pWin: 0.6, scoreWin: 28, scoreLoss: 12 },
  ];
  console.log("\n2) Tetrads 7x7, nodePower und Bonus nach h Stunden sichtbarem Tab (GESCHAETZTE Spielstaerke)");
  for (const s of SZ) {
    for (const [lab, gp, sf] of [["normal", 1, 0], ["BN14", 4, 0], ["SF14", 1, 1]]) {
      const parts = [1, 3, 6, 12].map((h) => {
        const x = simulate({ opp: "Tetrads", secPerGame: s.sec, pWin: s.pWin, scoreWin: s.scoreWin, scoreLoss: s.scoreLoss, hours: h, goPower: gp, sf14: sf });
        return `${h}h: NP ${Math.round(x.nodePower)} Ende +${((x.effectEnd - 1) * 100).toFixed(0)}% Mittel +${((x.effectMean - 1) * 100).toFixed(0)}%`;
      });
      console.log(`   ${s.name.padEnd(14)} ${lab.padEnd(6)} ${parts.join(" | ")}`);
    }
  }

  // 3) Favor aus Siegesserien (scoring.ts:67-79), je Knoten, nur als Mitglied
  console.log("\n3) Favor aus Serien: maxRep je Knoten und Gegner -> Favor (favor.ts)");
  for (const sf of [0, 1, 2, 3]) console.log(`   SF14.${sf}: maxRep ${getMaxRep(sf)} -> +${repToFavor(getMaxRep(sf)).toFixed(2)} Favor (von 0)`);
  const nb = simulate({ opp: "Netburners", secPerGame: 20, pWin: 0.9, scoreWin: 28, scoreLoss: 10, hours: 3 });
  console.log(`   Netburners 7x7 pWin 0,9, 20 s/Partie, 3 h: ${nb.games} Partien, Rep ${nb.rep}, Favor +${nb.favorFromRep.toFixed(1)}, Bonus Hacknet +${((nb.effectEnd - 1) * 100).toFixed(0)}%`);
  const dd = simulate({ opp: "Daedalus", secPerGame: 25, pWin: 0.3, scoreWin: 25, scoreLoss: 10, hours: 6 });
  console.log(`   Daedalus 7x7 pWin 0,3, 25 s/Partie, 6 h: Rep ${dd.rep}, Favor +${dd.favorFromRep.toFixed(1)}, Bonus Rep +${((dd.effectEnd - 1) * 100).toFixed(0)}%`);

  // 4) Uebersetzung Tetrads-Bonus -> Black-Op-Chance (geeichte Kette, Spielstand BN2.1)
  const file = path.join(root, "backups", "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
  const { p, bb } = loadState(file);
  const team = bb.blackOperations?.["Operation Typhoon"]?.data?.teamCount ?? 0;
  const c0 = blackOpChance(TYPHOON, p.skills, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
  console.log("\n4) Tetrads-Bonus auf Typhoon-Chance (Spielstand BN2.1 09:59, geeichte Kette) und Exp-Aequivalent");
  for (const f of [1.05, 1.1, 1.2, 1.31, 1.5, 2.0]) {
    const s = skillsWithCombatFactor(p, f);
    const c = blackOpChance(TYPHOON, s, bb.skills, p.mults, bb.maxStamina, bb.maxStamina, team);
    // Exp-Aequivalent: wie viel MEHR Kampf-Exp braeuchte man ohne Bonus fuer dieselbe Stufe?
    const L = s.strength;
    const eq = calculateExp(L, p.mults.strength) / p.exp.strength;
    console.log(`   +${((f - 1) * 100).toFixed(0)}% Stufen-Mult -> str ${p.skills.strength}->${L}, Chance x${(c / c0).toFixed(3)}, entspricht x${eq.toFixed(2)} Kampf-Exp`);
  }
}
