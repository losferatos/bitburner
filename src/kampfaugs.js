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
export async function main(ns) {
  ns.disableLog("ALL");
  const nurPruefen = ns.args.includes("--pruefen");

  // Alle Augmentierungen mit einem Multiplikator auf strength, defense,
  // dexterity oder agility - erzeugt aus
  // `reference/bitburner-src/src/Augmentation/Augmentations.ts`, nicht
  // abgetippt. Stanek's Gift und BigDsBigBrain sind bewusst draussen: Das
  // eine SENKT die Kampfwerte, das andere ist unkaeuflich.
  const KAMPF = new Set([
    "Bionic Arms", "Bionic Legs", "Bionic Spine", "BLADE-51b Tesla Armor",
    "BLADE-51b Tesla Armor: Energy Shielding Upgrade", "Blade's Runners",
    "BrachiBlades", "Combat Rib I", "Combat Rib II", "Combat Rib III",
    "CordiARC Fusion Reactor", "DermaForce Particle Barrier",
    "EsperTech Bladeburner Eyewear", "GOLEM Serum",
    "Graphene Bionic Arms Upgrade", "Graphene Bionic Legs Upgrade",
    "Graphene Bionic Spine Upgrade", "Graphene Bone Lacings",
    "Graphene BrachiBlades Upgrade", "HemoRecirculator", "Hydroflame Left Arm",
    "HyperSight Corneal Implant", "INFRARET Enhancement",
    "LuminCloaking-V1 Skin Implant", "LuminCloaking-V2 Skin Implant",
    "Nanofiber Weave", "Neotra", "nextSENS Gene Modification",
    "ORION-MKIV Shoulder", "Photosynthetic Cells", "Power Recirculation Core",
    "SPTN-97 Gene Modification", "SmartSonar Implant", "NEMEAN Subdermal Weave",
    "Synfibril Muscle", "Synthetic Heart", "Augmented Targeting I",
    "Augmented Targeting II", "Augmented Targeting III", "The Black Hand",
    "The W1ngs of Icarus", "The B00ts of Perseus", "The H4mmer of Daedalus",
    "The St4ff of Asclepius", "Wired Reflexes", "Xanipher",
  ]);

  const log = [];
  const sag = (t) => {
    log.push(t);
    ns.write("data/kampfaugs.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") {
      ns.scp("data/kampfaugs.txt", "home", ns.getHostname());
    }
  };

  const sp = ns.getPlayer();
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
      if (sp.augmentations && sp.augmentations.some((x) => x.name === a)) continue;
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
      if (ns.singularity.workForFaction(fehltRep.fak, "hacking", true)) {
        sag("Arbeite fuer " + fehltRep.fak + " - es fehlen "
          + Math.round(fehltRep.repReq - fehltRep.rep) + " Reputation.");
      }
    } catch (e) { sag("workForFaction: " + String(e).slice(0, 120)); }
  }
  sag("Fertig. " + gekauft + " gekauft, " + liste.length + " in Reichweite.");
}
