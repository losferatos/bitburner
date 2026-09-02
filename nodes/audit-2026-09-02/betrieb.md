# Audit: Alltagsbetrieb ohne Aufsicht (Stand 02.09.2026, 17:10)

Winkel: was bricht nach zwei Tagen, wenn niemand hinsieht. Live gelesen über die Brücke
(`data/bn4net.json` Runde 278, `bn4life.json` home + werk-10, `bblage.json`, `sleeve.json`,
`sonde.json`, `wakelock.txt`, `bn4net-log.txt`, `bn4life-log.txt` home + werk-10, `boot.txt`),
dazu `data/wache.log`, `data/aufsicht.log`, `data/wache-zustand.json`, `data/checkin.json`.

---

### 1. Geschlossenes Spiel schreibt die letzte Arbeit als Klumpen in EINEN Wert – das erklärt die 1/19
Schwere: KRITISCH
Beleg:
- `reference/v301/src/engine.tsx:264-282`: beim Laden `numCyclesOffline = floor(timeOffline/MilliPerCycle)`, dann `if (Player.currentWork !== null) { Player.focus = true; Player.processWork(numCyclesOffline); }` – die zuletzt gesetzte Arbeit wird für die GESAMTE Abwesenheit in einem Stück gutgeschrieben, kein Skript läuft dabei (Skripte bekommen nur `scriptCalculateOfflineProduction`, `NetscriptWorker.ts:258`).
- `data/bblage.json` 16:50:55: `kampfExp str 35.013, def 33.589, dex 32.990, agi 478.081` – agi hat das 13,6-Fache der anderen drei. Alle drei Trainer im Bot wählen strikt den NIEDRIGSTEN Wert (`bbtrain.js:170-178`, `joinrun.js:73`, `sleeve.js:310-314`); unter einer laufenden Rotation kann dieses Verhältnis nicht entstehen.
- Zeitfenster: `aufsicht.log` letzte Zeile 06:02:17, nächste 16:24:41; `wache.log` 06:06:16 → 16:04:35 „Verwaiste Sperrdatei von PID 3296“; 16:07 „Spiel ist nicht verbunden“; `bn4life-log.txt` auf werk-10 beginnt 16:11:20 „bn4life gestartet“ (= Neuladen, alle Skripte laufen ab `main()` neu). Rechner oder Tab war also rund 10 h zu.
- Größenordnung: 478k − ~30k = ~448k agi-Erfahrung ≈ 10–12 h Powerhouse-Gym eines einzelnen Werts (expMult 10, `LocationsMetadata.ts:324-325`; Offline-Fokus 1,0 statt 0,8). Sleeves werden offline ebenfalls verarbeitet (`engine.tsx:341`), beide standen um 06:00 auf „def“ (`sleeve.json` zeit 1788321655315) – deshalb bekam der Tiefstand nur den Sleeve-Anteil (sync-Bruchteil): genau das gemessene 1/19.
- „Tempo 1,0“ ist dabei kein Widerspruch: `engine.tsx:344` schreibt die Offline-Zeit voll auf `totalPlaytime`. Die Uhr lief, die Entscheidung nicht.
Was passiert: Eric fährt morgens den Rechner herunter (oder schließt den Tab). Die Figur steht in dem Moment auf dem Wert, der vor 60 s der niedrigste war. Abends bekommt dieser eine Wert 10 h Erfahrung, die drei anderen null. Beim Tor „min(str,def,dex,agi) ≥ 100“ sind das 10 h Spielzeit zu ~75 % verschenkt – jeden Werktag, solange das Betriebsmodell „läuft, wenn Eric am Rechner sitzt“ gilt. Dasselbe trifft jede andere Einzelarbeit (Faktionsarbeit für die falsche Faktion, ein Kurs), nur ohne so sichtbare Spur.
Was der Bot stattdessen tun müsste:
- Kein Skript kann offline umschalten; die Verteilung muss VOR dem Schließen stehen. `sleeve.js` darf nicht denselben Wert trainieren wie die Figur, sondern den zweit- und drittniedrigsten (heute: Figur + beide Sleeves alle auf demselben Wert). Dann verteilt sich der Klumpen auf drei Werte.
- Der Spieler-Wert sollte nach Abstand zur 100 gewählt werden, nicht nach Rang – bei vier Werten innerhalb von ±2 ist die Wahl beliebig, und der Klumpen überschießt.
- Außenwerkzeuge (`checkin.js`, `rueckstand.js`) müssen `totalPlaytime`-Sprünge > 1 h als Offline-Klumpen markieren statt als „Tempo 1,0“ – sonst bleibt jede Ratenmessung darüber Unsinn (die Regel „Rate oder Bestand?“ aus CLAUDE.md).
- Der eigentliche Hebel ist außerhalb des Bots: der Rechner muss tagsüber laufen, oder das Simulacrum (Arbeit + Bladeburner parallel) kommt früher.

---

### 2. Der Motor macht jeden Neustart eines hängenden Werkzeugs rückgängig – die Entdopplung behält die älteste Instanz
Schwere: KRITISCH
Beleg:
- `src/bn4net.js:2555-2573`: `wo.sort((a,b) => a.pid - b.pid)`; alle außer `wo[0]` werden gekillt – „die aelteste Instanz bleibt“.
- `tools/wache.js:934-943`: Stillstand = Telemetriedatei älter als 10 min → `starteWerkzeug()` schreibt `data/task.txt` → bn4life/bn4net starten eine ZWEITE Instanz. Es wird nie gekillt.
- Live heute, 6 Sekunden Abstand: `wache.log` 16:52:46 „Nachgestartet: bbtrain.js“, `bn4net-log` 16:52:52 „Doppelte Instanz von bbtrain.js auf werk-10 beendet (pid 8925); werk-2 behaelt sie.“
- Serie im `wache.log` (Z. 188-337): „Nachgestartet: wakelock.js (Telemetrie war 10 min alt)“, dann 25, 40, 55 … 251 min – 17 Neustarts in 4 h, das Telemetriealter steigt monoton. Kein einziger Neustart hat gewirkt.
- Jetzt: `data/sleeve.json` auf home und werk-0 ist von 06:00:55 (11 h alt), `bn4net-log` führt `sleeve.js` durchgehend unter „laufend“. Ein Prozess, der lebt und seit 11 h nichts schreibt – genau der Fall „läuft, tut nichts“.
Was passiert: Ein Werkzeug hängt (Ausnahme außerhalb des try, verlorener AudioContext bei wakelock, `ns.sleep`, das nicht zurückkommt). Die einzige Instanz, die es merkt, ist die Wache draußen. Ihr Neustart erzeugt eine frische Instanz, die der Motor binnen 10 s als „doppelt“ erschlägt, weil die hängende die kleinere PID hat. Ergebnis: Bei wakelock → gedrosselter Tab für Stunden (Faktor 5–60 auf alles); bei sleeve → ein Fünftel der Trägerrate weg; bei bbtrain → Tor steht. Und die Wache meldet dabei „Neustart angestoßen“.
Was der Bot stattdessen tun müsste: Stillstand gehört in den Motor, nicht in ein Außenwerkzeug. `bn4net` kennt jedes Werkzeug und seine Telemetriedatei; ist sie älter als das Dreifache des Werkzeugtakts, `scriptKill` überall und Neustart in derselben Runde (den Pfad gibt es schon: `WERKZEUG <name>` in Abschnitt 0c). Die Entdopplung muss bei Werkzeugen mit Telemetrie die Instanz MIT frischer Telemetrie behalten, nicht die älteste. Werkzeuge ohne Telemetrie (bbtrain) brauchen eine – ein Zeitstempel je Runde, geschrieben nach home.

---

### 3. Nach dem nächsten Einbau läuft das Konto ins Minus und bleibt dort – Deadlock ohne Menschen
Schwere: KRITISCH
Beleg:
- Kostenpfad: `Work/ClassWork.tsx:37` Gym `money: -120`/s, Powerhouse `costMult: 20` (`LocationsMetadata.ts:324`) = 2.400 $/s je Körper; `Sleeve/Work/Work.ts:19` `Player.gainMoney(shockedStats.money * mult)` – Sleeve-Gym bucht beim Spieler, ohne Boden. Drei Körper = 7.200 $/s = 26 Mio/h.
- `src/sleeve.js:316` `setToGymWorkout` ohne jede Geldprüfung; `src/joinrun.js:91-93` `gymWorkout(...)` ohne Geldprüfung (nur „läuft schon ein Kurs?“); einzige Bremse ist `bbtrain.js:236-262` (unter 5 Mio `stopAction()` – aber nur die EIGENE Klasse, und nur die Figur).
- Reihenfolge nach `installAugmentations`: Geld 1.000 $, home bleibt 512 GB und wird Werkbank (`bn4net.js:812-829`), Werkzeugliste startet `sleeve.js` an Position 3 (`bn4net.js:241-270`) → beide Sleeves ins Gym in der ersten Minute. `bn4life.js:130-150` startet `joinrun.js`, sobald ≥ 2 der vier Faktionen fehlen – nach einem Einbau immer.
- Was bei negativem Konto blockiert: `purchaseTor` (`bn4life.js:218`, verlangt > 600k), `purchaseProgram` (`:255`), `purchaseServer` (Kaltstartleiter `:640-650`), `upgradeHomeRam` (`homegrow.js:112`), `travelToCity` (Spiel prüft `canAfford`; `bbtrain.js:191` verlangt zusätzlich > 1 Mio).
- Der Riegel danach: `joinrun.js:103` reist nach Ishima. `bbtrain.js:190-208`: kann nicht zurück (Geld), `GYM["Ishima"]` existiert nicht → schreibt `data/hilfe.txt` und schläft in 60-s-Schleife ohne Alternative. `hilfe.txt` liest im Spiel niemand (Leser nur `checkin.js:107`, `wache.js:735`, `strategie-check.js:433`; ntfy seit 31.08. aus).
- Heute gemessen (Briefing 3): −18,5 Mio in 5 min, Notstopp von Hand.
Was passiert: Einbau → Sleeves und joinrun ziehen 7.200 $/s, Einnahmen sind ohne Portprogramme ein Bruchteil davon → Konto negativ → kein TOR, keine Programme, keine Rechner, kein home-Ausbau → Einnahmen bleiben klein → Konto bleibt negativ. Die Figur steht in Ishima, bbtrain ruft um Hilfe, bn4life begeht Mug für 20 % Ertrag. Der Bot steht, bis ein Mensch die Sleeves stoppt. Kosten: der komplette Rest des Knotens – und das bei JEDEM der noch anstehenden ~40 Einbauten.
Was der Bot stattdessen tun müsste: EINE Stelle, die ein Mindestguthaben garantiert. `sleeve.js`: Gym nur bei Konto > (Gymkosten × 3 Körper × 600 s) = ~13 Mio, sonst Verbrechen (Shoplift bringt Geld statt es zu kosten). `joinrun.js`: dieselbe Schwelle wie bbtrain oder gar kein eigenes Gym (bbtrain trainiert ohnehin auf 100 > 80). `bbtrain.js:200-208`: statt Notruf und Schlaf → `commitCrime("Mug")` bis Reisegeld da ist. Grundsatz für jeden Käufer: kein Kauf, der das Konto unter eine gemeinsame Reserve drückt (`data/geldbedarf.txt` ist nur bn4reps Rücklage, kein Boden).

---

### 4. Kein Autostart im Spiel, und die Außenkette hat heute 10 Stunden gestanden
Schwere: HOCH
Beleg:
- `Settings.AutoexecScript` leer: `aufsicht.log` 05:32, 05:42, 05:52, 06:02, 16:24, 16:34, 16:44, 16:54 je „OFFEN: Autoexec ist leer“. `NetscriptWorker.ts:251-256`: nur mit Autoexec wird beim Laden etwas gestartet, das nicht schon lief; `loadAllRunningScripts` stellt sonst nur `savedScripts` wieder her (Stand des letzten Autosaves, 60 s, `engine.tsx:227`).
- Die externe Kette: `aufsicht.js --dauer` (Autostart-Ordner, vorhanden: `Bitburner-Aufsicht.cmd`) → `wache.js` (alle 3 min) → `task.txt` → bn4life. `wache.log`: 05:42 „Verwaiste Sperrdatei von PID 14520“, 16:04 „Verwaiste Sperrdatei von PID 3296“ – zwei tote Wachen in 24 h; zwischen 06:06 und 16:04 keine Zeile, `aufsicht.log` ebenso (06:02 → 16:24). Die Aufsicht kann den Spiel-Tab nicht einmal prüfen: „Fernsteuerung auf 9222 antwortet nicht – nichts angefasst“ in jedem Lauf.
- Wer den Tab um 16:11 geöffnet hat, steht nirgends – ein Mensch.
Was passiert: Fall A – alle Skripte tot ohne Prestige (killall, `boot.js` läuft nach 240 Runden aus: „Hier muss ein Mensch nachsehen“, `boot.js:124-126`; Tab stirbt während des Einbaus, bevor das Autosave `boot.js` als laufend erfasst hat): Nach dem nächsten Laden läuft nichts, für immer. Fall B – Rechner aus: nichts läuft, was Skripte betrifft; nur die Offline-Gutschrift aus Befund 1. Unter der Prämisse „kein Mensch“ ist die Übergabe „Eric öffnet den Tab“ die häufigste Übergabe überhaupt, und sie ist die einzige ohne Selbstheilung.
Was der Bot stattdessen tun müsste: Autoexec auf `boot.js` setzen – einmalig durch Eric (Options → System), oder durch ein Skript mit `globalThis.document` (popups.js/darkweb.js haben den Zugriff schon, 25 GB): die Einstellung ist ein Textfeld. `boot.js` ist idempotent (`ns.ps("home")`-Prüfung), also ungefährlich. Die Wache gehört unter die Aufsicht (PID-Prüfung + Neustart) – heute prüft die Aufsicht nur „Waechter frisch“, hat aber zwischen 06:02 und 16:24 selbst nicht gelebt; die Ursache (Rechner aus? Sitzung zu?) muss Eric benennen.

---

### 5. Im frischen Knoten läuft 13 Stunden kein Tonanker – der Kaltstart ist gedrosselt
Schwere: HOCH
Beleg:
- `wache.log` 05:06:54 „Nachgestartet: wakelock.js (Telemetrie war 788 min alt)“ – 788 min vor 05:06 ist 15:58 am 01.09., der Knotenwechsel. Weitere Versuche 05:42 (823 min), 05:57 (838 min) – alle wirkungslos (Befund 2 und Speicher).
- `bn4net.js:241-270`: `wakelock.js` steht an 7. Stelle der Werkzeugliste, braucht 34,25 GB (`bn4net-log` heute: „Auftrag FEHLGESCHLAGEN: wakelock.js braucht 34.25 GB“) und damit eine Werkbank ≥ 34 GB. Im Kaltstart gibt es keine (home 32 GB minus bn4net 16,25; größter Fremdrechner 16 GB, `bn4net.js:620-630`).
- `data/sonde.json` jetzt: `sichtbarkeit: "hidden"`, Wechsel-Liste zeigt den Tab fast durchgehend verdeckt. Ohne wakelock: 1 Timer-Wake je Minute (Memory „Browser-Tab-Drosselung“).
- Briefing 2: 13,5 h bei 8/70 Rechnern. Ein Teil davon ist der Preis (11 Mio), ein Teil die Drosselung: `ns.sleep(10000)` in bn4net wird im verdeckten Tab zu ~60 s, jede Runde sechsmal langsamer – Rooten, Kaufen, Werkzeugstart.
Was passiert: Jeder der ~40 kommenden Knotenwechsel beginnt mit einem verdeckten Tab ohne Tonanker, bis Geld für einen 64-GB-Rechner da ist. Die Kaltstartleiter (`bn4net.js:640-650`) und der Auftragskanal sind in dieser Phase um Faktor 6 langsamer als gemessen; die 13,5 h heute waren zum Teil das.
Was der Bot stattdessen tun müsste: Den Tonanker unter 15 GB bringen (die 34,25 GB kommen aus dem `globalThis["window"]`-Zugriff, `wakelock.js:71` – 25 GB pauschal; ein Weckton braucht `document` nicht zwingend, ein `Worker`-Timer ist ungedrosselt) und an die erste Stelle der Liste, damit er neben bn4net auf ein frisches home passt. Bis dahin: `boot.js` soll ihn direkt mitstarten, wenn er passt.

---

### 6. Die Figur hat keine Prioritätsordnung, sondern sechs Bedingungen – zwei davon bilden ein Ping-Pong
Schwere: HOCH
Beleg (wer nimmt die Figur wann):
| Skript | nimmt die Figur | weicht wenn |
|---|---|---|
| `bbtrain.js:236-296` | Gym, `tief < 100`, Konto ≥ 5 Mio, kein GRAFTING | Graft; Konto < 5 Mio → `stopAction()` (nur CLASS) |
| `joinrun.js:91-93` | Gym (focus=true), Ziel 80, wenn KEIN CLASS läuft | nie – kennt weder Geld noch Graft |
| `bn4life.js:340-349` | Verbrechen, wenn `arbeit` null oder Crime, kein rep-modus, nicht in Division | CLASS/FACTION/GRAFTING läuft |
| `blade.js:3204-3232` | Bladeburner-Aktion nach Beitritt; im Wiederaufbau selbst `gymWorkout` (`:1078-1080`) | `tief < 100` und kein Graft → `stopBladeburnerAction`, wartet auf bbtrain |
| `kampfaugs.js:186` | `workForFaction(..., "hacking", true)` einmalig | schreibt KEIN `rep-modus.txt` |
| `graft.js:177` | Graft (Stunden) | – |
| `bn4rep.js` | Faktions-/Firmenarbeit, setzt `rep-modus.txt` (120-s-Stempel) | nicht gelesen (außerhalb des Winkels) |
- Ping-Pong 1 (nach jedem Einbau, Konto < 5 Mio, ≥ 2 Faktionen fehlen): bbtrain `stopAction()` (:257-260) → 15 s später joinrun: „kein CLASS“ → `gymWorkout` → bbtrain 60 s später wieder `stopAction()` → joinrun wieder Gym. Im Mittel ~80 % der Zeit Gym auf Pump, Konto sinkt (Befund 3), und beide Skripte melden nichts, weil jedes für sich „richtig“ handelt. Dokumentiert als genau dieser Zustand am 25.08. 22:18 (`joinrun.js:80-86`: −1,58 Mio „waehrend beide gleichzeitig im Powerhouse Gym standen“) – die Reparatur (joinrun wartet bei CLASS) greift nicht, wenn bbtrain die CLASS-Arbeit selbst stoppt.
- Stiller Kill 2: `kampfaugs.js` beginnt Faktionsarbeit ohne `rep-modus.txt`; bbtrain sieht `laeuft.type === "FACTION"` → `trainiertSchon` false → `gymWorkout` ersetzt sie binnen 60 s (`bbtrain.js:284-289`). kampfaugs beendet sich danach („Fertig“), niemand arbeitet die Reputation nach.
- Frühere Vorfälle desselben Musters: ERLEDIGT.md Z. 4075-4078 („01:33 beide im Minutentakt weggenommen, 07:49 keines gearbeitet“), Z. 7446 (bn4life ↔ blade sekündlich).
Was passiert: Der Wiederaufbau nach einem Einbau (Kampfwerte 1, Konto ~0) ist genau der Zustand, in dem alle sechs Bedingungen gleichzeitig wahr werden können. Heute ist er noch nie ohne Handeingriff durchgelaufen (28.08. 05:54, 27.08. 03:48, 25.08. 05:50 – alle in ERLEDIGT.md).
Was der Bot stattdessen tun müsste: EIN Vergabepunkt für die Figur (eine Datei `data/figur.txt` mit Inhaber + Zeitstempel oder eine Funktion in bn4life), gegen den jeder `startWork`-Aufrufer prüft; Rangfolge fest: Graft > Bladeburner-Aktion > Faktionsarbeit (bn4rep/kampfaugs) > Gym (bbtrain) > Verbrechen. joinrun verliert sein Gym ganz (bbtrain trainiert auf 100 > 80). Wer die Figur nimmt, schreibt die Datei; wer sie nicht hat, ruft `startWork` nicht.

---

### 7. Die gegenseitige Wache prüft nur home – Doppelstart, Kill der Werkbank-Instanz, verwaiste Telemetrie, zwei Auftragsleser
Schwere: MITTEL
Beleg:
- `bn4net.js:373-376`: `!ns.isRunning("bn4life.js", "home")` → `exec` auf home. bn4life läuft aber auf der Werkbank (Werkzeugliste). Sobald home ≥ 293,8 GB frei hat, startet eine zweite Instanz; `:2557-2559` lässt bei Steuerhälften home gewinnen.
- Live 16:32:41: „bn4life.js lag still und wurde neu gestartet (pid 4412)“ und in derselben Runde „Doppelte Instanz von bn4life.js auf werk-10 beendet (pid 173); home behaelt sie.“ Es lag nicht still.
- Folgen: `data/bn4life.json` auf werk-10 (16:32:33) ≠ home; solange bn4life auf der Werkbank lief, war die home-Kopie stale → `lifeFrisch` false (`bn4net.js:407-416`) → bn4net liest `task.txt` ZUSÄTZLICH → zwei Leser mit unterschiedlicher Logik (bn4lifes Leser räumt keine Arbeiter). `bn4life-log.txt` auf werk-10 (16:11:20–16:11:50) ist verwaist; home hat 293,8 GB weniger für Hacking (`homeFrei 128.75` von 512).
Was passiert: Kein Totalausfall, aber jeder home-Ausbau löst einen unnötigen Neustart aus, die Telemetrie liegt abwechselnd auf zwei Rechnern, und die Entscheidung „wer liest task.txt“ hängt an einer Datei, die auf dem falschen Rechner geschrieben wird.
Was der Bot stattdessen tun müsste: Netzweit prüfen wie in 2c (`orte`), und bn4life muss `bn4life.json` + Log nach home kopieren (wie `sleeve.js:329-331`).

---

### 8. Logs sind Speicherlisten mit „w“ – jeder Neustart, jedes Neuladen löscht die Vorgeschichte
Schwere: MITTEL
Beleg: `bn4life.js:49-58`, `bn4net.js:298-306`, `homegrow.js:55-63`: `log = []` beim Start, jede Zeile schreibt `log.join()` mit `"w"`. Datei liegt auf dem Wirt des Skripts. Heute: `bn4life-log.txt` auf home beginnt 16:32:41, auf werk-10 16:11:20 – alles davor (der ganze Tag, der Kaltstart, das Sleeve-Minus) ist weg. Auch `bn4net-log.txt` hält nur 200 Zeilen (~30 min bei 10-s-Takt mit „fehlend/passt nie“-Doppelzeilen alle 100 s).
Was passiert: Genau in dem Fall, für den Logs da sind (Post mortem nach einem Ausfall, den keiner gesehen hat), sind sie leer – weil der Ausfall mit einem Neustart endet. Befund 1 war nur über die Erfahrungswerte rekonstruierbar.
Was der Bot stattdessen tun müsste: Beim Start die bestehende Datei lesen und die letzten N Zeilen übernehmen; Wirtname in die Zeile; nach home kopieren. Die 100-s-Wiederholungen („bn4rep.js passt nie“) nur bei Änderung schreiben, sonst frisst das den Puffer.

---

### 9. `task.txt`: Ein-Platz-Kanal ohne Wiederholung, fehlgeschlagene Aufträge verfallen, alte Aufträge wandern in den nächsten Knoten
Schwere: MITTEL
Beleg:
- Beide Leser leeren VOR dem Parsen (`bn4life.js:276`, `bn4net.js:420`); bei Fehlschlag nur `sag("FEHLSCHLAG")` / „Auftrag FEHLGESCHLAGEN“ (`:326-330`, `:487-491`) – kein Zurücklegen, kein Wiederholen. Heute: `wakelock.js braucht 34.25 GB` → weg. Die Wache versucht es nach 15 min erneut, aber nur für ihre drei Werkzeuge; ein Auftrag von `tools/task.js` ist endgültig.
- `tools/task.js:37` schreibt mit `pushFile` (ersetzt) ohne „belegt?“-Prüfung; `wache.js:263-266` prüft. Zwei Schreiber innerhalb einer Sekunde: der erste Auftrag verschwindet lautlos.
- `boot.js:72-77` räumt `reload.txt`, `rep-modus.txt` u. a., aber NICHT `task.txt`. Ein Auftrag von vor dem Knotenwechsel (etwa `kampfaugs.js` oder `graft.js` aus dem alten Knoten) wird im neuen ausgeführt, sobald ein Rechner mit Platz da ist.
Was passiert: Unter „kein Mensch“ ist der Kanal die einzige Fernbedienung; ein Auftrag, der zur Unzeit kommt, ist verloren, und einer aus dem alten Knoten läuft zur Unzeit.
Was der Bot stattdessen tun müsste: Auftrag erst nach erfolgreichem `exec` leeren; bei Fehlschlag mit Zeitstempel liegen lassen und alle 60 s neu versuchen (Verfall nach 1 h); `boot.js` räumt `task.txt`.

---

### 10. `data/hilfe.txt` ist unter der Prämisse eine Sackgasse – drei Schreiber, kein Leser mit Handlungsmacht
Schwere: MITTEL
Beleg: Schreiber `bbtrain.js:202` (kein Gym in Stadt), `:317` (Beitritt abgelehnt), `bn4rep.js:353/929-940` (exit.js fehlt / nicht startbar). Leser: nur `checkin.js`, `wache.js` (→ ntfy, seit 31.08. aus), `strategie-check.js`. Im Spiel liest sie niemand. Nach dem Schreiben: bbtrain schläft 60 s und schreibt erneut (`:206-208`), bn4rep schläft 15 s (`:942`) – beide ohne Ausweichhandlung.
Was passiert: Der Bot hat drei bekannte Zustände, in denen er stehen bleibt und wartet, dass jemand liest. Mit der Prämisse und ohne Push wartet er auf niemanden. Der Fall „kein Gym in dieser Stadt“ ist real (Befund 3, joinrun → Ishima).
Was der Bot stattdessen tun müsste: Jede `hilfe.txt`-Stelle bekommt eine zweitbeste Handlung: kein Gym → Verbrechen bis Reisegeld; Beitritt abgelehnt → Bedingung prüfen (Kampfwert wirklich ≥ 100? `ns.bladeburner.joinBladeburnerDivision` verlangt zusätzlich, dass keine Division existiert) und ggf. Bladeburner-Training; exit.js fehlt → `ns.scp` von der Werkbank. `hilfe.txt` bleibt als Protokoll, nicht als Wartebedingung.

---

### 11. `WERKZEUG <name>` ohne Werkbank tötet und startet nicht nach – und die Meldung verlangt einen Menschen
Schwere: NIEDRIG
Beleg: `bn4net.js:575-590`: „ACHTUNG: keine Werkbank, es startet NICHTS nach. Mit 'node tools/task.js …' selbst starten.“ Der Starter in 2c läuft nur `if (werkbank)`; nach einem Knotenwechsel ist home mit 32 GB nur dann Werkbank, wenn das kleinste fehlende Werkzeug passt (`:812-829`, popups 1,6 GB) – bbtrain (94,75 GB), blade, bn4life passen nie. Vorfall 28.08. 05:54 (ERLEDIGT.md Z. 4564-4567).
Was passiert: Ein Neustart-Befehl aus einer alten Claude-Sitzung oder aus `wache.js` in der Kaltstartphase löscht das Werkzeug bis zur ersten Werkbank. Selten, aber die Meldung ist eine Handanweisung.
Was der Bot stattdessen tun müsste: Kill nur ausführen, wenn der Nachstart in derselben Runde möglich ist; sonst Befehl mit Zeitstempel liegen lassen.

---

### 12. Wache und bbtrain streiten bei Gleichstand – alle 15 min ein Doppelstart plus Kill
Schwere: NIEDRIG
Beleg: `wache.js:882-905`: „trainiert wird str statt def“ bei `kampf str 68, def 67, dex 67` (`bblage.json` 16:50). bbtrain wählt bei seinem 60-s-Blick strikt kleiner (`:172-176`), die Wache zu ihrem Zeitpunkt – die beiden sehen verschiedene Sekunden. Ergebnis 16:52:46/16:52:52: Start + Kill. Das wiederholt sich, solange Werte nebeneinander liegen (also im ganzen Wiederaufbau), und belegt den Auftragskanal.
Was passiert: Rauschen im Log, ein Kanalslot alle 15 min – und die Wache hält bbtrain für „läuft nicht“, obwohl es läuft (Befund-Text „bbtrain.js laeuft nicht“).
Was der Bot stattdessen tun müsste: Toleranz ±2 Punkte in der Wache, oder besser Befund 2 (Telemetrie von bbtrain) – dann ist der Wirkungs-Check überflüssig.

---

## Was ich geprüft und für tragfähig befunden habe
- Werkbank-Wechsel: `ns.cloud.upgradeServer` erhält Skripte, `deleteServer` wird nirgends aufgerufen; Werkzeuge bleiben „wo sie laufen“ und der Starter sucht netzweit (`bn4net.js:2519-2534`). Beim Einbau (Prestige) sind die Rechner weg und `installAugmentations("boot.js")` startet neu – die Kette ist dokumentiert und mehrfach durchgelaufen.
- Stale-Guards: `homegrow.js` nimmt `bn4net.json` nur < 120 s; bn4net nimmt `bn4life.json` nur < 5 min; die Wache verwirft `blade.json` vor `nodeReset`. `boot.js` räumt `reload.txt` (der Selbstmord-Fall vom 25.08.).
- bn4life ↔ Gym/Bladeburner: der Verbrechens-Block prüft `arbeit.crimeType` bzw. `inBladeburner()` – kein Ping-Pong mit CLASS oder Division mehr (`bn4life.js:340-349`).
- graft.js: Doppelstart-Riegel (`:109-116`), Preisprüfung, keine Reise, die ein Graft abbricht.
- Negativkonto bei API-Käufen: `purchaseServer`, `purchaseProgram`, `upgradeHomeRam`, `purchaseAugmentation`, `travelToCity` geben `false` zurück – kein zusätzlicher Schaden, nur Stillstand. Die einzigen Abflüsse ohne Boden sind Gym (Figur via joinrun) und Sleeve-Gym.
- Neuladen mit laufenden Skripten: `loadAllRunningScripts` stellt alles wieder her, was beim letzten Autosave lief; die beiden Hälften und die Werkzeugliste greifen danach von selbst (heute 16:11 so geschehen).

## Was ich nicht prüfen konnte
- Prozessliste im Spiel (die Brücke proxied nur Dateien): auf welchem Rechner `sleeve.js` gerade läuft und warum es seit 06:00 nichts schreibt.
- Ob zwischen 06:06 und 16:04 der Rechner aus war oder nur Tab und Sitzung zu – beide Log-Ketten enden gleichzeitig; für Befund 1 ist es gleich, für Befund 4 nicht.
- Die exakte Gym-Erfahrungsrate (`Work/Formulas.ts` nicht nachgerechnet); die Zuordnung in Befund 1 steht auf der Größenordnung (448k ≈ 10–12 h Einzelwert bei 10–13 Exp/s) und auf dem Verhältnis 13,6:1, nicht auf 5 %.
- Bladeburner-Offline-Nachholung (`bladeburner.storeCycles`, `engine.tsx:332`): ob der Rang nach 10 h Abwesenheit voll, gedeckelt oder gar nicht nachgeholt wird – relevant, sobald die Division läuft.
- `bn4rep.js` im Wiederaufbau (Faktionsarbeit gegen bbtrain) und `stocks.js`/`invest.js` (stehen in keiner Startliste; ob sie je laufen, ist aus dem Code nicht ersichtlich).
