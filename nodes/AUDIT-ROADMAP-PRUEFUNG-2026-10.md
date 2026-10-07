# Roadmap-Pruefung 07.10.2026 - Corp und spaetere Hebel nachgedacht

Auftrag: `nodes/PROMPT-ROADMAP-PRUEFUNG-2026-10-07.md` plus Zusatz vom selben Abend (Route und Bauauftraege
trennen, Corp ausserhalb BN3 mit 150 Mrd Gruendung, Zeiten auf heutigem SF-Stand, Knoten ohne Bedarf einzeilig).
Erstellt 07.10.2026 ab 21:09 (Systemzeit). Streng lesend: `src/` unveraendert, kein Werkzeug ins Spiel, Browser
nicht angefasst. Spielstand nur ueber die lesenden Bruecken-Methoden `getSaveFile`/`getFile` und `backups/`.

Stand bei Pruefung: BN3 Lauf 3 seit 07.10. 16:02 UTC (Knotenstunde 3,1), SF 1/2/4/5/9/10/12 = 3, SF3 = 2, SF6 = 1
(`node <scratch>/sf.mjs`, Spielstand `sourceFiles`). Offen danach: **20 Laeufe** - BN11 x3, BN6 L2/L3, BN7 x3,
BN14 x3, BN13 x3, BN15 x3, BN8 x3.

Rechenskripte liegen neben diesem Bericht in `nodes/audit-roadmap-pruefung-2026-10/`:
`eichung.mjs` (Corp-Formeln gegen Log und Spielstaende), `corpverlauf.mjs` (echter Verlauf aus `backups/`),
`routegewinn.mjs` (Laufzeiten, Umstellungsgewinn), `sim/` (Corp-Simulator auf der echten Spielquelle 3.0.1 je
Knoten, Zusammenfassung `sim/ergebnisse.json`), `route-vorschlag.json` (Diff-Kandidat, NICHT eingespielt).

---

## 0. Ergebnis in fuenf Saetzen (nach Skeptiker-Runde)

1. **Urteil: Route bleibt.** Der einzige Umstellungskandidat (BN6.2/6.3 + BN7 vor BN11) hat nach der Skeptiker-Runde
   kein belastbares Vorzeichen: Gewinn 1,6-11,2 h gegen einen Verlust, der ohne SF11-Preiskette in geldgebundenen
   Laeufen bis ~1-3 h je BN7-Lauf reicht - netto etwa -10 bis +11 h bei ~850-1.450 h Restroute (Abschnitt 3).
2. **Corp ausserhalb BN3: kein Bauauftrag.** Mit der BN3-Strategie erreicht sie in keinem offenen Knoten in 36 h die
   Bestechungsschwelle 1e14; die Gruendung (150 Mrd) ist vor dem ersten Einbau nicht bezahlbar; strukturell fehlt ein
   Faktor ~1.000 im Vermoegenszuwachs. Bewiesen fuer die BN3-Strategie, nicht fuer jede denkbare (Abschnitt 2).
3. **Die Roadmap hat die Corp richtig ausgeschlossen** (AUDIT-ROADMAP:89), nur mit schwacher Begruendung. Selbst in
   BN3 ist der Corp-Nutzen nicht messbar (BN3.2 22,7 h mit, BN3.1 21,7 h ohne).
4. **Was die Roadmap nicht nutzt: SF7.3 schenkt das Simulacrum** (Arbeit parallel zu Bladeburner). Der Bot sperrt
   Fraktionsarbeit in Kampfknoten zweifach - `bladeSperreArbeit` und die Figur-Prioritaeten. Bauauftrag, kein
   Routenproblem; Gewinn nicht beziffert.
5. **Der grosse Brocken bleibt BN15** (V2 Groessenordnung 105-178 h je Lauf). Der Labyrinth-Weg (V1b) ist der
   wertvollste Bauauftrag, aber unbelegt: erst ein Machbarkeitstest, BN15 bleibt in der Route V2.

---

## 1. Annahmen der Roadmap und ihr Status

| # | Annahme (Quelle) | Status | Beleg |
|---|---|---|---|
| A1 | Bladeburner (V2) traegt alle Knoten ausser den milden V1-Knoten und BN8 (AUDIT-ROADMAP:71-77) | **belegt**, unveraendert | 12 von 12 V2-Laeufen seit 01.09. so beendet (Abschnitt 4.1); Black Ops verlangen nur Rang und Vor-Op, kein Geld (`Bladeburner/Actions/BlackOperation.ts:44-49`) |
| A2 | Corporation bleibt draussen: Startkapital 150 Mrd ausserhalb BN3, API 10/20 GB (AUDIT-ROADMAP:89) | **belegt**, Begruendung **ergaenzt** | Gruendung ausserhalb BN3 nur selbstfinanziert (`Corporation/helpers.ts:36-38`, Kosten `:47-52`); entscheidend ist aber der Bewertungsfaktor (`Corporation.ts:223`) - Abschnitt 2 |
| A3 | Geld ist in V2 nicht der Engpass, der Ruf ist es (`nodes/corp-2026-10-05/geldwert.md`:44-69) | **teilweise**: in BN3 band der Ruf; in BN4/BN9/BN10 band auch Geld (Konto beim Einbau 0,04-0,7 Mrd, Augs 71-73 % der Einnahmen, `nodes/audit-2026-10-03/inventar-corp.md:189-191, 288-291`). Fuer das Corp-Urteil folgenlos - die Corp liefert ausserhalb BN3 kein Geld (Abschnitt 2) | Bladeburner-Fortschritt kostet kein Geld (Skills = SP, `Bladeburner/Skill.ts:76-80`); Geld wirkt nur ueber Augs/Grafting/Hashes |
| A4 | Reihenfolge-Prinzip "Beschleuniger zuerst, Pflichtlaeufe ans Ende" (AUDIT-ROADMAP:74-75) | **belegt**; BN7 steht hinter BN11, aber SF11 ist in geldgebundenen Laeufen selbst ein Beschleuniger (Preiskette) - **kein belegter Verstoss** | Abschnitt 3 |
| A5 | SF11 senkt die Preiskette (AUDIT-ROADMAP:90) | **belegt** | `AugmentationHelpers.ts:30` (1,9 x [1; 0,96; 0,94; 0,93]); sonst nur work_money/company_rep (`applySourceFile.ts:153-163`) - in geldgebundenen V2-Laeufen **spuerbar** (Satz von 8 Augs ohne SF11.3 1,53x teurer) |
| A6 | SF6.2/6.3 "nur +4 %/+2 % Kampf - reine Pflicht" (AUDIT-ROADMAP:91) | **belegt** in der Groesse, **unterschaetzt** in der Wirkung | Kampf-Level x1,14/1,08 (`applySourceFile.ts:93-108`); Rangrate ~ K^1,44-1,77 (geldwert.md:89) -> +8-10 % Rangrate |
| A7 | SF7.3 = Simulacrum, "beschleunigt genau die teuren Spaetlaeufe" (AUDIT-ROADMAP:92) | **belegt**, **Wirkung im Bot nicht vorhanden** | Simulacrum gratis beim Beitritt (`PlayerObjectBladeburnerMethods.ts:14-19`), Arbeit laeuft parallel (`Bladeburner.ts:178`, `:1354`); Bot sperrt Arbeit unbedingt (`src/bn4rep.js:642`, `bladeSperreArbeit = bladeburnerTraegtHier`) |
| A8 | V2-Zeiten 22-94 h je Lauf aus Simulation (AUDIT-ROADMAP:83-95, ausdruecklich unverifiziert :109-115) | **ersetzt** durch Messung + Skalierung | Abschnitt 4 |
| A9 | BN15 per Labyrinth 10-35 h statt V2 94 h (AUDIT-ROADMAP:256-264) | **plausibel**, unveraendert offen; Gewerk fehlt | kein dnet-Gewerk in `src/` (Suche nach `dnet`/`labyrinth`: nur Aug-Tabellen in `src/buyaugs.js`) |
| A10 | BN8 zuletzt, braucht Boersen-Bot (AUDIT-ROADMAP:96) | **belegt** | BN8: Corp/Gang/Bladeburner aus (`BitNode.tsx:764-794`), Geld nach jedem Einbau zurueck auf 250 Mio (`Prestige.ts:158-171`); `src/boerse.js` existiert |
| A11 | Zeitangaben in Knotenstunden sind Arbeitsstunden | **falsch** | `totalPlaytime` waechst auch offline 1:1 mit der Wanduhr; Offline-Luecken von 8,6-32 h in BN4.3, BN5.3, BN9.2, BN10.3, BN12.1 (Laufzeit-Historie aus `backups/` + `data/bridge.log`). BN3.2: Rang 2.773 -> 3.096 von Knotenstunde 10,9 bis 21,2 - Offline-Luecke 04:35-14:30 UTC UND 12-h-Einbausperre fallen zusammen, welche band, ist offen (Befund B9) |

---

## 2. Corp: geeicht, gerechnet, verworfen

### 2.1 Formeln, nachgebaut und geeicht (`eichung.mjs`)

| Formel | Quelle | Eichwert | Abweichung |
|---|---|---|---|
| Angebot = Bewertung x Anteil x Faktor ([0,1;0,35;0,25;0,2] x [3;2;2;1,5]) | `Corporation.ts:333-354`, `data/Constants.ts:71-72` | BN3.3 Runde 1: 217,06 Mrd -> **65,12 Mrd** (`data/corp-log.txt` 17:51:18Z) | 4,6e-7 |
| dto. | dto. | BN3.3 Runde 2: 233,75 Mrd -> **163,6 Mrd** (`data/corp.json` next) | 1,7e-4 (Rundung im Log) |
| Bestechung: Ruf = Geld / 1e9, nur ab Bewertung 1e14 | `Actions.ts:612-656`, `Constants.ts:61-62` | Black Hand 306 Bio -> **306.000**; Slum Snakes 68,85 Bio -> **68.850** | 0 |
| Private Bewertung = (1e10 + Fonds/3 + Delta x 315.000) x 1,00797^(Bueros+Lager), oeffentlich Fonds + Delta x 85.000 | `Corporation.ts:200-224` | `cycleValuation` aus 23 Spielstaenden BN3.2/3.3 nachgebaut | **20 von 23 exakt** (0 bzw. 2e-9); 3 Abweichler sind Staende mit Fondsbewegung nach der Bewertung im selben Zyklus (06:11, 18:02 nach Verkauf/Bestechung; 19:26 Gruendungsminute) |
| Knotenfaktor: Bewertung x CorporationValuation | `Corporation.ts:223` | - | - |
| Gruendung ausserhalb BN3: 150 Mrd Spielergeld, kein Seed | `helpers.ts:36-38, 47-52` | - | - |
| SF3.3: Lager- und Buero-API gratis (sonst je 50 Mrd) | `PlayerObjectCorporationMethods.ts:21-24`, `CorporationUnlocks.ts:65-75` | - | - |
| Max. Divisionen 20 x CorporationDivisions | `Corporation.ts:38` | Sim: BN13/15 = 8, BN6/7/14 = 16, BN11 = 18 | - |

**Simulator.** `nodes/corp-2026-10-05/sim/corpsim.ts` faehrt die echte Spielquelle 3.0.1. Fuer diese Pruefung
in eine Kopie uebernommen und um zwei Zeilen erweitert (Knoten waehlbar, SF3 = 3, ausserhalb BN3 150 Mrd
Spielergeld + `createCorporation(name, true)`). **Identitaetsprobe:** BN3 mit der Kopie ist bitgleich zum Original
(Bewertung und Fonds bei 2/4/6/8/10/12 h identisch). **Gegen die Wirklichkeit:** Bewertung >= 1e14 echt bei
Knotenstunde 8,9 (BN3.2, Sicherung 04:11), simuliert bei 9,5 h - Abstand < 1 h.

### 2.2 Ergebnis je Knoten (Strategie wie der echte Bot, Szenarien C4B_KF und C4A_KF, 36 h)

| Knoten | CorporationValuation / Softcap / Divisions (`BitNode.tsx`) | Runde 4 bringt | hoechste Bewertung in 36 h | Bestechung (1e14) |
|---|---|---|---|---|
| BN3 (Referenz) | 1 / 1 / 1 (Default) | **23.403 Mrd** bei 8,5 h | max. 2,7e19 bis 12 h (bei 12 h: 6,0e17) | **9,5 h** |
| BN11 | 0,1 / 0,9 / 0,9 (:909-911) | 0,7 Mrd bei 14,3 h | 1,0e11 | nie |
| BN6 und BN7 | 0,2 / 0,9 / 0,8 (:707-709, :746-748) | 42-54 Mrd | 2,8e11 | nie |
| BN14 | 0,4 / 0,9 / 0,8 (:1068-1070) | 119-138 Mrd | 1,1e12 | nie |
| BN15 | 0,2 / 0,4 / 0,4 (:1102-1104) | 40-50 Mrd | 2,5e11 | nie |
| BN13 | 0,001 / 0,4 / 0,4 (:1023-1025) | 0,0 Mrd | 9,2e8 | nie |
| BN8 | 0 / 0 / 0 (:780-782) | Corp gesperrt (Softcap < 0,15, `helpers.ts:41-43`) | - | - |

**Mechanik dahinter:** Die Zuendung in BN3 wird vom Geld aus Runde 4 bezahlt (nodes/corp-2026-10-05/strategie.md:125-128, hier
reproduziert: 23,4 Bio). Der Knotenfaktor skaliert die Bewertung linear, also auch jedes Angebot - in BN14 kommen
aus Runde 4 nur 0,14 Bio. Ohne diesen Treibstoff waechst die Corp aus eigenem Gewinn (~1-3 Mio/s) und erreicht in
36 h hoechstens 1e12. Erst NACH einer Zuendung waere der Faktor egal (BN3.2 lief bis 1e102).

**Gruendungsgeld:** Der Bot haelt in V2-Knoten vor dem ersten Einbau wenig Bargeld: BN2.3 hoechstens 8,0e10 bei
11,8 h, BN3.1 1,7e9 bei 18,6 h, BN9.3 3,6e9 bei 21,9 h, BN4.3 9,3e9 bei 14,5 h (`corpverlauf.mjs`). Die 150 Mrd
waeren in keinem dieser Laeufe vor dem ersten Tor da gewesen. Hashes -> Corp-Fonds bringen 1e9 je 100 x L Hashes
(`Hacknet/data/HashUpgradesMetadata.tsx:25-39`) - ueber eine Bestechung 1 Ruf je 100 Hashes, wertlos.

### 2.3 Corp in BN3 selbst: Nutzen nicht messbar

BN3.1 (ohne Corp) **21,7 h**, BN3.2 (mit Corp) **22,7 h** Knotenzeit (`corpverlauf.mjs`, Sicherungen pre-jump).
Beide Laeufe enthalten rund 10 h fast ohne Rangfortschritt (Befund B9), der Vergleich ist damit verrauscht. Was die
Daten zeigen: Der Ausgang kam in beiden Laeufen erst nach einem Einbau (BN3.1: 13.315 -> 460.147 Rang in 2,1 h;
BN3.2: 9.517 -> 503.572 in 1,3 h nach 17 bestochenen Augs). Die Corp hat in BN3.2 den Einbau gross gemacht, aber
nicht frueher. Fuer die Route folgt daraus nichts mehr - nach BN3.3 kommt kein BN3-Lauf. **Keine Aenderung.**

---

## 3. Route: was die Corp nicht aendert und was trotzdem auffaellt

Die Corp liefert keine Source-File-Wirkung auf andere Knoten; sie ist (ausser in BN3) wirkungslos. Die Reihenfolge
ist gegen sie also invariant. Die Pruefung der uebrigen seit August gebauten oder freigeschalteten Hebel zeigt
aber eine Stelle, an der die Route ihr eigenes Prinzip (A4) verletzt:

**Heute:** BN3.3 -> BN11 x3 -> BN6.2/6.3 -> BN7 x3 -> BN14 -> BN13 -> BN15 -> BN8.

| SF | Wirkung auf V2-Laeufe (Quelle) | Profitiert heute | Profitiert nach Umstellung |
|---|---|---|---|
| SF6.2/6.3 | Kampf-Level +5,6 % gegen SF6.1 (`applySourceFile.ts:93-108`) -> Rangrate x1,08-1,10 | BN7, 14, 13, 15 | **zusaetzlich BN11 x3** |
| SF7.1-7.3 | Bladeburner-Erfolg, Ausdauer, Analyse x1,08/1,12/1,14 (`:110-122`); SF7.3 Simulacrum gratis (`PlayerObjectBladeburnerMethods.ts:14-19`) | BN14, 13, 15 | **zusaetzlich BN11 x3** |
| SF11.1-11.3 | Preiskette 1,9 -> 1,767 (`AugmentationHelpers.ts:30`); work_money/company_rep (V2: 0) | BN6 x2, BN7 x3, 14, 13, 15, 8 | BN14, 13, 15, 8 (**BN6/7 verlieren sie**) |

**Rechnung** (`routegewinn.mjs`): Gewinn BN11 x3 = 1,6 bis 11,2 h (Eckwerte, keine Verteilung).

**Skeptiker-Korrekturen, eingearbeitet:**
- SF7 wirkt nicht als pauschaler Ratenfaktor: Vertraege/Operationen laufen schon bei Chance 1 (`Action.ts:195`
  klemmt, `src/blade.js:1268-1271`). Er wirkt in zwei anderen Kanaelen - Black-Op-Chance (weit unter 1, linear,
  `Action.ts:190`) und Ausdauer x1,14 (`applySourceFile.ts:116-118`). Beide nicht modelliert.
- Der Verlust ist NICHT 0-0,5 h: Die Preiskette ohne SF11.3 macht denselben Satz Augs 1,25x (5 Stueck), 1,53x (8),
  2,19x (13), 2,93x (17) teurer (`AugmentationHelpers.ts:30`, nachgerechnet). In BN4/9/10 war Geld bindend (A3);
  BN7 hat AugMoney 3 und ScriptHackMoney 0,5. Realistisch 1-3 h je BN7-Lauf.
- BN11 selbst ist geldarm (ServerMaxMoney 0,01, Hacknet 0,1); ist er geldgebunden, verpufft ein Raten-Gewinn dort.
- Netto damit etwa **-10 bis +11 h** - Vorzeichen unbekannt, Groesse < 1 % der Restroute.

**Urteil: keine Umstellung.** Dazu kommt die Regellage: `nodes/BAUSTELLEN.md:30` und der Kopf von `src/lib/route.js`
setzen die Reihenfolge fest; eine Aenderung waere Erics Entscheidung und braucht einen belegten Gewinn.

---

## 4. Laufzeiten auf heutigem SF-Stand (neu angesetzt, nicht aus August uebernommen)

### 4.1 Gemessen

Start = `lastNodeReset` der Spielstaende, Dauer = Abstand zweier Starts (Wanduhr = Spielzeit, auch offline).
"Online" = Wanduhr minus "Spielverbindung getrennt" in `data/bridge.log` (ab 03.09.; eine stumm tote Bruecke fehlt darin).

| Lauf | V | Start (UTC) | Knotenstunden | davon online | Engpass (belegt) |
|---|---|---|---|---|---|
| BN10.2 | V2 | 01.09. 13:59 | 116,5 | - | Kaltstart 13,5 h, bn4rep fand 26 h keinen Platz (BAUSTELLEN.md:757, 893) |
| BN10.3 | V2 | 06.09. 10:32 | 97,3 | 79,3 | Einbau-Rhythmus 77/79/92 h, Konto beim Einbau ~0,5 Mrd |
| BN4.2 | V2 | 10.09. 11:52 | 47,2 | 47,6 | Rang lange flach (522 nach 25,7 h) |
| BN4.3 | V2 | 12.09. 11:02 | 52,0 | 34,6 | 17 h offline, Bruecken-Tod beim Sprung |
| BN9.1 | V2 | 14.09. 15:02 | 104,1 | 87,3 | hashes.js lief nicht (ERLEDIGT.md:53), Einbau warf Kampfwerte auf 1 |
| BN9.2 | V2 | 18.09. 23:09 | 81,7 | 49,2 | 32 h offline |
| BN9.3 | V2 | 22.09. 08:52 | 53,6 | 53,6 | nach den Fixes, kein Offline |
| BN1.2 / 1.3 | V1 | 24./25.09. | 19,5 / 12,7 | 13,1 / 12,7 | Daedalus-Schwelle 30 Augs |
| BN5.2 / 5.3 | V1 | 25./26.09. | 19,9 / 46,8 | 19,9 / 29,6 | 5.3: 17 h offline |
| BN12.1-12.3 | V1 | 28.09.-01.10. | 48,8 / 24,2 / 32,3 | 40,2 / 21,8 / 24,1 | 12.1: 8,6 h offline |
| BN2.1 | V2 | 03.10. 02:42 | 29,9 | 23,0 | Tab eingefroren 8 h (ERLEDIGT.md:26), rufgebunden |
| BN2.2 | V2 | 04.10. 08:39 | 20,4 | 15,0 | Gang gegruendet, Ausgang 8,1 h nach Einbau |
| BN2.3 | V2 | 05.10. 05:05 | **14,5** | 14,5 | Einbau bei 12,4 h (Sperre), Ausgang 2,1 h danach |
| BN3.1 | V2 | 05.10. 19:35 | **21,7** | 16,8 | Konto beim Einbau 1,7 / 0,2 Mrd, Ausgang 2,1 h nach 2. Einbau |
| BN3.2 | V2 | 06.10. 17:18 | **22,7** | 22,7 (bridge.log) | Corp: 1. Einbau bei 9,3 h nur 5 kleine Stuecke, 2. Einbau 12 h spaeter (Sperre) mit 17 bestochenen Augs, Ausgang 1,05 h danach |

Muster der aktuellen Bot-Generation (BN2.2 bis BN3.2): **der Ausgang kommt 1-2 h nach dem ersten grossen
Kampf-Aug-Einbau**, und dieser liegt an der 12-h-Einbausperre. Bladeburner-Rang allein traegt den Lauf nicht.

### 4.2 Skalierung fuer die offenen Knoten (`routegewinn.mjs`)

Modell: langsame Phase ~ 1 / (BladeburnerRank x StatLevelMult^beta), Basis = langsame Phase der rank-1,0-Laeufe
(BN2.3 12,4 h, BN3.1 18,6 h) plus Endspurt (1,5-3,1 h). Stat-Level-Faktor wirkt ueber die Kampfwerte
(`PersonObjects/Person.ts:62-145`), Rangfaktor direkt (`Bladeburner/Formulas.ts:9-28`).
**Keine Eichung, nur Groessenordnung (Band ~x2):** BN9 Modell 45-88 h ueber alle Eckkombinationen, gemessen BN9.3
53,6 h; BN10 Modell 60-121 h, gemessen 97,3 h - beide Baender decken fast jeden Wert. Bei Rang 1 / Stat 1 sagt das
Modell 14-22 h, BN4.2/4.3 brauchten 47-52 h (aelterer Bot). beta 1,44-1,77 stammt aus EINEM Punkt mit K = 4,8
(geldwert.md:89) und ueberzeichnet Stat-Faktoren < 1 (Kompetenz ~ Level^0,8-0,9, `Bladeburner/Actions/Action.ts:171-173`).
HackingLevelMultiplier, Charisma, SkillCost und AugMoney fehlen im Modell - die BN13/14/15-Werte sind eher Untergrenzen.

| Knoten | Faktoren (`BitNode.tsx`) | Hauptgeldquelle / Geldbedarf | Corp lohnt? | Laufzeit je Lauf (Knotenstunden, GESCHAETZT) |
|---|---|---|---|---|
| BN3 L3 (laeuft) | Rang 1, Augs x3/x3 | Corp (Zuendung) | ja, laeuft | Rest ~15-20 h |
| BN11 x3 | Rang 1, Stat 1, AugMoney 2, Hacknet 0,1, ServerMaxMoney 0,01 (:883-916) | Crime x3, Bladeburner-Vertraege; Hackgeld fast null - Geldbindung moeglich, nicht beziffert | **nein** - Bewertung max. 1,0e11 in 36 h | 14-22 h |
| BN6 L2/L3 | Rang 1, Stat 1 (:688-721) | dto. | **nein** - max. 2,8e11 | 14-22 h |
| BN7 x3 | Rang 0,6, Skill x2, AugMoney 3 (:722-763) | dto. | **nein** - max. 2,8e11 | 22-34 h |
| BN14 x3 | Rang 0,6, Stat 0,5, Skill x2, Fraktionsruf x0,2, GoPower 4 (:1040-1083) | dto.; Go (Tetrads -> Kampfwerte) als ungenutzter Hebel | **nein** - max. 1,1e12 | 58-109 h |
| BN13 x3 | Rang 0,45, Stat 0,7, Skill x2 (:991-1039) | dto.; Stanek nur hier | **nein** - max. 9,2e8 | 48-81 h |
| BN15 x3 | Rang 0,2, Stat 0,7, Skill x3, Hacknet 1 (:1085-1118) | Hashes (voller Faktor); Labyrinth-Caches | **nein** - max. 2,5e11 | V2 105-178 h; V1b (Labyrinth) 10-35 h laut AUDIT-ROADMAP:256-264 |
| BN8 x3 | V1, nur Boerse (:764-794) | Boerse, Geld nach jedem Einbau auf 250 Mio | **gesperrt** | keine Messung; V1-Laeufe BN1/5/12 lagen bei 20-32 h |

Summe der Restroute aus diesen Baendern 844-1.432 Knotenstunden, davon BN15 allein 315-534 h im V2-Fall.

---

## 5. Befundliste (Status)

| # | Befund | Status | Quelle |
|---|---|---|---|
| B1 | Corp ausserhalb BN3 erreicht in keinem offenen Knoten die Bestechungsschwelle in 36 h | **belegt** (gerechnet, Simulator auf Spielquelle, geeicht) | `sim/ergebnisse.json`; Eichung 2.1 |
| B2 | Gruendungsgeld 150 Mrd liegt in V2-Laeufen vor dem ersten Einbau nicht vor | **belegt** (gemessen) | `corpverlauf.mjs` auf `backups/` BN2L3/BN3L1/BN9L3/BN4L3 |
| B3 | Bestechung braucht Bewertung >= 1e14 und Mitgliedschaft; Bladeburners nicht bestechbar | **belegt** | `Actions.ts:623-643`, `FactionInfo.tsx:710-713` |
| B4 | Roadmap verletzt "Beschleuniger zuerst": BN7 (SF7.3) und BN6.2/6.3 hinter BN11 | **verworfen** nach Skeptiker-Runde: Gewinn 1,6-11,2 h gegen 1-3 h Verlust je BN7-Lauf, Vorzeichen unbekannt | `src/route.json`; `routegewinn.mjs` |
| B5 | SF7.3-Simulacrum ist im Bot wirkungslos, weil `bladeSperreArbeit` nicht nach dem Simulacrum fragt | **belegt** (Code) | `src/bn4rep.js:143-162, 642`; Spiel `Bladeburner.ts:178, 1354` |
| B6 | Gang ausserhalb BN2 ueber Sleeve-Karma | **verworfen** | Sleeves Sync 1 % (Spielstand: memory 1, sync 1,0) -> Karma x0,01 (`SleeveCrimeWork.ts:46`, `Sleeve.ts:178, 253`) |
| B7 | Hash-Rang skaliert nicht mit BladeburnerRank (wertvoll in BN15/BN13) | **belegt**; gebaut, aber ausserhalb BN9 nur bis zum ersten Einbau (Gratis-Server faellt beim Einbau weg, `PlayerObjectGeneralMethods.ts:130-131`; `src/hashes.js:192` beendet sich dann) | `HacknetHelpers.tsx:539-546`; `src/hashes.js:96` |
| B8 | Go in BN14: Tetrads-Siege heben Kampfwerte, GoPower 4 | **plausibel**, nicht gerechnet (nodePower-Zuwachs unbekannt) | `Go/effects/effect.ts:16-22, 78-83`; `BitNode.tsx:1042`; kein `ns.go` in `src/` |
| B9 | Lange Strecken ohne Rangfortschritt vor dem grossen Einbau (BN3.1 3,3-18,6 h, BN3.2 10,9-21,2 h); Offline-Luecken 8,6-32 h in fuenf Laeufen | **belegt** (Messung), Ursache in BN3.2 **offen** (Offline 04:35-14:30 UTC und 12-h-Sperre fallen zusammen) | `corpverlauf.mjs`; Laufzeit-Historie 4.1 |
| B10 | Corp in BN3.2 hat den Lauf messbar verkuerzt | **verworfen** (nicht messbar: 22,7 h gegen 21,7 h ohne Corp, verrauscht durch B9) | Abschnitt 2.3 |
| B11 | Labyrinth-Gewerk fuer BN15 fehlt | **belegt**; Nutzen **plausibel** (Formelrechnung August, keine Messung) | AUDIT-ROADMAP:256-264; `src/` ohne dnet-Gewerk |
| B12 | SF11 fuer V2 nur Preiskette | **belegt** | `applySourceFile.ts:153-163`, `AugmentationHelpers.ts:30` |
| B13 | Grafting mit Corp-Geld (H1) | **ausserhalb dieser Pruefung** - nur BN3, Erics Entscheidung (`data/nicht-schieben.txt`) | geldwert.md:106 |

---

## 6. `src/route.json`: kein Diff

Der gepruefte Kandidat liegt zur Nachvollziehbarkeit in `nodes/audit-roadmap-pruefung-2026-10/route-vorschlag.json`
(BN6.2/6.3 und BN7.1-7.3 vor BN11.1-11.3, sonst unveraendert). `node tools/test-route.js` war gegen ihn gruen (Kopie im
Scratch-Ordner; der Test prueft nur Konsistenz, nicht Richtigkeit). **Er wird nicht empfohlen** (Abschnitt 3).

Falls ein spaeterer Lauf ihn doch einspielen will (nur nach Rechnung der Verlustseite und Erics Ja):
- nur bei `ausgang.offen = false` einspielen: `ausgang.js:196` liest die Datei jede Runde (60 s), `exit.js:79` liest
  sie selbst - kippt sie, waehrend der Sprung offen ist, wird er abgelehnt und die 15-min-Sperre (`ausgang.js:186`) greift;
- `BAUSTELLEN.md:30`, Metadaten in `route.json` und den Kommentar in `src/lib/route.js` angleichen;
- einen Testfall mit dem heutigen SF-Stand ergaenzen (`tools/test-route.js` startet im Stand vom 02.09.).

---

## 7. Bauauftraege (getrennt von der Route)

| P | Knoten | Was bauen | Erwarteter Gewinn | Beleg |
|---|---|---|---|---|
| 1 | BN15 x3 | **Labyrinth-Gewerk V1b, bedingt.** Zuerst Machbarkeitstest mit Abbruchkriterium: Einbau-Ausloeser je Lab selbst (Lab-Aug wird nur gequeued, naechstes Lab erst nach Einbau, bn4rep baut erst ab 3 wartenden Stuecken ein), 5 Einbauzyklen, Darknet nach jedem Einbau neu, Charisma-Tor 3.000, WD-Level ~10.000 nach TRP (Zeit fehlt in der August-Rechnung). Route bleibt V2, bis Lauf 1 das Gewerk belegt - ein fehlendes `braucht` ueberspringt sonst den Eintrag, statt auf V2 zurueckzufallen (`src/lib/route.js`) | bis ~200-450 h ueber 3 Laeufe (GESCHAETZT aus Formeln, keine Messung) | AUDIT-ROADMAP:150-298; `DarkNet/effects/labyrinth.ts:432-473` |
| 2 | BN14, BN13, BN15 (nach BN7.3) | **Simulacrum-Parallelarbeit:** (1) `bladeSperreArbeit` (`src/bn4rep.js:642`) nur ohne installiertes Simulacrum; (2) `src/lib/figur.js:53-61, 206-224` Vertraeglichkeitsregel Bladeburner+Faktion bei Simulacrum (heute bricht Prio 20 jeden Faktions-Antrag 30 - Lockern allein ist ein stiller No-op); (3) Faktionsarbeit erst ab Kampfwert-Ziel von `bbtrain` (sonst verhungert das Gym nach jedem Einbau); (4) `data/simulacrum.txt` aus der Besitzpruefung schreiben (`graft.js:57`, `blade.js:4047`) | nicht beziffert; wirkt ueber FactionWorkRepGain (BN14 0,2, BN13 0,6, BN15 1) | `Bladeburner.ts:178, 1354`; `PlayerObjectBladeburnerMethods.ts:14-19` |
| 2 | BN14 x3 (wirkt via SF14 auf BN13) | **IPvGO-Spieler** (Tetrads -> Kampfwerte, GoPower 4, ab BN14.2 x8) | Vorarbeit: SF14 verdoppelt den Go-Bonus in BN13, +6,4-12,7 h ueber 3 Laeufe; BN14 selbst dort gerechnet | `nodes/audit-2026-10-03/bn-bn14-13.md:46-53`; `Go/effects/effect.ts:16-22, 78-83` |
| 3 | BN15, BN13 | **Hash-Rang nach dem ersten Einbau** (Hash-Rang skaliert nicht mit BladeburnerRank). Grenzkosten steigen linear: 1.000 Rang 13.750 Hashes, 10.000 Rang 1,26 Mio; nur im Anlauf sinnvoll. Heute bewusst nur BN9 (`hacknet.js:15-21`), Neukauf konkurriert mit der Werkbank | nicht gerechnet - erst Anlauf-Gewinn rechnen | `HacknetHelpers.tsx:539-546`, `HashUpgrade.ts:72-81`, `src/hashes.js:192` |

---

## 8. Was ich ausdruecklich NICHT aendern wuerde

- **Corp ausserhalb BN3 aktivieren** (`CORP_MONEY_NODES = [3]`, `src/lib/corpgeld.js:35`; `src/corp.js:90-93`):
  Abschnitt 2 - keine Zuendung in 36 h, kein Gruendungsgeld.
- **BN8 nach vorne:** die Corp ist dort ohnehin gesperrt; BN8 profitiert von allen Beschleunigern (SF11-Preiskette,
  Spenden ab Favor 0) und braucht als einziger Knoten die Boerse - letzter Platz bleibt richtig.
- **BN15 vor BN14/BN13:** ohne Labyrinth-Gewerk ist BN15 der teuerste Knoten; sein Platz am Ende des V2-Blocks laesst
  dem Gewerk die meiste Bauzeit.
- **BN14/BN13 umstellen:** BN14 vor BN13 ist richtig, sobald Go gespielt wird (SF14 verdoppelt den Go-Bonus in BN13,
  `nodes/audit-2026-10-03/bn-bn14-13.md:49-53`); ohne Go gleichgueltig.
- **BN6/BN7 vor BN11:** Abschnitt 3 - Vorzeichen unbekannt.
- **Verfahren aendern** (V1 in BN11 o. ae.): BN11 Hacking-Level 0,6, Fraktionsruf normal, aber Daedalus-Sockel je
  Lauf (AUDIT-ROADMAP:29); kein neuer Beleg, der V2 dort schlaegt.

---

## 9. Offen (konnte diese Pruefung nicht klaeren)

1. B9 in BN3.2: band die Offline-Luecke oder die 12-h-Einbausperre (H3-Ausnahme an die Mini-Runde verbraucht,
   BAUSTELLEN.md:519)? Die Corp-Uhr lief sichtbar langsamer (Corp-Stunde 15 bei Knotenstunde 21,6). Fuer BN3.3 relevant,
   fuer die Route nicht.
2. Wirkung der SF7-Faktoren auf die Rangrate: wie viele Aktionen laufen heute unter 100 % Chance?
3. nodePower-Zuwachs im Go-Spiel (B8).
4. Eine besser angepasste Corp-Strategie fuer niedrige Bewertungsfaktoren wurde nicht gesucht; der Simulator zeigt
   nur, dass die BN3-Strategie nicht traegt. Gegen eine Zuendung spricht strukturell der fehlende Rundentreibstoff.

5. Ist "Level 3 ueberall" (45 Laeufe, AUDIT-ROADMAP:21) Erics verbindliches Ziel oder ein Wunsch? BN13/14/15 x3 sind
   ~700-1.100 der 844-1.432 Reststunden; SF13.2/13.3, SF14.2/14.3, SF15.2/15.3 bringen ohne Stanek-/Go-/Labyrinth-
   Gewerk keinen V2-Nutzen. Das ist der groesste Hebel der Gesamtfrage und keine Rechenfrage.
6. Ist BN11 geldgebunden (ServerMaxMoney 0,01)? Dann ist dort Geld der Engpass, nicht Rang.

---

## 10. Skeptiker-Runde (07.10.2026, drei getrennte Winkel, sonnet)

**Eingearbeitet:**
- Praemisse 1, Zahlen 1, Fehlermodi 2: Umstellungsgewinn ist Rauschen, Verlustseite war ungerechnet -> Urteil von
  "Route aendern" auf **"Route bleibt"** (Abschnitte 0, 3, 6).
- Praemisse 2: SF7 wirkt ueber Black-Op-Chance und Ausdauer, nicht ueber gedeckelte Vertragschancen (Abschnitt 3).
- Zahlen 2/3: Laufzeitmodell ist keine Eichung, Band ~x2, Spaetknoten eher Untergrenzen (Abschnitt 4.2).
- Zahlen 4 und Praemisse 4: Corp-Absage gilt fuer die BN3-Strategie; Faktor ~1.000 im Vermoegenszuwachs als
  strukturelle Begruendung ergaenzt (Abschnitt 0). Die 150 Mrd sind Machbarkeit, kein Verlust.
- Fehlermodi 1: Simulacrum-Bauauftrag braucht die Figur-Prioritaeten, sonst No-op (Abschnitt 7).
- Fehlermodi 6 und Praemisse 6: Labyrinth nur bedingt, Abbruchkriterium, BN15 bleibt V2 (Abschnitt 7).
- Praemisse 5: BN14 vor BN13 nur mit Go relevant, Vorarbeit zitiert (Abschnitte 7, 8).
- Fehlermodi 3: BN11 geldarm (Abschnitt 4.2, offen 6). Fehlermodi 5: Einspielzeitpunkt, falls je eingespielt (Abschnitt 6).
- Zahlen 6 / Fehlermodi 7: Hash-Rang linear steigend, Prioritaet auf 3 (Abschnitt 7). Zahlen 7: Summe und 2,7e19 korrigiert.
- Praemisse 7: Umfangsfrage Level 3 als offene Frage an Eric (Abschnitt 9).

**Abgewiesen bzw. nicht umgesetzt:**
- Zahlen 5 (Zeilen auf `reference/v301` statt `reference/bitburner-src`): Werte identisch, alle Zeilen beziehen sich
  durchgehend auf `reference/bitburner-src` - so belassen, Hinweis hier.
- Verlustseite der Umstellung mit dem Kaufschleifen-Modell je Knoten nachrechnen: nicht gemacht, weil das Urteil ohnehin
  "keine Umstellung" ist; erst noetig, wenn jemand sie wieder vorschlaegt.
