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
