# Audit "perfekter Bot" - 26.09.2026

Auftrag Eric: pruefen, ob der Bot alle Spielmechaniken und BitNode-Vorgaben
einhaelt und in jeder Lage optimal entscheidet. Sechs Opus-Pruefer, je ein
Winkel, Berichte in `nodes/audit-2026-09-26/` (1 BitNode-Regeln, 2 Hacking,
3 Fortschritt, 4 Bladeburner, 5 Nebensysteme, 6 Orchestrierung).

Status: OFFEN / IN ARBEIT / ERLEDIGT (Commit) / VERWORFEN (Grund).
Reihenfolge = Wirkung auf die naechsten Knoten (BN5.3, BN12.1-3 sind V1).

## Paket A - bn4rep (Fortschritt, V1 sofort wirksam)

- [ ] A1 Fokus geht verloren (darkweb.js-Klick, Navigation), nie zurueckgeholt: Ruf x0,8 in 50-90 % der Arbeitszeit (Berichte 3#1, 6#1, doppelt belegt)
- [ ] A2 BN12: Spendenformel ohne FactionWorkRepGain (1/1,02^Stufe) - NFG-Zukauf scheitert in 12.2/12.3 (3#7)
- [ ] A3 Daedalus-Schwelle fest 30, BN12 verlangt 31; gezaehlt mit wartenden NFG-Stufen statt installierten Augs (1#3, 3#7)
- [ ] A4 Spendenrechts-Einbau wartet auf ein Nicht-NFG-Stueck: 37 min in BN5.2, jeder Knoten (3#2)
- [ ] A5 Vorzeitiger Einbau, weil die eigenen Spenden das Konto leeren ("naechstes unbezahlbar"): 10-20 min je Red-Pill-Phase (3#3)
- [ ] A6 Red Pill in der Warteschlange erzwingt keinen Einbau - Stillstandsrisiko (3#4)
- [ ] A7 favorLohnt ohne Relevanz (Faktion mit leerem Katalog / schon spendenberechtigt) (3#5)
- [ ] A8 "teuerste zuerst" nur je 15-s-Runde, NFG hinter Fuellstuecken: x1,47 Kosten (3#8)
- [ ] A9 gemessene Passivrate ersetzt Arbeitsformel fuer nicht bearbeitete Faktionen (3#9)

## Paket B - bn4net (Hacking-Maschine)

- [ ] B1 Server mit Startsicherheit 100 (BN5: 46 von 63 Geldservern, 99,8 % moneyMax) fuer die Zielwahl unsichtbar: kennzahlen skaliert 0 hoch (2#2)
- [ ] B2 Erfahrungsofen nur Einwegwelle je Runde, 43-57 TB brach; Dauer-grow auf foodnstuff x11,5 exp/s (2#1)
- [ ] B3 bn4net startet darkweb.js alle 5 min, obwohl bn4life per Singularity kauft (6#1, Ursache von A1)
- [ ] B4 Parkausbau/home-Ausbau bewerten nur Geld, nie Erfahrung (2#3, 1#5)
- [ ] B5 Stapelziele nach Mischguete statt Stapeldurchsatz (2#4)
- [ ] B6 lib/bitnodes.json verliert BN12-inc/dec und negative Werte (2#6, 1#4)
- [ ] B7 Nullfenster 11-25 min nach Reset (6#2)

## Paket C - Kleines, schlummernde Fallen

- [ ] C1 graftauto ohne V1-Tor (registry "alle"); 11-57 h ohne Faktionsarbeit, sobald der Zuender faellt (1#1, 5#5)
- [ ] C2 joinrun: gymWorkout an der Figur-Vergabe vorbei, laeuft auch mit 30+ Augs (3#6, 6#4); Lint uebersieht `s.gymWorkout`
- [ ] C3 hacknet.js kauft in V1 nach jedem Einbau einen wertlosen Server (5#6)
- [ ] C4 Handschlag-Fehlschlag beendet bn4rep (return in main) (6#5)
- [ ] C5 HOME_KALTSTART_GB 64 passt nicht zu SF9>=2 (128 GB) (6#7)
- [ ] C6 BN8 ungeschuetzt (ScriptHackMoneyGain 0 nicht gelesen, Kaltstartleiter) (1#2) - erst vor BN8

## Paket D - Bladeburner (vor BN2)

- [ ] D1 Recruitment 35-40 % der Spielerzeit ohne Wirkung auf die Black-Op-Chance (4#1)
- [ ] D2 Erfolgsspanne exakt entschluesselbar statt s.min (4#2)
- [ ] D3 relNutzen additiv statt multiplikativ, Evasive/Reaper unterbewertet (4#3)
- [ ] D4 feste Schwelle 0,85 fuer Operationen statt Rang/min (4#4)
- [ ] D5 Sleeves: infiltrieren statt Vertraege in der Op-Phase (4#5)
- [ ] D6 kampfaugs.js Knotenfaktor hart (4#7)

## Nachrangig / erst messen

- [ ] E1 Hashes in V1 -> "Increase Maximum Money" statt Verkauf (5#1)
- [ ] E2 share-Deckel 12 % fest (5#2) - kollidiert mit B2 (RAM fuer Erfahrung)
- [ ] E3 Boerse in V1 ungenutzt (5#4) - Trockenmodus zuerst
- [ ] E4 Figur-Vermerke fluten events.json/bn4net-log (6#3)
- [ ] E5 boot.js loescht bei jedem Seitenneuladen Sperren (6#6)
- [ ] E6 keepalive.js scharfe Leiche (6#8)
- [ ] E7 Restgeld verfaellt beim Einbau (3#11)
- [ ] E8 levelNutzen bis Red Pill: Ruf ist der Engpass (3#10)

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
