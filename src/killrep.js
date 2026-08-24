/** bn4rep.js ueberall beenden - bn4net startet es in der naechsten Runde mit
 *  dem aktuellen Quelltext neu. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }
  let n = 0;
  for (const h of bekannt) {
    for (const pr of ns.ps(h)) {
      if (pr.filename === "bn4rep.js") { ns.kill(pr.pid); n++; }
    }
  }
  ns.write("data/killrep.txt", "beendet: " + n + " @ " + Date.now(), "w");
  if (ns.getHostname() !== "home") ns.scp("data/killrep.txt", "home", ns.getHostname());
}
