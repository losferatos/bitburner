/**
 * Gegenprobe fuer den Auftragskanal: schreibt eine Zeile, sonst nichts.
 *
 * Kommt die Zeile auf home an, laeuft der Kanal - dann liegt es an dem
 * Skript, das nicht startet. Kommt sie nicht an, liegt es am Kanal.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const text = "kanaltest ok auf " + ns.getHostname() + "\n";
  ns.write("data/kanaltest.txt", text, "w");
  if (ns.getHostname() !== "home") {
    ns.scp("data/kanaltest.txt", "home", ns.getHostname());
  }
}
