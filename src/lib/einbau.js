/**
 * Reine Entscheidungsfunktionen fuer den Einbau- und Spendenweg in bn4rep.js.
 *
 * ===========================================================================
 * WARUM EIN EIGENES MODUL, OHNE JEDEN IMPORT
 * ===========================================================================
 *
 * Audit "perfekter Bot" (26.09.2026, nodes/audit-2026-09-26/3-progression.md,
 * 1-bitnode-regeln.md #3, 6-orchestrierung.md #1) hat sieben Fehlausloeser in
 * bn4rep.js gefunden, jeder davon eine reine Rechnung ueber Zahlen und Flags -
 * keiner braucht `ns`. Bisher standen sie mitten im 2000-Zeilen-Hauptlauf und
 * liessen sich nur mit einem vollen Spielmock pruefen. Hier stehen sie
 * einzeln, ohne jeden Import (auch nicht `lib/hackaugs.js`) - damit ein Test
 * sie mit reinen Zahlen aufruft, ohne einen Lader zu brauchen, der
 * bare-specifier-Importe fuer den Pruefstand umschreibt (siehe
 * `tools/mock/lader.js`, Grund fuer den Umweg bei anderen lib/-Dateien).
 *
 * bn4rep.js bleibt der einzige Aufrufer und reicht fertige Zahlen herein
 * (z.B. `wert` aus `levelNutzen`/`combatNutzen`, die dort schon importiert
 * sind) statt diese Funktionen selbst zu importieren.
 */

/**
 * A2/A7 (BN12-Korrektheit): FactionWorkRepGain aus den echten
 * BitNode-Multiplikatoren, nicht aus einer statischen Tabelle.
 *
 * Bot vorher (bn4rep.js ~:164, :1283, :1753): eine Handtabelle ohne Eintrag
 * fuer BitNode 12, Rueckfall 1 - laut Kommentar "sicherer Wert 1", tatsaechlich
 * IST FALSCHE RICHTUNG: BitNode 12 setzt FactionWorkRepGain = 1/1,02^Stufe
 * (< 1), der Rueckfall 1 macht die Spende also zu GROSS geschaetzt, nicht zu
 * klein - `donateToFaction` liefert dann zu wenig Reputation und der
 * Folgekauf schlaegt fehl (Audit 3#7, belegt: BN12.2 0,9804, BN12.3 0,9612).
 *
 * `bnMults` ist das Ergebnis von `ns.getBitNodeMultipliers()` (SF5, live) oder
 * `null`, wenn der Aufruf fehlschlaegt (kein SF5, Netzwerkhicks). Nur dann
 * greift die Tabelle - und nur fuer die Knoten, die ueberhaupt einen Wert
 * ungleich 1 setzen (BitNode.tsx).
 *
 * @param {{FactionWorkRepGain?: number}|null} bnMults
 * @param {number} knoten aktueller BitNode
 * @param {Record<number, number>} fallbackTabelle
 * @returns {number}
 */
export function donationRepGainFaktor(bnMults, knoten, fallbackTabelle) {
  const live = bnMults && Number(bnMults.FactionWorkRepGain);
  if (Number.isFinite(live) && live > 0) return live;
  return (fallbackTabelle && fallbackTabelle[knoten]) || 1;
}

/**
 * A3: Daedalus-Schwelle live lesen statt fest 30 (BitNode 12 verlangt 31,
 * BitNode 6/7 verlangen 35, BitNode 15 verlangt 20 - BitNode.tsx).
 *
 * @param {{DaedalusAugsRequirement?: number}|null} bnMults
 * @param {number} knoten
 * @param {Record<number, number>} fallbackTabelle
 * @param {number} [fallbackWert] Setzung, wenn weder live noch Tabelle greifen
 * @returns {number}
 */
export function daedalusSchwelle(bnMults, knoten, fallbackTabelle, fallbackWert = 30) {
  const live = bnMults && Number(bnMults.DaedalusAugsRequirement);
  if (Number.isFinite(live) && live > 0) return live;
  const t = fallbackTabelle && fallbackTabelle[knoten];
  return Number.isFinite(t) ? t : fallbackWert;
}

/**
 * A3, zweiter Teil: gezaehlt wird wie im Spiel
 * (`FactionJoinCondition.ts haveAugmentations`: `p.augmentations.length >= n`,
 * also nur INSTALLIERTE Augmentierungen). NeuroFlux Governor steht dort so wie
 * in `Player.augmentations` immer als GENAU EIN Eintrag (`applyAugmentation`,
 * `AugmentationHelpers.ts`: erste Installation `push`t, jede weitere Stufe
 * aktualisiert nur `ownedNfg.level`) - `eingebauteAugs.length`
 * (`getOwnedAugmentations(false)`) liefert also bereits die richtige Zahl,
 * ohne eigene Entdopplung. Der Bot zaehlte bisher `alleAugs.length`
 * (`getOwnedAugmentations(true)`), das JEDE gekaufte, noch nicht eingebaute
 * NFG-Stufe als eigenen Eintrag mitzaehlt (`queueAugmentation`,
 * `PlayerObjectGeneralMethods.ts:490-496`, NFG ist von der
 * Mehrfach-Sperre ausdruecklich ausgenommen).
 *
 * @param {number} installierteZahl eingebauteAugs.length
 * @param {number} schwelle Ergebnis von daedalusSchwelle()
 * @returns {0|1}
 */
export function zaehlplatzWert(installierteZahl, schwelle) {
  return installierteZahl < schwelle ? 1 : 0;
}

/**
 * A4: Ist das Spendenrecht faellig (Favor erreicht die Donation-Schwelle) und
 * liegt nichts in der Warteschlange, wartet der Bot bisher auf ein zufaellig
 * verdientes Stueck - belegt 37 min Stillstand in BN5.2 (Audit 3#2). Diese
 * Funktion sagt nur "jetzt ist der Moment, das billigste kaufbare Stueck oder
 * eine NFG-Stufe zu erzwingen" - das Kaufen selbst bleibt in bn4rep.js, weil
 * es `ns` braucht.
 *
 * @param {{spendenrechtFaellig: boolean, wartend: number}} p
 * @returns {boolean}
 */
export function sollFuellstueckSofortKaufen({ spendenrechtFaellig, wartend }) {
  return !!spendenrechtFaellig && wartend === 0;
}

/**
 * A6: The Red Pill in der Warteschlange (gekauft, nicht eingebaut) erzwingt
 * einen Einbau unabhaengig von der Mindestwarteschlange und vom Spendenrecht -
 * ohne Einbau haengt w0r1d_d43m0n nie am Netz (Prestige.ts:173-181), und ohne
 * diese Ausnahme kann der Bot beliebig lange an Fuellstuecken vorbeiarbeiten
 * (Audit 3#4).
 *
 * @param {string[]} alleAugs getOwnedAugmentations(true) - gekauft, auch wartend
 * @param {string[]} eingebauteAugs getOwnedAugmentations(false) - installiert
 * @param {string} exitKey "The Red Pill"
 * @returns {boolean}
 */
export function redPillWartetAufEinbau(alleAugs, eingebauteAugs, exitKey) {
  return alleAugs.includes(exitKey) && !eingebauteAugs.includes(exitKey);
}

/**
 * A5, gemeinsamer Kern fuer `naechstesUnbezahlbar` und `geldWegZu`: eine
 * Investitionsfrage - lohnt Warten oder ein sofortiger Einbau -, geprueft
 * gegen Kassenstand PLUS Zufluss ueber einen kurzen Horizont, statt gegen den
 * Kassenstand allein direkt nach einer eigenen Spende.
 *
 * Bot vorher (bn4rep.js :754,:777): `preis > geld * 4` unmittelbar nach einer
 * Spende an dieselbe Faktion, die das Konto gerade geleert hat - das Konto
 * ist dann klein, obwohl in Sekunden wieder Geld da waere (Audit 3#3, drei
 * belegte Vorfaelle, 10-22 min Stillstand + Wiederbeitritt je Vorfall).
 *
 * Zwei Bremsen dagegen:
 *   - `wertlosGilt`: nur Stuecke mit echtem Nutzen (hacking- oder in
 *     Kampfknoten Kampf-Wert, siehe `lib/hackaugs.js`) duerfen ueberhaupt
 *     einen Einbau ausloesen (Audit 3#3 nennt Magnetism Amplifier und
 *     LuminCloaking-V1 als wertlose Ausloeser).
 *   - `spendetGeradeAnSchwellenfaktion`: waehrend gerade fuer eine Faktion
 *     mit Favor >= Spendenschwelle gespendet wird, ist ein leeres Konto kein
 *     Zeitproblem, sondern die Ursache selbst - die Pruefung setzt in dieser
 *     Phase ganz aus (letzte Spende < 2 Runden her, siehe bn4rep.js).
 *
 * @param {object} p
 * @param {number} p.preis Kaufpreis des betrachteten Stuecks
 * @param {boolean} p.wertlosGilt true, wenn das Stueck KEINEN echten Nutzen hat
 * @param {number} p.geld aktuelles Guthaben
 * @param {number} p.einkommenProSek gemessener, nie-negativer Zufluss
 * @param {number} p.horizontSek wie weit vorausgeschaut wird
 * @param {boolean} p.spendetGeradeAnSchwellenfaktion
 * @returns {boolean} true = Warten lohnt nicht, ein Einbau darf ausgeloest werden
 */
export function unbezahlbarInHorizont({
  preis, wertlosGilt, geld, einkommenProSek, horizontSek, spendetGeradeAnSchwellenfaktion,
}) {
  if (spendetGeradeAnSchwellenfaktion) return false;
  if (wertlosGilt) return false;
  if (!(preis > 0)) return false;
  const projiziert = geld + Math.max(0, einkommenProSek) * horizontSek;
  return preis > projiziert;
}

/**
 * A1: Waehrend die Figur schon fuer die Zielfaktion arbeitet, aber gerade
 * nicht fokussiert ist, lohnt sich `setFocus(true)` - ausser das Neuroreceptor
 * Management Implant ist schon (auch nur gekauft) vorhanden, dann hebt das
 * Spiel die Fokusstrafe unabhaengig vom Fokus ganz auf
 * (`PlayerObjectGeneralMethods.ts:622-628`, `hasAugmentation(..., true)`
 * zaehlt die Warteschlange mit) und ein `setFocus`-Aufruf waere nur
 * DOM-Umschalten ohne Ratengewinn.
 *
 * Bot vorher: kein Aufruf von `isFocused`/`setFocus` in der ganzen Datei -
 * jede Navigation weg von der Arbeitsseite (`darkweb.js` alle 5 min, solange
 * ein Portprogramm fehlt) loescht den Fokus, und niemand holt ihn zurueck.
 * Belegt in BN5.2: 14 von 25 stuendlichen Sicherungen mit laufender
 * Faktionsarbeit standen auf `focus:false`, bis zu 3,8 h am Stueck (Audit
 * 3#1, doppelt in 6#1: Ursache dort naeher belegt).
 *
 * `ns.singularity.isFocused()`/`setFocus(true)` bleiben in bn4rep.js - diese
 * Funktion entscheidet nur, OB der Aufruf sich lohnt, damit die Entscheidung
 * ohne Spielmock testbar ist.
 *
 * @param {object} p
 * @param {boolean} p.arbeitetSchon Faktionsarbeit fuer das aktuelle Ziel laeuft
 * @param {boolean} p.istFokussiert `ns.singularity.isFocused()`
 * @param {boolean} p.hatNmi Neuroreceptor Management Implant besessen (auch gekauft)
 * @returns {boolean}
 */
export function sollFokusZurueckholen({ arbeitetSchon, istFokussiert, hatNmi }) {
  return !!arbeitetSchon && !istFokussiert && !hatNmi;
}

/**
 * A7: `favorLohnt` darf nur Faktionen zaehlen, bei denen Favor noch etwas
 * bringt. Ab der Spendenschwelle ist Reputation dort schon eine reine
 * Geldfrage (Favor wirkt nur auf die ARBEITSRATE, `reputation.ts:8-14`,
 * Spenden haengt nicht von Favor ab, `donation.ts:8-10`), und ist der Katalog
 * leer, gibt es nichts mehr, das eine hoehere Rate abholen koennte.
 *
 * Bot vorher (bn4rep.js :997-1008): jede Faktion mit >= 1000 Reputation zaehlt,
 * unabhaengig von beidem - haeufigster Einbaugrund im Audit (21 von 31
 * Einbauten in den drei Vergleichslaeufen, Audit 3#5).
 *
 * @param {object} p
 * @param {number} p.favorJetzt
 * @param {number} p.spendenSchwelle ns.getFavorToDonate()
 * @param {boolean} p.hatUnbesessenesWertvollesStueck mindestens ein Stueck
 *   dieser Faktion, das weder besessen noch wertlos ist
 * @returns {boolean}
 */
export function favorZaehltFuerFaktion({ favorJetzt, spendenSchwelle, hatUnbesessenesWertvollesStueck }) {
  return favorJetzt < spendenSchwelle && !!hatUnbesessenesWertvollesStueck;
}
