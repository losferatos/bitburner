ultracode: Baue aus dem bestehenden Bitburner-Bot unter `C:\Users\erche\Desktop\claude_projecto\bitburner` den maximal autonomen und maximal effizienten Bot, der alle 40 verbleibenden Einträge aus `src/route.json` ohne menschlichen Eingriff abfährt - mit Werkzeug-Registry, Strafleiter bis zum Soft-Reset, Prüfstand auf einer lokalen Spielinstanz mit zweiter Brücke, und einem Schutzprotokoll, das den Live-Spielstand unter keinen Umständen anfasst.

# 0. Auftrag und Schlüsselwort

Du arbeitest für Eric (Du-Form) im Modus ultracode: Multi-Agent-Orchestrierung über Workflows, keine Kostengrenze innerhalb der in Abschnitt 13 genannten Kontingente. Erics Auftrag vom 03.09.2026, 15:21, wörtlich: "den PERFEKTEN Bitburner Bot bauen - maximal autonom UND maximal effizient, keine Token-Limits, Subagents/Kritiker/Tests/alles nutzen; drakonischste Strafen fuer Haenger (Worst Case)". Seine Antworten auf Rückfragen:

1. Bauform ist Mittel, nicht Ziel: Neubau mit Portierung des Bewährten ODER Umbau des vorhandenen Bots - du entscheidest je Modul (Abschnitt 4.9, Judge-Panel in Abschnitt 8).
2. Härteste Selbstmaßnahme des Bots: Stufenleiter bis zum Soft-Reset (Augmentierungen installieren). KEIN `b1tflum3`, kein Destroy-Knopf von Hand, nie ein zweiter Tab auf `bitburner-official.github.io`.
3. Testen: alles erlaubt (lokale Spielinstanz, Mocks, Hot-Swap live), ABER wörtlich: "mein savegame darf nicht zerstoert werden. Das ist extrem wichtig - das ist die live file!"
4. Abnahme gestaffelt (Abschnitt 10): Tests + Skeptiker grün -> 12 h Live ohne Eingriff -> ein autonom beobachteter BitNode-Sprung inklusive Kaltstart danach.

Das Ziel des Gesamtvorhabens: alle 15 BitNodes auf Stufe 3 (45 Läufe, 40 stehen noch aus) in der FEST vorgegebenen Reihenfolge aus `src/route.json`, vollständig ohne menschlichen Eingriff und so schnell wie möglich. Eric entscheidet im Spiel nichts mehr (Ansage 29.08.2026: "DU kennst den gesamten source, nicht ich"); vorgelegt wird nur, was außerhalb des Spiels liegt - Geld, Zugangsdaten, sein Rechner.

Systemzeit immer per `date` abfragen, nie aus dem Kontext (Falle 23.08.2026: erfundene Zeitstempel bei Stundenberichten).

# 1. Lage und Bestand

## 1.1 Was existiert und wo

- Projekt: `C:\Users\erche\Desktop\claude_projecto\bitburner`, privates Repo `github.com/losferatos/bitburner`, 660 Commits seit 19.08.2026, letzter Stand `662421d`. `data/`, `backups/`, `reference/`, `node_modules/` sind in `.gitignore`.
- Spiel: Bitburner v3.0.1 (Webversion) im Opera-Tab auf `https://bitburner-official.github.io`, Spielstand in IndexedDB `bitburnerSave/savestring/save` (`reference/v301/src/db.ts:28,36,84,120`). Stand 03.09. 16:35: `identifier 197f4d61481686`, BitNode 10 Lauf 2 (seit 01.09. 15:59), Source-Files {1:1, 4:1, 5:1, 6:1, 10:1}, 2 Sleeves, Settings im Stand: `AutosaveInterval 60`, `RemoteFileApiPort 12525`, `RemoteFileApiReconnectionDelay 5`, `AutoexecScript "boot.js"`.
- Skripte IM Spiel: `src/` (106 Dateien) plus `src/lib` (3) und `src/worker` (5). Die Brücke schiebt alles unter `src/` mit Endung `.js .jsx .ts .tsx .txt .json .script` nach home (`sync/bridge.js:135,151,195`).
- Brücke: `sync/bridge.js` (438 Zeilen, seit 19.08. unverändert). RFA-WebSocket-Server Port **12525**, Dashboard/RPC Port **8795**, beide nur 127.0.0.1 (`bridge.js:27-28,391`). Das Spiel ist Client und verbindet 2 s nach Laden (`index.tsx:37`), Reconnect alle 5 s laut Live-Settings.
- Werkzeuge außen: `tools/` (u. a. `task.js`, `save.js`, `checkin.js`, `test-route.js`, `test-stillstandsuhr.js`, `liste.js`, `aufsicht.js`, `wache.js`), Prüfstand-Server `pruefstand/serve.js` (Port 8799), Referenzquellcode `reference/v301` (Tag v3.0.1, Commit 3162fd2) und `reference/bitburner-src` (dev-Snapshot 3.0.2, Commit 79e5cd8 - NICHT der Live-Stand).
- Doku: `doku/*.md` (Formeln Hacking/Progression/Wirtschaft/Börse, Drosselung, Schlupflöcher, RFA-Protokoll, Reset-Plan, API-Änderungen v3), `nodes/*.md` (Roadmap, Route, Audits, BAUSTELLEN, ERLEDIGT), Skill `skills/bb.md` (Kopie), aktiv unter `C:\Users\erche\Desktop\claude_projecto\.claude\skills\bb\SKILL.md`.
- Route: `src/route.json`, 40 Einträge, Kopfzeile: "die Reihenfolge steht fest und wird von niemandem geaendert"; `braucht` = Datei, die auf home liegen muss (`hashes.js` für BN9, `boerse.js` für BN8), sonst wird der Eintrag übersprungen und gemeldet. Änderungen nur mit grünem `node tools/test-route.js`.

## 1.2 Bewährt, fragil, tot (Kartierung 03.09.2026)

Bewährt (läuft seit mindestens einer Woche, mehrfach skeptisch geprüft):
- Rückrufkette `exit.js` -> `destroyW0r1dD43m0n(ziel, "boot.js")` -> `boot.js` (idempotent, räumt knotengebundene Dateien, gibt nie auf, killt nach 5 min alles auf home außer sich selbst; live bewiesen 01.09. 15:59). RAM `boot.js` 4,0 GB (geeicht).
- Arbeiter `src/worker/hack.js, grow.js, weaken.js` (1,75/1,80/1,80 GB, absoluter Landetermin, Selbstmessung der Dauer), `share.js`.
- HWGW-Kern in `src/bn4net.js` (3273 Zeilen, 47 Commits): `kennzahlen()` (`:1152-1200`), `planMix` (`:1644-1735`), Wasserfall (`:2417-2437`), Stapelkalender mit `GAP_MS 400` (`:1917-2225`), `platziere()` (`:3240-3273`), `growFaeden()` Newton (`:3195-3216`). Gemessen: 1 Ziel $9,12 M/s -> 3 Ziele $18,06 M/s (`:1279`).
- Selbstschutz-Muster in bn4net: `reserveHome()` (`:178-237`), Werkbank-Reserve (`:1007-1033`), Entdopplung "jüngste bleibt" (`:2741-2760`, seit 02.09.), Telemetriealter-Kill (`:61-67, 2713-2739`), `WERKZEUG`-Kill mit Endungsergänzung (`:587-663`), `try` um die ganze Runde (`:391-392, 3167-3170`).
- `contracts.js` (30 Löser, 17,65 GB, seit 20.08. unverändert), `popups.js` (Escape ohne isTrusted, Einladungs-Join, Wache über bn4net `:103-126`), `darkweb.js` (TOR/Ports per DOM-String-Trick, 27,65 GB), `blade.js`-Entscheidungsregeln (3488 Zeilen, 92 Commits, Schwelle 0,35 `:392`, Graft-Riegel `:2994`), `bn4rep.js`-Logik (1939 Zeilen, `MINDEST_WARTESCHLANGE 3` `:296`, `installAugmentations("boot.js")` `:1169`), `graft.js` (ein Graft je Aufruf), Brückenkern (id-Map mit 15-s-Timeout, Debounce-Push 400 ms, `pushAll` beim Verbinden), `tools/save.js`-Dekodierung (latin1 -> gunzip -> JSON, `save.js:36-43`).

Fragil (jung oder bekannt lückenhaft):
- `ausgang.js` (02.09., 8,15 GB gemessen `ausgang.js:14`; `planeRoute` rein und durch `tools/test-route.js` über alle 39 Sprünge geprüft; **noch kein Live-Sprung darüber** - alle Sprünge bis 01.09. liefen per `tools/task.js`).
- `hashes.js`, `hacknet.js` (BN9, nie live), `sleevecrime.js` (Marker landet nicht auf home, kein `scp` im 5,7-GB-Budget), `sleeve.js` (Vorfall 02.09. 06:00: Konto -18,5 Mio), die drei jüngsten bn4net-Blöcke vom 02.09. (A1-Regel `:685-705`, Stillstandserkennung, Kaltstart-Faktor 1,0 `:733-749`).
- `bn4life.js` (293,8 GB außerhalb BN4), `bn4rep.js` (846,8 GB gemessen außerhalb BN4; lief in BN10 L2 26 h nicht), `exit.js` (519,25 GB mit SF4.1 - gerechnet, nie gemessen), `homegrow.js` (148,5 GB außerhalb BN4), `bn4door.js` (99,85 GB): alles RAM-Gefangene des Faktors 16.
- `wakelock.js` (34,25 GB wegen DOM-Literal 25 GB; AudioContext braucht Nutzerklick nach Reload; passt im Kaltstart nicht).

Tot (BitNode-1-Ära, DOM-Steuerung ohne SF4, seit 21.08. nicht mehr gestartet): `autopilot.js`, `telemetry.js` (die Brücke pollt `data/telemetry.txt` trotzdem alle 2 s, `bridge.js:31,234-255`), `stocks.js`/`stockaccess.js` (einzige Börsenlogik im Repo, verlangt 4S), `homeram.js`, `buyaugs.js`, `travel.js`, `hand.js`, `keepalive.js`, `nightshift/*`, `archiv/entwurf/*`, `tools/watch.js`, `tools/plan.js`, `lib/calc.js`/`lib/batch.js` (bn4net kopiert `platziere` bewusst statt zu importieren, weil calc ohne BN-Multiplikatoren rechnet, `bn4net.js:3228-3234`). Vollständige Liste: Dossier R1 Abschnitt 1e - im Repo per `git log --follow` je Datei prüfen, bevor du etwas löschst.

## 1.3 Der Motor heute (bn4net.js) - Rundenaufbau und Kaltstart

Eine `for`-Schleife, `ns.sleep(10000)` am Ende: Wache bn4life -> Selbstbeender -> Ersatz-Auftragsleser -> Rooten -> `WERKZEUG`-Reload -> Kauf/Ausbau -> Werkbank -> Zielwahl/HWGW/Verteilung -> Werkzeuge (Sammeln, Stillstand, Entdopplung, Starter) -> Telemetrie. `WERKZEUGE` (14 Einträge, `bn4net.js:257-347`) ist Startpriorität und Wiederaufbauplan: ausgang, hashes, sleevecrime, blade, bbtrain, sleeve, hacknet, bn4life, homegrow, contracts, wakelock, popups, bn4rep, bn4door. Werkbank = größter gerooteter Fremdrechner >= 20 GB (`:945-951`), notfalls home.

Kaltstart nach Knotenwechsel (home 32 GB mit SF1, `Prestige.ts:243-249`): boot.js startet nur bn4net (16,25 GB gemessen in BN10, `bn4net.js:218`; 17,75 laut BAUSTELLEN; 19,65 in BN4 wegen hackAnalyze, `:34-35` - **drei widersprüchliche Zahlen, in der Bausitzung mit `calculateRam` messen**). Werkbank = home, ausgang (8,15) passt, dann sleevecrime (5,7) oder hashes (~5). Alles Übrige (darkweb 27,65, contracts 17,65, wakelock 34,25, bn4life 293,8) wartet auf den ersten 32-GB-Mietrechner (BN10: 55.000 x 32 x 5 = 8,8 Mio, geeicht `zahlen.md:9`). In BN10 L2 stand das 13,5 h (Audit B.9); die Reparatur vom 02.09. (Faktor 1,0, sleevecrime) ist nie live gemessen.

## 1.4 Belegte Lücken (Audit 02.09.2026 + Kartierung 03.09.)

1. Kein Prozess-Supervisor außerhalb des Spiels. Die Brücke ist der einzige Außenprozess, hat seit dem 02.09. (Windows-Autostart-Eintrag entfernt, Autostart-Ordner ist leer) keinen Starter mehr und war am 03.09. zweimal tot; das Spiel zeigte "Error with websocket ws://localhost:12525". Kein PID-File, kein `uncaughtException`-Fang, Port-Konflikt endet in `log("error")` (`bridge.js:425`), Logs sind Speicherlisten - der Tod ist nicht rekonstruierbar (Audit C.16).
2. Stillstandserkennung deckt 5 von 14 Werkzeugen (`bn4net.js:61-67`): contracts, popups, bn4door, homegrow, wakelock, hashes, hacknet, sleevecrime, bn4rep haben keine Telemetrie. Die externe Wache ist abgeschaltet (Doppelstarts, Audit C.12/13), ntfy ist dauerhaft aus.
3. Kein Figur-Vergabepunkt (Audit C.14): bbtrain, joinrun, bn4life, blade, kampfaugs, graft, bn4rep greifen mit lokalen Absprachen (`rep-modus.txt`, `inBladeburner`, `GYM_MIN_GELD`) nach derselben Figur; Ping-Pong entschärft, nicht beseitigt.
4. Logs mit "w" (200 Zeilen), `popups-*.txt` mit "a" unbegrenzt; kein Post-mortem möglich.
5. Kaltstart: contracts passt um 1,9 GB nicht neben bn4net auf 32 GB (`praemisse.md:128-129`); wakelock nicht startbar -> Tab gedrosselt, obwohl `hacktimer.js` (Worker-Timer, ungenutzt) existiert.
6. Faktor 16 auf Singularity außerhalb BN4 mit SF4.1 (`RamCostGenerator.ts:82-96`): trifft nur noch den Rest von BN10 L2, ganz BN10 L3 und deren zwei Ausgänge; ab Route-Position 3 (BN4, dort x1) und ab SF4.3 überall x1 (`praemisse.md:122-125`).
7. Fehlende Gewerke: BN8 (`boerse.js` fehlt), BN15 (Labyrinth, null Zeilen), BN9 nur theoretisch; blade.js kennt seit 02.09. `BladeburnerRank`, Skillkaufplan bei `BladeburnerSkillCost` 2/3 nie simuliert (Audit J).
8. Zeitmessung: `totalPlaytime` schreibt Offline-Zeit VOLL gut (`engine.tsx:344-350`); "Tempo 1,0 über 11,5 h" war am 02.09. die Offline-Gutschrift (Audit F).
9. Kein Testgeschirr für Spiellogik außer `test-route.js` und `test-stillstandsuhr.js`; `pruefstand/serve.js` serviert `reference/bitburner-src` (dev 3.0.2, `serve.js:43`), `reference/v301` hat keinen Build (kein `index.html`, `dist/` nur statische Assets).
10. Kein Backup des Live-Stands seit BN6: einziges Backup `backups/save-2026-08-28-0740-vor-exploits.json.gz`; kein Werkzeug sichert, 17 Werkzeuge rufen `getSaveFile` nur lesend.
11. Autoexec `boot.js` und der Autostart-Handgriff gelten laut Memory als erledigt (02.09. 19:10), `nodes/BAUSTELLEN.md:137-140` führt sie noch als offen - **nachprüfen** über `node tools/save.js` (`SettingsSave.AutoexecScript`) und den Autostart-Ordner.

# 2. Unverhandelbare Regeln (wörtlich)

- "mein savegame darf nicht zerstoert werden. Das ist extrem wichtig - das ist die live file!" (Eric, 03.09.2026). Daraus Abschnitt 7 als absolute Bedingung.
- "KEIN b1tflum3, kein Destroy-Knopf von Hand, nie ein zweiter Tab auf bitburner-official.github.io" (Eric, 03.09.2026). Zwei Tabs = Save-Rennen auf denselben IndexedDB-Schlüssel, letzter Schreiber gewinnt (`doku/schlupfloecher.md` V11).
- `skills/bb.md`: "Augmentierungen von Hand kaufen, einen zweiten Tab auf bitburner-official.github.io öffnen, b1tflum3 oder den Destroy-Knopf anfassen. Gilt unverändert." Und: "`node tools/task.js exit.js <ziel>` umgeht die Route und die Gewerk-Prüfung - das war der Weg bis zum 01.09. und ist es nicht mehr."
- "Die Route ändert niemand auf Zuruf" (`skills/bb.md`, ENTSCHIEDEN-Tabelle `nodes/BAUSTELLEN.md`, Kopfzeile `src/route.json`). Ziel ist Level 3 überall = 45 Läufe.
- ENTSCHIEDEN-Liste (`nodes/BAUSTELLEN.md:8-12`): "Vor jeder Aenderung diese Liste lesen. Wer etwas aendern will, das hier steht, braucht eine neue Messung oder eine neue Fundstelle - nicht ein neues Argument." Einträge u. a.: Feuerschwelle Black Ops 0,35; Einbau vor Divisionsbeitritt nie; Beitritt sofort bei Kampfwert 100; Ausgang aus BN10 nur Bladeburner; EditSaveFile im laufenden Spiel nein.
- "ich will nicht permanent KI laufen lassen, das ist mir auch zu teuer" (Eric, 31.08.2026): der fertige Bot läuft OHNE Claude-Loop im Betrieb. Das Bau-Budget (Abschnitt 13) gilt für den Bau, nicht für den Betrieb.
- "ich will gar keine nfy Nachrichten mehr bekommen" (Eric, 31.08.2026): `~/.claude/notify-aus` bleibt liegen, keine Ausnahme. Was zu melden ist, geht in den Chat oder in `nodes/BAUSTELLEN.md` unter `## Sofort`.
- Kein Wächter, der Freigaben anfordert (Eric 24.08.2026: "Staendig wollte die irgendwelche Freigaben, ohne mir Kontext zu geben"); ein Prüfer liest nur, schweigt bei Ruhe.
- Kein Browserzugriff von außen auf Opera im laufenden Betrieb (CDP löst Freigabeabfragen aus, `.claude/skills/bitburner/SKILL.md:37`); Opera antwortet auf `/json` mit 404 (`nightshift/cdp.js:14-29`).
- `Suppress faction invites` NIE einschalten - das Popup ist der einzige Beitrittsweg ohne Maus. eval-Exploit bleibt draußen. `tools/aufsicht.js` und `tools/wache.js` nicht starten (Doppelstarts, Audit C.12/13).
- Referenzquelle ist Tag v3.0.1 (`reference/v301`), nie dev; drei belegte Abweichungen zwischen `reference/` und dem laufenden Spiel (`BAUSTELLEN.md:589`) - im Zweifel gilt die Messung im Spiel.
- Skeptiker-Pflicht (globale CLAUDE.md): "Laeuft der geaenderte Code weiter, wenn niemand hinsieht?" -> Skeptiker-Lauf vor dem Fertig, auch bei einem Einzeiler (30.08.2026: zwei von drei "kleinen" Änderungen waren schwer fehlerhaft). `[skeptiker]` im Commit-Betreff.
- "Wer eine Formel aus fremdem Quellcode anwendet, baut sie als ausfuehrbaren Code nach und eicht sie gegen einen unabhaengig bekannten Wert" (30.08.2026: vier von vier Kopfrechnungen falsch - sequenzielle Mutation, Additivität, ähnliche Feldnamen, Umgebungsmultiplikator).
- "Verifiziert" heißt drei Fragen beantwortet: Welche Uhr? Was bei Stillstand und Nachholen? Rate oder Bestand? Ein Ausschluss gilt nur, wenn das Werkzeug den ausgeschlossenen Fall anzeigen könnte.
- Commit- und Push-Regeln: jede Änderung committen, nicht-triviales sofort pushen, nur geprüft, nie `--force`, `git add <pfad>` statt `git add -A` (`.gitignore`-Kommentar: verboten, weil fünf Loops schrieben).
- Bezeichner englisch, Kommentare deutsch ohne Umlaute, kein Massen-Rename; umbenannte Felder in gespeicherten Dateien brauchen eine Migration beim Laden (NEONBREAK 19.08.2026).
- `nodes/BAUSTELLEN.md` nur über `node tools/liste.js` bearbeiten (28.08.2026 zweimal per Textsuche zerlegt). Skills: erst `skills/bb.md` im Repo, dann nach `.claude/skills/` kopieren (`skills/README.md`).
- Hintergrundtasks: ein schwebender Bash-Hintergrundtask oder persistenter Monitor blockiert alle Cron-Jobs der Sitzung (26.08.2026: 2 h 56 min Stillstand); Warteschleifen nur mit harter Grenze; lange Wartearbeit abgekoppelt (`Start-Process`/detached) mit Fortschritt in Datei.
- CPU-Deckel: rechenintensive Läufe (Browser der Testinstanz, webpack) auf 4 von 12 Kernen (`ProcessorAffinity = [IntPtr]15`, `PriorityClass 'Idle'`; Eric 05.08.2026: Lüfter).

# 3. Ziele und Kennzahlen

"Maximal autonom" heißt messbar:
- Anzahl menschlicher Handgriffe je Woche = 0, einschließlich Knotenwechsel, Kaltstart, Einbau, Brückenneustart, Rechnerneustart (nur der Tab selbst muss offen sein - das ist Erics Rechner, nicht der Bot).
- Jedes Werkzeug hat einen Herzschlag, jede Frischegrenze ist überwacht, jeder Hänger endet in einer protokollierten Sprosse (Abschnitt 5) - nie in einer Endlosschleife und nie in einer Fehlstrafe.
- Post-mortem-Fähigkeit: nach jedem Ausfall lässt sich aus `data/`-Spiegeln und Brückenlog rekonstruieren, was in den letzten 48 h geschah.

"Maximal effizient" heißt messbar - alle Raten nur aus Fenstern ohne Offline-Sprung und ohne Nachholbetrieb, absolut gegen den Formel-Bestwert des Knotens, nicht gegen die Vorstunde (Memory absolut-statt-relativ-messen):

- Uhr: eigene **Motorzeit** = Summe über Runden von `min(Δwall, 2 x Takt)`; parallel Wanduhr; `totalPlaytime` NIE als "das Spiel lief" (Audit F). Rückstand als Bestand: Bladeburner-`storedCycles` (Abbau höchstens 5 Spielsekunden je Realsekunde, `Bladeburner.ts:1377-1380`), Sleeve-`storedCycles` (Deckel 15 je Takt, `Sleeve.ts:263-275`). Fenster verwerfen, wenn `storedCycles` > 30 s oder Δ totalPlaytime > Δ wall + 60 s.
- Kaltstart: `t_werkbank` (erster Rechner >= größtes Werkzeug; Bestwert = Knotenpreis / Kaltstart-Einkommen + Vertragsbestand; Alarm bei > 2 x Bestwert), `t_tor` (Divisionsbeitritt bzw. erste Faktion; Formel aus `skill.ts:13` je Kampfwert gegen Gymrate 10 exp/s Spieler + 2,5 je Sleeve bei sync 25, `zahlen.md:55-58`), `geld_min` (Minuten mit negativem Konto = 0; negatives Konto lässt purchaseServer/purchaseProgram/upgradeHomeRam/travelToCity `false` zurückgeben, Audit B), `anteil_brach` (> 20 % ungenutztes Netz-RAM über 10 min = Kaufstopp oder Zielmangel).
- Aufbau: `augs_je_stunde`, `mult_produkt` gegen die Obergrenze des Sortiments, `favor_max`/`rep_kumuliert` gegen 462.490 (Favor 150, `favor.ts`; BN3 85.396, BN8 0), `graft_laufzeit_anteil` (abgebrochene Grafts = 0, Geld ohne Erstattung), `t_wiederaufbau` nach Einbau (gemessen 3,1 h bei Mult 1,6-2,2, `nodes/HEBEL.md:80-114`; Abweichung > 30 % = Figur-Konflikt).
- Träger V2: `T2` Verdopplungszeit des Rangs (Referenz BN6 3,5-3,8 h bei Faktor 1,0, `nodes/ROUTE.md:176-182`; Soll = Referenz / (`BladeburnerRank` x Sleeve-Faktor)), `arbeitsanteil` (Kammeranteil > 60 % bei freien Cyber's-Edge-Stufen ist ein Fehler), `vorrat_deckung` je Operationsart, `chance_naechste_blackop` >= 0,35, `chaos_stadt` < 50 (`Action.ts:94-101`). Träger V1: `exp_rate_eff` gegen `Threads x (3 + 0,3 x baseDifficulty) x hacking_exp x HackExpGain / t_weaken` (`Hacking.ts:30-38`), `anteil_hack_faeden`.
- Ausgang: `t_sprunglatenz` von `offen=true` in `data/ausgang.json` bis neuem `lastNodeReset` <= 2 Takte; `t_boot` (Sprung -> Kern läuft im neuen Knoten) < 5 min; `wirtFehlt`-Zähler = 0.
- Laufsumme: Betriebs-h je Routeneintrag gegen Roadmap-Soll (V2 Faktor 1,0 mit 3 Sleeves 22-29 h, `nodes/ROUTE.md`), Gesamtprognose 1.100-1.900 Betriebs-h (`ROUTE.md:93`) als laufende Ist-Korrektur; Kalender/Betrieb-Faktor als Kennzahl der Tab-Disziplin (BN10 L1: 94,9 h Kalender für ~52 h Spielzeit).
- Alarmregel: `T2` > 2 x Soll oder eine Rate 60 Betriebsminuten unter 50 % des Bestwerts -> Signal S2 (Abschnitt 5). Bewegung allein ist kein Fortschritt (25.08.2026: Wache meldete sieben Stunden "läuft", Bot arbeitete in falsche Richtung).

# 4. Architektur-Anforderungen

## 4.1 Schichten

1. **Außen (ein Prozess)**: die Brücke. Beobachter und Sicherer, kein Arzt. Kein weiterer Prozess: keine Wache, keine Aufsicht, kein headless-claude, kein ntfy.
2. **Kern im Spiel (singularityfrei, passt auf 32 GB home)**: `boot.js` (Rückruf + Autoexec), Kern/Motor (Rooten, HWGW, Kauf/Ausbau, Werkbank, Registry-Starter, Stillstand, Entdopplung), Ausgang (`ausgang.js`, Route + beide Türen), Wächter (Strafleiter, Abschnitt 5), Popup-Wache.
3. **Gewerke (RAM-teuer, laufen auf der Werkbank)**: je Verfahren/Knoten aus der Registry gestartet; kommunizieren ausschließlich über Dateien auf home.
4. **Arbeiter**: Einwegskripte mit minimalem RAM, unverändert portieren.

Der Kern kennt keine Knotennummer im Code (ENTSCHIEDEN 29.08.: "nie eine Nummer im Code, derselbe Fehler an sieben Stellen"); Knotenrolle kommt aus `data/verfahren.txt` (`ausgang.js:188-192`), Multiplikatoren aus `ns.getBitNodeMultipliers()` bzw. im Spiel gemessen.

## 4.2 Kern

- Rundenlogik als reine Funktion `round(ns, state)` getrennt von der Schleife, damit sie gegen den ns-Mock (Abschnitt 6.6) läuft. Zustand, den eine Runde braucht, kommt aus dem Spiel, nicht aus Konstanten (Regel 2 aus Memory autonomer-lauf-absichern: 20.08.2026 fünf Stunden Stillstand, weil Parameter für 274 TB gesetzt waren und der Reset auf 116 GB zurückwarf).
- Zwei Betriebsmodi als Zustand, nicht als Sonderzweige im 10-s-Motor: **Kaltstart** (kein eigener Rechner, home 32/128 GB) und **Normalbetrieb** (Werkbank existiert). Im Kaltstart gilt das RAM-Budget aus 4.8; die Leiter kauft den ersten Rechner zum Knotenpreis mit Faktor 1,0 (`bn4net.js:733-749`, gebaut 02.09., nie live gemessen).
- Der Kern startet Werkzeuge nur aus der Registry (4.3) und nur, wenn `verfahren.txt` und Knotenmarker (`keine-hacknet.txt`, `keine-sleeves.txt` mit Knotennummer, `bn4net.js:2836-2847`) es erlauben. Ein Werkzeug, das nicht passt, ist `werkzeugWartetGb` (`:3013`) und löst Ausbau aus (A1-Regel `:685-705`) - kein Hänger.
- Entdopplung: jüngste PID gewinnt (`:2741-2760`, seit 02.09.; vorher älteste -> 17 wirkungslose wakelock-Neustarts in 4 h, Audit C.12).
- Der Kern misst seinen eigenen RAM-Bedarf beim Start (`ns.getScriptRam`) und schreibt ihn in die Telemetrie; der Budget-Test (6.1) prüft ihn gegen 4.8.

## 4.3 Werkzeug-Registry

Ersetzt `WERKZEUGE`-Array plus `verfahrenV1`/`markerGilt`-Sonderfälle plus `TELEMETRIE`-Tabelle durch EINE Datei `src/registry.json` (die Brücke schiebt `.json` nach home wie `route.json`). Je Eintrag:

    name, args, ramGb (gemessen, mit Datum), verfahren [V1|V2|alle], knoten (Menge oder alle),
    phase [kaltstart|normal|beide], telemetryFile, freshnessMs, taktMs, hostRule [home|werkbank|any|not-hacknet],
    priority, needsFigure (bool), needsLibs [...], singularity (bool), restartPolicy

Aus der Registry ergeben sich Startreihenfolge, Stillstandsprüfung (Alter der Telemetriedatei auf home gegen `freshnessMs`), Platzierung, Marker-Prüfung und der RAM-Budget-Test - aus einer Tabelle statt aus vier Stellen. Ein Werkzeug ohne `telemetryFile` ist nicht zulässig (Lücke 1.4 Punkt 2). Frischegrenze mindestens `max(3 x taktMs, 10 min)`, weil ein gedrosselter Tab Schreibtakte auf ~1/min streckt (Memory browser-tab-drosselung: Deckel, kein Faktor).

## 4.4 Gewerke je Verfahren und Knoten

- Immer: Ausgang, Wächter, Popups, Kontrakte, Wakelock (im Kaltstart als Worker-Timer-Variante ohne DOM-Literal, siehe 4.8), Kauf/Ausbau (Kern), home-Ausbau (`homegrow`-Logik mit `brachAnteil`-Bremse).
- V2 (Bladeburner, 30 der 40 Einträge): `blade` (mit Knotenfaktor `BladeburnerRank`/`BladeburnerSkillCost`, `Bladeburner/Formulas.ts:24-25`, `Skill.ts:70-75`), `bbtrain` (Kampfwerte auf 100, Beitritt sofort), `sleeve` (Gym nach (i+1)-niedrigstem Wert, Kontrakte, Infiltrate; Geldboden), **Grafting-Automatik** (heute nur `graft.js` + externes `tools/graftnext.js` - nicht autonom; größter Posten nach der Route selbst laut R4: Anlauf 40 h -> ~10 h je V2-Knoten mit Kampf-Mult < 1), Hashes (SF9.3-Gratisserver: Verkauf, Tausch in Rang 250 Hashes -> 100 Rang ohne Rangfaktor `HacknetHelpers.tsx:539-545`, Improve Gym Training).
- V1 (Hacking, BN1/5/12/8): Rep/Augs (`bn4rep`-Logik, in Kauf/Arbeit/Einbau zerlegt), Faktions-/Backdoor-Kette (`bn4life`, `bn4door`), NFG zuletzt, Favor-150-Bootstrap, Spendenweg (1 Mio $ = 1 Rep bei Mult 1, `donation.ts`), Einbau-Choreografie (teuerste zuerst, `1.9^k`, `AugmentationHelpers.ts:29-37`).
- BN9: `hashes.js`, `hacknet.js` (Wirt für exit.js; keine Arbeiter auf `hacknet-server-*`, `ramRatio` halbiert die Hashrate `HacknetServers.ts:14`).
- BN8 (Route-Position 38-40, Pflicht): `boerse.js` - Long/Short ohne 4S nach Kursrichtung, Haltedauer < 7,5-min-Zyklus (75 Ticks x 6 s, `StockMarket.ts:239-330`), Forecast-Manipulation per `grow/hack {stock:true}` (funktioniert trotz `ScriptHackMoneyGain 0`, `doku/formeln-boerse.md:116-157`), Position >= 20 Mio wegen 2 x 100k Provision, Kaltstart-Regel "keine Rechner kaufen" (Leiter würde 211 von 250 Mio verbrennen, `knoten.md:31,43`), Spende ab Favor 0. Eigenes Modul mit eigener Abnahme im Prüfstand mit BN8-Multiplikatoren.
- BN15 (Position 35-37): Entscheidung vor Eintritt - 3 x ~94 h V2 bei `BladeburnerRank 0,2` gegen Labyrinth-Gewerk (V1b, Netz-Navigator + ~24 Rätsel + Maze-DFS + Einbau-Zyklen, `nodes/AUDIT-ROADMAP-2026-08-24.md:155-189`). Gestaffelt: Lauf 1 als V2-Messlauf mit paralleler `ns.dnet`-Erkundung, Entscheidung dokumentiert vor Lauf 2. Nicht bauen: Gang, Corporation (R4 Abschnitt 4). Stanek/Go nur nach Messung.

## 4.5 Kontrakte über Dateien

Grundregeln (jede aus einem Vorfall):
- `ns.read/write` arbeiten auf dem Wirt des Skripts, nicht auf home ("viermal zugeschlagen", Memory bitburner-werkzeuge) -> jedes Werkzeug auf der Werkbank `scp`t seine Telemetrie nach home (`ausgang.js:116-121`, `bn4life.js:413-415`).
- Textdateien überleben Einbau UND Knotenwechsel (`ServerHelpers.ts:226-239`) -> jede Zustandsdatei trägt `zeit, knoten, nodeReset, augReset, host, version`; Leser verwerfen fremde `nodeReset`. `boot.js` räumt gezielt (Liste `boot.js:77-81` immer, `:104-108` nur nach Knotenwechsel `lastNodeReset < 5 min`); `data/verfahren.txt` wird absichtlich NICHT gelöscht (Skeptiker 02.09.: sonst startet blade in einem Hackingknoten).
- Steuerkanäle tragen Zeitstempel + `nodeReset`; veraltet wird ignoriert, nicht ausgeführt (25.08.2026 05:59: bn4net las einen zehn Minuten alten `WERKZEUG bn4net.js` und beendete sich selbst).
- `data/task.txt` ist Ein-Platz-Kanal (`tools/task.js:31`), wird vor dem Parsen geleert (`bn4net.js:481`); `data/reload.txt` kennt `SELBST bn4net.js` und `WERKZEUG <name>.js` - MIT Endung (27.08.2026: ohne Endung leerte er die Datei, ein Nachmittag).
- Logs: anhängend mit Deckel (Ringpuffer-Muster `bn4life.js:47-59`), nie `"w"` über die ganze Datei; ein Ereignis-Ringpuffer `data/events.json` überlebt Neustarts (Lücke C.16).

Neue Dateien (Namen sind Vorschlag, einmal festlegen, englisch): `data/registry-state.json` (was läuft, seit wann, wo), `data/heartbeat-<tool>.json` oder das bestehende `<tool>.json` mit Pflichtfeldern, `data/strafen.json` (Abschnitt 5.6), `data/guard.json`, `data/aussen.json` (Rückkanal der Brücke), `data/instanz.txt` (`LIVE`/`TEST`), `data/backup-bitte.txt`/`data/backup-ok.txt` (Abschnitt 7), `data/figur.txt` (4.7), `data/version.txt` (Abschnitt 9). Bestehende Kontrakte, die bleiben: `verfahren.txt`, `geldbedarf.txt`, `rep-modus.txt`, `simulacrum.txt`, `keine-hacknet.txt`, `keine-sleeves.txt`, `ausgang.json`, `exit.txt`. Was checkin.js liest (`data/ausgang.json`, `bn4net.json`, `blade.json`, `sleeve.json`, `hb-rep.txt`) wird beim Umbenennen mit angepasst.

## 4.6 Herzschläge und Uhren

- Jedes Skript schreibt je Takt eine Telemetriedatei auf home mit `wall = Date.now()`, `playtime = ns.getPlayer().totalPlaytime` (0,5 GB, kein SF4-Faktor), `runde`, `nodeReset`, `augReset` (`ns.getResetInfo()`, 1 GB, kein SF4-Faktor, `NetscriptFunctions.ts:1486-1499`).
- Zwei Uhren im Kern: Wanduhr und Motorzeit (3.). Die Spieluhr taugt nur für den **Engine-Puls**: Δ totalPlaytime / Δ wall < 0,2 bei Δ wall >= 3 min heißt "Engine steht" (25.08.2026 20:27: Engine stand 46 min, Netscript zählte munter Runden - `hacktimer.js` ohne `atExit` hatte `window.setTimeout` nicht zurückgegeben).
- Nachhol-Vorräte lesen: `ns.bladeburner`-Zyklen bzw. `ns.sleeve.getSleeve(i).storedCycles` (offiziell lesbar, `NetscriptDefinitions.d.ts:81`) - jede Rate im Nachholbetrieb ist Bestand (02.09.: "106.000 exp/h" war Nachholen, stationär 63.400).
- Karenz nach `lastAugReset`, `lastNodeReset` und eigenem Start: 10 min messen, nicht handeln.

## 4.7 Figur-Vergabepunkt

Eine einzige Instanz entscheidet, was die Spielfigur tut; Rangfolge fest: **Graft > Bladeburner-Aktion > Faktionsarbeit > Gym > Verbrechen** (Audit C.14). Bauform: Gewerke schreiben Bedarf (`data/figur-bedarf-<tool>.json` mit `prio, grund, zeit, nodeReset`), der Kern wählt je Runde den Besitzer und schreibt `data/figur.txt` (`owner, since, nodeReset`); nur der Besitzer darf eine `startWork`-artige API rufen (`workForFaction`, `gymWorkout`, `commitCrime`, `graftAugmentation`, `bladeburner.startAction` ohne Simulacrum). Grund: jede `startWork`-Handlung tötet ein laufendes Graft ohne Erstattung (`GraftingWork.tsx:75-83`; Vorfall SPTN-97 $14,63 Mrd, `nodes/ERLEDIGT.md:709`). Mit `The Blade's Simulacrum` (eingebaut -> `data/simulacrum.txt`, `graft.js:26`) laufen Bladeburner und Figur parallel; ab SF7.3 kommt es geschenkt.

## 4.8 RAM-Budget im Kaltstart

Frisches home: 32 GB mit SF1 (128 GB ab SF9.2 = ab Route-Position 7, 8 GB ohne SF1), 1 Kern (`Prestige.ts:242-249`). Singularity mit SF4.1 außerhalb BN4 x16, SF4.2 x4, SF4.3 x1, in BN4 immer x1 (`RamCostGenerator.ts:82-96`); Basiskosten Fn1/Fn2/Fn3 = 2/3/5 GB (`RamCostConstants` Z. 55-57); DOM-Literale `document`/`window` 25 GB je Bezeichner, `globalThis["docu"+"ment"]` 0 GB (`RamCalculations.ts:185-192`, genutzt in `popups.js:12-16`, `darkweb.js:53`). Kleinstes Skript mit EINEM Singularity-Aufruf bei SF4.1: 33,6/49,6/81,6 GB (`praemisse.md:251-263`) - deshalb keine Zerlegung in Einzelaufruf-Skripte (Audit H); die 16x-Phase betrifft nur noch BN10 L2/L3.

Budget auf 32 GB (Zielwerte - JEDE Zahl in der Bausitzung mit RFA `calculateRam` bzw. `ns.getScriptRam` belegen und in `registry.json` mit Datum eintragen):

    boot.js                <= 4,0   (geeicht, `praemisse.md:6`)
    Kern (Kaltstart-Modus) <= 12    (heute 16,25/17,75/19,65 - messen; hackAnalyze-Familie kostet 3 GB, `bn4net.js:34-35`)
    ausgang.js             <= 8,5   (8,15 gemessen)
    Wächter                <= 4     (singularityfrei, kein DOM-Literal, `getResetInfo` 1 GB + `getPlayer` 0,5 GB)
    Wakelock-Worker        <= 6     (Worker-Timer statt AudioContext; DOM nur über String-Trick; mit `atExit`-Rückgabe)
    sleevecrime/hashes     ~5-6     (Kaltstart-Geld)
    contracts              17,65    passt NICHT neben den Kern auf 32 GB - Hälften `cdump.js`/`csolve.js` (< 15 GB, existieren, ungenutzt) oder erst nach dem ersten Mietrechner

Regel: Kern + ausgang + Wächter + Wakelock-Worker müssen zusammen auf 32 GB passen und Platz für ein Geldwerkzeug lassen. Alles Singularity-lastige (bn4life 293,8, bn4rep 846,8, homegrow 148,5, exit 519,25 gerechnet) wartet auf die Werkbank; der Wirt für exit.js (>= 540 GB bei SF4.1) wird geplant, BEVOR die Tür offen ist (`ausgang.js:330-345` meldet `wirtFehlt`, `hacknet.js` löst es nur für BN9). Fallback für den 16x-Ausgang, nur nach Prüfstand-Nachweis: DOM-Weg über BitVerse-Portal (prüft kein isTrusted, `BitverseRoot.tsx:87-100`, `PortalModal.tsx:118-128`) plus Reload, weil ohne cbScript nur Autoexec beim Laden startet (`NetscriptWorker.ts:236-260`).

## 4.9 Portierungsliste (Entscheidung je Modul: unverändert / zerlegt / neu)

Unverändert portieren: Rückrufkette exit/boot; `ausgang.js` + `route.json` + `test-route.js`; Arbeiter; HWGW-Kern (Funktionen aus 1.2); Selbstschutz-Muster; `contracts.js` + Hälften; `popups.js`; `darkweb.js`; `blade.js`-Regeln; Brückenkern; `save.js`-Dekodierung; `checkin.js`-Urteilslogik; gemessene Konstanten (Tonanker 19,5 kHz gain 0,01, Drosselungsstufen 4 ms/1 s/60 s aus `sonde.js`, CloudServer-Preisformel `bn4net.js:757-766`).

Zerlegt portieren: `bn4rep.js` in Kauf / Arbeit / Einbau mit je wenigen Singularity-Aufrufen und Einbau-Handshake (Abschnitt 7); `bn4life.js` in Portprogramme / Verbrechen / Reise; Stillstands- und Startlogik aus bn4net in Registry + Wächter.

Neu: Registry, Wächter/Strafleiter, Figur-Vergabepunkt, Telemetrie-Schema mit Ereignis-Ringpuffer, Kaltstart-Modus, Grafting-Automatik, `boerse.js`, Backup-Funktion und Supervisor der Brücke, Prüfstand-Geschirr (ns-Mock, Szenarien, Budget-Test), Motorzeit-Uhr mit Offline-Erkennung (`lastUpdate`-Sprünge > 1 h verwerfen).

Wissen aus den ~60 % Kommentaranteil von bn4net wandert in `doku/`/`nodes/`, im Code bleiben Kurzverweise mit Datum; veraltete Zahlen (z. B. `bn4net.js:2973` "897,6 Milliarden", laut Skeptiker Faktor 1000 daneben) werden nicht mitkopiert, sondern neu gemessen.

## 4.10 Die Brücke als einziger Außenprozess

Befund 03.09.2026: seit dem Entfernen des Autostart-Eintrags am 02.09. hat die Brücke keinen Starter und war zweimal an einem Tag tot. Das Spiel läuft ohne Brücke weiter (`start.cmd:16-20`), aber Backup, Sicht, Eingriff und Post-mortem fehlen. Anforderungen:

- **Starter ohne den alten Wächter**: `sync/bridge-start.cmd` im Autostart-Ordner `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\` (Aufgabenplanung braucht Admin, `schtasks` ist geblockt, `tools/autostart-einrichten.cmd:20-25`), Inhalt: `cd` ins Projekt, Endlosschleife `node sync\bridge.js` -> `timeout /t 10` -> erneut, minimiert. Kein `aufsicht.js`, kein `wache.js`, kein ntfy, kein headless-claude (Notnagel kostete 6,50 USD/Tag durch einen Fehlauslöser, `aufsicht.js:104-146`).
- **Port als Lock**: `EADDRINUSE` auf 12525 oder 8795 -> sofort `process.exit(2)` (heute nur `log("error")`, `bridge.js:425` - ergibt zwei stumme Prozesse). `process.on("uncaughtException"/"unhandledRejection")` -> loggen, `exit(1)`, Starter startet neu. PID-Datei `data/bridge.pid`.
- **Parametrierbar**: `--rfa-port`, `--dash-port`, `--data-dir`, `--instanz LIVE|TEST` (heute Konstanten `bridge.js:27-28`). Die TEST-Instanz weigert sich, 12525/8795 zu binden.
- **Wachhund am Verbinden**: vor `pushAll` (heute sofort, `bridge.js:421-422`) erst `getSaveFile` -> `SettingsSave.RemoteFileApiPort` muss dem eigenen Port entsprechen, sonst Socket schließen, kein Push, Alarm in `data/bridge-alarm.json`. Zweite Verbindung bei lebender erster: LIVE schließt die NEUE und alarmiert (heute wird die alte ersetzt, `:394-402` - genau der Weg, auf dem eine Testinstanz die Live-Verbindung verdrängt).
- **Backup-Funktion** (Abschnitt 7.2) - vor jedem Push, stündlich, beim Verbinden, auf Handshake.
- **Heartbeat** `data/bridge-heartbeat.json` alle 30 s (`ts, pid, connected, connectedSince, lastTelemetryAt, lastSaveAt, totalPlaytime`) auf Platte; `lastSaveAt` aus `getSaveFile` alle 10 min (Datei ist mehrere MB) - einzige Sicht auf den Recovery-Modus, der `AutosaveInterval = 0` setzt (`RecoveryRoot.tsx:80`) und von innen unsichtbar ist.
- **Rückkanal** `data/aussen.json` alle 60 s per `pushFile`, damit die Innenseite "Brücke tot" von "Tab tot" unterscheiden kann.
- **Post-mortem-Spiegel**: `bn4net.json`/Kern-Telemetrie, `strafen.json`, `guard.json`, `boot.txt`, `ausgang.json`, `events.json` alle 60 s nach `data/mirror/` (Ringordner 48 h). Rotierendes Logfile statt Speicherliste.
- **Aufräumen**: `pollTelemetry` gegen das tote `data/telemetry.txt` (`:234-255`) ersetzen durch den Spiegel; `/api/state` liefert `instanz, rfaPort, dashPort, lastSaveAt`; alle `tools/*.js` lesen `BRIDGE_BASE`/`DATA_DIR` aus einem `--test`-Schalter und brechen bei Widerspruch zu `/api/state.instanz` ab.
- **Nicht**: Werkzeuge starten oder killen (Außenneustart erzeugte Doppelinstanzen, Audit C.12), Tab öffnen, Browser starten, Freigaben anfordern, `data/` im Spiel überschreiben außer `aussen.json`/`backup-ok.txt`/`reload.txt`.

## 4.11 Betriebsmodell (Vorlage an Eric, keine Code-Entscheidung)

Skripte laufen offline nicht (`Engine.tsx:270-277`); verdeckter Tab = 1 Timer-Wake/min (Deckel, Memory browser-tab-drosselung), Sperrbildschirm occludiert alles; "autonom" hieß am 02.09. 5,5 von 24 h (Audit G), Faktor 1,8-4,4 auf die Kalenderzeit. Hebel außerhalb des Codes: Chrome/Edge mit `--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding` (`doku/drosselung.md:133-143`) oder Steam-Fassung (`backgroundThrottling: false`, `electron/gameWindow.js:26,63`). Kosten: einmaliger Umzug per Export/Import durch Eric, der Opera-Tab darf danach nie wieder geöffnet werden. Der Bot muss beide Welten aushalten (Motorzeit-Uhr, Wakelock-Worker); die Vorlage geht mit Zahlen in den Bericht, du führst sie nicht aus.

# 5. Strafleiter für Hänger bis zum Soft-Reset

Die Leiter gehört IN das Spiel (RFA hat kein exec/kill; nur ein laufendes Skript kann starten, `bn4net.js:403-406`) in ein singularityfreies Wächterskript unter 4 GB, gestartet von `boot.js` und bewacht vom Kern - gegenseitig wie heute popups/bn4net (`popups.js:103-126`). Drakonisch heißt: die oberste Sprosse ist der Soft-Reset; robust heißt: keine Sprosse ohne verifiziertes Signal, keine Eskalation ohne verifizierte Wirkungslosigkeit.

## 5.1 Signale (jedes mit beiden Uhren)

- **S1 Werkzeug-Herzschlag**: Alter der Telemetriedatei auf home > `freshnessMs` UND Karenz seit erstem Sichten abgelaufen. Falle: Schreiber auf der Werkbank ohne `scp` nach home -> Dauerkill (bn4life-Vorfall). "Fehlt wegen Platz" (`exec` 0) ist kein Hänger.
- **S2 Träger ohne Fortschritt**: Δ Träger <= 0 über >= 45 min Motorzeit in einer Phase, die Fortschritt verlangt; Träger je Verfahren (V2: Rang, vor Beitritt Kampfwert-Tiefstand; V1: Hacking-Level/$/s; BN9: Hashes; BN8: Depot). Fenster löschen bei `lastAugReset`/`lastNodeReset`-Wechsel, verwerfen bei Nachholvorrat oder Offline-Sprung. Zulässige Nullphasen: Grafting (bis 2,5 h), Gym-Wiederaufbau mit steigenden Kampfwerten, Kaltstart ohne Werkbank.
- **S3a Kern-Herzschlag** > 10 min; **S3b Engine-Puls** (4.6) < 0,2 über >= 3 min = Engine steht.
- **S4 Drosselung**: Rundenrate < 1/min über >= 5 min, `sonde`-Median ~60.000 ms, `visibilityState === "hidden"` - das ist der Zustand, den man erkennt, um ihn NICHT zu bestrafen.
- **S5 Außensicht (Brücke)**: `connected`, `lastTelemetryAt` > 60 s bei `connected`, `lastSaveAt` > 5 min (Autosave aus = Recovery), RFA > 10 min getrennt bei wachem Rechner. Brücke handelt nicht, sie schreibt.

## 5.2 Zustandsautomat

Zustände je (Sprosse k, Ziel): `GESUND` -> `VERDACHT(k)` (Signal steht, Karenz läuft) -> `AUSGEFUEHRT(k)` (Handlung mit Zeitstempel beider Uhren) -> `PRUEFUNG(k)` (Frist nach 5.3) -> zurück `GESUND` bei Wirkung, sonst `VERDACHT(k+1)`; Sonderzustand `NICHT_AUSFUEHRBAR(k)` (kein Platz, kein Wirt, Aktiendepot voll, Gym-Phase) mit eigener Handlung (Ausbau anstoßen, warten) und OHNE Eskalation. Uhren im Automaten: Karenz und Fristen in Motorzeit, Backoff in Wanduhr, Sprosse 5 in Motorzeit. Zähler fallen auf 0, wenn S2 über 60 min Motorzeit Fortschritt zeigt. Alle Übergänge landen in `data/strafen.json`.

## 5.3 Sprossen

- **0 Umgebungskorrektur** (S4/S5): Wakelock-Resume, Popups schließen, Protokollzeile. Nichts killen. Kein Hänger: verdeckter Tab, Brücke tot, Recovery-Fenster.
- **1 Werkzeug neu starten** (S1 + Engine tickt + kein Nachholfenster + Karenz vorbei): `scriptKill` auf allen Wirten, `laufend` bereinigen, Neustart in derselben Runde (`bn4net.js:2713-2736` als Muster). Prüfung: neuer Herzschlag < 2 x Takt, Instanzzahl 1; Frist 2 x Takt, gedrosselt 3 min. Backoff 5 min.
- **2 Anderer Wirt** (Sprosse 1 zweimal verifiziert wirkungslos): Wirt mit meistem freien RAM, Arbeiter räumen (share -> weaken -> grow -> hack, `bn4net.js:2913-2930`), `scp` Datei + Libs, `exec`; Hacknet-Server meiden. Heilt: verschwundener Wirt, gefressener Speicher, Werkzeug, das `data/` auf seinem Wirt statt auf home las. Backoff 15 min.
- **3 Alles killen, boot.js** (S3a + S3b sagt "Engine tickt" + Karenz): Kern netzweit killen, Registry-Werkzeuge killen, Arbeiter auf home killen, `reload.txt`/`task.txt` leeren, `exec("boot.js")`. Prüfung: Kern-Runde beginnt bei 1, Werkzeuge nach Registry wieder da; Frist 5 min. Backoff 30 min, max 6/Tag. Kosten: HWGW-Kalender weg (Minuten Ertrag).
- **4a Tab neu laden, von innen** (S3b "Engine steht" >= 5 min, oder Sprosse 3 zweimal wirkungslos, oder Recovery erkannt): Save-Knopf per React-Props-Klick (`GameRoot.tsx:538-540`, nicht in der isTrusted-Liste - im Prüfstand zu belegen), auf "Game Saved!" warten, `globalThis["window"].onbeforeunload = null`, `globalThis["location"].reload()` (0 GB, Spiel selbst ruft `location.reload()` in `SaveObject.ts:335`). Danach: Autosave-Stand, gespeicherte Skripte + Autoexec `boot.js` starten, RFA verbindet nach 2 s. Nebenwirkung: AudioContext `suspended` bis Nutzerklick -> ein Reload macht Drosselung schlimmer, nie besser; deshalb nur bei stehender Engine oder Recovery, nie wenn `visibilityState === "visible"` und `hasFocus()` (Eric sitzt davor). Backoff 2 h, max 3/Tag.
- **4b Tab neu laden, von außen (CDP)**: unter Opera nicht verlässlich (404 auf `/json`, Verbindungsdrosselung, `cdp.js:14-29`); nur mit Chrome/Edge (4.11) und nur, wenn `Target.getTargets` genau EINEN Spiel-Tab zeigt - nie "Browser starten und URL öffnen" (Sitzungswiederherstellung öffnet den alten Tab noch einmal = zwei Tabs). Ohne diesen Nachweis: nichts tun, Befund in Datei.
- **5 Soft-Reset durch Einbau** (Erics oberste Sprosse): heilt Skripthänger wie Sprosse 3 UND Spielzustands-Deadlocks (Konto < 0 -> Geld auf 1000 $ + Startgeld, `Prestige.ts:84-88`; Stadtfaktions-Sperren; laufende Arbeit). Kostet: Server, Programme, TOR, Faktionen, Rep, Kampfwerte auf 1 (vor Divisionsbeitritt 6,6 h - ENTSCHIEDEN "nie"), `1.9^k` verschenkt bei einer Aug, Aktienpositionen ersatzlos (`initStockMarket`, `Prestige.ts:169-172`), laufendes Graft ohne Erstattung. Auslöser: S2 ohne Fortschritt >= 6 h Motorzeit UND Sprossen 1-4 ausgeführt und verifiziert wirkungslos UND kein Nachholfenster UND `queuedAugmentations >= 1` (nur per DOM lesbar, `install.js:82-93`; `ns.getResetInfo().ownedAugs` zählt nur installierte) UND nicht in der Gym-Phase vor Beitritt UND Depot leer; ODER nachgewiesener Deadlock (Konto < 0 seit >= 2 h Motorzeit ohne Einnahmequelle; Figur ohne Rückreisegeld; alle Zielfaktionen gebannt). Ausführung: `installAugmentations("boot.js")` (80 GB außerhalb BN4 mit SF4.1, `RamCostGenerator.ts:212`) von einem Wirt mit Platz; existiert keiner, Sprosse VERWEIGERN und protokollieren (DOM-Klick kennt kein Callback, Autoexec startet nur beim Laden). `softReset` ohne Augs bringt null Multiplikatoren - nur bei Deadlock. Höchstens einmal je Knotenstufe, nie innerhalb 24 h Motorzeit nach dem letzten Einbau. Prüfung: `lastAugReset` gesprungen, `boot.txt` neu, Konto > 0, Registry läuft; Frist 10 min.

## 5.4 Schutz vor Fehlstrafen

Kein Hänger ist: Offline-Nacht (Motorzeit steht), Sleeve-/Bladeburner-Nachholen (Vorrat > 30 s), Offline-Klumpen der Figur beim Laden (`engine.tsx:280-282`: 10 h Gym auf einen Wert am 02.09.), Brücke tot, Kaltstart mit 32-GB-home (13,5 h zäh, kein Hänger), Grafting, Gym-Wiederaufbau, Werkzeug ohne Platz, Werkzeug, das im Knoten nicht laufen soll (blade in V1, `bn4net.js:2825-2859`), Werkzeug jünger als seine Karenz, Einbau/Wechsel < 10 min her, Wächter selbst < 2 min alt (Seite gerade geladen). Der Wächter irrt in Richtung Untätigkeit, aber er SCHREIBT jeden Verdacht - Untätigkeit darf nicht wie Gesundheit aussehen (20.08.2026: fünf Stunden Stillstand, Wache blind).

## 5.5 Endlosschleifen

Zähler je (Sprosse, Ziel) in der Datei; Eskalation nur nach ausgeführt UND verifiziert wirkungslos; `NICHT_AUSFUEHRBAR` eskaliert nie. Backoffs wie in 5.3. Jeder Fernbefehl trägt Zeitstempel + `nodeReset`. Wächter und Kern bewachen sich gegenseitig über Herzschläge; beide sind idempotent startbar; Doppelinstanzen löst die Entdopplung ("jüngste bleibt"). Der Wächter selbst darf keine Singularity- und keine DOM-Literale enthalten - er muss auf jedem frischen home laufen.

## 5.6 Protokoll, das den Sprung überlebt

`data/strafen.json` auf home als Ringpuffer (200 Einträge), NICHT in den Räumlisten von `boot.js`. Eintrag: `{sprosse, ziel, grund, wall, playtime, motorzeit, runde, knoten, nodeReset, augReset, ergebnis, geprueftUm}`. Die Brücke spiegelt alle 60 s auf die Platte und trägt Sprossen >= 3 einmal je Befund über `node tools/liste.js --eintragen sofort --datei <pfad>` in `nodes/BAUSTELLEN.md` ein - mit Entwarnung, ohne Push-Nachricht.

# 6. Prüfstand

## 6.1 Ebenen

- **Ebene 0, ohne Spiel**: reine Funktionen unter `node tools/test-*.js` mit Exit-Code: `planeRoute` (39 Sprünge, existiert), Registry-Auflösung (welche Werkzeuge in welchem Knoten/Verfahren/Phase), Strafleiter-Automat mit simulierten Uhren (alle Übergänge aus 5.2, insbesondere: Offline-Nacht erzeugt keine Sprosse; Drosselung erzeugt keine Sprosse; `NICHT_AUSFUEHRBAR` eskaliert nicht; Sprosse 5 verweigert ohne Wirt), Motorzeit-Uhr gegen Offline-Sprünge, Formeln (6.4), Backup-Check. Dazu ein Test, der `b1tflum3(` in `src/` verbietet und der prüft, dass nur `exit.js` `destroyW0r1dD43m0n` aufruft.
- **Ebene 1, RAM-Budget**: jede `src/`-Datei über RFA `calculateRam` der TEST-Instanz (oder die auf zwei Messwerte geeichte statische Nachbildung `ramcalc.js` aus `nodes/audit-2026-09-02/`) gegen die Registry und das Kaltstart-Budget 4.8; Faktor 16/4/1 je Szenario. Rot, wenn Kern + ausgang + Wächter + Wakelock-Worker > 32 GB.
- **Ebene 2, ns-Mock**: `tools/mock/ns.js` mit gefälschter Uhr, Serverliste, Prozessliste, Dateisystem je Wirt (damit die `read/write`-auf-Wirt-Falle sichtbar wird), `exec` mit RAM-Prüfung; die Rundenfunktion des Kerns läuft darin Szenarien: Kaltstart 32 GB, Kaltstart 128 GB, Werkbankwechsel, Einbau (alle Prozesse weg, Textdateien bleiben), Knotenwechsel (fremde `nodeReset`-Dateien liegen herum), Ein-Platz-Kanal mit altem Befehl.
- **Ebene 3, lokale Spielinstanz** (6.2) für alles, was Engine-Verhalten braucht: boot-Kette, Autoexec, Einbau-Callback, DOM-Klicks (Save-Knopf, Join, Install), Sprung `destroyW0r1dD43m0n`, Prestige-Effekte, Recovery-Erkennung, Wakelock-Worker.
- **Ebene 4, Live-Kanarienvogel**: Hot-Swap zuerst auf die TEST-Instanz mit einem Save-Klon derselben Stunde, dann live (Abschnitt 9).

## 6.2 Lokale Instanz

- v3.0.1 bauen: `reference/v301` ist ein Git-Checkout (bleiben lassen, `webpack.config.js:51` ruft `git rev-parse`), `engines.node >= 24` (Node 24.16.0 vorhanden), `npm ci` dort, dann `npx webpack --mode production` und getrennt `--mode development`; Build-Zeit ~249 s (`build.log` des dev-Baums), CPU-Deckel setzen. `pruefstand/serve.js` auf `reference/v301` umstellen (heute `reference/bitburner-src` = dev 3.0.2, `serve.js:43`) und mit `--dev` wahlweise den Development-Build servieren. Port 8799 (prod), Dev-Build auf eigenem Port (z. B. 8798) = eigene Origin, eigene IndexedDB.
- Browser der Testinstanz: Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) oder Edge mit `--remote-debugging-port=<frei> --user-data-dir=<eigenes Profil unter pruefstand/>`, Affinität 4 Kerne, Priorität Idle. NIE Opera-Profil, NIE `bitburner-official.github.io` in diesem Browser öffnen (eine frische Instanz dort würde sich mit Port 12525 an die Live-Brücke hängen und `src/` in ein leeres Spiel geschoben bekommen). Automatisierung über `nightshift/cdp.js` (nur `ws`, in `package.json`), `/json/list` funktioniert in Chrome/Edge.
- Spielstand einspielen: Klon aus einem `LIVE_`-Backup, `SettingsSave.RemoteFileApiPort = 12526`, `RemoteFileApiAddress = "localhost"`, `AutoexecScript` prüfen, neu gzippen (spielkonform: das Spiel patcht beim Import selbst `SyncSteamAchievements`, `SaveObject.ts:303-316`), Ablage `pruefstand/backups/TEST_...json.gz`; Import per UI (`Import Game`, Dateidialog via CDP `DOM.setFileInputFiles`) oder im Seitenkontext des Klons `indexedDB.open("bitburnerSave", 2)` -> `put(Uint8Array, "save")` -> Reload (`decodeSaveData` akzeptiert Uint8Array). Mit `?noScripts` laden, wenn die gespeicherten Skripte nicht anlaufen sollen (`NetscriptWorker.ts:229-236`). Der `identifier` ist im Klon identisch - er unterscheidet nichts; nur Port und `data/instanz.txt` trennen.
- Dev-Build-Hooks für Szenarien: `globalThis.Bitburner = {Player, GetAllServers, Factions, Companies, SaveObject}` (`engine.tsx:396-411`), Dev-Menü (Geld, RAM, `quickHackW0r1dD43m0n`, SF-Level setzen, Sleeves +/-, Bladeburner an/aus, Time skip; `DevMenu.tsx:53-79`). Im Prod-Build zeigt `openDevMenu` nur die Apr1-Animation.

## 6.3 Zweite Brücke

Dieselbe `sync/bridge.js` mit `--instanz TEST --rfa-port 12526 --dash-port 8796 --data-dir pruefstand/data`; Wachhund prüft `RemoteFileApiPort == 12526` am Verbinden; alle `tools/*.js` mit `--test` gegen `http://127.0.0.1:8796`. Beide Brücken schreiben `data/instanz.txt` auf home ihres Spiels (Textdateien überleben Prestige), und `exit.js`/Einbau loggen sie. Ein `tools/`-Aufruf ohne `--test` gegen eine TEST-Instanz und umgekehrt bricht ab.

## 6.4 Zeitraffer - was er kann und was nicht

Takt `MilliPerCycle 200` (`Constants.ts:19`); `Engine.start` liefert einen Klumpen `numCycles` (`engine.tsx:415-441`). Dev-Menü Time skip verschiebt `lastUpdate` (`TimeSkipDev.tsx:15-21`); manipuliertes `lastUpdate` im Spielstand nimmt den Lade-Offline-Pfad (`engine.tsx:257-355`, Skript-Einkommen x 0,75). Klumpen-treu: Faktionsarbeit, `Player.processWork`, Hacknet, passive Rep, Zähler, BitNode-Übergang. NICHT klumpen-treu (Deckel je Aufruf): Sleeves 15 Zyklen, Bladeburner 5 Spielsekunden je Realsekunde, Gang 25, Corporation 10, Börse echtzeitgedeckelt 4 s (`StockMarket.ts:247-251`), laufende Skripte holen im Live-Klumpen nichts nach. Folge: Bladeburner-Raten, Sleeve-Verhalten, Börse und HWGW-Einkommen werden in Echtzeit mit per Dev-Menü gesetztem Zustand gemessen (z. B. Rang/Skills setzen, dann 30 min laufen lassen), nicht per Zeitraffer. Der Exploit-Wächter `timeCompression` gibt SF-1, wenn zwei 15-s-Timer < 500 ms auseinander feuern (`Exploits/loops.ts:15-31`) - harmlos, aber im Testprotokoll vermerken.

Formeln, die als Code nachgebaut und geeicht werden, bevor mit ihnen argumentiert wird (Eichwerte aus dem Dossier): Serverpreis `ram x 55.000 x CloudServerCost x Softcap^max(0, log2(ram) - 6)` (`ServerPurchases.ts:34-41`; 32 GB in BN10 = 8,8 Mio gemessen); Level `mult x (32 ln(exp + 534,6) - 200)` (`skill.ts:13`; exp 28.841, mult 0,4 x 1,262 -> 65 gemessen); Beitrittstor BN10 252.320 exp je Kampfwert (`zahlen.md:76`); Gym 2.400 $/s je Körper, Nachholen 15 x 2.400 je Sleeve (gemessen ~73.000 $/s, `zahlen.md:11-12`); Hashrate Gratisserver 0,28/s (`HacknetServers.ts:11-16`); Black-Ops-Summe 73.660 für 20 Ops, 400.000 skaliert nicht (`BlackOperations.ts:708`); Aug-Preis `1.9^k`, Rep skaliert nicht (`AugmentationHelpers.ts:29-37,127-161`); RAM-Rechner auf die zwei bekannten Messwerte (ausgang 8,15, boot 4,0).

## 6.5 Testmatrix je Knoten und Phase

Zeilen = Phasen: Kaltstart 32 GB (16x), Kaltstart 32 GB (x1), Kaltstart 128 GB, Aufbau bis Werkbank, Träger, Ausgang offen -> Sprung, Einbau -> boot, Knotenwechsel -> boot, Hänger je Sprosse 1-5, Drosselung/Offline-Nacht (darf NICHT strafen), Brücke tot/neu, Hot-Swap. Spalten = Knotenklassen mit Multiplikatoren aus `reference/v301/src/BitNode/BitNode.tsx`: BN10 (Rank 0,8, CloudCost 5, 16x Singularity - der nächste reale Fall), BN4 (alles x1), BN9 (CloudServerLimit 0, Hashes), V2 Faktor 1,0 (BN2/3/11/6), V2 gedämpft (BN7/14/13/15: Rank 0,6/0,6/0,45/0,2, SkillCost 2/2/2/3), V1 mild (BN1/5/12), BN8 (Börse, `ScriptHackMoneyGain 0`, Start 250 Mio). Je Zelle: Aufbau per Dev-Menü, Assertions aus Abschnitt 3 (t_werkbank, t_tor, geld_min = 0 Minuten negativ, Registry vollständig, keine Fehlstrafe, t_boot < 5 min, t_sprunglatenz <= 2 Takte), Höchstdauer. Pflichtzellen vor der Live-Einspielung: BN10-Kaltstart 16x, Einbau -> boot, Knotenwechsel -> boot mit Sprung über `ausgang.js` (der eine Test, der noch nie lief), Offline-Nacht ohne Strafe, Sprosse 3 und 4a. BN8/BN15-Zellen vor deren Route-Position, nicht jetzt.

## 6.6 Mocks

ns-Mock (6.1 Ebene 2) mit: gefälschter Wanduhr und Spieluhr getrennt steuerbar (Offline-Sprung, Drosselung 1 Runde/min), Prozessliste mit PIDs und Startzeiten, Dateisystem je Wirt inkl. `scp`, `exec` mit RAM-Prüfung und Rückgabe 0, `getResetInfo` mit setzbaren `lastAugReset/lastNodeReset/ownedSF`, `getPlayer().totalPlaytime`, Sleeve-`storedCycles`. Brücken-Mock: ein RFA-Server-Double, gegen das `tools/*.js` laufen (Backup-Check, Handshake). Jeder Mock ist deterministisch (Seed), jeder Testlauf schreibt ein Protokoll nach `pruefstand/data/`.

# 7. Spielstand-Schutzprotokoll (absolute Bedingung)

## 7.1 Wege, auf denen der Live-Stand kaputtgeht, und die Sperre dagegen

1. Zweiter Tab gleicher Origin: kein `onblocked` bei gleicher DB-Version (`db.ts:44-48`), beide autosaven, letzter gewinnt, beide starten alle Skripte, beide wählen 12525. Sperre: Regel absolut; Brücke LIVE schließt eine zweite Verbindung bei lebender erster; kein Werkzeug öffnet je einen Tab.
2. Testinstanz trifft Live-Brücke: ein naiver Save-Klon trägt Port 12525/Reconnect 5 und wählt 2 s nach Laden die Live-Brücke an, die den Live-Socket ersetzt (`bridge.js:394-402`) -> Aufträge (`task.txt`, `cmd.txt` = beliebige Terminalbefehle, `hand.js:94`) landen in der falschen Instanz. Sperre: Port im Klon patchen (6.2), Wachhund, `instanz.txt`, `--test`-Pflicht.
3. Import eines falschen Standes: nur UI, strukturell gültige falsche Stände werden genommen; `VersionNumber 51` in 3.0.1 und 3.0.2 gleich -> Fehlimport unsichtbar. Sperre: Import auf Live nie automatisiert, nur Eric; `LIVE_`/`TEST_`-Präfixe; "Compare Save" nutzen.
4. IndexedDB-Fehler beim Speichern: `Player.lastSave` wird VOR dem Schreiben gesetzt (`SaveObject.ts:236-237`), `getSaveFile` zeigt einen fehlgeschlagenen Autosave nicht; Recovery-Modus schaltet Autosave ab. Sperre: RFA-Backups sichern den Speicherzustand - stündlich.
5. `b1tflum3` prüft weder Ziel noch Bedingung und verlässt den Knoten OHNE Source-File (`Singularity.ts:1139-1151`, `RedPill.tsx:62-64`). Sperre: Test verbietet `b1tflum3(` in `src/`; einziger `destroy`-Aufrufer bleibt `exit.js`, das das Ziel zusätzlich gegen `route.json` prüft.
6. Soft-Reset zur Unzeit (Sprosse 5, Einbau): Riegel `data/install-sperre.txt` (`bn4rep.js:321`), Graft-Prüfung, Depot leer, Backup-Handshake (7.3).
7. Vor dem Sprung gekaufte, nicht eingebaute Augs verfallen (`queuedAugmentations = []`, `PlayerObjectGeneralMethods.ts:116`): kein Aug-Kauf bei `ausgang.json.offen === true`. Nie `bitNodeOptions` an `destroy` übergeben.
8. Direktes IndexedDB-Schreiben am Live-Spiel: ENTSCHIEDEN nein (BAUSTELLEN 29.08.).

## 7.2 Backup-Protokoll (zuerst bauen - der Live-Stand hat seit BN6 kein Backup)

- Quelle: `GET http://127.0.0.1:8795/api/rpc?method=getSaveFile` -> `{identifier, binary, save}`; `save` als latin1 -> `Buffer` -> unverändert als `.json.gz` ablegen (Format des Spielexports `bitburnerSave_<epoch>_BN<n>x<lvl>.json.gz`, `SaveObject.ts:264-275`; Klartext weist der Import ab). Gemessen 03.09.: 0,41 s, 662.398 B gzip, 3.654.979 B roh; `getSaveData` ohne Nebenwirkung, kein Export-Bonus.
- Name: `backups/LIVE_<identifier>_BN<node>L<lauf>_<JJJJ-MM-TT>T<hh-mm>_<anlass>.json.gz`, Anlass in {stunde, verbinden, vor-hotswap, vor-einbau, vor-sprung, manuell}; Testkopien nur `pruefstand/backups/TEST_...` (in `.gitignore` ergänzen).
- Rotation: `stunde` 48, `tag` 30, Ereignis-Backups und das letzte Backup jedes Knotenlaufs nie löschen; Budget < 150 MB.
- Auslöser in der Brücke: beim Verbinden VOR `pushAll`; vor jedem Nachschieben im 400-ms-Stapel; stündlich; Handshake.
- Prüfung `node tools/backup-check.js <datei> [--erwarte-id 197f4d61481686]`: Magic 31,139,8 -> gunzip -> `startsWith('{"ctor":"BitburnerSaveObject"')` -> `JSON.parse` -> identifier, bitNodeN, SF-Map, Lauf, Geld, Hacking, Augs, Sleeves, `lastSave`, `totalPlaytime`, `RemoteFileApiPort`; Exit != 0 bei jedem Fehler; erst danach gilt ein Backup als vorhanden (`backups/INDEX.tsv`).

## 7.3 Handshake vor Einbau und Sprung

Einbau-Modul bzw. `ausgang.js` (vor `exec("exit.js")`, `ausgang.js:348`) schreiben `data/backup-bitte.txt` = `{"anlass", "ziel", "ts", "nodeReset"}`; die Brücke sichert, prüft, legt `data/backup-ok.txt` mit `ts` per `pushFile` ab. Das Skript wartet auf `ok.ts > bitte.ts`, höchstens 10 min, dann handelt es trotzdem und protokolliert "ohne Backup" - Autonomie schlägt Vollständigkeit, die Stundensicherung ist der Boden. `boot.js` löscht beide Dateien nach dem Wechsel (Räumliste `boot.js:104-108` ergänzen).

## 7.4 Wiederherstellung

Nur lokal automatisiert (6.2). Live-Restore ausschließlich Eric von Hand, nur im Katastrophenfall: alle anderen Tabs zu, Recovery-Download `RECOVERY_BITBURNER_*.json.gz` (`RecoveryRoot.tsx:37-51`) aufheben, `LIVE_`-Datei mit Port 12525 importieren, danach `bridge.log` "Spiel verbunden" und `node tools/save.js` gegen die Backup-Kennwerte. Nie eine `TEST_`-Datei auf Live.

## 7.5 Nie automatisiert, nie von Claude

Import auf Live; "Delete Save"; Soft-Reset-Knopf; `b1tflum3`; BitVerse-Knopf von Hand (`bitverse.js` als veraltet markieren); Remote-API-Einstellungen im Live-UI; Site-Daten löschen; zweiter Tab oder zweite Instanz mit Port 12525; Werkzeuge ohne `--test` gegen eine Testinstanz; IndexedDB-Schreiben am Live-Spiel; Claude-Browser-Werkzeuge (Chrome-Pane, Claude in Chrome, Opera-MCP) auf `bitburner-official.github.io`.

# 8. Vorgehen der Bau-Sitzung (Phasen, je mit Workflow)

Reihenfolge ist Rangfolge; Phase 0 vor allem anderen. Jede Phase endet mit einer Befundliste (UMGESETZT / VERWORFEN mit Begründung / OFFEN - OFFEN wird nie durch Stillschweigen ersetzt, Memory befunde-abhaken) und Commits mit `[skeptiker]`.

- **Phase 0 - Sicherung (sofort, sequenziell, Fable)**: Backup-Funktion + `backup-check.js` + Starter `bridge-start.cmd` in die Brücke; erstes `LIVE_`-Backup ziehen und prüfen; Wachhund und Port-Lock; Brücke live neu starten (das Spiel reconnectet binnen 5 s, Livebeleg 03.09. 15:28:32 -> 15:28:35). Skeptiker-Lauf nur auf diese Änderung. Danach erst Phase 1.
- **Phase 1 - Bestand (parallel, Opus/Sonnet lesen, Fable synthetisiert)**: `nodes/AUDIT-AUTONOMIE-2026-09-02.md` mit `nodes/audit-2026-09-02/*`, `nodes/BAUSTELLEN.md` (ENTSCHIEDEN + `## Sofort`), `nodes/ROUTE.md`, `doku/*.md`, `skills/bb.md`, `src/bn4net.js` vollständig (3273 Zeilen - Werkzeug Read schneidet bei 2000 ab, in Abschnitten lesen), `src/blade.js`, `src/bn4rep.js`, `sync/bridge.js`. Messungen: RAM aller `src/`-Dateien per `calculateRam` (drei Widersprüche: bn4net 16,25/17,75/19,65; blade 94,85/27,6/"174" unbelegt; exit 519,25 gerechnet); Autoexec und Autostart-Ordner nachprüfen; Live-Zustand per `node tools/checkin.js` und `node tools/save.js`.
- **Phase 2 - Architektur mit Judge-Panel (Fable)**: drei unabhängige Entwürfe (Angriffswinkel: minimaler Umbau des Bestands / Neubau um Registry+Wächter mit Portierung / RAM-und-Kaltstart-getrieben), je mit Modulliste, Kontrakten aus 4.5, RAM-Tabelle 4.8, Testmatrix-Zuordnung; ein Judge-Agent bewertet gegen Abschnitt 3 und 5 und gegen "was fehlt gegenüber dem Bestwert", nicht "ist es korrekt"; Synthese legt je Modul fest: unverändert / zerlegt / neu (4.9). Ergebnis in `nodes/ARCHITEKTUR-<datum>.md`, committet, bevor gebaut wird.
- **Phase 3 - Prüfstand (parallel, Opus/Sonnet mechanisch, Fable prüft)**: v3.0.1 prod+dev bauen, `serve.js` umstellen, Chrome/Edge-Profil, zweite Brücke, Klon mit gepatchtem Port, ns-Mock, Budget-Test, Formel-Eichungen aus 6.4 als `tools/test-formeln.js`.
- **Phase 4 - Bau in Gewerken (parallel je Modul, Kontrakte zuerst)**: erst `registry.json`, Telemetrie-Schema, `strafen.json`-Format und `figur.txt`-Protokoll festschreiben, dann Module parallel: Kern (Fable), Wächter/Strafleiter (Fable), Brücke (Opus), Registry-Starter/Stillstand (Opus), Grafting-Automatik (Fable), Einbau-Zerlegung (Opus), Wakelock-Worker (Opus, mit `atExit`), `boerse.js` (Fable, eigene Abnahme, kann nach der Live-Einspielung folgen). Jedes Modul: Ebene-0/1/2-Tests grün -> drei Skeptiker (Prämisse / Alltagsbetrieb nach zwei Wochen / Substanz der Zahlen) -> Synthese -> Commit `[skeptiker]`.
- **Phase 5 - Prüfstand-Läufe**: Testmatrix 6.5, Pflichtzellen zuerst; jede Zelle mit Protokoll unter `pruefstand/data/`; Fehlbefunde zurück in Phase 4.
- **Phase 6 - Skeptiker-Runden auf das Ganze**: drei Winkel plus ein vierter "Was lässt das System liegen?" gegen die Kennzahlen aus 3; ein fünfter ausschließlich auf Abschnitt 7 (jeder Weg, auf dem die Bausitzung selbst den Live-Stand gefährden könnte). Bei einem klaren Veto gegen den riskantesten Schritt mindestens ein zweiter Prüfer genau auf diese Frage (Memory autonomer-lauf-absichern).
- **Phase 7 - Hot-Swap live** (Abschnitt 9).
- **Phase 8 - Beobachtung 12 h** (Abschnitt 10, Warten nach Abschnitt 13).
- **Phase 9 - Sprung** BN10 L2 -> L3 autonom, Kaltstart 32 GB mit Faktor 16 beobachtet, danach Abnahme, Doku, Memory (Abschnitt 11).

Rechnen heißt rechnen: keine Zahl aus dem Kopf; jede Formel als Code mit Eichwert (6.4); jede Messung mit den drei Fragen (Welche Uhr? Stillstand/Nachholen? Rate oder Bestand?). Warnende Kommentare lesen, bevor die Zeile darunter geändert wird.

# 9. Live-Einspielung und Rollback

Vorbedingungen (alle, sonst nicht):
1. `curl 127.0.0.1:8795/api/state` -> `connected: true`, `instanz: LIVE`; `node tools/save.js` -> identifier `197f4d61481686`, erwarteter Knoten/Lauf.
2. Frisches `LIVE_..._vor-hotswap`-Backup, `backup-check` grün, Name im Protokoll.
3. `data/ausgang.json`: `offen: false`, kein `exit.js`-Prozess; kein Einbau in den nächsten 30 min (Einbau-Modul-Telemetrie); nie während Sprung oder Einbau swappen.
4. `git status` sauber, Commit-Hash der laufenden Fassung notiert; Kanarienvogel auf der TEST-Instanz mit Klon derselben Stunde grün.
5. Systemzeit per `date`, Eric nicht am Tab (`visibilityState`/`hasFocus` aus dem Wächter) - oder Eric weiß Bescheid.

Reihenfolge und Mechanik:
- Zuerst die Brücke (Außenprozess, Neustart berührt das Spiel nicht; Reconnect 5 s). Dann `registry.json`, `route.json`, `boot.js` (läuft nur beim Reset; vorher Prüfstand-Zelle "Einbau -> boot" grün). Dann Werkzeuge von unten nach oben; Kern und Wächter NIE im selben Schritt (sie bewachen sich gegenseitig).
- Schreiben nach `src/` -> die Brücke schiebt 400 ms später, Bestätigung ist die Zeile "nachgeschoben" in `data/bridge.log`. Neuer Code erreicht ein laufendes Skript nie (`bn4net.js:421-427`): je Werkzeug `data/reload.txt` = `WERKZEUG <name>.js` (MIT Endung), für den Kern `SELBST bn4net.js` bzw. den neuen Kernnamen; Wächter/Popups holen den Kern zurück. Jedes Skript schreibt `version` in seine Telemetrie; der Swap gilt erst, wenn die neue Version innerhalb 2 x Takt in der Telemetrie steht. Werkzeug für alles: `node tools/hotswap.js <dateien> [--test]`.
- Kein Stub außerhalb des Repos (02.09. 06:01: `sleeve-stub.js` als `sleeve.js` geschoben, die Brücke schob beim nächsten Sync das Original zurück). Fixes nur im Repo.
- Danach 10 min Kern-Telemetrie beobachten (`zeit` läuft, Runden steigen, keine Sprosse >= 1 ohne Ursache), dann Commit mit `[skeptiker]` und Push.

Rollback (des Bots, nie des Spielstands):
1. `git checkout <hash> -- src/` (kein `--force`, keine History).
2. Die Brücke schiebt geänderte Dateien selbst; gelöschte Dateien bleiben im Spiel liegen (nur `pushFile`) -> per `/api/rpc?method=deleteFile` entfernen.
3. `reload.txt` je betroffenem Werkzeug; Erfolg = alte Version in der Telemetrie und `zeit` läuft.
4. Commit "Rollback auf <hash>, Grund, Messung".

# 10. Abnahme (gestaffelt)

Stufe A - Tests und Skeptiker grün: alle Ebene-0/1/2-Tests Exit 0; Pflichtzellen der Matrix grün mit Protokoll; RAM-Budget 4.8 belegt; fünf Skeptiker ohne offenes KRITISCH; Befundliste ohne stilles OFFEN; Backups stündlich vorhanden und geprüft; `bridge-start.cmd` im Autostart-Ordner, Brücke überlebt `taskkill` auf ihren Prozess (Starter startet neu, Spiel reconnectet).

Stufe B - 12 h Live ohne Eingriff: alle Registry-Werkzeuge mit Herzschlag unter Frischegrenze über 12 h Motorzeit; `strafen.json` enthält nur Sprossen 0/1 mit nachvollziehbarer Ursache, keine Fehlstrafe in einer Offline- oder Drosselungsphase; `geld_min` 0 Minuten negativ; Träger-Kennzahl im Soll (BN10 L2: `T2` gegen Referenz / 0,8, `chance_naechste_blackop` >= 0,35); Post-mortem-Spiegel lückenlos; kein menschlicher Handgriff. Wartezeit nach Abschnitt 13.

Stufe C - ein beobachteter autonomer Sprung BN10 L2 -> L3 mit Kaltstart: `t_sprunglatenz` <= 2 Takte, `wirtFehlt` = 0, Backup `vor-sprung` vorhanden, `t_boot` < 5 min, Kern + ausgang + Wächter + Wakelock-Worker auf 32 GB, `verfahren.txt` `V2 10 3` in der ersten Runde, `t_werkbank` unter 2 x Bestwert (Knotenpreis 8,8 Mio zu Faktor 1,0), Sleeve-Verbrechen laufen, kein Konto < 0, Registry vollständig nach dem ersten Mietrechner, Bladeburner-Beitritt bei 4 x 100 ohne Einbau davor. Der Sprung kann Tage entfernt sein (`node tools/checkin.js` liefert die Schätzung, nur innerhalb desselben Laufs); warten nach 13. Fällt Stufe C durch, gilt der Bot nicht als fertig - Ursache, Fix, erneut Stufe A für das Modul.

# 11. Berichte, Commits, Pushes, Dokumentation

- Commit je abgeschlossener Sache, Text sagt warum und was gemessen wurde, `[skeptiker]` nach Skeptiker-Lauf; `git add <pfad>`; nicht-triviales sofort pushen; `git pull --rebase` vor dem Push. Bei "Invalid username or token": Eric die Befehle geben (`cmdkey /delete:LegacyGeneric:target=git:https://github.com`, dann Push), nicht selbst an Zugangsdaten arbeiten.
- `nodes/BAUSTELLEN.md` nur über `node tools/liste.js` (Eintrag aus Datei mit `### `-Erstzeile); Erledigtes nach `nodes/ERLEDIGT.md` (dort grepen, nicht lesen); Architektur nach `nodes/ARCHITEKTUR-<datum>.md`; Prüfstand-Anleitung nach `doku/pruefstand.md`; Schutzprotokoll nach `doku/spielstand-schutz.md`; Strafleiter nach `doku/strafleiter.md`.
- Memory-Nachträge in `C:\Users\erche\.claude\projects\C--Users-erche-Desktop-claude-projecto\memory\`: `bitburner.md` (neue Bauform, Ports, Starter), `bitburner-werkzeuge.md` (hotswap, backup-check, `--test`), neue Datei `bitburner-strafleiter.md`, Index `MEMORY.md` ergänzen. Kurz, mit Datum und Fundstelle.
- `/bb`-Skill anpassen: erst `skills/bb.md` im Repo, dann Kopie nach `C:\Users\erche\Desktop\claude_projecto\.claude\skills\bb\SKILL.md`; `tools/checkin.js` liest die neuen Telemetriedateien, meldet Sprossen aus `strafen.json`, Backup-Alter, Brücken-Heartbeat; letzte Zeile bleibt die Fertig-Schätzung (Eric 31.08.: "am Ende vom /bb soll die aktuelle Schätzung kommen").
- Berichtsstil: knapp, Stichpunkte, keine Vorrede; im autonomen Modus nur zur vollen Stunde (Bilanz + Ziele der nächsten 60 min), sonst schweigen; Systemzeit aus `date`; Eric duzen.

# 12. Was NICHT getan wird

- `b1tflum3`, Destroy-Knopf, BitVerse-Knopf, Soft-Reset-Knopf von Hand; zweiter Tab oder zweite Instanz auf `bitburner-official.github.io`; Import/Delete/IndexedDB-Schreiben am Live-Spiel; Remote-API-Einstellungen im Live-UI.
- Route ändern; ENTSCHIEDEN-Einträge ohne neue Messung aufmachen; Handsprung per `tools/task.js exit.js`.
- `tools/aufsicht.js`, `tools/wache.js`, `nightshift/*`, `/bb-loops` starten; irgendein Claude-Loop als Betriebsbestandteil; ntfy/Push; Wächter, der Freigaben will.
- Opera von außen per CDP/MCP im laufenden Betrieb; `Suppress faction invites`; eval-Exploit; Gang- und Corporation-Gewerke; Stanek/Go ohne Messung; Electron/Browser-Umzug ohne Erics Handgriff (nur Vorlage).
- Massen-Rename bestehender Dateien; Zerlegung in Einzelaufruf-Singularity-Skripte (33,6 GB Minimum bei SF4.1); Hacknet-Server als Wirt; Stubs außerhalb des Repos; Kommentar-Zahlen ungeprüft übernehmen.
- `git add -A`, `--force`, History-Rewrite; Hintergrund-Bash ohne harte Grenze; `Monitor persistent: true`; Warteschleifen `until <bedingung>`.

# 13. Budget, Modelle und Loops

- Kontingent (Eric 03.09. 15:25): "optimiere das auch gern mit Loop etc. Du darfst mindestens das gesamte Fable-Wochenlimit ausnutzen und dann auch von Opus 5 das weekly Limit!" Abo Max 20x. Stand 15:25: Fable-Wochenlimit 44 % verbraucht, alle Modelle 25 %, Zurücksetzung Sonntag 13:00 (Systemzeit prüfen: 07.09.2026). Plane die Phasen dagegen: Phasen 0-4 vor Sonntag mit Fable-Schwerpunkt; Warte- und Beobachtungsphasen (B, C) kosten kein Kontingent, nur die Check-ins.
- Modellwahl je Agent im Workflow: Fable für Architektur, Judge, Skeptiker, Eichung von Formeln, Synthese, Kern und Wächter; Opus/Sonnet für mechanische Stufen (Lesen und Exzerpieren, Build, Mock-Boilerplate, Brücken-Umbau nach Spezifikation, Testmatrix-Durchläufe, Doku-Übertrag). Ist das Fable-Limit erschöpft, wechseln auch Prüferrollen auf Opus - aber ein Skeptiker-Lauf entfällt nie.
- Wartephasen (12 h Live, Warten auf den Sprung) über `/loop` bzw. ScheduleWakeup mit großen Abständen (Stufe B: alle 2 h ein `node tools/checkin.js` + `strafen.json`-Blick; Stufe C: alle 4-6 h, dazu die ETA aus checkin). Nie als hängender Hintergrundtask, nie als persistenter Monitor - ein schwebender Task blockiert alle Cron-Jobs der Sitzung, verpasste Feuerungen verfallen (Falle 26.08.2026, 03:02-05:10). `timeout` gilt für Hintergrund-Bash nicht. Vor jedem Turn-Ende prüfen, ob ein Task zurückbleibt (`Get-CimInstance Win32_Process -Filter "Name='bash.exe'"`).
- Keine Push-Nachrichten. Befunde in den Chat, wenn Eric da ist, sonst in `nodes/BAUSTELLEN.md` `## Sofort` per `tools/liste.js`.
- CPU: webpack-Builds und der Testbrowser auf 4 Kerne, Idle-Priorität. Live-Spiel und Live-Brücke nicht drosseln.
- Abbruchkriterium einer Phase: die Befundliste hat kein OFFEN ohne Begründung, die Tests der Phase sind grün, der Commit trägt `[skeptiker]`. Abbruchkriterium der Sitzung: Stufe C bestanden, Doku und Memory nachgetragen, `/bb` angepasst - oder das Kontingent ist erschöpft; dann steht der Stand committet, gepusht und in `nodes/BAUSTELLEN.md` beschrieben, sodass die nächste Sitzung ohne diese Unterhaltung weitermachen kann.