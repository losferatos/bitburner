ultracode — Baue für Eric den perfekten Bitburner-Bot: ein Bot, der alle 15 BitNodes auf Stufe 3 (45 Läufe, 40 davon offen) in der festen Reihenfolge aus `src/route.json` ohne einen einzigen menschlichen Handgriff durchläuft und dabei jede Phase jedes Knotens gegen den rechnerischen Bestwert misst — durch Portierung des Bewährten in eine neue, geprüfte Bauform, mit eigenem Prüfstand, ohne den Live-Spielstand je zu gefährden.

# 0. Auftrag und Schlüsselwort

Du arbeitest im Modus **ultracode** (Multi-Agent-Orchestrierung über Workflows, keine Kostengrenze). Auftraggeber ist Eric (Du-Form). Sein Auftrag vom 03.09.2026, 15:21, wörtlich: „den PERFEKTEN Bitburner Bot bauen - maximal autonom UND maximal effizient, keine Token-Limits, Subagents/Kritiker/Tests/alles nutzen; drakonischste Strafen fuer Haenger (Worst Case)". Seine Antworten auf die Rückfragen:

1. Neubau mit Portierung des Bewährten ODER den vorhandenen Bot dorthin bringen — „Ziel ist der perfekte Bot, die Bauform ist Mittel."
2. Härteste Selbstmaßnahme des Bots: Stufenleiter bis zum Soft-Reset (Augmentierungen installieren). „KEIN b1tflum3, kein Destroy-Knopf von Hand, nie ein zweiter Tab auf bitburner-official.github.io."
3. Testen: „ALLES erlaubt (lokale Spielinstanz, Mocks, Hot-Swap live), ABER: mein savegame darf nicht zerstoert werden. Das ist extrem wichtig - das ist die live file!"
4. Abnahme gestaffelt: Tests+Skeptiker grün → 12 h Live ohne Eingriff → ein autonom beobachteter BitNode-Sprung inklusive Kaltstart danach.
5. Budget (15:25): „optimiere das auch gern mit Loop etc. Du darfst mindestens das gesamte Fable-Wochenlimit ausnutzen und dann auch von Opus 5 das weekly Limit!"

Das Endprodukt ist der laufende Bot im Live-Spiel, committet und gepusht, plus Dokumentation. Diese Sitzung kennt Erics globale CLAUDE.md, aber nichts aus der Vorbereitung — alles Projektspezifische steht hier. Vor jedem Zeitstempel `date` abfragen (CLAUDE.md, Falle 23.08.2026: erfundene Zeitstempel bei Stundenberichten).

# 1. Lage und Bestand

## 1.1 Orte, Ports, Prozesse

- Projekt: `C:\Users\erche\Desktop\claude_projecto\bitburner` (privates Repo `github.com/losferatos/bitburner`, `git remote -v` zeigt es). `reference/`, `node_modules/`, `backups/` und ganz `data/` sind in `.gitignore`; `git add -A` ist in diesem Repo verboten (`.gitignore`-Kommentar, Grund: mehrere Schreiber in `data/`).
- Spiel: Bitburner v3.0.1 Webversion unter `https://bitburner-official.github.io/` in Erics **Opera**-Tab. Skripte laufen im Browser; das Spiel ist WebSocket-**Client** der Brücke (`reference/v301/src/RemoteFileAPI/Remote.ts:40-46`), verbindet 2 s nach Laden (`index.tsx:37`) und reconnectet alle 5 s (Livestand `RemoteFileApiReconnectionDelay 5`; Default 0 = nie, `Settings.ts:49`).
- Brücke: `sync/bridge.js` (438 Zeilen, seit 19.08. unverändert). RFA-Port **12525**, Dashboard/RPC **8795**, beide nur 127.0.0.1 (`bridge.js:27-28`). `fs.watch` auf `src/`, 400 ms entprellt, schiebt jede Änderung als `server:"home"` ins Spiel (`bridge.js:135-222`); beim Verbinden `pushAll()` aller Dateien (`:421-422`). Elf RFA-Methoden, **kein run/exec/kill** (`RemoteFileAPI/MessageHandlers.ts:89-254`); Skripte startet nur ein laufendes Skript, das `data/task.txt` liest. `/api/rpc?method=<name>&<params>` reicht jede Methode durch (`bridge.js:338-358`), darunter `calculateRam` und `getSaveFile` (lesend).
- **Befund 03.09.2026:** Die Brücke ist der einzige Prozess außerhalb des Spiels und war an diesem Tag zweimal tot (Spiel zeigte „Error with websocket ws://localhost:12525"); seit der Windows-Autostart-Eintrag `Bitburner-Aufsicht.cmd` am 02.09. entfernt wurde, hat sie keinen Starter. Sie hat keinen PID-Lock, keine `uncaughtException`-Behandlung, `EADDRINUSE` wird nur geloggt (`bridge.js:425`). Sie läuft seit 15:28:32 wieder (Spiel verbunden 15:28:35, `data/bridge.log`).
- Live-Spielstand (gemessen 03.09. 16:34 per `getSaveFile`): `identifier 197f4d61481686`, **BitNode 10, Lauf 2**, Source-Files {1:1, 4:1, 5:1, 6:1, 10:1}, 48,6 h im Knoten, Hacking 231, 15 Augs installiert, 2 Sleeves, `AutosaveInterval 60`, `AutoexecScript "boot.js"`, `RemoteFileApiPort 12525`. Park 15/15 Mietrechner (größter 512 GB), home 1024 GB (`nodes/BAUSTELLEN.md`, Stand 02.09. 18:02).
- **Einziges Backup:** `backups/save-2026-08-28-0740-vor-exploits.json.gz` — aus BN6, 6 Tage alt. Der gesamte BN10-Fortschritt hat kein Backup. Kein Werkzeug sichert (`tools/save.js:36-43` liest nur).
- Prüfstand: `pruefstand/serve.js` (Port 8799, eigene Origin = eigene IndexedDB, `serve.js:7-19`) serviert derzeit den **dev-Build von `reference/bitburner-src`** — das ist ein 3.0.2-dev-Snapshot (Commit 79e5cd8, `package.json:4`), nicht das Release. `reference/v301` ist der Tag v3.0.1 (Commit 3162fd2) und die einzige gültige Referenz (Memory: „dev und v3.0.1 unterscheiden sich in 249 Dateien"). `VersionNumber 51` steht in beiden Bäumen — Spielstände sind formatkompatibel, ein Fehlimport wäre unsichtbar.
- Skills: aktiv unter `C:\Users\erche\Desktop\claude_projecto\.claude\skills\{bb,bitburner,bb-loops}\SKILL.md`, versionierte Kopie `bitburner/skills/bb.md`; Regel: „erst die Datei ändern, dann von hier nach `.claude/skills/` kopieren — nie umgekehrt" (`skills/README.md`). Alte Scheduled Tasks liegen unter `C:\Users\erche\.claude\scheduled-tasks\{bitburner-wache,bitburner-formel-inventur}\` — prüfe mit dem Scheduled-Tasks-Werkzeug, dass keiner aktiv ist; beide stammen aus der abgeschafften Betriebsart (31.08.2026).
- Memory: `C:\Users\erche\.claude\projects\C--Users-erche-Desktop-claude-projecto\memory\` (Index `MEMORY.md`, Dateien `bitburner*.md`).
- Arbeitsliste: `nodes/BAUSTELLEN.md` — **nur mit `node tools/liste.js` bearbeiten** (Abschnitte `## ENTSCHIEDEN` Z. 8, `## Sofort` Z. 119, `## Offen` Z. 587, `## Erledigt` Z. 1981); Textsuche nach `## Sofort` trifft den Regelkopf und hat die Datei am 28.08.2026 zweimal zerlegt.

## 1.2 Was im Spiel läuft (`src/`, 106 Dateien + `lib/` 3 + `worker/` 5)

Bewertung: BEWÄHRT = ≥ 1 Woche Dauerbetrieb und skeptisch geprüft; FRAGIL = jung oder lückenhaft; TOT = BN1-Ära oder Einmalwerkzeug.

| Skript | Rolle | RAM (GB, wie belegt) | Bewertung |
|---|---|---|---|
| `bn4net.js` (3273 Z., 47 Commits) | Motor: rootet, HWGW + offene Mischung, kauft/baut Mietrechner, startet/überwacht die Werkzeugliste `WERKZEUGE` (`bn4net.js:257-347`), schreibt `data/bn4net.json` | 16,25 gemessen BN10 (`:218`) vs. 17,75 (BAUSTELLEN) — **Widerspruch, messen** | Kern BEWÄHRT; Blöcke vom 02.09. (A1-Regel, Stillstand, Kaltstart-Faktor 1,0) FRAGIL |
| `boot.js` (171 Z.) | Rückruf nach `destroyW0r1dD43m0n`/`installAugmentations`, räumt knotengebundene Dateien (`boot.js:77-81, 104-108`), seit 02.09. endlos | 4,0 geeicht | BEWÄHRT (Sprung 01.09. 15:59 lief darüber) |
| `ausgang.js` (363 Z.) | Einziger Entscheider über den Sprung: `route.json` + `getResetInfo`, schreibt `data/verfahren.txt`, prüft beide Türen, startet `exit.js` auf dem Wirt mit Platz | 8,15 gemessen (`ausgang.js:14`) | FRAGIL: nie ein Live-Sprung darüber; `planeRoute` rein, `tools/test-route.js` grün über 39 Sprünge |
| `exit.js` (142 Z.) | `destroyW0r1dD43m0n(ziel, "boot.js")` (`exit.js:90, 141`), prüft nur 1–15 (`:44-47`) | 519,25 mit SF4.1 **gerechnet**, 39,25 mit SF4.3 (`nodes/audit-2026-09-02/uebergaenge.md:92-95`) | BEWÄHRT als Weg, RAM nie im Spiel gemessen |
| `blade.js` (3488 Z., 92 Commits) | Bladeburner-Motor: Aktion nach `spanne().min`, Black-Op-Schwelle 0,35 (`blade.js:392`), Skillplan, Graft-Riegel (`:2994`), Gym-Rückfall, Knotenfaktor seit 02.09. (`:596-603`) | 162,25 gemessen (`nodes/ERLEDIGT.md:2515`), 94,85 ab SF4.3 | BEWÄHRT (trägt BN6/BN10), auf BN6/10 kalibriert; SkillCost 2/3 nie simuliert |
| `bbtrain.js` (337 Z.) | Kampfwerte auf 100, Divisionsbeitritt, wartet danach | ~40 BN4, 94,75 außerhalb | BEWÄHRT |
| `sleeve.js` (395 Z.) | Sleeves: Kontrakte/Infiltrate/Gym, Geldboden seit 02.09. | 14,75 gemessen | FRAGIL (Vorfall 02.09. 06:00: Konto −18,5 Mio) |
| `sleevecrime.js` (66 Z.) | Kaltstart-Verbrechen der Sleeves | 5,7 | FRAGIL (Marker landet nicht auf home) |
| `hashes.js` (76 Z.), `hacknet.js` (125 Z.) | BN9-Gewerk: Hashes verkaufen / bei Konto > 1 Mrd in Rang tauschen; Hacknet-Server als exit-Wirt | ~5 / ~9 | FRAGIL (nie in BN9 gelaufen) |
| `bn4life.js` (437 Z.) | Die eine Instanz an der Figur: Verbrechen, TOR/Portprogramme, Einladungen, Auftragsleser `data/task.txt` (1 s) | 22,8 BN4, **293,8 außerhalb** | BEWÄHRT in BN4, sonst RAM-Gefangener |
| `bn4rep.js` (1939 Z., 60 Commits) | Rep/Augs: Faktions-/Firmenarbeit, Kauf teuerste zuerst, Einbau ab 3 wartenden (`bn4rep.js:296`), `installAugmentations("boot.js")` (`:1169`) | 768 BN6, **846,8 außerhalb BN4**, 60,75 ab SF4.3 | Logik BEWÄHRT, Betrieb FRAGIL (26 h Stillstand in BN10 L2, behoben `1302cd6`) |
| `homegrow.js`, `bn4door.js`, `contracts.js` (30 Löser, 17,65 GB, `contracts.js:14`), `popups.js` (1,6 GB, Escape/Einladung/Continue + Wache über bn4net), `darkweb.js` (TOR/Ports per DOM-String-Trick, 27,65 GB), `wakelock.js` (Tonanker, 34,25 GB, DOM), `worker/{hack,grow,weaken,share}.js` (1,75–4,0 GB, absoluter Landetermin, Selbstmessung), `graft.js` (ein Graft je Aufruf, Treiber `tools/graftnext.js` liegt AUSSEN) | — | siehe RAM | BEWÄHRT; wakelock als Bauform FRAGIL |
| `lib/hackaugs.js` | Tabelle Hacking-Augs, wird mitkopiert (`bn4net.js:348`) | 0 | BEWÄHRT |
| `lib/calc.js`, `lib/batch.js`, `autopilot.js`, `stocks.js`/`stockaccess.js`, `hand.js`, `telemetry.js`, `keepalive.js`, `install.js`, `buyaugs.js`, `travel.js`, `homeram.js`, `join*.js`, `nightshift/*`, `archiv/entwurf/*`, ~60 Einmal-/Diagnosewerkzeuge (`astufe`…`werkbank`) | BN1-Ära / DOM ohne SF4 / Diagnose | — | TOT; `stocks.js` ist die einzige Börsenlogik im Repo (verlangt 4S, nur long) |

Außen: `tools/task.js` (schreibt `data/task.txt`), `tools/save.js` (dekodiert `getSaveFile`: latin1 → gunzip → JSON), `tools/checkin.js` (Urteil für `/bb`), `tools/test-route.js`, `tools/test-stillstandsuhr.js`, `tools/liste.js`, `tools/rueckstand.js` (storedCycles-Messreihe), `tools/aufsicht.js`/`tools/wache.js` (**nicht starten**, s. 2). Doku: `doku/formeln-{hacking,progression,wirtschaft,boerse}.md`, `doku/schlupfloecher.md`, `doku/drosselung.md`, `doku/reset-plan.md`, `doku/rfa-protokoll.md`, `doku/api-aenderungen-v3.md`; Audits: `nodes/AUDIT-AUTONOMIE-2026-09-02.md` (+ `nodes/audit-2026-09-02/*.md`), `nodes/AUDIT-ROADMAP-2026-08-24.md`, `nodes/ROUTE.md`, `nodes/KURS.md`, `nodes/HEBEL.md`, `nodes/GRAFTING.md`, `nodes/GRAFTPLAN.md`; Loop-Prompts (abgeschafft, aber als Skeptiker-Vorlage brauchbar): `loops/loop-skeptiker.md`.

## 1.3 Belegte Lücken (Audit 02.09. + Befunde 03.09.)

1. Kein Prozess-Supervisor außen; Brücke ohne Starter, ohne Lock, ohne Backup-Funktion.
2. Kein Figur-Vergabepunkt: bbtrain, joinrun, bn4life, blade, graft, bn4rep greifen mit Dateiabsprachen nach derselben Figur (Audit C.14; Ping-Pong 02.09.).
3. Stillstandserkennung deckt 5 von 14 Werkzeugen (`bn4net.js:61-67, 2713-2739`); Logs überschreiben mit `"w"` (200 Zeilen) — Post-mortem unmöglich (Audit C.16; der Brückentod vom 03.09. ist deshalb nicht rekonstruierbar).
4. Kaltstart auf 32 GB: `contracts.js` passt um 1,9 GB nicht neben bn4net (`nodes/audit-2026-09-02/praemisse.md:128-129`), Wakelock (34 GB) gar nicht → Tab gedrosselt; BN10 stand 13,5 h ohne Werkbank (Audit B.9).
5. RAM-Faktor 16 außerhalb BN4 mit SF4.1 (`RamCostGenerator.ts:82-96`; Fn1/2/3 = 2/3/5 GB Basis, `:55-57`) — betrifft noch den Ausgang aus BN10 L2 und den kompletten Lauf BN10 L3; ab BN4 L2 (Route-Position 3) in BN4 ×1, ab SF4.3 (nach Position 4) überall ×1.
6. Fehlende Gewerke: BN8 (`boerse.js`, Route-Pflicht), BN15 (Labyrinth, null Zeilen; Route fährt V2 mit Faktor 0,2), BN9 nur theoretisch, Grafting nicht autonom (Treiber außen), Stanek/Go nicht vorhanden.
7. Zeitmessung: `totalPlaytime` schreibt Offline-Zeit voll gut (`engine.tsx:344-350`); Raten wurden aus Nachholbeständen gebildet (Audit F).
8. Kein Testgeschirr für Spiellogik außer `test-route.js` und `test-stillstandsuhr.js`.
9. Drei RAM-Zahlen widersprüchlich/unbelegt: bn4net (16,25/17,75), blade (162,25/94,85/27,6 je nach Quelle), exit.js (nur gerechnet) — mit `calculateRam` über RFA messen, bevor irgendetwas geplant wird.

# 2. Unverhandelbare Regeln (wörtlich)

- **Spielstand:** „mein savegame darf nicht zerstoert werden. Das ist extrem wichtig - das ist die live file!" (Eric, 03.09.2026). ENTSCHIEDEN (`nodes/BAUSTELLEN.md`, 29.08.): „EditSaveFile im laufenden Spiel | nein". Kein Import auf Live, kein IndexedDB-Schreiben, kein „Delete Save", kein Löschen von Site-Daten.
- **Ausgang:** „KEIN b1tflum3, kein Destroy-Knopf von Hand, nie ein zweiter Tab auf bitburner-official.github.io." (Eric, 03.09.). Kein `node tools/task.js exit.js <ziel>` von Hand — „das war der Weg bis zum 01.09. und ist es nicht mehr" (`skills/bb.md`). Auch keine zweite Instanz irgendwo, die Port 12525 anwählt.
- **Route:** „Die Route ändert niemand auf Zuruf." (`skills/bb.md`). `src/route.json` (Kopf: „die Reihenfolge steht fest und wird von niemandem geaendert"), Änderungen nur mit grünem `node tools/test-route.js`. Ziel: „Level 3 ueberall = 45 Laeufe" (Memory `bitburner-roadmap.md`).
- **ENTSCHIEDEN-Liste ist Sperrliste:** „Wer etwas aendern will, das hier steht, braucht eine neue Messung oder eine neue Fundstelle - nicht ein neues Argument." (`BAUSTELLEN.md:10-12`). Darin u. a.: Black-Op-Feuerschwelle 0,35; Einbau vor Divisionsbeitritt nie; Beitritt sofort bei Kampfwert 100; Ausgang aus BN10 nur Bladeburner; Kampfknoten-Bedingung nie als Zahl im Code.
- **Claude entscheidet:** „DU kennst den gesamten source (bzw die loops), nicht ich. Daher will und werde ich bei Bitburner nahezu keine Entscheidungen mehr treffen." (Eric, 29.08.). „Belegte Erkenntnis = umsetzen, nachmessen, bei Nichtwirkung zuruecknehmen. Keine Frage, keine Empfehlung, kein ‚soll ich'." Vorgelegt wird nur, was außerhalb des Spiels liegt (Geld, Zugangsdaten, sein Rechner, sein Browser). „‚Wartet bis Eric' ist kein Ablageort fuer unbequeme Entscheidungen" (26.08.). „Eine Frage von Eric ist kein Auftrag."
- **Keine KI-Loops im Betrieb:** „ich will nicht permanent KI laufen lassen, das ist mir auch zu teuer." (31.08.). Das heutige Bau-Budget gilt für den **Bau**; der fertige Bot läuft ohne Claude.
- **Keine Push-Nachrichten:** „ich will gar keine nfy Nachrichten mehr bekommen." (31.08.). `~/.claude/notify-aus` bleibt liegen. Meldungen in den Chat oder nach `nodes/BAUSTELLEN.md` `## Sofort`.
- **Keine Wache, die Freigaben will** (Eric, 24.08.: „Staendig wollte die irgendwelche Freigaben, ohne mir Kontext zu geben"): nur lesen, bei Ruhe schweigen.
- **`tools/aufsicht.js` und `tools/wache.js` nicht starten** — sie starten Werkzeuge doppelt, die der Motor binnen 10 s erschlägt (Audit C.12/13, 17 wirkungslose wakelock-Neustarts in 4 h am 02.09.).
- **Kein Browserzugriff von außen im Betrieb** (Opera/CDP löst Freigabeabfragen aus, `.claude/skills/bitburner/SKILL.md:37`); der Weg ins Spiel ist `data/task.txt`/`data/reload.txt` über die Brücke.
- **`Suppress faction invites` nie einschalten** (Memory `bitburner-oberflaeche.md`: einziger Beitrittsweg ohne Maus). **eval-Exploit bleibt draußen** (Memory `bitburner-werkzeuge.md`).
- **Referenz ist Tag v3.0.1** (`reference/v301`), nie `reference/bitburner-src`; und `reference/` ist nicht das laufende Spiel — drei belegte Abweichungen (`BAUSTELLEN.md:589`): im Zweifel im Spiel messen.
- **Eric will im Spiel-Tab zusehen können** (Memory `bitburner.md`) — kein reines Außen-Dashboard.
- **Commits:** „Existiert ein Repo, wird JEDE Aenderung committet." „Nur geprüft pushen … Ein Commit je abgeschlossener Sache … Nie `--force`." `git add <pfad>`, nie `git add -A`; vor Push `git pull --rebase`. Für `src/bn4net.js` und `src/boot.js` gilt „jede Aenderung einzeln zu committen" (`BAUSTELLEN.md`).
- **Skeptiker-Pflicht:** „Ausloeser ist nicht die Groesse der Aenderung, sondern die Frage: Laeuft der geaenderte Code weiter, wenn niemand hinsieht?" Mehrere Skeptiker mit getrennten Winkeln (Prämisse / Fehlermodi im Alltag / Substanz), „Bestaetigung ist wertlos. Gesucht ist, was FEHLT. Miss gegen den theoretisch moeglichen Bestwert" (Memory `befunde-abhaken.md`), Befunde in Statusliste UMGESETZT/VERWORFEN/OFFEN, `[skeptiker]` im Commit-Betreff (Falle 30.08.: drei „kleine" Änderungen ohne Skeptiker, zwei schwer fehlerhaft).
- **Rechnen heißt rechnen:** „Wer eine Formel aus fremdem Quellcode anwendet, baut sie als ausfuehrbaren Code nach und eicht sie gegen einen unabhaengig bekannten Wert." (30.08.: vier von vier Kopfrechnungen falsch — sequenzielle Mutation, Additivität, ähnliche Feldnamen, Umgebungsmultiplikator).
- **Verifiziert heißt:** „Welche Uhr? Was bei Stillstand und Nachholen? Rate oder Bestand?" und „Ein Ausschluss ist nur gueltig, wenn das benutzte Werkzeug den ausgeschlossenen Fall ueberhaupt anzeigen koennte."
- **Sprache im Code:** Bezeichner englisch, Kommentare deutsch ohne Umlaute, Oberflächentexte englisch; kein Massen-Rename; wer ein Feld umbenennt, das in einer gespeicherten Datei steht, schreibt eine Migration beim Laden.
- **Hintergrundtasks:** „Ein schwebender Hintergrundtask blockiert ALLE Cron-Jobs der Sitzung" (26.08., 2 h 56 min Stillstand); Warteschleifen mit harter Grenze (`for i in $(seq 1 20)`), Monitor nie `persistent`, lange Arbeit abgekoppelt (`Start-Process`) mit Fortschritt in Datei.
- **CPU:** rechenintensive Läufe (webpack-Build, Simulationen) auf 4 von 12 Kernen (`ProcessorAffinity = [IntPtr]15`, `PriorityClass = 'Idle'`; Eric 05.08.: „mein Lüfter dreht gerade literally durch").
- **Berichtsstil:** knapp, Stichpunkte, max. 3-5 Punkte je Statusmeldung; `/bb` endet immer mit der Fertig-Schätzung (Eric 31.08.).

# 3. Ziele und Kennzahlen — was „maximal autonom" und „maximal effizient" messbar heißt

## 3.1 Zwei Uhren und die Bestandsfalle

- **Wanduhr** (`Date.now()`) — Erics Ziel ist Kalenderzeit.
- **Motorzeit** — Summe über Motor-Runden von `min(Δwall, 2 × Takt)`; zählt nur Zeit, in der der Motor lief. Persistent in der Telemetrie, wird bei `lastAugReset`/`lastNodeReset`-Wechsel je Lauf neu geführt. **Nicht `totalPlaytime`**: es zählt Offline-Zeit voll (`engine.tsx:344-350`; Falle 02.09.: „Tempo 1,0 über 11,5 h" war die Offline-Gutschrift).
- **Engine-Puls**: Δ`totalPlaytime` / Δwall über ≥ 3 min. ≈ 1 → Engine tickt; < 0,2 → Engine steht (Fall 25.08.: 46 min stehende Engine bei laufendem Netscript); ≫ 1 → Nachholklumpen nach Laden.
- **Bestände statt Raten** — jedes Ratenfenster verwerfen, solange: Bladeburner-`storedCycles` > 30 s (Abbau max. 5 Spielsekunden je Realsekunde, `Bladeburner.ts:1377-1380`; Gleichgewicht 4,8 h Vordergrund-Tab je Tag, `tools/rueckstand.js:13-20`); Sleeve-`storedCycles` > 30 s (Deckel 15 je Takt, `Sleeve.ts:263-275`, gemessen Faktor 14); Δ`totalPlaytime` > Δwall + 60 s (Offline-Klumpen der Figur, `engine.tsx:280-282`: 10 h Gym auf einen Stat am 02.09.). Die „106.000 exp/h" vom 02.09. waren Nachholbetrieb, stationär 63.400 (`AUDIT-AUTONOMIE:197-199`).
- Alle Raten nur **innerhalb desselben Laufs** (Falle 01.-03.09.: Rang-Rate über Knotenwechsel → NaN-Absturz, `tools/checkin.js:287-311`, Commit `662421d`).

## 3.2 Autonomie-Kennzahlen (Ziel: alle null bzw. unter Schwelle, gemessen über die Abnahme und danach dauerhaft in `data/kpi.json`)

| Kennzahl | Definition | Ziel |
|---|---|---|
| `manual_actions` | Handgriffe von Eric oder Claude im Spiel oder an Windows je Lauf | **0** |
| `jump_latency_min` | von `data/ausgang.json.offen === true` bis neuem `lastNodeReset` | ≤ 2 Takte (2 min); `wirtFehlt` (`ausgang.js:274-286`) ist der zu zählende Fehler |
| `boot_latency_min` | Sprung → Motor läuft mit neuer Knotennummer in `bn4net.json` | ≤ 5 min |
| `workbench_wait_h` | Motorzeit ohne Werkbank je Kaltstart | ≤ 2 × Bestwert (3.3); BN10 stand 13,5 h |
| `negative_balance_min` | Minuten mit Konto < 0 (Deadlock aller Käufe: purchaseServer/upgradeHomeRam/travel geben `false`) | **0** |
| `tool_missing_min` | Minuten, in denen ein im Knoten fälliges Werkzeug weder läuft noch auf Platz wartet | 0; Warten auf Platz ist eigener Zustand |
| `false_kill_count` | Kills durch Stillstandserkennung, auf die kein Herzschlag-Ausfall vorlag | 0 (Live 02.09. 18:14-18:50: 0 in 35 min) |
| `ladder_rungs_ge3_per_week` | Sprossen ≥ 3 der Strafleiter (Abschnitt 5) | 0 im Normalbetrieb; jede ist ein Befund in BAUSTELLEN |
| `bridge_down_min` / `bridge_restarts` | Brücke nicht auf 12525 gebunden bzw. Neustarts je Tag | Neustart binnen 10 s; kein Doppelprozess |
| `backup_age_h` | Alter des jüngsten geprüften `LIVE_`-Backups | ≤ 1 h; zusätzlich Ereignis-Backups vor Sprung/Einbau/Hot-Swap |
| `queued_augs_at_jump` | gekaufte, nicht eingebaute Augs beim Sprung (verbrannt: `PlayerObjectGeneralMethods.ts:116`) | 0 |
| `graft_aborted` | abgebrochene Grafts (keine Erstattung, `Work/GraftingWork.tsx:75-83`; Vorfall SPTN-97 $14,63 Mrd) | 0 |

## 3.3 Effizienz-Kennzahlen je Phase — jede gegen den Bestwert des Knotens, nicht gegen die Vorstunde (Memory `absolut-statt-relativ-messen.md`: am 22.08. lag die Geldmaschine „rund zwei Größenordnungen unter dem Möglichen" und galt relativ als gut)

**Kaltstart (Sprung → alle Werkzeuge laufen)**
- `t_workbench` [Motor-h]: erster Rechner ≥ größtes Pflichtwerkzeug. Bestwert = Knotenpreis / Kaltstart-Einkommen. Preis: `ram × 55.000 × CloudServerCost × CloudServerSoftcap^max(0, log2(ram) − 6)` (`ServerPurchases.ts:34-41`, `Server/data/Constants.ts:4`; geeicht: 32 GB in BN10 = 8,80 Mio, gemessen 8,8 Mio). Einkommen = Hackrate im Kaltstart (Modell aus `ScriptHackMoney × ServerStartingMoney × HackingSpeed`, geeicht BN10 175 $/s, BN6 260 $/s, Unsicherheit ≤ Faktor 2, `nodes/audit-2026-09-02/knoten.md:8`) + liegengebliebene Verträge (`75e6 × CodingContractMoney × difficulty`, `Constants.ts:91-93`; 24 Stück = 86 Mio am 02.09.) + Hashes (SF9.3: 0,28 Hash/s Gratis-Server, 4 Hashes = 1 Mio → 70.000 $/s, `HacknetServers.ts:11-16`, `HashUpgradesMetadata.tsx:10-23`) + Sleeve-Verbrechen.
- `t_gate` [Motor-h]: Divisionsbeitritt (V2) bzw. erste Faktion (V1). V2-Bestwert: Σ über vier Kampfwerte `exp(level) = e^((100/(mult·LevelMult)+200)/32) − 534,6` (`formulas/skill.ts:13`; Eichung exp 28.841, mult 0,4·1,262 → Level 65 gemessen) geteilt durch Gymrate 10 exp/s Spieler + 2,5 exp/s je Sleeve bei sync 25 (`Work/Formulas.ts`, `Sleeve/Work/Work.ts:17-25`) × (1 + 0,2 × Hash-Gym-Stufen). Referenz: 0,2 h bei Kampf-Mult 1,262 (BN4/6), 2,7 h BN14, 4,8 h BN9, 9,5 h BN10 (`knoten.md:16-31`); Beitrittstor BN10 = 252.320 exp je Wert (`zahlen.md:76`).
- `idle_ram_pct`: brachliegendes Netz-RAM; > 20 % über 10 min = Kaufstopp/Zielmangel (`homegrow.js:100-119`).
- `throttle_rounds_per_min`: Motor-Runden je Minute; < 1 = verdeckter Tab (Deckel 1 Timer-Wake/min, `doku/drosselung.md`). Ziel im Kaltstart: Timer-Patch aktiv innerhalb 1 Runde.

**Aufbau (Werkbank → Träger läuft)**
- `mult_product`: V1 Produkt der `hacking`-Mults gegen Sortiments-Obergrenze 23,1 (`nodes/ROADMAP.md:153-160`); V2 Produkt der Kampf-Level-Mults nach Entropie (`EntropyEffect 0,98^stacks`).
- `favor_target_pct`: kumulierte Rep der Zielfaktion gegen 462.490 (Favor 150, `formulas/favor.ts`; BN3 85.396 bei FavorToDonate 0,5; BN8 0).
- `graft_busy_pct`: Anteil Motorzeit mit laufendem Graft im Paketmodus → Ziel 100 %, `graft_aborted = 0`.
- `t_rebuild_h`: Kampfwert-Wiederaufbau nach Einbau; gemessen 3,1 h bei Mult 1,6-2,2 (`nodes/HEBEL.md:108-114`, Formel dort als Soll nachbauen). Abweichung > 30 % = Figur-Konflikt.

**Träger (V2: Division → 21 Black Ops; V1: → TRP + WD-Level)**
- `T2_h`: Verdopplungszeit des Rangs über ≥ 2 Verdopplungen in Motorzeit. Referenz BN6 3,5-3,8 h bei Faktor 1,0 (`nodes/ROUTE.md:176-182`; Rang 13.209 → 452.411 in 19,2 Spielstunden). Soll je Knoten = Referenz / (`BladeburnerRank` × Sleeve-Faktor). Rang je Aktion skaliert mit `BladeburnerRank` (`Bladeburner/Formulas.ts:22-25`); die 400.000 für Daedalus' Op (`BlackOperations.ts:708`) skalieren nicht → Arbeitsbedarf in BN6-Einheiten: f=1: 326.340; 0,9: 370.784; 0,8: 426.340; 0,6: 593.007; 0,45: 815.229; 0,2: 1.926.340 (Summe rankGain Ops 1-20 = 73.660, `zahlen.md:63`).
- `work_share`: 1 − Kammeranteil; Bestwert `min(1, (R+Z)/(V+Z))` aus Ausdauerregeneration und Aktionsverbrauch (`nodes/KURS.md:58-71`). Kammeranteil > 60 % bei freien Skillstufen = Fehler (30.08.: 62 % bei 159 gesperrten Aufträgen).
- `stock_cover_h` je Operationsart: `count / Verbrauch`; Nachschub 30 Verträge/h (`Bladeburner.ts:1389-1394`), Operationen ≈ 7,9-15,8/h, Sleeve-Infiltrate +`n^-0,5/2` je 60 s (`Bladeburner.ts:1253-1259`).
- `next_blackop_chance` ≥ 0,35 (ENTSCHIEDEN) und `hp_max / hp_loss_fail` ≥ 2 (Raid 303 HP gegen 20 HP max in BN10 L1, `ERLEDIGT.md:866-880`); Fehlschlag kostet `min(10 % Geld, HP × 100.000)` (`Hospital.ts:4-10`).
- `chaos_city` < 50 (`Action.ts:94-103`), `comms_left` über alle sechs Städte (Raid-Deckel, nur im Spielstand lesbar, `tools/staedte.js`).
- V1: `exp_rate_eff` gegen `Threads × (3 + 0,3 × baseDifficulty) × hacking_exp × HackExpGain / t_weaken` (`Hacking.ts:30-38`); gemessen 1,4-2,2e6 EXP/s bei 1 PB gegen Modell 3,1e8 (`AUDIT-ROADMAP:28,143-146`) — Faktor 100 Reserve; `hack_thread_share` (BN4: 6,6 % statt ~47 %, `ROADMAP.md:983-987`). Rep-Rate gegen `((hacking + int/3)/975) × faction_rep × (1+int^0,8/600) × (1+favor/100) × FactionWorkRepGain × shareBonus` (`formulas/reputation.ts`), `shareBonus = 1 + ln(threads)/25`.
- **Alarmregel:** `T2_h` > 2 × Soll, oder eine Rate 60 Motor-min unter 50 % des Bestwerts → Befund, nicht erst bei Stillstand („Eine Wache misst Bewegung, nicht Richtung", Memory `autonomer-lauf-absichern.md`).

**Ausgang**
- `t_blackop_chain_min`: letzte drei Black Ops (BN6: 50 min gemessen, `ROUTE.md:194-195`).
- `jump_latency_min`, `boot_latency_min` (3.2).
- **Laufsumme:** Motor-h je Routeneintrag gegen das Soll der Roadmap (V2 Faktor 1,0 mit 3 Sleeves 22-29 h; BN7/14 33-44 h; BN13 40-54 h; BN15 68-97 h; V1 mild 20-30 h; `nodes/ROADMAP.md:274-293`, `AUDIT-ROADMAP`), Kalender-h je Eintrag gegen `Motor-h × 24/Fensterstunden`. Gesamtprognose 1.100-1.900 Motor-h für 41 Läufe (`ROUTE.md:93`) als laufende Zahl mit Ist-Korrektur; Kalenderfaktor BN10 L1 war 1,8 (94,9 h Kalender für ~52 h Spielzeit).

## 3.4 Soll je Knoten (Träger, Multiplikatoren aus `reference/v301/src/BitNode/BitNode.tsx`, Hebel)

| Route-Pos. | Knoten | Träger | Maßgebliche Multiplikatoren (Zeile) | Größter Hebel | Bestwert-Referenz |
|---|---|---|---|---|---|
| 1-2 | BN10 L2/L3 | V2 | Rank 0,8 (:876), Kampf-Level 0,4, HLM 0,35, CloudCost 5 (:855), Limit 0,6, AugCost 5/Rep 2, ScriptHackMoney 0,5 | Grafting (×3 Preis, keine Rep, `GraftableAugmentation.ts:20-22`); Sleeve 3 ab L3 | L1: 94,9 h Kalender; Roadmap 30/26 h |
| 3-4 | BN4 L2/L3 | V2 | alles Singularity ×1 (`RamCostGenerator.ts:82-96`); Rank 1; HackExpGain 0,4 | SF4.2/4.3 teilen Singularity-RAM /4 /16 — der Ort, um V1-Gewerke ohne RAM-Not live zu testen | Roadmap 25-29 h; nie mit Faktor 1,0 + 3 Sleeves gemessen |
| 5-7 | BN9 L1-L3 | V2, `braucht hashes.js` | **CloudServerLimit 0** (:816), HomeRamCost 5 (:814), HackExpGain 0,05 (:821), Rank 0,9 (:830), SkillCost 1,2 (:831), ServerMaxMoney 0,01 | Gratis-Hacknet-Server 70.000 $/s; Hash→Rang 250 Hashes = 100 Rang **flach** (`HacknetHelpers.tsx:539-545`); „Improve Gym Training" 50 Hashes = +20 % (`Work/Formulas.ts:113`) gegen 4,8-h-Tor | Roadmap ~30 h; exit.js-Wirt 39,25 GB mit SF4.3 → home 64 GB kostet 50,4 Mio |
| 8-9 | BN1 L2/L3 | V1 | Default (:572-574), eff. Schwelle 3.000 | Favor-150-Bootstrap in EINER Faktion, dann Spende 1 Mio $/Rep (`formulas/donation.ts`) | BN5 L1 27-30 h → BN1 darunter |
| 10-11 | BN5 L2/L3 | V1 | WDD 1,5 → 4.500, HackExpGain 0,5, ServerStartingSecurity 2 | +300 Int-EXP je Abschluss (`Prestige.ts:363-365`) | gemessen 27-30 h |
| 12-14 | BN12 L1-L3 | V1 | alles 1,02^lvl, lvl = SF12+1 (:924-995); Schwelle 3.121/3.247/3.378 | SF12 = NFG-Startstufen (`Prestige.ts:255-261`) | Roadmap 20-30 h |
| 15-17 | BN2 L1-L3 | V2 | Rank 1; WDD 5 → V1 tot (18.750); CrimeMoney 3; ServerMaxMoney 0,08 | CrimeMoney 3 im Kaltstart; Gang nur als Doku-Rückfall | 22-29 h |
| 18-20 | BN3 L1-L3 | V2 | CloudServerCost 2, ScriptHackMoney 0,2 × MaxMoney 0,04, AugCost 3/Rep 3, FavorToDonate 0,5 | Kaltstart-Modell **87 h** (`knoten.md:24`) → SF9.2/9.3 müssen vorher da sein (Route tut das) | 22-29 h + Kaltstart |
| 21-23 | BN11 L1-L3 | V2 | HLM 0,6, ServerMaxMoney 0,01, CrimeMoney 3, CloudSoftcap 2 | SF11.3 senkt Aug-Chargenbasis 1,9 → 1,767 (`AugmentationHelpers.ts:29-31`) | 22-29 h |
| 24-25 | BN6 L2/L3 | V2 | Rank 1, HLM 0,35, DaedalusAugs 35 | reine Pflicht | L1: 52 Spiel-h ab Beitritt, Anlauf 0→80k Rang 40 h (`KURS.md:227-229`) |
| 26-28 | BN7 L1-L3 | V2 | **Rank 0,6, SkillCost 2** (:756), AugCost 3 | SF7.3 schenkt Blade's Simulacrum für BN14/13/15 | 33-44 h; SkillCost 2 nie simuliert |
| 29-31 | BN14 L1-L3 | V2 | Rank 0,6, SkillCost 2, HackingSpeed 0,3, FactionWorkRepGain 0,2, Kampf-Level 0,5, WDD 5, GoPower 4 | Go gegen Daedalus/Tetrads (`Go/effects/effect.ts:57-95`) — nur nach Messung | 33-44 h; Kaltstart-Modell 39 h |
| 32-34 | BN13 L1-L3 | V2 | **Rank 0,45, SkillCost 2**, HackExpGain 0,1, Startgeld $200.000 (`Prestige.ts:351`), StaneksGiftPower 2 | Stanek Fragment „Bladeburner" (`CotMG/FragmentType.ts:70-72`) — nur nach Messung | 40-54 h |
| 35-37 | BN15 L1-L3 | V2 (Route) / V1b | **Rank 0,2, SkillCost 3** (:1112), Charisma 1,1, Daedalus führt TRP nicht (`FactionHelpers.tsx:204-207`) | Hash→Rang (100 flach = 500 BN15-Einheiten); Labyrinth-Gewerk (V1b) | Sim 68-97 h je Lauf V2; Labyrinth grob 10-35 h |
| 38-40 | BN8 L1-L3 | V1, `braucht boerse.js` | BladeburnerRank 0 (:790), ScriptHackMoneyGain 0, FavorToDonate 0, Start $250 Mio, WSE+TIX gratis, Shorts nativ | Forecast per `grow/hack {stock:true}` selbst setzen (`doku/formeln-boerse.md:116-157`); Spende ab Favor 0 | 30-70 h — unbelegt |

Nach Route-Position 4 gilt SF4.3 (Singularity ×1 überall), nach Position 6 SF9.2 (frisches home 128 GB statt 32, `Prestige.ts:242-249`), nach Position 7 SF9.3 (Gratis-Hacknet-Server in jedem Knoten). Nur noch ein 16×-Kaltstart (BN10 L3) und zwei 16×-Ausgänge (BN10 L2/L3) stehen an (`praemisse.md:122-125`).

# 4. Architektur-Anforderungen

Die Bauform des Audits gilt weiter: große Skripte je Aufgabe, Werkzeugliste, `boot.js` als Rückruf, feste Route (`AUDIT-AUTONOMIE:31-34`: „trägt"). Neu ist die Struktur darum herum. Entscheide selbst, ob du Datei für Datei portierst oder neu baust — Kriterium ist die Testbarkeit im Prüfstand (6), nicht Geschmack. Neue Dateien entstehen **nicht in `src/`**, sondern in einem Arbeitsverzeichnis/Worktree, denn die Live-Brücke schiebt jede Datei in `src/` binnen 400 ms ins Live-Spiel (`bridge.js:185-228`; Falle 02.09.: ein Stub landete so im Live-Spiel und wurde beim nächsten Sync still zurückgeschoben).

## 4.1 Kern

- **Motor** mit zwei Betriebszuständen: **Kaltstart-Modus** (home 32 GB, null eigene Rechner, ggf. SF4.1) und **Vollbetrieb**. Kaltstart ist ein eigener Zustand mit eigener Werkzeugliste und eigenem RAM-Budget (4.4), kein Sonderzweig im 10-s-Motor.
- **Werkzeug-Registry** (eine Tabelle statt `WERKZEUGE`-Array + `verfahrenV1`/`markerGilt`-Sonderfällen): je Werkzeug Datei, RAM-Bedarf je SF4-Stufe (gemessen), Knotenmenge/Verfahren (aus `data/verfahren.txt`), Telemetriedatei, Frischegrenze, Takt, Wirtregel (home-only / Werkbank / überall), Abhängigkeiten (`lib/`), Kaltstart-Pflicht ja/nein. Stillstandserkennung, Start, Entdopplung und Platzierung lesen ausschließlich diese Tabelle.
- **Ein Figur-Vergabepunkt** mit fester Rangfolge Graft > Bladeburner-Aktion > Faktionsarbeit > Gym > Verbrechen (Audit C.14). Genau ein Skript besitzt die Figur; alle anderen stellen Anträge über eine Datei mit Zeitstempel und Knotenstempel. Jede `startWork`-Quelle tötet ein laufendes Graft ohne Erstattung (`GraftingWork.tsx:75-83`) — der Vergabepunkt ist der Riegel dagegen.
- **Wächter/Strafleiter** (Abschnitt 5): singularityfrei, < 4 GB, kein DOM-Literal (`globalThis["document"]` kostet 0 GB, wörtliches `document`/`window` je 25 GB, `RamCostGenerator.ts:12`, `RamCalculations.ts:185-192`), von `boot.js` gestartet, gegenseitige Wache mit dem Motor wie heute `popups.js` (`popups.js:103-126`).
- **Telemetrie-Schema**: jede Datei trägt `time`, `node`, `nodeReset`, `augReset`, `host`, `round`, `motorTimeMs`. Schreiber auf der Werkbank `scp`en nach home (Falle viermal: `ns.read/write` arbeiten auf dem Wirt des Skripts, Memory `bitburner-werkzeuge.md`). Logs **anhängend mit Deckel** (Ringpuffer, Muster `bn4life.js:47-59`), plus ein Ereignis-Ringpuffer `data/events.json`, der Einbau und Sprung überlebt (Textdateien auf home überleben beides, `ServerHelpers.ts:226-239`; nicht in die Räumlisten von `boot.js:77-81, 104-108`).
- **Zeit**: Motorzeit und Engine-Puls (3.1) im Motor geführt und exportiert; alle Raten aus Fenstern ohne Rückstandsabbau.
- **Selbstschutz-Muster 1:1 übernehmen**, jedes hat einen datierten Vorfall: `reserveHome()` (`bn4net.js:178-237`), Werkbank-Reserve (`:1007-1033`), Entdopplung „jüngste PID bleibt, Steuerhälften gewinnt home" (`:2741-2760`, seit 02.09.; vorher die älteste → 17 tote Neustarts), Telemetriealter-Kill mit Karenz (`:2713-2739`), `WERKZEUG <name>.js` mit Endungsergänzung (Falle 27.08.: ohne `.js` leert er die Datei), `try` um die ganze Runde (`:391-392, 3167-3170`), Fernbefehle mit Zeitstempel und Verwerfen alter Befehle (Falle 25.08. 05:59: bn4net las nach dem Neuanlauf einen zehn Minuten alten „WERKZEUG bn4net.js" und beendete sich, `boot.js:68-76`).
- **API-Stand v3.0.1**: nur `ns.cloud.*`, `ns.ui.*`, `ns.format.*`; `ns.isFullPort/isEmptyPort` fehlen (`doku/api-aenderungen-v3.md`); nach Selbst-`kill` immer `return` (V1 `doku/schlupfloecher.md:80-101`); `Script.ramUsage` ist gecacht — nach `scp`/Bibliotheksänderung abhängige Skripte neu schreiben (V12, `:334-352`).

## 4.2 Gewerke je Knoten

**V2 — Bladeburner (30 der 40 Läufe).**
- `blade.js`-Entscheidungsregeln portieren (min der Spanne, Schwelle 0,35, Field Analysis bei breiter Spanne, Graft-Riegel, Gym-Rückfall, Trupp, Chaos/Diplomacy) und um den Knotenfaktor kalibrieren: `BladeburnerRank` in jede Rang-Erwartung, `BladeburnerSkillCost` in den Skillplan (`Skill.ts:70-75`: `round(count × SkillCost × (base + inc × level))`), SP = floor(Rang/3). Aufbauphase bei SkillCost 2/3 im Prüfstand simulieren (Audit J) — nicht annehmen.
- Beitrittstor: alle vier Kampfwerte ≥ 100 (`NetscriptFunctions/Bladeburner.ts:349-354`), Beitritt sofort (ENTSCHIEDEN; 100→300 bringt nur +46 % Rang nach 10 h, `KURS.md:347-358`), Einbau vor Beitritt nie.
- **Sleeves**: Kaltstart Shoplift/Mug; Torphase Gym auf dem (i+1)-niedrigsten Wert gegen den Offline-Klumpen (`sleeve.js:305-313`, Commit `1302cd6`); Division: Kontrakte nach Vorrat, sonst Infiltrate Synthoids; Geldboden: Gym nur, wenn das Konto den 15×-Nachholbetrieb aller Körper trägt (Powerhouse 2.400 $/s je Körper, `Work/Formulas.ts:110-127`; im Nachholen 36.000 $/s je Sleeve, gemessen 74.400 $/s → −18,5 Mio in 5 min am 02.09.). Neu: Support-Aktion (`SleeveSupportWork.ts`, `teamSize += 1` → `(teamCount+1)^0,05` auf Black-Op-Chancen), Shock-Recovery und Synchronize nach Nutzenrechnung (`formeln-wirtschaft.md:809-827`), Faktionsarbeit der Sleeves als einzige Rep-Quelle ohne Simulacrum.
- **Grafting-Automatik** (größter Einzelposten nach der Route: BN10 L1 zeigte Faktor 10-20 auf den Rangweg, `ERLEDIGT.md:835-837`): Plan im Spiel (`data/graftplan.json` auf home), Reihenfolge nach Δ Erfolgschance der Rangaktion je Graftstunde mit Voraussetzungsketten (`ns.singularity.getAugmentationPrereq`), Simulacrum zuerst (bis SF7.3 es schenkt), `violet Congruity Implant` ($150 Bio, löscht Entropie, `GRAFTPLAN.md:258-278`) sobald bezahlbar, nur in New Tokyo startbar, Budgetregel gegen die Geldrate, kein Graft über eine erwartete Offline-Phase (Grafting läuft offline nur bis zum nächsten Abschluss, `engine.tsx:281-283`), Riegel über den Vergabepunkt. Preis `baseCost × 3`, Zeit `(1 h × log2(Σ mults≠1) + 30 min)/2 / IntBonus` (`GraftingHelpers.ts:8-30`); jedes Graft 1 Entropie = ×0,98 auf alle Mults.
- **Hashes (ab SF9.3 in jedem Knoten)**: Regeln je Phase — Torphase „Improve Gym Training" (50 Hashes/Stufe, +20 %); Anlauf und gedämpfte Knoten „Exchange for Bladeburner Rank" (250 → 100 Rang flach, in BN15 = 500 Einheiten); sonst Verkauf; nie Arbeiter auf `hacknet-server-*` (`ramRatio` halbiert die Rate, `HacknetServers.ts:14`).
- Augs in V2-Knoten: graften statt kaufen (mit SF10 ab jetzt überall möglich); Einbau nur für Favor-Sprünge und NFG-Stapel unmittelbar vor dem Ausgang; jeder Einbau kostet Kampfwerte auf 1 und Stunden Geldrate (`HEBEL.md:80-100, 511-536`), Rang/Skills überleben (`Bladeburner.ts:259-263`).

**V1 — Hacking (10 Läufe: BN1, BN5, BN12, BN8).**
- HWGW-Kern aus bn4net portieren: `kennzahlen()` (`bn4net.js:1152-1200`), `planMix` (`:1644-1735`), Wasserfall (`:2417-2437`), absoluter Stapelkalender `GAP_MS 400` (`:1917-2225`), `platziere()` (`:3240-3273`), `growFaeden()` Newton (`:3195-3216`; `ns.growthAnalyze` ist unbrauchbar, `ServerHelpers.ts:69`, `formeln-hacking.md` §2.4). Gemessen 1 Ziel $9,12 M/s → 3 Ziele $18,06 M/s (`:1279`). `lib/calc.js` rechnet ohne BN-Multiplikatoren — nicht importieren (`bn4net.js:3228-3234`).
- Erfahrungsofen gegen den Bestwert (3.3): Faktor 100 offen; `worker/expfarm.js` existiert ungenutzt.
- Rep/Augs/Favor/Spende: Kaufreihenfolge global nach Basispreis absteigend über alle Faktionen (Preis `baseCost × 1,9^k × AugmentationMoneyCost`, `AugmentationHelpers.ts:29-37,127-161`; Rep skaliert **nicht** mit k und wird beim Kauf nicht verbraucht), NFG immer zuletzt (`750.000 × 1,14^lvl × 1,9^k`, Rep `500 × 1,14^lvl` ohne 1,9-Faktor; zählt für Daedalus als eine Aug, `FactionJoinCondition.ts:130`), 2-3 Kaufrunden à 10-15 Augs (`doku/auffaellige-werte.md` §3), Reset sobald Produkt neuer `hacking`-Mults ≥ 1,30 (`strategie.md:608-650`), Favor 150 genau einmal treffen (Favor nur beim Einbau aus Rest-Rep, `Faction.ts:77-85`), dann Spende `rep = $/1e6 × faction_rep × FactionWorkRepGain` (`formulas/donation.ts:8-18`) für 2,5 Mio Rep TRP. Daedalus: 30 Augs (BN6/7 35, BN15 20, BN12 31) + $100 Mrd + Hacking 2500 oder Kampf 1500 (`Faction/FactionInfo.tsx:138-149`). WD-Ziel `3000 × WorldDaemonDifficulty` (`ServerHelpers.ts:383-385`; BN12 `1,02^lvl`, im alten Bot fälschlich 1, `bn4rep.js:113`).
- Vor jedem Einbau: Depot leer (Positionen verfallen ersatzlos, `Prestige.ts:169-172`), Arbeit ganz beendet, kein Graft läuft, `queuedAugmentations ≥ 1`; vor dem Sprung kein Aug-Kauf.
- Backdoors CSEC/avmnite-02h/I.I.I.I/run4theh111z (`bn4door.js`), Faktionsbeitritt über das Einladungs-Popup (`popups.js`; `FactionInvitationManager.join()` prüft kein Ereignis) oder `joinFaction` (48 GB mit SF4.1, 3 GB ab SF4.3).

**BN9 (3 Läufe)**: `hashes.js`/`hacknet.js` livefähig machen und im Prüfstand mit `CloudServerLimit 0` testen; exit-Wirt (39,25 GB SF4.3) planen, bevor die Tür offen ist (home 32→64 GB = 50,4 Mio).

**BN8 (3 Läufe, Pflicht — Route überspringt BN8 ohne `boerse.js` und meldet es jeden Lauf)**: `boerse.js` mit (a) Kaltstart-Regel `ScriptHackMoneyGain === 0` → keine Rechner, kein home-Ausbau, kein Gym (die alte Leiter verbrennt 211 der 250 Mio, `knoten.md:31,43`); (b) Long/Short ohne 4S nach Kursrichtung, Positionen ≥ 20 Mio wegen 2 × 100k Provision, Haltedauer < 7,5-min-Zyklus (75 Ticks × 6 s, 45 % Kipp), Tick echtzeitgedeckelt 4 s; (c) Forecast-Manipulation `grow/hack {stock:true}` auf Server mit passendem `organizationName`, ±0,1 mit Wahrscheinlichkeit `moneyGrown/moneyMax` (`formeln-boerse.md:136-157`), Positionsgröße an `shareTxForMovement` gekoppelt (eigene Trades verderben den Forecast, `StockMarketHelpers.ts:86,106`); (d) 4S ($26 Mrd) wenn < 20 % Vermögen; (e) V1-Sockel mit Spende ab Favor 0. Formeln als Code nachbauen und gegen `getForecast`-Livewerte in einem Klon eichen, bevor eine Zeile Strategie geschrieben wird.

**BN15 (3 Läufe)**: Entscheidungstor vor Eintritt, datengetrieben: Lauf 1 als V2-Messlauf mit paralleler `ns.dnet`-Erkundung (API $50 Mio, `DarkWebItems.ts:16-17`); Labyrinth-Gewerk (Netz-Navigator mit Mutation/Retry, ~24 Rätsel-Löser, Maze-DFS, 5 Einbau-Zyklen BrokenWings→…→TRP im EternalLab Tiefe 29, Charisma 3.000, `AUDIT-ROADMAP:155-189`) ist ein eigenes Projekt **nach** der Kernabnahme; Labore existieren nur in BN15, außerhalb ist nur das flache Netz testbar.

**Stanek (BN13) und Go (BN14)**: nicht im Kernumfang; nur bauen, wenn ein Prüfstand-Klon mit den Knotenmultiplikatoren einen belegten Ertrag zeigt. **Gang und Corporation: nicht bauen** (V2 trägt in BN2/BN3; Corp zahlt erst nach Stunden; `AUDIT-ROADMAP`, R4 §4).

## 4.3 Kontrakte (Dateien auf home im Spiel)

Behalten, weil Leser existieren: `data/task.txt` (JSON-Array, Ein-Platz-Kanal, Leser 1 s), `data/reload.txt` (`SELBST bn4net.js` / `WERKZEUG <name>.js`), `data/verfahren.txt` (`"V2 10 2"` = Verfahren Knoten Stufe; Schreiber `ausgang.js:188-192`; absichtlich nicht von boot.js gelöscht, `boot.js:94-99`), `data/geldbedarf.txt`, `data/rep-modus.txt` (`faktion|ms`), `data/keine-hacknet.txt`, `data/keine-sleeves.txt`, `data/simulacrum.txt`, `data/install-sperre.txt`, `data/bn4-stop.txt`, Telemetrien `bn4net.json`, `bn4life.json`, `blade.json`, `sleeve.json`, `bbtrain.json`, `ausgang.json`, `bn4rep.json`, `hb-rep.txt`, `hashes.json`. Wer einen Namen ändert, migriert alle Leser in demselben Commit (CLAUDE.md-Regel Feldumbenennung). Neu: `data/kpi.json`, `data/events.json`, `data/penalties.json` (Strafleiter), `data/watchdog.json`, `data/graftplan.json`, `data/backup-request.txt`/`data/backup-ok.txt` (7), `data/bridge.json` (Rückkanal der Brücke), `data/instance.txt` (`LIVE`/`TEST`). `boot.js` räumt nach Knotenwechsel (`lastNodeReset` < 5 min) die knotengebundenen Dateien und beide Backup-Handshake-Dateien; `events.json`, `penalties.json`, `kpi.json` bleiben.

## 4.4 RAM-Budget im Kaltstart

Frisches home: 32 GB (SF1), 128 GB ab SF9.2 (`Prestige.ts:242-249`), 1 Kern; Geld 1.000 $ (BN8 250 Mio, BN13 200.000). Alle Werte je Skript **mit `calculateRam` über RFA messen** (`/api/rpc?method=calculateRam&filename=<datei>&server=home`), getrennt für SF4.1 (jetzt) und SF4.3 (ab Position 5), als Tabelle nach `doku/ram-budget.md`. Gemessene Bestände: bn4net 16,25/17,75, ausgang 8,15, boot 4,0, hashes ~5, sleevecrime 5,7, contracts 17,65, darkweb 27,65, wakelock 34,25, bn4life 293,8 (SF4.1)/22,8 (BN4), blade 162,25, bn4rep 846,8 (SF4.1)/60,75 (SF4.3), exit 519,25 gerechnet/39,25.

Anforderung: **Summe aller Kaltstart-Pflichtskripte auf home ≤ 28 GB** (4 GB Reserve für boot.js oder den Wächter — entscheide, ob boot.js nach der Übergabe endet oder zum Wächter wird; heute läuft es endlos mit 4 GB, `boot.js:114-128`). Pflicht: Motor im Kaltstart-Modus, Ausgang, Wächter, Sleeve-Verbrechen (nur mit Sleeves), Hash-Verkauf (nur mit Hacknet-Server), **Timer-Patch gegen Drosselung** (< 10 GB, ohne DOM-Literal; Dedicated-Worker-Timer sind ungedrosselt, `doku/drosselung.md` §5, `src/hacktimer.js` als Vorlage; wirkt sofort auf Engine und alle Netscript-Waits; `atExit`-Sicherung Pflicht). Erste Werkbank-Priorität danach: Verträge (Kaltstart-Hälften `cdump.js`/`csolve.js` < 15 GB existieren ungenutzt), `darkweb.js` (TOR/BruteSSH per DOM), dann Figur-Skript, dann Blade/Train. Wenn die Summe nicht passt, ist die Registry-Reihenfolge so zu wählen, dass Ausgang und Wächter **immer** laufen; alles andere wartet auf den ersten 32-GB-Rechner zum Knotenpreis mit Faktor 1,0 (Leiter `[1024…32]`, `bn4net.js:733-749`; Falle 02.09.: Leiter rechnete mit BN6-Preisen, BN10 kostet ×5 → 13,5 h Stillstand). BN9: keine Mietrechner — Werkbank ist der größte gerootete Fremdrechner (`bn4net.js:945-951`), niemals ein Hacknet-Server.

Kaltstart-Reihenfolge, erste 30 Minuten (Soll): boot → Motor (Kaltstart) → Ausgang schreibt `verfahren.txt` → Wächter → Timer-Patch → Hash-Verkauf (SF9.3) → Sleeve-Verbrechen → 0-Port-Server rooten, Weaken-Farm auf höchstem `baseDifficulty` (grow/weaken brauchen kein Level, `netscriptCanHack.ts:49,53`) → Verträge, sobald Platz → erster Mietrechner zum Knotenpreis → Werkbank: darkweb (TOR 200k, BruteSSH 500k …), Figur-Skript, Train (Gym erst bei Konto ≥ Nachholbedarf + Reserve), Blade/Rep. Zielwert `t_workbench` < 1 h in Faktor-1-Knoten.

## 4.5 Portierungsliste

- **1:1**: Rückrufkette `exit.js` → `destroyW0r1dD43m0n(ziel,"boot.js")` → `boot.js` (idempotent, endlos, räumt knotengebunden; live 01.09.); `ausgang.js` + `route.json` + `test-route.js`; `worker/*.js`; HWGW-Kern; Selbstschutz-Muster (4.1); `contracts.js` + Hälften; `popups.js` (Escape ohne isTrusted, Einladungs-Join, „Continue"-Klick); `darkweb.js`; `blade.js`-Regeln als Modul mit Knotenfaktor; `bn4rep.js`-Logik zerlegt (Kauf/Arbeit/Einbau mit je wenigen Singularity-Aufrufen, exit-Wirt vorausplanen); Brückenkern (id-Map mit 15-s-Timeout, Debounce-Push, pushAll, Loopback, `/api/rpc`); `tools/save.js`-Dekodierung; `checkin.js`-Urteilslogik (frischeste Quelle, Lauf statt Knoten, Sleeve-Rückstand); gemessene Konstanten (Tonanker 19,5 kHz/−43 dBFS, Drosselungsstufen 4 ms/1 s/60 s, CloudServer-Preisformel, SF4-Kostentabelle `uebergaenge.md:266-270`).
- **Neu denken**: Prozessmodell außen (4.6), Registry, Vergabepunkt, Telemetrie-Schema, Kaltstart-Modus, Motorzeit-Uhr, Strafleiter (5), Grafting-Automatik, Hash-Regeln, Testgeschirr (6), Wissensbasis (Vorfallskommentare aus dem 60 %-Kommentar-Motor nach `doku/` überführen; `bn4net.js:2973` „897,6 Milliarden" ist um Faktor 1000 daneben).
- **Neu**: `boerse.js`, BN15-Entscheidungstor, ggf. Labyrinth (nach Abnahme).
- **Tot lassen und aus dem Spiel entfernen** (per `deleteFile`, denn `pushAll` schiebt heute alle 115 Dateien inkl. toter): alles aus 1.2 letzte Zeile; `telemetry.txt`-Poll der Brücke (`bridge.js:234-255`) entfällt.

## 4.6 Die Brücke — einziger Außenprozess

- Rolle: Beobachter und Sicherer, **nie Arzt**. Sie startet und killt keine Werkzeuge (Audit C.12/13). Wenn ein Kanal bleibt, dann nur `reload.txt` mit `WERKZEUG <name>.js`, Zeitstempel, höchstens einmal je 15 min je Werkzeug, und nur wenn der Innen-Wächter nachweislich tot ist (Herzschlag > 15 min bei tickender Engine).
- **Autostart ohne den alten Wächter**: eine `.cmd` im Windows-Autostart-Ordner (schtasks braucht Adminrechte, `tools/aufsicht.js:371-378`), die `node sync/bridge.js` in einer Schleife mit 10 s Pause neu startet; **nicht** `tools/aufsicht.js`, nicht `tools/wache.js`, kein headless-Claude (Notnagel kostete 6,50 USD/Tag durch einen Fehlauslöser, `aufsicht.js:104-146`). Eintragen in den Autostart-Ordner ist Erics Rechner → als exakten Handgriff vorlegen, nicht selbst tun.
- Im Prozess: Port 12525 als Lock (`EADDRINUSE` → sofort beenden), `uncaughtException`/`unhandledRejection`-Fang mit Log und Exit (die Schleife startet neu), rotierendes Log auf Platte, Selbstneustart bei geänderter Quelldatei (Muster `aufsicht.js:385-417`), PID-Datei.
- Heartbeat `data/bridge-heartbeat.json` auf Platte alle 30 s (`ts, pid, connected, connectedSince, lastTelemetryAt, lastSaveAt, totalPlaytime`); `lastSaveAt` aus `getSaveFile` alle 10 min (Recovery-Modus setzt `AutosaveInterval 0`, `RecoveryRoot.tsx:80` — von innen unsichtbar). Rückkanal `pushFile data/bridge.json` alle 60 s, damit innen „Brücke tot" von „Tab tot" unterscheidbar ist.
- Post-mortem-Spiegel: `bn4net.json`, `penalties.json`, `watchdog.json`, `events.json`, `ausgang.json`, `boot.txt` alle 60 s auf Platte (Ringordner 48 h).
- Befunde in Dateien: Telemetrie > 15 min alt bei `connected`, `lastSave` > 5 min, RFA > 10 min getrennt bei wachem Rechner, Sprosse ≥ 3 → `nodes/BAUSTELLEN.md` `## Sofort` über `tools/liste.js`, einmal je Befund, mit Entwarnung. Kein ntfy.
- **Wachhund**: nach `connection` sofort `getSaveFile` → `SettingsSave.RemoteFileApiPort` muss dem eigenen Port entsprechen, sonst Socket schließen, kein `pushAll`, ALARM-Datei. Zweite Verbindung bei lebender erster: **neue schließen, alte behalten, ALARM** (heute umgekehrt, `bridge.js:394-402`). `RFA_PORT`/`DASHBOARD_PORT`/`DATA_DIR` per `--test` bzw. ENV parametrierbar; Test-Brücke weigert sich, 12525/8795 zu binden. `/api/state` liefert `{instance, rfaPort, dashPort}`; jedes Werkzeug prüft das gegen seinen Modus.
- Backup-Pflicht (7) gehört in die Brücke, vor `pushAll` und vor jedem Nachschieben.
- Dashboard (8795) bleibt; Eric sieht zusätzlich im Spiel-Tab (`ns.ui.openTail` oder Terminal-Ausgaben) den Zustand.

## 4.7 Betriebsmodell-Entscheidung (Eric vorlegen, nicht selbst ausführen)

Skripte laufen offline nicht (`Engine.tsx:270-277`, nur `offlineHackingIncome × 0,75`); verdeckter Tab = 1 Timer-Wake/min; Sperrbildschirm occludiert alle Fenster; „Autonom" hieß am 02.09. „5,5 von 24 h" (Audit G), Kalenderfaktor 1,8-4,4. Der Timer-Patch im Spiel (4.4) ist der Hebel, den der Bot selbst ziehen kann; der größere liegt außerhalb: Träger-Browser auf Chrome/Edge (`C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) mit `--disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-renderer-backgrounding --remote-debugging-port=<x> --user-data-dir=<eigenes Profil>`, einmaliger Umzug per Export im Opera-Tab → Opera-Tab schließen → Import im neuen Browser (IndexedDB je Profil getrennt), danach Opera-Tab nie wieder öffnen; Alternative Steam/Electron-Fassung (`backgroundThrottling: false`, `reference/v301/electron/gameWindow.js:26,63`). Lege Eric beide Wege mit Schritten und Risiken vor und **baue den Bot so, dass er in beiden Fällen läuft**.

# 5. Strafleiter für Hänger — bis zum Soft-Reset

Grundsatz: Die Leiter sitzt **im Spiel** (Wächter + Motor). Außen kann niemand ein Skript starten, und der Außenneustart erzeugte am 02.09. Doppelinstanzen. Ein Hänger ist nur, was in **beiden Uhren** (Wanduhr, Motorzeit) steht, während der Engine-Puls „tickt" sagt. Jeder Verdacht wird protokolliert — auch wenn nicht gehandelt wird (Untätigkeit darf nicht wie Gesundheit aussehen).

## 5.1 Signale

- **S1 Werkzeug-Herzschlag**: Alter der Telemetrie auf home > max(3 × Takt, 10 min) UND Karenz seit erstem Sehen abgelaufen. Für **jedes** Werkzeug der Registry (heute 5 von 14). Dateien aus fremdem Knoten (`nodeReset` ≠ aktuell) verwerfen. „Fehlt wegen Platz" (`exec` gibt 0) ist kein Hänger, sondern Ausbauauftrag (`bn4net.js:653-670`).
- **S2 Träger ohne Fortschritt**: Δ Träger ≤ 0 über ≥ 45 min Motorzeit in einer Phase, die Fortschritt verlangt. Träger je Verfahren aus `data/verfahren.txt`/route.json: V2 Rang (vor Beitritt Kampfwert-Tiefstand), V1 Hacking-Level und $/s, BN9 Hashes, BN8 Depotwert. Fenster bei Rückstandsabbau/Offline-Klumpen verwerfen (3.1). Erwartung aus eigener Historie derselben Phase, nicht Festwert (Falle 25.08.: Wache meldete sieben Stunden „läuft", der Bot arbeitete in die falsche Richtung).
- **S3a Motor-Herzschlag** `bn4net.json.time` > 10 min; **S3b Engine-Puls** < 0,2 über ≥ 3 min = Engine steht.
- **S4 Drosselung**: Runden/min < 1 über 5 min, `globalThis["document"].visibilityState === "hidden"`. Wird erkannt, um **nicht** zu bestrafen.
- **S5 Brückensicht** (außen): `connected`, `lastTelemetryAt` > 60 s bei `connected`, `lastSave` > 5 min, `lastAugReset`/`lastNodeReset`.

## 5.2 Sprossen, Auslöser, Wirkungsprüfung

| Sprosse | Auslöser | Handlung | Wirkungsprüfung (Frist) | Nicht-Hänger (nie auslösen) |
|---|---|---|---|---|
| 0 Umgebung | S4 oder Brücke tot | Timer-Patch/`ctx.resume()`, Popups schließen, nichts killen, Protokoll | — | verdeckter Tab, Brücke tot (Spiel läuft weiter), Recovery-Fenster |
| 1 Werkzeug neu | S1 + Engine tickt + kein Nachholfenster + Karenz 10 min nach `lastAugReset`/`lastNodeReset`/eigenem Start | `scriptKill` auf allen Wirten, `laufend`-Eintrag löschen, Neustart in derselben Runde | Herzschlag < 2 × Takt, neue PID, Instanzen = 1 (2 × Takt, gedrosselt 3 min) | ohne Platz; im Knoten nicht fällig (blade in V1); ohne Telemetrie; Kaltstart-Größe passt nicht |
| 2 anderer Wirt | Sprosse 1 zweimal ohne Wirkung | Wirt mit meistem Platz, Arbeiter räumen (share → weaken → grow → hack, `bn4net.js:2913-2930`), `scp` + `lib/`, `exec`; Hacknet-Server meiden | wie 1 | wartet auf Speicher |
| 3 alles neu | S3a + S3b „tickt" + Karenz | netzweit Motor und alle Werkzeuge killen, Arbeiter auf home killen, `reload.txt`/`task.txt` leeren, `exec("boot.js")` | `runde` beginnt bei 1, Werkzeuge nach Liste da (5 min) | Einbau/Wechsel < 10 min; Seite gerade geladen; Engine steht (→ 4a) |
| 4a Tab-Reload von innen | S3b ≥ 5 min; oder Sprosse 3 zweimal ohne Wirkung; oder Recovery erkannt (`lastSave` > 5 min außen) | Save-Knopf per React-Props-Klick (`GameRoot.tsx:538-540`, nicht in der isTrusted-Liste) → auf „Game Saved!" warten, sonst 60 s Verlust hinnehmen → `globalThis["window"].onbeforeunload = null` → `globalThis["location"].reload()` | Wächter-Uptime < 2 min, `lastNodeReset` unverändert, RFA verbunden, Engine-Puls > 0,9 (3 min) | Drosselung (Reload macht sie schlimmer: AudioContext danach `suspended`); Eric hat den Tab sichtbar und fokussiert |
| 4b Tab-Reload von außen | wie 4a, wenn innen tot | nur mit CDP-Beweis „genau ein Spiel-Tab" (`Target.getTargets`), `Page.reload` an diese Session; unter Opera heute nicht gegeben (`/json` 404, Sperre nach 3 Versuchen, `archiv/nightshift/cdp.js:14-29`) — dann nichts tun, Befund in Datei | wie 4a | nie „Browser starten und URL öffnen" (Sitzungswiederherstellung → zwei Tabs) |
| 5 Soft-Reset | S2 ≥ 6 h Motorzeit, Sprossen 1-4 ausgeführt und verifiziert wirkungslos, kein Nachholfenster, `queuedAugmentations ≥ 1` (per DOM lesbar; `getResetInfo().ownedAugs` zählt nur installierte) **oder** belegter Spielzustands-Deadlock (Konto < 0 seit ≥ 2 h Motorzeit ohne Einnahme; Figur ohne Rückreisegeld; alle Zielfaktionen gebannt) | `installAugmentations("boot.js")` (80 GB mit SF4.1, 5 GB sonst; `RamCostGenerator.ts:212`) von einem Wirt mit Platz; ohne Wirt: verweigern und protokollieren (DOM-Klick kennt kein Callback, Autoexec greift nur beim Laden, `NetscriptWorker.ts:236-260`) | `lastAugReset` gesprungen, `boot.txt` neu, Konto > 0, Werkzeuge laufen (10 min) | V2 vor Divisionsbeitritt (ENTSCHIEDEN, 6,6 h Verlust); Aktiendepot nicht leer; laufendes Graft; Offline-Nacht; Kaltstart-Anlauf; Gym-Wiederaufbau mit steigenden Werten; höchstens einmal je Knotenstufe, nie < 24 h Motorzeit nach dem letzten Einbau |

`softReset` (erzwingt ohne Augs, 80 GB) nur bei den drei Deadlocks — ein Reset ohne Augs bringt null Multiplikatoren und kostet den Wiederaufbau. Was der Einbau heilt: negatives Konto (Geld → 1.000 $ + Startgeld, `Prestige.ts:84-88`), Stadtfaktions-Sperren, laufende Arbeit; was er kostet: Server, Programme, TOR, Faktionen, Rep, Kampfwerte auf 1; Bladeburner-Division bleibt.

## 5.3 Schutz vor Fehlstrafen und Endlosschleifen

- Zähler je (Sprosse, Ziel) in `data/penalties.json` (Ringpuffer 200, überlebt Sprung; Felder `rung, target, reason, wall, playtime, motorTime, round, node, nodeReset, augReset, result, verifiedAt`). Eskalation zu k+1 nur, wenn k **ausgeführt und verifiziert wirkungslos** — „nicht ausführbar" (kein Platz/Wirt) ist ein eigener Zustand mit eigener Handlung.
- Backoff: 1 → 5 min, 2 → 15 min, 3 → 30 min (max 6/Tag), 4a → 2 h (max 3/Tag), 5 → 24 h Motorzeit. Zähler auf 0, sobald S2 über 60 min Motorzeit Fortschritt zeigt.
- Karenzen 10 min nach `lastAugReset`, `lastNodeReset`, eigenem Start: messen, nicht handeln.
- Fernbefehle mit Zeitstempel + `nodeReset`, veraltet = ignorieren.
- Wächter und Motor bewachen sich gegenseitig (`data/watchdog.json`); irrt der Wächter, irrt er in Richtung Untätigkeit, schreibt aber jeden Verdacht.
- Tests dazu in 6: jede Sprosse einmal ausgelöst, jede Nicht-Hänger-Bedingung einmal als Fehlstrafe versucht.

# 6. Prüfstand

## 6.1 Lokale Instanz

- Aus `reference/v301` (Tag v3.0.1) **zwei Builds** bauen: Production (Fidelity) und Development (Dev-Menü, `globalThis.Bitburner = {Player, GetAllServers, Factions, Companies, SaveObject}`, `engine.tsx:396-411`). Node 24.16.0 vorhanden; `npm ci` im Ordner, dann `npx webpack --mode production` bzw. `--mode development`; `webpack.config.js:51` ruft `git rev-parse` → Ordner muss Git-Checkout bleiben. Build auf 4 Kerne deckeln (2). Der vorhandene `reference/bitburner-src`-Build ist 3.0.2-dev und wird **nicht** verwendet.
- `pruefstand/serve.js` parametrisieren (Port, Wurzel): prod auf 8799, dev auf 8798 — zwei Origins, zwei IndexedDBs. Browser für den Prüfstand: Chrome oder Edge mit eigenem `--user-data-dir` und `--remote-debugging-port` (liefern `/json/list`, anders als Opera); `archiv/nightshift/cdp.js` als CDP-Client (braucht nur `ws`). **Nie** Opera, nie ein Tab mit Port-12525-Einstellung.
- **Zweite Brücke**: `node sync/bridge.js --test` → 12526/8796, `DATA_DIR pruefstand/data/`, Backups `pruefstand/backups/TEST_…` (in `.gitignore` ergänzen). Alle `tools/*.js` lesen Base/Datenverzeichnis aus dem Modus, Default Live.
- **Save-Klon**: `LIVE_`-Backup → gunzip → `SettingsSave.RemoteFileApiPort = 12526` (genau so patcht das Spiel selbst `SyncSteamAchievements` beim Import, `SaveObject.ts:303-316`) → gzip → `TEST_….json.gz` → Options → Import Game im Prüfstand-Tab (oder im Seitenkontext `indexedDB.open("bitburnerSave",2)` → `put(Uint8Array,"save")` → Reload). `?noScripts` (`LoadingScreen.tsx:63`) für Läufe ohne alte Skripte. Ohne den Port-Patch wählt der Klon die **Live-Brücke** an — das ist der Standardausgang eines naiven Imports (7).
- **Fixtures** aus dem Klon per Dev-Menü: `SourceFilesDev` (SF-Level setzen, Sleeves ±), `GeneralDev` (Geld, RAM, `quickHackW0r1dD43m0n`, Gang/Corp/Blade an/aus), Factions, Augmentations, TimeSkip (1 min/1 h/1 Tag = Klumpen). Fixture-Liste: F-LIVE (BN10 L2 Ist), F-BN10L3-COLD (nach quickHack in BN10 mit SF10.2, SF4.1, 32 GB, 1.000 $), F-BN4-COLD (SF4.1 → ×1 im Knoten), F-BN9-COLD (CloudServerLimit 0, SF4.3), F-BN1-V1, F-BN3-COLD (CloudServerCost 2), F-BN7-BLADE (SkillCost 2), F-BN13-BLADE (0,45/2), F-BN15-BLADE (0,2/3), F-BN8 (250 Mio, kein Hackgeld), F-INSTALL (≥ 3 gekaufte Augs), F-EXIT-V2 (21 Black Ops), F-EXIT-V1 (WD erreichbar), F-DEADLOCK (Konto < 0), F-RECOVERY (Autosave 0).

## 6.2 Zeitraffer — was er misst und was nicht

Dev-Time-Skip setzt `Player.lastUpdate` und `Engine._lastUpdate` zurück (`DevMenu/ui/TimeSkipDev.tsx:15-21`); der nächste Tick liefert einen Klumpen. **Klumpen-treu**: Faktions-/Firmenarbeit, `Player.processWork`, Hacknet, passive Rep, Zähler, Übergänge. **Verfälscht/gedeckelt**: Sleeves 15 Zyklen je Aufruf (`Sleeve.ts:263-274`), Bladeburner 5 s je Aufruf (`Bladeburner.ts:1377-1380`), Gang 25, Corporation 10, Stanek Bonuszeit, Börse echtzeitgedeckelt 4 s (`StockMarket.ts:247-251`), laufende Skripte bekommen im Live-Klumpen **nichts**. Folge: Bladeburner-Rangraten, Sleeve-Shock, Börse und Hacking-Einkommen werden in Echtzeit über kurze Fenster gemessen oder als **Formel nachgebaut und gegen den Klon geeicht** (Levelformel-Eichung auf 14 Nachkommastellen ist der Maßstab, CLAUDE.md). Der Exploit-Wächter `timeCompression` (`Exploits/loops.ts:15-31`) ist harmlos, aber ein Signal, dass Zeitmanipulation erkannt wird.

## 6.3 Mocks und Unit-Tests (Node, ohne Spiel)

- ns-Mock für Rundenlogik: Registry-Filter je Knoten/Verfahren, Platzierung/Räumung, Entdopplung, Stillstandsuhr (`tools/test-stillstandsuhr.js` als Vorbild), Strafleiter-Zustandsautomat (Backoff, Karenz, Verifikation, alle Nicht-Hänger-Bedingungen), Kaltstart-Leiter (Preis je Knoten geeicht: BN10 32 GB = 8,80 Mio), Kaufreihenfolge Augs (1,9^k, NFG zuletzt, Rep nicht skalierend), Favor/Spende (150 Favor = 462.490 Rep), HWGW-Planer (`growThreads` gegen `ns.formulas.hacking.growThreads` im Klon geeicht), Motorzeit/Engine-Puls, Rangbedarf je Knotenfaktor.
- `tools/test-route.js` erweitern: `b1tflum3(` darf nirgends in `src/` aufgerufen werden; einziger `destroyW0r1dD43m0n`-Aufrufer ist `exit.js`; `exit.js` validiert das Ziel gegen route.json.
- Brücken-Mock: gefälschter RFA-Client (Spielseite) für Reconnect, Backup-vor-pushAll, Wachhund (falscher Port → Socket zu, kein pushAll), EADDRINUSE → Exit, uncaughtException → Exit, zweite Verbindung → neue schließen.
- `backup-check` (7.3) als Test auf jedem erzeugten Backup.

## 6.4 Testmatrix je Knoten und Phase (Pflicht vor Live)

| Phase | Fixture | Testart | Muss-Ergebnis |
|---|---|---|---|
| RAM-Budget | F-LIVE (SF4.1), F-BN9-COLD (SF4.3) | `calculateRam` je Skript | Kaltstart-Pflicht ≤ 28 GB; Tabelle in `doku/ram-budget.md`; exit.js gemessen |
| Kaltstart | F-BN10L3-COLD, F-BN4-COLD, F-BN9-COLD, F-BN3-COLD, F-BN8 | Klon Echtzeit 60 min + Time-Skip 1 h | alle Pflichtskripte in Runde 1; Timer-Patch aktiv; `negative_balance_min = 0`; erster Rechner zum Knotenpreis × 1,0 (BN9: keiner, Werkbank = Fremdrechner; BN8: keiner); `t_workbench` ≤ 2 × Bestwert; Verträge gelöst, sobald Platz |
| Tor V2 | F-BN10L3-COLD, F-BN7, F-BN13, F-BN15 | Klon Echtzeit (Gym in Echtzeit, Sleeves ohne Rückstand) | Gym erst bei Geldboden; Sleeve i auf (i+1)-niedrigstem Wert; Hash-Gym-Boost genutzt (SF9.3-Fixture); Beitritt binnen 1 Takt nach 4 × 100; kein Einbau vorher |
| Träger V2 | F-BN7, F-BN13, F-BN15 (SkillCost 2/3) | Klon Echtzeit ≥ 2 h je Fixture + Formel-Nachbau | Skillplan mit SkillCost; `next_blackop_chance ≥ 0,35`; Kammeranteil ≤ Bestwert; Vorratsdeckung > 0; Rangerwartung mit `BladeburnerRank` gegen Messung ≤ Faktor 1,3 Abweichung |
| Grafting | F-LIVE (New Tokyo, Konto) | Klon Echtzeit | Simulacrum zuerst; kein Abbruch durch Gym/Faktionsarbeit über 1 h mit aktivem Vergabepunkt; Budgetregel hält |
| Träger V1 | F-BN1-V1 | Klon Echtzeit 60 min + Skip für Rep | HWGW-Stapel ohne Drift; Kaufreihenfolge teuerste zuerst, NFG zuletzt; Favor 150 genau einmal; Spende erst ab Favor 150 (BN3-Fixture 75); kein Einbau mit laufendem Graft/Depot |
| BN9 | F-BN9-COLD | Klon | Hash-Verkauf ab Runde 1; kein Arbeiter auf `hacknet-server-*`; exit-Wirt (≥ 40 GB) geplant, bevor `offen` |
| BN8 | F-BN8 | Klon Echtzeit ≥ 2 h | keine Rechner/Gym; Depotwert steigt über 2 h; Forecast-Manipulation messbar (`getForecast` ±); Provisionen < 5 % Umsatz |
| Einbau | F-INSTALL | Klon | Backup-Handshake (7.4) → Einbau → `boot.js` → alle Werkzeuge binnen 5 min; `verfahren.txt` bleibt; `task.txt` bleibt (kein Knotenwechsel) |
| Sprung V2 / V1 | F-EXIT-V2, F-EXIT-V1 | Klon, ohne `tools/task.js` | `ausgang.json.offen` → `exit.js` auf Wirt mit Platz → neuer Knoten laut route.json → `boot.js` räumt knotengebunden → Motor läuft; `jump_latency ≤ 2 min`, `boot_latency ≤ 5 min`; `queued_augs_at_jump = 0` |
| Sprung 16× | F-LIVE (SF4.1, Park 512 GB, home 1024) | `calculateRam` + Klon | exit.js findet einen Wirt (≥ 520 GB) — das ist der nächste echte Sprung |
| Strafleiter | F-LIVE mit injizierten Fehlern (Werkzeug killen, Telemetrie einfrieren, Engine-Timer blockieren, Konto negativ) | Klon | jede Sprosse genau einmal ausgelöst und verifiziert; jede Nicht-Hänger-Bedingung (verdeckter Tab per Fenster-Occlusion, Einbau-Karenz, Nachholfenster, Kaltstart-Anlauf) erzeugt **keine** Strafe; Backoff und Tageslimits halten |
| Drosselung | F-LIVE, Tab verdeckt 15 min | Klon | Runden/min mit Timer-Patch ≥ 5; ohne Patch = 1 (Kontrolle); Motorzeit stoppt nicht |
| Brücke | Mock + echte Test-Brücke | Node | Reconnect nach Kill < 10 s; Backup vor pushAll; Wachhund weist falschen Port ab; kein Doppelprozess auf 12526 |
| Spielstand | Backups aller Fixtures | `backup-check` | Magic/gunzip/Struktur/identifier/Port grün |
| Post-mortem | Klon nach Tab-Kill | Spiegel auf Platte | `events.json`/`penalties.json` der letzten 48 h lesbar |

Jede Zeile mit Abbruchkriterium und Messprotokoll (`pruefstand/reports/<datum>-<test>.md`). Ein Test gilt erst, wenn die Kennzahl im Zielzustand gemessen wurde („Im Zielzustand testen, nicht im Ausgangszustand", Memory `autonomer-lauf-absichern.md`; Falle 20.08.: Parameter für 274 TB gesetzt, Reset warf auf 116 GB zurück, fünf Stunden Stillstand).

# 7. Spielstand-Schutzprotokoll — absolute Bedingung

## 7.1 Wege, auf denen der Live-Stand stirbt, und die Riegel

1. **Zweiter Tab gleiche Origin**: IndexedDB `bitburnerSave/savestring/save` ohne Sperre (`db.ts:28-36`, `onblocked` nur bei Versionswechsel), beide autosaven, letzter Schreiber gewinnt; zweiter Tab startet alle Skripte doppelt und wählt 12525. Riegel: kein Werkzeug öffnet je einen Tab; Brücke weist die zweite Verbindung ab.
2. **Import eines falschen Standes**: nur UI-Dialog, strukturell gültig genügt (`SaveObject.ts:357-393`). Riegel: Import auf Live nie automatisiert, nur Eric, nur `LIVE_`-Datei.
3. **Browserdaten löschen / Delete Save**: Riegel: Backups außerhalb des Browsers; Recovery-Seite exportiert selbst `RECOVERY_BITBURNER_*.json.gz` (`RecoveryRoot.tsx:37-51`).
4. **IndexedDB-Fehler beim Speichern**: `Player.lastSave` wird **vor** dem Schreiben gesetzt (`SaveObject.ts:236-237`) — ein fehlgeschlagener Autosave ist über `getSaveFile` unsichtbar. Riegel: RFA-Backups serialisieren den Speicherzustand, stündlich.
5. **Testlauf trifft Live-Brücke** (höchste Wahrscheinlichkeit): Klon mit Port 12525 verdrängt Live, Aufträge landen falsch. Riegel: Port-Patch, Wachhund, `--test`, getrennte Ports/Verzeichnisse (6.1).
6. **`b1tflum3`/falsches `destroy`**: `b1tflum3` prüft weder Ziel noch Bedingungen und verlässt den Knoten **ohne Source-File** (`Singularity.ts:1139-1151`, `RedPill.tsx:62-64`). Riegel: Test „kein Aufruf in `src/`", Ziel nur aus `planeRoute`, exit.js validiert.
7. **Soft-Reset zur Unzeit**: tötet Graft ohne Erstattung, löscht Depot. Riegel: 5.2-Bedingungen, `install-sperre.txt`, Backup-Handshake.
8. **exit.js mit falschem Ziel** oder mit `bitNodeOptions`: nie Optionen übergeben (`RedPill.tsx:68-75`).
9. **Gekaufte, nicht eingebaute Augs beim Sprung** verbrannt: kein Kauf bei `ausgang.json.offen`.

## 7.2 Backup in der Brücke

Quelle `getSaveFile` (gemessen 03.09.: 0,41 s, 662.398 B gzip, 3,65 MB roh; kein Export-Bonus, keine Nebenwirkung). Ablage: `Buffer.from(save,"latin1")` **unverändert** als `.json.gz` — exakt das Importformat (`SaveObject.ts:264-275, 338-354`; Klartext weist der Import ab). Name `backups/LIVE_<identifier>_BN<node>L<lauf>_<JJJJ-MM-TT>T<hh-mm>_<anlass>.json.gz`, Anlass ∈ {`hourly`, `connect`, `pre-hotswap`, `pre-install`, `pre-jump`, `manual`}. Rotation: `hourly` 48, erster des Tages 30 Tage, Ereignis-Backups nie löschen, letztes je Knotenlauf dauerhaft; Budget < 150 MB. Testkopien nur `pruefstand/backups/TEST_…`.

## 7.3 `node tools/backup-check.js <datei> [--expect-id 197f4d61481686]`

Exit ≠ 0 bei jedem Fehler: gzip-Magic 31,139,8 → gunzip → `startsWith('{"ctor":"BitburnerSaveObject"')` (wie `SaveDataUtils.ts:47-52`) → JSON → `PlayerSave.data` → ausgeben: identifier, bitNodeN, SF-Map, Lauf, Geld, Hacking, Augs installiert/wartend, Sleeves, `lastSave`, `totalPlaytime`, `SettingsSave.RemoteFileApiPort`. Erst nach grünem Check gilt ein Backup als vorhanden (`backups/INDEX.tsv`).

## 7.4 Pflichtauslöser

1. Beim Verbinden: erst Backup `connect`, **dann** `pushAll` (heute `bridge.js:421-422` ohne Backup).
2. Vor jedem Nachschieben (`bridge.js:204-222`): Backup `pre-hotswap`.
3. Stündlich.
4. Handshake vor Einbau/Sprung: Skript schreibt `data/backup-request.txt` `{"reason","target","ts"}`; Brücke sichert, prüft, legt `data/backup-ok.txt` mit `ts` ab; Skript wartet auf `ok.ts > request.ts`, **höchstens 10 min**, dann handelt es trotzdem und protokolliert „ohne Backup" — Autonomie schlägt Vollständigkeit, die Stundensicherung ist der Boden. `boot.js` löscht beide Dateien nach dem Wechsel.

## 7.5 Wiederherstellung

Lokal (Test): Klon patchen (Port 12526) → Prüfstand → Import → Options → Remote API zeigt 12526 → Test-Brücke meldet verbunden → `backup-check` auf frisches `getSaveFile` stimmt. **Live-Restore nur bei Katastrophe, nur Eric von Hand**: alle anderen Tabs zu; Import der `LIVE_`-Datei mit Port 12525; nach Reload `bridge.log` „Spiel verbunden" und `node tools/save.js` gegen die Backup-Kennwerte. Der identifier ist in jeder Kopie identisch (`PlayerObject.ts:160-167`) — nur Präfix und Port trennen Live von Test.

**Erste Bauaufgabe überhaupt**: stündliches Backup + `backup-check` in die Brücke, live einspielen, ein grünes Backup von BN10 L2 auf der Platte. Vorher wird nichts anderes am Live-System angefasst.

# 8. Vorgehen der Bau-Sitzung (Phasen mit Workflows)

Phase 0 — **Sicherung** (sofort, Fable): `date`; Brücke prüfen (`curl 127.0.0.1:8795/api/state`); Backup-Funktion bauen, Skeptiker (1 Agent, Winkel „kann das den Live-Stand berühren?"), live einspielen, erstes `LIVE_`-Backup grün. Commit `[skeptiker]`, Push. Zusätzlich Autostart-`.cmd` schreiben und Eric als Handgriff vorlegen (Autostart-Ordner ist sein Rechner).

Phase 1 — **Bestand** (Workflow, parallel, Opus/Sonnet für Sammelarbeit, Fable für Synthese): (a) `calculateRam` für alle Skripte unter SF4.1 → `doku/ram-budget.md`; (b) Kontrakt-Inventur aller `data/`-Leser/Schreiber → `doku/kontrakte.md`; (c) Formel-Inventur: jede Formel aus `doku/formeln-*.md`, die der Bot verwendet, **als ausführbaren Code** (`lib/formulas.js` + `tools/test-formulas.js`) mit Eichpunkt gegen einen Livewert aus dem Backup (Levelformel exp 28.841 → 65; Preis 32 GB BN10 → 8,8 Mio; Beitrittstor BN10 → 252.320 exp; Rang-Summe Ops 1-20 → 73.660; NFG-Preisreihe); (d) Skeptiker-Berichte unter `nodes/audit-2026-09-02/` und `BAUSTELLEN.md` `## Sofort` auf offene Punkte (Status UMGESETZT/VERWORFEN/OFFEN).

Phase 2 — **Architektur mit Judge-Panel** (Fable): Entwurf `doku/architektur.md` (Registry, Vergabepunkt, Kaltstart-Modus, Wächter, Telemetrie, Brücke, Gewerke, Testmatrix); drei Skeptiker (Prämisse: ist Portieren statt Neubau hier richtig, und wo nicht? / Fehlermodi nach zwei Wochen unbeaufsichtigt / Substanz: RAM-Budget, Formeln, Knotenfaktoren gegen Bestwert). Synthese, Befundliste, Entscheidung. Nichts aus ENTSCHIEDEN ohne neue Messung.

Phase 3 — **Bau** (Workflow, Module parallel in einem Worktree außerhalb `src/`; Opus/Sonnet für mechanische Portierung nach Spezifikation, Fable für Kern/Wächter/Strafleiter/Brücke): Reihenfolge nach Hebel: Brücke (Lock, Autostart-Schleife, Wachhund, Heartbeat, Rückkanal) → Kern (Registry, Kaltstart-Modus, Motorzeit, Telemetrie) → Wächter/Strafleiter → Vergabepunkt + Grafting-Automatik → V2-Module mit Knotenfaktor → Hash-Regeln → V1-Module (Rep/Augs/Spende, HWGW, Erfahrungsofen) → BN9 → `boerse.js` → BN15-Tor. Jeder Commit einzeln rückrollbar.

Phase 4 — **Prüfstand** (Workflow): Builds, zweite Brücke, Fixtures, Unit-Tests, Testmatrix 6.4 vollständig; Berichte unter `pruefstand/reports/`. Rote Zeile = zurück in Phase 3.

Phase 5 — **Skeptiker-Runden** (Fable, mindestens drei Agenten je Runde, Winkel getrennt, Auftrag „Bestätigung ist wertlos. Gesucht ist, was FEHLT"): Runde A Kaltstart/Sprung/Einbau; Runde B Strafleiter (Fehlstrafen, Endlosschleifen, Uhren); Runde C Effizienz gegen Bestwert je Knotenklasse; Runde D Spielstand-Schutz und Brücke. Bei klarem Veto gegen den riskantesten Schritt: zweiter Prüfer genau auf diese Frage. Befundliste, Umsetzung, Nachprüfung.

Phase 6 — **Hot-Swap live** (9) und Phase 7 — **Beobachtung** (10).

Rechnen: keine Zahl im Prompt-Text, im Code-Kommentar oder in der Doku, die nicht aus geeichtem Code oder einer Messung stammt. Zitate mit Datei:Zeile aus `reference/v301`, im Zweifel im Spiel gemessen. Systemzeit immer per `date`.

# 9. Live-Einspielung und Rollback

- Vorbedingungen: `connected:true`; `node tools/save.js` zeigt identifier `197f4d61481686` und erwarteten Knoten/Lauf; frisches Backup grün; `data/ausgang.json.offen === false`, kein `exit.js`-Prozess, kein Einbau in den letzten 10 min, kein laufendes Graft; `git status` sauber, Commit-Hash der laufenden Fassung notiert; Tests und Skeptiker grün.
- Einspielen = kopieren nach `src/`; Brücke schiebt 400 ms später; Bestätigung ist die Zeile „nachgeschoben" in `data/bridge.log`, nicht die Absicht. Laufende Prozesse behalten alten Code (`bn4net.js:421-427`) → Neustart über `data/reload.txt` per `pushFile`: `SELBST bn4net.js` (Motor beendet sich, popups/bn4life holen ihn zurück) bzw. `WERKZEUG <name>.js` (mit Endung). Gelöschte Dateien bleiben im Spiel (`pushAll` nur `pushFile`) → `deleteFile` per `/api/rpc`. Bibliotheksänderung → abhängige Skripte neu schreiben (V12).
- Reihenfolge live: Brücke (Neustart des Node-Prozesses, Spiel reconnectet in 5 s) → Wächter → Registry/Motor → Werkzeuge. Nach jedem Schritt 10 min `bn4net.json.time`, Herzschläge, `false_kill_count = 0`.
- **Rollback**: `git checkout <hash> -- src/`; Brücke schiebt; Neustart per `reload.txt`; Erfolg = Telemetrie läuft, alte Fassung sichtbar; Commit „Rollback auf <hash>, Grund". Nie `--force`, keine History-Änderung. Spielstand-Rollback (Import) ist **kein** Rollback-Werkzeug des Bots.

# 10. Abnahme gestaffelt

1. **Stufe 1**: Unit-Tests grün, Testmatrix 6.4 vollständig grün, Skeptiker-Runden A-D mit Befundliste ohne OFFEN in den Klassen Spielstand, Sprung, Strafleiter; alle Commits `[skeptiker]`, gepusht.
2. **Stufe 2 — 12 h Live ohne Eingriff**: nach Hot-Swap. Prüfpunkte alle 60-120 min per `/loop` bzw. ScheduleWakeup (13): Kennzahlen 3.2 (alle Ziele), Telemetrien < 2 × Takt, `false_kill_count = 0`, keine Sprosse ≥ 2, Brücke ohne Neustart, Backups stündlich grün, Träger-Kennzahl gegen Soll. Ein Eingriff = Stufe 2 beginnt neu.
3. **Stufe 3 — ein beobachteter autonomer Sprung mit Kaltstart**: der nächste anstehende ist BN10 L2 → BN10 L3 mit SF4.1 (exit.js ≈ 519 GB, Wirt planen; Kaltstart ×16). Erwartung: `jump_latency ≤ 2 min`, `boot_latency ≤ 5 min`, `manual_actions = 0`, Kaltstart-Pflicht in Runde 1, Timer-Patch aktiv, `t_workbench` ≤ 2 × Bestwert (BN10: 8,8 Mio zum Preis × 1,0; Sleeve-Verbrechen + Verträge), Tor binnen Bestwert × 1,5, `negative_balance_min = 0`. Der Sprung wird **nicht** herbeigeführt — er kommt, wenn `ausgang.js` ihn meldet; die Wartephase läuft über ScheduleWakeup mit großem Abstand, nicht über einen hängenden Task.

Erst nach Stufe 3 gilt der Auftrag als erfüllt. Danach Rest-Gewerke (Labyrinth, Stanek/Go nach Messung) als eigene, ebenso abgenommene Projekte.

# 11. Berichte, Commits, Pushes, Dokumentation

- Berichte an Eric: knapp, 3-5 Stichpunkte, an Phasengrenzen; in Wartephasen nur zur vollen Stunde, sonst schweigen (Memory `autonom-stundenbericht`). Jede Fertig-Schätzung aus Kennzahlen, nicht aus Gefühl; Uhrzeit per `date`.
- Commits: je abgeschlossener Sache, Text sagt Warum und Messung, `[skeptiker]` nach Prüfung; `git add <pfad>`; `git pull --rebase` vor Push; Push nach jeder nicht-trivialen Änderung. Bei „Invalid username or token": Eric die Befehle geben (`cmdkey /delete:LegacyGeneric:target=git:https://github.com`, dann Push erneut), nicht selbst an Zugangsdaten arbeiten.
- `nodes/BAUSTELLEN.md` nur über `node tools/liste.js` (`--eintragen sofort|offen --datei <pfad>`, `--erledigen "<anfang>"`, `--sofort-leeren`); erledigte Sofort-Punkte vom 02.09. (bn4rep 26 h, sleeve-Geldboden, Kaltstart-Leiter, KURS für L1, Black-Ops-Ausgang) abräumen.
- Doku: `doku/architektur.md`, `doku/ram-budget.md`, `doku/kontrakte.md`, `doku/kennzahlen.md` (3), `doku/strafleiter.md` (5), `doku/pruefstand.md` (6), `doku/spielstand-schutz.md` (7); Vorfallskommentare aus dem Motor dorthin überführen.
- Memory: `bitburner.md` (neue Bauform, Ports, Kontrakte), `bitburner-audit-autonomie.md` (Stand), neue Dateien `bitburner-strafleiter.md`, `bitburner-pruefstand.md`, `bitburner-spielstand-schutz.md`; Index `MEMORY.md` ergänzen.
- Skills: `bitburner/skills/bb.md` zuerst, dann nach `C:\Users\erche\Desktop\claude_projecto\.claude\skills\bb\SKILL.md` kopieren — `/bb` liest künftig `data/kpi.json`, `penalties.json`, `bridge-heartbeat.json`, endet mit der Fertig-Schätzung aus Motorzeit-Raten desselben Laufs; `bitburner`-Skill (Wiedereinstieg) auf die neue Bauform umschreiben (Rollenspiel „Argos" ist Stand 20.08. und fällt weg); `bb-loops` bleibt abgelöst.

# 12. Was NICHT getan wird

- Kein `b1tflum3`, kein Destroy-Knopf, kein BitVerse-Klick, kein Handsprung per `tools/task.js exit.js`, nie ein zweiter Tab oder eine zweite Instanz mit Port 12525.
- Kein Import auf Live, kein IndexedDB-Schreiben, kein „Delete Save", keine Änderung der Remote-API-Einstellungen im Live-UI.
- Keine Änderung an `src/route.json` außer mit grünem `test-route.js` und neuer Fundstelle; nichts aus ENTSCHIEDEN ohne neue Messung.
- Kein Start von `tools/aufsicht.js`, `tools/wache.js`, keine Scheduled-Task-Wache, kein ntfy, kein headless-Claude, kein KI-Loop im Betrieb.
- Kein Browserzugriff von außen auf den Live-Tab (Opera/CDP) im Betrieb; keine Änderung an Erics Browser, Autostart-Ordner oder Rechner ohne dass er den Handgriff selbst tut.
- Kein Gang-, kein Corporation-Gewerk; Stanek/Go nur nach belegter Messung; keine Zerlegung von bn4rep in Einzelaufruf-Skripte für einen Lauf (33,6 GB Minimum bei SF4.1 passt auf kein 32-GB-home, `praemisse.md:251-263`).
- Kein eval-Exploit, kein `Suppress faction invites`, kein Hacknet-Server als Wirt für Arbeiter.
- Kein Massen-Rename, kein `git add -A`, kein `--force`, kein History-Rewrite.
- Keine hängenden Hintergrundtasks, keine persistenten Monitore, keine `until`-Schleifen ohne Grenze.
- Keine Zahl ohne Beleg; keine Rate aus Nachholbeständen; keine Uhrzeit aus dem Kopf.
- Keine Entscheidung „wartet bis Eric" für Dinge im Spiel — nur Rechner/Browser/Geld/Zugangsdaten werden vorgelegt.

# 13. Budget, Modelle und Loops

- Stand 03.09.2026 15:25: Fable-Wochenlimit 44 % verbraucht, alle Modelle 25 %, Zurücksetzung **Sonntag 13:00**. Eric: „Du darfst mindestens das gesamte Fable-Wochenlimit ausnutzen und dann auch von Opus 5 das weekly Limit!" Abo Max 20x.
- Plan gegen die Zurücksetzung: Phasen 0-5 (Sicherung, Bestand, Architektur, Bau, Prüfstand, Skeptiker) bis Samstagabend mit Fable; mechanische Stufen (Portierung nach Spezifikation, Sammelarbeit, Berichtsformatierung, Test-Fixtures erzeugen) an Opus/Sonnet im Workflow; Fable für Architektur, Skeptiker, Formel-Eichung, Synthese, Kern/Wächter/Brücke. Ist Fable vor Sonntag erschöpft, Opus 5 übernimmt Bau und Tests, Fable-Rest bleibt für die Skeptiker der Stufe-1-Abnahme. Nach Sonntag 13:00 frisches Kontingent für Hot-Swap, 12-h-Beobachtung und die Sprung-Beobachtung.
- Wartephasen (12 h Live, Warten auf den Sprung, Kaltstart-Beobachtung): `/loop` mit 60-120 min Intervall oder ScheduleWakeup mit großem Abstand; jeder Aufwachpunkt liest nur Dateien über die Brücke (`/api/rpc getFile`, `bridge-heartbeat.json`), urteilt nach Kennzahlen, schreibt eine Zeile nach `pruefstand/reports/beobachtung.md` und schweigt bei Ruhe. **Nie** `run_in_background`-Warteschleifen, nie `Monitor persistent`, keine Cron-Blockade (Falle 26.08.2026: 2 h 56 min Blockade aller Jobs durch eine `until`-Schleife), keine Push-Nachrichten. Vor jedem Turn-Ende prüfen, dass kein Task zurückbleibt (`Get-CimInstance Win32_Process -Filter "Name='bash.exe'"`).
- Subagents ohne Rückfrage, mit vollständigem Kontext (Pfade, Zielformat, Abbruchkriterium); jeder Skeptiker bekommt den Auftrag, Schwachstellen zu finden, nie zu bestätigen; Synthese statt Durchreichen.
- CPU-Deckel für Builds und Simulationen: 4 Kerne, Idle-Priorität.