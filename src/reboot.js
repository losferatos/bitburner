/**
 * bn4rep.js netzweit beenden, damit bn4life.js es in neuer Fassung startet.
 *
 * Das Skript laeuft nicht zwingend auf home - der Autopilot legt es dorthin,
 * wo Platz ist. Ein "kill" im Terminal trifft deshalb nur zufaellig den
 * richtigen Rechner. Diese Fassung geht das ganze Netz durch.
 *
 * Aufruf: node tools/task.js reboot.js [skriptname]
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const ziel = String(ns.args[0] || "bn4rep.js");
  const gesehen = new Set(["home"]);
  const rand = ["home"];
  while (rand.length) {
    const h = rand.pop();
    for (const n of ns.scan(h)) if (!gesehen.has(n)) { gesehen.add(n); rand.push(n); }
  }
  let getroffen = 0;
  const wo = [];
  for (const h of gesehen) {
    for (const p of ns.ps(h)) {
      if (p.filename !== ziel) continue;
      // Nicht sich selbst beenden, falls jemand reboot.js auf reboot.js wirft.
      if (p.pid === ns.pid) continue;
      ns.kill(p.pid);
      getroffen++; wo.push(h + ":" + p.pid);
    }
  }
  const t = `${ziel}: ${getroffen} Prozess(e) beendet` + (wo.length ? " auf " + wo.join(", ") : "");
  ns.write("data/reboot.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/reboot.txt", "home", ns.getHostname());
  ns.tprint(t);
}
