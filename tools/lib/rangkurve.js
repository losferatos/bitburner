/**
 * Referenzkurven fuer den Bladeburner-Rang - und warum eine lineare ETA hier
 * grundsaetzlich falsch ist.
 *
 * ===========================================================================
 * DER FEHLER, DEN DIESES MODUL BEHEBT
 * ===========================================================================
 *
 * `tools/checkin.js` rechnete die Restzeit bis zum Knotenausgang als
 * `(Zielrang - Rang) / gemessene Rate`. Am 04.09.2026 ergab das fuer BitNode 10
 * eine Restzeit von **430,7 Tagen** - bei einem Urteil "AUF KURS". Der Auftrag
 * veranschlagt fuer die GESAMTE Restroute aus 40 Laeufen 46 bis 79 Tage.
 *
 * Die Zahl ist um Faktor 208 falsch, und der Beweis braucht kein Modell: der
 * Bot hat diesen Knoten schon einmal gefahren, und der Lauf liegt vollstaendig
 * auf Platte (`data/verlauf-strategie.json`, `data/checkin.json`).
 *
 * Rang gegen Spielzeit in BitNode 10, Lauf 1, Beitritt bei Spielstunde 239,73:
 *
 *     h 19,92 ab Beitritt      Rang        655      Rate     39/h
 *     h 28,41                  Rang      1.121      Rate     66/h
 *     h 31,89                  Rang      1.509      Rate    111/h   <- 1. Operation
 *     h 46,59                  Rang      4.802      Rate    224/h
 *     h 46,65                  Rang      5.297      Rate  9.186/h
 *     h 47,79                  Rang     17.594
 *     h 69,65                  Rang  4.543.999
 *
 * Die Rate waechst um mehr als Faktor 5.000. Der Traeger ist nicht der Rang
 * selbst - `calculateActionRankGain` in `Bladeburner/Formulas.ts` kennt den
 * Spielerrang gar nicht -, sondern die Aktionsstufe ueber `rewardFac^(level-1)`
 * und der Wechsel von Contracts auf Operations. Eine Rate, die im Anlauf
 * gemessen und linear fortgeschrieben wird, misst deshalb nicht die Strecke,
 * sondern nur den Startblock.
 *
 * DERSELBE FEHLER STAND SCHON EINMAL HIER. `nodes/ERLEDIGT.md` vom 30.08.2026
 * 14:20: "gemessene Rangrate 42,5/h, also 334 Tage ... die lineare
 * Fortschreibung eines Post-Reset-Lochs auf einer Exponentialkurve". Derselbe
 * Knoten, dieselbe Stelle der Kurve, fuenf Tage frueher. Er kam zurueck, weil
 * er damals im Bericht behoben wurde und nicht im Werkzeug.
 *
 * ===========================================================================
 * WAS DIESES MODUL STATTDESSEN TUT
 * ===========================================================================
 *
 * Es liest die eigene Vergangenheit. Fuer einen Knoten, der schon einmal
 * gefahren wurde, gibt es eine gemessene Kurve; die Restzeit ist dann keine
 * Hochrechnung, sondern ein Nachschlagen: "an dieser Rangstelle war der letzte
 * Lauf nach X Stunden, die Schwelle fiel nach Y Stunden, Rest also Y-X".
 *
 * Das Ergebnis ist bewusst eine KLAMMER, keine Zahl. Die Stuetzpunkte liegen
 * weit auseinander; zwischen "letzter Punkt unter der Schwelle" und "erster
 * Punkt darueber" liegen in Lauf 1 knapp 22 Stunden, in denen niemand gemessen
 * hat. Eine Klammer, die das zugibt, ist ehrlicher als eine Zahl, die es
 * verschweigt - und sie ist immer noch um Faktor 200 besser als die lineare.
 *
 * Gibt es keine Referenzkurve, wird das gesagt und NICHT ersatzweise linear
 * gerechnet.
 */

/**
 * Gemessene Stuetzpunkte je BitNode.
 *
 * `h` ist die Spielzeit in Stunden SEIT DEM BLADEBURNER-BEITRITT, nicht seit
 * dem Knotenstart - der Kaltstart davor schwankt zu stark (Lauf 1 brauchte bis
 * 25,2 h, Lauf 2 volle 39,1 h) und wuerde die Kurve verschieben.
 *
 * Quelle: data/verlauf-strategie.json und data/checkin.json, ausgelesen
 * 04.09.2026. Beitritt Lauf 1 bei Spielstunde 239,73.
 */
export const KURVEN = {
  10: {
    lauf: 1,
    beitrittSpielstunde: 239.73,
    schwelle: 400000,
    quelle: "data/verlauf-strategie.json + data/checkin.json, gelesen 04.09.2026",
    punkte: [
      { h: 0.0, rang: 0 },
      { h: 12.65, rang: 214 },
      { h: 18.71, rang: 605 },
      { h: 19.92, rang: 655 },
      { h: 21.39, rang: 903 },
      { h: 26.67, rang: 1020 },
      { h: 28.41, rang: 1121 },
      { h: 31.89, rang: 1509 },
      { h: 32.86, rang: 1727 },
      { h: 46.59, rang: 4802 },
      { h: 46.65, rang: 5297 },
      { h: 46.82, rang: 7465 },
      { h: 47.02, rang: 10194 },
      { h: 47.79, rang: 17594 },
      { h: 69.65, rang: 4543999 },
      { h: 69.67, rang: 4561258 },
    ],
  },
};

/**
 * Restzeit bis zur Schwelle, aus der Referenzkurve gelesen.
 *
 * @param {number} knoten
 * @param {number} rang aktueller Rang
 * @returns {{min:number,max:number,mitte:number,quelle:string,stuetzpunkte:number}|null}
 *          Stunden Spielzeit, oder null wenn es fuer den Knoten keine Kurve gibt.
 */
export function restzeitAusKurve(knoten, rang) {
  const k = KURVEN[knoten];
  if (!k) return null;
  if (!Number.isFinite(rang) || rang < 0) return null;

  const p = k.punkte;
  if (rang >= k.schwelle) return { min: 0, max: 0, mitte: 0, quelle: k.quelle, stuetzpunkte: p.length };

  // Wo stand der Referenzlauf bei diesem Rang? Zwischen den beiden Punkten,
  // die ihn einschliessen, wird im Logarithmus des Rangs interpoliert - die
  // Groesse waechst multiplikativ, nicht additiv.
  let hJetzt = null;
  for (let i = 0; i < p.length - 1; i++) {
    if (rang >= p[i].rang && rang <= p[i + 1].rang) {
      const r0 = Math.max(1, p[i].rang);
      const r1 = Math.max(1, p[i + 1].rang);
      const r = Math.max(1, rang);
      const anteil = r1 > r0 ? Math.log(r / r0) / Math.log(r1 / r0) : 0;
      hJetzt = p[i].h + anteil * (p[i + 1].h - p[i].h);
      break;
    }
  }
  if (hJetzt === null) return null;

  // Wann fiel die Schwelle? Der letzte Punkt darunter und der erste darueber
  // spannen die Klammer auf. Dazwischen wurde nicht gemessen, und das wird
  // nicht weginterpoliert - es ist echte Unsicherheit.
  let letzterDarunter = null;
  let ersterDarueber = null;
  for (const q of p) {
    if (q.rang < k.schwelle) letzterDarunter = q;
    else if (ersterDarueber === null) ersterDarueber = q;
  }
  if (!ersterDarueber) return null;

  return {
    min: Math.max(0, letzterDarunter.h - hJetzt),
    max: Math.max(0, ersterDarueber.h - hJetzt),
    mitte: Math.max(0, (letzterDarunter.h + ersterDarueber.h) / 2 - hJetzt),
    hJetzt,
    quelle: k.quelle,
    stuetzpunkte: p.length,
  };
}

/**
 * Wie schnell laeuft der aktuelle Lauf gegen den Referenzlauf an derselben
 * Rangstelle?
 *
 * Das ist die eigentlich interessante Zahl - sie beantwortet "sind wir langsamer
 * als beim letzten Mal", waehrend die Restzeit nur "wie lange noch" beantwortet.
 * Ein Wert unter 1 heisst schneller als die Referenz.
 *
 * @returns {{faktor:number, hJetzt:number, hReferenz:number}|null}
 */
export function vergleichMitReferenz(knoten, rang, hSeitBeitritt) {
  const r = restzeitAusKurve(knoten, rang);
  if (!r || !Number.isFinite(hSeitBeitritt) || hSeitBeitritt <= 0) return null;
  return {
    faktor: hSeitBeitritt / r.hJetzt,
    hJetzt: hSeitBeitritt,
    hReferenz: r.hJetzt,
  };
}

/**
 * Der naechste Meilenstein der Referenzkurve - damit der Bericht eine
 * FALSIFIZIERBARE Vorhersage macht statt einer Beschwichtigung.
 *
 * "Bei Rang 1.509 muss die Rate ueber 100/h liegen" laesst sich beim naechsten
 * Besuch pruefen. "Das wird schon" nicht.
 */
export function naechsterMeilenstein(knoten, rang) {
  const k = KURVEN[knoten];
  if (!k) return null;
  const p = k.punkte;
  for (let i = 0; i < p.length - 1; i++) {
    if (p[i + 1].rang > rang) {
      const dh = p[i + 1].h - p[i].h;
      const dr = p[i + 1].rang - p[i].rang;
      return {
        rang: p[i + 1].rang,
        hAbBeitritt: p[i + 1].h,
        rateDorthin: dh > 0 ? dr / dh : null,
      };
    }
  }
  return null;
}
