/**
 * Den Nachtdienst stilllegen.
 *
 * Der Seitenagent (archiv/nightshift/agent.js) kauft NeuroFlux Governor, "bis das
 * Geld alle ist" - nachts richtig, denn beim Install faellt das Guthaben
 * ohnehin auf 1262. Am Tag ist es eine Falle, und zwar eine, die sich selbst
 * verstaerkt:
 *
 *   BitWire ist zu teuer, der Knopf steht auf disabled
 *     -> offeneAugs() zaehlt ihn nicht mit und meldet "nichts offen"
 *     -> der Agent weicht auf NeuroFlux aus
 *     -> jeder Kauf hebt getGenericAugmentationPriceMultiplier() um Faktor 1.9
 *        (Augmentation/AugmentationHelpers.ts:29-37)
 *     -> BitWire wird noch teurer
 *
 * Gemessen am 20.08.: 13 Stufen in der Warteschlange, Preisfaktor x4205 fuer
 * den naechsten Kauf. Aus $10 Mio fuer BitWire waren $42 Mrd geworden.
 *
 * `document.defaultView` ist der saubere Weg an das Fenster - ohne `eval`,
 * mit dem sich der 25-GB-Aufschlag auf `document` umgehen liesse
 * (RamCostGenerator.ts:12). Das waere ein bekannter Exploit und bleibt drausen.
 *
 * Aufruf:  node tools/task.js stopnight.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const fenster = doc.defaultView;
  const n = fenster && fenster.__nightshift;
  const sag = (t) => {
    ns.tprint(t);
    ns.write("data/stopnight.txt", t + "\n", "a");
    if (ns.getHostname() !== "home") ns.scp("data/stopnight.txt", "home", ns.getHostname());
  };
  if (!n) return sag("Kein Nachtdienst gefunden - nichts zu tun.");
  if (n.timer) {
    fenster.clearInterval(n.timer);
    n.timer = null;
    sag("Nachtdienst stillgelegt - kein Taktgeber mehr.");
  } else {
    sag("Nachtdienst lag bereits still.");
  }
}
