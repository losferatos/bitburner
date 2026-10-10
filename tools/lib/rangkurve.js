/**
 * Referenzkurven fuer den Bladeburner-Rang - und warum eine lineare ETA hier
 * grundsaetzlich falsch ist.
 *
 * ===========================================================================
 * DER FEHLER, DEN DIESES MODUL BEHEBT
 * ===========================================================================
 *
 * `tools/checkin.js` rechnete die Restzeit als `(Zielrang - Rang) / Rate`. Am
 * 04.09.2026 ergab das fuer BitNode 10 eine Restzeit von **430,7 Tagen** bei
 * einem Urteil "AUF KURS". Der Auftrag veranschlagt fuer die GESAMTE Restroute
 * aus 40 Laeufen 46 bis 79 Tage.
 *
 * Der Beweis braucht kein Modell: der Bot hat diesen Knoten schon einmal
 * gefahren. Der Lauf liegt in `data/verlauf-strategie.json` und
 * `data/checkin.json`, und die erzeugte Kurve zeigt Raten von **12 bis 207.111
 * Rang je Stunde** - Faktor 17.294 innerhalb eines Laufs.
 *
 * Traeger ist nicht der Rang. `calculateActionRankGain` in
 * `Bladeburner/Formulas.ts` kennt den Spielerrang gar nicht; es skaliert die
 * AKTIONSSTUFE ueber `rewardFac^(level-1)`, und der Sprung kommt vom Wechsel
 * von Contracts auf Operations. Eine im Anlauf gemessene Rate beschreibt den
 * Startblock, nicht die Strecke.
 *
 * DERSELBE FEHLER STAND SCHON EINMAL HIER: `nodes/ERLEDIGT.md` vom 30.08.2026,
 * "gemessene Rangrate 42,5/h, also 334 Tage ... die lineare Fortschreibung
 * eines Post-Reset-Lochs auf einer Exponentialkurve". Er kam zurueck, weil er
 * damals im Bericht korrigiert wurde und nicht im Werkzeug.
 *
 * ===========================================================================
 * WAS EIN SKEPTIKER AN DER ERSTEN FASSSUNG FAND (04.09.2026 02:45)
 * ===========================================================================
 *
 * Die erste Fassung hatte die Stuetzpunkte als Zahlenliste im Code. Vier Fehler:
 *
 * 1. ZEILENVERSATZ. Der Punkt {h 21,39 / Rang 903} war falsch zusammengesetzt -
 *    bei h 21,39 stand der Rang bei 713, die 903 wurden erst bei h 25,13
 *    erreicht. Daraus errechnete die "falsifizierbare Probe" 169 Rang/h, wo
 *    45/h zu erwarten sind: ein eingebauter Fehlalarm.
 *    BEHOBEN, strukturell: die Kurve wird jetzt von
 *    `tools/rangkurve-bauen.js` aus den Rohdaten ERZEUGT (76 Stuetzpunkte statt
 *    16 abgeschriebener) und hier nur gelesen.
 *
 * 2. `min` WAR NICHT ERREICHBAR. Die untere Schranke stand auf "Zeit bis zum
 *    letzten gemessenen Punkt unter der Schwelle" - und der liegt bei Rang
 *    17.594, also 4,4 % des Ziels. Die Aussage "es koennen noch 27,7 h sein"
 *    behauptete, der Knoten koenne enden, waehrend 95,6 % des Rangs fehlen.
 *    BEHOBEN: die belastbare Zahl ist die Zeit bis zum KNOTENENDE des
 *    Referenzlaufs - gemessen, nicht rekonstruiert.
 *
 * 3. IN DIE LUECKE INTERPOLIERT. Zwischen Rang 17.594 (h 47,8) und 4,54 Mio
 *    (h 69,7) hat niemand gemessen. Die alte Fassung interpolierte trotzdem
 *    hinein; ab Rang 341.000 meldete sie "FERTIG VORAUSSICHTLICH: jetzt".
 *    Das haette 95,6 % des Restwegs betroffen und waere in ein bis zwei
 *    Spieltagen scharf geworden.
 *    BEHOBEN: innerhalb einer Messluecke wird die Unsicherheit ausgewiesen,
 *    nicht wegskaliert.
 *
 * 4. LOG-INTERPOLATION WAR SCHLECHTER ALS LINEAR. Gegenprobe des Skeptikers an
 *    den 59 ausgelassenen Messpunkten: mittlerer Fehler 0,548 h logarithmisch
 *    gegen 0,236 h linear, groesster Fehler 4,90 h gegen 1,37 h. Die Begruendung
 *    "die Groesse waechst multiplikativ" traegt nicht - die Rate ist stueckweise
 *    konstant und springt an Aktionsstufen, und genau das ist die Annahme der
 *    linearen Interpolation.
 *    BEHOBEN: linear. Mit 76 Stuetzpunkten sind die Abstaende ohnehin klein.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..", "..");

/**
 * Die Schwelle, ab der der Ausgang offensteht: Operation Daedalus verlangt
 * Rang 400.000 (`Bladeburner/data/BlackOperations.ts`), und diese Zahl
 * skaliert NICHT mit dem BitNode-Faktor.
 */
export const SCHWELLE = 400000;

const geladen = new Map();

function ladeKurve(knoten) {
  if (geladen.has(knoten)) return geladen.get(knoten);
  const p = path.join(ROOT, "doku", "rangkurve-bn" + knoten + ".json");
  let k = null;
  try {
    k = JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    k = null;
  }
  geladen.set(knoten, k);
  return k;
}

/**
 * Stunde, zu der der Referenzlauf diesen Rang erreichte - linear interpoliert.
 *
 * ACHTUNG, DIE KURVE IST NICHT ZWANGSLAEUFIG MONOTON. Der Bladeburner-Rang kann
 * SINKEN: eine fehlgeschlagene Aktion kostet `rankLoss`
 * (`Bladeburner.ts:1055-1059`, `changeRank(person, -1 * rankLoss)`). In der
 * BitNode-6-Kurve stehen zwei solche Rueckgaenge, beide dicht an der
 * 400.000er-Schwelle und beide ueber 5.000 Rang gross.
 *
 * Diese Suche nimmt das ERSTE Intervall, das den Rang einschliesst - also den
 * Aufstieg und nicht den Rueckweg. Das ist die richtige Wahl fuer eine
 * Restzeitschaetzung, aber es heisst auch: bei einer nicht-monotonen Kurve ist
 * die Zuordnung Rang zu Stunde nicht eindeutig, und die Zahl ist eine untere
 * Schranke.
 *
 * Fuer BitNode 10, die derzeit genutzte Kurve, spielt es keine Rolle: sie hat
 * 76 Punkte und null Rueckgaenge (geprueft 04.09.2026).
 */
function stundeBeiRang(punkte, rang) {
  if (rang <= punkte[0].rang) return punkte[0].h;
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = punkte[i];
    const b = punkte[i + 1];
    if (rang >= a.rang && rang <= b.rang) {
      if (b.rang === a.rang) return a.h;
      return a.h + ((rang - a.rang) / (b.rang - a.rang)) * (b.h - a.h);
    }
  }
  return null;
}

/**
 * Restzeit bis zum Knotenende, aus dem eigenen vorigen Lauf gelesen.
 *
 * (Bis 22.09.2026:) Bezugsgroesse war bewusst das ENDE DES REFERENZLAUFS und nicht der Zeitpunkt,
 * an dem die Rangschwelle fiel - jetzt der erste Punkt ueber der Schwelle, siehe unten. Der Grund ist ein Messloch: zwischen Rang
 * 17.594 und 4,54 Mio liegen 22 Stunden ohne einen einzigen Datenpunkt, weil
 * die sechs Beobachtungsloops am 31.08. abgeschafft wurden. Wann genau die
 * 400.000 fielen, ist damit unbekannt - wann der Lauf endete, ist gemessen.
 *
 * Die zurueckgegebene Zahl ist deshalb konservativ: sie enthaelt den Nachlauf
 * nach der Schwelle (die 21 Black Ops muessen auch gewonnen werden). Das ist
 * die richtige Richtung fuer eine Planung.
 *
 * @returns {{restH, bisSchwelleFruehestensH, ende, hJetzt, luecke, quelle}|null}
 */
export function restzeitAusKurve(knoten, rang) {
  const k = ladeKurve(knoten);
  if (!k || !Array.isArray(k.punkte) || k.punkte.length < 2) return null;
  if (!Number.isFinite(rang) || rang < 0) return null;

  const p = k.punkte;
  const ende = p[p.length - 1];
  const hJetzt = stundeBeiRang(p, rang);
  if (hJetzt === null) return null;

  // Liegt der Rang in einer Messluecke? Als Luecke gilt ein Abstand von mehr
  // als zwei Stunden zwischen zwei Stuetzpunkten - dort ist jede Interpolation
  // eine Behauptung.
  let luecke = null;
  for (let i = 0; i < p.length - 1; i++) {
    if (rang >= p[i].rang && rang <= p[i + 1].rang && p[i + 1].h - p[i].h > 2) {
      luecke = { vonH: p[i].h, bisH: p[i + 1].h, vonRang: p[i].rang, bisRang: p[i + 1].rang };
      break;
    }
  }

  // Die frueheste Stunde, zu der die Schwelle gefallen sein KANN: der letzte
  // gemessene Punkt unter ihr. Das ist eine harte Untergrenze, kein Schaetzwert.
  let letzterDarunter = p[0];
  for (const q of p) if (q.rang < SCHWELLE) letzterDarunter = q;

  // BEZUG IST DIE SCHWELLE, NICHT DAS LAUFENDE (22.09.2026, BAUSTELLEN
  // "ETA-Kurve rechnet gegen das Laufende"). Der Referenzlauf BN10 L1 lief
  // bis Rang 4,56 Mio, weil der Sprung damals von Hand kam - gebraucht werden
  // 400.000. Genommen wird jetzt der erste gemessene Punkt ueber der
  // Schwelle; liegt er in einer Messluecke, faellt er mit dem Laufende
  // zusammen, und `luecke` sagt das. Der Nachlauf danach steht getrennt.
  const ersterDrueber = p.find((q) => q.rang >= SCHWELLE) || ende;
  return {
    restH: Math.max(0, ersterDrueber.h - hJetzt),
    nachlaufH: Math.max(0, ende.h - ersterDrueber.h),
    bisSchwelleFruehestensH: Math.max(0, letzterDarunter.h - hJetzt),
    schwelleZuletztUnterschritten: { h: letzterDarunter.h, rang: letzterDarunter.rang },
    ende: { h: ende.h, rang: ende.rang },
    hJetzt,
    luecke,
    stuetzpunkte: p.length,
    quelle: "doku/rangkurve-bn" + knoten + ".json, erzeugt " + (k.erzeugtAm || "?"),
  };
}

/**
 * Wie schnell laeuft der aktuelle Lauf gegen den Referenzlauf an derselben
 * Rangstelle? Werte unter 1 heissen schneller.
 *
 * DAS IST DIE EIGENTLICH WICHTIGE ZAHL. Die Restzeit oben ist eine reine
 * Funktion des Rangs - ein Lauf, der zehnmal langsamer ist, bekommt exakt
 * dieselbe Restzeit gemeldet, nur ueber mehr Kalenderzeit verteilt. Erst
 * dieser Vergleich merkt, dass etwas nicht stimmt.
 *
 * Der Skeptiker fand am 04.09., dass die Funktion zwar gebaut, aber nirgends
 * aufgerufen war. Sie ist jetzt in checkin.js angeschlossen.
 */
export function vergleichMitReferenz(knoten, rang, hSeitKnotenstart) {
  const r = restzeitAusKurve(knoten, rang);
  if (!r || !Number.isFinite(hSeitKnotenstart) || hSeitKnotenstart <= 0) return null;
  // Beide Seiten ab KNOTENSTART (10.10.2026). Die Kurve zaehlt ab ihrem ersten
  // Rangpunkt; ohne bekannten Abstand dorthin gibt es keinen ehrlichen
  // Vergleich - lieber keiner als ein falsches ZAEH.
  const k = ladeKurve(knoten);
  const off = k && k.nullpunkt ? Number(k.nullpunkt.hSeitKnotenstart) : NaN;
  if (!Number.isFinite(off) || off < 0) return null;
  const hRef = r.hJetzt + off;
  if (hRef <= 0) return null;
  return {
    faktor: hSeitKnotenstart / hRef,
    hJetzt: hSeitKnotenstart,
    hReferenz: hRef,
  };
}

/**
 * Der naechste Meilenstein - fuer eine Vorhersage, die beim naechsten Besuch
 * ueberprueft werden kann.
 *
 * Es wird bewusst ein Punkt gesucht, der mindestens eine Stunde entfernt liegt:
 * die Rate zwischen zwei dicht beieinanderliegenden Messungen schwankt mit der
 * Ausdauerphase und taugt nicht als Erwartung. Genau daran scheiterte die erste
 * Fassung, die aus einem falschen Stuetzpunkt 169 Rang/h ableitete.
 */
export function naechsterMeilenstein(knoten, rang) {
  const k = ladeKurve(knoten);
  if (!k) return null;
  const p = k.punkte;
  const hJetzt = stundeBeiRang(p, rang);
  if (hJetzt === null) return null;

  for (const q of p) {
    if (q.rang > rang && q.h - hJetzt >= 1) {
      return {
        rang: q.rang,
        hAbBeginn: q.h,
        inH: q.h - hJetzt,
        rateDorthin: (q.rang - rang) / (q.h - hJetzt),
      };
    }
  }
  return null;
}
