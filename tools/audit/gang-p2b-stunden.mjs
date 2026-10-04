// P2b / Aufgabe B: von der Competence zur Zeit bis zum Bladeburner-Ausgang.
//
// Zwei Rechner:
//   forwardSim(snap, opt)  BN2.1 ab dem Live-Stand: Wann ist der Rang 400.000 erreicht
//                          (Endspiel), wann sind alle 21 Black Ops erledigt?
//                          Stufen (exp -> Stufe) und Black-Op-Chancen sind aus der
//                          Spielquelle gerechnet und geeicht (Stufe aus exp exakt,
//                          Chance gegen die Bot-Werte auf 4 Stellen). Der RANG ist
//                          eine ANNAHME (exp(gamma*t)), keine Rechnung - er haengt an
//                          Aktionsstufen, Raid-Vorrat und Ausdauer, die hier nicht
//                          nachgebaut sind; gamma wird als Szenario durchgereicht.
//   freshNodeSaving(k)     Kompetenzbegrenzter Abschnitt 1 eines frischen Knotens
//                          (BN2.2/2.3): Nachbau von verify-g01-substanz-phase1.mjs,
//                          UNVERAENDERT uebernommen (Parameterband a, gs, beta) und auf
//                          eine k-Reihe gelegt. GESCHAETZT, nicht geeicht.
//
// Aufruf: nur als Bibliothek (import).
import { blackOps, boSuccess, skillMults, boActionTime } from "./gang-p2b-lib.mjs";

const BN_HACK = 0.8; // BitNode.tsx case 2: HackingLevelMultiplier 0.8 (Kampfwerte 1)
const levelOf = (exp, mult, bn = 1) => Math.max(1, Math.floor(mult * bn * (32 * Math.log(exp + 534.6) - 200)));
export { levelOf };

/** Skillpunkte gesamt aus dem hoechsten Rang (Bladeburner.ts:1285-1292). */
export const totalPoints = (maxRank) => Math.floor((maxRank - 3) / 3 + 1);

// Kosten einer Stufe (Skill.ts calculateCost, Zahlen aus data/Skills.ts)
const COST = {
  "Blade's Intuition": [3, 2.1], "Short-Circuit": [2, 2.1], "Digital Observer": [2, 2.1], "Reaper": [2, 2.1],
  "Evasive System": [2, 2.1], "Cloak": [2, 1.1], "Tracer": [2, 2.1],
};
const stepCost = (n, L) => Math.round(COST[n][0] + COST[n][1] * L);
export const skillSpend = (skills) => Object.entries(skills).reduce((s, [n, L]) => {
  if (!COST[n]) return s;
  let c = 0; for (let i = 0; i < L; i++) c += stepCost(n, i);
  return s + c;
}, 0);

/**
 * Vorwaertsrechnung ab dem Live-Stand.
 * @param snap  SNAP aus gang-p2b-snapshot.mjs
 * @param o.gamma     angenommene Log-Wachstumsrate des Rangs je Stunde
 * @param o.rates     exp-Raten je Stunde { strength, defense, dexterity, agility, hacking }
 * @param o.policy    "sqrt" (Stufen wachsen mit sqrt(Punkte), Anteile eingefroren)
 *                    oder "greedy" (neue Punkte in den besten von Reaper/Evasive/BI/DO fuer Daedalus)
 * @param o.extra     { strength, defense, dexterity, agility } Zusatzfaktoren auf die Mults (Gang-Runde)
 * @param o.bbExtra   Zusatzfaktor auf bladeburner_success_chance
 * @param o.pThrEnd   Schwelle im Endspiel (0,35 mit Raid-Vorrat, 0,40 ohne)
 * @param o.hours     Rechenhorizont
 */
export function forwardSim(snap, o = {}) {
  const gamma = o.gamma ?? 0.5;
  const policy = o.policy ?? "sqrt";
  const extra = { strength: 1, defense: 1, dexterity: 1, agility: 1, ...(o.extra || {}) };
  const bbExtra = o.bbExtra ?? 1;
  const thrEarly = o.pThrEarly ?? 0.9;
  const thrEnd = o.pThrEnd ?? 0.40;
  const hours = o.hours ?? 30;
  const dt = o.dt ?? 0.02;
  const rates = o.rates;
  const done0 = snap.bb.numBlackOpsComplete;
  const P0 = totalPoints(snap.bb.maxRank);
  const bbBase = { ...snap.bb.skills };
  const spent0 = P0 - (snap.bb.skillPoints || 0); // gesamt minus ungenutzt (Modell exakt: spent+unspent = total)
  const stNeutral = {
    skills: snap.skills, m: skillMults(bbBase), stamina: snap.bb.maxStamina, maxStamina: snap.bb.maxStamina,
    bbSucc: snap.mults.bladeburner_success_chance * bbExtra, teamCount: 0,
  };
  let bbS = { ...bbBase };
  let spent = spent0;
  let cur = done0, tReady = 0, tE1 = null, tExit = null;
  const opLog = [];
  let last = null;

  const statesAt = (t) => {
    const skills = { ...snap.skills };
    for (const s of ["strength", "defense", "dexterity", "agility"]) {
      skills[s] = levelOf(snap.exp[s] + rates[s] * t, snap.mults[s] * extra[s]);
    }
    skills.hacking = levelOf(snap.exp.hacking + rates.hacking * t, snap.mults.hacking, BN_HACK);
    return skills;
  };

  for (let t = 0; t <= hours + 1e-9; t += dt) {
    const R = snap.bb.rank * Math.exp(gamma * t);
    const P = totalPoints(R);
    const skills = statesAt(t);
    if (policy === "sqrt") {
      const f = Math.sqrt(P / P0);
      for (const k of Object.keys(COST)) bbS[k] = Math.floor((bbBase[k] || 0) * f);
    } else {
      // gierig: neue Punkte dorthin, wo ln(Chance von Daedalus) je Punkt am meisten steigt
      let free = P - spent;
      const daed = blackOps[20];
      const chanceLn = (lv) => Math.log(boSuccess(daed, 1, { ...stNeutral, skills, m: skillMults(lv) }).p);
      let guard = 0;
      while (free > 0 && guard++ < 5000) {
        let best = null;
        const base = chanceLn(bbS);
        for (const n of ["Reaper", "Evasive System", "Blade's Intuition", "Digital Observer"]) {
          const c = stepCost(n, bbS[n] || 0);
          if (c > free) continue;
          const g = (chanceLn({ ...bbS, [n]: (bbS[n] || 0) + 1 }) - base) / c;
          if (!best || g > best.g) best = { n, c, g };
        }
        if (!best) break;
        bbS[best.n] = (bbS[best.n] || 0) + 1; free -= best.c; spent += best.c;
      }
    }
    const st = { ...stNeutral, skills, m: skillMults(bbS) };
    const endspiel = R >= 400000;
    if (endspiel && tE1 === null) tE1 = t;
    // Black-Op-Kette: Reihenfolge, Rang, Chance >= Schwelle, dann Dauer / Chance (erwartete Versuche)
    while (cur < 21 && t >= tReady) {
      const op = blackOps[cur];
      const ch = boSuccess(op, 1, st).p;
      const thr = endspiel ? thrEnd : thrEarly;
      if (R >= op.reqdRank && ch >= thr) {
        const dur = boActionTime(op, 1, st) / 3600 / Math.min(1, ch);
        opLog.push({ n: op.name, t, ch, dur });
        tReady = t + dur;
        cur++;
        if (cur === 21) tExit = tReady;
      } else break;
    }
    last = { t, R, skills, bbS: { ...bbS }, daed: boSuccess(blackOps[20], 1, st).p };
    if (tExit !== null && tE1 !== null) break;
  }
  return { tE1, tExit, opLog, last, P0 };
}

// ---------------------------------------------------------------------------
// Frischer Knoten (BN2.2/2.3), kompetenzbegrenzter Abschnitt 1
// ---------------------------------------------------------------------------

/**
 * Nachbau von tools/audit/verify-g01-substanz-phase1.mjs (G01 Substanz-Pruefer),
 * Zeile fuer Zeile uebernommen: C = S(Rang) * T(t) * k, S ~ Rang^a, T = exp(gs t),
 * Rangrate R0 * C^beta, geeicht auf BN2.1 22:17 (Rang 7178, 435 Rang/h). Das Band
 * der drei Parameter ist das des Pruefers. Ausgabe: gesparte Stunden bis Rang
 * target. NICHT neu geeicht - das Modell ist eine Abschaetzung.
 */
function phase1Run({ k = 1, a = 0.5, gs = 0.042, beta = 1, target = 25000, tStart = 0.5, dt = 0.01, R0 = 435, rank0 = 7178 }) {
  let r = rank0, t = 0;
  while (r < target && t < 300) {
    const kk = t >= tStart ? k : 1;
    const lost = (k > 1 && t < tStart) ? 0 : 1;
    const C = Math.pow(r / rank0, a) * Math.exp(gs * t) * kk;
    r += lost * R0 * Math.pow(C, beta) * dt;
    t += dt;
  }
  return t;
}

/** Gesparte Stunden fuer Faktor k: Minimum, Mittel, Maximum ueber das Parameterband. */
export function freshNodeSaving(k, target = 25000) {
  const vals = [];
  for (const a of [0.42, 0.57]) for (const gs of [0.042, 0.08]) for (const beta of [0.8, 1.0, 1.25]) {
    const b = phase1Run({ a, gs, beta, target }), g = phase1Run({ a, gs, beta, k, target });
    vals.push(b - g);
  }
  const min = Math.min(...vals), max = Math.max(...vals);
  const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
  return { min, mean, max };
}
