/**
 * Ein Skript im ganzen Netz beenden.
 *
 * Der Auftragslaeufer kann Skripte starten, aber nichts anhalten - und ein
 * haengengebliebener Helfer laesst sich von aussen sonst gar nicht mehr
 * loswerden, seit die Hand abgeschaltet ist. Am 20.08. hing eine Instanz von
 * work.js fest, deren erster Schritt "laufende Arbeit entfokussieren" ist:
 * Sie hat den Fokus im Minutentakt wieder eingerissen, waehrend jeder neue
 * Versuch, ihn zu setzen, brav Vollzug meldete.
 *
 * Sucht ueber ALLE Rechner, nicht nur ueber home - die Helfer laufen fast nie
 * dort.
 *
 * Aufruf:  node tools/task.js kill.js work.js
 *          node tools/task.js kill.js work.js --ausser 12345   (PID verschonen)
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const argumente = ns.args.map(String);
  const ziel = argumente.find((a) => !a.startsWith("--"));
  const ausserIndex = argumente.indexOf("--ausser");
  const verschonen = ausserIndex >= 0 ? Number(argumente[ausserIndex + 1]) : -1;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/kill.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/kill.txt", "home", ns.getHostname());
  };
  if (!ziel) return sag("Kein Skriptname angegeben.");

  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const nachbar of ns.scan(hier)) {
      if (gesehen.has(nachbar)) continue;
      gesehen.add(nachbar);
      schlange.push(nachbar);
    }
  }

  let getroffen = 0;
  const orte = [];
  for (const host of gesehen) {
    for (const proc of ns.ps(host)) {
      if (proc.filename !== ziel) continue;
      if (proc.pid === verschonen) continue;
      // Sich selbst nicht erschlagen, sonst bleibt der Bericht ungeschrieben.
      if (host === ns.getHostname() && proc.pid === ns.pid) continue;
      if (ns.kill(proc.pid)) {
        getroffen++;
        orte.push(host + "#" + proc.pid);
      }
    }
  }
  sag(getroffen
    ? "Beendet: " + getroffen + "x " + ziel + " (" + orte.join(", ") + ")"
    : ziel + " lief nirgends.");
}
