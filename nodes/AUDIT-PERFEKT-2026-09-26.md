# Audit "perfekter Bot" - 26.09.2026

Auftrag Eric: pruefen, ob der Bot alle Spielmechaniken und BitNode-Vorgaben
einhaelt und in jeder Lage optimal entscheidet. Sechs Opus-Pruefer, je ein
Winkel, Berichte in `nodes/audit-2026-09-26/` (1 BitNode-Regeln, 2 Hacking,
3 Fortschritt, 4 Bladeburner, 5 Nebensysteme, 6 Orchestrierung).

Status: OFFEN / IN ARBEIT / ERLEDIGT (Commit) / VERWORFEN (Grund).
Reihenfolge = Wirkung auf die naechsten Knoten (BN5.3, BN12.1-3 sind V1).

## Paket A - bn4rep (Fortschritt, V1 sofort wirksam)

- [x] A1 (ERLEDIGT caa4091, 988e16f: 30-s-Karenz, nur eingebautes NMI zaehlt; Fokusanteil im Spiel nachmessen) Fokus geht verloren (darkweb.js-Klick, Navigation), nie zurueckgeholt: Ruf x0,8 in 50-90 % der Arbeitszeit (Berichte 3#1, 6#1, doppelt belegt)
- [x] A2 (ERLEDIGT da1a8ce, 988e16f) BN12: Spendenformel ohne FactionWorkRepGain (1/1,02^Stufe) - NFG-Zukauf scheitert in 12.2/12.3 (3#7)
- [x] A3 (ERLEDIGT da1a8ce, 988e16f) Daedalus-Schwelle fest 30, BN12 verlangt 31; gezaehlt mit wartenden NFG-Stufen statt installierten Augs (1#3, 3#7)
- [x] A4 (ERLEDIGT 6a75289, 988e16f: teilweise: Arbeitsziel nicht auf den NFG-Repbedarf umgestellt (Skeptiker A #10)) Spendenrechts-Einbau wartet auf ein Nicht-NFG-Stueck: 37 min in BN5.2, jeder Knoten (3#2)
- [x] A5 (ERLEDIGT 6a75289, 988e16f: Schwelle max(4x Konto, Konto + 600 s x getTotalScriptIncome()[1])) Vorzeitiger Einbau, weil die eigenen Spenden das Konto leeren ("naechstes unbezahlbar"): 10-20 min je Red-Pill-Phase (3#3)
- [x] A6 (ERLEDIGT 6a75289, 988e16f, 685ad40, 1769cc1: Handschlag vor den NFG-Kaeufen, Warten am Tor mit state wait) Red Pill in der Warteschlange erzwingt keinen Einbau - Stillstandsrisiko (3#4)
- [x] A7 (ERLEDIGT 6a75289, 988e16f) favorLohnt ohne Relevanz (Faktion mit leerem Katalog / schon spendenberechtigt) (3#5)
- [ ] A8 (OFFEN: nicht Teil von Paket A (A1-A7); die Kaufreihenfolge je Runde braucht einen eigenen Umbau der Kaufschleife) "teuerste zuerst" nur je 15-s-Runde, NFG hinter Fuellstuecken: x1,47 Kosten (3#8)
- [ ] A9 (OFFEN: nicht Teil von Paket A; Passivrate fuer nicht bearbeitete Faktionen ungebaut) gemessene Passivrate ersetzt Arbeitsformel fuer nicht bearbeitete Faktionen (3#9)

## Paket B - bn4net (Hacking-Maschine)

- [x] B1 (ERLEDIGT 51ad022, 4500041, 4f44576: mit Vorbereitungskosten und Hysterese (lib/calc.js)) Server mit Startsicherheit 100 (BN5: 46 von 63 Geldservern, 99,8 % moneyMax) fuer die Zielwahl unsichtbar: kennzahlen skaliert 0 hoch (2#2)
- [x] B2 (ERLEDIGT c143bd2, 4500041, 5bc7934, b97595e: Ofen mit Frist, der Kern raeumt ihn fuer Werkzeuge; exp/s im Spiel nachmessen) Erfahrungsofen nur Einwegwelle je Runde, 43-57 TB brach; Dauer-grow auf foodnstuff x11,5 exp/s (2#1)
- [x] B3 (ERLEDIGT 62bf7c0, 4500041: nur ohne lebendes bn4life, 2 min Schonfrist) bn4net startet darkweb.js alle 5 min, obwohl bn4life per Singularity kauft (6#1, Ursache von A1)
- [ ] B4 (OFFEN: nicht Teil von Paket B; Park-/home-Ausbau nach Erfahrung braucht ein Wertmodell) Parkausbau/home-Ausbau bewerten nur Geld, nie Erfahrung (2#3, 1#5)
- [ ] B5 (OFFEN: nicht Teil von Paket B; Stapelziele weiter nach Mischguete) Stapelziele nach Mischguete statt Stapeldurchsatz (2#4)
- [x] B6 (ERLEDIGT b320024, 82910e5, 4500041: inkl. BN12 Stufe 2/3 zur Laufzeit) lib/bitnodes.json verliert BN12-inc/dec und negative Werte (2#6, 1#4)
- [x] B7 (ERLEDIGT 4500041, 4f44576: gerechnet: nach Knotenwechsel erstes Geld nach 300-420 s statt 6.150 s (Skeptiker B G-8); Live-Beleg offen) Nullfenster 11-25 min nach Reset (6#2)

## Paket C - Kleines, schlummernde Fallen

- [x] C1 (ERLEDIGT 6201916) graftauto ohne V1-Tor (registry "alle"); 11-57 h ohne Faktionsarbeit, sobald der Zuender faellt (1#1, 5#5)
- [x] C2 (ERLEDIGT b2e98fa, 963b6a7, 8ad4d74, 27574e0, 189a165, 6fa8b61, bcd8c0a: PRIO.beitritt 25, Daedalus-Tor in joinrun, Lint, Lease-Erneuerung, Start erst ab 5 Mio) joinrun: gymWorkout an der Figur-Vergabe vorbei, laeuft auch mit 30+ Augs (3#6, 6#4); Lint uebersieht `s.gymWorkout`
- [x] C3 (ERLEDIGT f1572b8, 71ae7c9) hacknet.js kauft in V1 nach jedem Einbau einen wertlosen Server (5#6)
- [x] C4 (ERLEDIGT e0956e1, 988e16f, 3c076ad: Sperre per nachHome, bn4rep laeuft weiter statt return) Handschlag-Fehlschlag beendet bn4rep (return in main) (6#5)
- [ ] C5 (OFFEN: b16e381 per 11eb9a6 zurueckgenommen: Kern und Waechter brauchen EINE gemeinsame Kaltstart-Definition (Park/Geld/Netz statt home-RAM)) HOME_KALTSTART_GB 64 passt nicht zu SF9>=2 (128 GB) (6#7)
- [ ] C6 (OFFEN: erst vor BN8) BN8 ungeschuetzt (ScriptHackMoneyGain 0 nicht gelesen, Kaltstartleiter) (1#2) - erst vor BN8

## Paket D - Bladeburner (vor BN2)

- [ ] D1 (OFFEN: Paket D nicht begonnen, vor BN2) Recruitment 35-40 % der Spielerzeit ohne Wirkung auf die Black-Op-Chance (4#1)
- [ ] D2 (OFFEN: Paket D nicht begonnen, vor BN2) Erfolgsspanne exakt entschluesselbar statt s.min (4#2)
- [ ] D3 (OFFEN: Paket D nicht begonnen, vor BN2) relNutzen additiv statt multiplikativ, Evasive/Reaper unterbewertet (4#3)
- [ ] D4 (OFFEN: Paket D nicht begonnen, vor BN2) feste Schwelle 0,85 fuer Operationen statt Rang/min (4#4)
- [ ] D5 (OFFEN: Paket D nicht begonnen, vor BN2) Sleeves: infiltrieren statt Vertraege in der Op-Phase (4#5)
- [ ] D6 (OFFEN: Paket D nicht begonnen, vor BN2) kampfaugs.js Knotenfaktor hart (4#7)

## Nachrangig / erst messen

- [ ] E1 (OFFEN: erst messen) Hashes in V1 -> "Increase Maximum Money" statt Verkauf (5#1)
- [ ] E2 (OFFEN: erst messen; Integrationspruefung: share und Ofen kollidieren NICHT (share zuerst, 12,00 % in allen Staenden)) share-Deckel 12 % fest (5#2) - kollidiert mit B2 (RAM fuer Erfahrung)
- [ ] E3 (OFFEN: erst messen, Trockenmodus zuerst) Boerse in V1 ungenutzt (5#4) - Trockenmodus zuerst
- [ ] E4 (OFFEN: erst messen) Figur-Vermerke fluten events.json/bn4net-log (6#3)
- [ ] E5 (OFFEN: erst messen) boot.js loescht bei jedem Seitenneuladen Sperren (6#6)
- [ ] E6 (OFFEN: keepalive.js startet nicht automatisch (nur install.js/restart.js); Aufraeumen offen) keepalive.js scharfe Leiche (6#8)
- [ ] E7 (OFFEN: erst messen) Restgeld verfaellt beim Einbau (3#11)
- [ ] E8 (OFFEN: erst messen) levelNutzen bis Red Pill: Ruf ist der Engpass (3#10)

VERWORFEN: Sleeves in V1 umbelegen (5#3, 3: unter 0,4 % Wirkung).

## PAUSE 26.09.2026 abends (Wochenkontingent 93 %) - hier morgen weitermachen

Nichts davon ist im Spiel; der Live-Bot laeuft unveraendert auf master.
Die Branches liegen lokal und auf origin:

- `worktree-agent-a835831a3142b1944` Paket A (A1-A7, 3 Commits, Test tools/test-bn4rep-einbau.js 34 gruen). Skeptiker lief an, abgebrochen, NEU STARTEN. Schwerpunkte: setFocus alle 15 s gegen DOM-Skripte (popups, punish, backdoor, shop, travel ...); A5-Horizont darf frueh im Knoten keinen Stillstand erzeugen; A6 Red-Pill-Zwangseinbau. Dazu nachtragen: bn4rep.js ~1396 `return` in main bei Handschlag-Fehlschlag -> weiterlaufen statt Prozessende (Begleiter zu C4).
- `worktree-agent-a693114a22f784410` Paket B (B1, B2, B3, B6). Skeptiker abgebrochen, NEU STARTEN. Eigener Verdacht B2: expfarm wird jede ~10-s-Runde getoetet und neu gestartet; ist grow-Zeit > Rundenlaenge (direkt nach Einbau), liefert der Ofen NULL Erfahrung - mit echten Spielstandzahlen rechnen. B1: Vorbereitungskosten (weaken 100->min) in der Zielwahl? Nullfenster nach Einbau?
- `worktree-agent-a39c89a13692a6bc8` Paket C. Skeptiker FERTIG: C1, C3, C4 halten. C2 BLOCKER (PRIO.gym 40 verliert immer gegen faktion 30 -> neue Stufe PRIO.beitritt 25; Daedalus-Tor nach joinrun.js statt bn4life +9 GB; Verhaltenstests 29/30/31/BN12/wirft). C5 zurueckstellen (Kern bn4net und Waechter muessen dieselbe Kaltstart-Funktion nutzen). test-ram: geaenderte Dateien in VERALTET_ERLAUBT mit Datum. Nacharbeit lief an und ist UNCOMMITTET im Worktree (bn4life.js, joinrun.js, lib/figur.js, tools/test-figur.js) - pruefen, fertigstellen, committen.

Danach: mergen, `tools/einspielen.js --pruefen`, `tools/neustart.js` mit PID-Beleg, im Spiel nachmessen (Fokus-Anteil, Zielwahl BN5, exp/s), Statusliste abhaken.

## NEU 26.09. 20:40 - SOFORT (vor Ende BN5.3 beheben)

- [x] F1 (d4439a7) bn4door.js hat `w0r1d_d43m0n` in ZIELE (bn4door.js:63-64). installBackdoor auf w0r1d_d43m0n schickt das Spiel auf die BitVerse-Auswahl (Singularity.ts:525-526) statt ueber destroyW0r1dD43m0n mit Zielknoten zu springen. BN5.2 endete so gegen 19:22: Hacking 4504, Red Pill drin, alle Skripte aus, keine pre-jump-Sicherung, ausgang.txt ohne Sprungzeile - das Spiel stand auf der Auswahl, bis Eric von Hand BN5 waehlte. In BN1.2/1.3 gewann exit.js das Rennen (60-s-Takt). Fix: w0r1d_d43m0n aus ZIELE nehmen (Skeptiker Pflicht, laeuft unbeaufsichtigt).

## Stand 27.09.2026 (Integrationszweig `claude/new-session-zf9ris`)

Statusliste oben abgehakt: 16 ERLEDIGT (A1-A7, B1-B3, B6, B7, C1-C4), 20 OFFEN
(A8, A9, B4, B5, C5, C6, D1-D6, E1-E8), VERWORFEN unveraendert 1 (Sleeves).
Alle Hashes stehen in `git log 5e4c51c..claude/new-session-zf9ris`. Im Spiel ist
davon noch nichts; Einspielplan: `nodes/EINSPIELEN-2026-09-27.md`. Berichte:
`nodes/audit-2026-09-26/skeptiker-A.md`, `skeptiker-B.md`, `skeptiker-integration.md`.

## Bewusst nicht umgesetzt (Stand 27.09.)

22 Punkte. Je einer mit Grund, damit keiner als vergessen gilt.

Paket A (bn4rep, Skeptiker A):
- A#8 Rest: eine UI-Klickfolge ueber 30 s wird vom Fokus-Zurueckholen weiter unterbrochen - eine isRunning-Abfrage je UI-Skript kostete RAM und kennt die Handwerkzeuge auf anderen Wirten nicht.
- A#10 teilweise: das Arbeitsziel wird nicht auf den NFG-Repbedarf umgestellt - Eingriff in die Zielwahl (offen/guete), kein lokaler Fix.
- A#12: kein Graft-Tor in bn4rep und kein A6-Aufschub bis "verdientes Stueck binnen 2 min bezahlbar" - C1 haelt graftauto aus V1 heraus, der Aufschub kostet laut Audit Minuten fuer wertlose Stuecke.
- A#5/G5: die offenSeit-Klausel des Interlocks bleibt tot - ob nach 6 h bei offenem Ausgang eingebaut wird, entscheidet ausgang/endspurt, nicht Paket A.
- G3: das Zyklusmittel S/t reagiert traege auf einen vollen Einkommenseinbruch - ein juengerer Schaetzer braeuchte wieder eine Aufwaermphase (Einwand 1); die Richtung ist die sichere.
- G4: Zone ohne Ruecklage zwischen augRuecklage und Horizontregel, BN8 - die Ruecklage ist ein Vertrag mit sechs Lesern (lib/endspurt.js), eigene Entscheidung.
- G6: geldbedarf.txt wird am Einbau-Tor nicht erneuert - gehoert zur Endspurt-Regel, auf master identisch.
- G8: Firmenphase ohne Telemetrie (S1-Risiko nach 30 min) - gehoert zur Firmenphase, Muster amTorWarten liegt bereit.

Paket B (bn4net, Skeptiker B):
- B#9 (M-6): Portprogramme bleiben hinter der Augmentierungs-Reservierung in bn4life - Abwaegung Einbauzeitpunkt gegen Einkommensrampe, braucht eine Messung.
- G-6: RAM-Basis der Vorbereitung (0,3 x ramTotal) zu gross geschaetzt - der bessere Ansatz kostete in 3 von 6 Laeufen 13-26 % Geld, Abwaegung fuer eine Messung.
- G-7: Stillstandssperre im Kreis am dritten Stapelplatz nach Knotenwechsel - vorbestehende Stapelmechanik (BATCH_ZIELE fest 3), nicht Paket B.
- G-8: S-2 bei hohem Level nicht messbar - kein Fix noetig, nur Messhinweis (Nutzen liegt nach dem Knotenwechsel).
- G-9: test-b6 zaehlt Telemetrie als Verhalten - Testschoenheit, keine Laufzeitfolge.
- G-10: BN12 ab Stufe 4 liest Stufe 3, weakenThreads ohne ServerWeakenRate/Kerne - Route endet bei 12.3, Faeden vorsichtig (der tools/ram.js-Punkt ist durch 960dd1c erledigt).
- Offen fuer die Messung: echte Streuung von mischung.rundenTaktMs im Spiel.

Paket C:
- C5: Kaltstartschwelle (64 GB) per 11eb9a6 zurueckgenommen - Kern und Waechter brauchen eine gemeinsame Definition nach Park/Geld/Netz.
- C6: BN8-Schutz (ScriptHackMoneyGain 0, Kaltstartleiter) - erst vor BN8.
- test-ram-Eichung: geaenderte Dateien stehen in VERALTET_ERLAUBT - Live-Nachmessung nach dem Einspielen (startdiag.js + tools/eichung-messen.js).
- Paket D (D1-D6) nicht begonnen - erst vor BN2.

Integration (skeptiker-integration.md):
- I#6: joinrun zahlt 4 GB fuer getBitNodeMultipliers statt lib/bitnodes.json - aendert an keiner gerechneten Startlage etwas, Live-Wert war eine bewusste Entscheidung (A3).
- I#7: test-ram rot (76 statt >= 100 Eichzeilen) - nur mit calculateRam im Spiel heilbar.
- I#2 Rest: ab 5 Mio belegen joinrun+netburn weiter 58,2 GB auf home und koennen shop.js auf einem 128-GB-home bis zu 45 min verdraengen - Entwurfsfrage (anderer Wirt, netburn nur in BN9).

## Nachmessung nach dem Einspielen (27.09. 11:15, Stand 55759f3 im Spiel)

- ok: Fokus wird zurueckgeholt, darkweb.js startet nicht, Netz-RAM kaum brach, Fortschritt gleichauf mit BN5.2 (Hoechststand 464 nach 5,7 h vs 5,6 h). Kein Einbau seit 07:47 - BN5.2 hatte in dieser Phase ebenfalls 2-3-h-Zyklen, also kein Rueckschritt belegt.
- OFFEN G1: joinrun lief in EINEM Einbauzyklus zweimal (08:19 und 09:44) - vermutlich hat der bn4life-Neustart beim Einspielen die Beitrittsmarke nicht gesehen. Zweiter Lauf trainierte Staerke bis 209 bei Ziel 80 (Ueberschiessen?).
- OFFEN G2: 10:08-10:15 lehnte das Spiel gymWorkout alle 15 s ab, waehrend bn4rep die Figur hielt (joinrun wartet nicht still, sondern haemmert).
- OFFEN G3: Erwartete exp-Steigerung (Plan: x14 bei ausgebautem Netz) noch nicht sichtbar - in dieser Phase ist das Netz klein (ueberschussGb 0). Bei naechstem /bb mit Level-Kurve gegen BN5.2 vergleichen.
- ERLEDIGT c0aeb3d: RAM live gemessen (44 Dateien, 0 abgelehnt), test-ram gruen mit 121 Zeilen. Kanarienvogel-Pruefung wurde uebersprungen (bewusst: Einspielung lief gestuft mit Einbausperre und Rueckweg).

## Runde 27.09. ab 12:25 (Kontingentrest vor dem Wochenreset)

Laufen als Branches (je Worktree, danach Opus-Skeptiker):
- D-a blade.js: D2 exakte Erfolgschance, D1 kein Spieler-Rekrutieren / Trupp 0, D4 Rang/min statt 0,85
- D-b blade.js-Skills (D3 multiplikativ + Dauer), sleeve.js D5 (nur mit Rechnung), kampfaugs.js D6
- B4 Ausbau nach Erfahrungswert (nur mit Rechnung) + C5 gemeinsame Kaltstart-Definition
- B5 Stapelziele nach Durchsatz, B7 Nullfenster pruefen, E2 share nach Wert (nur mit Rechnung)
- G joinrun: G1 einmal je Zyklus, G2 kein Haemmern / Ursache "abgelehnt", Ueberschiessen, Wertrechnung
- E1 Hashes in V1: Urteil mit Zahlen, Bau nur bei klarem Gewinn
- BN12-Einstiegspruefung (Opus, nur lesen)
