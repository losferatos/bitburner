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
 * (z.B. die Werte-Tabelle `HACK_AUGS` oder `combatNutzen` aus
 * `lib/hackaugs.js`, die dort schon importiert sind) statt diese Funktionen
 * selbst zu importieren.
 *
 * SKEPTIKER-NACHARBEIT (26.09.2026, nodes/audit-2026-09-26/skeptiker-A.md):
 * Einkommen aus dem Spiel statt aus Rundendifferenzen, Horizontregel nie
 * strenger als die alte 4x-Regel, Wertmass ohne Firmenruf, Spendenpause in
 * Wandzeit, Fuellstueck nur unter den Einbau-Vorbedingungen, Fokus mit
 * Karenz und NMI nur eingebaut. Die Begruendung steht je Funktion.
 */

/**
 * A2/A7 (BN12-Korrektheit): FactionWorkRepGain aus den echten
 * BitNode-Multiplikatoren, nicht aus einer statischen Tabelle.
 *
 * Bot vorher (bn4rep.js ~:164, :1283, :1753): eine Handtabelle ohne Eintrag
 * fuer BitNode 12, Rueckfall 1. BitNode 12 setzt FactionWorkRepGain =
 * 1/1,02^Stufe (< 1). `donationForRep` teilt durch diesen Faktor
 * (`Faction/formulas/donation.ts:12-14`) - mit 1 statt 0,98 wird die Spende
 * also ZU KLEIN geschaetzt, sie bringt zu wenig Reputation, und der
 * Folgekauf schlaegt fehl (Audit 3#7, belegt: BN12.2 0,9804, BN12.3 0,9612).
 * (Bis zur Skeptiker-Nacharbeit stand hier "zu gross" - die Richtung war
 * vertauscht, der Test sagte es richtig.)
 *
 * `bnMults` ist das Ergebnis von `ns.getBitNodeMultipliers()` (SF5, live) oder
 * `null`, wenn der Aufruf fehlschlaegt (kein SF5). Nur dann greift die
 * Tabelle - und nur fuer die Knoten, die ueberhaupt einen Wert ungleich 1
 * setzen (BitNode.tsx).
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
 * H2 (BN12-Korrektheit, nodes/audit-2026-09-26/bn12-bericht.md, MINOR #3):
 * `daedalusSchwelle()` liest die Anforderung jetzt live (A3), aber nur die
 * ZIELWAHL (`zaehlplatzWert`) nutzte sie bisher - der Einbau-Ausloeser
 * (unten in bn4rep.js) fragte gar nicht, wie viele Stuecke DIESER Einbau
 * am Ende zaehlt. Landet er genau bei schwelle-1 installierten Stuecken
 * (Zaehlung wie im Spiel, siehe `zaehlplatzWert`), laedt Daedalus nicht ein
 * - der Bot braucht einen ganzen weiteren Zyklus (~1,7 h im Schnitt) fuer
 * die letzte fehlende Stufe. In BN5 (Schwelle 30) kam dieser Fall in den
 * Audit-Laeufen nie vor; bei BN12 (Schwelle 31, ungerade gegen die ueblichen
 * Rundzahlen) ist er nicht mehr nur theoretisch.
 *
 * `distinktNachEinbau` ist die Zahl UNTERSCHIEDLICHER Stuecke, die dieser
 * Einbau am Ende zaehlt - also `new Set(getOwnedAugmentations(true)).size`:
 * installierte plus wartende, NFG dort ausdruecklich nur einmal (wie
 * `zaehlplatzWert` oben begruendet).
 *
 * @param {number} installiert eingebauteAugs.length (vor diesem Einbau)
 * @param {number} distinktNachEinbau Zahl unterschiedlicher Stuecke nach diesem Einbau
 * @param {number} schwelle Ergebnis von daedalusSchwelle()
 * @returns {boolean} true = vor dem Einbau erst versuchen, ein weiteres Stueck zu kaufen
 */
export function einbauLandetEinsUnterSchwelle(installiert, distinktNachEinbau, schwelle) {
  if (!(installiert < schwelle)) return false;
  return distinktNachEinbau === schwelle - 1;
}

/**
 * H2, zweiter Teil: welches Stueck fuer den Zusatzplatz versucht wird, wenn
 * `einbauLandetEinsUnterSchwelle()` true meldet. Reine Auswahl - das Kaufen
 * selbst (`ns.singularity.purchaseAugmentation`, ggf. Spenden fuer NFG-Rep)
 * bleibt in bn4rep.js, dort stehen die bestehenden Kaufpfade schon (Zeile
 * um die NFG-Schleife und die Fuellstueck-Logik).
 *
 * Reihenfolge: zuerst das billigste kaufbare Stueck mit erfuellter
 * Reputation (`kandidaten` wird vom Aufrufer schon auf "Rep erfuellt,
 * bezahlbar, nicht schon besessen" gefiltert erwartet, hier zur Sicherheit
 * nochmal geprueft) - das ist ein zusaetzlicher DISTINCT-Platz ohne
 * Nebenwirkung. Erst wenn keins kaufbar ist und NFG weder installiert noch
 * in der Warteschlange steht, gilt eine erste NFG-Stufe als Fallback (sie
 * zaehlt als GENAU EIN Distinct-Platz, egal wie viele Stufen spaeter
 * dazukommen). Ist nichts davon moeglich, liefert die Funktion `null` - der
 * Aufrufer baut dann trotzdem ein, damit der Bot nie haengen bleibt.
 *
 * @param {{aug:string, preis:number, rep:number, repReq:number}[]} kandidaten
 * @param {boolean} nfgVorhanden NFG bereits installiert ODER in der Warteschlange
 * @returns {{typ:"stueck", aug:string}|{typ:"nfg"}|null}
 */
export function waehleDaedalusFuellstueck(kandidaten, nfgVorhanden) {
  const liste = Array.isArray(kandidaten) ? kandidaten : [];
  const kaufbar = liste
    .filter((k) => k.rep >= k.repReq && Number(k.preis) >= 0)
    .sort((a, b) => a.preis - b.preis)[0];
  if (kaufbar) return { typ: "stueck", aug: kaufbar.aug };
  if (!nfgVorhanden) return { typ: "nfg" };
  return null;
}

/**
 * A4: Ist das Spendenrecht faellig (Favor erreicht die Donation-Schwelle) und
 * liegt nichts in der Warteschlange, wartet der Bot bisher auf ein zufaellig
 * verdientes Stueck - belegt 37 min Stillstand in BN5.2 (Audit 3#2). Diese
 * Funktion sagt nur "jetzt ist der Moment, eine NFG-Stufe zu erzwingen" - das
 * Kaufen selbst bleibt in bn4rep.js, weil es `ns` braucht.
 *
 * NUR UNTER DEN EINBAU-VORBEDINGUNGEN (Skeptiker-Einwand 3). Die Stufe ist
 * kein Selbstzweck, sie soll in der naechsten Runde den Spendenrecht-Einbau
 * oeffnen (`spendenAusnahme` in bn4rep.js). Wo dieser Einbau nicht kommen
 * kann, ist sie nur ein Aufschlag x1,9 auf jedes weitere Stueck des Zyklus
 * (`AugmentationHelpers.ts:29-37`):
 *   - Kampfknoten: `spendenAusnahme` verlangt dort 3 wartende Stuecke, und
 *     NFG verkuerzt den Wiederaufbau nicht allein;
 *   - The Red Pill eingebaut (`ausgangSteht`): ab da baut bn4rep nie mehr
 *     ein, die Stufe laege fuer immer in der Warteschlange;
 *   - Einbausperre aktiv (`gesperrt`): dieselbe Runde koennte gar nicht
 *     einbauen.
 * Fehlt ein Parameter, gilt er als erfuellt-dagegen (sperrend) - ein
 * vergessener Aufrufer soll nichts kaufen.
 *
 * @param {{spendenrechtFaellig: boolean, wartend: number, ausgangSteht?: boolean,
 *   kampfKnoten?: boolean, gesperrt?: boolean}} p
 * @returns {boolean}
 */
export function sollFuellstueckSofortKaufen({
  spendenrechtFaellig, wartend, ausgangSteht, kampfKnoten, gesperrt,
}) {
  if (ausgangSteht !== false || kampfKnoten !== false || gesperrt !== false) return false;
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
 * Skeptiker-Einwand 1: das Einkommen aus dem Spiel lesen statt aus
 * Rundendifferenzen schaetzen.
 *
 * Die erste Fassung mass `geld(Runde) - geld(Vorrunde)` und startete bei 0.
 * In der ERSTEN Runde nach jedem (Neu)Start war die Horizontregel damit
 * `preis > geld` - strenger als die alte 4x-Regel; nachgerechnet feuerte das
 * in allen drei belegten Staenden (BN5.2 16:57, 19:03, BN1.3 00:23), bei 19:03
 * sogar dort, wo die alte Regel still blieb.
 *
 * `ns.getTotalScriptIncome()` liefert `[laufend, seitEinbau]`
 * (`NetscriptFunctions.ts:1240-1251`). Genommen wird der ZWEITE Wert,
 * `scriptProdSinceLastAug / playtimeSinceLastAug`: der erste summiert nur
 * gerade LAUFENDE Skripte, und die Hack-Arbeiter dieses Bots sind Einmalskripte
 * (`worker/hack.js`: ein `ns.hack`, dann Ende) - wer noch laeuft, hat noch
 * nichts verdient. Der zweite ist sofort nach dem Start gueltig, kennt keine
 * Aufwaermrunde und wird von eigenen Spenden und Kaeufen nicht verzerrt. Er ist
 * ein Mittel ueber den Zyklus und unterschaetzt das Einkommen eher (es waechst
 * im Zyklus) - die sichere Richtung, weil die Regel damit hoechstens auf die
 * alte 4x-Regel zurueckfaellt (siehe `unbezahlbarInHorizont`).
 *
 * @param {unknown} ergebnis Rueckgabe von ns.getTotalScriptIncome()
 * @returns {number} nie-negatives Einkommen in $/s, 0 bei unlesbarem Wert
 */
export function einkommenAusScriptIncome(ergebnis) {
  const seitEinbau = Array.isArray(ergebnis) ? Number(ergebnis[1]) : NaN;
  return Number.isFinite(seitEinbau) && seitEinbau > 0 ? seitEinbau : 0;
}

/**
 * A5, gemeinsamer Kern fuer `naechstesUnbezahlbar` und `geldWegZu`: lohnt
 * Warten oder ein sofortiger Einbau?
 *
 * Bot vorher (bn4rep.js :754,:777): `preis > geld * 4` unmittelbar nach einer
 * Spende an dieselbe Faktion, die das Konto gerade geleert hat - das Konto
 * ist dann klein, obwohl in Sekunden wieder Geld da waere (Audit 3#3, drei
 * belegte Vorfaelle, 10-22 min Stillstand + Wiederbeitritt je Vorfall).
 *
 * NIE STRENGER ALS DIE ALTE REGEL (Skeptiker-Einwaende 1 und 6). Unbezahlbar
 * ist ein Stueck nur, wenn es mehr kostet als BEIDES: das Vierfache des
 * Kontos (die alte, am 22.08. gemessene Regel) UND Konto plus Zufluss ueber
 * den Horizont. Die erste Fassung nahm nur den Horizont - bei hohem Konto
 * (BN5.2 15:12: 41,12 Mrd, 96,8 Mio/s) lag ihre Schwelle bei 99,2 Mrd statt
 * 164,5 Mrd, sie baute also dort ein, wo die alte Regel hoechstens 21 min
 * gewartet haette. Mit dem Maximum gilt: wo die alte Regel still war, bleibt
 * die neue still; sie schweigt zusaetzlich nur dort, wo der Zufluss das Stueck
 * binnen Horizont bezahlt.
 *
 * `spendetGeradeAnSchwellenfaktion`: waehrend fuer eine Faktion mit Favor >=
 * Spendenschwelle gespendet wird, ist ein leeres Konto kein Zeitproblem,
 * sondern die Ursache selbst - die Pruefung setzt dann ganz aus (siehe
 * `spendePausiert`).
 *
 * Der fruehere Parameter `wertlosGilt` ist entfallen: er war an beiden
 * Aufrufstellen fest `false`. Gefiltert wird vorher, in
 * `waehleEinbauGeldziele`, mit `istEinbauWertvoll`.
 *
 * @param {object} p
 * @param {number} p.preis Kaufpreis des betrachteten Stuecks
 * @param {number} p.geld aktuelles Guthaben
 * @param {number} p.einkommenProSek Zufluss (einkommenAusScriptIncome)
 * @param {number} p.horizontSek wie weit vorausgeschaut wird
 * @param {boolean} p.spendetGeradeAnSchwellenfaktion
 * @param {number} [p.altFaktor] die alte Regel, Vorgabe 4
 * @returns {boolean} true = Warten lohnt nicht, ein Einbau darf ausgeloest werden
 */
export function unbezahlbarInHorizont({
  preis, geld, einkommenProSek, horizontSek, spendetGeradeAnSchwellenfaktion, altFaktor = 4,
}) {
  if (spendetGeradeAnSchwellenfaktion) return false;
  if (!(preis > 0)) return false;
  const konto = Math.max(0, Number(geld) || 0);
  const zufluss = Math.max(0, Number(einkommenProSek) || 0) * Math.max(0, Number(horizontSek) || 0);
  return preis > Math.max(altFaktor * konto, konto + zufluss);
}

/**
 * Skeptiker-Einwand 9: die Spendenpause in WANDZEIT statt in Runden.
 *
 * Die erste Fassung setzte "letzte Spende < 2 Runden her". Spendenrunden
 * enden aber mit `sleep(1000); continue`, Kaufrunden mit `sleep(2000);
 * continue` - zwei Runden sind damit oft nur 1-3 s. Belegt im Log BN5.2:
 * Spende 19:02:50, stille Folgerunde, Kauf 19:03:06, Einbaupruefung 19:03:08
 * = drei Runden spaeter, die Pause war vorbei, obwohl die Spendenphase lief.
 * 60 s decken den Takt der Spendenphase (eine Spende je ~16 s) sicher ab.
 *
 * @param {number|null} letzteSpendeMs Wandzeit der letzten eigenen Spende
 * @param {number} jetztMs
 * @param {number} [pauseMs]
 * @returns {boolean}
 */
export const SPENDE_PAUSE_MS = 60000;
export function spendePausiert(letzteSpendeMs, jetztMs, pauseMs = SPENDE_PAUSE_MS) {
  if (!Number.isFinite(letzteSpendeMs)) return false;
  const seit = jetztMs - letzteSpendeMs;
  return seit >= 0 && seit < pauseMs;
}

/**
 * Skeptiker-Einwand 2: ein eigenes Wertmass fuer Einbauentscheidungen.
 *
 * Die erste Fassung nahm `levelNutzen(...) > 0`. Das zaehlt `company_rep` mit
 * halbem Gewicht (`lib/hackaugs.js`) - Magnetism Amplifier (nur company_rep)
 * galt damit als wertvoll (0,0477), obwohl der Audit ihn als ersten
 * wertlosen Ausloeser nennt (BN1.3 21:54). Umgekehrt gab es fuer ENM Direct
 * Memory Access (hacking_money 1,4, hacking_chance 1,2) 0 - in einem
 * Hackingknoten ist Geld aber Spendenmacht und damit Reputation.
 *
 * Wertvoll fuer einen Einbau ist hier, was den Knoten schneller abschliesst:
 * Hacking-Level und -Tempo, Hack-Ertrag und Faktionsruf. Firmenruf und
 * Charisma nicht (die Firmenphase ist ein Einmalposten fuer den
 * Backdoor-Rabatt, keine Einbaufrage). Im Kampfknoten zaehlt zusaetzlich
 * `combatNutzen` (vom Aufrufer gereicht). The Red Pill zaehlt immer.
 *
 * Der Zaehlplatz Richtung Daedalus zaehlt hier bewusst NICHT: er gehoert zur
 * Zielwahl waehrend der Arbeit, nicht zur Frage, ob ein unbezahlbares Stueck
 * einen Einbau rechtfertigt. Die Kaufschleife und die Geldreserve bleiben
 * ungefiltert - vor der Daedalus-Schwelle zaehlt jedes Stueck als Platz.
 *
 * @param {object} p
 * @param {string} p.aug Name der Augmentierung
 * @param {Record<string, number>|undefined} p.stats Eintrag aus HACK_AUGS
 * @param {string} p.exitKey "The Red Pill"
 * @param {number} [p.kampfNutzen] combatNutzen(aug), nur im Kampfknoten > 0
 * @returns {boolean}
 */
export const EINBAU_WERT_MULTS = [
  "hacking", "hacking_exp", "hacking_speed", "hacking_chance",
  "hacking_money", "hacking_grow", "faction_rep",
];
export function istEinbauWertvoll({ aug, stats, exitKey, kampfNutzen = 0 }) {
  if (aug === exitKey) return true;
  if (Number(kampfNutzen) > 0) return true;
  if (!stats) return false;
  return EINBAU_WERT_MULTS.some((k) => Number(stats[k]) > 1);
}

/**
 * Die beiden Geldziele der Einbauentscheidung, mit demselben Wertmass:
 *   - `naechstes`: das wertvolle, noch nicht verdiente Stueck mit der
 *     kleinsten Reputationsluecke;
 *   - `teuerstesVerdienteWertvoll`: der hoechste Preis unter den verdienten,
 *     wertvollen Stuecken (0, wenn keins).
 *
 * @param {{aug: string, rep: number, repReq: number, preis: number}[]} kandidaten
 * @param {(k: object) => boolean} istWertvoll
 * @returns {{naechstes: object|undefined, teuerstesVerdienteWertvoll: number}}
 */
export function waehleEinbauGeldziele(kandidaten, istWertvoll) {
  const liste = Array.isArray(kandidaten) ? kandidaten : [];
  const naechstes = liste
    .filter((k) => k.rep < k.repReq && istWertvoll(k))
    .sort((a, b) => (a.repReq - a.rep) - (b.repReq - b.rep))[0];
  const teuerstesVerdienteWertvoll = Math.max(0, ...liste
    .filter((k) => k.rep >= k.repReq && istWertvoll(k)).map((k) => k.preis));
  return { naechstes, teuerstesVerdienteWertvoll };
}

/**
 * A1 mit Skeptiker-Einwaenden 4 und 8: soll bn4rep den Fokus zurueckholen?
 *
 * Nur bei laufender Faktionsarbeit fuer das eigene Ziel, ohne Fokus, und nur
 * ohne EINGEBAUTES Neuroreceptor Management Implant. Das Spiel prueft
 * `hasAugmentation(NMI, true)` (`PlayerObjectGeneralMethods.ts:622-628`), und
 * der zweite Parameter heisst `ignoreQueued` (`Person.ts:232-239`) - ein nur
 * GEKAUFTES NMI hebt die Strafe x0,8 nicht auf. Die erste Fassung las es
 * andersherum und haette nach dem Kauf fuer den Rest des Zyklus nichts mehr
 * zurueckgeholt.
 *
 * KARENZ STATT SOFORT (Einwand 8). `setFocus(true)` springt auf die
 * Arbeitsseite (`Singularity.ts:544-547`). Dort rendert das Spiel keine
 * Seitenleiste (`ui/GameRoot.tsx:328-331`), und die Tastenkuerzel werden bei
 * fokussierter Arbeit verworfen (`Sidebar/ui/SidebarRoot.tsx:285-306`) -
 * darkweb.js und die Handwerkzeuge (exportbonus, travel, join ...), die
 * zuerst "Do something else simultaneously" klicken und dann per alt+w/alt+t
 * navigieren, bricht ein Zurueckspringen mittendrin ab. Deshalb erst
 * zurueckholen, wenn der Fokus seit `karenzMs` fehlt: darkweb.js braucht mit
 * TOR-Kauf und fuenf Programmen rund 16 s, 30 s decken das. Der Preis ist
 * klein - hoechstens 30 s x 0,2 Rate je Unterbrechung.
 *
 * Reiner Zustandsautomat: der Aufrufer reicht `unfokussiertSeit` aus der
 * Vorrunde herein und speichert den zurueckgegebenen Wert.
 *
 * @param {object} p
 * @param {boolean} p.arbeitetSchon Faktionsarbeit fuer das aktuelle Ziel laeuft
 * @param {boolean} p.istFokussiert `ns.singularity.isFocused()`
 * @param {boolean} p.nmiEingebaut NMI in getOwnedAugmentations(false)
 * @param {number|null} p.unfokussiertSeit Wandzeit der ersten Beobachtung ohne Fokus
 * @param {number} p.jetzt Wandzeit
 * @param {number} [p.karenzMs]
 * @returns {{holen: boolean, unfokussiertSeit: number|null}}
 */
export const FOKUS_KARENZ_MS = 30000;
export function fokusEntscheidung({
  arbeitetSchon, istFokussiert, nmiEingebaut, unfokussiertSeit, jetzt, karenzMs = FOKUS_KARENZ_MS,
}) {
  if (!arbeitetSchon || istFokussiert || nmiEingebaut) return { holen: false, unfokussiertSeit: null };
  const seit = Number.isFinite(unfokussiertSeit) ? unfokussiertSeit : jetzt;
  if (jetzt - seit >= karenzMs) return { holen: true, unfokussiertSeit: null };
  return { holen: false, unfokussiertSeit: seit };
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

/**
 * Skeptiker-Einwand 11: der Grundtext im Log nennt die Bedingung, die
 * tatsaechlich ausgeloest hat, in fester Rangfolge.
 *
 * Vorher fiel der Text beim Spendenrecht auf "naechste Huerde erst in ..."
 * zurueck (bei `kleinsteLuecke === null` sogar "in 0"), und `geldWegZu`
 * nannte den Preis des teuersten verdienten Stuecks UNGEFILTERT, obwohl der
 * gefilterte ausgeloest hatte. Die Telemetrie ist der einzige Weg, einen
 * Fehlausloeser im Nachhinein zuzuordnen (so ist der Audit entstanden).
 *
 * @param {object} g die Einbaugruende dieser Runde
 * @returns {string}
 */
export function einbauGrundText(g) {
  const mio = (n) => Math.round((Number(n) || 0) / 1e6) + "m";
  if (g.redPillWartet) {
    return "The Red Pill ist gekauft, aber nicht eingebaut - ohne Einbau haengt"
      + " w0r1d_d43m0n nie am Netz";
  }
  if (g.spendenrechtFaellig) {
    return "Spendenrecht bei " + (g.spendenFaktion || "einer Faktion")
      + " faellig - der Einbau hebt den Favor ueber die Spendenschwelle";
  }
  if (g.favorLohnt) {
    return "Favor bei " + g.favorFaktion + " hebt die Reputationsrate um "
      + Math.round((g.favorGewinn - 1) * 100) + " Prozent";
  }
  if (g.geldWegZu) {
    return "verdientes Stueck kostet " + mio(g.teuerstesVerdienteWertvoll) + " bei "
      + mio(g.geld) + " Guthaben und " + mio(g.einkommenProSek * g.horizontSek)
      + " Zufluss im Horizont";
  }
  if (g.naechstesUnbezahlbar) {
    return "naechstes Stueck (" + g.naechstesAug + ") kostet " + mio(g.naechstesPreis)
      + " bei " + mio(g.geld) + " Guthaben und " + mio(g.einkommenProSek * g.horizontSek)
      + " Zufluss im Horizont - Arbeit daran waere vergeblich";
  }
  if (g.nichtsMehrOffen) return "nichts mehr offen in den beigetretenen Faktionen";
  if (Number.isFinite(g.kleinsteLuecke)) {
    return "naechste Huerde erst in " + Math.round(g.kleinsteLuecke) + " Reputation";
  }
  return "unbekannter Grund";
}

// ===========================================================================
// KAMPFKNOTEN MIT GANG: KAUFAUFSCHUB UND RUNDE AM EINBAU-TOR (AUG-4, 03.10.2026)
// ===========================================================================
//
// Quelle: nodes/audit-2026-10-03/inventar-aug.md (AUG-4), inventar-gang.md
// (GANG-1) und verify-g01-betrieb.md (Abschnitt 2 und PAKET 1).
//
// DAS PROBLEM. Die Kaufschleife in bn4rep.js kauft jedes verdiente und
// bezahlbare Stueck SOFORT. Jedes gekaufte Stueck verteuert alle folgenden um
// den Faktor 1,9 (AugmentationHelpers.ts:32-37, :155-158; Constants.ts:41), und
// der Gang-Ruf waechst von null aus - zuerst verdient sind also die billigsten
// Stuecke (Neurotrainer I 1.000 Ruf, Wired Reflexes 1.250 ...). Nach zehn
// Stueck kostet alles das 613-fache, SPTN-97 (4,875 Mrd) dann 3 Bio.
// Gerechnet (verify-g01-betrieb.md Abschnitt 4, Preistreppe auf zwei
// Spielstaenden exakt geeicht): Black-Op-Competence nach Zyklus 1 mit der
// heutigen Schleife x1,24, am Tor mit freier Auswahl x3,92. Mit Gang ist der
// Kaufplaner damit keine Feinarbeit mehr, sondern die Bedingung dafuer, dass
// die Gang ueberhaupt etwas bringt.
//
// DIE LOESUNG, DREI TEILE (alle nur im Kampfknoten MIT Gang, sonst aendert sich
// nichts):
//   1. Solange der Einbau gesperrt ist, wird aus KEINER Faktion gekauft - auch
//      nicht aus den Bladeburners (jedes dort verdiente Stueck verteuert die
//      Gang-Runde um x1,9).
//   2. Am offenen Tor kauft eine RUNDE, die waehleTorRunde() plant: gierig nach
//      dem Zuwachs von log(Competence) je Mehrkosten, mit Vorgaengern, in der
//      Reihenfolge teuerste zuerst.
//   3. Die Gang holt Offline-Zeit 25-fach nach (Gang.ts:99-121, Constants.ts
//      minCyclesToProcess 10 / maxCyclesToProcess 25). Oeffnet das Tor direkt
//      nach dem Laden, fehlt der Ruf aus dem noch nicht verarbeiteten Vorrat.
//      Gekauft wird erst, wenn ns.gang.getBonusTime() unter einer Minute
//      liegt (NetscriptFunctions/Gang.ts:340-343: storedCycles x 200 ms).
//
// Rein, ohne ns und ohne Import - wie der Rest dieser Datei. bn4rep.js reicht
// fertige Zahlen herein.

/** CONSTANTS.MultipleAugMultiplier (Constants.ts:41); ohne Source File 11 exakt 1,9. */
export const GATE_PRICE_STEP = 1.9;

/** Unter dieser Gang-Bonuszeit gilt der Vorrat als nachgeholt (verify-g01-betrieb.md PAKET 1). */
export const GATE_BONUS_THRESHOLD_MS = 60000;

/**
 * Hoechstens so lange wartet die Runde auf den Gang-Vorrat, wenn er nicht
 * kleiner wird: 30 Minuten (Skeptiker-Auflage 03.10.2026; zuerst 2 Stunden).
 *
 * WARUM ES DIESE GRENZE GIBT (nicht in der Vorgabe, Zusatz des Bauers). Der
 * Vorrat sinkt nur, solange die Engine die Gang schneller verarbeitet, als
 * sie Zyklen ansammelt - 24 Zyklen netto je Takt (Gang.ts:99-121, Constants.ts
 * minCyclesToProcess 10 / maxCyclesToProcess 25). In einem gedrosselten Tab
 * (ein Takt je Minute, 25 von 300 Zyklen verarbeitet) WAECHST er dagegen um
 * rund 55 s je Minute und faellt nie unter die Schwelle. Ohne Grenze wuerde
 * der Bot dort nie mehr kaufen und, weil der Einbau der Runde folgt, nie mehr
 * einbauen: ein Stillstand fuer den ganzen Knoten, um eine Rufdifferenz zu
 * vermeiden.
 *
 * WARUM 30 MINUTEN. Als Fortschritt gilt ein Fall um 10 % unter den bisherigen
 * Tiefstand (GATE_BONUS_PROGRESS). Ungedrosselt sinkt der Vorrat um 24 s je
 * Sekunde: 10 % von zehn Stunden Vorrat sind in rund 2,5 Minuten erreicht,
 * bei einem Takt je Sekunde (gedrosselt, aber noch lebendig) in rund 10
 * Minuten. 30 Minuten ohne diesen Fortschritt sind kein Nachholen mehr,
 * sondern ein Dauerzustand - zwei Stunden hiessen dagegen pauschal zwei
 * Stunden Einbauverzug fuer jedes Tor, das im gedrosselten Tab oeffnet. Der
 * Zustand liegt ausserdem in data/torrunde-wait.json (bn4rep.js), ein
 * Neustart von bn4rep setzt die Uhr also nicht zurueck.
 */
export const GATE_BONUS_WAIT_MAX_MS = 30 * 60000;

/**
 * Liegen mehr als zehn Minuten zwischen zwei Runden (Rechner im Ruhezustand,
 * Prozess neu gestartet), beginnt die Wartezeit von vorn: die Uhr misst
 * Wandzeit, und der Vorrat springt nach so einer Pause nach oben, ohne dass
 * er "nicht kleiner wurde". bn4rep.js laeuft im 15-s-Takt.
 */
export const GATE_ROUND_GAP_MS = 10 * 60000;

/** Als Fortschritt gilt, wenn der Vorrat unter 90 % des bisherigen Tiefstands faellt. */
export const GATE_BONUS_PROGRESS = 0.9;

/**
 * Letzter Rueckfall fuer die Gewichte, wenn lib/blackops.json keine enthaelt:
 * Operation Typhoon (BlackOperations.ts), die erste Black Op jedes Laufs. Die
 * spaeteren verschieben die Gewichte nur leicht (nodes/audit-2026-10-03/
 * inventar-aug.md AUG-7), nie so weit, dass ein Wert unwichtig wuerde.
 */
export const GATE_FALLBACK_WEIGHTS = {
  weights: { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, charisma: 0, intelligence: 0.1 },
  decays: { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, charisma: 0, intelligence: 0.75 },
};

/**
 * Gewichte und Abklingexponenten der naechsten Black Op aus
 * src/lib/blackops.json (erzeugt von tools/blackops-tabelle.js).
 *
 * Der Name aus dem Spiel ("Operation Typhoon", getNextBlackOp) und der
 * Schluessel in der Tabelle ("OperationTyphoon", BladeburnerBlackOpName) sind
 * zwei Schreibweisen derselben Sache - verglichen wird ohne Leer- und
 * Sonderzeichen und ohne Gross-/Kleinschreibung.
 *
 * Reihenfolge der Rueckfaelle: Treffer nach Name; sonst die erste Operation
 * der Tabelle; sonst die eingebauten Typhoon-Werte. `source` benennt, was
 * gegriffen hat - die Telemetrie zeigt es, damit ein Rueckfall nicht still
 * bleibt.
 *
 * @param {{ops?: {name:string, weights?:object, decays?:object}[]}|null} table
 * @param {string|null|undefined} nextName
 * @returns {{name:string, weights:object, decays:object, source:string}}
 */
export function blackOpWeights(table, nextName) {
  const norm = (s) => String(s == null ? "" : s).replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  const ops = table && Array.isArray(table.ops)
    ? table.ops.filter((o) => o && o.weights && typeof o.weights === "object"
      && o.decays && typeof o.decays === "object")
    : [];
  const want = norm(nextName);
  if (want) {
    const hit = ops.find((o) => norm(o.name) === want);
    if (hit) return { name: hit.name, weights: hit.weights, decays: hit.decays, source: "blackops.json:" + hit.name };
  }
  if (ops.length) {
    return {
      name: ops[0].name, weights: ops[0].weights, decays: ops[0].decays,
      source: "Rueckfall erste Op " + ops[0].name
        + (want ? " (" + String(nextName).slice(0, 40) + " nicht in der Tabelle)" : " (naechste Op unbekannt)"),
    };
  }
  return {
    name: "OperationTyphoon", weights: GATE_FALLBACK_WEIGHTS.weights, decays: GATE_FALLBACK_WEIGHTS.decays,
    source: "Rueckfall eingebaut (blackops.json ohne Gewichte)",
  };
}

// Die Multiplikatoren, die in die Black-Op-Competence eingehen (Action.ts:169-195):
// vier Kampfwerte (hier als Faktor auf die Stufe) und die Erfolgschance-Aug, die
// die ganze Summe multipliziert.
const GATE_STAT_KEYS = ["hacking", "strength", "defense", "dexterity", "agility"];
const GATE_CHANCE_KEY = "bladeburner_success_chance";
const GATE_KEYS = [...GATE_STAT_KEYS, GATE_CHANCE_KEY];

/**
 * Produkt der Faktoren mehrerer Augs je Wert, nur die Schluessel, die in die
 * Competence eingehen. Augmentierungen verrechnen sich multiplikativ
 * (Player.mults = mergeMultipliers). bn4rep.js ruft das fuer die bereits
 * WARTENDEN Stuecke (opt.startMults von waehleTorRunde): ihre Faktoren wirken
 * nach dem Einbau mit und veraendern, wie viel eine weitere Aug noch bringt.
 *
 * @param {object[]} list Faktor-Objekte, z. B. COMBAT_AUGS[name]
 * @returns {Record<string, number>}
 */
export function gateMultsProduct(list) {
  const e = {};
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== "object") continue;
    for (const key of GATE_KEYS) {
      const f = Number(m[key]);
      if (Number.isFinite(f) && f > 0 && f !== 1) e[key] = (e[key] || 1) * f;
    }
  }
  return e;
}

/**
 * Preisfaktor je wartendem Stueck: 1,9 x [1, 0,96, 0,94, 0,93] nach Stufe von
 * Source File 11 (AugmentationHelpers.ts:28-30). Auf der Route kommt SF11 mit
 * BN11.1 dazu - ab dann stimmt 1,9 nicht mehr, und ein Plan mit 1,9 ueber-
 * schaetzt jeden Schritt um bis zu 7 %.
 *
 * @param {number} sf11Level Stufe von SF11 (0 = nicht vorhanden)
 */
export function gatePriceStep(sf11Level) {
  const i = Math.min(3, Math.max(0, Math.floor(Number(sf11Level) || 0)));
  return GATE_PRICE_STEP * [1, 0.96, 0.94, 0.93][i];
}

/**
 * Black-Op-Competence nach Action.ts:169-195, soweit sie von Augmentierungen
 * abhaengt: Summe Gewicht x (Stufe x Aug-Faktor)^Abklingexponent, mal der
 * Erfolgschance-Faktor. Eine neue Aug mit Faktor m hebt die Stufe auf m x
 * Stufe, denn Stufe = floor(mult x f(exp)) und die Erfahrung bleibt dieselbe.
 *
 * WAS SICH HERAUSKUERZT UND WAS NICHT (Skeptiker-Auflage 03.10.2026; der
 * Kommentar behauptete hier vorher, auch die Faehigkeiten kuerzten sich).
 * Was die GANZE Summe multipliziert, steht im Verhaeltnis zweier Runden auf
 * beiden Seiten und faellt weg: Intelligenzbonus (Action.ts:175), Ausdauer
 * (:176), Teambonus (:178), Bevoelkerung (:180) und die Erfolgschance-
 * Faehigkeiten Blade's Intuition, Short-Circuit, Cloak, Digital Observer
 * (:184-187). NICHT weg faellt das, was in die POTENZ geht: Action.ts:173
 * rechnet pow(getEffectiveSkillLevel(person, stat), decay), und
 * Bladeburner.ts:759-774 multipliziert dort Reaper (Staerke, Verteidigung,
 * Geschicklichkeit, Beweglichkeit) und Evasive System (Geschicklichkeit,
 * Beweglichkeit) auf die Stufe, je Wert verschieden (Bladeburner.ts:776-784,
 * Faktoren multiplikativ). Ein Faktor in der Potenz kuerzt sich nicht, weil
 * die Terme der Summe verschieden gewichtet sind: der Planer waehlt mit
 * rohen Stufen eine andere Runde als mit effektiven (Live-Stand 03.10.:
 * Reaper 12, Evasive 13 -> bei 60 Mrd echte Competence x1,567 statt x1,650).
 *
 * Deshalb erwartet `levels` hier die EFFEKTIVEN Stufen - der Aufrufer
 * (bn4rep.js) rechnet effectiveLevels(spieler.skills, bladeEffFactors(...)).
 *
 * Summiert wird in der Reihenfolge der Gewichte-Schluessel, Nullgewichte
 * uebersprungen - dieselbe Summe, die tools/audit/gang-round.mjs bildet.
 */
function gateCompetence(levels, extra, weights, decays) {
  let c = 0;
  for (const stat of Object.keys(weights)) {
    const w = weights[stat];
    if (!(w > 0)) continue;
    const d = decays && Number.isFinite(decays[stat]) ? decays[stat] : 1;
    c += w * Math.pow((Number(levels[stat]) || 0) * (extra[stat] || 1), d);
  }
  return c * (extra[GATE_CHANCE_KEY] || 1);
}

/**
 * Die Faktoren, mit denen Reaper und Evasive System die Kampfwerte fuer
 * Bladeburner-Aktionen anheben (getEffectiveSkillLevel, Bladeburner.ts:759-774;
 * updateSkillMultipliers, :776-784; Skills.ts: Reaper EffStr/EffDef/EffDex/
 * EffAgi je 2 % je Stufe, Evasive System EffDex/EffAgi je 4 % je Stufe).
 * Die Faktoren gleicher Werte verrechnen sich MULTIPLIKATIV:
 *   Staerke, Verteidigung   1 + 2 r / 100
 *   Geschicklichkeit, Beweglichkeit   (1 + 2 r / 100) x (1 + 4 e / 100)
 *
 * Nicht lesbare oder negative Stufen zaehlen als 0 (Faktor 1) - ein Fehler
 * in den Zusatzdaten darf die Runde nicht verhindern, der Aufrufer meldet
 * ihn in der Telemetrie.
 *
 * @param {number} reaperLevel Stufe von Reaper (ns.bladeburner.getSkillLevel)
 * @param {number} evasiveLevel Stufe von Evasive System
 * @returns {{strength:number, defense:number, dexterity:number, agility:number}}
 */
export function bladeEffFactors(reaperLevel, evasiveLevel) {
  const lv = (x) => {
    const n = Math.floor(Number(x));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const reaper = 1 + (2 * lv(reaperLevel)) / 100;
  const dex = reaper * (1 + (4 * lv(evasiveLevel)) / 100);
  return { strength: reaper, defense: reaper, dexterity: dex, agility: dex };
}

/**
 * Spielerstufen mal Faehigkeitsfaktoren = die Stufen, die in die Competence
 * eingehen (siehe gateCompetence). Gibt eine Kopie zurueck; fehlt `eff` oder
 * ein Faktor, bleibt die Stufe wie sie ist. Nicht endliche Faktoren zaehlen 1.
 *
 * @param {Record<string, number>} skills spieler.skills
 * @param {Record<string, number>|null|undefined} eff aus bladeEffFactors
 */
export function effectiveLevels(skills, eff) {
  const out = { ...(skills && typeof skills === "object" ? skills : {}) };
  if (!eff || typeof eff !== "object") return out;
  for (const key of ["strength", "defense", "dexterity", "agility"]) {
    const f = Number(eff[key]);
    if (Number.isFinite(f) && f > 0 && key in out) out[key] = Number(out[key]) * f;
  }
  return out;
}

/**
 * Die Faehigkeitsstufen aus der Telemetrie von blade.js (data/blade.json,
 * Felder skillLevels { reaper, evasive } / skillLevelsError) - nur wenn sie
 * zur Gegenwart gehoeren. Sonst ist die Antwort `ok: false` mit dem Grund, und
 * der Aufrufer rechnet mit rohen Stufen UND sagt es in der Telemetrie.
 *
 * Alt (> maxAgeMs, Voreinstellung 30 min) heisst: blade.js schreibt nicht
 * mehr. Ein anderer Knotenstempel heisst: die Datei stammt aus dem vorigen
 * Knoten, dort standen die Faehigkeiten anders (BitNode-Wechsel setzt sie auf
 * 0 zurueck).
 *
 * @param {object|null} j geparstes data/blade.json
 * @param {number} nowMs Date.now()
 * @param {number|null} nodeReset ns.getResetInfo().lastNodeReset
 * @param {number} [maxAgeMs]
 * @returns {{ok: boolean, reaper: number, evasive: number, why: string}}
 */
export function bladeSkillLevels(j, nowMs, nodeReset, maxAgeMs = 30 * 60000) {
  const no = (why) => ({ ok: false, reaper: 0, evasive: 0, why });
  if (!j || typeof j !== "object") return no("blade.json fehlt");
  if (j.skillLevelsError) return no("blade.js meldet: " + String(j.skillLevelsError).slice(0, 100));
  const s = j.skillLevels;
  if (!s || typeof s !== "object") return no("blade.json ohne skillLevels (altes blade.js?)");
  const r = Number(s.reaper), e = Number(s.evasive);
  if (!Number.isFinite(r) || !Number.isFinite(e) || r < 0 || e < 0) return no("skillLevels nicht lesbar");
  if (!Number.isFinite(j.zeit) || nowMs - j.zeit > maxAgeMs || j.zeit - nowMs > maxAgeMs) {
    return no("blade.json " + (Number.isFinite(j.zeit) ? Math.round((nowMs - j.zeit) / 60000) + " min alt" : "ohne Zeit"));
  }
  if (Number.isFinite(nodeReset) && Number.isFinite(j.nodeReset) && j.nodeReset !== nodeReset) {
    return no("blade.json stammt aus einem anderen Knoten");
  }
  return { ok: true, reaper: Math.floor(r), evasive: Math.floor(e), why: "" };
}

/**
 * Die Runde, die am offenen Einbau-Tor gekauft wird (AUG-4).
 *
 * Gierig, wie tools/audit/gang-round.mjs `bestRound`: in jedem Schritt kommt
 * die Aug (samt noch fehlenden Vorgaengern) dazu, die den groessten Zuwachs
 * von log(Competence) je zusaetzlichem Dollar bringt und noch ins Budget
 * passt. Der Preis richtet sich nach der Kaufreihenfolge: das Stueck an
 * Position i kostet seinen heutigen Preis x 1,9^i (die Warteschlange waechst
 * mit jedem Kauf; der heutige Preis steckt 1,9^wartend schon drin, deshalb
 * wird der Anfangsstand nicht noch einmal gerechnet).
 *
 * Gekauft wird TEUERSTE ZUERST, jede Voraussetzung vor ihrem Nachfolger:
 * der Faktor 1,9^i trifft so die billigen Stuecke und nicht die teuren
 * (Umordnungsargument in src/buyaugs.js, "TEUERSTE ZUERST").
 *
 * Eingabe `kandidaten`: je Eintrag { aug, faktion, rep, repReq, preis, prereq,
 * mults }. `preis` ist der HEUTIGE Preis (ns.singularity.getAugmentationPrice),
 * `prereq` die Namensliste (getAugmentationPrereq), `mults` die Faktoren der
 * Aug (COMBAT_AUGS in lib/hackaugs.js). Nur Stuecke mit rep >= repReq zaehlen;
 * ein Stueck, dessen Vorgaenger weder besessen noch selbst kaufbar ist, auch
 * nicht. Eine Aug ohne wirksamen Faktor hat Zuwachs 0 und kommt nie hinein.
 *
 * `besitz`: Namen, die installiert ODER schon gekauft sind (Vorgaenger gelten
 * dann als erfuellt, die Aug selbst ist kein Kandidat mehr).
 *
 * `opt`:
 *   skills       EFFEKTIVE Stufen { hacking, strength, defense, dexterity, agility, intelligence }:
 *                die Spielerstufen mal die Bladeburner-Faehigkeitsfaktoren (effectiveLevels);
 *                rohe Stufen waehlen eine andere, schlechtere Runde (gateCompetence)
 *   weights      Gewichte der Ziel-Black-Op (blackOpWeights)
 *   decays       Abklingexponenten dazu
 *   startMults   Faktoren der bereits WARTENDEN Stuecke (wirken nach dem Einbau mit)
 *   priceStep    Preisfaktor je wartendem Stueck (1,9; mit SF11 kleiner)
 *
 * Jede Schleife ist hart begrenzt: aeussere Runden <= Zahl der Kandidaten + 2,
 * Vorgaengerketten <= 32 Stufen.
 *
 * @returns {{seq: string[], steps: {aug:string, faktion:string, price:number}[],
 *   cost: number, gain: number, candidates: number}}
 */
export function waehleTorRunde(kandidaten, geld, besitz, opt = {}) {
  const step = Number.isFinite(opt.priceStep) && opt.priceStep > 1 ? opt.priceStep : GATE_PRICE_STEP;
  const weights = opt.weights || GATE_FALLBACK_WEIGHTS.weights;
  const decays = opt.decays || GATE_FALLBACK_WEIGHTS.decays;
  const levels = opt.skills || {};
  const start = opt.startMults || {};
  const owned = besitz instanceof Set ? besitz : new Set(besitz || []);
  const empty = { seq: [], steps: [], cost: 0, gain: 1, candidates: 0 };
  if (!(Number(geld) > 0)) return empty;

  // Kaufbare Kandidaten, einer je Name (die erste Faktion mit genug Ruf).
  const byName = new Map();
  for (const k of Array.isArray(kandidaten) ? kandidaten : []) {
    if (!k || owned.has(k.aug) || byName.has(k.aug)) continue;
    if (!(k.rep >= k.repReq) || !(Number(k.preis) > 0) || !Number.isFinite(Number(k.preis))) continue;
    byName.set(k.aug, {
      aug: k.aug, faktion: k.faktion, price: Number(k.preis),
      prereq: Array.isArray(k.prereq) ? k.prereq : [],
      mults: k.mults && typeof k.mults === "object" ? k.mults : {},
    });
  }
  if (!byName.size) return empty;

  // Die Aug und alle noch fehlenden Vorgaenger - null, wenn einer davon nicht kaufbar ist.
  const closure = (name) => {
    const out = new Set();
    let ok = true;
    const add = (n, depth) => {
      if (!ok || out.has(n)) return;
      if (depth > 32) { ok = false; return; }
      out.add(n);
      for (const pr of byName.get(n).prereq) {
        if (owned.has(pr)) continue;
        if (!byName.has(pr)) { ok = false; return; }
        add(pr, depth + 1);
      }
    };
    add(name, 0);
    return ok ? out : null;
  };

  // Kaufreihenfolge und Kosten einer Menge: Wurzeln (kein Vorgaenger eines
  // anderen Mitglieds) teuerste zuerst, jede Voraussetzung unmittelbar vor
  // ihrem Nachfolger; Position i kostet price x step^i.
  const order = (set) => {
    const names = [...set];
    const roots = names
      .filter((n) => !names.some((m) => byName.get(m).prereq.includes(n)))
      .sort((a, b) => byName.get(b).price - byName.get(a).price);
    const seq = [];
    const push = (n, depth) => {
      if (seq.includes(n) || depth > 32) return;
      for (const pr of byName.get(n).prereq) if (set.has(pr)) push(pr, depth + 1);
      seq.push(n);
    };
    for (const n of roots) push(n, 0);
    for (const n of names) push(n, 0);
    let cost = 0;
    seq.forEach((n, i) => { cost += byName.get(n).price * Math.pow(step, i); });
    return { seq, cost };
  };

  // Gesamtfaktor je Wert: wartende Stuecke (start) mal die Menge.
  const extraOf = (set) => gateMultsProduct([start, ...[...set].map((n) => byName.get(n).mults)]);

  const base = gateCompetence(levels, extraOf(new Set()), weights, decays);
  if (!(base > 0)) return empty;

  let set = new Set();
  const maxRounds = byName.size + 2;
  for (let round = 0; round < maxRounds; round++) {
    const cur = gateCompetence(levels, extraOf(set), weights, decays);
    const curCost = order(set).cost;
    let best = null;
    for (const name of byName.keys()) {
      if (set.has(name)) continue;
      const add = closure(name);
      if (!add) continue;
      const next = new Set([...set, ...add]);
      const { cost } = order(next);
      if (cost > geld) continue;
      const gain = Math.log(gateCompetence(levels, extraOf(next), weights, decays) / cur);
      const value = gain / Math.max(1, cost - curCost);
      if (gain > 0 && (!best || value > best.value)) best = { next, value };
    }
    if (!best) break;
    set = best.next;
  }

  const { seq, cost } = order(set);
  return {
    seq,
    steps: seq.map((n, i) => ({
      aug: n, faktion: byName.get(n).faktion, price: byName.get(n).price * Math.pow(step, i),
    })),
    cost,
    gain: gateCompetence(levels, extraOf(set), weights, decays) / base,
    candidates: byName.size,
  };
}

/**
 * Wartet die Runde noch auf den Gang-Vorrat (getBonusTime)?
 *
 * Zustand { min, seit, zuletzt } wandert von Runde zu Runde (bn4rep.js haelt
 * ihn in main): `min` der bisher tiefste Vorrat, `seit` die Wandzeit, seit
 * der er nicht mehr unter 90 % davon gefallen ist, `zuletzt` die letzte
 * Runde. Gewartet wird, solange der Vorrat ueber der Schwelle liegt UND
 * weniger als GATE_BONUS_WAIT_MAX_MS ohne Fortschritt vergangen sind.
 *
 * Welche Uhr: der Vorrat ist Spielzeit (Zyklen x 200 ms), die Wartegrenze
 * Wandzeit. Die Grenze fragt nur "kommt das Nachholen voran?" - sie misst
 * keine Spielzeit. Sprung der Wandzeit ueber eine Pause (Ruhezustand):
 * GATE_ROUND_GAP_MS.
 *
 * Ist die Bonuszeit nicht lesbar (NaN, negativ), wird NICHT gewartet - ein
 * Fehler im Zusatztor darf den Einbau nicht anhalten. Der Aufrufer zaehlt
 * ihn in der Telemetrie.
 *
 * @param {{min:number|null, seit:number|null, zuletzt:number|null}|null} state
 * @param {number} now Date.now()
 * @param {number} bonusMs ns.gang.getBonusTime()
 * @returns {{waits: boolean, state: {min:number|null, seit:number|null, zuletzt:number}, reason: string}}
 */
export function gangBonusWait(state, now, bonusMs, opt = {}) {
  const threshold = opt.thresholdMs ?? GATE_BONUS_THRESHOLD_MS;
  const maxWait = opt.maxWaitMs ?? GATE_BONUS_WAIT_MAX_MS;
  const gap = opt.roundGapMs ?? GATE_ROUND_GAP_MS;
  const fresh = { min: null, seit: null, zuletzt: now };
  if (!Number.isFinite(bonusMs) || bonusMs < 0) {
    return { waits: false, state: fresh, reason: "Bonuszeit nicht lesbar - es wird nicht gewartet" };
  }
  if (bonusMs < threshold) return { waits: false, state: fresh, reason: "" };
  const s = state && typeof state === "object" ? state : {};
  let min = Number.isFinite(s.min) ? s.min : null;
  let since = Number.isFinite(s.seit) ? s.seit : null;
  const afterPause = Number.isFinite(s.zuletzt) && now - s.zuletzt > gap;
  if (min === null || since === null || afterPause || bonusMs < min * GATE_BONUS_PROGRESS) {
    min = bonusMs;
    since = now;
  }
  const next = { min, seit: since, zuletzt: now };
  const waitedMs = now - since;
  const secs = Math.round(bonusMs / 1000);
  if (waitedMs >= maxWait) {
    return {
      waits: false, state: next,
      reason: "Gang-Vorrat " + secs + " s sinkt seit " + Math.round(waitedMs / 60000)
        + " min nicht - die Runde wird trotzdem gekauft",
    };
  }
  return {
    waits: true, state: next,
    reason: "Gang-Vorrat " + secs + " s wird noch nachgeholt (wartet seit "
      + Math.round(waitedMs / 60000) + " min)",
  };
}

/**
 * Den Wartezustand von gangBonusWait aus data/torrunde-wait.json zurueckholen
 * (Skeptiker-Hinweis 03.10.2026: der Zustand lag nur im Speicher, ein
 * Neustart von bn4rep - killSafe, evictRank - setzte die Wartegrenze zurueck,
 * und wiederholte Neustarts im gedrosselten Tab haetten den Einbau ohne Ende
 * aufschieben koennen).
 *
 * Gueltig ist nur ein Zustand mit endlichen, nicht negativen Zahlen, in dem
 * `seit` nicht nach `zuletzt` liegt und `zuletzt` nicht in der Zukunft. Alles
 * andere ist ein frischer Zustand (die Wartegrenze beginnt neu - der sichere
 * Fehler, denn er verlaengert das Warten hoechstens um die Grenze). Ob der
 * Zustand zu alt ist (Pause, Ruhezustand), entscheidet gangBonusWait selbst
 * mit GATE_ROUND_GAP_MS.
 *
 * @param {object|null} raw geparstes data/torrunde-wait.json
 * @param {number} nowMs Date.now()
 * @returns {{min:number|null, seit:number|null, zuletzt:number|null}}
 */
export function readGateBonusState(raw, nowMs) {
  const fresh = { min: null, seit: null, zuletzt: null };
  if (!raw || typeof raw !== "object") return fresh;
  const { min, seit, zuletzt } = raw;
  if (![min, seit, zuletzt].every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0)) return fresh;
  if (seit > zuletzt || zuletzt > nowMs + 60000) return fresh;
  return { min, seit, zuletzt };
}

/**
 * Wie viele Runden in Folge (15 s je Runde, also 5 Minuten) der Einbau auf
 * eine Torrunde warten darf, die schon beim ERSTEN Stueck abbrach (Preis
 * ausserhalb des Plans, Geld weg, vom Spiel abgelehnt). Danach laeuft der
 * Einbau ohne sie: ein Dauerfehler darf den Knoten nicht anhalten.
 */
export const GATE_ABORT_HOLD_ROUNDS = 20;

/**
 * Haelt der Einbau diese Runde noch zurueck, weil die Torrunde ohne ein
 * einziges Kauf-Stueck abbrach?
 *
 * Ohne das lief der Einbau in derselben Runde ohne Torrunde (Skeptiker-
 * Hinweis 03.10.2026): die Gang-Augs waeren fuer den Zyklus verloren. Die
 * naechste Runde plant neu - dazu bekommt sie hoechstens
 * GATE_ABORT_HOLD_ROUNDS Versuche.
 *
 * @param {number} streak abgebrochene Runden ohne Kauf in Folge, diese eingeschlossen
 */
export function gateAbortHold(streak) {
  return Number.isFinite(streak) && streak >= 1 && streak <= GATE_ABORT_HOLD_ROUNDS;
}

/**
 * Was die Kaufschleife dieser Runde tut.
 *
 *   normal  kein Kampfknoten mit Gang - die alte Schleife, nichts aendert sich
 *   locked  Einbau gesperrt oder nicht erlaubt: aus KEINER Faktion kaufen
 *   bonus   Tor offen, aber der Gang-Vorrat wird noch nachgeholt: nichts kaufen
 *           und nicht einbauen
 *   round   Tor offen und Vorrat nachgeholt: die geplante Runde kaufen
 *
 * @param {{inGang: boolean, gateOpen: boolean, bonusWaits: boolean}} p
 * @returns {"normal"|"locked"|"bonus"|"round"}
 */
export function gateBuyMode({ inGang, gateOpen, bonusWaits }) {
  if (!inGang) return "normal";
  if (!gateOpen) return "locked";
  if (bonusWaits) return "bonus";
  return "round";
}
