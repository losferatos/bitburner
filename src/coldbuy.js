/**
 * Mietrechner-Einkaeufer fuer den Kaltstart (Lauf 2, BN1.1, home 8 GB).
 *
 * Gehoert zu coldstart.js. Das ist der Einkaeufer aus dem alten Autopiloten
 * (Commit 7ebf2a4, invest.js), auf das Noetigste gekuerzt: kein Hacknet, kein
 * Wachdienst fuer den Autopiloten, kein eigener Einkommensschaetzer.
 *
 * WARUM EINE EIGENE DATEI: allein ns.cloud.purchaseServer kostet 2,25 GB.
 * coldstart.js darf auf home nicht ueber 5 GB, also laeuft der Einkaeufer auf
 * einem fremden, schon genukten Rechner. Netscript-Kaeufe wirken global, der
 * Ort des Aufrufs ist egal.
 *
 * Er kauft NICHTS, was coldstart.js fuer einen Handkauf zurueckhaelt: der
 * Betrag steht auf dem Port RESERVE_PORT (Netscript-Ports sind global und
 * kosten keinen RAM). Fehlt der Eintrag, gilt Reserve 0.
 *
 * Er beendet sich selbst, sobald home gross genug fuer den Kern ist - ab dann
 * kauft shop.js (Kern) die Rechner, und zwei Einkaeufer waeren einer zu viel.
 *
 * @param {NS} ns
 */
const RESERVE_PORT = 3032;
// Ab dieser home-Groesse gehoert das Kaufen dem Kern (shop.js).
const UEBERGABE_GB = 32;
// Kleinste Mietgroesse und Deckel je Kauf. Gestaffelt statt "so gross wie
// moeglich", damit frueh viele kleine Rechner entstehen (Arbeiter verteilen
// sich dort besser) und nicht ein grosser, der alles bindet.
const MIN_GB = 8;
const MAX_KAUF_GB = 256;

export async function main(ns) {
  ns.disableLog("ALL");

  while (true) {
    if (ns.getServerMaxRam("home") >= UEBERGABE_GB) return;

    // peek liefert bei leerem Port die Zeichenkette "NULL PORT DATA" -
    // Number() macht daraus NaN, und NaN > 0 ist falsch: Reserve 0.
    let reserve = Number(ns.peek(RESERVE_PORT));
    if (!(reserve > 0)) reserve = 0;
    const geld = Math.max(0, ns.getServerMoneyAvailable("home") - reserve);

    const eigene = ns.cloud.getServerNames();
    const limit = ns.cloud.getServerLimit();
    const maxGb = Math.min(ns.cloud.getRamLimit(), MAX_KAUF_GB);

    if (eigene.length < limit) {
      if (ns.cloud.getServerCost(MIN_GB) <= geld) {
        let gb = MIN_GB;
        while (gb * 2 <= maxGb && ns.cloud.getServerCost(gb * 2) <= geld) gb *= 2;
        // Freien Namen suchen: "werk-N" ist auch der Name, den shop.js
        // vergibt, der Kern uebernimmt den Park also nahtlos.
        let n = 0;
        while (eigene.includes("werk-" + n)) n++;
        const name = ns.cloud.purchaseServer("werk-" + n, gb);
        if (name) ns.print(name + " gekauft: " + gb + " GB");
      }
    } else {
      // Alle Plaetze belegt: den kleinsten Rechner verdoppeln. Aufruesten
      // kostet nur die Differenz.
      let klein = null;
      for (const h of eigene) {
        const gb = ns.getServerMaxRam(h);
        if (!klein || gb < klein.gb) klein = { h, gb };
      }
      if (klein && klein.gb < ns.cloud.getRamLimit()) {
        const neu = klein.gb * 2;
        const kosten = ns.cloud.getServerUpgradeCost(klein.h, neu);
        if (kosten > 0 && kosten <= geld) ns.cloud.upgradeServer(klein.h, neu);
      }
    }

    await ns.sleep(5000);
  }
}
