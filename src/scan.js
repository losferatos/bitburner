/**
 * Netzwerk-Aufnahme.
 *
 * Laeuft einmal durch, erfasst jeden erreichbaren Server mit allen Werten,
 * die fuer die Zielauswahl zaehlen, und legt das Ergebnis in einer Datei ab.
 * Die Bridge liest die Datei aus - so bekommen wir draussen ein vollstaendiges
 * Bild des Netzes, ohne den Spielstand auseinandernehmen zu muessen.
 *
 * Bewusst mit Einzelabfragen statt ns.getServer(): das kostet 0.85 GB statt
 * 2 GB, und am Anfang zaehlt jedes halbe Gigabyte auf home.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const routes = mapNetwork(ns);
  const out = [];

  for (const [host, path] of routes) {
    out.push({
      host,
      // Weg von home aus, damit wir spaeter gezielt hinspringen koennen.
      path,
      depth: path.length - 1,
      root: ns.hasRootAccess(host),
      ports: ns.getServerNumPortsRequired(host),
      hackLevel: ns.getServerRequiredHackingLevel(host),
      moneyMax: ns.getServerMaxMoney(host),
      moneyNow: ns.getServerMoneyAvailable(host),
      growth: ns.getServerGrowth(host),
      sec: ns.getServerSecurityLevel(host),
      secMin: ns.getServerMinSecurityLevel(host),
      ram: ns.getServerMaxRam(host),
      ramUsed: ns.getServerUsedRam(host),
    });
  }

  out.sort((a, b) => b.moneyMax - a.moneyMax);
  ns.write("data/network.txt", JSON.stringify({ at: Date.now(), servers: out }), "w");

  ns.tprint("Netzwerk erfasst: " + out.length + " Server, Bericht in data/network.txt");
}

/**
 * Breitensuche durch das Netz. Liefert je Server den Weg von home aus.
 * @param {NS} ns
 * @returns {Map<string, string[]>}
 */
function mapNetwork(ns) {
  const routes = new Map([["home", ["home"]]]);
  const queue = ["home"];
  while (queue.length) {
    const current = queue.shift();
    for (const next of ns.scan(current)) {
      if (!routes.has(next)) {
        routes.set(next, [...routes.get(current), next]);
        queue.push(next);
      }
    }
  }
  return routes;
}
