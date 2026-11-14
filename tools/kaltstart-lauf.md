# Kaltstartlauf im Dev-Build (K11 klein) - Protokoll

Stand 14.11.2026. VORBEREITUNG: nichts hiervon wurde gestartet. Kein Browser,
kein Dev-Build, keine Bruecke, kein Spiel. Dieses Blatt ist die Vorlage fuer
den Lauf, den Eric oder eine begleitende Sitzung SPAETER freigibt.

Zweck (BAUPLAN Teil 3, K11): ein frischer Spielstand, Z1-Uebergabe, Startpfad
(`coldstart.js` auf 8 GB, Uebergabe an den Kern ab 32 GB), danach die Knoten
BN4.1, BN4.2, BN4.3, BN1.2 ueber Dev-Menue-Fixtures. Schliesst die offene
Messluecke "EBENE 3, KALTSTART" in `tools/test-alles.js` (MESSLUECKEN).
Grossform (Beobachtung von K05/K06/K08 ueber Tage) ist gestrichen.

## 0. Harte Zeilen (gelten vor allem anderen)

1. **Nie LIVE.** Nie Port 12525 oder 8795, nie `bitburner-official.github.io`,
   nie Erics Opera (Port 9222), nie ein zweiter Tab neben dem Live-Spiel.
   `pruefstand/cdp.js` bricht selbst ab, wenn ein Ziel `github.io` enthaelt;
   dann ist der Lauf zu Ende, nicht "das Ziel uebersprungen".
2. **Nie Dev-Build-Staende nach LIVE.** Das Dev-Menue zu oeffnen vergibt die
   Auszeichnung `YoureNotMeantToAccessThis` (`DevMenu.tsx:43-45`), und der
   Spielstand traegt sie fuer immer. Der Lauf-2-Spielstand in Erics echtem
   Spiel wird FRISCH angelegt - nie aus `pruefstand/` exportiert, geklont oder
   importiert. Keine Datei aus `pruefstand/browser`, `pruefstand/data`,
   `pruefstand/backups` wandert nach `data/`, `backups/` oder ins Live-Profil.
3. **Eigener Origin, eigenes Profil.** Dev-Build auf `http://localhost:8798`
   (`node pruefstand/serve.js --dev`), Browserprofil `pruefstand/browser`,
   Debug-Port nie 9222. Eigener Origin heisst eigene IndexedDB - der Live-Stand
   ist physisch nicht erreichbar.
4. **Rolle TEST**, Daten in `pruefstand/data` und `pruefstand/backups`. Die
   Bruecke im Worktree startet als LIVE gar nicht (Pfadriegel in
   `sync/instanz.js`) - das ist gewollt.
5. **Kein Ton, kein Mausfangen.** Browser mit `--mute-audio`. Arbeitet Eric
   nebenbei (RDP): nur headless oder mit ausdruecklicher Ansage. Vorher
   ankuendigen: ein Browser, ein Node-Prozess, Kerne gedeckelt
   (`node --import file:///<projekt>/tools/cpu.mjs ...`).
6. **Erst nach BN8.3.** Der Hauptbaum ist LIVE; dieser Lauf braucht ihn nicht
   zu beruehren und merged nichts.
7. Die Schutzregeln fuer LIVE (kein Handsprung, keine Augs von Hand,
   `b1tflum3`/Destroy nicht von Hand) gelten fuer den Live-Spielstand. Im
   Dev-Build ist Handarbeit ausdruecklich erlaubt - sie IST dort der Test.

## 1. Vorbedingungen (alles abhaken, sonst nicht anfangen)

| # | Bedingung | Pruefung |
|---|---|---|
| 1 | Branch `lauf2-kaltstart` zusammengebaut, `node tools/test-alles.js --nur-tests` gruen | Exit 0 |
| 2 | Z1 vorhanden: `tools/lauf2-uebergabe.js` (Trockenlauf ohne `--ausfuehren`, `--pin <identifier>` Pflicht) | `node tools/lauf2-uebergabe.js --help`; Aufrufform vor dem Lauf gegen die Datei pruefen (hier nur Sollbild) |
| 3 | Z6 vorhanden: `src/coldstart.js` (<= 5 GB, gemessen mit `tools/ram.js`), `boot.js`-Zweig fuer home < 16 GB | `node tools/ram.js` zeigt coldstart.js; `tools/test-coldstart.js` gruen |
| 4 | K01/K09 vorhanden: Lauf-2-Route, SF4-Riegel | `tools/test-route.js`, `tools/test-registry.js` gruen |
| 5 | Dev-Build gebaut: `reference/v301-dev/dist` | `pruefstand/build-v301-dev.cmd` (zieht den Produktionsstand kurz aus `reference/v301/dist` und holt ihn zurueck - nicht waehrend `serve.js` auf 8799 laeuft). Braucht `reference/` im Hauptbaum, nicht die Kopie im Worktree |
| 6 | Wegwerf-Datenordner: `pruefstand/data`, `pruefstand/backups` leer oder bekannt (Anker!) | der Anker der TEST-Rolle kommt aus `pruefstand/backups/INDEX.tsv` - ein alter Eintrag mit hoher Spielzeit weist den frischen Stand als Rueckwaertssprung ab. Vor Beginn sichern und leeren, danach die Altordner zurueck |
| 7 | Eric hat Zeitfenster, Last und Ton freigegeben | schriftlich im Chat |

## 2. Aufbau (Reihenfolge)

1. `node pruefstand/serve.js --dev` (Port 8798). Antwort pollen, bis der Port
   lauscht (feste Obergrenze, keine Endlosschleife), erst dann den Browser.
2. Browser mit eigenem Profil, stumm, Debug-Port ungleich 9222, URL
   `http://localhost:8798`. (Aufrufform des Browsers ist in diesem Repo nicht
   dokumentiert - vor dem Lauf erproben und hier nachtragen.)
3. Im frischen Spiel ZUERST: Optionen -> Remote API Port auf **12527** (so
   setzt `tools/klon.js --dev` den Port der Dev-Instanz; 12526 gehoert der
   Prod-Pruefinstanz auf 8799). Ein frisches Spiel hat keinen Port gesetzt;
   trotzdem pruefen, dass dort NICHT 12525 steht.
4. TEST-Bruecke: `node sync/bridge.js --instance TEST --rfa-port 12527
   --dash-port 8796 --master-liste pruefstand/master-liste-lauf2.txt`, wobei
   die Liste mit `git ls-tree -r --name-only lauf2-kaltstart -- src/` erzeugt
   wird (der Master-Riegel kennt sonst die neuen Dateien nicht). Die
   Erstbefuellung ist groesser als `SCHUB_MAX` (8 Dateien): dafuer
   `pruefstand/data/schub-frei.txt` laut `sync/bridge.js` (Kommentar bei
   `SCHUB_MAX`) - nur im TEST-Datenordner.
5. Z1 gegen TEST: erst Trockenlauf (Plan lesen), dann mit `--ausfuehren`
   gegen die TEST-Daten. Erwartung: Lauf-1-Kette archiviert, neuer Anker, der
   frische Spielstand wird NICHT abgewiesen, ein fremder Identifier weiterhin
   schon.

## 3. Stufen und Fixtures (Dev-Menue, Seitenleiste "Dev")

Das Menue gibt es nur im Dev-Build (`SidebarRoot.tsx:431`). Griffe:
General (Geld, "Max Home RAM" 8/64/1024..., "RAM *= 2", `Quick w0rld_d34m0n`),
Source-Files (Stufe je SF, setzt Besitz und Ueberschreibung), Time skip
(1 min / 1 h / 1 Tag), Servers (Root/Backdoor), Programs, Sleeves, Stats.

| Stufe | Herstellen | Erwarteter Zustand | Was gemessen wird |
|---|---|---|---|
| F0 BN1.1 frisch | neues Spiel, nichts am Menue | home 8 GB, SF keine, Geld ~1.000 | `coldstart.js` startet (von Hand: Terminal `run coldstart.js`), laeuft auf 8 GB, knackt, verdient; **keine** Singularity-Gewerke starten (K09) |
| F0b home 16/32 | `RAM *= 2` (8 -> 16 -> 32); echte Preise 1,01 Mio / 3,19 Mio nur zum Vergleich | home 16 dann 32 | Uebergabe `coldstart.js` -> `boot.js` ab 32 GB; Kern + Waechter + Wachhalter laufen; bei 16 GB bleibt `coldstart.js` |
| F0c Geld | General -> Give Money (Betraege aus `doku/lauf2-bn11-start.md`) | Geld nach Wahl | Hand-Kaeufe laut Anleitung (TOR, Programme); `darkweb.js` auf Ansage |
| F1 BN4.1 | in BN1.1: `Quick w0rld_d34m0n`, im BitVerse BN4 waehlen | SF1.1, home 32, Geld 1.000, Skripte da, nichts laeuft | `boot.js` von Hand starten (Rueckruf fehlt bei UI-Wahl, Befund P5/K06); Kern laeuft; erster Mietrechner, Einkommen, Zeit bis erstem 32-GB-Mietrechner (1,76 Mio) |
| F2 BN4.2 | in BN4.1 dieselbe Quick-Funktion, wieder BN4 | SF4.1, SF1.1 | Singularity-Gewerke starten jetzt (SF4 vorhanden, in BN4 Faktor 1); `homegrow.js` laeuft mit Kernsperre G50 (Log `data/homegrow.txt`: "Kern 2 nicht gekauft") |
| F3 BN4.3 | wie F2 | SF4.2 | wie F2 |
| F4 BN1.2 | in BN4.3: Quick, BN1 waehlen | SF4.3, SF1.1, home 32 | Singularity ausserhalb BN4 zum Faktor 1 (SF4.3); Route `planeRoute` liefert als Ziel den naechsten Routeneintrag, nicht BN10 |

Direkt-Fixture statt Kette (wenn nur eine Stufe zu messen ist): Source-Files
-> SF setzen, Knotenwechsel per `Quick w0rld_d34m0n`. Der Zeitsprung des
Menues verfaelscht die Wirtschaft (Einkommen ueber Zeit) - er gilt nur fuer
Mechanikproben (Offline-Gutschrift), nie fuer die Einkommensmessung.

## 4. Messgroessen (je Stufe in die Tabelle unten)

- Wanduhr bis Meilenstein: erster Verdienst, 16 GB, 32 GB, erster Mietrechner,
  erster Einbau (F1), Ziel erreicht.
- RAM: belegt/frei auf home je 5 min (`data/bn4net.json` `homeRam`, `homeFrei`).
- Neustartschleifen: Zahl der Prozessstarts je Gewerk (`data/watchdog.json`,
  Kernlog `data/bn4net-log.txt`); Soll 0 fuer Singularity-Gewerke in BN1.1 (K09).
- Einkommen: `ns.getMoneySources` ueber `node tools/task.js geld.js` (nur in der
  TEST-Instanz!) oder die Dashboard-Kurve auf 8796.
- Bruecke: Zahl abgewiesener Sockets, Alarmdateien in `pruefstand/data`.
- G50: Eintraege "Kern n nicht gekauft" / "home-Kerne auf n" mit Datum und
  `erwartetProS` zur Zeit des Entscheids (`data/bn4net.json` `stapel`).

## 5. Abbruchkriterien (sofort anhalten, Befund notieren)

1. Das Dev-Spiel verbindet sich mit 12525/8795, oder `cdp.js` meldet ein Ziel
   mit `github.io`. Tab schliessen, Lauf beenden, nichts weiter tun.
2. Die TEST-Bruecke meldet einen Identifier- oder Rueckwaertssprung-Alarm, der
   NICHT der erwartete Test ist (Z1-Gegenprobe), oder schreibt nach `data/`
   statt `pruefstand/data/`.
3. Eine Neustartschleife: mehr als 5 Starts desselben Gewerks in 10 Minuten.
4. Kein Fortschritt: ueber 2 h Wanduhr kein neuer Meilenstein in F0/F1, oder
   ueber 6 h je Stufe F2-F4 ohne Ziel (Obergrenze, nicht Ziel).
5. Eric meldet Last, Luefter oder Ton - pausieren (Browser schliessen), nicht
   weiterlaufen lassen.
6. `reference/v301/dist` fehlt nach dem Build (Produktionsstand nicht
   zurueckgeholt): erst `ren dist-prod dist` pruefen, dann weiter.
7. Gesamtdauer ueber 24 h Wanduhr: abliefern, was da ist.

Nach dem Lauf: `serve.js` und Browser beenden (`Stop-Process`), TEST-Bruecke
beenden, Altordner `pruefstand/data`/`backups` zurueck, Ergebnis als Tabelle
unten in `nodes/audit-lauf2/` ablegen. Nichts davon wird committet, was
Spielstandsdaten enthaelt.

## 6. Ergebnisvorlage

| Stufe | Start | Ende | Meilensteine (Zeit) | RAM-Spitze home | Neustarts | Einkommen $/s | Befund |
|---|---|---|---|---|---|---|---|
| F0 | | | | | | | |
| F0b | | | | | | | |
| F1 BN4.1 | | | | | | | |
| F2 BN4.2 | | | | | | | |
| F3 BN4.3 | | | | | | | |
| F4 BN1.2 | | | | | | | |

## 7. Offen (vor dem Lauf zu klaeren)

- Aufrufform des Browsers mit Profil, Debug-Port und `--mute-audio`: in diesem
  Repo nicht dokumentiert (`pruefstand/cdp.js` fordert nur Profil unter
  `pruefstand/` und Port ungleich 9222).
- Genaue Aufrufform von `tools/lauf2-uebergabe.js` (A1) und der Name der
  Handanleitung (`doku/lauf2-bn11-start.md`, A4): nach dem Zusammenbau gegen
  die fertigen Dateien abgleichen.
- Ob der Zeitsprung des Dev-Menues Offline-Zeit (`storedCycles`) oder nur
  Spielzeit bucht - fuer Offline-Mechanikproben vorher mit einem Wegwerfstand
  testen.
- Ob `Quick w0rld_d34m0n` das SF-Level wie ein echter Ausgang erhoeht
  (`finishBitNode`, `GeneralDev.tsx`) - an Stufe F1 zuerst pruefen; sonst SF per
  Source-Files-Tab setzen.
