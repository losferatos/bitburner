/**
 * Liste aller Augmentierungen aus Bitburner v3.0.1, die mindestens einen
 * Hacking- oder Reputations-Multiplikator setzen (hacking, hacking_exp,
 * hacking_chance, hacking_speed, hacking_money, hacking_grow, faction_rep,
 * company_rep). Maschinell extrahiert aus dem Bitburner-Quellcode unter
 * reference/bitburner-src/src/Augmentation/Augmentations.ts (Anzeigenamen
 * dabei aus Enums.ts aufgeloest, da im Quelltext nur AugmentationName.X
 * referenziert wird).
 *
 * Diese Datei ist eine Momentaufnahme des Quelltexts, keine Herleitung.
 * Bei einem Bitburner-Versionswechsel muss sie neu erzeugt werden, weil
 * sich Werte, Namen oder die Liste der Augmentierungen aendern koennen.
 *
 * Augmentierungen mit factions: [] (im Spiel nirgends erhaeltlich, z.B.
 * ueber die Darknet-Labyrinth-Kette oder "BigD's Big ... Brain") sind
 * absichtlich NICHT aufgenommen.
 *
 * NeuroFlux Governor: der Quelltext rechnet je Stufe mit
 * "1.01 + donationBonus" (donationBonus haengt von SoA-Spenden ab und ist
 * hier nicht modelliert). Eingetragen ist der Basiswert 1.01 je Stufe.
 *
 * Stanek's Gift (Awakening/Serenity): der Quelltext setzt die Werte relativ
 * zur vorherigen Stanek-Stufe (0.95 / 0.9 bzw. 1 / 0.95). Hier stehen die
 * Ausdruecke unveraendert, damit JS sie beim Laden exakt so berechnet wie
 * im Original.
 *
 * WOZU: Der Bot muss beim Freischalten von Augmentierungen priorisieren,
 * welche fuer das Hacking-Ziel den groessten Nutzen bringen, statt einfach
 * die zuerst erreichbaren zu nehmen. Dafuer liefert hackNutzen() unten eine
 * einzelne Vergleichszahl je Augmentierung.
 */
export const HACK_AUGS = {
  "ADR-V1 Pheromone Gene": { faction_rep: 1.1, company_rep: 1.1 },
  "ADR-V2 Pheromone Gene": { faction_rep: 1.2, company_rep: 1.2 },
  "Artificial Bio-neural Network Implant": { hacking: 1.12, hacking_speed: 1.03, hacking_money: 1.15 },
  "Artificial Synaptic Potentiation": { hacking_exp: 1.05, hacking_chance: 1.05, hacking_speed: 1.02 },
  "BitRunners Neurolink": { hacking: 1.15, hacking_exp: 1.2, hacking_chance: 1.1, hacking_speed: 1.05 },
  "BitWire": { hacking: 1.05 },
  "Cranial Signal Processors - Gen I": { hacking: 1.05, hacking_speed: 1.01 },
  "Cranial Signal Processors - Gen II": { hacking: 1.07, hacking_chance: 1.05, hacking_speed: 1.02 },
  "Cranial Signal Processors - Gen III": { hacking: 1.09, hacking_speed: 1.02, hacking_money: 1.15 },
  "Cranial Signal Processors - Gen IV": { hacking_speed: 1.02, hacking_money: 1.2, hacking_grow: 1.25 },
  "Cranial Signal Processors - Gen V": { hacking: 1.3, hacking_money: 1.25, hacking_grow: 1.75 },
  "CRTX42-AA Gene Modification": { hacking: 1.08, hacking_exp: 1.15 },
  "DataJack": { hacking_money: 1.25 },
  "ECorp HVMind Implant": { hacking_grow: 3 },
  "Embedded Netburner Module": { hacking: 1.08 },
  "Embedded Netburner Module Analyze Engine": { hacking_speed: 1.1 },
  "Embedded Netburner Module Core Implant": { hacking: 1.07, hacking_exp: 1.07, hacking_chance: 1.03, hacking_speed: 1.03, hacking_money: 1.1 },
  "Embedded Netburner Module Core V2 Upgrade": { hacking: 1.08, hacking_exp: 1.15, hacking_chance: 1.05, hacking_speed: 1.05, hacking_money: 1.3 },
  "Embedded Netburner Module Core V3 Upgrade": { hacking: 1.1, hacking_exp: 1.25, hacking_chance: 1.1, hacking_speed: 1.05, hacking_money: 1.4 },
  "Embedded Netburner Module Direct Memory Access Upgrade": { hacking_chance: 1.2, hacking_money: 1.4 },
  "Enhanced Myelin Sheathing": { hacking: 1.08, hacking_exp: 1.1, hacking_speed: 1.03 },
  "FocusWire": { hacking_exp: 1.05, company_rep: 1.1 },
  "Glibness Enhancement": { company_rep: 1.1 },
  "HyperSight Corneal Implant": { hacking_speed: 1.03, hacking_money: 1.1 },
  "Magnetism Amplifier": { company_rep: 1.1 },
  "Neural Accelerator": { hacking: 1.1, hacking_exp: 1.15, hacking_money: 1.2 },
  "Neural Wit Amplifier": { company_rep: 1.05 },
  "Neural-Retention Enhancement": { hacking_exp: 1.25 },
  "Neuralstimulator": { hacking_exp: 1.12, hacking_chance: 1.1, hacking_speed: 1.02 },
  "Neuregen Gene Modification": { hacking_exp: 1.4 },
  "NeuroFlux Governor": { hacking: 1.01, hacking_exp: 1.01, hacking_chance: 1.01, hacking_speed: 1.01, hacking_money: 1.01, hacking_grow: 1.01, faction_rep: 1.01, company_rep: 1.01 },
  "Neuronal Densification": { hacking: 1.15, hacking_exp: 1.1, hacking_speed: 1.03 },
  "Neurotrainer I": { hacking_exp: 1.1 },
  "Neurotrainer II": { hacking_exp: 1.15 },
  "Neurotrainer III": { hacking_exp: 1.2 },
  "nextSENS Gene Modification": { hacking: 1.2 },
  "Nuoptimal Nootropic Injector Implant": { company_rep: 1.2 },
  "OmniTek InfoLoad": { hacking: 1.2, hacking_exp: 1.25 },
  "PC Direct-Neural Interface": { hacking: 1.08, company_rep: 1.3 },
  "PC Direct-Neural Interface NeuroNet Injector": { hacking: 1.1, hacking_speed: 1.05, company_rep: 2 },
  "PC Direct-Neural Interface Optimization Submodule": { hacking: 1.1, company_rep: 1.75 },
  "PCMatrix": { faction_rep: 1.0777, company_rep: 1.0777 },
  "Power Recirculation Core": { hacking: 1.05, hacking_exp: 1.1 },
  "QLink": { hacking: 1.75, hacking_chance: 2.5, hacking_speed: 2, hacking_money: 4 },
  "SmartJaw": { faction_rep: 1.25, company_rep: 1.25 },
  "Social Dynamics Processor": { company_rep: 1.3 },
  "Social Negotiation Assistant (S.N.A)": { faction_rep: 1.15, company_rep: 1.15 },
  "Speech Enhancement": { company_rep: 1.1 },
  "SPTN-97 Gene Modification": { hacking: 1.15 },
  "Stanek's Gift - Awakening": { hacking: 0.95 / 0.9, hacking_exp: 0.95 / 0.9, hacking_chance: 0.95 / 0.9, hacking_speed: 0.95 / 0.9, hacking_money: 0.95 / 0.9, hacking_grow: 0.95 / 0.9, faction_rep: 0.95 / 0.9, company_rep: 0.95 / 0.9 },
  "Stanek's Gift - Genesis": { hacking: 0.9, hacking_exp: 0.9, hacking_chance: 0.9, hacking_speed: 0.9, hacking_money: 0.9, hacking_grow: 0.9, faction_rep: 0.9, company_rep: 0.9 },
  "Stanek's Gift - Serenity": { hacking: 1 / 0.95, hacking_exp: 1 / 0.95, hacking_chance: 1 / 0.95, hacking_speed: 1 / 0.95, hacking_money: 1 / 0.95, hacking_grow: 1 / 0.95, faction_rep: 1 / 0.95, company_rep: 1 / 0.95 },
  "Synaptic Enhancement Implant": { hacking_speed: 1.03 },
  "The Black Hand": { hacking: 1.1, hacking_speed: 1.02, hacking_money: 1.1 },
  "The Shadow's Simulacrum": { faction_rep: 1.15, company_rep: 1.15 },
  "Xanipher": { hacking: 1.2, hacking_exp: 1.15 },
};

// Gewichtung: faction_rep und company_rep zaehlen nur halb, weil sie das
// Hacking-Ziel nur indirekt foerdern (schnellerer Zugang zu anderen
// Augmentierungen/Programmen), waehrend die anderen sechs Multiplikatoren
// direkt in Hacking-Geschwindigkeit, -Erfolg, -Erfahrung oder -Ertrag
// eingehen.
const HALF_WEIGHT_FIELDS = new Set(["faction_rep", "company_rep"]);

/**
 * Berechnet den relativen Hacking-Nutzen einer Augmentierung: das Produkt
 * aller ihrer Hacking-Multiplikatoren minus 1, wobei faction_rep und
 * company_rep mit halbem Gewicht eingehen (ihr Beitrag zum Produkt wird
 * per Quadratwurzel auf die Haelfte gedaempft). Unbekannter Name ergibt 0.
 */
export function hackNutzen(name) {
  const stats = HACK_AUGS[name];
  if (!stats) return 0;

  let product = 1;
  for (const [field, value] of Object.entries(stats)) {
    product *= HALF_WEIGHT_FIELDS.has(field) ? Math.sqrt(value) : value;
  }
  return product - 1;
}

/**
 * Nutzen einer Augmentierung fuer ein LEVELZIEL - die Zahl, auf die es beim
 * Abschluss eines BitNodes ankommt.
 *
 * WARUM ES DIESE ZWEITE FUNKTION GIBT (23.08.2026)
 *
 * hackNutzen oben behandelt alle Hacking-Multiplikatoren als gleichwertig und
 * multipliziert sie zusammen. Fuer den Geldfluss ist das richtig: dort zaehlt
 * jeder Faktor einmal. Fuer ein Levelziel ist es grob falsch.
 *
 * Das Level ist  skill = floor(mult * (32*ln(exp + 534,6) - 200))
 * (PersonObjects/formulas/skill.ts:13). Nach der noetigen Erfahrung aufgeloest:
 *
 *     exp(ziel, mult) = e^((ziel/mult + 200)/32) - 534,6
 *
 * Der Multiplikator sitzt also im EXPONENTEN, die Erfahrung nur linear davor.
 * Ein Prozent mehr `hacking` senkt die noetige Erfahrung bei Level 9000 und
 * mult 8 um rund 29 Prozent; ein Prozent mehr Erfahrungsrate senkt die
 * noetige ZEIT um ein Prozent. Das Verhaeltnis ist rund 35 : 1.
 *
 * Nicht enthalten, weil sie zum Level nichts beitragen:
 *   hacking_money  - Geld, kein Level
 *   hacking_grow   - Wachstum, kein Level
 *   hacking_chance - zusaetzlich nachweislich tot: auf joesguns liegt
 *                    skillChance * difficultyMult schon bei 0,949, der
 *                    vorhandene Multiplikator 3,02 treibt das auf 2,86, und
 *                    clampNumber(...,0,1) schneidet auf 1,00 (Hacking.ts:23).
 *
 * Der zurueckgegebene Wert ist die Ersparnis in LOGARITHMISCHER Erfahrung.
 *
 * NICHT STRENG ADDITIV: Der `hacking`-Anteil rechnet mit (1 - 1/f), und
 * (1-1/a) + (1-1/b) ist groesser als 1 - 1/(a*b). Zwei Stuecke mit je f=1,75
 * ergeben summiert 0,857 statt der korrekten 0,674 - die Summe ueberschaetzt
 * also, je mehr Stuecke zusammenkommen. Fuer eine RANGFOLGE einzelner Stuecke
 * ist das unerheblich, und genau dafuer ist die Funktion gedacht. Wer
 * Buendel gegeneinander stellt, muss die Faktoren erst multiplizieren und
 * dann einmal (1 - 1/Produkt) bilden.
 *
 * @param {string} name     Anzeigename der Augmentierung
 * @param {number} mult     aktueller Hacking-Multiplikator des Spielers
 * @param {number} ziel     angestrebtes Hacking-Level (BN4: 9000)
 * @returns {number}        Ersparnis in ln(Erfahrung); 0 bei unbekanntem Namen
 */
export function levelNutzen(name, mult, ziel) {
  const stats = HACK_AUGS[name];
  if (!stats) return 0;
  if (!(mult > 0) || !(ziel > 0)) return 0;

  // Der Multiplikator wirkt ueber ziel/(32*mult) im Exponenten: Ein Faktor f
  // auf `hacking` senkt ln(exp) um genau ziel/(32*mult) * (1 - 1/f).
  //
  // Hier stand zuerst ln(f) als Naeherung, mit der Begruendung, sie bleibe
  // ueber mehrere Stuecke additiv. Das trifft zu, ist aber kein Grund: die
  // exakte Form ist ueber das Produkt der Faktoren genauso zusammensetzbar,
  // und ln(f) ueberschaetzt sichtbar - bei f=1,2 um 9,4 Prozent, bei QLink
  // mit f=1,75 um 30,6 Prozent. Genau die grossen Stuecke wuerden damit
  // zusaetzlich bevorzugt, und das sind die teuersten.
  const hebel = ziel / (32 * mult);

  let wert = 0;
  if (stats.hacking > 0) wert += hebel * (1 - 1 / stats.hacking);
  // Erfahrungsrate und Tempo wirken beide linear auf die gesammelte
  // Erfahrung je Sekunde. Hier ist ln richtig und keine Naeherung: die
  // benoetigte ZEIT ist exp/rate, und ln der Zeitersparnis ist genau ln(f).
  if (stats.hacking_exp > 0) wert += Math.log(stats.hacking_exp);
  if (stats.hacking_speed > 0) wert += Math.log(stats.hacking_speed);
  // Reputation ist kein Levelbeitrag, aber sie beschafft die naechsten
  // Stuecke. Halbes Gewicht wie in hackNutzen, aus demselben Grund.
  if (stats.faction_rep > 0) wert += 0.5 * Math.log(stats.faction_rep);
  if (stats.company_rep > 0) wert += 0.5 * Math.log(stats.company_rep);
  return wert;
}

// ---------------------------------------------------------------------------
// KAMPFWERTE UND BLADEBURNER
// ---------------------------------------------------------------------------
//
// WARUM DAS HIER STEHT UND NICHT IN EINER EIGENEN DATEI (27.08.2026, 03:55).
//
// Es lag kurz in `lib/combataugs.js`. Dann fiel auf: `bn4net.js` fuehrt die
// Bibliotheken, die es beim Verschieben eines Werkzeugs mitkopiert, in einer
// festen Liste - `const BIBLIOTHEKEN = ["lib/hackaugs.js"]` (`bn4net.js:299`).
// Eine zweite Datei stuende dort nicht drin, und `bn4rep.js` waere abgestuerzt,
// sobald der Motor es auf einen anderen Rechner als home schiebt. Diese Liste
// zu erweitern hiesse `bn4net.js` anzufassen, und das ist Eric vorbehalten.
//
// Deshalb wohnt der Kampfteil in derselben Datei. Der Name der Datei ist damit
// zu eng - der Inhalt ist es nicht.

// `hacking` steht nur bei den Stuecken, die es wirklich tragen (Augmentations.ts,
// 03.10.2026 gegen den Quelltext nachgelesen: SPTN-97 1,15, nextSENS 1,2,
// Xanipher 1,2, The Black Hand 1,1, Power Recirculation Core 1,05). Die
// Torrunde (lib/einbau.js waehleTorRunde) rechnet den Hackingfaktor mit, weil
// hacking in die Black-Op-Competence eingeht (Gewicht 0,1, Exponent 0,6);
// combatNutzen und kampfknotenNuetzlich lesen den Schluessel nicht, an ihrem
// Verhalten aendert sich nichts.
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
  "Power Recirculation Core": { hacking: 1.05, strength: 1.05, defense: 1.05, dexterity: 1.05, agility: 1.05, strength_exp: 1.1, defense_exp: 1.1, dexterity_exp: 1.1, agility_exp: 1.1 },
  "SPTN-97 Gene Modification": { hacking: 1.15, strength: 1.75, defense: 1.75, dexterity: 1.75, agility: 1.75 },
  "SmartSonar Implant": { dexterity: 1.1, dexterity_exp: 1.15 },
  "Stanek's Gift - Awakening": { strength: 0.95, defense: 0.95, dexterity: 0.95, agility: 0.95, strength_exp: 0.95, defense_exp: 0.95, dexterity_exp: 0.95, agility_exp: 0.95 },
  "Stanek's Gift - Genesis": { strength: 0.9, defense: 0.9, dexterity: 0.9, agility: 0.9, strength_exp: 0.9, defense_exp: 0.9, dexterity_exp: 0.9, agility_exp: 0.9 },
  "Stanek's Gift - Serenity": { strength: 1, defense: 1, dexterity: 1, agility: 1, strength_exp: 1, defense_exp: 1, dexterity_exp: 1, agility_exp: 1 },
  "Synfibril Muscle": { strength: 1.3, defense: 1.3 },
  "Synthetic Heart": { strength: 1.5, agility: 1.5 },
  "The Black Hand": { hacking: 1.1, strength: 1.15, dexterity: 1.15 },
  "Vangelis Virus": { dexterity_exp: 1.1, bladeburner_success_chance: 1.04, bladeburner_analysis: 1.1 },
  "Vangelis Virus 3.0": { defense_exp: 1.1, dexterity_exp: 1.1, bladeburner_success_chance: 1.05, bladeburner_analysis: 1.15 },
  "Wired Reflexes": { dexterity: 1.05, agility: 1.05 },
  "Xanipher": { hacking: 1.2, strength: 1.2, defense: 1.2, dexterity: 1.2, agility: 1.2, strength_exp: 1.15, defense_exp: 1.15, dexterity_exp: 1.15, agility_exp: 1.15 },
  "nextSENS Gene Modification": { hacking: 1.2, strength: 1.2, defense: 1.2, dexterity: 1.2, agility: 1.2 },
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

// ---------------------------------------------------------------------------
// WAS IN EINEM KAMPFKNOTEN UEBERHAUPT GEKAUFT WIRD (23.09.2026)
// ---------------------------------------------------------------------------
//
// bn4rep.js kaufte jedes verdiente Stueck. Jedes gekaufte verteuert aber jedes
// weitere im selben Zyklus um Faktor 1,9 (AugmentationHelpers getAugCost),
// und die Aug-Ruecklage haelt dafuer Geld zurueck, das in BN9 sonst ueber
// Hashes zu Rang wird. Am 23.09. sparte der Bot zwei Stunden Hash-Einnahmen
// (~45.000 Hashes) fuer ADR-V1 Pheromone Gene - Firmen- und Faktionsruf x1,1,
// im Kampfknoten fast wertlos - und haette danach jedes Kampfstueck 1,9-mal
// teurer bezahlt. Erics Vorgabe: autonom, im Sinne von Effizienz.
//
// Nuetzlich im Kampfknoten ist: was Kampfwerte oder die Bladeburner-Chance
// hebt (combatNutzen > 0), The Blade's Simulacrum (Bladeburner-Aktionen
// neben anderer Arbeit), The Red Pill (die zweite Ausgangstuer - NUR im
// Hackingweg, bn4rep.js verlangt dafuer den positiven V1-Nachweis; hier bleibt
// sie nuetzlich, weil dieser Filter nur die Nuetzlichkeit beurteilt, nicht die
// Zulassung), und dort die Hacknet-Stuecke, wo NACH einem Einbau noch
// Hacknet-Server gekauft werden: `hacknetNachEinbau` (unten) = BN9.
//
// KORREKTUR 03.10.2026 (Audit G02): Hier stand "ueberall dort, wo es
// Hacknet-Server gibt (BN9 oder SF9)" und "hashes.js tauscht Hashes in jedem
// V2-Knoten in Rang". Beides gilt nur bis zum ERSTEN Einbau: Augmentierungen
// wirken erst nach dem Einbau, und der loescht alle Hacknet-Server. Der
// SF9.3-Gratisserver entsteht allein beim Knotenwechsel, nie beim Einbau.
// Die vier Stuecke wirkten nach dem Einbau nur noch auf netburn-Stummel
// (gemessen 0,03 H/s) und kosteten in BN2.1 8,92 Mrd.
//
// Reine Ruf-Stuecke sind bewusst NICHT dabei. faction_rep hebt zwar auch den
// Bladeburner-Faktionsruf aus Rang (Bladeburner/Formulas.ts:48), aber der ist
// dort billig; 10 % Ruf wiegen den Faktor 1,9 auf alle folgenden
// Kampfstuecke nicht auf. Hack-Geld-Stuecke ausserhalb von BN9 sind eine
// Setzung ohne Messung (BAUSTELLEN).

export const HACKNET_AUGS = new Set([
  "Hacknet Node CPU Architecture Neural-Upload",
  "Hacknet Node Cache Architecture Neural-Upload",
  "Hacknet Node NIC Architecture Neural-Upload",
  "Hacknet Node Kernel Direct-Neural Interface",
  "Hacknet Node Core Direct-Neural Interface",
]);

/**
 * Gibt es in diesem Knoten NACH einem Augmentierungs-Einbau noch Hacknet-Server
 * - also nur dann, wenn die Hacknet-Augmentierungen (die erst nach dem Einbau
 * wirken) auf etwas wirken, das der Bot selbst aufbaut?
 *
 * EIN PRAEDIKAT FUER BEIDE SEITEN (03.10.2026, Audit G02): bn4rep.js
 * (`mitHashes`: kaufen oder nicht) und hacknet.js (kauft nach dem Einbau neu
 * oder beendet sich) fragen dasselbe. Liefen die Bedingungen auseinander,
 * kaufte der Bot Stuecke fuer Server, die niemand mehr baut, oder liesse
 * Server ohne Stuecke stehen.
 *
 * Warum nur BN9:
 *   - Der Einbau leert die Hacknet-Server (`this.hacknetNodes.length = 0`,
 *     PersonObjects/Player/PlayerObjectGeneralMethods.ts:130-131).
 *   - Den SF9.3-Gratisserver (Level 100, 10 Kerne) legt allein der
 *     Knotenwechsel an, `prestigeSourceFile` (Prestige.ts:327-339); der
 *     Augmentierungs-Einbau (`prestigeAugmentation`, :55-200) legt keinen an.
 *   - Neu gekauft wird nach einem Einbau nur in BN9 (src/hacknet.js, die
 *     Zeilen mit diesem Praedikat).
 * Die Stuecke aus der Warteschlange wirken also im ersten Zyklus eines
 * Knotens nie (der Gratisserver, den sie verbessern sollen, verschwindet beim
 * Einbau, in dem sie erst anfangen zu wirken), und danach ausserhalb BN9 nur
 * auf die wenigen Stummel, die netburn.js fuer die Netburners-Einladung kauft
 * (gemessen 0,03 H/s).
 *
 * Wer HASH-2/HASH-3 baut (Flotte nach dem Einbau ausserhalb BN9), aendert NUR
 * diese Funktion - beide Aufrufer ziehen mit.
 *
 * @param {number} knoten ns.getResetInfo().currentNode
 * @returns {boolean}
 */
export function hacknetNachEinbau(knoten) {
  return knoten === 9;
}

/** @param {string} name  @param {boolean} mitHashes Hacknet-Server NACH dem Einbau (hacknetNachEinbau) */
export function kampfknotenNuetzlich(name, mitHashes) {
  if (name === "The Red Pill" || name === "The Blade's Simulacrum") return true;
  if (combatNutzen(name) > 0) return true;
  return mitHashes === true && HACKNET_AUGS.has(name);
}
