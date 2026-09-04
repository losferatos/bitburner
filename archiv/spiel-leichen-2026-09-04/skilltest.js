/** Einmaliger Diagnoselauf: alle Skills des Spielers. */
export async function main(ns) {
  const s = ns.getPlayer().skills;
  ns.write("data/skilltest.txt", JSON.stringify(s), "w");
  if (ns.getHostname() !== "home") ns.scp("data/skilltest.txt", "home", ns.getHostname());
}
