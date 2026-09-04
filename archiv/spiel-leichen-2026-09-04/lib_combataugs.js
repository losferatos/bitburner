/**
 * Alle Augmentierungen aus Bitburner v3.0.1, die mindestens einen Kampfwert-
 * oder Bladeburner-Multiplikator setzen (strength, defense, dexterity,
 * agility, deren _exp-Varianten sowie bladeburner_success_chance,
 * bladeburner_max_stamina, bladeburner_stamina_gain, bladeburner_analysis).
 * Maschinell aus `reference/v301/src/Augmentation/Augmentations.ts` gezogen,
 * Anzeigenamen aus `Augmentation/Enums.ts` aufgeloest.
 *
 * WOZU. `lib/hackaugs.js` kennt nur Hacking- und Reputationsmultiplikatoren -
 * das war richtig, solange der Knotenausgang am Hackniveau hing. In BitNode 6
 * und 7 haengt er an 21 Black Operations, und deren Erfolgschance ist
 * `competence / baseDifficulty` mit
 * `competence = SUMME weights[stat] * effSkill[stat]^0,9`
 * (`Bladeburner/Actions/Action.ts:169-196`). Ohne diese Liste bewertet der
 * Reputationsmotor SPTN-97 (x1,75 auf alle vier Kampfwerte) mit null.
 *
 * Gemessen am 27.08.2026 um 02:48: Der Hacking-Ausgang von BitNode 6 verlangt
 * Hacking 6000 bei einem effektiven Multiplikator von 0,559 - das sind
 * 2,44 x 10^148 Erfahrung gegen einen Bestand von 3,55 Millionen. Der
 * Bladeburner-Weg braucht dagegen Faktor 5,63 in den Kampfwerten, und die
 * zehn staerksten Stuecke dieser Liste ergeben zusammen x6,91.
 *
 * Diese Datei ist eine Momentaufnahme des Quelltexts, keine Herleitung. Bei
 * einem Versionswechsel muss sie neu erzeugt werden. Augmentierungen ohne
 * Faktion (im Spiel nirgends erhaeltlich) sind nicht aufgenommen.
 */
export const COMBAT_AUGS = {
  "Augmented Targeting I": { dexterity: 1.1 },
  "Augmented Targeting II": { dexterity: 1.2 },
  "Augmented Targeting III": { dexterity: 1.3 },
  "BLADE-51b Tesla Armor": { strength: 1.04, defense: 1.04, dexterity: 1.04, agility: 1.04, bladeburner_success_chance: 1.03, bladeburner_stamina_gain: 1.02 },
  "BLADE-51b Tesla Armor: Energy Shielding Upgrade": { defense: 1.05, bladeburner_success_chance: 1.06 },
  "BLADE-51b Tesla Armor: IPU Upgrade": { bladeburner_success_chance: 1.02, bladeburner_analysis: 1.15 },
  "BLADE-51b Tesla Armor: Omnibeam Upgrade": { bladeburner_success_chance: 1.1 },
  "BLADE-51b Tesla Armor: Power Cells Upgrade": { bladeburner_success_chance: 1.05, bladeburner_max_stamina: 1.05, bladeburner_stamina_gain: 1.02 },
  "BLADE-51b Tesla Armor: Unibeam Upgrade": { bladeburner_success_chance: 1.08 },
  "Bionic Arms": { strength: 1.3, dexterity: 1.3 },
  "Bionic Legs": { agility: 1.6 },
  "Bionic Spine": { strength: 1.15, defense: 1.15, dexterity: 1.15, agility: 1.15 },
  "Blade's Runners": { agility: 1.05, bladeburner_max_stamina: 1.05, bladeburner_stamina_gain: 1.05 },
  "BrachiBlades": { strength: 1.15, defense: 1.15 },
  "Combat Rib I": { strength: 1.1, defense: 1.1 },
  "Combat Rib II": { strength: 1.14, defense: 1.14 },
  "Combat Rib III": { strength: 1.18, defense: 1.18 },
  "CordiARC Fusion Reactor": { strength: 1.35, defense: 1.35, dexterity: 1.35, agility: 1.35, strength_exp: 1.35, defense_exp: 1.35, dexterity_exp: 1.35, agility_exp: 1.35 },
  "DermaForce Particle Barrier": { defense: 1.4 },
  "EMS-4 Recombination": { bladeburner_success_chance: 1.03, bladeburner_stamina_gain: 1.02, bladeburner_analysis: 1.05 },
  "EsperTech Bladeburner Eyewear": { dexterity: 1.05, bladeburner_success_chance: 1.03 },
  "FocusWire": { strength_exp: 1.05, defense_exp: 1.05, dexterity_exp: 1.05, agility_exp: 1.05 },
  "GOLEM Serum": { strength: 1.07, defense: 1.07, dexterity: 1.07, agility: 1.07, bladeburner_stamina_gain: 1.05 },
  "Graphene Bionic Arms Upgrade": { strength: 1.85, dexterity: 1.85 },
  "Graphene Bionic Legs Upgrade": { agility: 2.5 },
  "Graphene Bionic Spine Upgrade": { strength: 1.6, defense: 1.6, dexterity: 1.6, agility: 1.6 },
  "Graphene Bone Lacings": { strength: 1.7, defense: 1.7 },
  "Graphene BrachiBlades Upgrade": { strength: 1.4, defense: 1.4 },
  "HemoRecirculator": { strength: 1.08, defense: 1.08, dexterity: 1.08, agility: 1.08 },
  "Hydroflame Left Arm": { strength: 2.8 },
  "HyperSight Corneal Implant": { dexterity: 1.4 },
  "Hyperion Plasma Cannon V1": { bladeburner_success_chance: 1.06 },
  "Hyperion Plasma Cannon V2": { bladeburner_success_chance: 1.08 },
  "I.N.T.E.R.L.I.N.K.E.D": { strength_exp: 1.05, defense_exp: 1.05, dexterity_exp: 1.05, agility_exp: 1.05, bladeburner_max_stamina: 1.1 },
  "INFRARET Enhancement": { dexterity: 1.1 },
  "LuminCloaking-V1 Skin Implant": { agility: 1.05 },
  "LuminCloaking-V2 Skin Implant": { defense: 1.1, agility: 1.1 },
  "NEMEAN Subdermal Weave": { defense: 2.2 },
  "Nanofiber Weave": { strength: 1.2, defense: 1.2 },
  "Neotra": { strength: 1.55, defense: 1.55 },
  "Neurotrainer I": { strength_exp: 1.1, defense_exp: 1.1, dexterity_exp: 1.1, agility_exp: 1.1 },
  "Neurotrainer II": { strength_exp: 1.15, defense_exp: 1.15, dexterity_exp: 1.15, agility_exp: 1.15 },
  "Neurotrainer III": { strength_exp: 1.2, defense_exp: 1.2, dexterity_exp: 1.2, agility_exp: 1.2 },
  "NutriGen Implant": { strength_exp: 1.2, defense_exp: 1.2, dexterity_exp: 1.2, agility_exp: 1.2 },
  "ORION-MKIV Shoulder": { strength: 1.05, defense: 1.05, dexterity: 1.05, bladeburner_success_chance: 1.04 },
  "Photosynthetic Cells": { strength: 1.4, defense: 1.4, agility: 1.4 },
  "Power Recirculation Core": { strength: 1.05, defense: 1.05, dexterity: 1.05, agility: 1.05, strength_exp: 1.1, defense_exp: 1.1, dexterity_exp: 1.1, agility_exp: 1.1 },
  "SPTN-97 Gene Modification": { strength: 1.75, defense: 1.75, dexterity: 1.75, agility: 1.75 },
  "SmartSonar Implant": { dexterity: 1.1, dexterity_exp: 1.15 },
  "Stanek's Gift - Awakening": { strength: 0.95, defense: 0.95, dexterity: 0.95, agility: 0.95, strength_exp: 0.95, defense_exp: 0.95, dexterity_exp: 0.95, agility_exp: 0.95 },
  "Stanek's Gift - Genesis": { strength: 0.9, defense: 0.9, dexterity: 0.9, agility: 0.9, strength_exp: 0.9, defense_exp: 0.9, dexterity_exp: 0.9, agility_exp: 0.9 },
  "Stanek's Gift - Serenity": { strength: 1, defense: 1, dexterity: 1, agility: 1, strength_exp: 1, defense_exp: 1, dexterity_exp: 1, agility_exp: 1 },
  "Synfibril Muscle": { strength: 1.3, defense: 1.3 },
  "Synthetic Heart": { strength: 1.5, agility: 1.5 },
  "The Black Hand": { strength: 1.15, dexterity: 1.15 },
  "Vangelis Virus": { dexterity_exp: 1.1, bladeburner_success_chance: 1.04, bladeburner_analysis: 1.1 },
  "Vangelis Virus 3.0": { defense_exp: 1.1, dexterity_exp: 1.1, bladeburner_success_chance: 1.05, bladeburner_analysis: 1.15 },
  "Wired Reflexes": { dexterity: 1.05, agility: 1.05 },
  "Xanipher": { strength: 1.2, defense: 1.2, dexterity: 1.2, agility: 1.2, strength_exp: 1.15, defense_exp: 1.15, dexterity_exp: 1.15, agility_exp: 1.15 },
  "nextSENS Gene Modification": { strength: 1.2, defense: 1.2, dexterity: 1.2, agility: 1.2 },
};

/**
 * Nutzen einer Augmentierung fuer die Black-Op-Erfolgschance.
 *
 * Die Chance ist `competence / difficulty`, und competence ist die gewichtete
 * Summe der Kampfwerte mit Exponent 0,9. Ein Faktor f auf den Multiplikator
 * eines Wertes hebt dessen Beitrag also um `f^0,9`, nicht um f - der
 * Unterschied ist bei x1,75 immerhin 6 Prozent.
 *
 * Die Gewichte sind die von Operation Typhoon (`data/BlackOperations.ts:15-21`):
 * je 0,2 auf str, def, dex und agi, dazu 0,1 auf hacking und charisma. Auf den
 * Kampfanteil normiert ist das je 0,25. Spaetere Black Ops verschieben die
 * Gewichte leicht, aber nie so weit, dass ein Wert unwichtig wuerde.
 *
 * `bladeburner_success_chance` multipliziert die competence direkt
 * (`Actions/Action.ts:190`) und geht deshalb ungedaempft ein.
 *
 * Die _exp-Multiplikatoren beschleunigen nur das Wachstum. Sie zaehlen mit
 * halbem Gewicht ueber den Logarithmus - dieselbe Behandlung wie Reputation
 * in `hackNutzen`, und aus demselben Grund: sie beschaffen den naechsten
 * Schritt, sind aber selbst keiner.
 */
export function combatNutzen(name) {
  const stats = COMBAT_AUGS[name];
  if (!stats) return 0;
  let wert = 0;
  for (const stat of ["strength", "defense", "dexterity", "agility"]) {
    const f = stats[stat];
    if (f > 1) wert += 0.25 * (Math.pow(f, 0.9) - 1);
  }
  if (stats.bladeburner_success_chance > 1) {
    wert += stats.bladeburner_success_chance - 1;
  }
  for (const stat of ["strength_exp", "defense_exp", "dexterity_exp", "agility_exp"]) {
    const f = stats[stat];
    if (f > 1) wert += 0.5 * 0.25 * Math.log(f);
  }
  // Ausdauer wirkt ueber die Kammerzeit, nicht ueber die Chance. Gemessen am
  // 26.08. um 21:45: Der Kammeranteil ist strukturell und faellt nur ueber
  // das Verhaeltnis Regeneration zu Verbrauch - beide Multiplikatoren treffen
  // genau das, deshalb halbes Gewicht wie bei der Erfahrung.
  for (const stat of ["bladeburner_max_stamina", "bladeburner_stamina_gain"]) {
    const f = stats[stat];
    if (f > 1) wert += 0.5 * Math.log(f);
  }
  return wert;
}
