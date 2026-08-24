/** Ein Werkzeug ueberall beenden - bn4net startet es in der naechsten Runde
 *  mit dem aktuellen Quelltext neu. Ohne diesen Weg wirkt eine Codeaenderung
 *  erst beim naechsten Einbau, weil ein laufendes Skript seinen alten Stand
 *  behaelt.
 *
 *  Aufruf ueber data/task.txt:  ["killrep.js", "popups.js"]
 *  Ohne Argument gilt bn4rep.js.
 * @param {NS} ns */
export async function main(ns) {
  const ziel = String(ns.args[0] || "bn4rep.js");
  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }
  let n = 0;
  for (const h of bekannt) {
    for (const pr of ns.ps(h)) {
      if (pr.filename === ziel) { ns.kill(pr.pid); n++; }
    }
  }
  ns.write("data/killrep.txt", ziel + " beendet: " + n + " @ " + Date.now(), "w");
  if (ns.getHostname() !== "home") ns.scp("data/killrep.txt", "home", ns.getHostname());
}
