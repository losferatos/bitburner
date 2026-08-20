/**
 * Der Einkaeufer.
 *
 * Setzt verdientes Geld in Speicher um. Laeuft bewusst NICHT auf home:
 * allein ns.cloud.purchaseServer kostet 2.25 GB, und auf home sind nur 8 GB,
 * die der Autopilot fast vollstaendig braucht. Netscript-Funktionen wirken
 * aber global - dieses Skript kauft genauso gut von einem fremden Rechner aus.
 *
 * ACHTUNG v3.0.0: Die gesamte Server-Kauf-API ist nach `ns.cloud` umgezogen.
 * `ns.purchaseServer` und Verwandte gibt es nicht mehr; sie werfen einen
 * REMOVED FUNCTION ERROR. Siehe doku/api-aenderungen-v3.md.
 *
 * Zwei Regeln, beide aus den Kostenformeln abgeleitet:
 *  - Nie das ganze Guthaben ausgeben. Ein leeres Konto kann auf nichts mehr
 *    reagieren - der Rueckhalt ist aber ADDITIV, nicht multiplikativ.
 *  - Aufruesten kostet nur die Differenz zur neuen Groesse. Schrittweiser
 *    Ausbau ist damit gratis, Warten dagegen kostet Ertrag.
 *
 * Warum additiv: Frueher stand hier `kosten * 2` (und im Hacknet `kosten * 4`).
 * Ein Faktor skaliert mit dem PREIS, nicht mit der Lage - und wirkt genau
 * verkehrt herum. Nach einem Reset sind 1262 Dollar da; der billigste
 * Hacknet-Knoten kostet 1000, mit Faktor 4 braeuchte er 4000. Der Verwalter
 * war damit in der ersten Stunde nach jedem Reset strukturell handlungsunfaehig,
 * obwohl der Knoten sich in elf Minuten bezahlt haette. Jetzt wird ein Betrag
 * zurueckgehalten, der an Ertrag und Guthaben haengt, nicht am Preis.
 *
 * @param {NS} ns
 */
/** Ueber diesen Netscript-Port meldet der Autopilot die Sperrkasse. */
const RESERVE_PORT = 1;

export async function main(ns) {
  ns.disableLog("ALL");

  // Rueckhalt: eine Minute Einkommen, mindestens aber ein Zehntel des
  // Guthabens. Der relative Anteil traegt die Fruehphase (ein Zehntel von 1262
  // sind 126 Dollar - der 1000-Dollar-Knoten bleibt bezahlbar), das Einkommen
  // traegt das Spaetspiel, wo ein Zehntel nichts mehr aussagt.
  const HOLD_SHARE = 0.1;
  const HOLD_SECONDS = 60;
  const LOG = "data/invest.txt";
  const history = [];

  // Einkommen selbst messen statt ns.getTotalScriptIncome zu bezahlen: das
  // Guthaben wird ohnehin jede Runde gelesen. Eigene Ausgaben werden
  // zurueckgerechnet, sonst liest sich jeder Kauf wie ein Einbruch.
  let lastCash = ns.getServerMoneyAvailable("home");
  let lastAt = Date.now();
  let spent = 0;
  let incomePerSec = 0;

  // Kein eigener Abgleich des Quelltexts: ns.read liest immer vom Rechner,
  // auf dem das Skript laeuft - und dort liegt die alte Kopie, die sich nie
  // aendert. Der Verwalter koennte eine neue Fassung also gar nicht erkennen.
  // Stattdessen beendet ihn der Autopilot in seiner ersten Runde und liefert
  // ihn frisch aus; der Autopilot wiederum startet sich bei jeder Aenderung
  // seines eigenen Quelltexts selbst neu. Damit ist beides abgedeckt.

  const merken = (text) => {
    history.push({ at: Date.now(), text });
    if (history.length > 20) history.shift();
    ns.write(LOG, JSON.stringify(history), "w");
    ns.print(text);
  };

  while (true) {
    // Sperrkasse: Was hier drinsteht, wird nicht angefasst. Der Verwalter
    // wuerde sonst jeden Dollar sofort in Speicher umsetzen - und genau dann
    // fehlt das Geld fuer die Dinge, die KEIN Skript kaufen kann: Portknacker
    // im Darkweb, Augmentations, Reisen.
    //
    // Der Betrag kommt ueber einen Netscript-Port, nicht aus einer Datei:
    // ns.read wuerde vom Rechner lesen, auf dem dieses Skript laeuft, und
    // dort liegt die Datei gar nicht. Ports dagegen sind global und kosten
    // keinen Speicher. Der Autopilot auf home legt den Wert dort ab.
    //
    // Der gemeldete Betrag enthaelt seit dem 20.08. auch den Rueckhalt fuer
    // das naechste fehlende Darkweb-Programm. Portknacker kann kein Skript
    // kaufen - wenn der Verwalter jeden Dollar sofort in Speicher umsetzt,
    // erreicht das Guthaben die noetige Schwelle nie, und das erreichbare
    // Netz waechst nach einem Reset nicht mehr.
    let reserve = 0;
    const rohWert = ns.peek(RESERVE_PORT);
    if (typeof rohWert === "number" && rohWert > 0) reserve = rohWert;

    // Wachdienst: Der Autopilot beendet sich selbst, sobald eine neue Fassung
    // seines Quelltexts eintrifft. Ihn wieder hochzufahren ist Aufgabe dieses
    // Prozesses - er laeuft auf einem fremden Rechner und ist davon nicht
    // betroffen. So laesst sich der Autopilot im laufenden Betrieb ersetzen,
    // ohne dass jemand eine Terminaleingabe im richtigen Fenster landen muss.
    if (!ns.ps("home").some((p) => p.filename === "autopilot.js")) {
      if (ns.exec("autopilot.js", "home")) merken("Autopilot neu gestartet");
    }

    const cash = ns.getServerMoneyAvailable("home");

    // Einkommen fortschreiben. Ohne Glaettung waere der Wert zwischen zwei
    // Ernten null und der Rueckhalt entsprechend sprunghaft.
    const jetzt = Date.now();
    const dt = (jetzt - lastAt) / 1000;
    if (dt >= 1) {
      const roh = Math.max(0, (cash - lastCash + spent) / dt);
      incomePerSec = incomePerSec > 0 ? incomePerSec * 0.9 + roh * 0.1 : roh;
      lastCash = cash;
      lastAt = jetzt;
      spent = 0;
    }

    const hold = Math.max(cash * HOLD_SHARE, incomePerSec * HOLD_SECONDS);
    const money = Math.max(0, cash - reserve - hold);
    const owned = ns.cloud.getServerNames();
    const limit = ns.cloud.getServerLimit();
    const maxRam = ns.cloud.getRamLimit();
    let gekauft = false;

    if (owned.length < limit) {
      // Noch ein Platz frei: die groesste bezahlbare Groesse nehmen.
      let ram = 2;
      while (ram * 2 <= maxRam && ns.cloud.getServerCost(ram * 2) <= money) ram *= 2;
      const cost = ns.cloud.getServerCost(ram);
      if (cost <= money) {
        const name = ns.cloud.purchaseServer("bot-" + (owned.length + 1), ram);
        if (name) {
          spent += cost;
          gekauft = true;
          merken(name + " gekauft: " + ram + " GB fuer " + geld(cost));
        }
      }
    } else {
      // Alle Plaetze belegt: den kleinsten Rechner verdoppeln.
      let smallest = null;
      for (const host of owned) {
        const ram = ns.getServerMaxRam(host);
        if (!smallest || ram < smallest.ram) smallest = { host, ram };
      }
      if (smallest && smallest.ram < maxRam) {
        const nextRam = smallest.ram * 2;
        const cost = ns.cloud.getServerUpgradeCost(smallest.host, nextRam);
        if (cost > 0 && cost <= money) {
          if (ns.cloud.upgradeServer(smallest.host, nextRam)) {
            spent += cost;
            gekauft = true;
            merken(smallest.host + " auf " + nextRam + " GB vergroessert fuer " + geld(cost));
          }
        }
      }
    }

    // Hacknet ist Beiwerk und bleibt es. Frueher hat ein zweiter, groesserer
    // Faktor (4 statt 2) diesen Vorrang ausgedrueckt - das hat in der
    // Fruehphase genau das Gegenteil bewirkt. Jetzt ergibt sich der Vorrang
    // aus der Reihenfolge: Speicher zuerst, Hacknet nur, wenn diese Runde
    // nichts Wichtigeres gekauft wurde.
    if (!gekauft) spent += hacknet(ns, merken, money);

    await ns.sleep(5000);
  }
}

/**
 * Hacknet - der Anschubfinanzierer, mehr nicht.
 *
 * Die Zahlen aus dem Spielcode sind eindeutig: Ein frisch gekaufter Node
 * liefert immer 1.50 $/s, egal was er gekostet hat. Node 1 hat sich nach
 * 11 Minuten bezahlt, Node 8 kostet schon $74.166 fuer dieselben 1.50 $/s -
 * und dasselbe Geld in Server-RAM sind rund 13 hack-Threads.
 *
 * Deshalb drei harte Regeln:
 *  - Nodes nur, solange sie sich binnen einer Stunde bezahlt machen.
 *  - Level-Upgrades dagegen mitnehmen: 333 Sekunden Amortisation.
 *  - RAM (159 h) und Cores (556 h) NIE. Das ist Geldvernichtung.
 *
 * @param {NS} ns
 * @param {(text: string) => void} merken
 * @param {number} money frei verfuegbares Geld, Rueckhalt bereits abgezogen
 * @returns {number} tatsaechlich ausgegeben
 */
function hacknet(ns, merken, money) {
  const AMORTISATION_MAX = 3600; // Sekunden
  const anzahl = ns.hacknet.numNodes();

  // Neuer Node? Nur wenn er sich schnell genug rechnet.
  if (anzahl < ns.hacknet.maxNumNodes()) {
    const preis = ns.hacknet.getPurchaseNodeCost();
    if (preis / 1.5 <= AMORTISATION_MAX && preis <= money) {
      const i = ns.hacknet.purchaseNode();
      if (i >= 0) {
        merken("Hacknet-Node " + (i + 1) + " gekauft fuer " + geld(preis));
        return preis;
      }
    }
  }

  // Level-Upgrades sind das eigentlich Lohnende: jede Stufe bringt 1.5 $/s
  // mal den Kern- und RAM-Faktor, und die erste kostet nur $500.
  for (let i = 0; i < anzahl; i++) {
    const kosten = ns.hacknet.getLevelUpgradeCost(i, 1);
    const node = ns.hacknet.getNodeStats(i);
    const zugewinn = 1.5 * Math.pow(1.035, node.ram - 1) * ((node.cores + 5) / 6);
    if (kosten / zugewinn <= AMORTISATION_MAX && kosten <= money) {
      if (ns.hacknet.upgradeLevel(i, 1)) return kosten; // eine Stufe je Durchlauf reicht
    }
  }
  return 0;
}

function geld(n) {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) {
    n /= 1000;
    i++;
  }
  return "$" + (n < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
}
