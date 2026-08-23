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
 * Der zurueckgegebene Wert ist die Ersparnis in LOGARITHMISCHER Erfahrung,
 * also direkt vergleichbar und additiv ueber mehrere Stuecke.
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

  // Der Multiplikator wirkt ueber ziel/(32*mult) im Exponenten. Ein Faktor f
  // auf `hacking` senkt ln(exp) um ziel/(32*mult) * (1 - 1/f), was fuer
  // kleine Zuwaechse gut durch ziel/(32*mult) * ln(f) genaehert ist - und die
  // Naeherung ist hier die ehrlichere Zahl, weil sie ueber mehrere Stuecke
  // additiv bleibt.
  const hebel = ziel / (32 * mult);

  let wert = 0;
  if (stats.hacking > 0) wert += hebel * Math.log(stats.hacking);
  // Erfahrungsrate und Tempo wirken beide linear auf die gesammelte
  // Erfahrung je Sekunde, also mit Gewicht eins.
  if (stats.hacking_exp > 0) wert += Math.log(stats.hacking_exp);
  if (stats.hacking_speed > 0) wert += Math.log(stats.hacking_speed);
  // Reputation ist kein Levelbeitrag, aber sie beschafft die naechsten
  // Stuecke. Halbes Gewicht wie in hackNutzen, aus demselben Grund.
  if (stats.faction_rep > 0) wert += 0.5 * Math.log(stats.faction_rep);
  if (stats.company_rep > 0) wert += 0.5 * Math.log(stats.company_rep);
  return wert;
}
