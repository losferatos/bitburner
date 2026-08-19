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
 *    reagieren, deshalb der Faktor 2 als Puffer.
 *  - Aufruesten kostet nur die Differenz zur neuen Groesse. Schrittweiser
 *    Ausbau ist damit gratis, Warten dagegen kostet Ertrag.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const PUFFER = 2;
  const LOG = "data/invest.txt";
  const history = [];

  // Eigener Quelltext beim Start - gleiche Regel wie beim Autopiloten:
  // trifft eine neue Fassung ein, macht dieser Prozess Platz. Der Autopilot
  // merkt in seiner naechsten Runde, dass der Verwalter fehlt, und startet
  // die neue Fassung. Die beiden halten sich also gegenseitig am Leben.
  const ownSource = ns.read("invest.js");

  const merken = (text) => {
    history.push({ at: Date.now(), text });
    if (history.length > 20) history.shift();
    ns.write(LOG, JSON.stringify(history), "w");
    ns.print(text);
  };

  while (true) {
    // Wachdienst: Der Autopilot beendet sich selbst, sobald eine neue Fassung
    // seines Quelltexts eintrifft. Ihn wieder hochzufahren ist Aufgabe dieses
    // Prozesses - er laeuft auf einem fremden Rechner und ist davon nicht
    // betroffen. So laesst sich der Autopilot im laufenden Betrieb ersetzen,
    // ohne dass jemand eine Terminaleingabe im richtigen Fenster landen muss.
    if (!ns.ps("home").some((p) => p.filename === "autopilot.js")) {
      if (ns.exec("autopilot.js", "home")) merken("Autopilot neu gestartet");
    }

    const money = ns.getServerMoneyAvailable("home");
    const owned = ns.cloud.getServerNames();
    const limit = ns.cloud.getServerLimit();
    const maxRam = ns.cloud.getRamLimit();

    if (owned.length < limit) {
      // Noch ein Platz frei: die groesste bezahlbare Groesse nehmen.
      let ram = 2;
      while (ram * 2 <= maxRam && ns.cloud.getServerCost(ram * 2) * PUFFER <= money) ram *= 2;
      const cost = ns.cloud.getServerCost(ram);
      if (cost * PUFFER <= money) {
        const name = ns.cloud.purchaseServer("bot-" + (owned.length + 1), ram);
        if (name) merken(name + " gekauft: " + ram + " GB fuer " + geld(cost));
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
        if (cost > 0 && cost * PUFFER <= money) {
          if (ns.cloud.upgradeServer(smallest.host, nextRam)) {
            merken(smallest.host + " auf " + nextRam + " GB vergroessert fuer " + geld(cost));
          }
        }
      }
    }

    hacknet(ns, merken);

    if (ns.read("invest.js") !== ownSource) {
      merken("Neue Fassung des Verwalters eingetroffen - mache Platz");
      ns.exit();
    }

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
 */
function hacknet(ns, merken) {
  const AMORTISATION_MAX = 3600; // Sekunden
  const PUFFER = 4; // Hacknet ist Beiwerk, es darf den Serverkauf nicht stoeren
  const money = ns.getServerMoneyAvailable("home");
  const anzahl = ns.hacknet.numNodes();

  // Neuer Node? Nur wenn er sich schnell genug rechnet.
  if (anzahl < ns.hacknet.maxNumNodes()) {
    const preis = ns.hacknet.getPurchaseNodeCost();
    if (preis / 1.5 <= AMORTISATION_MAX && preis * PUFFER <= money) {
      const i = ns.hacknet.purchaseNode();
      if (i >= 0) merken("Hacknet-Node " + (i + 1) + " gekauft fuer " + geld(preis));
      return;
    }
  }

  // Level-Upgrades sind das eigentlich Lohnende: jede Stufe bringt 1.5 $/s
  // mal den Kern- und RAM-Faktor, und die erste kostet nur $500.
  for (let i = 0; i < anzahl; i++) {
    const kosten = ns.hacknet.getLevelUpgradeCost(i, 1);
    const node = ns.hacknet.getNodeStats(i);
    const zugewinn = 1.5 * Math.pow(1.035, node.ram - 1) * ((node.cores + 5) / 6);
    if (kosten / zugewinn <= AMORTISATION_MAX && kosten * PUFFER <= money) {
      if (ns.hacknet.upgradeLevel(i, 1)) return; // eine Stufe je Durchlauf reicht
    }
  }
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
