/**
 * Kauft die Kampf-Augmentierungen, die den Bladeburner-Beitritt vorziehen.
 *
 * WARUM (28.08.2026, 20:15)
 *
 * `nodes/KURS.md`, Eintrag 19:20: In BitNode 10 fuehrt der Ausgang ueber 21
 * Black Operations, und das erste Tor ist der Beitritt mit allen vier
 * Kampfwerten >= 100. `calculateSkill` ist
 * `floor(mult * (32*ln(exp+534,6) - 200))`
 * (`PersonObjects/formulas/skill.ts:13`) - der Multiplikator steht VOR der
 * Klammer, die Erfahrung IM Logarithmus:
 *
 *     mults.kampf 1,26 (heute)  ->  1.019.268 Erfahrung  =  21,8 h
 *     mults.kampf 2,00          ->    100.868            =   2,2 h
 *
 * Trainieren ist also der teure Weg. Augmentierungen sind der billige.
 *
 * WARUM NICHT bn4rep.js
 *
 * Das kann all das - und braucht dafuer **848,25 GB** (gemessen 19:38 mit
 * `src/ramcheck.js`). Der groesste Rechner im Netz hat 256. Diese Datei
 * beschraenkt sich deshalb auf sechs Singularity-Aufrufe; ausserhalb von
 * BitNode 4 kostet jeder das Sechzehnfache (`SF4Cost`,
 * `RamCostGenerator.ts:82-94`, bei SF4-Stufe 1):
 *
 *     getAugmentationsFromFaction   80,0 GB      purchaseAugmentation  80,0
 *     workForFaction                48,0         getAugmentationPrice  40,0
 *     getAugmentationRepReq         40,0         getFactionRep         16,0
 *
 * Zusammen rund **306 GB** - das passt auf ein home mit 512, und der Ausbau
 * von 256 auf 512 kostet in BitNode 10 477 Mio (`getUpgradeHomeRamCost`,
 * `BaseCostFor1GBOfRamHome` 32.000 x 1,58^log2(ram) x `HomeComputerRamCost`
 * 1,5).
 *
 * Aufruf:  node tools/task.js kampfaugs.js            kaufen, was geht
 *          node tools/task.js kampfaugs.js --pruefen  nur auflisten
 *
 * @param {NS} ns
 */

// --- Die Figur-Wache (Position C.11) ---------------------------------------
//
// Es gibt genau EINE Spielfigur, und sechs Gewerke wollen sie. Der Kern ist
// der Schiedsrichter (bn4net.js, Abschnitt 9a); hier wird nur beantragt und
// nachgesehen.
import { beantrage as figBeantrage, darf as figDarf } from "lib/figurns.js";
import { PRIO as FIG_PRIO } from "lib/figur.js";

export async function main(ns) {
  ns.disableLog("ALL");
  const nurPruefen = ns.args.includes("--pruefen");

  // Alle Augmentierungen mit einem Multiplikator auf strength, defense,
  // dexterity oder agility - erzeugt aus
  // `reference/bitburner-src/src/Augmentation/Augmentations.ts`, nicht
  // abgetippt. Stanek's Gift und BigDsBigBrain sind bewusst draussen: Das
  // eine SENKT die Kampfwerte, das andere ist unkaeuflich.
  // Name -> [strength, defense, dexterity, agility]. Erzeugt aus
  // `reference/bitburner-src/src/Augmentation/Augmentations.ts`, nicht
  // abgetippt. Stanek's Gift und BigDsBigBrain sind draussen: das eine SENKT
  // die Kampfwerte, das andere ist unkaeuflich.
  const KAMPF_MULT = {
    "Bionic Arms": [1.3, 1, 1.3, 1],
    "Bionic Legs": [1, 1, 1, 1.6],
    "Bionic Spine": [1.15, 1.15, 1.15, 1.15],
    "BLADE-51b Tesla Armor": [1.04, 1.04, 1.04, 1.04],
    "BLADE-51b Tesla Armor: Energy Shielding Upgrade": [1, 1.05, 1, 1],
    "Blade's Runners": [1, 1, 1, 1.05],
    "BrachiBlades": [1.15, 1.15, 1, 1],
    "Combat Rib I": [1.1, 1.1, 1, 1],
    "Combat Rib II": [1.14, 1.14, 1, 1],
    "Combat Rib III": [1.18, 1.18, 1, 1],
    "CordiARC Fusion Reactor": [1.35, 1.35, 1.35, 1.35],
    "DermaForce Particle Barrier": [1, 1.4, 1, 1],
    "EsperTech Bladeburner Eyewear": [1, 1, 1.05, 1],
    "GOLEM Serum": [1.07, 1.07, 1.07, 1.07],
    "Graphene Bionic Arms Upgrade": [1.85, 1, 1.85, 1],
    "Graphene Bionic Legs Upgrade": [1, 1, 1, 2.5],
    "Graphene Bionic Spine Upgrade": [1.6, 1.6, 1.6, 1.6],
    "Graphene Bone Lacings": [1.7, 1.7, 1, 1],
    "Graphene BrachiBlades Upgrade": [1.4, 1.4, 1, 1],
    "HemoRecirculator": [1.08, 1.08, 1.08, 1.08],
    "Hydroflame Left Arm": [2.8, 1, 1, 1],
    "HyperSight Corneal Implant": [1, 1, 1.4, 1],
    "INFRARET Enhancement": [1, 1, 1.1, 1],
    "LuminCloaking-V1 Skin Implant": [1, 1, 1, 1.05],
    "LuminCloaking-V2 Skin Implant": [1, 1.1, 1, 1.1],
    "Nanofiber Weave": [1.2, 1.2, 1, 1],
    "Neotra": [1.55, 1.55, 1, 1],
    "nextSENS Gene Modification": [1.2, 1.2, 1.2, 1.2],
    "ORION-MKIV Shoulder": [1.05, 1.05, 1.05, 1],
    "Photosynthetic Cells": [1.4, 1.4, 1, 1.4],
    "Power Recirculation Core": [1.05, 1.05, 1.05, 1.05],
    "SPTN-97 Gene Modification": [1.75, 1.75, 1.75, 1.75],
    "SmartSonar Implant": [1, 1, 1.1, 1],
    "NEMEAN Subdermal Weave": [1, 2.2, 1, 1],
    "Synfibril Muscle": [1.3, 1.3, 1, 1],
    "Synthetic Heart": [1.5, 1, 1, 1.5],
    "Augmented Targeting I": [1, 1, 1.1, 1],
    "Augmented Targeting II": [1, 1, 1.2, 1],
    "Augmented Targeting III": [1, 1, 1.3, 1],
    "The Black Hand": [1.15, 1, 1.15, 1],
    "The W1ngs of Icarus": [1, 1, 1, 1.1],
    "The B00ts of Perseus": [1, 1, 1.06, 1],
    "The H4mmer of Daedalus": [1.1, 1, 1, 1],
    "The St4ff of Asclepius": [1, 1.1, 1, 1],
    "Wired Reflexes": [1, 1, 1.05, 1.05],
    "Xanipher": [1.2, 1.2, 1.2, 1.2],
  };
  const KAMPF = new Set(Object.keys(KAMPF_MULT));

  const log = [];
  const sag = (t) => {
    log.push(t);
    ns.write("data/kampfaugs.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") {
      ns.scp("data/kampfaugs.txt", "home", ns.getHostname());
    }
  };

  const sp = ns.getPlayer();
  // ns.getPlayer() FUEHRT KEINE AUGMENTIERUNGEN (28.08.2026, 21:18).
  //
  // Die Rueckgabe ist eine feste Auswahl von sechzehn Feldern
  // (`NetscriptFunctions.ts:1371-1390`) - `augmentations` und
  // `queuedAugmentations` sind NICHT dabei. Beide Zugriffe darauf liefen
  // still ins Leere: Die Doppelkauf-Sperre unten griff nie, und die
  // Einbaurechnung meldete um 21:14 "0 wartend", obwohl Wired Reflexes seit
  // 20:40 in der Warteschlange stand - erkennbar daran, dass der Preis von
  // 12,5 auf 23,8 Mio gestiegen war (der Aufschlag je gekaufter
  // Augmentierung).
  //
  // `getOwnedAugmentations(true)` liefert beides, `false` nur die
  // eingebauten. Zwei Aufrufe derselben Funktion kosten nur einmal Speicher
  // (SingularityFn3 x16 = 80 GB).
  let eingebaut = [], besessen = [];
  try {
    eingebaut = ns.singularity.getOwnedAugmentations(false);
    besessen = ns.singularity.getOwnedAugmentations(true);
  } catch { /* ohne SF4 nicht verfuegbar - dann ohne Sperre weiter */ }
  const schonDa = new Set(besessen);
  const faktionen = sp.factions || [];
  if (!faktionen.length) { sag("Keine Faktion - nichts zu kaufen."); return; }

  // Alles einsammeln, was erreichbar ist. Doppelte Namen kommen vor, wenn
  // mehrere Faktionen dasselbe Stueck fuehren - dann zaehlt die mit der
  // meisten Reputation.
  const liste = [];
  for (const f of faktionen) {
    let rep = 0;
    try { rep = ns.singularity.getFactionRep(f); } catch { continue; }
    let augs = [];
    try { augs = ns.singularity.getAugmentationsFromFaction(f); } catch { continue; }
    for (const a of augs) {
      if (!KAMPF.has(a)) continue;
      if (schonDa.has(a)) continue;   // gekauft ODER eingebaut
      let preis = Infinity, repReq = Infinity;
      try {
        preis = ns.singularity.getAugmentationPrice(a);
        repReq = ns.singularity.getAugmentationRepReq(a);
      } catch { continue; }
      liste.push({ aug: a, fak: f, rep, repReq, preis });
    }
  }
  if (!liste.length) { sag("Keine Kampf-Augmentierung in Reichweite."); return; }

  // Billigste zuerst - jede gekaufte senkt den Erfahrungsbedarf, und die
  // Reihenfolge entscheidet, wie schnell die erste greift.
  liste.sort((a, b) => a.repReq - b.repReq || a.preis - b.preis);

  const geld = () => ns.getServerMoneyAvailable("home");
  let gekauft = 0, fehltRep = null;
  for (const e of liste) {
    const marke = e.aug + " (" + e.fak + ", Rep " + Math.round(e.repReq)
      + ", $" + (e.preis / 1e6).toFixed(1) + "m)";
    if (e.rep < e.repReq) {
      if (!fehltRep) fehltRep = e;
      sag("Reputation fehlt: " + marke + " - habe " + Math.round(e.rep));
      continue;
    }
    if (geld() < e.preis) { sag("Geld fehlt: " + marke); continue; }
    if (nurPruefen) { sag("PRUEFLAUF, kaufbar: " + marke); continue; }
    if (ns.singularity.purchaseAugmentation(e.fak, e.aug)) {
      sag("GEKAUFT: " + marke);
      gekauft++;
    } else {
      sag("Kauf abgelehnt: " + marke);
    }
  }

  // Fehlt nur noch Reputation, wird dafuer gearbeitet - sonst steht der
  // Bot vor einer Liste, die er nie abarbeiten kann.
  if (!gekauft && fehltRep && !nurPruefen) {
    try {
      // DIE FIGUR-WACHE. Dieses Werkzeug laeuft auf Zuruf und einmal - es
      // beantragt die Figur, sieht einmal nach und laesst es sonst. Warten
      // waere hier falsch: niemand wartet auf sein Ergebnis, und die Arbeit
      // holt das naechste Mal jemand nach.
      figBeantrage(ns, "kampfaugs.js", FIG_PRIO.faktion, "faktion",
        fehltRep.fak, "Reputation fuer eine Kampfaugmentierung");
      const figW = figDarf(ns, "kampfaugs.js");
      if (!figW.darf) {
        sag("Figur nicht frei (" + figW.grund + ") - keine Faktionsarbeit begonnen.");
      } else if (ns.singularity.workForFaction(fehltRep.fak, "hacking", true)) {
        sag("Arbeite fuer " + fehltRep.fak + " - es fehlen "
          + Math.round(fehltRep.repReq - fehltRep.rep) + " Reputation.");
      }
    } catch (e) { sag("workForFaction: " + String(e).slice(0, 120)); }
  }
  sag("Fertig. " + gekauft + " gekauft, " + liste.length + " in Reichweite.");

  // --- Lohnt der Einbau? ---------------------------------------------------
  //
  // Ein Multiplikator wirkt erst NACH dem Einbau (`applyAugmentation`), und
  // der Einbau kostet drei Dinge:
  //   1. die gesamte Kampferfahrung (Spieler-Prestige),
  //   2. die Reputation aller Faktionen - sie wird zu Favor
  //      (`Faction.ts:77-83`, `prestigeAugmentation`),
  //   3. die Mitgliedschaft (`isMember = false`), es muss neu beigetreten
  //      werden.
  //
  // Punkt 1 ist der teure. Der Bedarf je Kampfwert fuer Stufe 100 folgt aus
  // `calculateSkill` (`PersonObjects/formulas/skill.ts:13`), umgestellt:
  //
  //     exp(m) = e^((100/(m * knotenfaktor) + 200)/32) - 534,6
  //
  // Der Einbau lohnt genau dann, wenn der Bedarf DANACH kleiner ist als der
  // Rest davor - und zwar auf dem Wert, der am weitesten zurueckliegt, denn
  // der ist das Tor. Alles andere waere ein Bauchgefuehl.
  try {
    const sp2 = ns.getPlayer();
    // SKEPTIKER-AUDIT 26.09.2026, FUND 7 (audit-2026-09-26/4-bladeburner.md#7):
    // hier stand `KNOTENFAKTOR` hart auf 0,4 fuer Knoten 10, sonst 1 - eine
    // Knotennummer im Code, Verstoss gegen ENTSCHIEDEN "nie eine
    // Knotennummer im Code". BitNode.tsx kennt den Kampf-LevelMultiplier
    // auch fuer BN9 (0,45), BN13 (0,7), BN14 (0,5) und BN15 (0,7) - je
    // Kampfwert einzeln, nicht als ein Wert fuer alle vier. `expNoetig(1)`
    // fuer Kampfwert 100 stand in BN14 elffach zu optimistisch (11.255 statt
    // richtig 267.800), und "EINBAU LOHNT" waere dort falsch gefeuert.
    // Fix wie blade.js:773/1012 - SF5 ist vorhanden, deshalb direkt live
    // gelesen statt aus src/lib/bitnodes.json (das Werkzeug laeuft nur von
    // Hand, RAM ist hier kein Engpass).
    let bnMult = {};
    try { bnMult = ns.getBitNodeMultipliers(); } catch { bnMult = {}; }
    const knotenFaktor = (stat) => Number(bnMult[stat[0].toUpperCase() + stat.slice(1) + "LevelMultiplier"]) || 1;
    const expNoetig = (m, stat) => Math.exp((100 / (m * knotenFaktor(stat)) + 200) / 32) - 534.6;

    const werte = ["strength", "defense", "dexterity", "agility"];
    const jetztMult = werte.map((w) => sp2.mults[w]);
    // Was die wartenden Stuecke zusaetzlich braechten.
    const eing = new Set(eingebaut);
    const wartend = besessen.filter((a) => !eing.has(a));
    const nachher = jetztMult.slice();
    for (const nm of wartend) {
      const f = KAMPF_MULT[nm];
      if (!f) continue;
      for (let i = 0; i < 4; i++) nachher[i] *= f[i];
    }

    const expJetzt = [sp2.exp.strength, sp2.exp.defense,
      sp2.exp.dexterity, sp2.exp.agility];
    let restOhne = 0, restMit = 0;
    for (let i = 0; i < 4; i++) {
      restOhne = Math.max(restOhne, expNoetig(jetztMult[i], werte[i]) - expJetzt[i]);
      restMit = Math.max(restMit, expNoetig(nachher[i], werte[i]));
    }
    sag("Einbaurechnung: ohne Einbau noch " + Math.round(restOhne)
      + " Erfahrung, mit Einbau " + Math.round(restMit)
      + " (" + wartend.length + " wartend).");
    if (wartend.length && restMit < restOhne) {
      sag("EINBAU LOHNT - " + Math.round(restOhne - restMit)
        + " Erfahrung gespart. Ausgefuehrt wird er hier NICHT: Der Einbau"
        + " beendet jedes laufende Skript, das gehoert in den Wiederanlauf.");
    }
  } catch (e) { sag("Einbaurechnung: " + String(e).slice(0, 140)); }
}
