/**
 * Beantwortet die Frage "wohin ist das Geld?" fuer den haeufigsten Fall:
 * gekaufte, aber noch nicht eingebaute Augmentierungen.
 *
 * Am 26.08.2026 sind zwischen 07:55 und 08:15 sieben Milliarden verschwunden -
 * auf einen Schlag, danach stieg das Guthaben wieder normal. Ueber
 * `data/bn4rep.json` war das nicht zu klaeren: Das Skript steigt an mehreren
 * Stellen aus der Runde aus, bevor es seine Telemetrie schreibt (siehe den
 * Kommentar bei `bn4rep.js:357-363`), und die Datei stand deshalb seit
 * gestern 17:05.
 *
 * `getOwnedAugmentations(true)` liefert gekaufte UND eingebaute,
 * `(false)` nur die eingebauten. Die Differenz ist der Warenkorb, der beim
 * naechsten Einbau wirksam wird - und genau der erklaert einen ploetzlichen
 * Guthabenverlust.
 *
 * Aufruf:  node tools/task.js augcheck.js
 * Ergebnis: data/augcheck.json
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const s = ns.singularity;
  let gekauft = [], eingebaut = [], preise = {};
  try {
    const alle = s.getOwnedAugmentations(true);
    eingebaut = s.getOwnedAugmentations(false);
    gekauft = alle.filter((a) => !eingebaut.includes(a));
    for (const a of gekauft) {
      try { preise[a] = s.getAugmentationBasePrice(a); } catch { preise[a] = null; }
    }
  } catch (e) {
    ns.write("data/augcheck.json", JSON.stringify({
      zeit: Date.now(), fehler: String(e && e.message ? e.message : e),
    }), "w");
    if (ns.getHostname() !== "home") ns.scp("data/augcheck.json", "home", ns.getHostname());
    return;
  }

  const summe = Object.values(preise).reduce((n, p) => n + (p || 0), 0);
  ns.write("data/augcheck.json", JSON.stringify({
    zeit: Date.now(),
    geld: ns.getPlayer().money,
    anzahlEingebaut: eingebaut.length,
    anzahlGekauft: gekauft.length,
    // Der Grundpreis, nicht der bezahlte: Jede weitere Augmentierung im
    // selben Zyklus kostet ein Vielfaches davon (Faktor 1,9 je Stueck).
    // Die Summe ist deshalb eine UNTERGRENZE fuer das ausgegebene Geld.
    grundpreisSumme: Math.round(summe),
    gekauft,
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/augcheck.json", "home", ns.getHostname());
}
