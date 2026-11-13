# Teil 4b - Skeptiker zu 4a (Gewerke, Lauf 2)

Stand 13.11.2026. Nur lesend gearbeitet. Eigene Rechenskripte im Scratchpad `...\scratchpad\audit4b\` (stages.js, step.js, ratevsrank.js, load.js, corp*.js, skills.js); im Projekt nichts ausser dieser Datei.
Datenbasis: `data/dashboard-history.json` (5-min-Proben, BN13.2/13.3/15.1/15.2/15.3), `chronik.json` (Einbauzeiten), `backups/*.json.gz` (BN3, BN7, BN13, BN15), Spielquelle `reference/v301/src`.
Uhren: "W" Wanduhr, "online" = Summe der Probenabstaende <= 11 min.

## Gesamturteil

- **G01 bleibt als Beobachtung stehen (Frist ist der Taktgeber), faellt aber als Nutzenbehauptung.** Die Daten zeigen: die Rangrate haengt am Rang, nicht an der Einbaustufe; jeder erste Einbau kostet 1-3 h Rangfortschritt (Rate nach dem Einbau 20-80 % unter dem Vorwert). 85 h Mitte sind nicht gedeckt; die 3 h der Frist-Kuerzung koennten ebenso negativ ausgehen.
- **C5 ist im Ergebnis richtig (kein Hebel), im Mechanismus falsch:** Bonuszeit laeuft mit **5x**, nicht 25x, und der Offline-Vorrat wird zu 100 % in Spielzeit gutgeschrieben. Die "50 %" der Chronik und die 0/15/40 h in G13 haben keine Grundlage.
- **C4 haelt am Quellcode** (Eltern-Gutschrift, Formel, kein Faktor 0,5). Die Stundenzahl 3/6/10 bleibt ungeeicht.
- **G60 haelt als Messung am Spielstand**, die Ursache ist aber enger und anders als in 4a (Tobacco-Umsatz 2.700-fach niedriger, nicht nur Boersengang), und ein Fix lag schon vor.
- Skillkauf und Black-Op-Schwelle: **kein belegbarer Fehler**; ein Verdachtspunkt (Reaper/Evasive ohne Klemmfaktor) ist nicht als Verlust belegt.

---

## Winkel 1 - G01 Einbaufrist

**Befund 4a:** Frist `max(12 h, 2*Wiederaufbau)` (`lib/endspurt.js:344,380`) taktet die Einbauten; 0/85/250 h W; Rangrate x3 je Einbaustufe.

**1a. Ist die Frist der Taktgeber? HAELT.**
Beleg: `chronik.json installTimes`, V2-Knoten mit Einbau nach Einfuehrung der Sperre: erste Einbauten bei 12,4 (2.2, 2.3, 7.1-7.3, 13.1-13.3, 14.2, 14.3), 12,5 (6.2), 12,6 (11.3), 12,7 (3.3, 13.1, 14.1, 15.2), 13,2 / 13,6 (15.1 / 15.3), 13,5 (11.2) Stunden Wanduhr nach Knotenstart. Zusammengefasst 18 von 22 in 12,3-13,7 h. Die Haeufung auf +0,1 h um den Fristablauf (12 h + Wiederaufbau 0,4 h) ist kein Zufall: alle anderen Einbaubedingungen (`bn4rep.js:2457-2461`: Warteschlange, Luecke, Ruf) waren zu diesem Zeitpunkt schon erfuellt. Ausreisser: 3.2 (9,3 h, 6-h-Corp-Regel), 2.1 (14,3), 3.1 (19,6). Einbaugrund selbst ist nicht geloggt (BAUSTELLEN "Einbaugrund geht verloren"), also ist es Schluss aus dem Muster, nicht gemessen - aber ein belastbarer.

**1b. Frist in Wanduhr und offline - FALSCH als Verlustmechanismus.**
BN13.2: Einbau 2 bei 34,8 h W (Dashboard: Luecke 24,8 -> 34,8 h, Probe 34,83 Rang 9.951, Einbau 34,91). Der Bot ging bei 24,8 h online-Uhr (= Fristablauf 12,4 + 12,4) offline und installierte 5 min nach der Rueckkehr. Das ist **keine verlorene Zeit**: online-Phase 12,4 h, dann sofort Einbau; eine Online-Frist haette denselben Zeitpunkt getroffen. Die Offline-Zeit liegt als Vorrat im Spiel (siehe C5) und wird danach abgespielt. "Zweite Einbauphase 22,4 statt 12,4 h" ist die Luecke, nicht die Frist. Randfall in der Gegenrichtung (nicht belegt, kein Nutzen berechnet): Laeuft die Frist waehrend einer Nacht ab, wird beim Wiederanlauf bei weniger als 12 h Spielzeit installiert, weil `totalPlaytime` Offline-Zeit sofort zaehlt, der Vorrat aber erst nach und nach laeuft.

**1c. Ist x3 je Einbaustufe ein Effekt der Augs oder der Zeit? Ueberwiegend der Zeit/des Rangs.**
Rechnung (`ratevsrank.js`): Rangrate je 30-min-Fenster, nach Rangklasse (log10 in 0,25-Schritten) und Einbaustufe gebuendelt, Fenster mit Einbau oder Luecke verworfen. Ueberlappende Rangklassen verschiedener Stufen innerhalb **desselben Laufs**:
- 13.3: Rang ~100.000: Stufe 1 39.264 /h, Stufe 2 46.180 /h.
- 15.1: Rang ~17.800: Stufe 5 1.026 /h, Stufe 6 968 /h.
- 15.3: Rang ~17.800: Stufe 1 3.499 /h, Stufe 2 3.657 /h.
- 15.1 Rang ~560: Stufe 0 36 /h, Stufe 1 192 /h (einziger Sprung nach oben, bei Rang 560 - Fruehphase).
Innerhalb einer Stufe waechst die Rate 3-18x (13.3 Stufe 0: 172 -> 549 -> 1.368 /h ohne jeden Einbau; Stufe 1: 1.079 -> 4.642 -> 19.936 /h). "x3 je Einbau" ist die Zeit-/Rangkurve, nicht ein Sprung am Einbau. Die Rate ist eine Funktion des Rangs; Stufen verschieben sie in diesen Daten nicht sichtbar. Zusatz: die Einbauzahl bestimmt die Laufzeit **nicht**: BN15.1 6 Einbauten 35,5 h online, 15.2 drei 36,0 h, 15.3 zwei 33,7 h (SF-Stufen und Graft/Go laufen mit, also nur Indiz).

**1d. Was ein Einbau kostet (in 4a nicht gezaehlt).**
Rate 0,5-2,5 h nach dem Einbau gegen die 2 h davor (`step.js`): 13.2 Einbau 1: 1.191 -> 260 (dann 404 in 2,5-4,5 h); 13.3 Einbau 1: 1.654 -> 836 (dann 1.598); 15.3 Einbau 1: 263 -> 71 (dann 406); 15.1 Einbau 5: 1.909 -> 354 (426). Verlust 13.2 Einbau 1 rund 3,4k Rang = 2,9 h Vorwert-Rate; 13.3 Einbau 1 rund 1,0 h. Spaeter (Rang > 10k) kein Einbruch mehr (13.3 Einbau 2: 28k -> 65k). Die Wiederaufbaudauer "0,01-0,3 h" misst nur Kampfwert >= 100; die Rate erholt sich erst nach 2-4 h. Die Formel "1,5 x T_prev" mit T_prev ~ 0,3 h gaebe also eine Frist, die unter der Erholungszeit liegt.

**1e. Richtige Regel? Nicht aus den Daten ableitbar.**
Gerechnet ist nur die Kostenseite des Einbaus (1d). Die Ertragsseite (Aug-Multiplikatoren heben die Rate-Rang-Kurve) ist in den Dashboard-Daten fuer V2 nicht sichtbar (1c). Eine Regel "Einbau, wenn Ertrag der wartenden Stuecke den Wiederaufbau uebersteigt" laesst sich damit nicht eichen. Zwei Laeufe als Beispiel: 13.3 (Einbau 1 bei 12,4 h): Kosten ~1 h, Gewinn in den Daten nicht erkennbar; 15.2 (Einbau 1 bei 12,7 h, Rang 800): Kosten 0 (Rate 32 -> 51), Gewinn ebenfalls nicht erkennbar. Fuer beide gilt: haette man den ersten Einbau einfach auf 24 h geschoben, verlangte das Modell "Rate = f(Rang)" einen Ausgang von +/- 1 h.

**Urteil G01: UNSICHER (Beobachtung HAELT, Nutzen FALSCH/ungestuetzt).**
Korrigierte Zahl: **-10 / 0 / +15 h online** statt 0/85/250 h W. Keine Zahl, die einen Bau traegt. Das Gegenrisiko aus BN4.3 wird durch 1d gestuetzt, nicht widerlegt.

---

## Winkel 2 - C4 / G20 (Offline-Erfahrung)

**HAELT am Quellcode, Stundenzahl UNSICHER.**
- `NetscriptWorker.ts:158-163`: im `.finally` eines Kindskripts `parent.scriptRef.onlineExpGained += runningScriptObj.onlineExpGained` (und Geld), nur wenn das Elternskript noch laeuft. `parent` ist der WorkerScript des `ns.exec`-Aufrufers (`NetscriptWorker.ts:353`). Im Bot ist das `bn4net.js` (`ns.exec` an `bn4net.js:2858,2874,3080,3096,3220`).
- `Script/ScriptHelpers.ts:14-58`: `confidence = min(1, onlineRunningTime/14400)`, `expGain = confidence * onlineExpGained/onlineRunningTime * timePassed`; **kein Faktor 0,5 auf Erfahrung** (die 0,5 gelten nur fuer grow/weaken-Zaehler, Zeile 38). Berechnet wird je **gespeichertes laufendes Skript** in `loadAllRunningScripts` (`NetscriptWorker.ts:243-260`), also auch fuer `bn4net.js` mit der gesamten Kindererfahrung. Felder: `onlineExpGained`, `onlineRunningTime` (letzteres wird je Online-Zyklus fuer alle WorkerScripts hochgezaehlt, `NetscriptWorker.ts:~173`).
- Lueckenpunkt der Gutschrift: Mittelwert seit Skriptstart; nach Einbau `onlineRunningTime` = 0. 4a stimmt.
- Arithmetik BN12.2 nachgerechnet: fehlend 1,3e9 - 2,4e8 = 1,06e9; (3,7e8 + 1,06e9)/3,7e8 = 3,9; ln = 1,36; /1,07 = 1,27 h. 4a: 1,3 h. Passt.
- **Offene Annahme:** Umrechnung fehlende Erfahrung -> Stunden unterstellt, dass die Exponentialphase (k = 1-2,7/h) ohne Gutschrift gleich weiterlaeuft und dass Erfahrung der Engpass ist. Geld/RAM binden auch (4a sagt es selbst bei BN8.1). 3/6/10 h bleibt ungeeicht; plausibler Rahmen 2-10 h ueber 9-12 V1-Laeufe (BN8 laeuft jetzt per Roulette ueber andere Wege).
- Zusatz: in V1 gibt es 9-13 Einbauten je Lauf; die confidence beginnt jedes Mal bei 0. Nur Offline-Phasen in den ersten 4 h nach einem Einbau verlieren (4a kennt das).

**Urteil C4/G20: HAELT (Mechanismus), UNSICHER (Stunden). Korrigiert: 2 / 5 / 10 h.**

---

## Winkel 3 - C5 / G13 (Bladeburner offline)

**Ergebnis stimmt, Beleg falsch; Hebel gibt es nicht.**
Ablauf am Quellcode (`engine.tsx:331-332`, `Bladeburner.ts:275-277,1376-1380`, `engine.tsx:118,200-205`):
1. Beim Laden: `storeCycles(numCyclesOffline)`; keine Obergrenze (`clampInteger`, max = MAX_SAFE_INTEGER). Online werden Zyklen **ebenfalls** gespeichert (`engine.tsx:118`).
2. `process()` laeuft alle 5 Zyklen = 1 s real (`Engine.Counters.mechanicProcess = 5`) und verbraucht je Aufruf bis 5 Sekunden Vorrat (`Math.min(seconds, 5)`). **Das sind 5 Spielsekunden je Realsekunde = 5x** - nicht "5 Spielsekunden je Engine-Zyklus (25-fach)" wie in 4a. UI-Text bestaetigt: "up to 5x the normal speed" (`ui/Stats.tsx:198`). Netto-Abbau 4 s/s (1 s/s kommt online nach).
3. Verbraucht wird mit der **jeweils gesetzten Aktion**: `processAction(seconds)` nutzt `this.action`. Direkt nach dem Laden ist das die zuletzt gespeicherte; sobald der Bot laeuft (Skripte starten mit `MainUILoaded`), setzt er jede Runde neu (`nextUpdate` wird nach jedem `process` aufgeloest, `Bladeburner.ts:1411-1415`). Der Bot-Anlauf braucht Sekunden, der Vorrat Stunden - daher richtig: gespielt wird ueberwiegend mit den Entscheidungen des laufenden Bots. "Aktion vor der Nacht waehlen ist kein Hebel": **HAELT**, aus diesem Grund und weil die Gutschrift ohnehin 100 % ist.
4. Gutschrift **100 % Spielzeit** (kein Abschlag im Spielcode). 10 h Vorrat laufen 2,5 h real ab (10 h * 3600 / 4 s/s). Nachgemessen: BN13.2, Rueckkehr 34,83 h, Einbau 34,91; Rate 35,5-37,3 h ca. 2.900 Rang/h Wanduhr = ca. 580 je Spielstunde bei x5 (passt zur Erholungsphase nach Einbau), ab ~37,3 h normal (1.400/h). Das Ende liegt bei 34,9 + 2,5 = 37,4 h. Passt.
5. Die Gutschriftsquoten 0,32/0,46/1,14/1,59 in 4a sind **Fensterartefakte**: 120 min Fenster decken nur 2 h * 5 = 10 h Bonuszeit ab, Vorraete von 8-11 h brauchen 2,0-2,7 h; dazu der Einbau-Einbruch aus 1d. Sie weisen keinen Verlust nach.
6. Die "240 h von 488 h nicht eingeloest" in CHRONIK.md und die "50 %" fallen: im Spielcode gibt es keinen Mechanismus, der Vorrat vernichtet. Verlust nur beim Knotenwechsel (Vorrat verfaellt, folgenlos) und bei Black Ops (laufen nicht von selbst weiter, `Bladeburner.ts:~1311`).

**Urteil C5/G13: Ergebnis HAELT, Zahlenbeleg FALSCH (25x -> 5x; Quote 100 %).**
Korrigierte Zahl G13: **0 / 0 / 0 h**. Messen entfaellt; verwerfen. Wer das Bonuszeit-Fenster trotzdem sehen will, liest `ns.bladeburner.getBonusTime()` einmal beim Start (nichts bauen).

---

## Winkel 4 - G60, G40, G50 (Stichprobe)

**G60 BN3.3 Corp: HAELT als Messung, Ursache enger/anders, Fix schon da.**
- Spielstand (`corp*.js`): BN3.2 Einbau 1 (9,25 h): public, Funds 1,25e12, Umsatz 5,6e9/s, 3 Tobacco-Produkte, 5 Divisionen, 5 Stuecke; BN3.2 Einbau 2: Spielergeld 6,3e10, 17 Stuecke. BN3.3 Einbau 1 (12,7 h): **privat**, Runde 4, Funds 5,5e10, **Tobacco-Umsatz 2,08e6/s (2.700-fach niedriger)**, 2 Divisionen, Spielergeld 1,5e8, 3 Stuecke. BN3.3 Ende: Tobacco 1,8e8/s, Spielergeld 2,8e9.
- 4a: "Boersengang/Dividende muss in jedem BN3-Lauf Geld liefern". Der Befund geht tiefer: das Corp-Geschaeft selbst lieferte kaum Umsatz; privat ist die Folge, nicht die Ursache (Corp-Kasse 5,5e10 war da, ungenutzt). Ursache **nicht belegt** (Tobacco-Produkte 3 in beiden, Umsatz 2.700-fach; Preis/Werbung/Buero?).
- Fix schon vorhanden: `0a14f22` ("Corp-Runde 4 nicht ewig an festem Mindestbetrag haengen lassen", 08.10. 06:06 +0200) lag vor dem ersten BN3.3-Einbau (06:44 Z) und 25 h vor dem Ende, trotzdem blieb Runde 4 privat. Entweder war er nicht aktiv oder nicht die Ursache. Weiterer Fix `2cd6853` (08.10. 17:19) ebenfalls davor. Der Befund "wiederholbar" ist damit **nicht belegt**, aber das Gegenteil auch nicht.
- Nutzen 6/9/11 h online: Spielstandwert (35,9 W gegen 22,7/21,7) stimmt, Zurechnung auf das Corp unbelegt; korrigiert **0 / 6 / 11**, nur BN3, nur wenn die Pipeline in Lauf 2 gleich ausfaellt.

**G40 Sleeve-Vertragswahl: UNSICHER, klein.**
`sleeve.js:~975-985` sortiert nach Vorrat. Die Kommentarbegruendung (Nachschub ~30 Stueck/h je Art, Sleeve verbraucht bis 257/h) bedeutet: stockbegrenzt wird jede Art ohnehin leergefahren, die Reihenfolge aendert die Summe nur am Rand. 4a nennt das selbst ("Endspiel stock-begrenzt = 0"). Die Rang/h-Zahlen (357/563/591) sind Formelwerte, keine Messung. **0 / 1 / 5 h.**

**G50 Kernkauf: HAELT (Code, Kosten), Nutzen bedingt.**
`homegrow.js:108-112`: Kern bei `getUpgradeHomeCoresCost() <= KERN_PREIS_DECKEL` (3e13) und Geld > 1,2 * Preis, ohne Ertragsbezug. Kostenformel `1e9 * 7,5^cores` (`PlayerObjectServerMethods.ts:43`): Kern 2 = 7,5 Mrd, Kern 3 = 56,25 Mrd, zusammen **63,75 Mrd** - deckt sich mit BN9.1. Die Deckelgrenze erlaubt bis 6 Kerne (2,37e13). Kerne wirken nur auf grow/weaken (Hack-Einkommen). Ob dieses Geld in V2 fehlt, ist die offene Engpassfrage (MECHANIKEN 3); Spanne **0 / 1 / 5 h**. Billig (S), kein Gegenrisiko in V2-Knoten ohne Hack-Einkommen -> bauen, hinter G01-Messung nicht blockiert.

---

## Winkel 5 - Was 4a nicht geprueft hat

**Skillkauf (`blade.js:800-1700`): kein belegbarer Fehler.**
- Kaufreihenfolge ist nutzensortiert (`relNutzen/Preis`) mit Sparen statt Ausweichen; Overclock mit `1/(99-stufe) * ausdauerLuft()`, Kostenformeln gegen `Skill.ts` stimmen (`baseCost + Stufe*costInc`, mal BN-Faktor 2/3 in BN13/15).
- Spielstandprobe (`skills.js`): SP = Gesamt - frei stimmen mit Stufen*Kosten*BN-Faktor (BN13.3: 1.362*2 = 2.724 gegen 2.722; BN15: Faktor 3). Skills und Rang bleiben ueber Einbauten erhalten (BN13.2: Rang 9.949 -> 32.523 mit wachsenden Stufen). Kein Verlust, kein Reset.
- Overclock erreicht 90 in 13.3 bei Rang 117k (Stunde 25), in 15.3 erst nach Stunde 33 (Stufe 22 bei Rang 24k). Overclock-Rate 1,1-1,2 %/Stufe bei ~17-23 SP (x2/x3 Faktor) ist 3-4x besser je Punkt als die Chance-Skills, wenn die Ausdauer nicht bindet; der Bot kauft ihn nach der Sortierung nicht erst zuletzt. Die Gegenrechnung 15.3 (Overclock 22 bei SP 7.959, Evasive 25, Reaper 24) ist Sortierungsergebnis mit dem Ausdaeuer-Daempfer, kein Fehler.
- **Verdachtspunkt (nicht als Verlust belegt):** `relNutzen` fuer Reaper/Evasive (`blade.js:~1260-1310`) endet in `chanceProzent + zeitProzent` **ohne** `klemmFaktor()`, waehrend Blade's Intuition/DO/SC/Cloak/Tracer mit Klemmfaktor gedaempft sind. Endzustand: Evasive 151 + Reaper 146 binden ~32 % der SP (BN13.3: 47k von 147k). Wirksam nur dort, wo Chancen < 1 klemmen (Black Ops, ca. 0,9). Der Verlust ist Rang > 117k mit Overclock 90 - dort gibt es keine bessere Verwendung ausser Cyber's Edge/Hands of Midas. Keine Zahl, kein Bauauftrag.
- Hands of Midas (Geld aus Contracts +10 %/Stufe) steht in keinem Plan. Ob Contract-Geld in V2 etwas wert ist, haengt an der Engpassfrage.

**Black-Op-Schwelle: kein belegbarer Fehler.**
Zeit zwischen Rang 400.000 (Daedalus) und Knotensprung: 13.2 0,18 h, 13.3 0,28 h, 15.1 0,02 h, 15.2/15.3 unter 0,15 h (Rang 399.907 / 367.080 beim letzten Sample, Ende < 0,15 h dahinter). Der Block 100k -> 400k dauert 0,7-4,3 h, die Black Ops fallen in ihm nebenher (13.3: Operation K 26,25 h, Hyron 27,9, Annihilus 28,4, Vindictus 29,25 bei Chance 0,36). Die Schwellen 0,90/0,35 kosten nach den Daten hoechstens 0,3 h je Knoten. Auffaellig: 13.3 braucht 4,3 h fuer 100k -> 400k, die anderen vier 0,6-0,9 h (Rate bei Rang 100k: 39-46k/h gegen 100-176k/h). Das ist ein Knoten-Unterschied (BN13), kein Schwellenfehler - die Aktion ist durchgehend Assassination bei Chance 1. Ungeklaert, nicht belegt.

**Nicht geprueft (bleibt offen):** Hacknet/Hashes-Kauf, V1-Spenden, `bn8plan.js`, G02/G03-Rechnung (G03 haengt an G01).

---

## Bereinigte Liste fuer den Bauplan

| Nr | Befund | Nutzen online-h (niedrig / Mitte / hoch) | Eichstatus | Entscheidung |
|---|---|---|---|---|
| G01 | Einbaufrist 12 h als Taktgeber | -10 / 0 / +15 (4a: 0/85/250 W) | Beobachtung ja; Ertrag eines frueheren Einbaus nicht sichtbar; Einbau-Einbruch 1-3 h belegt | **messen**: in einem V2-Knoten Einbau 1 auf 24 h legen oder auslassen und Rate-Rang-Kurve gegen Stufe-0-Verlauf vergleichen. Frist **nicht** kuerzen. |
| G01-Wanduhr | Frist laeuft offline weiter | 0 | an BN13.2 widerlegt | **verwerfen** (hoechstens Randfall dokumentieren) |
| G03 | Interlock 186 min | 0 / 0 / 1 | haengt an G01 | **verwerfen** bis G01 gemessen |
| G02 | Kaufreihenfolge ohne Gang | 0 / 1 / 3 (4a) | Preisformel ja; hier nicht nachgerechnet | **messen** (Ereignisstudie, MECHANIKEN 3) |
| G13/C5 | Bladeburner offline 0/15/40 | 0 / 0 / 0 | Quellcode: 100 %, 5x | **verwerfen** |
| G20/C4 | Offline-Erfahrung V1 | 2 / 5 / 10 | Mechanismus geeicht; Stunden nicht | **bauen, niedrige Prio** (Einbau nicht in die 4 h vor Offline-Phase legen; kein Umbau) |
| G21 | V1-Fruehphase | 0 / ? / 36 (4a) | nein, hier nicht geprueft | **messen** (Ursachenzerlegung RAM/Geld/Ziele) |
| G40 | Sleeve-Vertragswahl | 0 / 1 / 5 | Formelwerte, keine Messung | **messen**, dann ggf. S-Bau |
| G50 | Kernkauf ohne Ertragspruefung | 0 / 1 / 5 | Kosten ja, Nutzen bedingt (Geld-Engpass offen) | **bauen** (S, kein Gegenrisiko) |
| G60 | BN3.3 Corp privat | 0 / 6 / 11 | Spielstand ja, Ursache offen (Tobacco-Umsatz 2.700x); Fix 08.10. vorhanden | **messen**: Corp-Kaltstart-Test, Ursache Tobacco-Umsatz klaeren, dann bauen |
| G10/G11 | Aktionswahl, Black-Op-Schwelle | 0 | Daten: Schwelle kostet <= 0,3 h je Knoten | **verwerfen** (kein Befund) |
| neu | Reaper/Evasive ohne Klemmfaktor | nicht bezifferbar | Code ja, Wirkung nein | **messen** (Verbleib der SP nach Rang 117k; bei Wert ~0 vergessen) |
| neu | Hands of Midas nie gekauft | nicht bezifferbar | nein | **messen** nur falls Geld in V2 bindet |
| G12 | Krankenhaus | unbekannt | Messwert ja | **messen** wie 4a |
| G04-G07, G41-G43, G51-G52 | Negativbefunde | 0 | -- | nicht angefasst; keine Aenderung |
