/**
 * Waren die gekauften, nicht eingebauten Augmentierungen beim Sprung BEWUSST
 * gehalten? (ausgang.js -> events.json -> Kern -> queued_augs_held)
 *
 * Rein, ohne ns - testbar in tools/test-einbauhalt.js.
 *
 * Zwei Gruende zaehlen als bewusst:
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
  }
  if (bn4rep && Number.isFinite(bn4rep.zeit) && bn4rep.zeit > lastAugReset) {
    pruefbar = true;
    if (bn4rep.state === "wait" && bn4rep.blockedReason === "locked"
        && ENDSPURT_GRUND.test(String(bn4rep.warteGrund || ""))
        && jetzt - bn4rep.zeit <= TOR_FRISCH_MS) return true;
  }
  return pruefbar ? false : null;
}
