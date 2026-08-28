/** Was kostet ein Skript an RAM? Eine Zahl, sonst nichts.
 * Aufruf: node tools/task.js ramcheck.js darkweb.js
 * @param {NS} ns */
export async function main(ns) {
  const datei = String(ns.args[0] || "darkweb.js");
  const ram = ns.getScriptRam(datei, "home");
  ns.write("data/ramcheck.json", JSON.stringify({
    zeit: Date.now(), datei, ram,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/ramcheck.json", "home", ns.getHostname());
}
