/** Diagnose: Source-File-Stand und Reset-Info als Text. @param {NS} ns */
export async function main(ns) {
  const i = ns.getResetInfo();
  const out = { currentNode: i.currentNode, lastNodeReset: i.lastNodeReset, lastAugReset: i.lastAugReset,
    ownedSF: [...i.ownedSF.entries()], bitNodeOptions: i.bitNodeOptions || null, now: Date.now() };
  ns.write("data/sfprobe.txt", JSON.stringify(out), "w");
  if (ns.getHostname() !== "home") ns.scp("data/sfprobe.txt", "home", ns.getHostname());
}
