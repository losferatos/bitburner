/**
 * Woher kommt das Geld, und wohin geht es? Raten je Quelle statt Schaetzung
 * aus der Guthabendifferenz.
 *
 * Die Entscheidung ueber Raid haengt an einer Bilanz: Ein Misserfolg kostet
 * rund 39,7 Millionen Krankenhausgebuehr (`Hospital.ts:4-10`, 397
 * Trefferpunkte Schaden), und bei rund 0,93 Misserfolgen je Minute waeren das
 * 37 Millionen je Minute. Dagegen stand bisher nur eine SCHAETZUNG des
 * Einkommens - die Differenz zweier Guthabenstaende. Die ist als Vergleich
 * untauglich: Sie enthaelt bereits alle Ausgaben (Serverkauf, Augmentierungen,
 * bestehende Krankenhausbesuche) und untertreibt das Bruttoeinkommen deshalb
 * systematisch.
 *
 * `ns.getMoneySources()` fuehrt beide Seiten getrennt (MoneySourceTracker.ts):
 * `hacking`, `bladeburner`, `stock` auf der Habenseite, `hospitalization`,
 * `servers`, `augmentations` auf der Sollseite - jeweils kumulativ seit dem
 * letzten Einbau. Zwei Messungen im Abstand ergeben die Rate.
 *
 * Aufruf:  node tools/task.js geld.js [--minuten 3]
 * Ergebnis: data/geld.json
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const flags = ns.flags([["minuten", 3]]);
  const wartezeit = Math.max(0.5, Number(flags.minuten)) * 60000;

  const nimm = () => {
    const m = ns.getMoneySources().sinceInstall;
    // Ein flaches Abbild, damit sich die Differenz ohne Sonderfaelle bilden
    // laesst. Methoden des Trackers interessieren hier nicht.
    const o = {};
    for (const k of Object.keys(m)) if (typeof m[k] === "number") o[k] = m[k];
    return o;
  };

  const vorher = nimm();
  const tVor = Date.now();
  await ns.sleep(wartezeit);
  const nachher = nimm();
  const tNach = Date.now();

  const minuten = (tNach - tVor) / 60000;
  const raten = {};
  for (const k of Object.keys(nachher)) {
    const d = nachher[k] - (vorher[k] ?? 0);
    // Nur nennen, was sich bewegt hat - sonst steht die Datei voll mit Nullen.
    if (Math.abs(d) > 1) raten[k] = Math.round(d / minuten);
  }

  ns.write("data/geld.json", JSON.stringify({
    zeit: Date.now(),
    minuten: +minuten.toFixed(2),
    geld: ns.getPlayer().money,
    // Alles je MINUTE. Die Vorzeichen stehen so, wie der Tracker sie fuehrt:
    // Ausgaben sind negativ.
    jeMinute: raten,
    gesamtJeMinute: Math.round((nachher.total - vorher.total) / minuten),
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/geld.json", "home", ns.getHostname());
}
