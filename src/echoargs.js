/** Prueft, was vom Auftragslaeufer tatsaechlich als Argument ankommt.
 *  @param {NS} ns */
export async function main(ns) {
  const t = "args=" + JSON.stringify(ns.args);
  ns.write("data/echoargs.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/echoargs.txt", "home", ns.getHostname());
}
