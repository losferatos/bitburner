/**
 * Schreibt die Knotennummer nach data/knoten.json - und sonst nichts.
 *
 * WARUM ES DIESE DATEI GIBT (28.08.2026, 17:20)
 *
 * `data/knoten.json` kam bisher nur von `bn4rep.js`. Das ist voller
 * Singularity-Aufrufe und ausserhalb von BitNode 4 mehrere hundert Gigabyte
 * gross (`RamCostGenerator.ts:82-96` gibt den SF4-Rabatt nur dort) - auf
 * einem frischen home mit 32 GB laeuft es nicht. Nach dem Knotenwechsel um
 * 17:05 stand die Datei deshalb elf Minuten lang auf dem ALTEN Knoten, und
 * `tools/strategie-check.js` meldete BLIND und "BitNode 6", obwohl der
 * Knoten schon gewechselt war. Die Wache konnte den Wechsel aus demselben
 * Grund nicht melden.
 *
 * `getResetInfo` kostet 1 GB (`RamCostGenerator.ts:664`) und ist ab der
 * ersten Sekunde eines Knotens verfuegbar. Dieses Skript ist deshalb absichtlich
 * winzig: Es soll auf jedes frische home passen.
 *
 * Der dauerhafte Weg ist die Knotennummer in `data/bn4net.json` (seit
 * 28.08. 17:18 dort drin) - bn4net.js startet nach jedem Wechsel als erstes.
 * Diese Datei bleibt als Lueckenfueller fuer den laufenden Knoten und als
 * Notnagel, wenn bn4net einmal nicht laeuft.
 *
 * Aufruf:  node tools/task.js knoten.js          einmal schreiben
 *          node tools/task.js knoten.js --loop   alle 30 s auffrischen
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const dauer = ns.args.includes("--loop");
  do {
    const r = ns.getResetInfo();
    ns.write("data/knoten.json", JSON.stringify({
      zeit: Date.now(),
      knoten: r.currentNode,
      nodeReset: r.lastNodeReset,
      augReset: r.lastAugReset,
      quelle: "knoten.js",
    }), "w");
    // Der Auftragslaeufer sucht den Wirt mit dem meisten freien Speicher -
    // das ist selten home. Ohne diese Zeile schreibt das Skript brav seine
    // Datei und niemand findet sie (genau so um 17:22 passiert).
    if (ns.getHostname() !== "home") ns.scp("data/knoten.json", "home", ns.getHostname());
    if (dauer) await ns.sleep(30000);
  } while (dauer);
}
