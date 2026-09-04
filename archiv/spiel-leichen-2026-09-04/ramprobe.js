/** @param {NS} ns */
export async function main(ns) {
  const out = {};
  for (const f of ["hashes.js", "ausgang.js", "bbtrain.js", "sleeve.js", "blade.js", "bn4net.js", "boot.js", "bn4rep.js"]) out[f] = ns.getScriptRam(f, "home");
  ns.write("data/ramprobe.txt", JSON.stringify(out), "w");
  if (ns.getHostname() !== "home") ns.scp("data/ramprobe.txt", "home", ns.getHostname());
}
