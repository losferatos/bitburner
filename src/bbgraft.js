/** Grafting-Steckbrief: was das Spiel selbst zu Preis, Zeit und Auswahl sagt.
 *
 * WOZU EIN EIGENES SKRIPT
 *
 * Die Graft-Rechnung vom 30.08.2026 stammt aus dem Quellcode
 * (GraftableAugmentation.ts: cost = baseCost x 3, time = (1h x log2(Summe der
 * Multiplikatoren) + 30min) / 2 / Intelligenzbonus). Nachgerechnet ist sie -
 * geeicht war sie nicht. Dieses Skript holt die Werte, die das laufende Spiel
 * selbst ausgibt, damit die Rechnung an echten Zahlen scheitern kann statt an
 * einer Annahme.
 *
 * Es AENDERT NICHTS. Kein graftAugmentation, keine Reise, kein Geld. Nur lesen.
 *
 * Ergebnis nach data/bbgraft.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  const p = ns.getPlayer();
  const raus = {
    zeit: Date.now(),
    knoten: ns.getResetInfo().currentNode,
    stadt: p.city,
    geld: Math.round(p.money),
    intelligenz: p.skills.intelligence,
    entropie: p.entropy ?? null,
    zugang: null,
    fehler: null,
    augs: [],
  };

  let namen = [];
  try {
    namen = ns.grafting.getGraftableAugmentations();
    raus.zugang = true;
  } catch (e) {
    // Kein Zugang heisst: weder BitNode 10 noch Source-File 10. Dann ist die
    // ganze Rechnung gegenstandslos, und genau das soll hier stehen.
    raus.zugang = false;
    raus.fehler = String(e);
  }

  for (const name of namen) {
    let preis = null, dauer = null;
    try { preis = ns.grafting.getAugmentationGraftPrice(name); } catch { preis = null; }
    try { dauer = ns.grafting.getAugmentationGraftTime(name); } catch { dauer = null; }
    // Die Multiplikatoren aus dem LAUFENDEN Spiel holen, nicht aus der
    // Referenzfassung unter reference/. Am 30.08.2026 wichen zwei von 99
    // Graft-Zeiten um rund 2 % von der aus dem Quellcode berechneten ab -
    // ein Hinweis darauf, dass die Referenz (v3.0.2) nicht in jedem Wert dem
    // installierten Spiel entspricht. Wer mit Multiplikatoren rechnet, holt
    // sie besser dort, wo sie gelten.
    let stats = null;
    try { stats = ns.singularity.getAugmentationStats(name); } catch { stats = null; }
    raus.augs.push({ name, preis, dauerMs: dauer, stats });
  }

  ns.write("data/bbgraft.json", JSON.stringify(raus), "w");
  // Der Autopilot startet Auftraege auf einem FREMDEN Rechner, und ns.write
  // schreibt dorthin. Ohne diese Zeile liegt das Ergebnis auf bot-7 statt auf
  // home, und von aussen findet es niemand.
  if (ns.getHostname() !== "home") ns.scp("data/bbgraft.json", "home");
  ns.tprint("bbgraft: Zugang " + raus.zugang + ", " + raus.augs.length + " Augmentierungen");
}
