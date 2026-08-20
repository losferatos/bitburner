/**
 * Den Autopiloten erneuern.
 *
 * Der Autopilot liest seine Stellschrauben (SHARE_ANTEIL, Schwellen, Sockel)
 * als Konstanten beim Start. Eine geaenderte Datei wirkt deshalb erst nach
 * einem Neustart - und der war bisher teuer: Wer ihn per kill.js beendet,
 * wartet bis zu zehn Minuten, bis keepalive.js den Ausfall bemerkt und ihn
 * ueber das Terminal wiederbelebt. Zehn Minuten Stillstand fuer eine
 * Zahlenaenderung.
 *
 * Dieses Skript wird selbst vom Auftragslaeufer gestartet und laeuft auf einem
 * Botrechner. Es ueberlebt damit den Tod des Autopiloten und kann ihn Sekunden
 * spaeter neu starten - die Luecke betraegt keine halbe Minute.
 *
 * Aufruf:  node tools/task.js restart.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/restart.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/restart.txt", "home", ns.getHostname());
  };

  // Netzweit suchen, nicht nur auf home. Der Autopilot gehoert zwar auf home,
  // aber eine haengende Zweitinstanz anderswo wuerde den Doppelstartschutz des
  // neuen Prozesses ausloesen - der beendet sich dann sofort wieder, und wir
  // stuenden mit gar keinem Autopiloten da.
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
  for (const host of gesehen) {
    for (const proc of ns.ps(host)) {
      if (proc.filename !== "autopilot.js") continue;
      if (ns.kill(proc.pid)) getroffen++;
    }
  }
  sag("Alte Instanzen beendet: " + getroffen);

  // Kurz warten. Der Doppelstartschutz zaehlt Prozesse auf home; ein gerade
  // erschlagener Prozess braucht einen Moment, bis er aus der Liste faellt.
  await ns.sleep(2000);

  const pid = ns.exec("autopilot.js", "home", 1);
  sag(pid ? "Autopilot neu gestartet (PID " + pid + ")"
    : "Autopilot liess sich NICHT starten - auf home ist kein Platz oder die Datei fehlt.");
}
