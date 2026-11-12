# 1b - Zeitverluste: wohin sind die Stunden gegangen?

Stand: 12.11.2026 (Teil 1b des Plans `nodes/AUDIT-LAUF2-2026-11.md`). Nur lesend erstellt.
Zeitangaben in den Quellen sind Ortszeit (UTC+2); `backups/INDEX.tsv` steht in UTC. Rechenhilfen (nur
Lesen der INDEX.tsv) lagen im Scratchpad `audit1b/` (gaps.js, dur.js, on.js), nichts im Projekt ausgefuehrt.

**Lesehilfe.** W = Wanduhrstunden, S = Spielstunden/Fortschritt. "belegt" = Zahl steht in der Quelle oder ist
aus Quellzahlen mit angegebenem Rechenweg gebildet. "Spanne" = Ober-/Untergrenze, Rest unbelegt.
"Rahmen" = Differenzwert, der mehrere Einzelvorfaelle enthaelt und NICHT zu den Summen addiert wird.

## 0. Vorab: drei Messbefunde, die alles Weitere einrahmen

**M1 - Wanduhr gegen Online-Zeit (aus INDEX.tsv, Luecken >= 2 h zwischen zwei Sicherungen).**
Seit dem ersten Indexeintrag (03.09. 23:13 UTC) bis 12.11. 19:23 UTC: 1.676 W. Davon 626 W in 70 Luecken
ohne Bruecken-Sicherung (37 %); typisch 8-11 h pro Nacht (ca. 03-14 UTC = 05-16 Uhr Ortszeit). Online also ca. 1.050 W.
Gesamt seit 19.08. (2.040 W laut `totalPlaytime`) liegen vor dem Index weitere ca. 364 W ohne Luecken-Messung.

**M2 - Die Luecken kosten V1-Knoten Fortschritt, V2-Knoten (Bladeburner) offenbar nicht.**
Indiz V1: BN12.1/12.2/12.3 brauchten 49/24/33 W, aber 10/11/13 Online-Stunden (Luecken 38,8/13,0/19,6 h);
BN8.1 60,7 W, 30,4 h Luecke, Online 30,3 h gegen Plan 30,5 h (`audit-2026-11-07/BN8-ROUTE.md`). Fortschritt
folgt hier der Online-Zeit. V2: Bladeburner bucht Offline-Zeit als `storedCycles` und holt sie mit Faktor 5 auf
(ERLEDIGT.md Z.5858 "Rechner laeuft nur 5,5 von 24 Stunden", Gleichgewicht 4,8 h/Tag; AUDIT-ROADMAP-PRUEFUNG A11: Offline zaehlt
1:1 in `totalPlaytime`). BN6.2 hatte 7,7 Online-h bei 35,6 W: bei 5-facher Aufholzeit passt das.
Das ist ein Schluss aus Mustern, nicht aus einem direkten Test (siehe Abschnitt 6, U1).

**M3 - Laufzeit je Lauf (Wanduhr, Start = erster Indexeintrag des Laufs, Ende = Start des naechsten).**

| Knoten | L1 | L2 | L3 | Bemerkung |
|---|---|---|---|---|
| BN1 | (vor Index, 19.-21.08.) | 19,4 | 13,0 | V1 |
| BN4 | ca. 46 (21.-23.08., Schaetzung aus Commits) | 47,7 | 51,4 | keine Besserung |
| BN5 | ca. 28 (23.-24.08.) | 19,6 | 46,8 (17,8 online) | V1 |
| BN6 | ca. 92 (24.08. 21:25 - 28.08. 17:05) | 35,6 | 33,3 | groesste Lernkurve |
| BN10 | ca. 95 (28.08. 17:05 - 01.09.) | 116,5 | 97,6 | keine Besserung, L2 schlechter |
| BN9 | 104,6 | 81,1 | 53,7 | |
| BN12 | 49,0 | 24,4 | 32,7 | V1, online 10/11/13 |
| BN2 | 29,7 | 20,6 | 14,0 | Gang ab 04.10. |
| BN3 | 21,6 | 23,1 | 46,2 | Corp ab 06.10. |
| BN11 | 18,0 | 24,0 | 32,3 | |
| BN7 | 75,3 | 62,2 | 68,0 | Erwartung 22-34 je Lauf |
| BN14 | 37,1 | 27,4 | 23,0 | Go ab 07.10. |
| BN13 | 48,7 | 60,6 | 30,0 | |
| BN15 | 100,7 | 41,8 | 34,0 | Go+Graft ab 07.11. |
| BN8 | 60,7 (laeuft) | 8,0 (laeuft) | - | |

Summe je Knoten (Wanduhr, nur Index-Zeit): BN9 239, BN7 205, BN15 177, BN10 157 (+ca. 60 vor Index), BN13 139,
BN12 106, BN4 99, BN3 91, BN14 87, BN11 74, BN8 69, BN6 69, BN5 66, BN2 64, BN1 32.

## 1. Tabelle der Vorfaelle (chronologisch)

Kategorien: BOTFEHLER, STRATEGIE, WISSEN, BETRIEB, WARTEN, UMBAU. "Verankert" = Lehre steht im Code/Test (C) oder nur in Notiz (N).
Stundenangaben W (Wanduhr) und S (Spiel). Zeilen mit **Rahmen** nicht addieren.

| ID | Datum | Knoten/Lauf | Was / Ursache | Kat. | Stunden | Quelle | Behoben (Commit) / verankert |
|---|---|---|---|---|---|---|---|
| V01 | 20.08. 00-05 | BN1.1 (Reset-Runde) | Nach Reset 5 h ohne Einkommen: Zielzahl (60/40) stammte von 274-TB-Netz, Sicherheitsausgleich fuer geplante grow-Faeden > ganzes Netz | BOTFEHLER | 5 W (belegt) | git d7d1d13 | d7d1d13; C (Stillstandswache Stufen 1-3); Lehre "im Nach-Reset-Zustand testen" erst spaeter als Test (204a941) |
| V02 | 20.08. | BN1.1 | Backdoor-Serie: vier Versuche mit fest eingetragenem Weg scheiterten (Netz wird je Reset neu verdrahtet) | BOTFEHLER | unbelegt (Stunden) | git aa39a20 | aa39a20; C (Wege berechnet) |
| V03 | 20.08. 19-21 | BN1.1 | buyaugs/work.js: Alt+T nie geprueft, Kauflauf haengte 3x je > 10 min; "Fokus"-Knopf falsch gelesen; nfgdepth 0 wirkungslos | BOTFEHLER | unbelegt | git a4c1179, 631170f | 631170f, a4c1179; C |
| V04 | 23.08. 17:18 | BN5.1 Eintritt | Nach Sprung 25 min Stillstand (reserveHome 16 GB auf 32-GB-home, Werkbank-Schwelle, task.txt-Leser fehlte) | BOTFEHLER | 0,4 W (belegt) | git 5583daf | 5583daf; C |
| V05 | 24.08. 21:25 | BN6.1 Eintritt | Kaltstart-Sackgasse: Mietleiter ab 64 GB mit 4x Preis = 14,1 Mio bei 250 $/s; Fix verhinderte ca. 15 h Leerlauf | BOTFEHLER | 2 W real (belegt: "rund zwei Stunden statt fuenfzehn") | git c4e63b1 | c4e63b1; C. Gleiche Klasse trat in BN10.2 erneut auf (V24) |
| V06 | 25.08. 05:42 | BN6.1 | Bladeburner-Gewerk fehlte beim Knotenwechsel: Nacht auf Hacking-Achse gearbeitet, Ausgang aber ueber 21 Black Ops; erst 05:42 `blade.js`+`bbtrain.js` gebaut | WARTEN (fehlendes Gewerk) | ca. 8,3 W (21:25-05:42); Fortschrittsverlust unbelegt (Netz 8/70->95/95, home 256 GB waren nuetzlich) | git a8263cc | a8263cc; Roadmap-Plan nannte BN6 = V2, Gewerk war nicht vorher gebaut (N: "Gewerke vor Knoten bauen" erst 07.11. gelernt, siehe V43) |
| V07 | 25.08. 16:25-18:20 | BN6.1 | Erste 2 h nach Beitritt: bn4life/bn4rep brachen Aktionen sekuendlich ab, Faehigkeitenkauf nahm Billigstes, Tab 5x gedrosselt, Tracking leer -> Training | BOTFEHLER | 1,6 S (belegt: ROUTE.md S.4: von 125 min hoechstens 30 min ungestoert) | nodes/ROUTE.md Abschn. 4; ERLEDIGT.md Z.7715,7755 | alle behoben 25.-26.08.; C |
| V08 | 25.08. 17:47-20:26 | BN6.1 | Browser-Tab verdeckt: 1 statt 4-6 Motorrunden/min; Tonanker zu leise (Pegel) | BETRIEB | 2-3 S (Rechnung: 2,65 h x (1-1/5) = 2,1) | ERLEDIGT.md Z.7623 | 611b48a (Worker-Timer-Rueckfall); Tonanker/Pegel C; 23.10. c5d747e bestaetigt |
| V09 | 25.08. 20:27-21:19 | BN6.1 | Spielengine stand 52 min: eigenes `hacktimer.js` haengte beim Verstecken des Tabs Rueckruf ein | BOTFEHLER | 0,9 S (belegt) | ERLEDIGT.md Z.7558 | 47342b4; C (nur `--scharf`); Pruefer erkennt Stand (edee839) |
| V10 | 25.08. 20:42 | BN6.1 | blade.js 23 min in Regenerationskammer (HP_WEITER 0,95 unerreichbar) | BOTFEHLER | 0,4 S (belegt) | ERLEDIGT.md Z.7602 | 60b3249; C |
| V11 | 25.08. 05:50-16:50 | BN6.1 | bn4rep.js lief 11 h nicht (Werkbank 1.024 GB, 712 GB belegt, kein zweiter Wirt) | BOTFEHLER | 11 W Gewerk stand; Rangverlust unbelegt (BN6: Rep nicht der Engpass) | ERLEDIGT.md Z.7737 | 25.08. 16:50 Werkbank; 26.08. 20:20 Werkbank 1024 GB (61629e8); N+C (Waechter meldet Platzmangel 61af9e5) |
| V12 | 26.08. 03:02-05:10 | BN6.1 | 4 Cron-Loops standen 2 h (haengender Hintergrund-Task), Bot lief durch | BETRIEB | 0 S (Rang 143->296 lief weiter); 2,1 W Aufsicht blind | ERLEDIGT.md Z.7403 | 1f8eb13; C (Erkennung) + N (Regel in CLAUDE.md). Loops seit 31.08. abgeschafft |
| V13 | 26.08.-28.08. | BN6.1 | Skill-/Kammer-Lernkurve: Kammer 72,5 % der Zeit, Overclock statt Cyber's Edge, Chaos >50 halbiert Chancen, Raid verworfen/rehabilitiert, Team nie rekrutiert, `s.min` Rauschen, Assassination nie gefahren (Stufe 1) | WISSEN (+BOTFEHLER) | **Rahmen**: Rangrate 0,15/min (25.08. 18:21) -> 78/min (28.08. 03:08), Faktor ca. 500; ETA 182 h -> 64 h am 28.08.; BN6.1 92 W gegen BN6.2 35,6 W = **<= 56 W** Obergrenze fuer alle Lernkosten | ERLEDIGT.md Z.5221, 5764, 5988, 6370, 7203; HEBEL.md | je einzeln C (blade.js); viele nur in HEBEL/ENTSCHIEDEN (N) |
| V14 | 27.08. Nachmittag | BN6.1 | WERKZEUG-Kanal traf ins Leere: blade.js lief mit altem Code (PID 7004), 5 Bedienungen wirkungslos; Digital Observer blieb Stufe 1 | BOTFEHLER | unbelegt ("einen ganzen Nachmittag", Quelle) | ERLEDIGT.md Z.6287 | 19:46 behoben; C (bn4net ergaenzt .js) |
| V15 | 27.08. 12:49 -> 19:39 | BN6.1 | Black-Op-Gate auf `s.min` (Bevoelkerungsrauschen) statt wahrer Chance; Schwelle 0,80/0,90 hielt Operation K > 1 h zurueck | WISSEN | unbelegt; 1,1 h belegt fuer Operation K (11:03-12:12) | ERLEDIGT.md Z.6370, 4097 | 80c043d (Chance gerechnet); C |
| V16 | 28.08. 05:53 | BN6.1 | Einbau mit EINEM Stueck (Spendenrecht-Zweig umging Mindestwarteschlange): 3 h 49 min Wiederaufbau, ca. 81.000 Rang Pause | BOTFEHLER | 3,8 S (belegt) | ERLEDIGT.md Z.3928 | d7cb290, 3cef397; C |
| V17 | 28.08. 08:12-12:35 | BN6.1 | Motor-Fehlwahl: Diplomacy 71 min (57 %) ohne Rang, Field Analysis 32 min fuer 6 Rang, Gym ohne Black-Op-Pruefung, Chongqing ausgebrannt (popEst 0) 87 min | BOTFEHLER/WISSEN | 2-3,2 S (Summe der Minutenangaben, ueberlappen teils) | ERLEDIGT.md Z.3983, 4221, 4496, 4175 | 12:44 u.a.; C |
| V18 | 28.08. 17:05 | BN10.1 Eintritt | Netz haengt auf 8 von 70: `darkweb.js` begann mit `document` = 25 GB (Dom) | BOTFEHLER | bis 1,6 W (17:05 Eintritt -> 18:41 Fix) | ERLEDIGT.md Z.3682 | cd53db4 (2,65 GB); C (Namenspruefer d3bfe96 am 04.09.) |
| V19 | 29.08. 04:15 | BN10.1 | bn4rep.js baute VOR dem Divisionsbeitritt ein (`k !== 6 && k !== 7`, die 10 fehlte): Kampfwerte 88->1, 119.865 Exp weg | BOTFEHLER | 6,6 S (belegt, 90.810 Exp bei 230/min) | ERLEDIGT.md Z.3127 | a9e4d1a/199a165; C + ENTSCHIEDEN-Zeile; BLADE_KNOTEN (4ddfd7b) gegen Wiederholung |
| V20 | 28.08. 17:05 -> 29.08. 05:44 | BN10.1 | Faktionsarbeit statt Gym (gleiche Luecke wie V19): Kampf-Exp 22/min statt 230/min | BOTFEHLER | <= 11,4 S (Obergrenze: 12,6 h x (1-22/230)); Untergrenze unbelegt; Quelle: "168 h statt 16 h" | ERLEDIGT.md Z.3276 | 83362de; C |
| V21 | 28.08.-29.08. | BN10.1 | Sleeve stand: erst gar kein Skript (28.08. 17:05-17:50), dann 90 min nach WERKZEUG-Kanal ohne Neustart | BOTFEHLER | 2,3 W; ca. 0,5 S (Sleeve = 1/5 des Traegers, HEBEL 22:05) | ERLEDIGT.md Z.3755, 2781 | bb06e9a, b8cb548 (Startliste); C |
| V22 | 29.08. 19:05 | BN10.1 | Einbau 50 min nach Beitritt, Gym-Wiederaufbau 8,06 h (vermutet) | STRATEGIE (verworfen) | **kein Verlust**: spaeter 4,43 h gemessen, "Einbau war richtig", 44 Rang Kosten | ERLEDIGT.md Z.2585 | - |
| V23 | 30.08. 07:29-07:50 | BN10.1 | Incite Violence nicht abbrechen: 21 min Zweiminutenzyklus | BOTFEHLER | 0,35 S (belegt) | ERLEDIGT.md Z.1771 | 30f6d1d; C |
| V24 | 30.08. 22:06 | BN10.1 | Graft SPTN-97 von bbtrain getoetet ($14,63 Mrd); Riegel gebaut aber nie neu gestartet | BOTFEHLER | ca. 0,1 S + 14,63 Mrd $ | ERLEDIGT.md Z.910 | 0cc22a2; C |
| V25 | 30.08. 23:02 | BN10.1 | Einbau VOR dem 38er-Graftpaket: Geld auf 1.262 $ gesetzt, 28,4 Bio verworfen fuer 5,58 Mrd Augs; danach Rangrate +61/+78 % | STRATEGIE | 0 h belegt (Rangrate stieg) | ERLEDIGT.md Z.865, 227 | N (Graft-vor-Einbau Empfehlung) |
| V26 | 31.08. 17:10 | BN10.1 Ende | Ausgang ueber Black Ops nicht erkannt (`EXIT_KEY` = The Red Pill), Selbstsprung in eigenen Knoten gesperrt: Knoten endet im Stillstand ("bis zu zwei Tage") | BOTFEHLER | verhinderte Verluste: bis 48 W; real unbelegt (Sprung 01.09. 15:59 von Hand `task.js`) | BAUSTELLEN.md Z.1085 | 9160c75 (ausgang.js + route.json) 02.09.; C |
| V27 | 01.09. 16:00 -> 02.09. 05:27 | BN10.2 | Kaltstart: erster Mietrechner kostet 5x (`CloudServerCost 5`), Leiter forderte 1,25x = 11 Mio, Kommentar rechnete mit BN6-Preisen; 13,5 h bei 8/70, home 32 GB | BOTFEHLER | 2-13,5 W (Obergrenze 13,5 belegt; Untergrenze: ca. 10,5 h Sparzeit bis 8,8 Mio bei 177 $/s) | BAUSTELLEN.md Z.1007 | 1302cd6; C (Preise aus pl.preise) |
| V28 | 01.09. 16:00 -> 02.09. 18:02 | BN10.2 | bn4rep.js fand 26 h keinen Platz (Park 15/15, max 512 GB, Ausbau ruestet nur kleinsten Rechner) - ganzer Lauf 2 ohne Augs | BOTFEHLER | **Rahmen**: BN10.2 116,5 W gegen BN10.1 ca. 95 W = 21,5 W Mehrzeit; V27+V28 ueberlappen | BAUSTELLEN.md Z.871; AUDIT-ROADMAP-PRUEFUNG Abschn.4.1 | 1302cd6; C |
| V29 | 03.-04.09. | BN10.2 | Bot-Neubau (BAU-2026-09): 23 h Bauzeit am laufenden Knoten; Einspielung stufenweise; ausgang.js 30 min tot, Beinahe-Graft 450 Mrd (20:06) | UMBAU | 0,5 W (belegt ausgang.js); Rang 399->575/h nach Einspielung (+44 %) | git 355d06c..1032374; Einspielprotokoll | C |
| V30 | 07.09. 03:48 -> 16:xx | BN10.3 | Nach Aug-Reset vollstaendiger Stillstand: bn4life 293 GB + blade 94 GB auf 512-GB-home, kein Geld, kein Rechner, Kampfwerte 1; Bruecke in dieser Zeit ohne Sicherung | BOTFEHLER (+BETRIEB) | 10,5-12,5 S (belegt: "nach 10,5 Stunden reiner Spielzeit" 05:38->16:06) | BAUSTELLEN.md Z.714 | **nur N**: "ENTSCHIEDEN 22.09. nicht gebaut", mildern durch SF4.3 (BN4.3, 14.09.); d28ec8b (Listen je Runde, 10.09.) teils C |
| V31 | 10.09. 15:31 | BN4.2 Eintritt | Beide Kaltstart-Befunde (cdump/csolve-Verklemmung, Werkzeugliste) beim Sprung reproduziert | BOTFEHLER | unbelegt (ca. 1 W) | git a71b143, d28ec8b | d28ec8b; C |
| V32 | 10.09.-11.09. | BN4.2 | Chaos-Teufelskreis: nach Einbau 10 h im Gym "nichts ueber Schwelle" (Chaos in allen Staedten 52-75), Rang 36/h | BOTFEHLER | 10 S (belegt) | ERLEDIGT.md Z.1618 | ba7f31f; C (Tests) |
| V33 | 12.09.-24.09. | BN4.3-BN9.3 | Bruecke stirbt still (12.09. x2, 14.09. direkt nach pre-install-Sicherung, 17.09., 18.09., 24.09. 21:19-22:15, 28./29.09. x2, 03.11.); kein Log-Eintrag | BETRIEB | 24.09.: 0,9 W belegt; Rest unbelegt (in Luecken von M1 enthalten) | git 4ae276f.., Memory bitburner-bruecke-stirbt | **nur N** (WMI-Start im Skill /bb); kein Autostart auf Erics Wunsch |
| V34 | 14.09.-19.09. | BN9.1/9.2 | `hashes.js` lief nie (requiresFeature 9, kein Leser lieferte `features`), zwei BN9-Laeufe lang Hash-Speicher am Deckel; Gym-Hebel ungenutzt | BOTFEHLER | <= 11 S (Rechnung: Anlauf 10 h gegen Gym x2,2; Break-even-Notiz) - Untergrenze unbelegt | ERLEDIGT.md Z.53; BAUSTELLEN.md Z.2534 | 8371519 (19.09.); C |
| V35 | 15.-16.09. | BN9.1 | Einbau in BN9 (Kampfwerte zaehlen 0,45) kostete einen ganzen Tag Anlauf: 15.09. 3,6 h vor Beitritt -> 16.09. Kampfwerte neu bei ca. 90 | STRATEGIE | ca. 20 S (Quelle: "Weg bis 100 dauert ~20 h", geschaetzt) | git 8cb51f0 (Notiz BAUSTELLEN) | N (Pruefen der Install-Regel in BN9 offen); teils V19-Regel |
| V36 | 22.09. 08:55-10:52 | BN9.3 Ausgang | Sprung klemmte: `exec` gab 0 auf blade, Handschlag landete auf falschem Rechner, checkin.js stuerzte ab (TDZ) | BOTFEHLER | 1,9 W (belegt) | BAUSTELLEN.md Z.399 | cfc4797, 58a1215; C |
| V37 | 22.09. 21:xx -> 23.09. 09:15 | BN9.3 | Aug-Ruecklage 92 Bio (aus unerreichbaren Stuecken) sperrte sechs Gewerke | BOTFEHLER | unbelegt (bis 12 W moeglich) | git db8ce80 | db8ce80; C |
| V38 | 24.09. | BN9.3 | SF9.3-Gratisserver geht beim ersten Einbau verloren; Aufschub verworfen | WISSEN | unbelegt | git 009564d, 2047788 | N |
| V39 | 26.09. 20:04-20:40 | BN5.2 Ende | w0r1d_d43m0n gebackdoort -> BitVerse-Auswahl, Bot stand statt zu springen | BOTFEHLER | ca. 0,6 W (INDEX 18:04->18:40 UTC) | git d4439a7 | d4439a7; C |
| V40 | V1-Knoten 25.09.-01.10. | BN5.2/5.3/12.x | Perfekt-Audit: Fokus geht verloren (Ruf x0,8 in 50-90 % der Arbeitszeit), Spendenrecht-Einbau 37 min Warten je Knoten, vorzeitiger Einbau 10-20 min je Red-Pill-Phase, Nullfenster 11-25 min nach Reset | BOTFEHLER | unbelegt je Stueck; 37+15 min je V1-Lauf gerechnet | AUDIT-PERFEKT-2026-09-26.md A1,A4,A5,B7 | caa4091, 6a75289, 988e16f; C |
| V41 | 03.10. 08:33 UTC | BN2.1 | `maennerNoetig` Endlosschleife (n = 8,2e18 > 2^53): Tab fror ein, kein Autosave, jeder Neustart lud 08:32:54 | BOTFEHLER | 7,3 W (INDEX-Luecke 07:59-15:16 UTC) / "8 h" (Quelle) | ERLEDIGT.md Z.26 | 0d1bf69/3c85b0c; C + Test + Lehre (Obergrenze fuer Schleifen) in doku/schlupfloecher.md |
| V42 | 03.10.-04.10. | BN2.1/2.2 | Gang fehlte bis 04.10. (GANG-1 geschaetzt 10-25 h/Lauf), Red-Pill-Falle, Kaufplaner fehlte | STRATEGIE | **Rahmen**: BN2.1 29,7 W gegen BN2.3 14,0 W = 15,7 W; davon V41 7,3 -> bleiben ca. 8,4 W Gang/Kaufplaner/Lernen | AUDIT-VOLLSTAENDIG GANG-1, AUDIT-ROADMAP-PRUEFUNG 4.1 | ce6262d, a5e56c3; C |
| V43 | 04.09. -> 07.11. | alle V2-Knoten BN10.2-BN15.1 | Grafting-Zuender (`graftplan.json`) 64 Tage zurueckgehalten (Handentscheidung "450 Mrd beim Start weg", nie neu bewertet; Eric-Freigabe 03.10. nicht umgesetzt, Audit am 04.10. auf Wunsch abgebrochen) | STRATEGIE | unbelegt je Knoten; **Rahmen** BN15: 100,7 W (ohne) gegen 41,8/34,0 W (mit Go+Graft+Simulacrum-Parallel): 59-67 W, Anteil Graft/Go/Offline nicht trennbar | gating-bericht.md A.1; SYNTHESE 07.11.; AUDIT-VOLLSTAENDIG AUG-1 | 16cb398 (07.11.); C |
| V44 | 04.10.-08.10. | BN3.1-3.3 | Corp (BN3) gebaut: BN3.2 mit Corp 22,7 W, BN3.1 ohne 21,7 W - Nutzen nicht messbar; BN3.3 46,2 W (Kind-Reserve no_space, Runde 4 an Mindestbetrag, Graft verloren 08.10.) | STRATEGIE / BOTFEHLER | Bauaufwand ca. 3 Tage fuer 0 W Gewinn; BN3.3 Mehrzeit gegen 3.1/3.2 bis 24 W (Obergrenze, Ursache unbelegt; Luecken 18 h) | AUDIT-ROADMAP-PRUEFUNG A2/B9; git cea1d94, 0a14f22, 527832f | C; Corp nur BN3 (07.10.) |
| V45 | 07.10. -> 07.11. | BN14.x, BN13.x, BN15.1 | Go (IPvGO) nur BN13/14 per Registry, BN15 vergessen; MCTS erst 24.10.; Graft fehlte in BN15 | STRATEGIE | BN15.1 siehe V43 (nicht doppelt zaehlen) | SYNTHESE 07.11.; git 5309b8a | 5309b8a (07.11.); C |
| V46 | 15.10.-24.10. | BN7.1-7.3 | BN7 brauchte 75/62/68 W gegen Erwartung 22-34 W (Rang x0,6, Skill x2, AugMoney 3); Befunde: Raid in Sector-12 unsichtbar (wahre Chance r<1), Stadtwahl nach popEst, Assassination fehlt in 7.1 | WISSEN/STRATEGIE | **Rahmen**: +100 bis +140 W gegen Erwartung (Differenz 205 - 66..102), Ursache nicht aufgeklaert | AUDIT-ROADMAP-PRUEFUNG 4.2; git c74c76f, 98021ad | teils C (Stadtwahl) |
| V47 | 09.11. 22:43 -> 10.11. 17:57 | BN8.1 | BN8-Block (Depot vor Einbau, Abruf, 4S nach Vermoegen, Handelsregel) bei Eintritt nicht gebaut ("zurueckgestellt bis vor den Knoten"), erst im laufenden Knoten (19 h) | WARTEN (fehlendes Gewerk)/UMBAU | verhinderter Verlust (03.10.-Schaetzung) +70-100 W je Lauf; real BN8.1 online 30,3 W = Plan 30,5 W -> kein Mehrzeit durch den Block belegt | SYNTHESE 07.11.; git e9a0d6b..a7099c6 | C |
| V48 | 11.11. 05:24 -> 17:27 | BN8.1 | Automatische Firmenphase sperrte die faellige Einbaurunde 2 still ueber `install-sperre.txt` | BOTFEHLER | <= 1 S online (Bruecke 16:06 UTC wieder, Fix 16:28 UTC), bis 11 W Wanduhr ueberlappend mit Luecke (V1: Offline ohne Fortschritt) | Memory bitburner-endspurt-bn8; git bf1c2fa | bf1c2fa (nur BN8!); sonst N |
| V49 | 03.09.-12.11. | V1-Knoten (BN1.2/5.3/12.x/8.1) | Bruecke ohne Sicherung = PC/Verbindung aus; Fortschritt folgt der Online-Zeit (M2) | BETRIEB | **138 W belegt** (7,3+29,0+38,8+13,0+19,6+30,4 aus INDEX) | backups/INDEX.tsv (Luecken); on.js | nicht behoben (Eric: kein Autostart; Neuverbindung braucht Klick Options->Remote API->Connect) |
| V50 | 03.09.-12.11. | V2-Knoten | Gleiche Luecken in V2 (488 W): Fortschrittsverlust durch Bonuszeit vermutlich gering, nicht gemessen | BETRIEB | unbelegt (0-488 W Wanduhr, Schaetzung 0-20 S) | INDEX; ERLEDIGT.md Z.5858 | - |

Anmerkungen zur Tabelle:
- Aus ERLEDIGT.md liegen 180 Abschnitte vor (400 KB). Gelesen wurden die Abschnittsanfaenge plus alle Zeilen mit Zeit-/Faktorangaben (ca. 120 KB Auszug) und die tragenden Eintraege vollstaendig. Die ca. 120 uebrigen Aug-25-bis-30-Eintraege sind Minutenbefunde zur BN6/BN10-Feinabstimmung (Kammer, Fenster, Schwellen) und stecken im Rahmen V13/V17, nicht einzeln.
- Der Quellordner enthaelt fuer Sep-Nov kaum noch ERLEDIGT-Eintraege; dort stuetzt sich die Tabelle auf `BAUSTELLEN.md`, die Audit-Dokumente und Commit-Titel.

## 2. Summen je Kategorie

Nur Einzelvorfaelle (V13, V28, V42, V43, V46 sind Rahmen und fehlen hier). Spielstunden und Wanduhr nicht vermischt, wo getrennt belegbar.

| Kategorie | belegt | Spanne (Untergrenze..Obergrenze) | unbelegt (Anzahl) |
|---|---|---|---|
| BOTFEHLER | **ca. 51 h** (bei Stillstand W = S: V01 5; V04 0,4; V05 2; V07 1,6; V09 0,9; V10 0,4; V16 3,8; V19 6,6; V23 0,35; V24 0,1; V30 10,5; V32 10; V36 1,9; V41 7,3; V39 0,6) | V17 2-3,2; V20 0-11,4; V27 2-13,5 (mit V28 gedeckelt bei 21,5 Rahmen); V11 0-11; V34 0-11; V21 0,5-2,3; V48 0-1 -> **ca. 5-50 h** zusaetzlich | V02, V03, V14, V15, V26 (real), V31, V37, V40, V44 (BN3.3) = 9 |
| STRATEGIE | V35 ca. 20 S (Schaetzung der Quelle) | V42 Gang ca. 8,4 W; V43/V45 Graft+Go BN15 25-60 W (Rahmen 59-67) | V25 (0), V44 Corp (0) |
| WISSEN | 0 einzeln | gesamte BN6.1-Lernkurve **<= 56 W** (V13) | V38, V46 (+100-140 W Rahmen) |
| BETRIEB | 0,9 W (V33 24.09.) + **138 W V1-Luecken (V49)** + 2-3 S Drosselung (V08) | V50 V2-Luecken 0-20 S | V33 uebrige 9 Brueckentode |
| WARTEN | 0 | V06 ca. 8,3 W (Fortschrittsverlust 4-8); V47 70-100 W verhindert | - |
| UMBAU | 0,5 W (V29) | - | - |

**Doppelzaehlung, ausdruecklich vermieden:**
1. V27/V28: dieselben ersten 26 h von BN10.2; Obergrenze fuer beide zusammen ist die Laufzeitdifferenz 21,5 W.
2. V07/V08 und V13: die Anlaufstoerungen vom 25.08. sind Teil der BN6.1-Lernkurve (<= 56 W); ebenso V09, V10, V14-V17.
3. V43, V45, V46-BN15 und V50: BN15.1 (100,7 W) enthaelt 68,6 W Luecke; in V2 zaehlt die Luecke nach M2 nicht als Fortschrittsverlust, die 59-67 W Differenz sind also in W nicht vollstaendig Fortschritt.
4. V41 liegt in der BN2.1-Differenz V42 (7,3 W abgezogen).
5. V48 liegt in der Luecke V49 (11,7 W am 11.11.): in V1 gilt Offline = kein Fortschritt, die Sperre kostete real nur die Online-Zeit.
6. V30, V33 und die Luecke vom 07.09. 03:43-14:04 UTC (10,4 W) sind dieselben Stunden.

Belegte Gesamtsumme der Einzelvorfaelle (ohne Rahmen, ohne Spannen): BOTFEHLER ca. 51 h + STRATEGIE V35 ca. 20 h (Schaetzung der Quelle) + BETRIEB 0,9 h + UMBAU 0,5 h = **rund 72 h Fortschritt**, dazu **138 W V1-Betriebsluecken** (V49, getrennt zu fuehren). Obergrenze mit allen Spannen: ca. 72 + 60 (Spannen BOTFEHLER) + 20 (V42/V43 Teilanteile) = ca. 150 h neben den 138 W.
Zum Vergleich: Gesamtlaufzeit 2.040 W; Online-Zeit nach INDEX ca. 1.050 W; die belegten Einzelfehler machen also nur ca. 5-7 % der Wanduhr aus. Die grossen Posten sind Rahmenwerte (BN6.1 <= 56, BN15.1 59-67, BN10.2 21,5, BN2.1 15,7).

## 3. Die 10 teuersten Vorfaelle

1. **V49 V1-Knoten-Offline-Luecken, 138 W belegt.** Wanduhr, nicht Spielstunden: BN12.x (71,4 W), BN8.1 (30,4 W), BN5.3 (29,0 W), BN1.2 (7,3 W). V1-Fortschritt haengt an der Online-Zeit (BN12 13/13/14 Online-h gegen 49/24/33 W). Nicht im Bot behebbar, nur durch Betrieb.
2. **V13 BN6.1-Lernkurve, <= 56 W.** Erster Bladeburner-Knoten: Rangrate vom 25.08. bis 28.08. um Faktor ca. 500; alle Hebel (Krankenhaus x1,8, Fahigkeitsplan +30 %, Assassination ETA 182->64 h, Raid-Rundreise, Team) fielen erst waehrend des Laufs aus dem Quellcode. Obergrenze, weil BN6.2 auch SF-Boni hatte.
3. **V43/V45 Grafting+Go in V2, BN15: 59-67 W Differenz (Rahmen).** 64 Tage zurueckgehaltener Zuender; Go in BN15 vergessen. Anteil an den 100,7 W unbelegt (Luecken 68,6 W, Bonuszeit).
4. **V28/V27 BN10.2 Kaltstart und bn4rep ohne Platz: 21,5 W Rahmen.** Gleiche Fehlerklasse wie V05 acht Tage vorher, aber mit BN10-Zahlen.
5. **V35 BN9.1 Einbau-Anlauf, ca. 20 S.** Kampfwerte in BN9 zaehlen 0,45, Einbau setzte sie auf 1, Aufbau ca. 20 h.
6. **V42 Gang/Kaufplaner BN2.1: ca. 8,4 W** (15,7 W Differenz abzueglich 7,3 W Tab-Freeze).
7. **V30 BN10.3 Stillstand 10,5-12,5 S.** Speicherverklemmung nach Aug-Reset (293+94 GB auf 512 GB home); Lehre nur als "nicht gebaut" notiert, SF4.3 entschaerft es.
8. **V32 BN4.2 Chaos-Teufelskreis, 10 S.** Gleiche Klasse wie V17 (Gym-Zweig vor `waehle()`), 14 Tage spaeter in anderem Knoten.
9. **V20 BN10.1 Faktionsarbeit statt Gym, <= 11 S.** Wegen der fehlenden 10 in `k !== 6 && k !== 7` (selbe Wurzel wie V19, 6,6 S).
10. **V41 Tab-Freeze BN2.1, 7,3 W.** Endlosschleife ohne ns-Aufruf; Fix mit Test und Lehre im Code.

Knapp dahinter: V01 (5 W, 20.08.), V16 (3,8 S), V06 (8,3 W Hack-Achse, teils nuetzlich).

## 4. Strategische Entscheidungen

Bewertung "spaeter falsch/verspaetet?" mit Beleg. Datum = Beschluss bzw. Erstnennung.

| Datum | Entscheidung | Damalige Begruendung | Spaeter? | Beleg |
|---|---|---|---|---|
| 19.08. | Bot nur ueber Bruecke/Autopilot, V1-Hacking als Traeger; Start auf Erics BN1.1-Spielstand (5,3 PB, 59 Augs) | Erlaubnis geklaert, Remote API offiziell | Richtig; nur Kaltstart (V01) wurde teuer | Memory bitburner.md; git d7d1d13 |
| 20.08. | Aktienhandel mit 4S gebaut (17:51) und von Eric um 20:06 abgeschaltet | Geld wird erst ab Favor 150 zur Waehrung; Depot band 2,39 Bio (1/3 des Vermoegens) | Kein Verlust in BN1.1 (Geld im Ueberschuss). ABER: Boerse als V2-Hebel nie wieder aufgegriffen; BOERSE-1 (BN2: 100 Mrd nach 6,4 h statt 23,9 h = -17,5 h) bleibt OFFEN; erst in BN8 (10.11.) wieder genutzt | git 305c029, 314f18f; AUDIT-VOLLSTAENDIG BOERSE-1 |
| 21.08. | BN4 zuerst (SF4 traegt die Steuerung) | Singularity noetig fuer Autonomie | Bestaetigt (SF4.2/4.3 teilen RAM durch 4/16, entscheidend fuer Wiederanlauf) | ROUTE.md S.3; Memory roadmap |
| 22.08. | Roadmap ueber 15 BitNodes, "Bladeburner statt Hacking" | Hacking in 7 Knoten angeblich unerreichbar (ROADMAP 4.1) | 23.08. Kritiker: Rechenfehler (EXP nur ueber RAM extrapoliert, Faktor 300-3.000), Premisse faellt; 24.08. Fremd-Audit korrigiert die Korrektur (Sockel 29 Augs, Favor-150-Bootstrap): Hacking traegt, ist aber 3-20x teurer; V2 bleibt wegen Kosten, nicht Unerreichbarkeit. Bis 12 von 12 V2-Laeufen bestaetigt | ROADMAP-KORREKTUR.md; AUDIT-ROADMAP-2026-08-24; AUDIT-ROADMAP-PRUEFUNG A1 |
| 24.08. | ROUTE.md: Beschleuniger zuerst (BN5, BN6, BN10 x3, BN4 L2/L3, BN9 x3, BN1 L2/3, BN5 L2/3, BN12, BN2/3, BN11, BN6, BN7, BN14, BN13, BN15, BN8 zuletzt); Ziel = alle 15 Knoten auf Stufe 3 | SF-Multiplikatoren zahlen sich 45-mal aus | Gefahren wurde exakt diese Reihenfolge. Pruefung 07.10.: "Route bleibt" (Alternative BN6/BN7 vor BN11: netto -10..+11 h). BN10 x3 (ca. 309 W hintereinander) und BN9 x3 (239 W) sind die teuersten Bloecke; Nutzen von SF10 x3 (3 Sleeves) und SF9.2/9.3 nie als Stundengewinn belegt; Sleeve-Beitrag BN10.1 nur 14,4 Rang/h | ROUTE.md; AUDIT-ROADMAP-PRUEFUNG 0 und 3; ERLEDIGT.md Z.2676 |
| 24.-25.08. | BN6 als Pruefstein der Route; Kontrollpunkt "Rang >= 3.500 nach 2 h" | Simulation nie gegen echten Lauf geeicht | 25.08. Rang 29 (Faktor 120 daneben), Messung wegen Stoerungen unbrauchbar (V07); 29.08. nachgeholt: Rate stieg in 19,2 S um Faktor 34 (3.082 -> 82.541/h), Route bestaetigt | ERLEDIGT.md Z.3352 |
| 25.08. | Bladeburner-Gewerk erst NACH Eintritt in BN6 gebaut | Route nannte BN6 = V2, Code fehlte | Verspaetet (V06, ca. 8,3 W Hack-Achse). Gleiche Klasse bei BN8 (V47) | git a8263cc |
| 26.-27.08. | Raid verworfen (Charisma 27), dann rehabilitiert (Trupp, Rundreise), dann Assassination als Hauptfahrzeug; Black-Op-Schwelle 0,99 -> 0,80 -> 0,40 -> 0,90 -> 0,35 -> 0,90/0,35 | wechselnde Rechnungen | Mehrfach selbst widerlegt; Endstand 11.09. bei Skeptiker verankert. Lehre "Raten gegen Wirkung messen" N | ERLEDIGT.md Z.7104, 5953, 5764; BAUSTELLEN ENTSCHIEDEN |
| 28.08. | Kampf-Augs vor Beitritt verworfen; Gym statt Augmentierungsrunde; Einbau erst ab Division | Gym 14,7-18,6 h gegen Augrunde 20,3-23,5 h | Haelt; V19 war die Verletzung dieser Regel | ERLEDIGT.md Z.3431, 3527 |
| 29.08. | Beitritt sofort bei Kampfwert 100 | Mehr Gym kostet Tage bei +46 % Rang | Haelt (Beitritt 29.08. 18:14:36) | BAUSTELLEN ENTSCHIEDEN |
| 30.08. | Grafting (SF10) entdeckt (14:11) und als Hebel fuer BN10.1 gebaut; erstes Graft 21:12, Simulacrum 21:57 | Augs ohne Rep, ohne BitNode-Aufschlag; Weg 27-63 h gegen 246-526 h ohne Graft | Richtig und rechtzeitig (SF10 seit 28.08.). Danach V43: in V2-Knoten ab 04.09. stillgelegt | ERLEDIGT.md Z.992, 1180; git 53d2fbf |
| 30.08. | Einbau 23:02 vor dem Graftpaket | bn4rep-Regel | 28,4 Bio Bargeld verworfen, aber Rangrate +61..+78 % | ERLEDIGT.md Z.865, 227 |
| 31.08. | Dauerloops (6 Cron-Jobs) und ntfy abgeschafft, /bb-Besuch alle paar Tage | Kosten, Kontext, Cron stirbt mit Sitzung | Folge: V26, V27/V28, V30, V41 wurden erst beim naechsten Besuch (bis 13,5 h, 26 h, 10,5 h, 7,3 h) entdeckt. Gegenmittel (Waechter-Leiter, kpi.json) gebaut, V30 aber nur als N | git 1afed1c; BAUSTELLEN Z.714 |
| 02.09. | Audit "volle Autonomie": ausgang.js, route.json, Bot-Neubau BAU-2026-09 | "Bot ist in keinem Uebergang autonom" | Umbau lief 03.-04.09. am laufenden Knoten, ohne Stillstand ausser 0,5 h; Sprung ab BN9 selbst | AUDIT-AUTONOMIE; V29 |
| 04.09. | Grafting-Zuender zurueckhalten (`graftplan.json` in `nicht-schieben.txt`) | "450 Mrd beim Start weg", knappe Geldlage | Spaeter als FEHLER eingestuft (gating-bericht A.1: Graft kostet 3x Basis, ohne Ruf/BitNode-Aufschlag, 450-Mrd-Sorge nur bei Geldknappheit); gezuendet 07.11. | gating-bericht.md A.1 |
| 03.10. | Vollstaendigkeits-Audit (1.531 Features, 125 Befunde); Erics Freigaben Gang, Graft, Infiltration, Corp | Quellcode bekannt, "nutze das" | Gebaut: Gang, Corp (BN3), Kaufplaner, IPvGO; NICHT gebaut: Graft (bis 07.11.), Infiltration (NETZ-1: ca. x73-80 Vertragsruf geschaetzt), Casino (PLAYER-1), Boerse in V2 (BOERSE-1), Int-Exp (SING-1), Hash->Contracts (HASH-7); Audit am 04.10. auf Wunsch abgebrochen (Gegenpruefung 14 von 125) | AUDIT-VOLLSTAENDIG Abschn. 1-3 |
| 04.10. | Gang in BN2 (gang.js) | GANG-1 10-25 h je BN2-Lauf geschaetzt | BN2.1 29,7 -> 2.2 20,6 -> 2.3 14,0 W: Richtung belegt, Anteil durch V41 (7,3 W) und Kaufplaner vermischt; GANG-3 (Gang nach SF2 in BN15/11) offen | V42 |
| 06.10. | Corp in BN3 (Seed-Auszahlung 104 Mrd, Runden 1-4) | Mit Geld Rang kaufen | BN3.2 mit Corp 22,7 W, BN3.1 ohne 21,7 W - kein messbarer Nutzen; Corp ausserhalb BN3 am 07.10. gerechnet und verworfen (Faktor ca. 1.000 fehlt) | AUDIT-ROADMAP-PRUEFUNG 0.3 |
| 07.10. | Roadmap-Pruefung: Route bleibt; vier Bauauftraege (Simulacrum-Parallel, IPvGO, Labyrinth, Hash-Rang) | Pruefung der Annahmen A1-A11 | Simulacrum, Go, Hash-Rang gebaut; Labyrinth (V1b BN15) am 07.10. und 02.11. verworfen (Vorteil nicht belegt, 1-5 h je Lauf) | git 1b98841, b87b40b; DARKNET-NEBENGEWERK |
| 27.10. | Stanek (BN13) nicht bauen; go.cheat bauen | Stanek <= 2 % Rangzeit | go.cheat eingebaut (d63734d) | git 88866b7, d63734d |
| 07.11. | Audit "ungenutzte Mechaniken": Go in BN15, Graft gezuendet | go.js fehlte in BN15.1 komplett | BN15.2 41,8 W, BN15.3 34,0 W gegen 100,7 W (V43). 7.11. zeigt: "vor Knoten X bauen" muss VOR dem Knoten gebaut werden | SYNTHESE 07.11. |
| 10.11. | BN8-Block (Boerse-Handelsregel, 4S nach Vermoegen, Abruf, Depot vor Einbau, Tian Di Hui) im laufenden BN8.1 | Eric: "optimiere was das Zeug haelt" | Plan 30,5 h; BN8.1 online 30,3 h trifft ihn. Offen: Darknet promoteStock (-8..-12 h je Stufe), Grafting fuer 30 Daedalus-Augs (-15..-40 h), Go-Gegner; Einbau-Takt nicht durchgerechnet | BN8-ROUTE.md; SYNTHESE |
| 12.11. | BN12 nicht weiterleveln, Exploits nicht | Eric | - | Memory endspurt-bn8 |

## 5. Muster (wiederkehrende Fehlerarten, Anzahl der Vorfaelle in Abschnitt 1)

1. **Stille Sperre / Verklemmung ohne Alarm** (Datei, Tor, Riegel, Speicher): V11, V28, V30, V36, V37, V39, V48, V06 = **8**. Lehre im Code teils (Wachter-Strafleiter), V30 nur als "nicht gebaut" in BAUSTELLEN.
2. **Kaltstart/Knotenwechsel nicht im Zielzustand getestet**: V01, V04, V05, V18, V27, V30, V31 = **7**. Ausdruecklich als "nie im Nach-Reset-Zustand getestet" im Commit d7d1d13 (20.08.) benannt, dann gleiche Klasse am 23.08., 24.08., 01.09., 07.09., 10.09.: die Lehre war im Bericht, nicht im Test, bis 04.09. (Kaltstart-Budgettest, 204a941).
3. **Knotenliste/Konstante aus anderem Knoten** (`k !== 6 && k !== 7` an 7 Stellen, BN6-Preise im BN10-Kommentar, `exit-ziel` 5 im Knoten 5, HOME_KALTSTART 64 bei SF9, graftauto V2-Registry ohne BN15): V19, V20, V27, V45, V43 + Beinahe 24.08. = **6**. Gegenmittel `BLADE_KNOTEN` (4ddfd7b) erst nach der dritten Stelle.
4. **Funktion gebaut, aber nicht angeschlossen/gestartet** (nie in Startliste, Riegel nie neu gestartet, WERKZEUG-Kanal killt ohne Neustart, `features` nirgends geliefert): V14, V21, V24, V34, V45, V43 (graftauto), Registry `hacktimer` 25.08. = **7**.
5. **Zeitbasis/Uhr falsch**: Echtzeit statt Spielzeit (Festhalten 30.08., "25-fach"), Stillstandsuhr 649 min nach Einbau, Waechter misst Datei des ueberwachten Vorgangs, tor.js mit 48 h alten Daten, ETA linear (430 Tage, zweimal), Kalender-ETA zu optimistisch = **6** (Belege: git bb36acf 30.08. 12:46, 64df553, 89e67e8, 841e4ce).
6. **Bestand/Messartefakt statt Rate**: 254 Rang/h = Lagerabbau, 6-min-Fenster 40 Rang/h, `s.min` Rauschen, 7 Mrd kein Leck, Kammeranteil Zyklusgeometrie, Spannen-Rauschen = **6** (Eintraege 26.-30.08.). Eigene Fehlalarme (bn4rep "tot", Autosave, Sync-Befund, Divergenz, Rechenfehler Charisma/Chaos) = **8** weitere.
7. **Endlosschleife/Ausnahme ohne Grenze**: TDZ EXIT_KEY (23.08.), bn4rep ReferenceError (30.08.), `maennerNoetig` (V41) = **3**.
8. **Entscheidung nie neu bewertet / zurueckgestellt bis "vor dem Knoten"**: graftplan (V43), go.js BN15 (V45), BN8-Block (V47), Boerse V2 (BOERSE-1), Gang (V42) = **5**. 07.11. und 10.11.: gleiche Klasse, zweimal.
9. **Befund nur in Notiz statt im Code**: V30 ("ENTSCHIEDEN nicht gebaut"), V33 (Bruecke, nur WMI-Notiz), ETA-Lehre (04.09.), V35 (Install-Regel BN9 offen), Memory "Befund = sofort bauen" 10.11. = **5**.
10. **Gleiche Klasse, aber nie auf Klassenebene geschlossen**: Chaos-Teufelskreis (28.08. V17, 11.09. V32), Kaltstart (V05, V27, V31), Einbau vor Beitritt (V19, V20, V16).

## 6. Unsicherheiten

**U1 - Gilt "Offline = kein Fortschritt" in V1 und "Offline = voll gutgeschrieben" in V2?** Nur aus Mustern geschlossen (M2). Gegenprobe waere ein Test: Spielstand vor/nach einer Luecke vergleichen (Rang bzw. Hackingexp). Wenn die Bladeburner-Gutschrift gedeckelt ist, kosten die 488 W V2-Luecken doch Fortschritt; dann waere V50 gross (bis 100 S).
**U2 - Index ab 03.09.** Die ersten ca. 364 W (BN1.1, BN4.1, BN5.1, BN6.1, BN10.1 und der Anfang von BN10.2) haben keine Luecken-Messung. Laufzeiten dort aus Commits/Quellen geschaetzt (Ungenauigkeit +-3 h je Knoten).
**U3 - "hourly"-Sicherung = Bruecke verbunden.** Eine Luecke heisst "Bruecke ohne Sicherung" und nicht zwingend "PC aus". Beim 07.09. lief das Spiel in Spielzeit (10,5 h reine Spielzeit) bei toter Bruecke; ob das auch nachts gilt, ist ungeklaert. V49 ist deshalb eine Obergrenze fuer V1-Betriebsverlust.
**U4 - Rahmenwerte enthalten SF-Gewinne.** BN6.1 gegen BN6.2 (<= 56 W) enthaelt SF6.1, SF4.3, SF10.3 (Sleeves), Graft und alle Lernfortschritte; ebenso BN15.1 gegen 15.2/15.3. Sie sind Obergrenzen fuer "falsch gemacht", keine Verlustzahlen.
**U5 - BN7-Abweichung (+100-140 W gegen Erwartung)** ist ungeklaert: weder BAUSTELLEN noch ERLEDIGT enthalten einen BN7-spezifischen Befund mit Stundenzahl. Ob die Erwartung (22-34 W, Modell ohne Eichung, Band x2) falsch war oder der Bot dort etwas verliert, ist offen. Groesster einzelner unaufgeklaerter Block (205 W).
**U6 - BN3.3 (46,2 W gegen 21,6/23,1) und BN13.2 (60,6 W gegen 48,7/30,0)**: Luecken (18,0 bzw. 24,5 h) erklaeren teils, Rest unbelegt.
**U7 - Nicht oder nur teilweise gelesen:** `nodes/HEBEL.md` (146 KB, nur per Grep), `nodes/KURS.md` (44 KB), `nodes/AUFTRAG-BAU-2026-09.md` (133 KB), `nodes/AUDIT-BOT-2026-08-24.md`, `AUDIT-ROADMAP-2026-08-24.md`, `AUDIT-BAUSTELLEN-2026-09-06.md` (44 KB, nur Titel), die Berichte in `audit-2026-10-03/`, `audit-2026-09-26/` ausser den Statusdokumenten. BAUSTELLEN.md nur Ueberschriften plus ausgewaehlte Abschnitte (Z.399-441, 714-760, 871-900, 1007-1050, 1085-1123). Es gibt wahrscheinlich weitere Einzelvorfaelle mit Stundenangabe in HEBEL.md und AUFTRAG-BAU.
**U8 - Zahlen einzelner Quellen:** V13 "Rangrate Faktor 500" ist der Quotient zweier Messwerte (0,15/min und 78/min) verschiedener Tage, nicht eine Messreihe. V35 "20 h" ist ein Satz der Quelle ohne Rechenweg. V34 (11 h) ist eine Obergrenzenrechnung aus zwei Quellzahlen (10 h Anlauf, Faktor 2,2).
**U9 - Zeitzonen:** Quellen Ortszeit, INDEX UTC; wo Zeitpunkte verglichen wurden (V41, V48), ist umgerechnet.
**U10 - Keine Eichung dieser Auswertung an einem unabhaengigen Wert.** Die Summen der Spielzeit je Knoten stimmen mit `totalPlaytime` (d(Playtime) = d(Wanduhr) in jedem Lauf, Abweichung < 1 %) - das bestaetigt nur, dass Offline-Zeit mitgezaehlt wird, nicht, dass sie produktiv war.
