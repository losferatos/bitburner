/** Sleeves aus dem Gym holen (02.09.2026): Verbrechen statt Powerhouse. @param {NS} ns */
export async function main(ns) {
  const log = [];
  for (let i = 0; i < 8; i++) {
    let ok; try { ok = ns.sleeve.setToCommitCrime(i, "Mug"); } catch { break; }
    log.push("Sleeve " + i + " -> Mug: " + ok);
  }
  ns.write("data/unkick.txt", log.join("\n") + "\n", "w"); ns.tprint("[unkick] " + log.join(" | "));
}
