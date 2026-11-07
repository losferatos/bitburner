/**
 * Waren die gekauften, nicht eingebauten Augmentierungen beim Sprung BEWUSST
 * gehalten? (ausgang.js -> events.json -> Kern -> queued_augs_held)
 *
 * Rein, ohne ns - testbar in tools/test-einbauhalt.js.
 *
 * Drei Gruende zaehlen als bewusst:
 *  - weniger Stuecke als die Mindestwarteschlange (einbau.json wartend <
 *    mindest), ohne Red Pill und ohne Spendenausnahme (seit 07.11.2026);
 *  - die Wiederaufbau-Frist im Kampfknoten (einbau.json kampfZuFrueh, seit
 *    09.10.2026);
 *  - ein Tor vor dem Einbau (15.10.2026): bn4rep.js hatte den Einbau faellig,
 *    aber ausgesetzt, weil der Endspurt laeuft ("Sprung in etwa N min, der
 *    Wiederaufbau waere umsonst" bzw. Ausgang offen, lib/endspurt.js). Dann
 *    steht in data/bn4rep.json state "wait" / blockedReason "locked". BN6.3:
 *    sieben Blade-Augs, Einbau bis zum Sprung vom Endspurt-Tor gehalten - der
 *    Check-in meldete "5 gekaufte Augs beim Sprung verfallen" als Befund.
 * Beide nur mit einer Zahl nach dem letzten Einbau; das Tor zusaetzlich nur,
 * wenn es hoechstens TOR_FRISCH_MS alt ist (bn4rep.js schreibt beim Warten
 * alle 15 s).
 *
 * @param {object|null} einbau data/einbau.json
 * @param {object|null} bn4rep data/bn4rep.json
 * @param {number} lastAugReset ns.getResetInfo().lastAugReset
 * @param {number} jetzt Date.now()
 * @returns {boolean|null} null = nicht pruefbar
 */
// 3 statt 10 min (Skeptiker): bn4rep schreibt beim Warten alle 15 s; stirbt
// es nach der Torfreigabe, soll ein alter Zustand nicht lange nachwirken.
export const TOR_FRISCH_MS = 3 * 60000;
// Alter, bis zu dem die Warteschlangenzahl aus einbau.json fuer die Regel
// "unter der Mindestschlange" zaehlt (Skeptiker 07.11.: steht bn4rep, darf
// eine alte 1 keinen spaeteren Verfall decken).
export const EINBAU_FRISCH_MS = 5 * 60000;
// Nur das Endspurt-Tor ist ein bewusstes Halten. Ein laufender Graft NICHT
// (Skeptiker): haengt graft.js, wartet bn4rep ohne Zeitgrenze am Tor, und ein
// echter Verlust saehe gehalten aus. Die Texte stammen aus lib/endspurt.js
// einbauErlaubt.
const ENDSPURT_GRUND = /^(Der Ausgang steht OFFEN|Sprung in etwa)/;

export function augsBewusstGehalten(einbau, bn4rep, lastAugReset, jetzt) {
  let pruefbar = false;
  if (einbau && Number.isFinite(einbau.zeit) && einbau.zeit > lastAugReset) {
    pruefbar = true;
    if (einbau.kampfZuFrueh === true) return true;
    // UNTER DER MINDESTWARTESCHLANGE (07.11.2026, BN15.1 -> BN15.2): ein
    // einzelnes Blade-Aug stand beim Sprung in der Schlange, bn4rep.js baut
    // aber erst ab MINDEST_WARTESCHLANGE (3) ein - jeder Einbau kostet den
    // Wiederaufbau (28.08.: ein Stueck, 3 h 49 min). Bewusst gehalten, und
    // beim Knotenwechsel ohnehin wertlos (eingebaute verfallen ebenso).
    // Nur wenn nichts den Einbau erzwingt: Red Pill und Spendenausnahme
    // heben die Mindestzahl auf (bn4rep.js, Einbaubedingung) und bleiben
    // ein Befund. Bekannte Luecke: bn4rep zaehlt `wartend` VOR den Kaeufen
    // derselben Runde - kauft die letzte Runde vor dem Sprung von 1 auf 3,
    // steht noch die 1 in der Datei. Ein Rundenfenster, hingenommen.
    // Der Einbau ueber punish.js (Sprosse 5) setzt lastAugReset neu, danach
    // ist einbau.json alt und die Regel greift nicht (null).
    if (Number.isFinite(einbau.wartend) && Number.isFinite(einbau.mindest)
        && einbau.wartend < einbau.mindest
        && jetzt - einbau.zeit <= EINBAU_FRISCH_MS
        && einbau.redPillWartet !== true && einbau.spendenAusnahme !== true) return true;
  }
  if (bn4rep && Number.isFinite(bn4rep.zeit) && bn4rep.zeit > lastAugReset) {
    pruefbar = true;
    if (bn4rep.state === "wait" && bn4rep.blockedReason === "locked"
        && ENDSPURT_GRUND.test(String(bn4rep.warteGrund || ""))
        && jetzt - bn4rep.zeit <= TOR_FRISCH_MS) return true;
  }
  return pruefbar ? false : null;
}
