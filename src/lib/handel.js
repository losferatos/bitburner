/**
 * Die Handelsregel der Boerse als reine Funktionen (BN8-2/3/4, Audit 03.10.
 * und 07.11.2026). Kein `ns` - boerse.js liefert die Lage und fuehrt aus,
 * tools/audit/boerse-regel.mjs faehrt DENSELBEN Code gegen das nachgebaute
 * Marktmodell (boerse-sim.mjs). Was hier steht, ist also gerechnet.
 *
 * DIE REGEL
 *   Rang nach erwartetem Ertrag je Tick: (2f-1) * mv. Der Kurs geht je Tick
 *   um av = v*mv/100 (v ~ U(0,1)) nach oben mit Wahrscheinlichkeit f, sonst
 *   nach unten (StockMarket.ts:260-290). Eine sichere, aber traege Aktie ist
 *   weniger wert als eine etwas unsicherere, die sich staerker bewegt - die
 *   alte Regel ordnete nur nach f.
 *   Einstieg ab f - 0,5 >= Schwelle, Ausstieg sobald f < 0,5.
 *   Das freie Kapital geht in den besten Titel, bis dessen Stueckgrenze
 *   (maxShares) oder die Haelfte des Vermoegens erreicht ist, dann in den
 *   naechsten. Die alte Regel deckelte bei 25 % und ordnete nach f.
 *   Nur Long: Shorts brachten in der Rechnung nichts (12,7 h gegen 12,7 h).
 *
 * OHNE 4S schaetzt ein Filter f aus den Kursschritten (siehe DER KURSFILTER)
 * und `schaetze` die Schwankung mv aus der mittleren Schrittweite (E[av] = mv/200).
 *
 * DIE RESERVE ist kein fester Anteil mehr. Die alten 15 % wirkten nicht
 * (Bargeld real 0,03 % des Vermoegens) und haetten, wenn sie gewirkt haetten,
 * 15 % des Kapitals stillgelegt. Bargeld wird jetzt auf ABRUF bereitgestellt
 * (data/boerse-abruf.txt, lib/boersepause.js): wer kaufen will, sagt wieviel.
 */

export const KOMMISSION = 100e3;

export const REGEL = {
  fenster: 30,            // Ticks in der Historie (ohne 4S); 30/40 gleichauf, 50 klar schlechter
  minTicks: 10,           // juengere Schaetzungen handeln nicht (der Filter braucht weniger als das Fenster)
  einstieg4S: 0.05,       // f - 0,5 ab hier wird gekauft (mit 4S)
  einstiegHistorie: 0.03, // ohne 4S, mit dem Filter: 0,03 bis 0,08 liegen im Rauschen beieinander
  mindestPosten: 2e7,     // darunter frisst die Kommission (2 x 100k) >= 1 %
  // Hoechster Anteil des Vermoegens in EINEM Titel. Mit 1 faellt das Vermoegen
  // im schlechtesten von 60 Laeufen auf 0,52 des Startwerts, mit 0,5 auf 0,71 -
  // bei 14,4 statt 13,7 h bis 1 Bio (Median) und gleichem 95-%-Wert.
  maxAnteil: 0.5,
};

/** 4S-API: 25 Mrd (StockMarket/data/Constants.ts MarketDataTixApi4SCost). */
export const KOSTEN_4S = 25e9;

/** Anteil des Vermoegens, der mit 4S bar bleibt (Rechner, RAM, Programme). */
export const BETRIEBSANTEIL = 0.02;

/**
 * Ab diesem VERMOEGEN (Bargeld + Depot) wird die 4S-API gekauft.
 * Nicht bei 26 Mrd: der Kauf nimmt 25 Mrd aus dem Kapital, und was uebrig
 * bleibt, muss erst wieder wachsen. Gerechnet in boerse-regel.mjs (--4s):
 * bei 26 Mrd dauert es bis 1 Bio 15,1 h, zwischen 35 und 90 Mrd 13-14,5 h.
 */
export const SCHWELLE_4S = 45e9;

/**
 * Vorhersage und Schwankung aus der Preishistorie (aeltester zuerst).
 * @returns {{f:number, mv:number, ticks:number}} f = 0,5 heisst "keine Meinung"
 */
export function schaetze(h, fenster = REGEL.fenster) {
  const ab = Math.max(1, h.length - fenster);
  let hoch = 0, schritte = 0, summe = 0;
  for (let i = ab; i < h.length; i++) {
    const a = h[i - 1], b = h[i];
    if (!(a > 0) || !(b > 0) || a === b) continue;
    schritte++;
    if (b > a) hoch++;
    summe += Math.max(a, b) / Math.min(a, b) - 1;
  }
  if (schritte < 10) return { f: 0.5, mv: 0, ticks: schritte };
  return { f: hoch / schritte, mv: 200 * summe / schritte, ticks: schritte };
}

// ---------------------------------------------------------------------------
// DER KURSFILTER OHNE 4S (10.11.2026)
//
// Der Anteil der Aufwaertsticks in einem Fenster vergisst, was das Spiel ueber
// den Markt verraet (StockMarket.ts:223-320):
//  - Die Vorhersage f = 0,5 +- otlkMag/100 aendert sich von Tick zu Tick kaum.
//  - Alle 75 Ticks KIPPT jede Aktie mit 45 %: aus f wird 1 - f, gespiegelt.
// Der Filter fuehrt je Aktie eine Verteilung ueber s = f - 0,5 auf einem
// Gitter: je Tick ein kleiner Anteil gespiegelt (0,45/75), etwas Streuung,
// dann die Beobachtung (hoch mit 0,5 + s). Gemessen (2000 Laeufe je Staerke):
// der Schaetzfehler halbiert sich (0,04 statt 0,07), weil der Filter mehr als
// 30 Ticks Gedaechtnis hat, solange nichts kippt; starke Titel (|s| >= 0,15)
// dreht er nach einem Kippen in 7-13 Ticks statt 17. Schwache Titel dreht er
// NICHT schneller als das Fenster - der Gewinn kommt aus der Genauigkeit.
// Gerechnet (250 Mio ohne 4S, Median bis 45 Mrd): 9,6 h statt 12,0 h (48 Seeds,
// boerse-kurve.mjs); der Skeptiker mass mit 96 anderen Seeds 8,4 statt 10,0 h.
// Die neuen Schwellen (minTicks 10, Einstieg 0,03) gehoeren zum Filter - dem
// Fenster helfen sie nicht. Die
// Zyklusphase mitzuschaetzen oder die Startwerte der Aktien zu kennen bringt
// darueber hinaus nichts Messbares.
// ---------------------------------------------------------------------------
export const FILTER = { n: 61, smax: 0.45, kipp: 0.45 / 75, streu: 0.002, maxAltern: 150 };

/** Ein neuer Filter: keine Meinung (gleichverteilt). */
export function filterNeu() {
  return new Float64Array(FILTER.n).fill(1 / FILTER.n);
}

/**
 * Ein Kursschritt. `richtung` > 0: Kurs gestiegen, < 0: gefallen, 0: nichts
 * beobachtet (dann altert der Filter nur). Veraendert `w` und gibt es zurueck.
 */
export function filterSchritt(w, richtung) {
  const n = FILTER.n, h = FILTER.kipp, d = FILTER.streu;
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = (1 - h) * w[i] + h * w[n - 1 - i];
  for (let i = 0; i < n; i++) {
    const li = i > 0 ? a[i - 1] : a[i], re = i < n - 1 ? a[i + 1] : a[i];
    w[i] = (1 - 2 * d) * a[i] + d * (li + re);
  }
  // Nur ein echtes Vorzeichen ist eine Beobachtung (NaN altert nur).
  if (richtung > 0 || richtung < 0) {
    let z = 0;
    for (let i = 0; i < n; i++) {
      const s = -FILTER.smax + (2 * FILTER.smax * i) / (n - 1);
      w[i] *= richtung > 0 ? 0.5 + s : 0.5 - s;
      z += w[i];
    }
    if (z > 0) for (let i = 0; i < n; i++) w[i] /= z;
    else w.fill(1 / n);
  }
  return w;
}

/**
 * Wie viele Kursschritte seit dem letzten gesehenen NICHT beobachtet wurden
 * (Skeptiker 10.11.2026). Ein gedrosselter Tab sieht mehrere Schritte als
 * einen; der Filter muss fuer die verpassten trotzdem altern (Kippen und
 * Streuung laufen in Spielticks, nicht in Beobachtungen), sonst haelt er alte
 * Meinungen zu lange. Gedeckelt: nach einer langen Pause ist er ohnehin fast
 * ohne Meinung, und das Nachholen des Spiels tickt schneller als 6 s.
 */
export function verpassteSchritte(dtMs, taktMs) {
  if (!(dtMs > 0) || !(taktMs > 0)) return 0;
  return Math.max(0, Math.min(FILTER.maxAltern, Math.round(dtMs / taktMs) - 1));
}

/** Die geschaetzte Vorhersage f (Erwartungswert). */
export function filterMittel(w) {
  let m = 0;
  for (let i = 0; i < FILTER.n; i++) m += w[i] * (-FILTER.smax + (2 * FILTER.smax * i) / (FILTER.n - 1));
  return 0.5 + m;
}

const ertrag = (e) => (2 * e.f - 1) * e.mv;
const reif = (e, r) => e.quelle === "4S" || e.ticks >= r.minTicks;

/**
 * Was verkauft wird: alles, dessen Vorhersage unter 0,5 gefallen ist.
 * @param lage [{sym, f, mv, quelle, ticks, lang}]
 * @returns {string[]} Symbole
 */
export function verkaufsliste(lage, regel = REGEL) {
  return lage.filter((e) => e.lang > 0 && reif(e, regel) && e.f < 0.5).map((e) => e.sym);
}

/**
 * Was gekauft wird, aus dem Bargeld ueber der Reserve.
 * @param lage [{sym, f, mv, quelle, ticks, lang, ask, maxStueck}]
 * @returns {{sym:string, stueck:number}[]}
 */
export function kaufliste(lage, bar, reserve, regel = REGEL) {
  const kand = lage
    .filter((e) => reif(e, regel)
      // 1e-9: 0,575 - 0,5 ist in Gleitkomma 0,07499999999999996
      && e.f - 0.5 >= (e.quelle === "4S" ? regel.einstieg4S : regel.einstiegHistorie) - 1e-9)
    .sort((a, b) => ertrag(b) - ertrag(a));
  const aus = [];
  let frei = bar - Math.max(0, reserve || 0);
  const vermoegen = bar + depotwert(lage);
  for (const e of kand) {
    if (frei < regel.mindestPosten) break;
    let platz = (e.maxStueck ?? Infinity) - e.lang;
    if (regel.maxAnteil < 1) platz = Math.min(platz, Math.floor(regel.maxAnteil * vermoegen / e.ask) - e.lang);
    if (!(platz > 0) || !(e.ask > 0)) continue;
    const stueck = Math.min(platz, Math.floor((frei - KOMMISSION) / e.ask));
    if (stueck <= 0 || stueck * e.ask < regel.mindestPosten / 2) continue;
    aus.push({ sym: e.sym, stueck });
    frei -= stueck * e.ask + KOMMISSION;
  }
  return aus;
}

/**
 * Bargeld bereitstellen: die schwaechsten Posten zuerst, den letzten nur
 * anteilig. Liefert [] wenn das Bargeld reicht.
 * @param lage [{sym, f, mv, lang, bid}]
 * @returns {{sym:string, stueck:number}[]}
 */
export function freimachen(lage, bar, ziel) {
  let fehlt = ziel - bar;
  if (!(fehlt > 0)) return [];
  const posten = lage.filter((e) => e.lang > 0 && e.bid > 0).sort((a, b) => ertrag(a) - ertrag(b));
  const aus = [];
  for (const e of posten) {
    if (fehlt <= 0) break;
    const wert = e.lang * e.bid - KOMMISSION;
    if (wert <= fehlt) { aus.push({ sym: e.sym, stueck: e.lang }); fehlt -= wert; continue; }
    const stueck = Math.min(e.lang, Math.ceil((fehlt + KOMMISSION) / e.bid));
    aus.push({ sym: e.sym, stueck });
    fehlt = 0;
  }
  return aus;
}

/** Depotwert zum Geldkurs, Kommission je Posten abgezogen. */
export function depotwert(lage) {
  let w = 0;
  for (const e of lage) if (e.lang > 0) w += e.lang * e.bid - KOMMISSION;
  return w;
}

/** Soll die 4S-API jetzt gekauft werden? */
export function kauf4SFaellig(vermoegen, hat4S, schwelle = SCHWELLE_4S) {
  return !hat4S && vermoegen >= schwelle;
}
