/**
 * Auszaehlung: wieviele VERSCHIEDENE Augmentierungen gibt eine Faktionsmenge her?
 *
 * WARUM AM LAUFENDEN SPIEL UND NICHT AN Augmentations.ts
 *
 * Der Abschlussplan zaehlt "Stufe B = exakt 30" aus dem Quelltext mit
 * Klammer-Matching aus. Das ist die Sorte Zahl, die stimmt, bis sie es nicht
 * tut: Ein `factions: []`, ein `isSpecial`, ein Voraussetzungs-Aug, das nur
 * ueber ein anderes zu haben ist - jeder dieser Faelle verschiebt die Summe um
 * eins, und bei einer Zielmarke von genau 30 ist eins zuviel.
 *
 * ns.singularity.getAugmentationsFromFaction ruft dieselbe Funktion auf, die
 * auch der Kauf benutzt (Singularity.ts:128-133 -> getFactionAugmentationsFiltered).
 * Was hier gezaehlt wird, ist also genau das, was spaeter kaufbar ist.
 *
 * Aufruf:  node tools/task.js augcount.js
 * Ergebnis: data/augcount.json und data/augcount.txt
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // NeuroFlux zaehlt fuer die 30er-Schwelle als GENAU EIN Eintrag, egal auf
  // welcher Stufe (FactionJoinCondition.ts:116-131 zaehlt p.augmentations,
  // und NeuroFlux steht dort einmal mit einem level-Feld). Er wird deshalb
  // wie jede andere Augmentierung mitgezaehlt - aber nur einmal.
  const NFG = "NeuroFlux Governor";

  // Die Staffel aus dem Abschlussplan, Abschnitt 2.1. Jede Stufe ist die
  // vorige plus die neu hinzukommenden Faktionen - so laesst sich ablesen,
  // welche Faktion wieviel beitraegt.
  const STAGES = [
    ["A  jetzige", ["CyberSec", "NiteSec", "The Black Hand", "Sector-12", "Aevum"]],
    ["B  + BitRunners", ["BitRunners"]],
    ["C  + TianDiHui/Netburners", ["Tian Di Hui", "Netburners"]],
    ["D  + Gangfaktionen", ["Slum Snakes", "Tetrads", "The Syndicate"]],
    ["E  + Clarke/OmniTek", ["Clarke Incorporated", "OmniTek Incorporated"]],
    ["E+ + Daedalus", ["Daedalus"]],
    ["F  + NWO", ["NWO"]],
  ];

  const zeilen = [];
  const bericht = { zeit: Date.now(), stufen: [], jeFaktion: {}, installiert: 0 };

  const installiert = ns.singularity.getOwnedAugmentations(false);
  const wartend = ns.singularity.getOwnedAugmentations(true);
  bericht.installiert = installiert.length;
  bericht.wartend = wartend.length - installiert.length;
  zeilen.push("installiert " + installiert.length + ", wartend "
    + (wartend.length - installiert.length));

  // Erst je Faktion einzeln, damit sichtbar wird, wer was NEU beitraegt.
  const alleFaktionen = STAGES.flatMap(([, f]) => f);
  for (const f of alleFaktionen) {
    try {
      const augs = ns.singularity.getAugmentationsFromFaction(f)
        .filter((a) => a !== NFG);
      bericht.jeFaktion[f] = augs;
    } catch (e) {
      bericht.jeFaktion[f] = null;
      zeilen.push("FEHLER bei " + f + ": " + String(e));
    }
  }

  // Dann kumulativ. Das Set zaehlt VERSCHIEDENE Stuecke - genau die Groesse,
  // die Daedalus prueft.
  const gesehen = new Set();
  for (const [name, faktionen] of STAGES) {
    let neu = 0;
    for (const f of faktionen) {
      for (const a of (bericht.jeFaktion[f] || [])) {
        if (!gesehen.has(a)) { gesehen.add(a); neu++; }
      }
    }
    // +1 fuer NeuroFlux: jede dieser Faktionen bietet ihn an, und er zaehlt
    // als eigener Eintrag in p.augmentations.
    const mitNFG = gesehen.size + 1;
    zeilen.push(name.padEnd(26) + " verschieden " + String(gesehen.size).padStart(3)
      + " (+" + neu + ")   mit NeuroFlux " + mitNFG
      + (mitNFG >= 30 ? "   >= 30 ERREICHT" : "   fehlen " + (30 - mitNFG)));
    bericht.stufen.push({ name, ohneNFG: gesehen.size, mitNFG, neu });
  }

  // Die Liste der Stufe-B-Menge ausschreiben. Bei einer Zielmarke von genau 30
  // will man die Namen sehen koennen, nicht nur die Zahl.
  const bisB = new Set();
  for (const [name, faktionen] of STAGES.slice(0, 2)) {
    for (const f of faktionen) for (const a of (bericht.jeFaktion[f] || [])) bisB.add(a);
  }
  bericht.stufeBListe = [...bisB].sort();
  zeilen.push("");
  zeilen.push("Stufe B im Einzelnen (" + bisB.size + " ohne NeuroFlux):");
  for (const a of bericht.stufeBListe) zeilen.push("  " + a);

  const NL = String.fromCharCode(10);
  ns.write("data/augcount.json", JSON.stringify(bericht), "w");
  ns.write("data/augcount.txt", zeilen.join(NL) + NL, "w");
  if (ns.getHostname() !== "home") {
    ns.scp(["data/augcount.json", "data/augcount.txt"], "home", ns.getHostname());
  }
  for (const z of zeilen) ns.tprint(z);
}
