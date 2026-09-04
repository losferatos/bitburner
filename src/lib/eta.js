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

/**
 * So viele Stuetzpunkte braucht die Rate, bevor sie ueberhaupt gebildet wird.
 *
 * NACHGERECHNET, NICHT GESCHAETZT (Skeptiker 04.09.2026). Mit dem alten Wert 5
 * standen dem Median vier Abschnitte zur Verfuegung, und zwei Nachholklumpen
 * darin kippen ihn:
 *
 *   Klumpen 1 von 4  ->  Median 2,00   eta 600 min   (Wahrheit 600)
 *   Klumpen 2 von 4  ->  Median 251    eta   4,8 min  - Faktor 125 falsch
 *   Klumpen 3 von 4  ->  Median 500    eta   2,4 min
 *
 * Und `sicher` meldete dabei `true`, weil es nur die Weite prueft. Das Fenster
 * ist real: `hackPunkte` lebt nur im Prozess, wird also bei jedem Neustart von
 * ausgang.js geleert - zwei Klumpen in den ersten Minuten danach genuegen.
 *
 * Mit 9 Punkten (8 Abschnitten) uebersteht der Median vier Klumpen. Er kippt
 * erst, wenn MEHR ALS DIE HAELFTE der Abschnitte Klumpen sind - und wer eine
 * halbe Reihe Nachholklumpen hat, hat kein Schaetzproblem, sondern ein
 * Betriebsproblem.
 */
export const MIN_PUNKTE = 9;

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

  let rate = median(raten);

  // DIE QUANTISIERUNGSFALLE (Skeptiker 04.09.2026, nachgerechnet).
  //
  // Der Hacking-Level ist eine GANZZAHL und wird im 60-Sekunden-Takt gelesen.
  // Waechst er langsamer als etwa 0,6 Stufen je Minute, steht er in mehr als
  // der Haelfte der Fenster still - der Median ist dann 0, und die Restzeit
  // faellt dauerhaft auf null. Gemessen:
  //
  //   2,0 Stufen/min -> Median 2 -> ETA  11 min
  //   1,0            -> Median 1 -> ETA  61 min
  //   0,5            -> Median 0 -> NULL
  //
  // Das ist genau der Endanflug, in dem die Zahl gebraucht wird: die Rate
  // zerfaellt mit dem Level, also wird sie zwangslaeufig klein.
  //
  // Der Ausweg ist nicht, Nullabschnitte zu verwerfen - dann bliebe nur die
  // Spitze und die Rate waere zu hoch. Sondern: steht der Median auf null,
  // waehrend der Wert insgesamt gewachsen ist, wird die Rate ueber die GESAMTE
  // akzeptierte Strecke gebildet. Das ist grob, aber es ist eine Zahl statt
  // keiner - und sie ist nach unten ehrlich.
  if (rate === 0) {
    let spanneMs = 0;
    let zuwachs = 0;
    for (let i = 1; i < punkte.length; i++) {
      const dWall = punkte[i].wall - punkte[i - 1].wall;
      const dWert = punkte[i].wert - punkte[i - 1].wert;
      if (!Number.isFinite(dWall) || dWall <= 0 || dWall > ABSTAND_DECKEL_MS) continue;
      if (!Number.isFinite(dWert) || dWert < 0) continue;
      spanneMs += dWall;
      zuwachs += dWert;
    }
    if (zuwachs > 0 && spanneMs > 0) {
      rate = zuwachs / (spanneMs / 60000);
      return { rate, punkte: raten.length, verworfen, grob: true };
    }
  }

  return { rate, punkte: raten.length, verworfen, grob: false };
}

/**
 * Der Median - bei gerader Anzahl der UNTERE der beiden mittleren Werte.
 *
 * HIER STAND DAS MITTEL DER BEIDEN, mit der Begruendung, das sei "genauso
 * stabil". Ein Test hat das widerlegt: bei acht Abschnitten, von denen vier
 * Nachholklumpen sind, ergibt das Mittel (2 + 500) / 2 = 251 statt 2. Genau
 * die Haelfte kippt den Median also, sobald die Anzahl gerade ist - der
 * Ausreisser wandert in die Mittelung hinein.
 *
 * Der untere Wert kippt dort nicht. Er unterschaetzt die Rate bei sauberen
 * Daten leicht, und das ist die richtige Ausfallrichtung: eine zu niedrige
 * Rate ergibt eine zu LANGE Restzeit, und wer zu frueh mit dem Sprung rechnet,
 * verliert nichts. Wer zu spaet damit rechnet, verliert den Lauf.
 */
export function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : s[m - 1];
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
  // `sicher` haengt jetzt AUCH an der Zahl der Stuetzpunkte. Vorher prueften
  // nur Weite und Verwurfsquote - eine Schaetzung aus vier Abschnitten, von
  // denen zwei Klumpen waren, galt als sicher und lag um Faktor 125 daneben.
  const sicher = min <= 7 * 24 * 60
    && r.verworfen <= r.punkte
    && r.punkte >= MIN_PUNKTE - 1
    && !r.grob;
  return { min, rate: r.rate, punkte: r.punkte, sicher, grob: r.grob === true };
}

/**
 * Setzt die Messung zurueck - nach einem Prestige oder Knotenwechsel.
 * Punkte aus dem alten Lauf beschreiben eine Welt, die es nicht mehr gibt.
 */
export function zuruecksetzen() {
  return [];
}
