# G04 Gegenpruefung HACK-1 - share laeuft in V2 ohne Abnehmer (Winkel SUBSTANZ + BETRIEB)

Stand 04.10.2026 13:31 (Systemzeit). Pruefer G04. Streng lesend: `src/` unveraendert, nichts
committet, das Spiel nicht angefasst. Geschrieben nur `tools/audit/verify-g04-*.mjs` und diese Datei.
Der Gate-Test arbeitet auf KOPIEN von `src/` im Scratchpad (der Mock-Lader legt Wegwerfdateien neben
das Original, und die Bruecke schiebt `src/` sonst sofort ins Spiel).

## Kurzurteil

**TEILWEISE.** Der Kern haelt, und zwar mit mehr Ertrag als behauptet. Was nicht haelt: die Herleitung der
Zahl, die Aussage ueber "andere V2-Knoten" (um eine Groessenordnung zu klein) und - gefaehrlich - die
Verallgemeinerung des Fixes. Gilt nur dort, wo `FactionPassiveRepGain = 0` ist, in der Restroute also
**nur BN2.2 und BN2.3**.

| Frage | Ergebnis | Art |
|---|---|---|
| Hat share in BN2 irgendeinen Abnehmer? | **Nein.** Alle Leser von `calculateCurrentShareBonus()` im Spielquellcode gefunden (3 Formeln in `reputation.ts`, Aufrufer: Spieler-FactionWork, Sleeve-FactionWork, Passivruf online + offline). BN2: Passivruf 0, Spieler nie in FactionWork, Sleeves in V2 nie in Faktionsarbeit. 37 von 37 Staenden BN2.1/2.2 ohne Faktionsarbeit; Ruf der Nicht-Gang-Faktionen 40 min lang auf die Einheit konstant | GEPRUEFT, Werkzeug kann den Fall zeigen (s. 2.3) |
| Wirkt share auf Bladeburner-Ruf / Sleeve-Faktionsarbeit? | Bladeburner: nein (kein Leser in `Bladeburner/`). Sleeve-Faktionsarbeit: ja im Spiel (`SleeveFactionWork.ts:36`), aber der Bot setzt sie nur im Hackingweg V1/V1b (`sleeve.js:501`, `setToFactionWork` einzige Stelle `:486`) | GEPRUEFT |
| Code-Behauptung (rep-modus auch bei bladeSperreArbeit, Firmenphase, joinrun) | Stimmt, Zeilen im Bericht veraltet: jetzt `bn4rep.js:2997` (VOR `bladeSperreArbeit()` `:3041`), `:2465` (VOR `:2480`), `joinrun.js:98`. Live: `data/rep-modus.txt` = "Bladeburners|ts", ts 10:17:22Z, Spieler `currentWork` null | GEPRUEFT |
| Ertrag "+0,83 Mrd $/h (+13,4 %)" | Groessenordnung stimmt, **Herleitung nicht**. Mit wirklicher Belegung und geeichtem Modell: **+0,90 bis +1,23 Mrd $/h (+12,0 bis +16,5 %)** am selben Stand 09:59; BN2.2 jetzt **+0,42 bis +0,47 Mrd $/h (+15 bis +16 %)** | GERECHNET_GEEICHT (Mittel), Zuteilung der freien GB angenommen (Spanne) |
| Wert in Stunden | ca. **0,15 bis 0,35 h je BN2-Knoten bis Tor 1**, 0,3 bis 0,7 h fuer BN2.2 + BN2.3 | GESCHAETZT (Umrechnung aus `verify-p2b-geldwert.md` 5E) |
| "Andere V2-Knoten: rund 120 Ruf/h ueber neun Faktionen" | **Falsch um ~20x.** 120-150 Ruf/h ist der Boden (1/120 je Zyklus) bei Favor 0, den share gar nicht anhebt. Mit Favor ~100 sind es ~2.100-2.700 Ruf/h je Faktion, davon ~460-540 Ruf/h (+22-25 %) durch share | GERECHNET_GEEICHT an BN10L3 (Ist/Soll 0,85-0,95) |
| Fix "nur bei FactionWork/Sleeve-Faktionsarbeit" | **Nur fuer Passivruf 0 richtig.** In BN3/6/7/11/13/14/15 nahme er die +23 % auf die Hauptrufquelle weg; ob Ruf dort bindet, ist ungemessen | ABGELEHNT in der Breite, BN2-Gate vorgeschlagen |

## 1. Rechner und Eichung (Soll = unabhaengig bekannter Wert, Ist = Rechner)

Alle in `tools/audit/`, lesen nur. Modell = Formeln des Bots (`src/lib/calc.js`), deren Treue gegen
`ns.formulas` schon im Spielstand belegt ist (`data/calccheck.txt`, 0,000 % auf zehn Zielen).

| Rechner | Soll | Ist |
|---|---|---|
| `verify-g04-calib.mjs BN2L1`: Modell mit **wirklicher Belegung je Ziel** (laufende Worker nach `args[0]`, Stapelziele aus `data/bn4net.json`) gegen gemessene Hackeinnahme (`moneySourceA.hacking` Delta / `playtimeSinceLastBitnode` Delta; Paare exakt 3600,0 s Wand = Spielzeit) | gemessen 1,04-4,09 M$/s | r = gemessen/Modell: **Median 0,937**, Mittel 0,931 +- 0,083 ueber 16 saubere Stundenpaare; 04.10. 00:17-06:17 sechs Paare **0,934-0,956** bei Netz 10.700 -> 15.900 GB und Level 400 -> 434 (also stabil ueber eine Verdopplung der Flotte = Test, dass zusaetzliche GB mit Modelleffizienz x r realisiert werden). Erste Stunde nach Einbau/Neustart schwaecher: 0,75-0,87 |
| `hack-park.mjs` (Bericht) neu gelaufen | r = 0,653 | **0,653 reproduziert**, aber die Annahme dahinter ist falsch (s. 3.1) |
| share-Deckel `bn4net.js:2241` | `floor(0,12 x 8860 / 4,0)` = 265 | Stand 09:59: **265 Faeden, 1060 GB** (4,00 GB/Faden aus `ramUsage`); Mock 20.000 GB: 600 = `floor(0,12 x 20000 / 4)` |
| Passivruf BN2 (`BitNode.tsx:581`, `FactionHelpers.tsx:134`) | 0 Zuwachs | `verify-g04-repverlauf.mjs`: Sector-12 4503, CyberSec 3669, Tian Di Hui 2212, Netburners 1379, NiteSec 8114, Black Hand 872 - **identisch** in den Staenden 09:19, 09:33, 09:46, 09:59 (40 min). Waere der Boden 1/120 je Zyklus aktiv, waeren es +100 je Faktion |
| Passivformel (`FactionHelpers.tsx:132-170`) an BN10L3 (V2, Passivruf 1), Stand 10.09. 08:17, 12,7 h seit Einbau, S = 1,2467 | gemessen Ruf/h: Aevum 3017, Sector-12 2706, Tian Di Hui 2742, CyberSec 3217 | Formel: 2638 / 2577 / 2336 / 2735 -> **Ist/Soll 0,87 / 0,95 / 0,85 / 0,85** (der Rest sind Vertraege u. a.; passiv traegt >= 85 %) |
| share-Bonus 265 Faeden, int 153, home 2 Kerne | - | S = 1 + ln(327)/25 = **1,2317** (`verify-g04-passiv.mjs`) |

## 2. Befund an Datei:Zeile (HEAD f1bee88, master)

### 2.1 Bot

- `src/bn4net.js:2167-2172`: share an, wenn `data/rep-modus.txt` juenger als 120 s. Deckel `:2239-2242`
  (12 % von `ramTotal`, 4,0 GB/Faden). Abbau `:2632-2636` (`if (!repModus) scriptKill`), Aufbau `:2646-2661`.
- `src/bn4rep.js:2997-2998` schreibt die Datei in JEDER Runde VOR der Abfrage `bladeSperreArbeit()` (`:3041`;
  Log "Faktionsarbeit ausgesetzt" alle 5 min, `:3057-3059`). Ebenso Firmenphase `:2465` (vor `:2480`) und
  `joinrun.js:98`. Geloescht nur `:950` (nichts mehr zu holen), `:2458`, `:3080`.
- `src/worker/share.js:5-11` sagt selbst, share duerfe nur mit Faktionsarbeit laufen.
- `workForFaction` hat im ganzen Bot **einen** Aufrufer (`bn4rep.js:3063`), `workForCompany` einen (`:2485`);
  beide hinter `bladeSperreArbeit()`. `setToFactionWork` nur `sleeve.js:486` (Hackingweg).
- Die Datei hat drei Leser, nicht einen: `bn4net.js:2168` (share), `bn4life.js:556-558` (Bremse gegen Verbrechen,
  zusaetzlich `!inDivision`), `sleeve.js:396` (Kandidaten, nur Hackingweg). Wer die Datei umschreibt, bricht
  die anderen beiden - Fix gehoert in `bn4net` (s. 6).
- Alt-Starter `src/share.js`/`autopilot.js:1001-1050`: nicht im Laufsatz (ps-Liste 12:17 ohne autopilot), ohne Belang.

### 2.2 Spielquelle 3.0.2 (alle Leser von getSharePower)

`calculateCurrentShareBonus()` steht nur in `PersonObjects/formulas/reputation.ts:22,34,48` (hacking-, security-,
field-Ruf je Zyklus). Aufrufer dieser drei Formeln:

| Aufrufer | Stelle | in BN2/V2 des Bots |
|---|---|---|
| Spieler-FactionWork | `Work/FactionWork.tsx:39` | nie (Sperre) |
| Sleeve-FactionWork | `PersonObjects/Sleeve/Work/SleeveFactionWork.ts:36` | nie (nur Hackingweg) |
| Passivruf online | `Faction/FactionHelpers.tsx:132-170`, Abbruch `:134` bei `FactionPassiveRepGain === 0`; `engine.tsx:177-181` | **0 in BN2** (`BitNode.tsx:581`) |
| Passivruf offline | `engine.tsx:284` `Player.bitNodeN !== 2` | BN2 ausgenommen |
| `ns.formulas.reputation`, UI | `NetscriptFunctions/Formulas.ts:409`, `Faction/ui/ShareOption.tsx` | nur Rechnung/Anzeige |

Nicht betroffen: Firmenarbeit (`Work/Formulas.ts:124-158` kennt share nicht), Bladeburner (`Bladeburner/*.ts`
ohne share; "Bladeburners" ist `special`, kein Passivruf: `FactionHelpers.tsx:147`), Gang (kein Passivruf fuer
Gangs `:151`; Gang-Ruf aus Respekt), Infiltration, Vertraege, Spenden. `share()` selbst gibt keine Erfahrung
(`NetscriptFunctions.ts:384-393`). `getSharePower` liest kein Skript in `src/`.

### 2.3 Sensitivitaet der Negativbefunde (kann das Werkzeug den Fall zeigen?)

- `verify-g04-sleeves.mjs` zeigt `SleeveFactionWork:<Faktion>` in BN5L3 (Aevum, Daedalus, Tetrads, Clarke ...) und BN12L3 -
  in BN2L1/L2 in **keinem** der 37 Staende (Spieler `currentWork` null; Sleeves nur Class/Infiltrate/Bladeburner).
- `hack-verlauf.mjs` zeigt `FactionWork:CyberSec/Black Hand/NiteSec` in BN12L3.
- Passivzuwachs waere im Ruf-Verlauf sichtbar (BN10L3: ~2.000-3.000/h je Faktion).

## 3. Was am Bericht nicht haelt

### 3.1 Die Realisierungsquote r = 0,653 ist ein Artefakt - die Zahl ueberlebt trotzdem

`hack-park.mjs` fuellt die Segmente "nach Effizienz" und belegt dabei **the-hub (1666 GB, Modell 427 $/GB*s)** -
im Stand 09:59 laufen dort **0 GB** (`verify-g04-ziele.mjs`: omega-net 4065, silver-helix 1956, phantasy 338,
joesguns 324 Ofen, max-hardware 61). Das ist HACK-4 (Rang 0 wegen Vorbereitung) und steht im selben Bericht.
Zudem enthaelt das Eichfenster 09:33-09:59 den Neustart 09:46 (Paar 09:33->09:46 r 0,85; 09:46->09:59 r 0,75).
Mit wirklicher Belegung und sauberen Fenstern ist r = 0,94. Das Modell bei Ist ist 2,22 M$/s statt 2,65 M$/s.
Die falsche Belegung drueckt r um ~30 %; zugleich setzt der Bericht den Zuwachs auf Segmente 326 statt der
tatsaechlich naechsten 251-344: **die Fehler heben sich fast auf**. Neu gerechnet (3.2) liegt der Ertrag darueber.

### 3.2 Der Eichvergleich "Grenzeffizienz 224 gegen Bot effFlotte 227" ist keiner

`effFlotte` ist der Mittelwert der **Modell**-Gleichgewichtseffizienz der laufenden offenen Ziele
(`bn4net.js:3179-3186`), nicht gemessen; ebenso "amortisiert in 339 s" (`grenzErtrag`, `:363-381`, ohne r).
Beide enthalten keine Messgroesse. Gemessen ist nur die Hackeinnahme.

### 3.3 Der Passivruf anderer V2-Knoten ist um ~20x zu klein angesetzt

`favorMult = min(0,1; favor/1000 + 0,01)` UND `hRep` enthaelt `(1 + favor/100)`: der Zuwachs wachst quadratisch
mit dem Favor, 0,01 -> 0,2 (Faktor 20). Bei Favor 0 gilt der Boden `1/120` je Zyklus = **150 Ruf/h je Faktion,
unabhaengig von share**. BN10L3 (V2): Favor 91-124, **2.100-2.700 Ruf/h je Faktion**, share-Anteil 462-541 Ruf/h
je Faktion (+22-25 %). Die "12 %" sind der RAM-Anteil; der Bonus ist 1 + ln(327)/25 = **+23 %**.

## 4. Ertrag neu gerechnet

`verify-g04-szenario.mjs <stand> <r>`: wirkliche Belegung + wirkliche Restaufnahme der Ziele
(Stapel: `kalenderPlaetze x stapelGb - belegtGb` aus `data/bn4net.json`; offen: `kapazitaet - Belegung`).
Die freien share-GB gehen (a) "mix" in Bot-Reihenfolge (`BATCH_ANTEIL 0,6` je Runde, `bn4net.js:2804`),
(b) "unten" alles an das schlechteste Ziel mit Restaufnahme, (c) "oben" an das beste. r = 0,935 (BN2.1) bzw. 0,86-0,935 (BN2.2).

| Stand | Netz GB | share GB | mix | unten | oben | % der Hackeinnahme (unten-oben) |
|---|---|---|---|---|---|---|
| BN2.1 03.10. 09:59 (Stand des Berichts) | 8860 | 1060 | +1,01 | +0,90 | +1,23 | 12,0-16,5 |
| BN2.1 04.10. 10:17 | 8900 | 1064 | +1,50 | +1,28 | +2,12 | 13,9-23,0 |
| BN2.1 04.10. 05:17 (Netz gross) | 14348 | 1716 | +1,86 | +1,43 | +2,98 | 11,9-24,7 |
| BN2.2 04.10. 13:17 (jetzt) | 5868 | 700 | +0,43..0,47 | +0,42..0,45 | +1,14..1,24 | 15,4-42 |

(Mrd $/h; "oben" ist eine harte Obergrenze, in BN2.2 durch die Aufnahme des einen Ziels `phantasy` nur 763 GB breit -
nicht erreichbar.) Frisch-Knoten-Verlauf BN2.1 Zyklus 2 (12 h, Netz 7.000 -> 16.000 GB): Summe mix **14,9 Mrd**, unten **11,6 Mrd**
(`verify-g04-szenario.mjs` je Stundenstand); die ersten 5 h eines Knotens (Netz 7-8k GB): +0,75 bis +1,2 Mrd $/h.

**Korrigierter Ertrag:** +0,4-0,5 Mrd $/h in BN2.2 jetzt, +0,9-1,9 Mrd $/h bei der Netzgroesse von BN2.1 (9-14k GB),
rund **+12 bis +16 % der Hackeinnahme**; ca. **8-12 Mrd $ je Knoten bis zum ersten Tor** (13 h).

**Umrechnung in Stunden** (nicht neu geeicht, aus `verify-p2b-geldwert.md` 5E): +47 Mrd bringen aus 36 Mrd Basis +1,6 h,
aus 75 Mrd +0,7 h, also 0,034-0,015 h je Mrd. 8-12 Mrd -> **0,15-0,35 h je Knoten**, BN2.2 (Rest ~10 h) + BN2.3 zusammen
**0,3-0,7 h**. Klein, aber der Bau ist Zehn-Zeilen-Arbeit und ohne Gegenwirkung. Wirkt zusaetzlich verstaerkt, wenn HACK-2/INFRA-1
(Park) behoben ist: share bleibt 12 % von `ramTotal`.

Offene Unsicherheit: WO die freien GB landen, ist nicht gemessen (Spanne unten-oben). Die Bot-eigene Grenzkurve
(`mischung.grenz` 338/295/193 fuer 1024/4096/16384 GB, Modelleinheiten) deckt "mix". Nach dem Bau messen (s. 7).

## 5. Gilt / gilt nicht (Bedingungen)

| Knoten der Restroute | Passivruf (`bitnodes.json`) | share ohne Abnehmer? | Aenderung |
|---|---|---|---|
| BN2.2, BN2.3 (V2) | **0** | **ja** (kein Spieler-/Sleeve-FactionWork, Passivruf 0) | share aus |
| BN3, BN11, BN6, BN7, BN13, BN14, BN15 (V2) | 1 | **nein**: Passivruf +23 % auf Hauptquelle, ab Favor ~25 messbar; Bindung von Ruf ungemessen | **unveraendert lassen**, eigener Pruefauftrag "Ruf gegen Geld" |
| BN8 (V1), BN1/5/12 (V1) | 1 / 0,98 | Spieler und Sleeves arbeiten fuer Faktionen | unveraendert |

Nicht Teil dieser Entscheidung: share waehrend der Firmenphase in V1 - Firmenarbeit hat keinen Nutzen, aber die Sleeves
arbeiten dort weiter fuer Faktionen (BN12L3: `CompanyWork` neben `SleeveFactionWork:Daedalus`). Nicht gemessen.

## 6. Fehlermodi im unbeaufsichtigten Betrieb

| # | Modus | Bewertung |
|---|---|---|
| 1 | Datei `rep-modus.txt` umschreiben/umbenennen (Fix des Berichts) | **Falsch.** bn4life (Verbrechens-Bremse) und sleeve.js lesen sie. Gate bleibt in `bn4net.js`, bn4rep unberuehrt |
| 2 | Tabelle `lib/bitnodes.json` nicht lesbar / Feld fehlt | Standard 1 -> share wie bisher. Sicherer Ausfall (verliert nur den Gewinn). Tabelle wird einmal je Prozess gelesen (`:109-153`); steht sie beim Boot nach dem Sprung noch nicht da, bleibt der Prozess bis zum Neustart im Altverhalten |
| 3 | `Number.isFinite(0)` | Der Eintrag BN2 ist **0**; ein `if (k.FactionPassiveRepGain)` laese ihn als fehlend. Gate mit `Number.isFinite` und `=== 0` |
| 4 | Rolle noch unbekannt direkt nach Sprung (`data/verfahren.txt` kommt Sekunden spaeter) | Gate faellt auf "an", die naechste Runde (10 s) raeumt (`:2632`). Harmlos |
| 5 | Spaetere Freigabe von Faktionsarbeit in V2 (FAKT-5/G25) | Gate wuerde share abschalten, obwohl Abnehmer da: dann Beleg-Datei nachziehen (Bauvorgabe Stufe 2); der Test aus 7 sollte das als Merkposten tragen |
| 6 | Freie GB werden nicht aufgenommen -> `ueberschussGb` > 5 % von `ramTotal` -> `grenzErtrag` = 0 -> Parkausbau stoppt (`bn4net.js:1493`) | Heute nicht der Fall (Aufnahme frei: `kapFreiGb` 15-17k GB, Stapelkalender zu 20-50 % belegt). Nach dem Bau `ueberschussGb` pruefen |
| 7 | Neustart-Rampe | Hotswap von bn4net kostet ~13 min mit r 0,75-0,85 (gemessen 09:46; aehnlich die erste Stunde nach Einbau 07:17, r 0,75), ca. 0,3-0,5 Mrd $. Mit dem naechsten ohnehin faelligen bn4net-Neustart (G03/INFRA-1) zusammenlegen |
| 8 | Wanduhr/Throttle | Das Gate nutzt keine eigene Uhr (nur die schon vorhandene 120-s-Frische von rep-modus.txt, die es in BN2 umgeht). Ob share im gedrosselten Tab heute an/aus flackert (bn4rep > 120 s ohne Schreiben), ist NICHT gemessen |
| 9 | RAM-Eichung | keine neue ns-Funktion, `ns.read`/`fileExists` schon vorhanden: kein Eichlauf noetig, aber Pflicht-`test-alles` |

Laufzeit-Frage "Laeuft der Code weiter, wenn niemand hinsieht?": **ja** -> Skeptiker-Lauf Pflicht, `[skeptiker]` im Commit.

## 7. Bauvorgabe (konkret)

**Stufe 1 (Pflicht, nur `src/bn4net.js`, ~6 Zeilen, kein Eingriff in bn4rep/bn4life/sleeve):**

1. `bn4net.js:125` nach `let bnServerWeakenRate = 1;` ergaenzen: `let bnFactionPassiveRepGain = 1;`
2. `bn4net.js:152` im Block `if (k) {...}`: `if (Number.isFinite(k.FactionPassiveRepGain)) bnFactionPassiveRepGain = k.FactionPassiveRepGain;`
3. `bn4net.js:2172` VOR `const shareBraucht = ...`:
   `if (repModus && bnFactionPassiveRepGain === 0 && regLage.verfahren === "V2") repModus = false;`
   mit Kommentar: Passivruf 0 und Kampfrolle -> share hat keinen Abnehmer (reputation.ts:16-52, FactionHelpers.tsx:134);
   Faktionsarbeit im Kampfknoten ist gesperrt (bn4rep.js:3041). Wer sie je freigibt, muss share dort wieder anbinden.
4. Telemetrie: `bnWerte` (`bn4net.js:4396`) um `factionPassiveRepGain` ergaenzen; `shareFaeden` steht schon dort (`:4415`).
5. Test: `tools/test-share-gate.js` (neu, in `test-alles` eintragen) nach dem Muster von `tools/audit/verify-g04-gate.mjs`
   (7 Proben, laeuft gegen den ECHTEN bn4net im Mock): BN2/V2 kein share-Start und laufende Faeden werden beendet; BN5/V1,
   BN6/V2, BN12/V1, BN2/V1 unveraendert (gleiche Faedenzahl wie vorher).
6. Einspielen mit dem naechsten bn4net-Neustart; `[skeptiker]` im Commit.

**Stufe 2 (nur wenn Faktionsarbeit in V2 freigegeben wird):** `bn4rep.js` schreibt `data/share-bedarf.txt` (Stempel) erst nach
erfolgreichem `workForFaction` (`:3063`) bzw. im Zweig `arbeitetSchon` (`:3084`); Gate in `bn4net` dann
`!(Passivruf == 0 && V2) || bedarfFrisch(120 s)`. Nicht jetzt: bn4rep ist 68,5 GB, P2e arbeitet daran.

**Abnahme live (nach Stufe 1):**
- `data/bn4net.json` `shareFaeden` 0 innerhalb von 1-2 Runden (10-20 s); `ps` ohne `worker/share.js`.
- `ueberschussGb` bleibt ~0, `restGb` ~0, `kapFreiGb` fuellt sich (silver-helix/omega-net belegtGb steigt).
- Hackeinnahme: Rechner `verify-g04-calib.mjs <Muster>` (r bleibt 0,93-0,95) und Vorher/Nachher-Stundenpaar ohne Einbau/Neustart:
  erwartet +12-16 % (BN2.2 jetzt ~+0,4-0,5 Mrd $/h, bei Netz 9k GB ~+1 Mrd $/h). Die erste Stunde nach dem Neustart nicht zaehlen.
- Gegenprobe: `data/rep-modus.txt` wird weiter geschrieben (bn4life-Bremse), `bn4rep-log` unveraendert.

## 8. Gegenbeleg-Suche (was ich zu widerlegen versuchte)

- Abnehmer suchen: Spielquelle (alle Leser), Bot (alle `workFor*`, `setToFactionWork`), 37 Staende Spieler + 3 Sleeves, Rufverlauf. Nichts gefunden - das Werkzeug zeigt den Fall in BN5/BN12.
- Ertrag widerlegen: r neu geeicht (0,94 statt 0,653), Belegung statt Annahme; Ergebnis hoeher, nicht niedriger.
- Fix widerlegen: BN10L3-Eichung zeigt Passivruf in V2 mit Abnehmer -> Fix nur BN2-gebunden.
- Offen und nicht widerlegbar ohne Messung: Verteilung der freien GB (Spanne unten/oben) und ob Ruf in BN3/6/7/... bindet.

## 9. Dateien

`tools/audit/verify-g04-calib.mjs` (Eichung r), `verify-g04-szenario.mjs` (Ertrag), `verify-g04-ziele.mjs` (Belegung je Ziel),
`verify-g04-sleeves.mjs` (Arbeit Spieler/Sleeves je Stand), `verify-g04-repverlauf.mjs` (Ruf-Verlauf), `verify-g04-passiv.mjs`
(Passivformel gegen BN10L3), `verify-g04-shareverteilung.mjs`, `verify-g04-files.mjs`, `verify-g04-gate.mjs` (Gate-Test im Mock, 7/7 gruen).
Lauf Gate-Test: `node tools/audit/verify-g04-gate.mjs <scratchdir>`.
