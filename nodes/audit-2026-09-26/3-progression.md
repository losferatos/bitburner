# Audit 3 - Progressionsentscheidungen (Augs, Einbau, Faktionen, Ausgang)

Grundlage: Spielquelle v3.0.2 (`reference/bitburner-src/src`), Bot `src/`, Spielstaende
`C:\Users\erche\bitburner-backups\*BN5L2*`, `*BN1L2*`, `*BN1L3*` (darin die Spiel-Logs
`data/bn4rep-log.txt`, `data/rep-ziel.txt`, `data/einbau.json`, `data/joinrun.txt`).
Rechnungen: `scratchpad/audit/calc.js`, geeicht gegen den Spielstand:
Favor BitRunners 209,1288 + 1.030.505 Rep -> 234,5849 (Spielstand 234,59); Spendenrest
bei Favor 140,678 -> 82.172 (Log: 82.172); skill(1,4237e8; 7,1655) = 2871 (Spielstand 2871),
skill(3,667e8; 9,0365) = 3895 (Spielstand 3895).

Welche Skripte zaehlen: Live laufen `bn4rep.js` (Kauf, Einbau, Arbeit, Spenden),
`bn4life.js` (Beitritte, Reisen, joinrun), `bn4door.js`, `ausgang.js`/`exit.js`,
`homegrow.js`. `buyaugs.js`, `kaufplan.js`, `install.js`, `donate.js`, `favorweg.js`,
`daedalus.js` stehen in keiner Registry und laufen nicht.

Stand beim letzten Spielstand (18:04, BN5.2): 35 Augs installiert, Daedalus beigetreten
(17:26, 7 min nach dem Einbau), Arbeit auf Daedalus-Spendenschwelle: 183.012 von 460.961,
gemessen 4.791,6 Rep/min -> Schwelle gegen 19:02. Guthaben 6,66 Bio, Warteschlange leer.

---

## Befunde

### 1. Der Fokus geht verloren und niemand holt ihn zurueck - rund die Haelfte der Faktionsarbeit laeuft mit x0,8

- **Bot:** `src/bn4rep.js:2027` (`arbeitetSchon` vergleicht nur den Faktionsnamen), `:2095`
  (`workForFaction(..., true)` nur beim Zielwechsel). Kein Aufruf von `isFocused`/`setFocus`
  in `src/` (grep leer).
- **Spiel:** `Work/FactionWork.tsx:37-39` (Rate x `focusPenalty()`),
  `PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628` + `Constants.ts:87`
  (`BaseFocusBonus 0.8`, ausser mit Neuroreceptor Management Implant),
  `ui/GameRoot.tsx:271-273` (jede Navigation weg von der Arbeitsseite ruft `stopFocusing()`),
  `NetscriptFunctions/Singularity.ts:533-551` (`isFocused`, `setFocus`).
- **Was falsch ist:** Irgendein UI-Zugriff (Navigation) entfokussiert. Weil bn4rep nur bei
  Faktionswechsel neu startet, bleibt der Zustand stundenlang so.
- **Belegt:** In BN5.2 stehen **8 von 15 stuendlichen Sicherungen** mit laufender
  Faktionsarbeit auf `focus: false` (ueber alle 25 FACTION-Stichproben 12). Durchgehend
  unfokussiert von 09:04 bis 12:53 (BitRunners, vier Stichproben in Folge). NMI ist nicht
  installiert.
- **Konsequenz:** Mittlere Rate 1 - 0,53 x 0,2 = **x0,893**. Allein die Strecke 09:04-12:53
  (3,8 h BitRunners-Arbeit) hat 3,8 h x 0,2 = **~46 min Arbeitszeit** gekostet. Hochgerechnet
  auf einen V1-Knoten, dessen Takt fast ueberall an Faktionsreputation haengt, liegt der
  Verlust in der Groessenordnung einer Stunde (plausibel; der Faktor 0,8 selbst ist Code).
- **Sicherheit:** belegt (Zustand und Formel), Hochrechnung plausibel.
- **Fix:** In jeder bn4rep-Runde bei laufender Faktionsarbeit `if (!ns.singularity.isFocused())
  ns.singularity.setFocus(true)` (Achtung: `setFocus` schaltet die Seite auf "Work", mit den
  UI-Skripten abstimmen); alternativ NMI (Tian Di Hui, 75k Rep) mit ln(1/0,8) bewerten, wie
  es `buyaugs.js:629-631` schon tat.

### 2. Spendenrechts-Einbau wartet auf ein Nicht-NFG-Stueck - 37 min in BN5.2, kehrt in jedem Knoten wieder

- **Bot:** `src/bn4rep.js:593` (NFG wird nie Kandidat), `:1121-1122` (`spendenAusnahme`
  verlangt `wartend >= 1`), `:1219-1225` (Einbauschranke); NFG wird nur im Einbaublock
  `:1290-1312` gekauft, also erst nachdem die Entscheidung schon gefallen ist.
- **Spiel:** `Augmentation/AugmentationHelpers.ts:69-73` (leere Warteschlange: kein Einbau),
  `:133-136` (NFG-Rep 500 x 1,14^Stufe x AugmentationRepCost),
  `Faction/formulas/favor.ts:12-24`.
- **Was falsch ist:** Erreicht eine Faktion die Spendenschwelle und liegt nichts in der
  Warteschlange, arbeitet der Bot weiter, bis zufaellig ein regulaeres Stueck verdient ist.
  Eine NFG-Stufe wuerde die Schranke oeffnen, wird aber nicht gekauft.
- **Belegt (BN5.2, Log 16:37):** 15:15:55 "BitRunners SPENDENRECHT: 17 von 82172". Rate
  3.073,4 Rep/min -> Schwelle erreicht nach 82.172 / 51,2 = **26,7 min (~15:42)**. NFG-Stufe 44
  braucht 500 x 1,14^43 = **139.920 Rep** -> kaufbar nach 45,5 min (**~16:00**), Preis
  750k x 1,14^43 x 2 = 420 Mio bei 4 Bio Guthaben. Eingebaut wurde erst **16:37** (CSP V bei
  250k Rep, Grund-Text "naechste Huerde erst in 4525" - der eigentliche Ausloeser war das
  Spendenrecht, der Text ist irrefuehrend). Danach war alles bei BitRunners eine Geldfrage
  (16:44-16:57 per Spende gekauft).
- **Konsequenz:** 16:37 - 16:00 = **37 min** Stillstand vor dem Regimewechsel (55 min, wenn man
  ab der Schwelle rechnet). Dieselbe Lage entsteht in BN5.3 und in BN12.1-3 bei BitRunners
  (und bei jeder Faktion, deren naechstes Stueck ueber der Schwelle liegt).
- **Sicherheit:** belegt.
- **Fix:** Wenn `spendenrechtFaellig && wartend === 0`: sofort das billigste kaufbare Stueck
  oder eine NFG-Stufe kaufen (Rep bei irgendeiner Mitgliedsfaktion >= NFG-Bedarf, ggf. per
  Spende bei einer 150er-Faktion) und einbauen.

### 3. Vorzeitiger Einbau, weil die eigenen Spenden das Konto leeren - trifft jede Red-Pill-Phase

- **Bot:** `src/bn4rep.js:751-754` (`naechstesUnbezahlbar = naechstes.preis > geld * 4`),
  `:777` (`geldWegZu`), `geld` gelesen in `:548` zu Rundenbeginn; Spenden in `:2011-2021`
  (`verfuegbar = Geld - teuerstesVerdiente`) leeren das Konto am Ende der Vorrunde.
- **Spiel:** `Faction/formulas/donation.ts:8-14,25-35` (Spende = Geld weg, Rep sofort),
  `AugmentationHelpers.ts:157` (Preis x1,9^q).
- **Was falsch ist:** Der Ausloeser vergleicht Preise mit dem Kassenstand direkt nach einer
  Spende, nicht mit dem Zufluss. `naechstes` ist das Stueck mit der kleinsten Rep-Luecke,
  unabhaengig von Wert und davon, dass bei einer Spendenfaktion die Luecke gar keine Zeit,
  sondern nur Geld ist. Es gibt kein Modell "Einbau jetzt vs. in x Minuten".
- **Belegt:**
  - BN5.2 16:57:10 "naechstes Stueck (Neuralstimulator) kostet 41154m bei 2598m Guthaben".
    Einkommen aus dem Spendentakt 4,1 Mrd / 16 s = 256 Mio/s. Das Rangziel #1 war ENM Core V2
    ("sek 140"), die fehlende Spende 12,5 Mrd. ENM Core V2 bei q=3: 4,5e9 x 2 x 1,9^3 =
    61,7 Mrd, Neuralstimulator bei q=4: 78,2 Mrd. Warten: (12,5 + 61,7 + 78,2) Mrd / 256 Mio/s =
    **9,9 min**. Stattdessen Einbau und ein zusaetzlicher Zyklus 16:57 -> 17:19 (**22 min**)
    nur fuer diese Stuecke.
  - BN1.3 00:23:13 "ENM DMA kostet 48013m bei 1502m" - mitten im Spenden fuer The Red Pill
    (1.620.114 Rep fehlten). Rep je Mrd aus dem Log: 113.718 Rep fuer 33,97 Mrd -> fehlende
    Red-Pill-Rep = **484 Mrd**; Zufluss 00:21:27-00:23:12 = **1,80 Mrd/s** -> Red Pill nach
    **4,5 min** bezahlt. Tatsaechlich: Einbau 00:23, erneuter Beitritt/Spenden, Red Pill erst
    00:31, Einbau 00:36, Sprung 00:39 - rund 8-10 min verloren.
  - Weitere Ausloesungen durch wertlose Stuecke: BN1.3 21:54 (Magnetism Amplifier, nur
    company_rep, 20 min nach dem vorigen Einbau), BN1.2 20:08 (LuminCloaking-V1).
- **Konsequenz fuer jetzt:** Nach dem Daedalus-Favor-Einbau (~19:02) folgt das Spenden fuer
  Red Pill (2,5 Mio Rep ~ 0,8 Bio). Analyze Engine (625k), Synthetic Heart (750k), NEMEAN
  (875k) werden unterwegs gekauft -> `wartend = 3` -> derselbe Fehlausloeser wie BN1.3 00:23.
  In BN5 kostet jeder ueberfluessige Zyklus Wiederbeitritt (Hacking 2500 + 100 Mrd, zuletzt
  7 min) plus neues Spendengeld: ~10-20 min je Vorfall.
- **Sicherheit:** belegt (drei Vorfaelle mit Log), Prognose plausibel.
- **Fix:** `naechstesUnbezahlbar`/`geldWegZu` gegen `geld + Zufluss x Horizont` pruefen,
  nur Stuecke mit Wert > 0 zulassen, und beide aussetzen, solange bei einer Faktion mit
  Favor >= Spendenschwelle ein Ziel per Spende laeuft (letzte Spende < 2 Runden her).

### 4. The Red Pill in der Warteschlange erzwingt keinen Einbau - Stillstandsrisiko

- **Bot:** `src/bn4rep.js:1219-1225` (Einbau nur bei `wartend >= 3` oder Spendenrechts-
  Ausnahme), `:331` (`MINDEST_WARTESCHLANGE = 3`); `EXIT_KEY_VALUE = 10` (`:146`) wirkt nur auf
  die Zielwahl, nicht auf den Einbau.
- **Spiel:** `Prestige.ts:173-181` (w0r1d_d43m0n haengt erst nach dem EINBAU am Netz).
- **Was falsch ist:** Ist Red Pill gekauft und liegen weniger als zwei weitere Stuecke daneben,
  wird nicht eingebaut. Daedalus hat dann Favor >= 150, `spendenrechtFaellig` ist falsch, die
  Ausnahme greift nicht.
- **Beleg fuer die Naehe:** In BN1.2 (11:55) und BN1.3 (00:36) lagen neben Red Pill genau
  ENM DMA, ENM Core V3 und **PCMatrix** - PCMatrix (Aevum, 100k Rep, Wert 0,075) war das
  dritte bzw. vierte Stueck, das den Einbau ueberhaupt erlaubte (00:36:09 gekauft, 00:36:11
  Einbau). Nimmt der Fehlausloeser aus Befund 3 vorher DMA und V3 mit, bleibt Red Pill mit
  hoechstens einem Begleiter liegen. Dann arbeitet der Bot erst Wert-0,075-Stuecke ab; ist
  auch PCMatrix schon eingebaut, ist `offeneNuetzliche` leer, `:645-646` startet die
  Firmenphase (Clarke, 300k Firmenrep) samt Einbausperre (`:1530-1531`) - Stunden fuer ein
  Stueck, das einen Einbau entfernt liegt.
- **Sicherheit:** plausibel (Pfad aus dem Code, Vorbedingung in zwei Laeufen knapp verfehlt).
- **Fix:** `if (alleAugs.includes("The Red Pill") && !eingebauteAugs.includes("The Red Pill"))`
  -> NFG-Aufstockung und sofortiger Einbau, unabhaengig von `wartend` und den ODER-Gruenden.

### 5. `favorLohnt` ohne Relevanzpruefung - baut fuer Faktionen ein, bei denen nichts mehr zu holen ist

- **Bot:** `src/bn4rep.js:997-1008` (jede Mitgliedsfaktion mit >= 1000 Rep, Schwelle 1,25);
  vergleiche `:1028-1029`, wo `spendenrechtFaellig` genau diese Pruefung hat.
- **Spiel:** `PersonObjects/formulas/reputation.ts:8-14` (Favor wirkt nur auf ARBEIT),
  `Faction/formulas/donation.ts:8-10` (Spende haengt nicht vom Favor ab).
- **Was falsch ist:** Der Favorgewinn zaehlt auch bei Faktionen, deren Katalog leer ist, und bei
  Faktionen, die schon spenden duerfen - dort ist Favor wertlos. Er ist in beiden BN1-Laeufen
  und BN5.2 der haeufigste Einbaugrund (21 von 31 Einbauten; ein Teil davon zu Recht).
- **Belegt:** BN1.2 11:43 "Favor bei Daedalus hebt die Reputationsrate um 26 Prozent" bei
  Daedalus-Favor 150,6 - Einbau mit 3 Stuecken, Red Pill erst im naechsten Zyklus (11:55),
  Sprung 11:58; derselbe ~10-min-Verlust wie in Befund 3. BN5.2 17:19 "Favor bei The Black
  Hand +25 %" zwei Sekunden nach dem Kauf des letzten Black-Hand-Stuecks (Katalog danach
  leer). BN5.2 10:01 Sector-12 (3 reine Kampf/Geld-Stuecke).
- **Konsequenz:** Einbauten ohne Ertrag auf der Favorseite; jeder kostet in BN5 den
  Wiederbeitritt (7-20 min). Nebenbefund: Der Grundtext in `:1226-1236` faellt auf
  "naechste Huerde erst in ..." zurueck, wenn eigentlich das Spendenrecht ausloeste (16:37) -
  die Telemetrie nennt den falschen Grund.
- **Sicherheit:** belegt.
- **Fix:** Nur Faktionen mit `favor < getFavorToDonate()` und mindestens einem unbesessenen
  Stueck mit Wert > 0 in die Favorrechnung nehmen; Grundtext aus der tatsaechlich wahren
  Bedingung bauen.

### 6. joinrun kaempft nach jedem Einbau bis zu 45 min mit bn4rep um die Figur - auch wenn nichts mehr zu holen ist

- **Bot:** `src/bn4life.js:163-186` (startet `joinrun.js 80`, sobald >= 2 von Netburners,
  Tetrads, Tian Di Hui, Slum Snakes fehlen - ohne Blick auf Aug-Zahl oder Wert),
  `src/joinrun.js:27` (`FRIST_MS` 45 min), `:68-104` (Gym-Schleife ohne `lib/figurns`
  -Antrag), `:41-44` (ueberschreibt `data/rep-modus.txt` mit "JOINRUN").
- **Spiel:** `Faction/FactionInfo.tsx` (Tetrads Kampf 75, Slum Snakes Kampf 30; Tian Di Hui
  braucht KEINE Kampfwerte).
- **Was falsch ist:** bn4rep startet bei jeder Runde `workForFaction`, sobald keine
  Faktionsarbeit laeuft; joinrun startet `gymWorkout`, sobald kein Kurs laeuft - beide 15 s
  Takt, Ping-Pong. Bekannt als AUDIT-AUTONOMIE Befund 14 ("joinrun verliert sein Gym ganz"),
  nicht umgesetzt.
- **Belegt (joinrun-Logs BN5.2):** Gym-Neustarts je Zyklus 63 (02:51-03:08), 24 (07:10-07:55),
  18 (10:01-10:19), 19 (12:53-13:38); bn4rep fuhr im Zyklus 12:53 die BitRunners-Schwellenarbeit
  ab 13:09 parallel dazu. Ertrag der Trainings: ein einziges Stueck (LuminCloaking-V1 aus
  Slum Snakes). Seit 16:57 sind 32+ Augs installiert (Daedalus-Zahl erfuellt), trotzdem
  startete joinrun 17:19 erneut (bis 18:04 nur "gymWorkout abgelehnt", weil die Figur nach
  Aevum gereist war - Glueck, kein Schutz).
- **Konsequenz:** rund 124 Neustarts x bis zu 15 s = **bis ~30 min** Faktionsarbeit durch Gym
  ersetzt in BN5.2 (Obergrenze; plausibel).
- **Sicherheit:** belegt (Neustarts), Minuten plausibel.
- **Fix:** joinrun nur, solange `installierte Augs < DaedalusAugsRequirement` und die
  Zielfaktionen Stuecke mit Nutzen haben; Tian Di Hui nur per Reise (ohne Gym); Gym ueber die
  Figur-Vergabe beantragen.

### 7. BitNode 12: Spendenformel ohne FactionWorkRepGain - der NFG-Zukauf vor dem Einbau scheitert in 12.2 und 12.3

- **Bot:** `src/bn4rep.js:164` / `:1283-1286` (Tabelle ohne 12, Rueckfall 1), `:1303`
  (Spende x1,02), `:1308-1310` (Kauf scheitert -> `if (!gekauft) break`), `:1747-1755`
  (Kommentar: "sicherer Wert 1", ausserdem "getBitNodeMultipliers haben wir nicht" - SF5.1 ist
  laut Spielstand vorhanden). `:1622` Zaehlplatz fest auf 30.
- **Spiel:** `BitNode/BitNode.tsx:918-963` (BN12: `FactionWorkRepGain = 1/1,02^lvl`,
  `DaedalusAugsRequirement = floor(30 + 1,02^lvl) = 31`), `Faction/formulas/donation.ts:8-14`.
- **Was falsch ist:** Mit Faktor 1 statt 1/1,02^lvl ist die Spende ZU KLEIN, nicht zu gross -
  der Kommentar hat die Richtung vertauscht.
- **Rechnung:** Anteil der gedeckten Rep = 1,02 x 1,02^-lvl: BN12.1 **1,00000** (Gleitkomma-
  Grenzfall), BN12.2 **0,98039**, BN12.3 **0,96117** -> Kauf scheitert, Schleife bricht ab.
  Verloren geht der gesamte spendenfinanzierte NFG-Zukauf; in BN1.3 waren das an den beiden
  letzten Einbauten **18 und 9 Stufen** (x1,196 bzw. x1,094 auf alle Multiplikatoren, auch
  faction_rep). Der Hauptspendenweg (`:2011-2021`) konvergiert dagegen ueber Zusatzrunden.
- **Sicherheit:** belegt (Formel), Auswirkung ab BN12.2.
- **Fix:** `ns.getBitNodeMultipliers().FactionWorkRepGain` statt Tabelle (SF5 vorhanden);
  Zaehlplatz gegen `DaedalusAugsRequirement` statt 30.

### 8. "Teuerste zuerst" gilt nur innerhalb einer 15-s-Runde - ueber den Zyklus kauft der Bot billig zuerst

- **Bot:** `src/bn4rep.js:1421-1429` (sortiert je Runde, kauft sofort, was verdient ist),
  Anspruch im Kommentar `:1412-1418`.
- **Spiel:** `AugmentationHelpers.ts:32-37,157` (Preis x1,9^q; Rep wird durch Kaufen nicht
  teurer und verfaellt erst beim Einbau).
- **Was falsch ist:** Stuecke werden gekauft, sobald sie verdient sind; spaeter verdiente
  teure Stuecke tragen dann den Aufschlag der frueh gekauften billigen. Auch die NFG-Stufen
  kommen stets hinter Fuellstuecke (Synfibril mit Wert 0 als Daedalus-Einbaufueller macht jede
  NFG-Stufe dieses Einbaus 1,9-mal teurer).
- **Belegt (BN5.2, Kaufpreise aus dem Log, `order.js`):** Summe 122,1 Mrd gegen 83,2 Mrd bei
  optimaler Reihenfolge (x1,47); 16:57: Magnetism -> ABNI -> Neurolink = 43,49 Mrd statt
  21,95 Mrd; 09:14: 6,56 statt 2,99 Mrd; 04:48 (geldgebundener Zyklus): 4,84 statt 2,77 Mrd.
- **Konsequenz:** spaet klein (Geld im Ueberfluss), frueh spuerbar: in den geldgebundenen
  Zyklen verzoegert es Kaeufe bzw. kostet NFG-Stufen am Einbau.
- **Sicherheit:** belegt (Betraege), Zeitwirkung plausibel, klein.
- **Fix:** Verdiente Stuecke nicht sofort kaufen, sondern erst im Einbaublock als Menge in
  absteigender Grundpreis-Reihenfolge (NFG-Stufen einsortiert, Planer aus `buyaugs.js:737-785`
  wiederverwenden); Einbauschranken dann auf "verdient + bezahlbar" statt `wartend` umstellen.

### 9. Gemessene Passivrate ersetzt die Arbeitsformel - Rangliste um Faktor ~40 verzerrt

- **Bot:** `src/bn4rep.js:1801-1805` (`if (m && m.rate > 0) return m.rate`), `:1866-1878`
  (Messung fuer JEDE Faktion, auch fuer nicht bearbeitete).
- **Spiel:** `Faction/FactionHelpers.tsx:132-170` (Passiv = Arbeitsrate x min(0,1; favor/1000
  + 0,01), bei Favor 0 also 1 %).
- **Belegt:** `rep-ziel.txt` 17:19: Daedalus-Schwelle "sek 240989" aus gemessenen 114,8 Rep/min
  (Passivrate, Figur arbeitete fuer The Black Hand). Nach Arbeitsbeginn gemessen 4.791,6 Rep/min
  (18:04) - Faktor **41,7**. Schaden trat hier nicht ein (Black-Hand-Stueck war 3 s entfernt).
- **Konsequenz:** Die gerade bearbeitete Faktion gewinnt jede knappe Rangentscheidung; ein
  besseres Ziel bei einer anderen Faktion erscheint 10-100-mal teurer.
- **Sicherheit:** plausibel (Mechanik belegt, Schaden nicht beobachtet).
- **Fix:** Gemessene Rate nur fuer die Faktion verwenden, fuer die gerade gearbeitet wird;
  fuer alle anderen die Formel.

### 10. Die Nutzenfunktion zielt auf das Endlevel - in BN5 ist das nicht der Engpass

- **Bot:** `src/lib/hackaugs.js:158-186` (`levelNutzen`: hacking mit Hebel ziel/(32 x mult),
  faction_rep nur 0,5 x ln), verwendet in `src/bn4rep.js:1682-1685`.
- **Rechnung:** Hebel 4500/(32 x 9,04) = 15,6 -> hacking x1,1 wiegt 1,42, faction_rep x1,1
  nur 0,048 (Faktor 30). Der Endanstieg nach Red Pill braucht bei mult ~13 nur 2,58e7 Exp -
  bei gemessenen 9,18e4 Exp/s (17:04-18:04) **~5 min**. Der Knoten haengt an Reputation
  (jetzt: 58 min bis zur Daedalus-Schwelle), und dort wirken hacking-Level und faction_rep
  gleich (Rate ~ Level x faction_rep, `reputation.ts:16-24`).
- **Konsequenz:** Rep-Stuecke (PCMatrix, ADR, SNA) und hacking_exp-Stuecke werden gegenueber
  reinen hacking-Stuecken untergewichtet. Wirkung auf die Wahl klein, weil die Kandidatenmenge
  ohnehin fast komplett gekauft wird.
- **Sicherheit:** plausibel, klein.
- **Fix:** Bis Red Pill den Nutzen als ln(Rep-Rate) = ln(hacking) + ln(faction_rep) (+
  Wiederaufstieg ueber hacking_exp) werten; den Endlevel-Hebel erst nach dem Red-Pill-Kauf.

### 11. Geld verfaellt beim Einbau, obwohl eine dauerhafte Senke bezahlbar war

- **Bot:** `src/homegrow.js:117` (Speicherkauf erst bei Guthaben > 3 x Preis); der Einbaublock
  (`bn4rep.js:1290-1320`) kennt nur NFG als Restgeld-Senke.
- **Spiel:** `PersonObjects/Player/PlayerObjectServerMethods.ts:30-40` (home-RAM ueberlebt den
  Einbau).
- **Belegt:** 16:37 (Spendenrechts-Einbau, NFG durch Rep begrenzt auf 5 Stufen) verfielen
  **4,41 Bio**; 64 -> 128 TB kostet 65536 x 32000 x 1,58^16 = **3,16 Bio** (Schwelle 9,49 Bio);
  `brachAnteil` war 0,029, der Speicher waere genutzt worden.
- **Konsequenz:** klein - ab 17:19 lagen ohnehin 47 % des Netzes brach.
- **Sicherheit:** belegt (Betraege), Nutzen plausibel.
- **Fix:** Unmittelbar vor `installAugmentations` Restgeld (nach NFG) in home-RAM/Kerne stecken,
  sofern `brachAnteil` klein ist.

---

## Geprueft, in Ordnung

- **Preislogik:** bn4rep liest Preis und Rep-Bedarf live (`getAugmentationPrice`,
  `getAugmentationRepReq`), damit stimmen 1,9^q, NFG 1,14^Stufe, AugmentationMoneyCost 2 (BN5)
  und AugmentationRepCost (BN12) automatisch. Nachgerechnete Logpreise passen (ENM Core V2
  17,10 Mrd bei q=1 = 4,5e9 x 2 x 1,9).
- **Favor- und Spendenweg:** Formeln deckungsgleich mit `favor.ts`/`donation.ts` (geeicht, s.o.);
  Spende nur so viel wie noetig (`:2011-2014`) ist richtig; die Spendenschwelle als eigenes Ziel
  (`:1880-1896`) ist die richtige Idee - Daedalus 462.490 statt 2,5 Mio Rep direkt.
- **Daedalus-Bedingungen** (`FactionInfo.tsx:138-149`, `FactionJoinCondition.ts:116-131`):
  30 INSTALLIERTE Augs, 100 Mrd, Hacking 2500; Wiederbeitritt nach dem Einbau in 7 min
  (17:19 -> 17:26). In BN12 31 Augs - die Zaehlung waechst ueber die Hack-Stuecke ohnehin.
- **Einbaufueller fuer den Daedalus-Favor-Einbau:** Synfibril Muscle liegt unter der Schwelle
  (BN5: 437,5k < 462,5k; BN12.1-3: 446k-464k < 492k-558k), der Einbau kann dort also feuern.
- **w0r1d_d43m0n:** `requiredHackingSkill x WorldDaemonDifficulty` (`ServerHelpers.ts:423`) wird
  live gelesen, BN5 = 4500. `ausgang.js:252-272` prueft Level UND Root/Portknacker wie
  `Singularity.ts:1148-1153`; Takt 60 s; `einbauErlaubt` sperrt Einbauten bei offenem Ausgang.
- **Red-Pill-Riegel** (`bn4rep.js:1070,1092`) prueft INSTALLIERT, nicht gekauft - richtig. "Kein
  Einbau nach Red Pill" ist in BN5 unschaedlich, weil der Endanstieg nur Minuten dauert.
- **Arbeitsart:** hacking > security > field ist bei Kampfwerten nahe 1 richtig
  (`reputation.ts:16-50`: hacking ~4,8-mal security bei Hacking 3000).
- **Feindfaktionen:** Nur Staedte haben Feinde (`FactionInfo.tsx:498-552`); Sector-12 + Aevum
  sind vertraeglich, die Ausschlussliste in `bn4life.js:228` ist korrekt. Verzicht auf Neuregen
  (Chongqing, hacking_exp 1,4) ist in BN5 vertretbar (Endanstieg kurz).
- **Firmenphase im V1-Betrieb:** laeuft nur 1-3 min nach jedem Einbau (IT Intern, danach
  Kuendigung), weil PCMatrix als "nuetzliche" Luecke <= 150k sie sperrt; harmlos.
- **Sleeves:** Sync 1 %, Hacking 1 - Faktionsarbeit brachte nichts; Shoplift in V1 unschaedlich.
- **Backdoors/Beitritte nach dem Einbau:** bn4door setzt alle Faktions-Backdoors in 5 min
  (17:20-17:25), BitRunners 17:22 wieder drin.
