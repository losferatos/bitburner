/**
 * Restzeitschaetzung aus einer gemessenen Rate - robust gegen die drei Fallen.
 *
 * ===========================================================================
 * WOFUER
 * ===========================================================================
 *
 * `ausgang.js` soll `eta_min` melden: die Minuten, bis der Sprung moeglich
 * wird. Daraus entscheidet der Kern, ab wann die Wirtreserve zu halten ist
 * (ARCHITEKTUR E10) - und die Abnahmestufe C misst daran, ob der beobachtete
 * Sprung ueberhaupt vorhergesagt war.
 *
 * ===========================================================================
 * DIE DREI FALLEN, UND WARUM EIN MITTELWERT IN JEDE HINEINLAEUFT
 * ===========================================================================
 *
 * 1. OFFLINE-LUECKE. Der Rechner war acht Stunden aus. Der Fortschritt in
 *    dieser Zeit ist echt (die Engine rechnet nach), aber die Wanduhr-Rate
 *    daraus ist sinnlos - mal viel zu hoch, mal viel zu niedrig, je nachdem
 *    ob man Zaehler oder Nenner glaubt.
 *
 * 2. NACHHOLKLUMPEN. Beim Aufwachen verbucht die Engine den Rueckstand in
 *    EINER Runde: die Wanduhr zeigt 60 Sekunden, der Wert springt um Stunden.
 *    Ein Mittelwert liest daraus eine Rakete und meldet "fertig in 3 Minuten".
 *
 * 3. BESTAND STATT RATE. Ein Wert, der aus einem ueber Nacht gewachsenen
 *    Vorrat gespeist wird, sieht wie eine hohe Rate aus, bis der Vorrat leer
 *    ist. Am 30.08.2026 lag eine daraus abgeleitete Restzeit um Faktor 100
 *    daneben.
 *
 * Gegen 1 hilft ein Deckel auf den Rundenabstand - dieselbe Schranke wie in
 * `motorzeit.js`. Gegen 2 hilft KEIN Mittelwert, sondern der MEDIAN: ein
 * einzelner Ausreisser verschiebt ihn nicht, egal wie gross er ist. Gegen 3
 * hilft nur, die Schaetzung als solche zu kennzeichnen und die Zahl der
 * Stuetzpunkte mitzuliefern.
 *
 * ===========================================================================
 * LIEBER NULL ALS GERATEN
 * ===========================================================================
 *
 * Jede Funktion hier gibt `null` zurueck, wenn die Datenlage nicht traegt.
 * Eine Schaetzung, die im Zweifel eine Zahl liefert, ist schlimmer als keine:
 * der Kern haelt dann eine Reserve zum falschen Zeitpunkt, und der Bericht
 * meldet einen Sprung, der nicht kommt.
 */

/** Hoechster Rundenabstand, der noch als zusammenhaengend gilt (Falle 1). */
export const ABSTAND_DECKEL_MS = 12 * 60000;

/** So viele Stuetzpunkte braucht ein Median, um einen Ausreisser zu ueberstehen. */
export const MIN_PUNKTE = 5;

/** Wie viele Punkte hoechstens gehalten werden - aeltere sagen nichts mehr. */
export const MAX_PUNKTE = 30;

/**
 * Haengt einen Messpunkt an und haelt die Liste unter MAX_PUNKTE.
 *
 * @param {Array} punkte [{wall, wert}]
 * @param {number} wall Date.now()
 * @param {number} wert der beobachtete Wert (z. B. Hacking-Level)
 */
export function messe(punkte, wall, wert) {
  if (!Array.isArray(punkte)) punkte = [];
  if (!Number.isFinite(wall) || !Number.isFinite(wert)) return punkte;
  punkte.push({ wall, wert });
  while (punkte.length > MAX_PUNKTE) punkte.shift();
  return punkte;
}

/**
 * Rate je Minute als MEDIAN der Einzelabschnitte.
 *
 * Verworfen wird ein Abschnitt, wenn
 *   - der Abstand ueber dem Deckel liegt (Offline-Luecke),
 *   - der Abstand null oder negativ ist (Uhrensprung),
 *   - der Wert gefallen ist (Prestige, Reset - kein Rueckschritt in der Rate).
 *
 * @returns {{rate: number, punkte: number, verworfen: number}|null}
 */
export function rateJeMinute(punkte) {
  if (!Array.isArray(punkte) || punkte.length < MIN_PUNKTE) return null;
  const raten = [];
  let verworfen = 0;
  for (let i = 1; i < punkte.length; i++) {
    const dWall = punkte[i].wall - punkte[i - 1].wall;
    const dWert = punkte[i].wert - punkte[i - 1].wert;
    if (!Number.isFinite(dWall) || dWall <= 0 || dWall > ABSTAND_DECKEL_MS) { verworfen++; continue; }
    if (!Number.isFinite(dWert) || dWert < 0) { verworfen++; continue; }
    raten.push(dWert / (dWall / 60000));
  }
  if (raten.length < MIN_PUNKTE - 1) return null;
  return { rate: median(raten), punkte: raten.length, verworfen };
}

/**
 * Der Median. Bei gerader Anzahl das Mittel der beiden mittleren - das ist
 * gegen einen einzelnen Ausreisser genauso stabil wie der untere Wert und
 * springt bei jedem neuen Punkt weniger.
 */
export function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Minuten bis der Wert die Schwelle erreicht.
 *
 * @param {Array} punkte Messpunkte aus messe()
 * @param {number} jetzt aktueller Wert
 * @param {number} schwelle Zielwert
 * @returns {{min: number, rate: number, punkte: number, sicher: boolean}|null}
 */
export function etaMinuten(punkte, jetzt, schwelle) {
  if (!Number.isFinite(jetzt) || !Number.isFinite(schwelle)) return null;
  if (jetzt >= schwelle) return { min: 0, rate: 0, punkte: 0, sicher: true };

  const r = rateJeMinute(punkte);
  if (!r || r.rate <= 0) return null;

  const min = (schwelle - jetzt) / r.rate;
  if (!Number.isFinite(min) || min < 0) return null;

  // Eine Schaetzung ueber eine Woche hinaus ist keine Schaetzung mehr - die
  // Rate von heute sagt ueber naechsten Dienstag nichts. Sie wird
  // zurueckgegeben, aber als unsicher gekennzeichnet.
  const sicher = min <= 7 * 24 * 60 && r.verworfen <= r.punkte;
  return { min, rate: r.rate, punkte: r.punkte, sicher };
}

/**
 * Setzt die Messung zurueck - nach einem Prestige oder Knotenwechsel.
 * Punkte aus dem alten Lauf beschreiben eine Welt, die es nicht mehr gibt.
 */
export function zuruecksetzen() {
  return [];
}
