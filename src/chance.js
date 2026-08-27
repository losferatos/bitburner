/** Die WAHRE Erfolgschance der naechsten Black Operation - gerechnet, nicht geschaetzt.
 *
 * WOZU
 *
 * `getActionEstimatedSuccessChance` liefert fuer eine Black Op ein Paar
 * [min, max], und `blade.js` entscheidet an `min` gegen `SICHER_BLACKOP`.
 * Diese Spanne ist bei Black Ops aber **reines Bevoelkerungsrauschen**:
 * `Actions/BlackOperation.ts:55-61` gibt fuer `getPopulationSuccessFactor()`
 * und `getChaosSuccessFactor()` fest 1 zurueck, also ist in
 * `getSuccessRange` (`Actions/Action.ts:144-167`) `est === real` und damit
 * `diff = 0` - trotzdem wird danach `low *= r` mit `r = city.pop/city.popEst`
 * gerechnet. `popEst` startet bei `pop*(rand+0,5)` (`City.ts:23`), kann also
 * das Anderthalbfache betragen; dann sieht der Motor zwei Drittel der
 * wahren Chance und wartet umsonst.
 *
 * Alle Eingaben der wahren Chance sind ueber die API lesbar. Dieses Skript
 * baut `Action.getSuccessChance` (`Actions/Action.ts:169-196`) nach und
 * stellt das Ergebnis neben das API-Paar. Weicht es ab, ist bewiesen, dass
 * `min` der falsche Wert zum Entscheiden ist.
 *
 * Ergebnis nach data/chance.json. Start ueber data/task.txt.
 * @param {NS} ns */

// Aus reference/bitburner-src/src/Bladeburner/data/Skills.ts - `mult = 1 +
// baseMult*stufe/100`, multiplikativ ueber alle Faehigkeiten desselben Namens
// (`Bladeburner.ts:778-783`).
const SKILL_MULTS = {
  "Blade's Intuition": { SuccessChanceAll: 3 },
  "Cloak": { SuccessChanceStealth: 5.5 },
  "Short-Circuit": { SuccessChanceKill: 5.5 },
  "Digital Observer": { SuccessChanceOperation: 4 },
  "Tracer": { SuccessChanceContract: 4 },
  "Reaper": { EffStr: 2, EffDef: 2, EffDex: 2, EffAgi: 2 },
  "Evasive System": { EffDex: 4, EffAgi: 4 },
};

/** @param {NS} ns */
export async function main(ns) {
  if (!ns.bladeburner.inBladeburner()) return;

  const name = ns.bladeburner.getNextBlackOp()?.name;
  if (!name) { ns.write("data/chance.json", JSON.stringify({
    zeit: Date.now(), fehler: "keine Black Op offen" }), "w"); return; }

  // --- Faehigkeitsmultiplikatoren aufsammeln --------------------------------
  const mult = {};
  for (const [skill, wirkungen] of Object.entries(SKILL_MULTS)) {
    let stufe = 0;
    try { stufe = ns.bladeburner.getSkillLevel(skill); } catch { continue; }
    if (!stufe) continue;
    for (const [was, basis] of Object.entries(wirkungen)) {
      mult[was] = (mult[was] ?? 1) * (1 + (basis * stufe) / 100);
    }
  }
  const m = (was) => mult[was] ?? 1;

  // --- Eingaben aus dem Spiel ----------------------------------------------
  const p = ns.getPlayer();
  const s = p.skills;
  const [stamina, maxStamina] = ns.bladeburner.getStamina();
  let teamCount = 0;
  try { teamCount = ns.bladeburner.getTeamSize("Black Operations", name); } catch {}

  // Wirksame Kampfwerte (`Bladeburner.ts:757-771`)
  const eff = {
    hacking: s.hacking,
    strength: s.strength * m("EffStr"),
    defense: s.defense * m("EffDef"),
    dexterity: s.dexterity * m("EffDex"),
    agility: s.agility * m("EffAgi"),
    charisma: s.charisma * m("EffCha"),
    intelligence: s.intelligence,
  };

  // --- Die Aktionsdaten, statisch aus data/BlackOperations.ts ---------------
  // Nur Typhoon vollstaendig; die spaeteren teilen sich Gewichte und Decays
  // weitgehend, aber wer sie braucht, traegt sie hier nach, statt zu raten.
  const AKTION = {
    "Operation Typhoon": {
      baseDifficulty: 2000, isKill: true, isStealth: false,
      weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2,
        agility: 0.2, charisma: 0, intelligence: 0.1 },
      decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8,
        agility: 0.8, charisma: 0, intelligence: 0.75 },
    },
  }[name];

  const paar = ns.bladeburner.getActionEstimatedSuccessChance("Black Operations", name);
  const ergebnis = {
    zeit: Date.now(), aktion: name,
    api: { min: paar[0], max: paar[1] },
    stufen: Object.fromEntries(Object.keys(SKILL_MULTS)
      .map((k) => [k, (() => { try { return ns.bladeburner.getSkillLevel(k); } catch { return 0; } })()])),
    teamCount, stamina, maxStamina,
  };

  if (!AKTION) {
    ergebnis.fehler = "Aktionsdaten fuer '" + name + "' fehlen im Skript";
  } else {
    let competence = 0;
    for (const stat of Object.keys(AKTION.weights)) {
      if (!AKTION.weights[stat]) continue;
      competence += AKTION.weights[stat] * Math.pow(eff[stat], AKTION.decays[stat]);
    }
    // calculateIntelligenceBonus(int, 0.75) = 1 + 0.75*int^0.8/600
    competence *= 1 + (0.75 * Math.pow(s.intelligence, 0.8)) / 600;
    competence *= Math.min(1, stamina / (0.5 * maxStamina));   // StaminaPenalty
    competence *= Math.pow(teamCount + 1, 0.05);               // TeamSuccessBonus
    // getPopulationSuccessFactor und getChaosSuccessFactor sind bei Black Ops 1
    competence *= m("SuccessChanceAll");                       // Blade's Intuition
    competence *= m("SuccessChanceOperation");                 // Digital Observer
    if (AKTION.isStealth) competence *= m("SuccessChanceStealth");
    if (AKTION.isKill) competence *= m("SuccessChanceKill");   // Short-Circuit
    competence *= p.mults.bladeburner_success_chance ?? 1;

    ergebnis.wahr = Math.min(1, competence / AKTION.baseDifficulty);
    ergebnis.competence = competence;
    ergebnis.abweichungZuMin = ergebnis.wahr - paar[0];
  }
  ns.write("data/chance.json", JSON.stringify(ergebnis), "w");
}
