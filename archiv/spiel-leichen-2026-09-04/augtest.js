/** Einmaliger Test: Sleeve-Skills nach dem Aug-Kauf. */
export async function main(ns) {
  const s = ns.sleeve.getSleeve(0);
  ns.write("data/augtest.txt", "shock=" + s.shock + " skills=" + JSON.stringify(s.skills), "w");
  if (ns.getHostname() !== "home") ns.scp("data/augtest.txt", "home", ns.getHostname());
}
