/** Einmaliger Kickstart (02.09.2026): kauft den ersten 32-GB-Mietrechner in BN10 ohne den 1,25-Puffer. @param {NS} ns */
export async function main(ns) {
  const log = [];
  const sag = (t) => { log.push(new Date().toLocaleTimeString() + "  " + t); ns.write("data/kick.txt", log.join("\n") + "\n", "w"); };
  const eigene = ns.cloud.getServerNames();
  if (eigene.length) { sag("Schon " + eigene.length + " eigene Rechner: " + eigene.join(", ") + " - nichts zu tun."); return; }
  const gb = 32, preis = ns.cloud.getServerCost(gb), geld = ns.getServerMoneyAvailable("home");
  sag("32 GB kosten " + (preis / 1e6).toFixed(2) + "m, Konto " + (geld / 1e6).toFixed(2) + "m.");
  if (geld < preis) { sag("Zu wenig Geld - abgebrochen."); return; }
  const name = ns.cloud.purchaseServer("werk-0", gb);
  sag(name ? "Gekauft: " + name + " mit " + gb + " GB." : "purchaseServer hat abgelehnt.");
}
