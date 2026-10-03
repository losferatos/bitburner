# Gegenpruefung G01 (Gang in BN2 als V2-Hebel, TRP-Falle) - Winkel SUBSTANZ

Stand 2026-10-03 22:47 (Systemzeit). Pruefer: Subagent Substanz. Streng lesend:
`src/` unveraendert, Spiel nicht angefasst, nichts committet. Spielquelle 3.0.2
`reference/bitburner-src/src/`. Spielstaende `backups/LIVE_197f4d61481686_BN2L1_*`
(bis 22:17), Vergleich BN4L3, BN9L3.

Eigene Rechner (unabhaengig, keine Funktion des Erstpruefers importiert):
`tools/audit/verify-g01-substanz-{save,series,augs,bb,gangsim,round,ertrag,phase1}.mjs`.

## Kurzurteil

| Befund | Urteil | Ertrag korrigiert | Basis |
|---|---|---|---|
| GANG-1 Gang in BN2 als V2-Hebel | **TEILWEISE** | BN2.2 und BN2.3 je **~5-14 h** (Mitte ~9 h), BN2.1 **0-4 h**; zusammen **~10-32 h** statt 40-65 h | GESCHAETZT auf geeichten Teilen |
| BN2-3 BN2 ist rufgebunden, kein ruffreier Aug-Kanal | **TEILWEISE** | Diagnose haelt; Ertrag wie GANG-1 korrigiert | GESCHAETZT |
| GANG-2 TRP-Falle | **BESTAETIGT** (Mechanik), Schaden kleiner als beschrieben | schuetzt ~0-3 h je Lauf plus den Preisfaktor 1,9 der laufenden Runde; Aufwand S, Pflicht vor GANG-1 | GERECHNET (Codepfad) |

Der Hebel ist real und die neue Fundstelle tragfaehig. Was nicht haelt: (1) die
Annahme "Rang/h x3 ueber den ganzen Restlauf" - der Kompetenzhebel wirkt nur im
ersten, kompetenzbegrenzten Abschnitt des Laufs; (2) BN2.1 traegt praktisch nichts
mehr bei; (3) mit der HEUTIGEN Kaufregel des Bots bringt die Gang-Runde nur x1,45
statt x2,9-3,8 Kompetenz - ohne Rundenplaner schrumpft der Ertrag auf ~3-5 h je Lauf.

## 1. Eichung (Soll/Ist gegen echte Spielstandwerte)

| Was | Soll (Spielstand) | Ist (eigenes Modell) | Rechner |
|---|---|---|---|
| Fertigkeit `calculateSkill` (534,6), 6 Werte, BN2.1 21:17 | hack 362, str 255, def 255, dex 311, agi 256, cha 183 | 362/255/255/311/256/183, alle OK | `verify-g01-substanz-bb.mjs` |
| `maxStamina` (`Bladeburner.ts:1327-1343`) | 152,761417 | 152,761417 OK | dito |
| **Erfolgschance**: `getActionEstimatedSuccessChance()[0]` der laufenden Aktion (Retirement L35, Ishima, pop 4,63e8, popEst 1,26e9) aus `data/blade.json` - echter Spielwert | 0,367 | 0,367 OK (echte Chance 1,0000) | dito (`getSuccessRange`, `Action.ts:144-196`) |
| Black Ops Typhoon/Zero/X gegen die Bot-Nachrechnung `blackOpChance` | 0,2683/0,1529/0,1789 | 0,2683/0,1529/0,1789 | dito (nur Plausibilitaet: `boChancen` ist Bot-Code, kein Spielwert) |
| Favor aus 1,25 Mio Rep (`favor.ts:10-12`) | - | 198,6 -> Faktor 2,99 (bestaetigt Erstpruefer) | Hand |
| Gang-Dynamik | **kein Spielstand mit Gang** (`AllGangsSave` leer) | nur Formelgleichheit mit Quelle; Dynamik GERECHNET_UNGEEICHT | `verify-g01-substanz-gangsim.mjs` |

Damit ist die Kette "Aug-Mults -> Stufe -> Kompetenz -> Chance" exakt geeicht. Die
Gang-Rufkurve und die Stundenersparnis sind es nicht.

## 2. Statische Fakten (gegen Quelle geprueft)

- Gang ohne Karma in BN2: `PlayerObjectGangMethods.ts:16-17` - **bestaetigt**.
- Gang-Angebot BN2: alle `!isSpecial` ausser Congruity, plus TRP, `GangUniqueAugs 1`
  (`FactionHelpers.tsx:172-200`, `BitNode.tsx:569-591`). Eigene Extraktion aus
  `Augmentations.ts`: 137 Augs, 39 `isSpecial`, Angebot **99** (inkl. TRP und dem
  stuendlich wechselnden Unstable Circadian Modulator; Erstpruefer 98), davon
  **36 mit Kampfwert** - bestaetigt. 17 von 18 Bladeburners-Augs `isSpecial`
  (Ausnahme Glibness, ohne Kampfwert) - bestaetigt.
- Slum Snakes bekommt in BN2 ohne Gang nie Ruf: Passivruf 0
  (`FactionHelpers.tsx:132-135`), Vertraege belohnen nur Faktionen mit
  `offerHackingWork` (`PlayerObjectGeneralMethods.ts:515-536`) - bestaetigt (BN2-3).
- Gang bleibt ueber den Einbau, Faktion wird wieder beigetreten, Aufstiegspunkte x0,95
  (`Prestige.ts:130-143`) - bestaetigt.
- **Bonuszeit der Gang: 25 Zyklen je Engine-Takt, nicht "2,5-fach".**
  `Gang.process` (`Gang.ts:99-121`) verarbeitet bei Vorrat >= 10 je Aufruf
  `min(stored, 25)` Zyklen, und die Engine ruft ihn alle 200 ms
  (`engine.tsx:105`). Online-Normalfall 10 Zyklen je 10 Takte (1x), Nachholen 25 je
  Takt (~24x). Folge fuer die Uhr: Gang-Stunden = Wanduhr inkl. Offline, solange das
  Spiel >= 1/24 der Zeit ungedrosselt laeuft. Im gedrosselten Tab (1 Wake/min,
  300 Zyklen je Aufruf) laeuft die Gang mit 25/300 = 1/12 und holt spaeter nach. Der
  Inventarbericht (Feature 13) ist hier falsch, das Ergebnis aendert es nicht.
- RAM: `GangApiBase 4` (`RamCostGenerator.ts:59,275-300`), ein Regler mit
  create/recruit/setTask/ascend/info kommt auf ~20 GB - bestaetigt.

## 3. Gang-Rufkurve (eigene Simulation)

`verify-g01-substanz-gangsim.mjs`, Takt 10 Zyklen, Territorium fest 1/7 (ohne
Warfare aendert es sich nicht, `Gang.ts:232-234`), keine Ausruestung,
`faction_rep` 1,3, Raster 672 Regler (Ziel-Stufe, Aufstiegsschwellen, Fruehziel,
Aufgabenwahl):

| Regler | 100k | 437,5k | 750k | 1,25M | 1,625M | 2,5M |
|---|---|---|---|---|---|---|
| bester (Ziel 700, frueh 200, Aufstieg 1,2 Training / 1,5 Arbeit) | 4,6 | 6,2 | 7,2 | **8,5** | 9,4 | 11,1 |
| 400 / 1,2 / 1,5 | 4,1 | 6,0 | 7,2 | 8,7 | 9,6 | 11,4 |
| 500 / 1,3 / kein Aufstieg in Arbeit | 4,3 | 6,2 | 7,6 | 9,7 | 11,1 | 14,4 |
| 300 / 1,6 / kein Aufstieg in Arbeit | 4,4 | 7,5 | 9,9 | 13,5 | 16,1 | 21,8 |

Empfindlichkeit (bester Regler): `faction_rep` 1,28/1,37 -> 8,6/8,4 h; Takt 25
(Nachholen) 8,8 h; Wanted-Schwelle 0,99/0,80 -> 9,1/8,5 h. 12 Mitglieder nach ~3 h.

**Urteil Rufkurve: BESTAETIGT** (Erstpruefer 8,6-11,2 h). Ein schlecht gewaehlter
Regler kommt auf 13,5 h - die Regler-Vorgabe gehoert in den Bau.

## 4. Einbaurunde und Kompetenz (eigene Rechnung, Stand BN2.1 21:17)

`verify-g01-substanz-round.mjs`: Strahlsuche ueber Mengen, Reihenfolge teuerste
zuerst mit Voraussetzungen, Preis `base x 1,9^q`, Ziel Daedalus-Kompetenz bei
gleicher Erfahrung (Stufe linear im Mult, geeicht).

| Ruf bis | q0 | 5 Mrd | 10 Mrd | 20 Mrd | 50 Mrd | 100 Mrd |
|---|---|---|---|---|---|---|
| 150k (~4,5 h nach Gruendung) | 0 | x1,65 | x1,76 | x1,92 | x2,12 | x2,20 |
| 437,5k (~6,2 h) | 0 | x1,66 | x1,87 | x2,05 | x2,26 | x2,47 |
| 1,25M (~8,5 h) | 0 | x1,70 | x2,36 | **x2,85** | **x3,81** | **x4,78** |
| 1,25M | 4 | x1,25 | x1,32 | x1,44 | x1,60 | x2,21 |

Typhoon-Chance 0,268 -> 0,766 (20 Mrd) -> 1,0 (50 Mrd). **Erstpruefer x2,87/3,90/5,14
bestaetigt** (Abweichung durch anderen Ausgangsstand und Suchverfahren), **aber nur
mit q0 = 0**.

**Heutige Kaufregel** (`src/bn4rep.js:1736-1745`: jede Runde alles Verdiente und
Bezahlbare, absteigend nach Preis), Ruf nach der Gang-Simulation, Geld 2,4 Mrd bei
Gruendung + 3,5 bzw. 6 Mrd/h netto, Stand 10,5 h nach Gruendung:

| | Stueck | q | Kompetenz | Geld uebrig |
|---|---|---|---|---|
| heutiger Bot, 3,5 Mrd/h | 10 billige (Power Recirculation Core, BrachiBlades, SmartSonar, DermaForce, ...) | 10 | **x1,44** | 22,5 Mrd |
| geplante Runde, gleiches Geld 39 Mrd | 9 | 9 | **x3,53** | - |
| heutiger Bot, 6 Mrd/h | 11 | 11 | x1,50 | 8,9 Mrd |
| geplante Runde, 65 Mrd | 10 | 10 | x4,22 | - |

Der Bot kauft die billigen Stuecke, sobald der Ruf sie freigibt, treibt q hoch und
kann SPTN-97, Graphene Bone Lacings usw. danach nicht mehr bezahlen. **Ohne
Rundenplaner ist der Hebel weniger als halb so gross.**

## 5. Wo Kompetenz ueberhaupt Rang bringt - der tragende Einwand

`Action.ts:195` kappt die Chance bei 1. Eigenes Modell (geeicht, Abschnitt 1) auf
allen BN4.3/BN9.3/BN2.1-Spielstaenden, unbegrenzte Chance comp/diff auf der
freigeschalteten Hoechststufe (`verify-g01-substanz-ertrag.mjs`, Teil A):

| Lauf | eff. h | Rang | Assassination Lmax comp/diff | Stealth Ret. Lmax |
|---|---|---|---|---|
| BN4.3 | 14,5 | 1.645 | 0,28 (L1) | 0,46 (L1) |
| BN4.3 | 21,1 | 10.818 | 0,93 (L8) | 1,56 (L8) |
| BN4.3 | 28,9 | 23.556 | 2,59 (L9) | 4,35 (L9) |
| BN4.3 | 38,6 | 209.728 | 49,7 (L24) | 176 (L11) |
| BN9.3 | 27,5 | 4.454 | 0,28 (L1) | 0,46 (L1) |
| BN9.3 | 41,4 | 24.184 | 2,18 (L6) | 2,44 (L14) |
| BN9.3 | 53,6 | 623.300 | 58,6 (L32) | 286 (L14) |
| BN2.1 | 17,6 | 7.178 | 0,43 (L1) | 0,68 (L1) |

Der Lauf zerfaellt in zwei Abschnitte:

1. **Kompetenzbegrenzt** (BN4.3 bis ~21 h / 10k Rang, BN9.3 bis ~41 h / 24k): die
   ertragreichen Operationen haben p < 1, Rang/h ~ Kompetenz. Hier wirkt die Gang.
2. **Stufen- und zeitbegrenzt** (danach): alle Aktionen laufen auf der Hoechststufe mit
   p = 1; die Stufe waechst nur mit Erfolgen (`LevelableAction`), die Zeit mit
   Overclock. Hier bringt zusaetzliche Kompetenz nichts ausser ~5 % kuerzerer
   Aktionszeit ueber `statFac` (agi^0,04, dex^0,035). In diesem Abschnitt fallen aber
   ~90-95 % des Rangs (BN4.3 30k -> 210k in 7 h, BN9.3 24k -> 623k in 12 h).

Der Erstpruefer rechnet "Rang/h x3 ab h~14-17 ueber den ganzen Rest" (Abschnitt 4.6
seines Berichts). Das trifft nur Abschnitt 1. Auch sein "x4,6-7,1 (100 Mrd)" gilt
fuer "freie Stufe" - die Stufen sind aber erfolgsbegrenzt. Statisch auf den
HEUTIGEN Hoechststufen (BN2.1 22:17, Teil C): x3,13 / x3,44 mit Raid, x2,40 / x2,64
ohne Raid (20 / 50 Mrd), und schon mit 20 Mrd sitzen alle Spitzenaktionen bei p = 1 -
mehr Geld hebt den Sofortertrag kaum.

Gemessene Rangrate BN2.1 ohne Bonuszeit: 435 Rang/h (21:17 -> 22:17). Das statische
Modell sagt dort 2.054 (Raid) - Absolutwerte des Modells sind ~4,7x zu hoch
(Krankenhaus, Chaos, Bevoelkerungsschwund Ishima 4,6e8), nur Verhaeltnisse taugen.

## 6. Ertrag in Stunden

### 6a. Kompetenzwachstum ohne Gang (gemessen)

`ln(Typhoon-Kompetenz)` je effektive Stunde (Teil B) und Zerlegung:

| Lauf, Abschnitt | g gesamt | davon Skills (SP aus Rang) | Werte (Erfahrung) | Augs |
|---|---|---|---|---|
| BN2.1 7,6 -> 17,6 h | **0,067/h** | 0,026 | 0,032 | 0,010 |
| BN2.1 5,1 -> 16,6 h | 0,101/h | | | |
| BN9.3 27,5 -> 41,4 h | 0,115/h | 0,081 | 0,034 | 0 |
| BN4.3 14,5 -> 21,1 h | 0,253/h | 0,153 | 0,081 | 0,019 |

BN2.1 waechst wie BN9.3, nicht wie BN4.3 (BN4.3 hatte bei 21 h 47 Augs eingebaut,
BN2.1 17). Ein Kompetenzfaktor k entspricht damit `ln(k)/g` Stunden Vorsprung:
k = 2,85 -> 10-15 h, k = 3,8 -> 13-20 h (nur innerhalb von Abschnitt 1).

### 6b. Gekoppeltes Abschnitt-1-Modell

`verify-g01-substanz-phase1.mjs`: C = S(Rang) x T(t) x k, S ~ Rang^0,42-0,57
(gemessen), T = exp(0,042-0,08 t), Rangrate R ~ C^beta (beta 0,8-1,25), geeicht auf
435 Rang/h bei 7.178 Rang (BN2.1 22:17), Ende von Abschnitt 1 bei 25-30k Rang,
0,5 h Wiederaufbau ohne Rang:

| k | Ersparnis bis 25k | bis 30k |
|---|---|---|
| 2,0 | 4,8-7,8 h | 5,3-8,5 h |
| 2,85 | 7,0-10,5 h | 7,6-11,6 h |
| 3,8 | 8,3-12,3 h | 8,9-13,8 h |

Ab Rang ~4-5k (Einbau bei h~12 in BN2.2/2.3) ist der Restweg in Abschnitt 1 laenger,
die Ersparnis liegt dann eher am oberen Rand. Abschnitt 2 dazu: ~5 % Aktionszeit auf
~8-12 h = +0,4-0,6 h. Abzug: Gang-Run startet Abschnitt 2 mit weniger Erfolgen auf
Assassination (nicht gerechnet, eher < 1 h).

### 6c. Je Lauf

- **BN2.2 / BN2.3**: Gruendung h~2 (Slum Snakes in BN2.1 bei h1,85), 1,25M Ruf bei
  h~10,5-11,5, Einbausperre ohnehin >= 12 h, Geld bei h~12 rund 25-40 Mrd
  (BN2.1: 4,6 Mrd/h Hacking, minus Server/Krankenhaus). k = 2,85-3,6 ->
  **~7-14 h je Lauf**; mit k ~ 2 (Geld knapp oder q0 > 0) ~5-8 h.
  **Mit der heutigen Kaufregel (k = 1,45) nur ~3-5 h.**
- **BN2.1**: jetzt 17,6 h effektiv, Rang 7.178, Typhoon 0,28. Bau, Skeptiker,
  Einspielen kosten Wanduhr, und Wanduhr = effektive Zeit (Bonus wird nachgeholt).
  Gang laeuft fruehestens bei ~22-30 h, 1,25M Ruf bei ~31-39 h; Abschnitt 1 endet ohne
  Gang bei ~30-39 h (Modell 6b: 12,5-21,8 h ab jetzt). Die Runde kommt also am Ende
  von Abschnitt 1 an: **0-4 h** (eine fruehe kleine Runde bei 437k Ruf, k ~ 2, ist hier
  besser als das Warten auf 1,25M).
- **Summe BN2.1-2.3: ~10-32 h, Mitte ~20 h** (Erstpruefer 40-65 h).

Beste Alternative fuer dasselbe Geld: Ohne Gang gibt es keinen Kampf-Aug-Kanal. In
BN2.1 gingen 12,5 Mrd in Hacknet-Augs (BN2-1) und beim Einbau 19:01 rund 10,2 Mrd in
NFG-Stufen (moneySourceB.augmentations -20,40 -> -30,57 Mrd zwischen 19:01 und
19:17). Fuenf NFG-Stufen sind x1,05 auf die Kampf-Mults, also ~x1,04 Kompetenz -
gegen x2,85 der Gang-Runde vernachlaessigbar. Grafting (AUG-1) zielt auf denselben
Abschnitt 1; die Ertraege sind nicht additiv.

## 7. GANG-2 im Code nachgelesen

- `src/lib/hackaugs.js:346-350`: `kampfknotenNuetzlich("The Red Pill")` -> true auch im
  V2-Knoten.
- `src/bn4rep.js:668-678`: Kandidaten aus `getAugmentationsFromFaction` jeder
  Faktion, also aus der Gang-Faktion inkl. TRP (BN2, `FactionHelpers.tsx:180-183`).
- `src/bn4rep.js:1736-1745`: Kauf sobald `rep >= repReq` und Geld reicht; TRP kostet 0
  (`Augmentations.ts:1953-1956`) -> Kauf im ersten Durchlauf nach 2,5M Ruf. TRP zaehlt
  in `1,9^q` (`AugmentationHelpers.ts:32-37`).
- `src/bn4rep.js:1272` `redPillWartet` erzwingt den Einbau (weiter an
  `wiederaufbauHilfe` und `!gesperrt` gebunden), `:1207` + `:1370` danach kein
  Einbau mehr im Knoten.
- Zeitlich: bester Regler erreicht 2,5M nach 11,1 h -> in BN2.2 bei h~13, also eine
  Stunde nach Oeffnen der 12-h-Sperre. Verpasst der Bot das Fenster, landet TRP in
  Runde 1 (x1,9 auf jedes spaetere Stueck), sonst in Runde 2.
- **Schaden kleiner als "jeder Einbau gesperrt" suggeriert**: Runde 2 und spaeter
  fallen nach 6c in Abschnitt 2 und sind wenig wert. Es bleibt ~0-3 h plus der
  Preisfaktor in Runde 1 und der erzwungene Einbau zur Unzeit. Schliessen bleibt
  Pflicht (Aufwand S).

## 8. Was nicht haelt (Zusammenfassung der Einwaende)

1. **"Rang/h x3,2-7,1" und "Rest von 33-37 h auf 10-13 h"**: Der Faktor gilt nur im
   kompetenzbegrenzten Abschnitt; danach laufen alle Aktionen bei p = 1 (BN4.3 ab
   ~21 h, BN9.3 ab ~41 h belegt). "x4,6-7,1" setzt freie Stufen voraus, die
   erfolgsbegrenzt sind.
2. **BN2.1 "eher 10-15 h"**: setzte Gruendung bei h~5,5 voraus; jetzt h 17,6 und
   kein Code -> 0-4 h.
3. **Kauf-Taktung als Nebensatz**: Mit der heutigen Kaufregel x1,45 statt x2,9-3,8.
   Der Planer ist keine Feinheit, sondern die halbe Miete.
4. **Bonuszeit "2,5-fach"** ist falsch (25 Zyklen je Takt, ~24x); ohne Folgen fuer
   das Ergebnis.
5. **"Basis 34-42 h effektiv" (BN2-3)**: BN2.1 waechst in der Kompetenz wie BN9.3
   (g 0,067 gegen 0,115 und 0,253); die Basis liegt eher bei 40-55 h. Das spricht
   eher FUER den Hebel (laengerer Abschnitt 1).

## 9. Bauvorgaben aus dieser Pruefung

- GANG-2 zuerst: TRP nur im Verfahren V1 als Kandidat (Filter in
  `kampfknotenNuetzlich` oder in der Kandidatenschleife).
- Kampfgang Slum Snakes, Regler etwa: Training bis Mittelwert 400-700 der
  Terrorism-Werte, frueh bis 200, Aufstieg ab Faktor 1,2 im Training und 1,5 in der
  Arbeit, Terrorism, Vigilante nur bei Abzug < 0,95 UND wanted > 1. Steuerung ueber
  `ns.gang.nextUpdate()`, nicht ueber feste ms-Schlaefe (Nachholen ~24x).
- **Rundenplaner Pflicht**: solange der Gang-Ruf < Zielschwelle, KEINE Gang-Stuecke
  kaufen; zum Rundenzeitpunkt teuerste zuerst mit q0 = 0, Bladeburner-/Kleinkram
  danach. Zielschwelle 1,25M nur, wenn sie vor der 12-h-Sperre erreicht wird; in einem
  schon weit fortgeschrittenen Lauf (BN2.1) frueher einbauen (437k, k ~ 2).
- Einbau zwischen 1,25M und 2,5M Ruf (Fenster ~2,6 h beim besten Regler).
- Kein zweiter Gang-Einbau einplanen, wenn der Lauf schon in Abschnitt 2 ist
  (Assassination/Stealth auf Hoechststufe p = 1).

## 10. Rechner

| Datei | Inhalt |
|---|---|
| `tools/audit/verify-g01-substanz-save.mjs` | Spielstand-Leser, Telemetrie vom home-Server |
| `tools/audit/verify-g01-substanz-series.mjs` | Zeitreihe eff. Zeit/Rang/Geld/Mults je Lauf |
| `tools/audit/verify-g01-substanz-augs.mjs` | Aug-Daten per eval aus `Augmentations.ts`, Gang-Angebot BN2 |
| `tools/audit/verify-g01-substanz-bb.mjs` | Bladeburner-Modell, Daten aus den TS-Dateien, Eichung (Abschnitt 1) |
| `tools/audit/verify-g01-substanz-gangsim.mjs` | Gang-Simulation, `--grid` (672 Regler, ~16 min) |
| `tools/audit/verify-g01-substanz-round.mjs` | Einbaurunde; `--politik` heutige Kaufregel gegen Planer |
| `tools/audit/verify-g01-substanz-ertrag.mjs` | Abschnitt 1/2 aus Spielstaenden, Wachstum g, statische Rang/h |
| `tools/audit/verify-g01-substanz-phase1.mjs` | gekoppeltes Abschnitt-1-Modell, Stundenersparnis |
