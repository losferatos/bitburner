/**
 * Beendet alle Oberflaechenskripte im Netz.
 *
 * WARUM ES DAS BRAUCHT
 *
 * Ein Oberflaechenskript, das haengt, legt den ganzen Betrieb still: Der
 * Autopilot stellt seine eigenen Oberflaechenauftraege zurueck, solange eins
 * laeuft, und die Nachtsteuerung tut dasselbe. Beide verhalten sich richtig -
 * aber niemand raeumt die Leiche weg.
 *
 * In der Nacht zum 21.08.2026 blieb buyaugs.js dreizehn Minuten bei "Runde 1:
 * Zustand lesen" stehen, ohne eine einzige Faktionszeile zu schreiben. Bis
 * dahin gab es keinen anderen Weg, es loszuwerden, als den Autopiloten
 * neuzustarten und darauf zu hoffen, dass der Einkaeufer zufaellig denselben
 * Rechner freiraeumt.
 *
 * Aufruf:  node tools/task.js killui.js
 *          node tools/task.js killui.js buyaugs.js    nur dieses eine
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const nurDas = ns.args.map(String).filter((a) => !a.startsWith("--"))[0] || null;

  // Dieselbe Liste wie im Autopiloten und in der Nachtsteuerung. Wer sie hier
  // erweitert, muss es dort auch tun - sonst kennt der Kollisionsschutz ein
  // Skript, das dieser Aufraeumer nicht beenden kann.
  const OBERFLAECHE = /^(buyaugs|work|joinfac|darkweb|travel|homeram|buyone|stockaccess)\.js$/;

  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    for (const nachbar of ns.scan(schlange.shift())) {
      if (gesehen.has(nachbar)) continue;
      gesehen.add(nachbar);
      schlange.push(nachbar);
    }
  }

  const zeilen = [];
  for (const host of gesehen) {
    for (const proc of ns.ps(host)) {
      if (proc.filename === ns.getScriptName()) continue;
      if (nurDas ? proc.filename !== nurDas : !OBERFLAECHE.test(proc.filename)) continue;
      ns.kill(proc.pid);
      zeilen.push(proc.filename + " auf " + host + " (PID " + proc.pid + ")");
    }
  }

  const text = zeilen.length
    ? "Beendet:\n  " + zeilen.join("\n  ")
    : "Kein Oberflaechenskript lief.";
  ns.write("data/killui.txt", new Date().toLocaleTimeString() + "\n" + text + "\n", "w");
  if (ns.getHostname() !== "home") ns.scp("data/killui.txt", "home", ns.getHostname());
}
