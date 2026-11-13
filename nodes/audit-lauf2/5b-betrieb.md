# Teil 5b - Betrieb rund um den Bot (Werkzeuge, Memory, Skills, Fehlermuster)

Stand 13.11.2026. Nur gelesen (grep, Dateikoepfe, Git-Log), nichts ausgefuehrt, nichts geaendert.
Massstab: Lauf 2 (frischer Spielstand BN1.1, 8 GB home, keine Source-Files).
Belege als Datei:Zeile. Wo ich nur aus dem Dateikopf urteile, steht "(Kopf)".

## 0. Kurzfassung - die sechs wichtigsten Befunde

1. **Lauf 2 laeuft auf nichts, was getestet ist.** `tools/test-kaltstart-budget.js:73-95` rechnet mit `HOME_GB = 32` und
   dem SF-Stand aus Lauf 1 (`sf = {1,4,5,6,10}`); der 8-GB-Zweig `: 8` ist nie Eingabe. Der gesamte Wiederanlauf
   (`src/boot.js` -> `bn4net.js` -> `bn4life.js`/`bn4rep.js`) setzt SF4.1 und 32 GB voraus. Fuer BN1.1 ohne SF4 gibt es
   keinen Start-Skill, keinen Test und keinen registrierten Pfad (`autopilot.js`, `hand.js`, `join.js`, `buyaugs.js`,
   `work.js` stehen in src/, sind aber nicht in `src/registry.json`).
2. **Die Sicherungskette lehnt einen frischen Spielstand ab.** `sync/backup.js:249-256` (Rueckwaertssprung
   totalPlaytime), `:258` (bitNode) und `sync/instanz.js:47` (`LIVE_IDENTIFIER = "197f4d61481686"` fest verdrahtet) -
   ein neues Spiel faellt durch alle drei. Es gibt kein "neuer Lauf"-Verfahren. Der Schutz, der Erics Spielstand retten
   soll, wuerde Lauf 2 komplett ohne Sicherung lassen (Alarm "Bruecke ohne Sicherung").
3. **Die Testsuite hat 12 verwaiste Tests und ein Dauer-Rot.** 106 `test-*.js`, nur 93 in `test-alles.js`; seit
   30.10. wurde kein neuer eingetragen (BN8-Block, Casino, Hoffnung, Restertrag, Ereignisstrom, Raid-Stadt, gocheat ...).
   Ausserdem endet die Suite ohne `--nur-tests` immer mit Exit 1, weil `MESSLUECKEN` (`test-alles.js:550-585`) veraltete
   Eintraege traegt ("BN8/9 nur gerechnet", "Kaltstart nie gemessen") - niemand ruft sie als Tor auf.
4. **Stille Sperre existiert weiter als Bauform:** Ein Werkzeug mit `state:"blocked"` ist vom Waechter unbefristet
   freigestellt (`src/guard.js:1004`, `src/lib/leiter.js:168`). Genau das war der 11.11.-Fall (Firmenphase sperrt faellige
   Einbaurunde 2 ueber `install-sperre.txt`, von Hand gefunden).
5. **Skills widersprechen sich und dem Code.** `skills/bb.md` im Repo (Kopie) sagt "kein Optimieren, keine Subagenten"
   und ist das Gegenteil des aktiven `~/.claude/skills/bb/SKILL.md`; die README sagt, der aktive Ort sei
   `claude_projecto/.claude/skills` (stimmt seit 19.09. nicht). Wer der README folgt ("Datei hier aendern, dann nach
   .claude/skills kopieren"), ueberschreibt den Arbeitsauftrag-Skill mit der Fassung vom 31.08. `bitburner/SKILL.md` und
   `bb-loops/SKILL.md` beschreiben die Betriebsart vom August.
6. **Die Betriebsart "Dauerwache" ist nur halb abgebaut:** `wache.js` (1203 Z), `aufsicht.js`, `watch.js`, `tick.js`,
   `nightshift.js`+`nacht.cmd`, `autostart-einrichten.cmd` liegen aktiv im Baum; zwei Werkzeuge
   (`rueckstand.js:79`, `staedte.js:47`) empfehlen im Fehlerfall `node tools/aufsicht.js`, das /bb ausdruecklich verbietet.

## 1. Die neun Fehlermuster - verankert oder nur Notiz?

Bewertung: **verankert** = eine automatische Gegenmassnahme wuerde das Muster beim naechsten Auftreten ohne Mensch
melden/verhindern; **teilweise** = Einzelfaelle oder Klasse zum Teil; **nur Notiz** = Lehre steht in Memory/Kommentar/Doku.

| # | Muster | Urteil | Beleg (was existiert) | Luecke (was fehlt) |
|---|---|---|---|---|
| 1 | Stille Sperre ohne Alarm | **teilweise** | Ablauf: `hotswap-freigabe.txt` verfaellt nach 30 min (`sync/bridge.js:527`); Host-Sperre mit `bis` (`guard.js:1484`); `install-sperre.txt` traegt `bis` (`lib/handschlag.js:308`); Strafleiter + Uhren (`test-leiter.js`). Alarme: `## Sofort`-Eintraege der Bruecke (Autosave, Telemetrie, Spiel-Tab). | (a) `blocked` = unbefristet freigestellt (`guard.js:1004`, `leiter.js:168`); `BLOCKGRUENDE "locked"` (`lib/herzschlag.js:60`) wird von niemandem ausgewertet (grep: nur Definition). (b) Kein generischer Befund "Einbau faellig (Geld+Ruf da), aber seit X h nichts passiert" in `checkin.js` - der 11.11.-Fall wurde von Hand gefunden. (c) Alarme in `## Sofort` laufen nie ab: "Telemetrie veraltet" vom 08.11. steht noch, 7x "Schub verweigert", 811 Zeilen Sofort-Abschnitt (BAUSTELLEN.md:508-1319), davon ein Teil "UEBERHOLT". (d) Bruecke tot meldet nur /bb selbst (kein Push, Erics Entscheidung) - bleibt Betriebskosten. |
| 2 | Kaltstart/Knotenwechsel nie im Zielzustand getestet | **teilweise, fuer Lauf 2 nein** | `test-kaltstart-budget.js` (32-GB-Budget), `test-matrix-ebene2.js` (Klassen BN10/V2/Kaltstart, BN9, BN8, BN4), `test-zielvalidierung`, `test-bn4life-beitritt`, `test-kernwache`. | Zielzustand Lauf 2 (BN1.1, 8 GB, SF0, Singularity 16x-Aufschlag entfaellt/ist unerreichbar) wird nirgends gestellt (`HOME_GB = 32` fest, `test-kaltstart-budget.js:73`). Die Mess-Luecke "echter Knotenwechsel auf 32 GB" steht noch in `MESSLUECKEN`, obwohl ~40 Wechsel passiert sind - die Liste ist nicht gepflegt. |
| 3 | Gebaut, aber nicht angeschlossen | **teilweise** | `tools/lib/schreiberprobe.js` (jedes `telemetryFile` hat Schreiber), `test-exportpruefung`/`importpruefung.js` (Importe), `test-scope-tot`, `test-registry` (Rollen-Riegel), `test-verbote` ("unregistriert"), Ebene-2-Tests mit Verdrahtung (`test-handel.js` Kopf: "am 10.11. war ein Aufruf mit falscher Signatur der Grund, dass ein ganzes Feature tot war"). `tools/audit/datenfluss.mjs` (Schreiber ohne Leser, mit Selbstprobe) und `tools/kpi-luecken.js`. | Datenfluss und kpi-Luecken sind **nicht in der Suite** (`grep test-alles.js` leer): Lauf nur auf Zuruf. Kein Test "jedes neue Gewerk wird irgendwo in einem Knoten gestartet / hat einen Leser". Casino (13.11.) und BN8-Block (10.11.) kamen ohne Suite-Test in den Betrieb (Tests existieren, sind aber verwaist, s. Muster 5). |
| 4 | Uhr falsch | **teilweise** | `lib/uhren.js` + Uhren-Lint fuer Waechterfristen (`test-leiter.js` "eine unbekannte Uhr wird beanstandet"), `test-motorzeit`, `test-stillstandsuhr`, `test-notexec-frist`, `test-handschlag-nachblick`, `test-reserve-eta`. | Kein Lint ueber den Rest: `Date.now` steht in ~35 src-Dateien (bn4rep 74x, bn4net 55x, ausgang 27x, blade 20x); keine Pruefung "Echtzeit-Frist gegen Aktion in Spielzeit". `tor.js` Wanduhr-Befund (10.09.) und V30/V32 (Nachtluecke als Stillstand) sind Einzelfixes. |
| 5 | Pruefinstrument prueft nicht das Gebaute | **teilweise** | Selbstproben: `test-verbote` (jedes Muster), `test-scope-tot`, `test-ram-namen`, `datenfluss --selbstprobe`; `test-lader` (Pruefstand selbst); `test-verbote --bau` prueft den Worktree; Eichstempel `test-ram.js:147`. | **12 Tests nicht in der Suite**: `test-bn8-einbaurunde, test-bn8-tdh, test-bn8-xp, test-bn8plan, test-boersepause, test-casino, test-ereignisstrom, test-gocheat, test-handel, test-hoffnung, test-raid-stadt, test-restertrag`. Die Suite hat keine Pruefung "jede `test-*.js` ist eingetragen" - obwohl ihr Kopf selbst sagt "Ein Test, der hier fehlt, wird nicht gefahren" (`test-alles.js:25`). Ebenso: `ENTSCHIEDEN`-Text meldet "graftplan.json NICHT eingespielt" (`:600ff`), seit 07.11. falsch - die Suite gibt veraltete Aussagen aus. |
| 6 | Konstante aus anderem Knoten | **teilweise** | `KNOTEN_MARKEN`/`knotenMarkeGilt` (`lib/reg.js`), `test-knotenmarke`, `test-gang-knoten` (Fehlalarm aus Vorknoten), `CORP_MONEY_NODES` (`test-syndicate-reise`), Matrix ueber Klassen. | Kein Lint auf Knotenliterale: 29 Treffer `node/knoten/bn ===|!== <Zahl>` in src (reg.js 3, homeram.js 3, hackaugs.js 2, hashes.js 2 ...). `test-matrix` deckt 5 Klassen, nicht 15 Knoten einzeln. |
| 7 | Entscheidung "vor dem Knoten" zurueckgestellt | **nur Notiz (+ ein Mechanismus)** | `route.json` Feld `braucht` (Gewerk-Datei muss auf home liegen, sonst GEWERK FEHLT; `src/route.json` Kopf) - aber nur fuer `hashes.js` (BN9) gepflegt. `nodes/KNOTEN-VORBEREITUNG.md`. Memory `bitburner-audit-mechaniken-2026-11-07`: "vor Knoten X bauen muss gebaut werden". | Kein Vorlauf-Check: "welches Gewerk fehlt in den naechsten k Eintraegen der Route fuer einen Knoten, den ein Mensch/Lauf in <48 h erreicht?" `checkin.js` meldet Gewerke erst am fertigen Knoten. BN8-Block wurde am 10.11. im laufenden Knoten gebaut. |
| 8 | Lehre nur in einer Notiz | **nur Notiz (Prozessmuster)** | Befund-> Test -> Commit mit `[skeptiker]` ist Regel in CLAUDE.md/Memory; viele Lehren sind inzwischen Tests (jeder Test nennt sein Befunddatum im `deckt`-Text). | Aktuelle Instanzen: (a) "Beim /bb in BN8 pruefen: data/bn4rep.json Feld bn8, boerse.json, casino.json" steht nur in `bitburner-endspurt-bn8.md`; `checkin.js` kennt weder Boerse, Casino noch bn8plan (grep Boerse/casino/bn8: nur Kommentarzeile 128). (b) "Neue src-Datei sofort mit lib committen, sonst scheitert der naechste Neustart" nur in Memory; der Riegel "Schub verweigert" blockiert nur, er verhindert nicht den halben Stand. (c) "faelliger Einbau ohne Bewegung -> install-sperre.txt/rep-modus.txt ansehen" nur Memory. (d) `ETA-Lehre` ist im Code (`rangkurve`), ok. |
| 9 | Gleiche Fehlerklasse an naechster Stelle wiederholt | **teilweise** | Klassentests: `test-scope-tot` (toter Aufruf im try/catch), `test-ram-namen` (wakelock-Klasse), `test-verbote` (Selbstblockade), `test-exportpruefung`. | Nach jedem Einzelfix gibt es keine Pflicht "Klasse geschlossen?"; V63 `wache.js`->`aufsicht.js` und V51 `figurns.js` zeigten das. Kein Mechanismus, der eine Klasse findet, bevor sie sich wiederholt. |

Gesamt: 0 von 9 vollstaendig verankert, 7 teilweise, 2 nur Notiz. Am groessten ist der Unterschied zwischen "Test existiert"
und "Test wird gefahren" (Muster 5/3).

## 2. Werkzeuge (tools/, 171 Eintraege: 106 Tests, 303 Dateien in tools/audit, mock/, lib/, bbrank/, goprobe/, einmal/)

Methode: Aufrufer per grep (src, sync, andere tools, Skills, .cmd), Kopf gelesen. Nicht ausgefuehrt.
Ein Treffer in `nodes/` zaehlt nicht als Aufrufer (nur Doku).

### 2a. Tot oder Altbetrieb (aus dem Pfad nehmen)
| Datei | Grund |
|---|---|
| `wache.js` (1203 Z, letzter Commit 31.08.) | Residenter Waechter mit ntfy; `start.cmd` verbietet ihn namentlich; Waechter im Spiel (`guard.js`) loest ihn ab. Nur `test-kernwache`/`strategie-check` erwaehnen ihn in Kommentaren. |
| `aufsicht.js`, `autostart-einrichten.cmd` | Startet wache; Autostart-Ordner ist leer (geprueft: nur `desktop.ini`); Eric hat Autostart am 23.09. und 03.11. abgelehnt (BAUSTELLEN.md:651, Memory). `autostart-einrichten.cmd` legt das Gegenteil von Erics Entscheidung an. |
| `watch.js`, `tick.js` | Aug-Wecker/20-min-Zwischenstand; Dauerloops sind seit 31.08. abgeschafft. `tick-last.json` vom 21.08., `watch-verlauf.json` vom 22.08. liegen noch in data/. |
| `nightshift.js` + `nacht.cmd` | Steuert Faktionsarbeit und KAUFT Augmentierungen ueber die Oberflaeche; der Bot macht Einbau/Faktion selbst (`bn4rep.js`), "Augs von Hand" ist verboten. Skill `bitburner` bewirbt es weiter. |
| `status.js`, `plan.js`, `bn4.js`, `bn4watch.js`, `meter.js`, `ziele.js` | BN4-/Aug-Zeit-Lagebilder auf `/api/state`-Telemetrie des alten Autopilot. Die Bruecke pollt `telemetry.txt` nicht mehr (`bridge.js:2048` "entfallen"; `data/ziele.md` 29.08.). `plan.js` bildet den BN1-Pfad Zugriff->Faktion->Rep ab, aber gegen eine Quelle, die der heutige Bot nicht schreibt - irrefuehrend (nicht ausgefuehrt, daher "vermutlich"). |
| `fortschritt.js` | "Bau-Prozent alle 30 min" fuer den Neubau 09/2026; Bau ist abgeschlossen. |
| `libverteilen.js`, `archivliste.js`, `archivpruefung.js` | Einmalwerkzeuge der Einspielung 04.09. (Kopf), kein Aufrufer ausser nodes/. |
| `hashrang-rechnung.mjs`, `hashrang-sp.mjs`, `sleeve-rechnung.js`, `trupp-rechnung.js`, `graftnext.js` | Einmalige Rechnungen/Handwerkzeuge der Audits; Rechenergebnis ist im Code (`graftauto.js`, `bn4life`), `graftnext` ersetzt durch graftauto. Nach `tools/audit/` bzw. archiv verschieben. |
| `tools/audit/` (303 Dateien, 2,5 MB) | Beweisskripte der Audits. Nur ~14 werden von Tests importiert (`boerse-sim`, `bn8-route`, `gang-*`, `tor-runde-fixture`, `spanne2`, `b5-check`, `batchmodel`, `boerse-regel`). Der Rest ist Beleg, kein Werkzeug - dort lassen, aber die 14 in einen Unterordner `tools/audit/lib/` trennen, damit ein Loeschen sie nicht trifft. |

### 2b. Doppelt oder irrefuehrend
- **Vier "Lage"-Werkzeuge:** `checkin.js` (aktuell, vom Dashboard alle 5 min benutzt), `lage.js` (liest `getSaveFile`, lebt), `status.js`/`plan.js` (tot, s. o.). Skill `bitburner` nennt `lage.js`/`watch.js`/`nightshift.js`, Skill `bb` nennt `plan.js` (3. Abschnitt) - beide Pfade zeigen auf Altes.
- `rueckstand.js:79` und `staedte.js:47` drucken "Laeuft die Bruecke? (node tools/aufsicht.js)". Irrefuehrend: Der richtige Befehl ist der WMI-Start (Skill /bb).
- `hotswap.js` (Checkliste, Freigabe) und `einspielen.js` (Stufen mit Gegenprobe) sind beide lebendig (je >=7 Treffer in src/Kommentaren, 23 in doku/). Nicht doppelt, aber nirgends in einem Satz abgegrenzt - eine Zeile in `doku/` oder im Dateikopf genuegt.
- `tools/backup.js` (Handausloeser) gegen `sync/backup.js` (Ablage): kein Doppel, nur Namensgleichheit.
- `v1kurve-bauen.js` (V1) neben `rangkurve-bauen.js` (V2): Beide gehoeren zu `checkin.js`, `v1kurve-bauen` ist laut Kopf nur Handfallback. Behalten.
- `firma.js`: Firmenphase M4 per Datei `company-order.txt`; in BN8 abgeschaltet (11.11.), in BN3 nutzt Corp einen eigenen Weg. Aufrufer nur Kommentar. Pruefen, ob noch gebraucht, sonst archivieren.

### 2c. Lauf 2 braucht zwingend (Kernbestand)
`test-alles.js` (+ aufraeumen), `checkin.js` (+ `lib/*`), `einspielen.js`, `hotswap.js`, `neustart.js`, `importpruefung.js`,
`registry-bauen.js`, `ram.js`/`ramkosten.js`/`ram-namen.js`/`eichung-messen.js`/`eichung-stempeln.js`, `backup.js`,
`backup-check.js`, `wiederherstellung.js`, `rollback.js`, `klon.js` (Testinstanz mit gepatchtem Port), `task.js`, `save.js`,
`lage.js`, `tor.js` (V2-Anlauf), `rueckstand.js`, `spann.js`, `staedte.js`, `strategie-check.js` (von /bb genannt),
`liste.js` (BAUSTELLEN), `kpi-luecken.js`, `bitnodes-tabelle.js`, `blackops-tabelle.js`, `graftplan-bauen.js`, `syntax.js`,
`reserve.js`, `ratencheck.js`, `hand.js` + `ui.js` (**Lauf-2-Startpfad ohne SF4**, s. Abschnitt 4), `mock/`, `goprobe/`,
`bbrank/` und alle Tests ausser den in 2a genannten. `rangkurve-bauen.js`, `v1kurve-bauen.js` als Handfallback.
`ui.js` (1403 Z, Stand 19.08.) und `hand.js` sind fuer BN1.1 ohne SF4 der einzige Weg - dort ist zu pruefen, ob sie gegen
die heutige Oberflaeche (3.0.1) und das Verbot "keine Browserzugriffe von aussen" (Memory `bitburner-werkzeuge`) noch einen
tragfaehigen Weg ergeben.

### 2d. Suite-Zustand
`test-alles.js`: 93 Eintraege, 12 verwaist, `MESSLUECKEN` mit 10 Eintraegen (mind. 3 erkennbar erledigt/veraltet: "BN8/9 nur
gerechnet", "Kaltstart nicht gemessen", "Graftplan nicht eingespielt" in ENTSCHIEDEN). Exit-Code ohne `--nur-tests` ist
dauerhaft 1 (`test-alles.js:436-440`); der einzige Aufruf mit `--nur-tests` steht in Abnahmedokumenten der Worktrees.
Kein Skill ruft die Suite.

## 3. Memory-Notizen (bitburner*.md, 29 Dateien) und MEMORY.md

Bewertung: **gueltig** / **veraltet** / **Widerspruch** / **-> Repo** (gehoert ins Repo, nicht ins Memory).

| Notiz | Urteil | Befund / Vorschlag |
|---|---|---|
| `bitburner.md` (19.08.) | **veraltet** | Beschreibt den Aug-Aufbau: "home hat nur 8 GB, Autopilot ~6.5 GB", "Offene Kernfrage SF4: Browser-Automation", Opera-Tab-Fallen. Teile gelten fuer Lauf 2 wieder (8 GB, ohne SF4), stehen aber als historischer Stand. Vorschlag: auf 10 Zeilen kuerzen (Port 12525/8795, Repo, reference/v301) und den Rest nach `doku/` bzw. loeschen. |
| `bitburner-lauf2-grundsatz.md` (13.11.) | **gueltig** | Aktuell, Eric-Entscheidungen. Behalten. |
| `bitburner-endspurt-bn8.md` | **gueltig, aber ueberladen -> Repo** | Mischt Auftrag, Baustand, /bb-Pruefliste und Betriebsregel. Die Pruefliste ("data/bn4rep.json Feld bn8, casino.json phase done winnings > 10e9") gehoert in `checkin.js` (Muster 8). Widerspruch zur Notiz `bitburner-dashboard`: "Spiel verbindet sich nach Rechner-Neustart nicht von selbst, Eric muss Connect klicken" gegen "Bruecke verbindet sich nach Neustart per WMI von selbst (10 s)". Beides stimmt fuer verschiedene Faelle (Rechner-Neustart = Tab zu; Bruecken-Neustart = Spiel verbindet sich) - nicht so notiert. |
| `bitburner-bruecke-stirbt.md` | **gueltig, Teil-Luecke** | Befund wahr (BAUSTELLEN.md:651 "ENTSCHIEDEN", V33: 10 Tode). Der WMI-Befehl startet `node sync/bridge.js` direkt, nicht die Neustartschleife `sync/bridge-start.cmd`; die Schleife (faengt Abstuerze, `bridge-start.cmd`) ist ungenutzt. Siehe B05. |
| `bitburner-checkin-statt-loops.md` | **Widerspruch** | Sagt "Skill ist bewusst duenn, KI urteilt nur" und verweist auf `bitburner/skills/bb.md` als versionierte Kopie - beides durch `bitburner-bb-ist-arbeitsauftrag` (22.09.) ueberholt. Nachtrag fehlt. Vorschlag: obersten Absatz "ueberholt durch ..." oder Notiz in die andere mergen. |
| `bitburner-bb-ist-arbeitsauftrag.md` | **gueltig** | Sagt selbst, dass der Skill-Text angepasst wurde - Repo-Kopie wurde es nicht (s. 4). |
| `bitburner-befund-sofort-bauen.md` | **gueltig** | Widerspruch zur Praxis: `## Sofort` in BAUSTELLEN.md ist ein 811-Zeilen-Archiv von Auto-Alarmen (siehe Abschnitt 5). |
| `bitburner-keine-entscheidungen-eric.md` | **gueltig** | Ausnahme in `lauf2-grundsatz` erklaert. Gut. |
| `bitburner-knapp-berichten.md`, `bitburner-begriff-einbaurunde.md` | **gueltig** | Beide koennten zu einer Berichts-Notiz verschmolzen werden (zwei sehr kurze Dateien). |
| `bitburner-eigene-session.md` | **teilweise veraltet** | "Skill /bb ist global" gilt; "Bruecke stirbt weiterhin still (ungeloest)" gilt; Rest ist Begruendung 19.09. |
| `bitburner-werkzeuge.md` (20.-27.08.) | **veraltet** | Nennt `watch.js`, `tick.js`, `augplan.js` (**Datei existiert nicht mehr**, geprueft), `aufsicht.js --dauer` "liegt im Autostart" (Autostart-Ordner leer), "Eric will alle 20 min Zwischenstand". MEMORY.md:71 bewirbt sie weiter als "plan.js, save.js, hand.js". Vorschlag: auf die Fallstricke reduzieren (Netz wird bei jedem Reset neu verdrahtet, `ns.read/write` auf Skript-Rechner, `WERKZEUG x.js` mit Endung) und ins Repo (`doku/`), Werkzeugliste streichen. |
| `bitburner-nachtlauf.md` | **veraltet** | `nightshift.js`/`nacht.cmd` sind Altbetrieb; Bot kauft/wechselt selbst. Die sechs Fehler sind historisch. Loeschen oder auf "abgeloest" kuerzen. MEMORY.md:71 listet sie als Technik. |
| `autonomer-lauf-absichern.md` (25.08.) | **gueltig, -> Repo** | Reine Methodenlehre ("im Zielzustand testen"). Ist Muster 2; gehoert in ein Repo-Dokument `doku/bauregeln.md`, dann mit Test verknuepft. |
| `cron-blockade-hintergrundtasks.md` | **gueltig, doppelt** | Steht wortgleich als Abschnitt in der globalen `~/.claude/CLAUDE.md`. Memory-Kopie streichen oder Kurzverweis. Bitburner-Loops existieren nicht mehr; Gueltigkeit nur noch allgemein. |
| `browser-tab-drosselung.md` | **gueltig** | Passt zu `wakelock.js`; `checkin.js` schreibt "Tab verdeckt/OHNE Tonanker". Nicht bitburner-spezifisch benannt, aber im Index. |
| `bitburner-roadmap.md` | **Widerspruch** | Zielfunktion "Level 3 ueberall = 45 Laeufe, BN12 mitgelevelt" gegen Entscheidung 12.11. "BN12 nicht leveln"; "BN8 zuletzt" stimmt faktisch nicht mehr (BN8 ist jetzt dran, Endspurt). Als "UEBERHOLT"-Notiz mit Verweis auf `nodes/audit-lauf2/REIHENFOLGE.md` markieren, sonst liest Lauf 2 die falsche Reihenfolge. Pfade `nodes/ROADMAP.md`, `nodes/bn4/PLANER.md` existieren. |
| `bitburner-audit-autonomie.md` | **veraltet** | Befund "kein Uebergang autonom" gilt seit 02.09. nicht mehr (ausgang.js). Nebenbefund "Autostart-Cmd startet wache" erledigt. -> historisch markieren. |
| `bitburner-audit-perfekt.md` | **veraltet** | "PAUSIERT, Wiedereinstieg Abschnitt PAUSE" - seit 26.09. nicht angefasst, durch spaetere Audits (03.10., 07.11., Lauf 2) ueberholt. Entscheiden: verwerfen oder ausdruecklich in Lauf-2-Audit aufgehen lassen. |
| `bitburner-audit-vollstaendig.md` | **gueltig (abgeschlossen)** | "Gegenpruefung nicht ungefragt wieder aufnehmen" - Regel bleibt. |
| `bitburner-audit-mechaniken-2026-11-07.md` | **teilweise veraltet** | "Offen: Einbau-Takt BN8" ist durch BN8-Route (10.11.) beantwortet. |
| `bitburner-auftrag-neubau.md` | **-> Repo** | Verweist auf Datei im Repo; Memory-Eintrag nur Zeiger. Auf 3 Zeilen kuerzen. |
| `bitburner-bn6-hebel.md`, `bitburner-eta-lehre.md`, `bitburner-formeln.md`, `bitburner-oberflaeche.md`, `bitburner-stadtwahl-wert.md`, `bitburner-go-mcts.md`, `bitburner-corp-bn3.md` | **gueltig, -> Repo** | Technische Befunde mit Quellzeilen; gehoeren zu `doku/` (dort teilweise schon: `formeln-*.md`, `oberflaeche-*.md`). `bitburner-oberflaeche.md` wird fuer BN1.1 ohne SF4 wieder wichtig. Gepruefte Behauptungen: `tools/bbrank/bbmodel.mjs`, `tools/goprobe/vergleich.sh`, `src/lib/corpgeld.js`, `/api/verdict|history|refcurve` (`bridge.js:2493-2521`) existieren. |
| `bitburner-dashboard.md` | **gueltig** | Stimmt gegen `bridge.js`. |
| `bitburner-spielstand-schutz.md` | **gueltig, Luecke** | Sagt nichts zum Neuen-Spiel-Fall (identifier fest, Rueckwaertssprung). Fuer Lauf 2 ergaenzen (B02). |
| `bitburner-reference-junction.md` | **gueltig** | Gilt weiter (Worktrees, 12 Stueck). |
| `MEMORY.md` Zeilen 67-75 | **gueltig, Auswahl falsch** | Index ist sauber verdichtet (alle 29 Notizen aufgefuehrt). Aber Z.71 "Werkzeuge (plan.js...)" und "Nachtlauf (nacht.cmd)" zeigen auf Altes; Z.75 `Cron-Blockade` ist doppelt zur globalen CLAUDE.md. |

Dichte: 29 bitburner-Notizen, davon ca. 7 veraltet/ueberholt (`bitburner`, `werkzeuge`, `nachtlauf`, `roadmap`, `audit-autonomie`,
`audit-perfekt`, `checkin-statt-loops` teilweise), ca. 9 besser im Repo. Memory sollte Arbeitsweise und Entscheidungen
halten, nicht Mechanik-Befunde mit Zeilennummern.

## 4. Skills

| Skill / Datei | Befund |
|---|---|
| `~/.claude/skills/bb/SKILL.md` (aktiv, global, **nicht versioniert**) | Gut und aktuell im Kern (Arbeitsauftrag, WMI-Start, Tab-Hinweise). Veraltet/falsch: (1) "der Windows-Autostart `Bitburner-Aufsicht.cmd` wirft ihn beim Hochfahren an" - Autostart-Ordner ist leer; (2) Urteilstabelle kennt `BLOCKIERT` nicht, das `checkin.js:361` ausgibt; (3) Abschnitt 3 empfiehlt `tools/plan.js` (Altbetrieb); (4) "Eric spielt Bitburner, wenn er am Rechner sitzt" ist durch Endspurt/Nachtlaeufe ueberholt; (5) nichts zu BN8 (Boerse/Casino/Einbaurunde), nichts zu "Schub verweigert", nichts zu "Spiel-Tab nicht verbunden"/Autosave; (6) der WMI-Befehl startet nicht die Neustartschleife. |
| `bitburner/skills/bb.md` (Repo-Kopie) | **Widerspruch**: Stand 31.08.-Text mit "kein Optimieren, keine Subagenten, Befund eintragen"; entspricht dem Gegenteil des aktiven Skills. `skills/README.md` sagt "aktiver Ort ist `.claude/skills/`, erst hier aendern, dann kopieren" - falsch seit 19.09. Gefahr: ein Kopiervorgang nach README stellt den alten Text wieder her. Der aktive Skill liegt in `~/.claude/skills/bb` und ist in keinem Git-Repo. |
| `claude_projecto/.claude/skills/bitburner/SKILL.md` (213 Z) | **Veraltet**: Wiedereinstieg per `lage.js`/`watch.js` "mindestens alle 30 Minuten", Nachtlauf `nightshift.js`, Resets "ausloesen, wenn faellig" (Bot springt selbst), "Argos"-Rolle, kein Browser. Widerspricht /bb in fast jedem Satz. Wertvoll darin: "Die Fallen, die schon Stunden gekostet haben" (Zeugen/DOM/ns.scan) - die gehoeren fuer Lauf 2 (ohne SF4) in `doku/`. Vorschlag: Skill auf 20 Zeilen "Verweis auf /bb" kuerzen oder loeschen. |
| `.claude/skills/bb-loops/SKILL.md` | Selbst als abgeloest gekennzeichnet (Beschreibung beginnt "ABGELOEST SEIT 31.08.2026"); verweist auf `loops/*.md`. Kann archiviert werden; `loops/` (6 Dateien) ebenso. |
| `.claude/workflows/bitburner-baustellen-audit.js`, `bitburner-perfekter-bot-prompt.js` | Einmal-Workflows mit festverdrahteten Scratchpad-Pfaden aus einer alten Sitzung (`AUD = .../ce4bfa0a-.../scratchpad/audit`) und `M = 'opus'` (verstoesst gegen "Subagents sonnet"). Nicht wiederverwendbar; nach `archiv/` oder als Vorlage markieren. |
| **Fehlt fuer Lauf 2** | (1) Ein Start-Skill/Kapitel "Lauf 2 starten": neuer Spielstand, Brueckenstart mit neuer Identitaet, Sicherungsepoche, `data/`-Altlasten (ausgang.json, route.json, verlauf, v1kurve) auf Lauf 2 stellen, Autoexec `boot.js` setzen, BN1.1-Pfad ohne SF4. (2) /bb-Abschnitt "BN8/Einbaurunde faellig-und-gesperrt" bzw. in `checkin.js`. (3) Regel "Memory-Notiz fuer Mechanik, Skill fuer Ablauf, Repo-Doku fuer Befund" - heute alles in Memory. |

## 5. Wiederkehrende Betriebskosten

| Thema | Stand | Kostet in Lauf 2 weiter? |
|---|---|---|
| Bruecke stirbt still | Ursache ungeloest (Job-Objekt vermutet); 10 Tode seit 12.09. (V33), WMI-Start seit 29.09., trotzdem Tod am 03.11. Kein Autostart (Erics Entscheidung 23.09. und 03.11., nicht wieder vorschlagen). WMI startet `bridge.js` direkt, die Schleife `bridge-start.cmd` bleibt ungenutzt. | **Ja.** Folgen: Sicherung steht ("511 min alt" am 12.11.), kein Hotswap, /bb "BLIND". Guenstigster Hebel: WMI soll die Schleife starten (B05). |
| Spiel verbindet sich nach Rechner-Neustart nicht | Tab zu -> Bot steht (Engine stellt Skripte beim Laden wieder her, `boot.js` als Autoexec seit 02.09. gesetzt, BAUSTELLEN.md:174). Verbindung zur Bruecke (Options -> Remote API -> Connect) von Hand; Bruecken-Neustart dagegen verbindet in ~10 s von selbst (12.11. gemessen). Eintrag "Spiel-Tab nicht verbunden seit 11.11. 16:06" steht noch in `## Sofort`. | **Ja**, jede Offline-Luecke in V1-Knoten verliert Fortschritt (V49: 138 W). Hebel: Handgriff dokumentieren, Alarm mit Ablaufzeit statt Dauereintrag. |
| Zweit-Tab-Sperre | `data/zweittab-alarm.json` heute nicht vorhanden; Design: nur Mensch hebt sie auf, Bruecke sichert alle 5 min als `race`. Skill /bb erklaert sie vollstaendig. | **Gering**, solange Eric nur einen Tab hat. |
| Autosave | Alarm "Autosave steht" am 12.11. (lastSave 465 min alt) und 30.10. (71 min); Ursache nicht geklaert ("Recovery-Modus oder IndexedDB"). Ein spaeterer Zeitpunkt: 22.09. als "UEBERHOLT" markiert. Brueckensicherung stuendlich (`INDEX.tsv`: 07:23, 06:23, ...) laeuft unabhaengig. | **Moeglich**: Alarm unterscheidet nicht "Tab verdeckt/zu" von "Schreibfehler". Hebel: Alarm klassifizieren (B08). |
| Alarm-Archiv `## Sofort` | 811 Zeilen, Auto-Eintraege ohne Ablauf (7x "Schub verweigert", "Telemetrie veraltet" 08.11.), dazu "UEBERHOLT"-Bloecke. Widerspricht "nichts parken". | **Ja**, jeder /bb liest es oder uebergeht es. |
| Schub verweigert (neue Datei nicht committed) | Riegel schuetzt vor halbem Stand, blockiert aber auch Absicht; fuer neue libs gilt "sofort mit committen". Nur in Memory/`## Sofort`. | **Ja** bei jedem neuen Gewerk (Casino 13.11. war der letzte Fall). |
| Worktrees/Branches | `bitburner/.claude/worktrees` 156 MB, 12 Worktrees (davon 1 "prunable" im Scratchpad), 7 Branches nicht in master (Pruefstaende cloud-skeptiker-a/b, e1-hashes ...). Memory `reference-junction`: Agenten brauchen Kopie. | Gering, aber Verwechslungsgefahr beim Grep (meine Referenzsuche musste `worktrees` ausschliessen). |
| Backups | 302 MB `backups/`, Rotation in `test-backup`. Ketten-Regeln lehnen neuen Spielstand ab (siehe 0.2). | **Ja, zwingend zu klaeren** vor Lauf 2. |
| Verdeckter Tab | geloest: `wakelock.js` (Tonanker), `checkin.js` meldet "OHNE Tonanker". | Nein. |
| ntfy/Push | abgeschaltet, kein Weg Meldung -> Eric; ergibt Stillstand bis zum naechsten Besuch (V26/V27/V30/V41). | Strukturell ja; kann nur durch Autonomie (Waechter heilt) kleiner werden. |

## 6. Bauliste B01 ff. (nach Nutzen fuer Lauf 2 sortiert)

Aufwand: S = unter 1 h, M = 1-4 h, L = mehr. Regel aus Memory: Bauauftraege sofort bauen, Skeptiker, Test, `[skeptiker]` im Commit.

| Nr | Was | Warum / Beleg | Aufwand |
|---|---|---|---|
| B01 | **Suite: Verwaisungs-Gate.** `test-alles.js` listet alle `test-*.js` im Ordner und scheitert, wenn eine nicht eingetragen oder auf einer `NICHT_IN_SUITE`-Liste mit Grund steht. Die 12 verwaisten Tests eintragen und einmal fahren (rot -> Befund). | Muster 5/8; 12 Tests seit 08.10. ungefahren | S |
| B02 | **Neuer-Lauf-Verfahren der Sicherungskette.** `LIVE_IDENTIFIER`/`minPlaytime`/`bitNode` fuer einen frischen Spielstand: Epochen-Marke in `INDEX.tsv`/`instanz.js` (neue Identitaet nur per ausdruecklichem `--neuer-lauf`, alte Kette archiviert, Rueckwaertssprung-Pruefung gegen die Epoche). Test `test-backup` um "frisches Spiel" erweitern. Verbindung mit "Spielstand darf nicht zerstoert werden". | 0.2 | M |
| B03 | **Lauf-2-Kaltstarttest.** `test-kaltstart-budget`/`test-matrix` um Zustand "BN1.1, 8 GB, SF0" erweitern (HOME_GB und SF-Stand als Eingabe); fehlt dort ein startbarer Pfad, ist das der Befund (Teil 6 des Audits). | Muster 2, 0.1 | M |
| B04 | **Start-Skill Lauf 2** (`/bb` Abschnitt "Neuer Lauf" oder eigener Skill): Reihenfolge Spielstand -> Autoexec boot.js -> Bruecke mit neuer Identitaet -> `data/`-Altlasten (ausgang.json, route.json, verlauf, v1kurve-BN*, checkin.json) in Epoche `lauf1/` verschieben -> Route fuer Lauf 2 -> erste Messung. | Skills-Luecke | M |
| B05 | **WMI-Start der Neustartschleife statt der nackten Bruecke** (Skill /bb + Memory-Notiz): `cmd /c sync\bridge-start.cmd`. Faengt Abstuerze, der Rest (Tod per Job-Objekt) bleibt. Kein Autostart, also mit Erics Entscheidung vereinbar. Vorher pruefen, dass die Schleife bei WMI-Start nicht ausgeschlossen wird (RC 2/3 beenden sie, Kopf `bridge-start.cmd`). | Betrieb | S |
| B06 | **`blocked` befristen und melden.** `guard.js:1004` und `leiter.js:168`: `blocked` zaehlt nur N Minuten (z. B. zwei Frischefristen) als "geheilt", danach Signal "Sperre ohne Ablauf" mit Grund; `locked`/`BLOCKGRUENDE` in `checkin.js` ausgeben. Test: Werkzeug `blocked` seit 3 h -> Befund. | Muster 1 | M |
| B07 | **`checkin.js`: "Einbau faellig, aber nichts passiert".** Wenn Geld+Ruf fuer die naechste Einbaurunde reichen (bn4rep.json `bn8`/Plan) und seit > X h kein `queued_augs_at_jump`/Install: Urteil `EINBAU STEHT` mit `install-sperre.txt`, `rep-modus.txt`, Wartegrund. BN8-Zeile (Boerse `gesamt`, 4S, Casino `phase`) mit ausgeben; Memory-Pruefliste entfaellt. | Muster 1/8 | M |
| B08 | **Sofort-Alarme mit Ablauf.** Bruecke schreibt Titel mit Zeitpunkt und loescht/markiert sie, wenn die Ursache weg ist (Schub verweigert nach Commit, Telemetrie wieder frisch, Tab verbunden); Autosave-Alarm klassifiziert (Tab zu/verdeckt vs. Schreibfehler). `## Sofort` heute auf Null bringen (UEBERHOLT-Bloecke in `ERLEDIGT.md`). | Muster 1, 811 Zeilen | M |
| B09 | **`MESSLUECKEN`/`ENTSCHIEDEN` in `test-alles.js` bereinigen** (erledigte raus, Rest mit Datum und Verantwortlichem); Suite-Exit-Code sinnvoll (nur Tests rot = 1, Luecken als Zeile). Seit Eintragsdatum auf Aktualitaet pruefen (ENTSCHIEDEN nennt graftplan noch "nicht eingespielt"). | Muster 5/8 | S |
| B10 | **Skills aufraeumen:** `skills/README.md` korrigieren (aktiver Ort `~/.claude/skills/bb`), `skills/bb.md` durch den aktiven Text ersetzen und das globale Verzeichnis in ein Repo spiegeln; `bitburner`-Skill kuerzen oder loeschen; `bb-loops` und `loops/` archivieren; `bb` korrigieren (Autostart-Satz, BLOCKIERT, plan.js, Schub-verweigert, BN8-Hinweis). | Abschnitt 4 | S-M |
| B11 | **Altbetrieb archivieren:** `wache.js`, `aufsicht.js`, `autostart-einrichten.cmd`, `watch.js`, `tick.js`, `nightshift.js`, `nacht.cmd`, `status.js`, `plan.js`, `bn4.js`, `bn4watch.js`, `meter.js`, `ziele.js`, `fortschritt.js`, `libverteilen.js`, `archivliste.js`, `archivpruefung.js`, `graftnext.js`, `hashrang-*.mjs`, `sleeve-rechnung.js`, `trupp-rechnung.js` nach `archiv/` (Test `test-kernwache`/`strategie-check` auf Kommentarverweise pruefen); Hinweistext in `rueckstand.js:79`, `staedte.js:47` korrigieren; tote Dateien in `data/` (`wache.*`, `aufsicht.log`, `tick-last.json`, `watch-verlauf.json`, `ziele.md`, `notnagel.json`, `skeptiker-stand.txt`, `meter`) entfernen. Vorher `node tools/archivliste.js` fuer die src-Seite (109 von 137 Dateien in src/ sind nicht in `registry.json`; ein Teil ist bewusst) und `test-verbote` gegenpruefen. | Abschnitt 2a | M |
| B12 | **Muster-Lints in `test-verbote` aufnehmen:** (a) Echtzeit (`Date.now`) gegen Spielzeit-Aktion nur mit Kennzeichnung `// uhr:wand` erlaubt (Muster 4), (b) Knotenliterale `node/knoten ===|!== <Zahl>` nur in `reg.js`/`bitnodes.json` oder mit `// knoten:<grund>` (Muster 6). Beide mit Selbstprobe wie die bestehenden. | Muster 4/6 | M |
| B13 | **`datenfluss.mjs --selbstprobe` und `kpi-luecken.js` in die Suite** (nur Befunde als Fehler, wenn neu gegenueber einer Baseline-Datei). | Muster 3 | M |
| B14 | **Memory aufraeumen** (nach Abschnitt 3): `bitburner.md` kuerzen, `werkzeuge`/`nachtlauf` loeschen bzw. in Repo-Doku, `roadmap`/`audit-autonomie`/`audit-perfekt` als ueberholt markieren, `checkin-statt-loops` mit Nachtrag, Index Z.71/75 anpassen, `cron-blockade` nur als Verweis. Technikbefunde (formeln, oberflaeche, eta-lehre, bn6-hebel, stadtwahl, go-mcts, corp) in `doku/` ziehen. Regelaenderung ist ein eigener Auftrag. | Abschnitt 3 | M |
| B15 | **Vorlauf-Check "Gewerk fuer die naechsten Route-Eintraege".** `checkin.js` meldet ab 2 Eintraegen Abstand, wenn ein Gewerk (`braucht`) fehlt oder ein Knoten-Flag (`keine-hacknet` usw.) unpassend ist; `route.json` `braucht` fuer BN8 (`casino.js`, `handel.js`), BN3 (`corp.js`), BN13-15 (`go.js`) pflegen. | Muster 7 | M |
| B16 | **Worktrees/Branches pruefen und aufraeumen:** 12 Worktrees (156 MB), 7 unmerged Branches; entscheiden, was noch Arbeitsstand ist, `git worktree prune`. Nicht ohne Eric: `git branch -D` (History). | Betriebskosten | S |
| B17 | **Doku `hotswap.js` vs `einspielen.js`** eine Zeile je Dateikopf; `tools/audit/lib/` fuer die 14 von Tests genutzten Beweisskripte abtrennen. | 2b | S |

Reihenfolge fuer den Start von Lauf 2: B02, B03, B04 (Voraussetzung), danach B01, B09, B05 (billig), dann B06-B08 (Stillstandskosten),
B10-B11, B14 (Ordnung), B12, B13, B15 (Klassenabsicherung), B16-B17.

## 7. Nicht belegt / Grenzen

- Nichts ausgefuehrt: ob `plan.js`/`status.js` heute noch Daten bekommen, ist aus Code und `bridge.js:2048` geschlossen, nicht gemessen.
- Dass die 12 verwaisten Tests heute gruen sind, ist nicht geprueft.
- `firma.js` und die src-Registrierung (109 von 137 Dateien nicht in `registry.json`) sind nur gezaehlt, nicht einzeln auf Aufrufer geprueft (vieles startet per `exec` aus Kern/Boot).
- Woher `Autosave steht` am 12.11. kam, ist offen; eine Erklaerung (Tab verdeckt/Rechner aus) ist nicht belegt.
- Die Behauptung "Fresh Save lehnt die Kette ab" ist aus `sync/backup.js` und `sync/instanz.js` gelesen, nicht gegen einen frischen Spielstand getestet. Ob ein frischer Spielstand denselben `identifier` behaelt (Einstellung/Reset im Spiel), muss ein Test klaeren - das ist der Kern von B02.
