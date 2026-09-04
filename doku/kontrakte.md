# Kontrakte unter `data/` auf `home` — Inventur (Auftrag A2)

Erhoben am **04.09.2026 01:37–01:47** (Systemzeit per `date`), lesend über die
laufende Brücke (`http://127.0.0.1:8795/api/rpc`), Instanz `LIVE`, verbunden.
Bezugsstand: **BitNode 10, Lauf 2**, `lastNodeReset = 1788271154961`
(= 2026-09-01 15:59:14 Ortszeit), `lastAugReset = 1788441726250`
(= 2026-09-03 15:22:06 Ortszeit), `identifier 197f4d61481686`,
`totalPlaytime 367,1 h` — alle vier per `getSaveFile`, in einem `node`-Einzeiler
ausgewertet, nie ins Terminal.

`getFileNames` liefert **270 Dateien auf `home`, davon 136 unter `data/`**.
Die im Auftragstext genannten 136 sind bestätigt. `data/telemetry.txt` ist
nicht mehr dabei (am 04.09. gelöscht).

Der Inhalt **jeder** Datei unter 4 KB wurde gelesen (`getFile`); die vier
größeren (`aktionen.txt` 203 KB, `contracts.txt` 138 KB, `bbgraft.json` 63 KB,
`bn4net-log.txt` 20 KB) nur nach Form und Zeitstempel ausgewertet.

**Zählung:** 42 LEBENDIG (davon 1 reiner Handkanal und 1 lebendig, aber mit
veraltetem Inhalt) · 63 UNKLAR (Diagnose-Einmalwerkzeuge, deren Ergebnis auf
`home` eingefroren ist) · 31 LEICHE.

---

## 0 Zuerst: drei Befunde, die nicht warten können

### 0.1 `data/simulacrum.txt` ist ein veralteter Marker aus BitNode 6 — der Graft-Riegel ist damit offen

`src/blade.js:2994` prüft während eines Grafts **nur**
`ns.fileExists("data/simulacrum.txt", "home")`. Ist die Datei da, hält der
Bladeburner-Motor **nicht** still.

Gemessen 04.09. 01:41:

| | |
|---|---|
| Inhalt der Datei auf `home` | `1788120181574` = **2026-08-30 22:03 Ortszeit** |
| `lastNodeReset` | `1788271154961` = 2026-09-01 15:59 |
| `The Blade's Simulacrum` in `augmentations` | **`false`** (15 Augs, per `getSaveFile`) |
| in `queuedAugmentations` | `false` |

Die Datei stammt also aus dem **vorherigen BitNode**, das Simulacrum ist längst
weg — und der Riegel, der genau dafür gebaut wurde („lieber ein stillstehender
Motor als $450 Mrd, die nicht erstattet werden", `blade.js:2982-2984`), ist
entwaffnet. `boot.js:105` räumt die Datei knotengebunden weg, aber diese
Räumzeile ist vom **02.09.**, der Knotenwechsel war am **01.09.** — sie hat den
Fall nie gesehen.

Zweite Hälfte des Problems: der einzige Schreiber `src/graft.js:47` und der
einzige Löscher `graft.js:74-75` laufen **nur per `data/task.txt`**, also von
außen über `tools/graftnext.js`. Im autonomen Betrieb wird der Marker nie
korrigiert. Der Riegel hängt damit an einer Datei, die im Normalbetrieb
niemand pflegt.

> **Löschvorschlag / Bauauftrag:** `data/simulacrum.txt` löschen (der Riegel
> steht danach korrekt scharf), und den Marker im Neubau durch eine geprüfte
> Frage ersetzen — Inhalt `{ts, nodeReset, augReset, besitzt:true}`, Leser
> prüft `nodeReset` und `augReset` gegen `ns.getResetInfo()`, statt nur
> `fileExists`.

### 0.2 Acht der elf Steuerkanäle tragen keinen Zeitstempel — genau das, was 4.6 fordert

Siehe Abschnitt 3. Kurzfassung: `task.txt`, `reload.txt`, `verfahren.txt`,
`geldbedarf.txt`, `keine-hacknet.txt`, `keine-sleeves.txt`, `bn4-stop.txt` und
`batch-ziele.txt` haben **keinen** `Date.now()`-Stempel. Drei davon
(`verfahren`, `keine-hacknet`, `keine-sleeves`) tragen wenigstens die
Knotennummer und werden dagegen geprüft. `batch-ziele.txt` ist der einzige
Kanal, den **`boot.js` überhaupt nicht räumt** und der weder Stempel noch
Knoten trägt: eine Messeinstellung `0` aus BitNode 10 würde den gemessen
größten Geldhebel des Bots ($9,12 M/s → $18,06 M/s, `bn4net.js:1279`) über alle
40 Restläufe stumm abschalten.

### 0.3 Zahlen aus dem Auftragstext, die ich nicht bestätigen kann

| Auftragstext | Gemessen 04.09. | Beleg |
|---|---|---|
| 1.1: „`sync/bridge.js` (438 Zeilen)" | **1382 Zeilen** | `wc -l sync/bridge.js` |
| 1.5: „die Brücke pollt `data/telemetry.txt` trotzdem, `bridge.js:234-255`" | **Pollen ist entfallen**; `pollTelemetry()` liest jetzt `data/bn4net.json` | `sync/bridge.js:774-782` (Kommentar: „Das Pollen von data/telemetry.txt ist entfallen") |
| 1.2: „**1** Augmentierung in der Warteschlange" | **2**: `Augmented Targeting II`, `CashRoot Starter Kit` | `getSaveFile` 04.09. 01:41; deckungsgleich mit `data/einbau.json` (`wartend: 2`, `mindest: 3`) |

Der zweite Punkt hat Folgen für Phase 0: „`data/telemetry.txt` auf home —
siehe Phase 0" ist bereits an beiden Enden erledigt (Datei gelöscht, Poller
umgebaut). Der dritte betrifft `queued_augs_at_jump = 0` aus 7.1.6 — die
Warteschlange ist seit dem Auftragstext um eins gewachsen.

Ein vierter Punkt, kein Widerspruch, aber eine Falle im Archiv-Commit aus 1.5:
Die Liste nennt **`join*.js`** als tot. `src/joinrun.js` fällt unter dieses
Muster, ist aber **lebendig** — `bn4life.js:142` startet es nach jedem Einbau
(`ns.exec("joinrun.js", "home", 1, 80)`), belegt im laufenden Protokoll
`data/bn4life-log.txt`: „Nach Einbau: 4 Faktionen fehlen … joinrun.js gestartet
(pid 25)". Dasselbe gilt für `src/netburn.js` (`bn4life.js:146`) und
`src/darkweb.js` (`bn4net.js:2804`) — alle drei werden autonom gestartet und
sind in 1.3/1.4 nicht als lebendig geführt.

---

## 1 Tabelle: alle 136 Dateien

Spalte „letzte Änderung erkennbar?" meint: **aus dem Dateiinhalt selbst**. Das
Spiel liefert für Textdateien über die RFA keine Metadaten; ein Log mit
`HH:MM:SS` ohne Datum ist damit **nicht datierbar** — bei einem Bot, der über
Wochen und mehrere BitNodes läuft, ist das ein eigener Mangel und in der
Spalte so vermerkt.

Urteile: **LEBENDIG** = Schreiber wird im Betrieb ohne Menschen gestartet
(`boot.js`, Werkzeugliste `bn4net.js:257-347`, oder von einem dieser Skripte
per `ns.exec`). **UNKLAR** = Schreiber existiert und ist gesund, wird aber nur
per `data/task.txt` von Hand angestoßen (Diagnose-Einmalwerkzeug); die Datei
auf `home` ist ein eingefrorenes Messergebnis. **LEICHE** = Schreiber ist nach
1.5 tot oder existiert nicht mehr.

| Datei (unter `data/`) | Schreiber | Leser | Inhaltsform | letzte Aenderung erkennbar? | Bytes | Urteil |
|---|---|---|---|---|---|---|
| `aktionen.txt` | blade.js:1391,1423 (Modus a, UNGEDECKELT) | bbspann.js:70-71; tools/ratencheck.js:92 | JSONL, je Abschnitt eine Zeile | 2026-09-03 23:36Z | 203405 | **LEBENDIG** |
| `astufe.json` | astufe.js:12 | - | JSON-Objekt | nein | 183 | **UNKLAR** |
| `audiocheck.txt` | audiocheck.js:15 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 122 | **UNKLAR** |
| `augcheck.json` | augcheck.js:33,41 | - | JSON-Objekt mit zeit | 2026-08-26 12:19Z **vor dem Knoten** | 195 | **UNKLAR** |
| `augcount.json` | augcount.js:97 | - | JSON-Objekt | 2026-08-22 10:40Z **vor dem Knoten** | 5173 | **UNKLAR** |
| `augcount.txt` | augcount.js:98 | - | Klartextbericht | nein | 1453 | **UNKLAR** |
| `augs.txt` | buyaugs.js:1626 (TOT 1.5) | - | Klartextbericht | nein | 14453 | **LEICHE** |
| `augtest.txt` | KEINER | - | Klartext | nein | 111 | **LEICHE** |
| `ausgang.json` | ausgang.js:161,198,203,240,339,359 | ausgang.js:147; hacknet.js:78; tools/checkin.js:119 | JSON-Objekt mit zeit | 2026-09-03 23:37Z | 309 | **LEBENDIG** |
| `ausgang.txt` | ausgang.js:111 | tools/checkin.js:130 | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 143 | **LEBENDIG** |
| `backdoor.txt` | backdoor.js:27 | - | Klartext | nein | 288 | **UNKLAR** |
| `batch-ziele.txt` | KEINER (reiner Handkanal) | bn4net.js:1280 | Zahl oder leer | nein | 0 | **LEBENDIG (Handkanal)** |
| `bbgraft.json` | bbgraft.js:56 | tools/graftnext.js:88 | JSON-Liste | 2026-08-31 01:02Z **vor dem Knoten** | 63284 | **UNKLAR** |
| `bbjoin.txt` | bbtrain.js:324 | - | ms-Zeitstempel | 2026-09-03 17:34Z | 13 | **LEBENDIG** |
| `bblage.json` | bblage.js:24 | tools/checkin.js:112; tools/strategie-check.js:94 | JSON-Objekt mit zeit | 2026-09-02 14:50Z | 306 | **UNKLAR** |
| `bbspann.json` | bbspann.js:13,396 | tools/spann.js:42 | JSON-Objekt mit zeit | 2026-08-30 17:41Z **vor dem Knoten** | 6107 | **UNKLAR** |
| `bbtick.json` | bbtick.js:47 | - | JSON-Objekt mit zeit | 2026-08-25 20:08Z **vor dem Knoten** | 307 | **UNKLAR** |
| `bbtrain.json` | bbtrain.js:82 | bn4net.js:66 (Pulsdatei) | JSON {zeit,host} | 2026-09-03 23:36Z | 36 | **LEBENDIG** |
| `beitritt-erledigt.txt` | bn4life.js:127 (BEITRITT_MARKE) | bn4life.js:127 | ms-Zeitstempel | 2026-09-03 13:22Z | 13 | **LEBENDIG** |
| `blackops.json` | blackops.js:15,33 | - | JSON-Liste mit zeit | 2026-08-27 15:49Z **vor dem Knoten** | 2380 | **UNKLAR** |
| `blade.json` | blade.js:615,1313 | tools/graftnext.js:57; tools/checkin.js:111; bn4net.js:62 (Puls) | JSON-Objekt mit zeit | 2026-09-03 23:37Z | 906 | **LEBENDIG** |
| `bladeoffen.txt` | blade.js:1363 (Konstante OFFEN) | blade.js:1419 | JSON, eine Zeile | 2026-09-03 23:37Z | 159 | **LEBENDIG** |
| `bn4door-log.txt` | bn4door.js:73 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 222 | **LEBENDIG** |
| `bn4door.json` | bn4door.js:144 | tools/bn4.js:85 | JSON-Objekt mit zeit | 2026-09-03 23:36Z | 190 | **LEBENDIG** |
| `bn4job.json` | bn4rep.js:1312 | tools/firma.js:42; tools/wache.js:525 (TOT) | JSON-Objekt mit zeit | 2026-09-01 13:55Z **vor dem Knoten** | 178 | **LEBENDIG** |
| `bn4life-log.txt` | bn4life.js:59 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 578 | **LEBENDIG** |
| `bn4life.json` | bn4life.js:402 | bn4net.js:64 (Puls), :471 (Zustand) | JSON-Objekt mit zeit | 2026-09-03 23:37Z | 411 | **LEBENDIG** |
| `bn4life.txt` | KEINER (alter Logname) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 81 | **LEICHE** |
| `bn4net-log.txt` | bn4net.js:382 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 20415 | **LEBENDIG** |
| `bn4net.json` | bn4net.js:3088 | homegrow.js:103; sync/bridge.js:782; tools/checkin.js:113; tools/strategie-check.js:417 | JSON-Telemetrie mit zeit+runde | 2026-09-03 23:37Z | 1423 | **LEBENDIG** |
| `bn4rep-log.txt` | bn4rep.js:51 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 14803 | **LEBENDIG** |
| `bn4rep.json` | bn4rep.js:1883 | bn4net.js:897-898 | JSON-Telemetrie mit zeit | 2026-09-03 23:37Z | 1455 | **LEBENDIG** |
| `bodauer.json` | bodauer.js:20 | - | JSON-Liste | nein | 195 | **UNKLAR** |
| `boot.txt` | boot.js:49 (gedeckelt 200 Zeilen, :51) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 333 | **LEBENDIG** |
| `brcheck.txt` | brcheck.js:27 | - | Klartext | nein | 107 | **UNKLAR** |
| `bridge.json` | sync/bridge.js:872 per pushFile (AUSSEN) | - | JSON-Objekt mit ts | 2026-09-03 23:36Z | 382 | **LEBENDIG** |
| `buyone.txt` | buyone.js:24 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 63 | **UNKLAR** |
| `calccheck.txt` | calccheck.js:23 | - | Tabelle | nein | 1915 | **UNKLAR** |
| `cantwort.json` | cdump.js (Mensch, per task.txt) | csolve.js:23 | JSON-Liste | nein | 335 | **UNKLAR** |
| `chance.json` | chance.js:42,120 | - | JSON-Objekt mit zeit | 2026-08-27 16:19Z **vor dem Knoten** | 407 | **UNKLAR** |
| `cheap.txt` | cheap.js:77 | - | Klartextbericht | nein | 3474 | **UNKLAR** |
| `cmd-out.txt` | src/hand.js:33 (TOT 1.5) | tools/hand.js:66 (TOT 1.5) | JSON {at,text} | 2026-08-23 13:31Z **vor dem Knoten** | 91 | **LEICHE** |
| `cmd.txt` | tools/hand.js:94 (TOT 1.5) | src/hand.js:32 (TOT 1.5) | Terminalzeile als Klartext | nein | 13 | **LEICHE** |
| `contracts.txt` | contracts.js:1255,1262 (gedeckelt, LOG_MAX 120000 :79) | contracts.js:1252 | Logtext, gedeckelt | nur HH:MM:SS, kein Datum | 137701 | **LEBENDIG** |
| `coreprobe.txt` | KEINER | - | Klartext | nein | 80 | **LEICHE** |
| `csolve.txt` | csolve.js:37 | - | Klartext | nein | 259 | **UNKLAR** |
| `daedalus.txt` | daedalus.js:62 | - | Klartextbericht | nein | 775 | **UNKLAR** |
| `darkweb.txt` | darkweb.js:57 (von bn4net.js:2804 gestartet) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 274 | **LEBENDIG** |
| `donate.txt` | donate.js:60 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 66 | **UNKLAR** |
| `echoargs.txt` | echoargs.js:5 | - | Klartext | nein | 36 | **UNKLAR** |
| `einbau.json` | bn4rep.js:1013 (schreibNachHome) | - | JSON-Objekt mit zeit | 2026-09-03 23:37Z | 185 | **LEBENDIG** |
| `exit-ziel.txt` | KEINER (boot.js:88 bestaetigt das) | - | Knotennummer | nein | 2 | **LEICHE** |
| `exit.txt` | exit.js:40 | ausgang.js:273,284 | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 129 | **LEBENDIG** |
| `export.txt` | exportbonus.js:34 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 240 | **UNKLAR** |
| `favorweg.txt` | favorweg.js:74 | - | Tabelle | nein | 1001 | **UNKLAR** |
| `formcheck.txt` | formcheck.js:30 | - | Tabelle | nein | 1505 | **UNKLAR** |
| `geld.json` | geld.js:51 | - | JSON-Objekt mit zeit | 2026-08-26 12:18Z **vor dem Knoten** | 182 | **UNKLAR** |
| `geldbedarf.txt` | bn4rep.js:1205 | bn4life.js:249-250; bn4net.js:676-677; homegrow.js:72-73 | Zahl (Dollar) | nein | 1 | **LEBENDIG** |
| `graft.json` | graft.js:190 | tools/graftnext.js:56 | JSON-Objekt mit zeit | 2026-08-31 01:03Z **vor dem Knoten** | 207 | **UNKLAR** |
| `hacknet.txt` | hacknet.js:36 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 97 | **LEBENDIG** |
| `hacktimer.json` | hacktimer.js:67 | - | JSON-Objekt mit zeit | 2026-08-25 18:16Z **vor dem Knoten** | 152 | **UNKLAR** |
| `hand-puls.txt` | src/hand.js:76 (TOT 1.5) | autopilot.js:813-814 (TOT 1.5) | ms-Zeitstempel | 2026-08-23 14:06Z **vor dem Knoten** | 13 | **LEICHE** |
| `hashes.json` | hashes.js:68 | - | JSON-Objekt mit zeit | 2026-09-02 16:45Z | 86 | **LEBENDIG** |
| `hashes.txt` | KEINER (alter Logname) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 113 | **LEICHE** |
| `hb-rep.txt` | bn4rep.js:450 (schreibNachHome) | tools/wache.js:526 (TOT 1.5) | ms-Zeitstempel | 2026-09-03 23:37Z | 13 | **LEBENDIG** |
| `homegrow.txt` | homegrow.js:61 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 2172 | **LEBENDIG** |
| `homeram.txt` | homeram.js:1096,1128 (TOT 1.5) | - | Klartextbericht | nein | 719 | **LEICHE** |
| `install-frei.txt` | KEINER (Logik am 22.08. umgedreht, bn4rep.js:692) | - | Klartext | nein | 15 | **LEICHE** |
| `install.txt` | install.js:47 (TOT 1.5) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 208 | **LEICHE** |
| `invest.txt` | invest.js:41 (TOT: nur per task.txt) | tools/status.js:99 | JSON-Liste | 2026-08-20 07:17Z **vor dem Knoten** | 77 | **UNKLAR** |
| `joinfac.txt` | joinfac.js:32 (TOT 1.5) | - | Klartext | nein | 116 | **LEICHE** |
| `joinplan.txt` | joinplan.js:44 (TOT 1.5) | - | Klartextbericht | nein | 748 | **LEICHE** |
| `joinrun.txt` | joinrun.js:33 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 1046 | **LEBENDIG** |
| `kampfaugs.txt` | kampfaugs.js:106 | - | Klartextbericht | nein | 714 | **UNKLAR** |
| `kanaltest.txt` | kanaltest.js:11 | - | Klartext | nein | 5 | **UNKLAR** |
| `kaufplan.txt` | kaufplan.js:88 | - | Klartextbericht | nein | 1197 | **UNKLAR** |
| `keepalive.txt` | keepalive.js:84 (TOT 1.5) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 415 | **LEICHE** |
| `keine-hacknet.txt` | hashes.js:46 | bn4net.js:2842 (markerGilt :2836) | Knotennummer | nein | 2 | **LEBENDIG** |
| `kerne.txt` | kerne.js:46 | - | Tabelle | nein | 737 | **UNKLAR** |
| `kill.txt` | kill.js:27 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 52 | **UNKLAR** |
| `killrep.txt` | killrep.js:22 | - | Klartext | 2026-08-25 03:35Z **vor dem Knoten** | 37 | **UNKLAR** |
| `killui.txt` | killui.js:53 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 52 | **UNKLAR** |
| `knoten.json` | knoten.js:34 | bn4rep.js:472; tools/strategie-check.js:471 | JSON-Objekt mit zeit | 2026-09-03 23:37Z | 85 | **UNKLAR** |
| `lage.json` | lage.js:29 | - | JSON-Objekt mit zeit | 2026-08-24 19:57Z **vor dem Knoten** | 1103 | **UNKLAR** |
| `netburn.txt` | netburn.js:92 (von bn4life.js:146 gestartet) | - | Klartextbericht | nein | 469 | **LEBENDIG** |
| `network.txt` | scan.js:40 | - | JSON {at,servers} | 2026-08-19 16:50Z **vor dem Knoten** | 19618 | **UNKLAR** |
| `netz.json` | netz.js:19 | - | JSON {zeit,liste} | 2026-08-24 19:37Z **vor dem Knoten** | 6549 | **UNKLAR** |
| `parkprobe.txt` | KEINER | - | JSON-Objekt | nein | 393 | **LEICHE** |
| `popups-beitritt.txt` | popups.js:161 (Modus a, UNGEDECKELT) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 4040 | **LEBENDIG** |
| `popups-wache.txt` | popups.js:118,122 (Modus a, UNGEDECKELT) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 374 | **LEBENDIG** |
| `popups.txt` | popups.js:226 | tools/strategie-check.js:832 | ms\|geschlossen\|beigetreten\|sequenzen | 2026-09-03 23:37Z | 20 | **LEBENDIG** |
| `preis.json` | preis.js:10 | - | JSON-Objekt | nein | 102 | **UNKLAR** |
| `probe2.txt` | probe2.js:16 | - | Klartext | nein | 963 | **UNKLAR** |
| `probe3.txt` | probe3.js:17 | - | Klartext | nein | 262 | **UNKLAR** |
| `ps.json` | ps.js:21 | tools/strategie-check.js:450 | JSON {zeit,gesehen} | 2026-09-01 14:02Z | 194 | **UNKLAR** |
| `psdiag.txt` | KEINER | - | Klartext | nein | 360 | **LEICHE** |
| `ramcheck.json` | ramcheck.js:7 | - | JSON-Objekt mit zeit | 2026-08-29 03:45Z **vor dem Knoten** | 54 | **UNKLAR** |
| `ramcheck.txt` | KEINER | - | Klartext | nein | 181 | **LEICHE** |
| `rammess.txt` | KEINER | - | Klartext | nein | 104 | **LEICHE** |
| `ramprobe.txt` | KEINER | - | JSON-Objekt | nein | 142 | **LEICHE** |
| `ramtest.txt` | KEINER | - | Klartext | nein | 164 | **LEICHE** |
| `reboot.txt` | reboot.js:33 | - | Klartext | nein | 45 | **UNKLAR** |
| `rep-modus.txt` | bn4rep.js:1793,1805; joinrun.js:42 | bn4life.js:356-357; bn4net.js:1402-1403; bn4rep.js:616 | Faktion\|ms | 2026-09-03 23:37Z | 21 | **LEBENDIG** |
| `rep-ziel.txt` | bn4rep.js:1749 (schreibNachHome) | - | ms\|aug\|faktion + 2 JSON-Zeilen | 2026-09-03 23:37Z | 801 | **LEBENDIG** |
| `reserve.txt` | tools/reserve.js:18 (AUSSEN) | autopilot.js:394-395 (TOT); stocks.js:128-129 (TOT) | Zahl (Dollar) | nein | 1 | **UNKLAR** |
| `restart.txt` | restart.js:23 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 82 | **UNKLAR** |
| `rpdiag.txt` | KEINER | - | Klartextbericht | nein | 701 | **LEICHE** |
| `sfprobe.txt` | KEINER | - | JSON-Objekt mit now | 2026-09-02 15:23Z | 379 | **LEICHE** |
| `simulacrum.txt` | graft.js:47 (nur per task.txt, also von aussen) | blade.js:2994 (NUR fileExists) | ms-Zeitstempel | 2026-08-30 20:03Z **vor dem Knoten** | 13 | **LEBENDIG, aber VERALTET** |
| `skillcheck.json` | skillcheck.js:79 | - | JSON-Objekt mit zeit | 2026-08-27 18:17Z **vor dem Knoten** | 777 | **UNKLAR** |
| `skilltest.txt` | KEINER | - | JSON-Objekt | nein | 101 | **LEICHE** |
| `sleeve.json` | sleeve.js:384 | bn4net.js:63 (Puls); tools/checkin.js:123 | JSON-Objekt mit zeit | 2026-09-03 23:37Z | 212 | **LEBENDIG** |
| `sleevediag.json` | sleevediag.js:13 | - | JSON-Objekt mit zeit | 2026-08-30 07:56Z **vor dem Knoten** | 435 | **UNKLAR** |
| `sleeveinfo.txt` | KEINER | - | Klartextbericht | nein | 557 | **LEICHE** |
| `sonde.json` | sonde.js:45,58,143 | tools/wache.js:866 (TOT 1.5) | JSON-Objekt mit zeit | 2026-09-03 04:11Z | 344 | **UNKLAR** |
| `spieler.txt` | KEINER | - | Klartextbericht | nein | 271 | **LEICHE** |
| `sr.json` | sr.js:29 | - | JSON-Liste | nein | 350 | **UNKLAR** |
| `srtest.json` | srtest.js:12 | - | JSON-Liste | nein | 102 | **UNKLAR** |
| `stat.json` | stat.js:19 | - | JSON-Objekt mit zeit | 2026-08-24 18:43Z **vor dem Knoten** | 622 | **UNKLAR** |
| `stock.txt` | stockaccess.js:42 (TOT 1.5) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 251 | **LEICHE** |
| `stocks.txt` | stocks.js:54 (TOT 1.5) | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 224 | **LEICHE** |
| `stopnight.txt` | stopnight.js:33 | - | Klartext | nein | 47 | **UNKLAR** |
| `stopwork.txt` | stopwork.js:27 | - | Logtext HH:MM:SS | nur HH:MM:SS, kein Datum | 65 | **UNKLAR** |
| `stufentest.json` | stufentest.js:30 | - | JSON-Objekt | nein | 225 | **UNKLAR** |
| `task.txt` | bn4net.js:481,550; bn4life.js:275,312; tools/task.js:31; tools/strategie-check.js:98 | bn4net.js:479-480; bn4life.js:273-274 | JSON-Array [skript.js, arg...] | nein | 0 | **LEBENDIG** |
| `travel.txt` | travel.js:1542 (TOT 1.5) | - | Klartextbericht | nein | 1205 | **LEICHE** |
| `trupp.json` | trupp.js:36 | - | JSON-Objekt | nein | 176 | **UNKLAR** |
| `unkick.txt` | tools/einmal/unkick.js:8 (Einmalwerkzeug) | - | Klartext | nein | 44 | **UNKLAR** |
| `verfahren.txt` | ausgang.js:190 (nachHome) | bn4net.js:2827; bn4rep.js:88-90; sleeve.js:102-104; hashes.js:33-34; tools/checkin.js:131; tools/strategie-check.js:490 | V2 10 2 = Verfahren Knoten Stufe | nein | 7 | **LEBENDIG** |
| `vorrat.json` | vorrat.js:22 | - | JSON-Objekt | nein | 131 | **UNKLAR** |
| `wachestat.json` | KEINER (tools/wache.js, TOT 1.5) | - | JSON-Objekt mit zeit | 2026-08-24 15:58Z **vor dem Knoten** | 1047 | **LEICHE** |
| `wakelock.txt` | wakelock.js:67,141 | tools/wache.js:860 (TOT 1.5) | ms\|zustand\|rate | 2026-09-03 23:37Z | 27 | **LEBENDIG** |
| `wbgrow.txt` | wbgrow.js:30 | - | Klartext | nein | 80 | **UNKLAR** |
| `werkbank.json` | werkbank.js:53 | - | JSON-Objekt mit zeit | 2026-08-26 06:44Z **vor dem Knoten** | 1635 | **UNKLAR** |
| `work.txt` | work.js:45 | - | Klartext | nein | 179 | **UNKLAR** |
| `workfaction.txt` | tools/nightshift.js:507,545 (TOT 1.5) | autopilot.js:583-584 (TOT 1.5) | Faktionsname | nein | 8 | **LEICHE** |

---

## 2 LEICHEN — 31 Dateien mit totem oder verschwundenem Schreiber

Löschen ist harmlos: Kein lebendiges Skript liest eine dieser Dateien. Die
Löschung selbst gehört in den Phase-0-Commit über `deleteFile` (RFA), nicht in
diese Inventur — hier steht nur der Vorschlag mit Begründung.

### 2a Schreiber existiert nicht mehr (18)

| Datei | Warum Leiche | Löschvorschlag |
|---|---|---|
| `augtest.txt` | kein Schreiber im ganzen Baum; Inhalt `shock=0 skills={…}` | löschen — Einmalprobe eines Sleeve-Tests |
| `bn4life.txt` | alter Logname; `bn4life.js:59` schreibt seit dem Umbau nach `bn4life-log.txt` | löschen — sonst liest ein Mensch bei „bn4life" das falsche Protokoll (Inhalt: 17:10:34, ohne Datum) |
| `hashes.txt` | alter Logname; `hashes.js:68` schreibt nur noch `hashes.json` | löschen — gleiche Verwechslungsgefahr |
| `coreprobe.txt` | kein Schreiber; Kerne-Kaufprobe | löschen |
| `exit-ziel.txt` | `boot.js:88` sagt es wörtlich: „hat keinen Schreiber mehr, das Ziel rechnet ausgang.js aus route.json"; Inhalt `10` | löschen — und aus `boot.js:104` streichen, sobald sie weg ist |
| `install-frei.txt` | Freigabedatei aus dem am **22.08.** umgedrehten Türschloss (`bn4rep.js:692-700`); Inhalt `frei seit 18:38` | löschen — sie ist das Denkmal des Fehlers, der den Einbau dauerhaft gesperrt hatte, und lädt zum Wiederbeleben ein |
| `parkprobe.txt` | kein Schreiber; Serverpark-Preisprobe | löschen |
| `psdiag.txt` | kein Schreiber | löschen |
| `ramcheck.txt` | kein Schreiber; `ramcheck.js:7` schreibt `ramcheck.json` | löschen |
| `rammess.txt` | kein Schreiber; **Zahlen sind falsch** (`bn4rep.js = 55,75 GB`, real 850,75 laut `ramprobe.txt`) | löschen — eine veraltete RAM-Tabelle ist genau die Quelle, vor der 1.6 warnt |
| `ramprobe.txt` | kein Schreiber; Werte `bn4rep.js:850.75, blade.js:174.35` | löschen, aber **die Zahlen vorher nach `doku/` sichern**: die „174" aus 1.6 („steht nirgends") steht hier |
| `ramtest.txt` | kein Schreiber; dritte, wieder abweichende RAM-Tabelle (`blade.js 162.25`) | löschen |
| `rpdiag.txt` | kein Schreiber; Daedalus/Red-Pill-Diagnose aus BN1 | löschen |
| `sfprobe.txt` | kein Schreiber; SourceFile-Probe vom 02.09. | löschen |
| `skilltest.txt` | kein Schreiber | löschen |
| `sleeveinfo.txt` | kein Schreiber | löschen |
| `spieler.txt` | kein Schreiber; Steckbrief aus BN1 (Hacking 1150, 30 Augs) | löschen |
| `wachestat.json` | Schreiber war `tools/wache.js` (tot nach 1.5); Stand **24.08.**, BN1-Werte (`augsInstalled 42`, Daedalus) | löschen — wer das für aktuell hält, verrechnet sich um Größenordnungen |

### 2b Schreiber ist nach 1.5 tot (13, plus `reserve.txt` mit totem Empfänger)

| Datei | Toter Schreiber | Löschvorschlag |
|---|---|---|
| `augs.txt` (14,5 KB) | `buyaugs.js:1626` | löschen |
| `cmd.txt` / `cmd-out.txt` | `tools/hand.js:94` / `src/hand.js:33` | beide löschen — `cmd-out.txt` steht seit **23.08. 15:31** auf „FEHLER: Terminal nicht erreichbar" |
| `hand-puls.txt` | `src/hand.js:76`, Leser `autopilot.js:813` | löschen |
| `homeram.txt` | `homeram.js:1096` | löschen — beschreibt `bot-19` mit 4.194.304 GB, ein Rechner, den es nicht mehr gibt |
| `install.txt` | `install.js:47` | löschen |
| `joinfac.txt`, `joinplan.txt` | `joinfac.js:32`, `joinplan.js:44` | beide löschen (**nicht** `joinrun.txt` — siehe 0.3) |
| `keepalive.txt` | `keepalive.js:84` | löschen |
| `stock.txt`, `stocks.txt` | `stockaccess.js:42`, `stocks.js:54` | beide löschen — Börsenrest aus BN1; BN8 wird neu gebaut (`boerse.js`) |
| `travel.txt` (1,2 KB) | `travel.js:1542` | löschen |
| `workfaction.txt` | `tools/nightshift.js:507`, Leser `autopilot.js:583` | löschen — Inhalt `Daedalus`, eine Faktion, in der die Figur in BN10 nicht ist |
| `reserve.txt` | Schreiber `tools/reserve.js` (außen) lebt, **beide Leser sind tot** (`autopilot.js:394`, `stocks.js:128`) | löschen — der Kanal hat keinen Empfänger mehr; die Rücklage läuft heute über `data/geldbedarf.txt` |

### 2c Nicht Leiche, aber tote Leitung — hier ist kein Löschvorschlag, sondern ein Bauauftrag

| Datei | Lage |
|---|---|
| `hb-rep.txt` | `bn4rep.js:450` schreibt sie **jede Runde ohne jede Bedingung** und nennt sie „das einzige verlaessliche 'ich lebe' dieses Skripts". Einziger Leser: `tools/wache.js:526` — **tot nach 1.5**. Der Puls des teuersten Werkzeugs (850,75 GB) geht ins Leere, und `bn4rep.js` steht nicht in der Stillstandsliste `bn4net.js:61-67`. |
| `bn4job.json`, `wakelock.txt`, `sonde.json` | leben, aber ihre einzigen Leser sind `tools/firma.js` und `tools/wache.js` (tot). |
| `hilfe.txt` | **liegt gar nicht mehr auf `home`.** Schreiber gibt es keinen mehr (`bn4rep.js:368`: „Seit dem 02.09.2026 hat er keinen Aufrufer mehr"), `bn4rep.js:383` löscht sie nur noch. Drei Werkzeuge lesen sie weiter: `tools/checkin.js:114`, `tools/strategie-check.js:433`, `tools/wache.js:735`. Ein Hilferuf-Kanal ohne Rufer — der Weg nach `## Sofort` läuft ab jetzt über `data/sofort.json`. |
| `aktionen.txt` (203 KB), `popups-wache.txt`, `popups-beitritt.txt` | Anhängemodus `"a"` **ohne Deckel** (`blade.js:1391`, `popups.js:118,122,161`). Zum Vergleich: `contracts.js:79` deckelt bei `LOG_MAX = 120000`, `boot.js:51` bei 200 Zeilen. `aktionen.txt` wird zusätzlich bei **jedem** Abschnittsende komplett per `ns.scp` nach `home` kopiert (`blade.js:1393`), wenn `blade.js` nicht auf `home` läuft — bei ~19 s je Abschnitt (`data/blade.json: dauer 19000`) sind das rund 190 Kopien einer 200-KB-Datei je Stunde, mit weiter wachsender Datei. |

### 2d Bereits erledigt

`data/telemetry.txt` wurde am 04.09. gelöscht (Inhalt vom 21.08.). Gegenprobe:
`getFileNames` listet sie nicht mehr, und `sync/bridge.js:774-778` hat das
Pollen entfernt. Damit ist der Punkt aus 1.5 an beiden Enden geschlossen.

**Zusätzlich löschbar, wenn Phase 0 aufräumt:** die 20 Diagnose-Ergebnisse
mit Stand **vor** `lastNodeReset` — `augcheck.json` (26.08.), `augcount.json`
(22.08.), `bbgraft.json` (63 KB, 31.08.), `bbspann.json` (6,1 KB, 30.08.),
`bbtick.json`, `blackops.json`, `chance.json`, `geld.json`, `graft.json`,
`hacktimer.json`, `invest.txt`, `killrep.txt`, `lage.json`, `network.txt`
(19,6 KB, **19.08.**), `netz.json` (6,5 KB), `ramcheck.json`,
`skillcheck.json`, `sleevediag.json`, `stat.json`, `werkbank.json`. Ihre
Schreiber leben, aber jede Zeile darin beschreibt einen anderen BitNode. Sie
sind nicht gefährlich, solange kein Werkzeug sie liest — `graft.json` und
`bbgraft.json` liest `tools/graftnext.js:56,88` sehr wohl, und beide sind vom
**31.08.**, also aus BitNode 6.

---

## 3 STEUERKANÄLE, DIE BLEIBEN

Alles Folgende mit echtem Inhalt vom 04.09.2026 01:37 (per `getFile`).
Spalte „Stempel": trägt der Kanal `Date.now()` und/oder `nodeReset`, wie 4.6
es verlangt?

### 3.1 Die drei Auftragskanäle

| Kanal | Inhaltsform + echtes Beispiel | Wer leert | Stempel |
|---|---|---|---|
| `task.txt` | JSON-Array, ein Platz: `["bbspann.js"]`, `["graft.js","Neuroreceptor Management Implant"]`. **Jetzt: leer (0 B).** | Leser selbst, vor dem Parsen: `bn4net.js:481`, `bn4life.js:275`. Wiedereinstellen bei Fehlversuch: `bn4net.js:550` (bis 30×), `bn4life.js:312` (5 min). `boot.js:104` löscht **nur bei Knotenwechsel**. | **KEINER.** Weder `ts` noch `nodeReset` |
| `reload.txt` | `SELBST`, `SELBST bn4net.js`, `SELBST bn4life.js`, `WERKZEUG blade.js` (Endung wird ergänzt, `bn4net.js:605`; `WERKZEUG bn4net.js` wird abgelehnt, `:618-621`). **Jetzt: nicht vorhanden.** | Leser selbst: `bn4net.js:439,619,623`, `bn4life.js:172`. `boot.js:79` löscht bei **jedem** Aufruf | **KEINER** |
| `sofort.json` (neu) | siehe 4.11 | Brücke nach Zustellung | Pflicht: `ts` + `nodeReset` |

`task.txt` und `reload.txt` sind die einzigen Wege, von außen etwas im Spiel
auszulösen (die RFA kann Dateien schieben, aber nichts ausführen — 1.1). Dass
ausgerechnet sie keinen Stempel tragen, ist **der Befund aus Punkt 3 des
Auftrags**, und er ist nicht theoretisch: `boot.js:68-76` protokolliert den
Vorfall vom **25.08. 05:59**, bei dem `bn4net` in seiner ersten Runde nach dem
Neuanlauf einen **zehn Minuten alten** `WERKZEUG bn4net.js`-Befehl las und sich
selbst beendete — „aus dem Protokoll sah der Start erfolgreich aus". Die
Abhilfe war eine Räumliste in `boot.js`, nicht ein Stempel. Das schützt gegen
Knotenwechsel und Einbau, **nicht** gegen den Fall, dass die Brücke einen
Befehl schiebt, während der Leser gerade zehn Minuten lang nichts tut
(gedrosselter Tab: 1 Timer-Wake/min).

> **Vorschlag:** beide auf `{ts, nodeReset, befehl}` umstellen, Leser verwirft
> alles mit `Date.now() - ts > 120000` **oder** `nodeReset !== getResetInfo().lastNodeReset`.
> 120 s ist kein neuer Wert, sondern derselbe, mit dem `rep-modus.txt` schon
> arbeitet (`bn4net.js:1404`, `bn4life.js:359`).

### 3.2 Die acht Marker

| Marker | Echtes Beispiel | Wer leert | Stempel | Bewertung |
|---|---|---|---|---|
| `geldbedarf.txt` | `0` | niemand; `bn4rep.js:1205` überschreibt je Runde. `boot.js:79` löscht bei jedem Aufruf | **KEINER** | **Lücke:** stirbt `bn4rep.js` mit einem großen Wert, bleibt das Geld gesperrt, bis der nächste Einbau `boot.js` ruft. Genau dagegen hat `install-sperre.txt` einen Verfall (`bn4rep.js:316-320`) — `geldbedarf.txt` hat keinen |
| `rep-modus.txt` | `NiteSec\|1788478632191`; auch `JOINRUN\|<ms>` (`joinrun.js:42`) und `<Firma>\|<ms>` (`bn4rep.js:1285`) | `bn4rep.js:617,1871`, `joinrun.js:142`, `boot.js:78` | **ts ja**, nodeReset nein | vorbildlich: **beide** Leser prüfen `Date.now() - ts < 120000` (`bn4net.js:1404`, `bn4life.js:359`) |
| `keine-hacknet.txt` | `10` | `boot.js:106`, nur bei Knotenwechsel | ts nein, **Knoten ja** | Leser `bn4net.js:2842` prüft über `markerGilt` (`:2836-2841`) `Number(inhalt) === currentNode` — trägt |
| `keine-sleeves.txt` | jetzt nicht vorhanden (Sleeves existieren, `sleeve.js` läuft) | `boot.js:106` | ts nein, **Knoten ja** | wie oben |
| `simulacrum.txt` | `1788120181574` = **30.08.**, also aus BitNode 6 | `boot.js:105`, nur bei Knotenwechsel | ts steht drin, **wird aber nicht gelesen** | **kaputt, siehe 0.1.** `blade.js:2994` fragt nur `fileExists` |
| `install-sperre.txt` | jetzt nicht vorhanden. Zwei Formen: freier Text (gilt unbefristet, Handbetrieb) oder `FIRMENPHASE <Firma>\|<ms>` (verfällt nach `INSTALL_LOCK_MAX_AGE = 300000`, `bn4rep.js:327`) | `boot.js:77` | **halb**: nur die FIRMENPHASE-Form | die durchdachteste Form im Bestand — Mensch ohne Verfall, Maschine mit |
| `bn4-stop.txt` | jetzt nicht vorhanden. **Reine Existenzprüfung**, Inhalt wird nirgends gelesen (`bn4life.js:95,131`, `bn4net.js:415`) | `boot.js:57-59` | **KEINER** | eine Notbremse ohne Verfall ist gewollt; sie sollte aber `nodeReset` tragen, damit „Stopp in BN10" nicht in BN4 weiterwirkt, falls `boot.js` einmal nicht läuft |
| `batch-ziele.txt` | **leer (0 B)** → `bn4net.js:1281` nimmt die Vorgabe 3. `"0"` schaltet das Batching ganz ab | **niemand.** In keiner Räumliste von `boot.js` | **KEINER**, auch kein Knoten | **schlimmste Lücke der acht.** Ein Messwert `0` überlebt Einbau *und* Knotenwechsel und schaltet den gemessen größten Geldhebel ab ($9,12 → $18,06 M/s, `bn4net.js:1279`) — lautlos, denn `Number(x) \|\| 0` macht auch aus jedem Tippfehler eine 0 |

Zwei weitere Marker gehören sachlich in diese Liste, obwohl 4.6 sie nicht
nennt:

| Marker | Echtes Beispiel | Stempel | Bewertung |
|---|---|---|---|
| `beitritt-erledigt.txt` | `1788441726250` — exakt `lastAugReset` | **augReset ja** | **Das Vorbild.** `bn4life.js:129-130`: `Number(read) >= getResetInfo().lastAugReset`. Die Marke wird beim nächsten Einbau **von selbst** ungültig, ganz ohne Räumliste. Genau diese Bauform gehört auf alle Kanäle aus 3.1 und 3.2 |
| `verfahren.txt` | `V2 10 2` = `<Verfahren> <Knoten> <Stufe>` (`ausgang.js:188`) | ts nein, **Knoten ja** | wird **absichtlich nie geräumt** (`boot.js:94-99`, mit dem Skeptiker-Befund vom 02.09. als Begründung). Alle vier Leser im Spiel prüfen den Knoten: `bn4net.js:2828`, `bn4rep.js:90`, `sleeve.js:104`, `hashes.js:34`. **Restlücke:** die Route enthält Sprünge, bei denen die Knotennummer gleich bleibt (BN10 L2 → BN10 L3, Route-Position 2). Dann trägt nur noch das dritte Feld, und keiner der vier Leser prüft es |

### 3.3 Die Telemetrien

| Datei | Schreiber (Takt) | `zeit` | `nodeReset` | Wer liest sie im Spiel |
|---|---|---|---|---|
| `bn4net.json` | `bn4net.js:3088` (Runde, ~10 s) | ✔ | ✔ (+`knoten`) | `homegrow.js:103`; Brücke `:782`; `checkin.js`, `strategie-check.js` |
| `bn4rep.json` | `bn4rep.js:1883` (15 s) | ✔ | ✔ (+`augReset`) | `bn4net.js:897-898` |
| `bn4life.json` | `bn4life.js:402` (1 s) | ✔ | ✘ | `bn4net.js:64` (Puls), `:471` (Zustand) |
| `blade.json` | `blade.js:615,1313` | ✔ (+`spielzeit`) | ✘ | `bn4net.js:62` (Puls), `graftnext.js:57` |
| `sleeve.json` | `sleeve.js:384` | ✔ | ✘ | `bn4net.js:63` (Puls) |
| `ausgang.json` | `ausgang.js:161,198,203,240,339,359` | ✔ (+`knoten`,`lauf`) | ✘ | `ausgang.js:147`, `hacknet.js:78` |
| `bbtrain.json` | `bbtrain.js:82` | ✔ (+`host`) | ✘ | `bn4net.js:66` (Puls) |
| `einbau.json` | `bn4rep.js:1013` | ✔ | ✘ | — |
| `bn4door.json` | `bn4door.js:144` | ✔ | ✘ | — |
| `hashes.json` | `hashes.js:68` | ✔ (+`knoten`) | ✘ | — |
| `bridge.json` | `sync/bridge.js:872`, **von außen** per `pushFile` | ✔ (`ts`) | ✘ | — (noch niemand) |
| `hb-rep.txt` | `bn4rep.js:450`, jede Runde bedingungslos | ✔ (nur ms) | ✘ | **niemand mehr** (2c) |
| `popups.txt` | `popups.js:226` | ✔ | ✘ | `strategie-check.js:832` |
| `wakelock.txt` | `wakelock.js:141` | ✔ | ✘ | `tools/wache.js:860` (tot) |
| `rep-ziel.txt` | `bn4rep.js:1749` | ✔ | ✘ | — |
| `bladeoffen.txt` | `blade.js:1363` | ✔ (`von`/`bis`) | ✘ | `blade.js:1419` (Nachtrag nach Absturz) |
| `bbjoin.txt` | `bbtrain.js:324` | ✔ | ✘ | — |
| `aktionen.txt` | `blade.js:1391,1423`, **ungedeckelt** | ✔ je Zeile | ✘ | `bbspann.js:71`, `tools/ratencheck.js:92` |
| `knoten.json` | `knoten.js:34` (Einmalwerkzeug) | ✔ | ✔ (+`augReset`) | `bn4rep.js:472`, `strategie-check.js:471` |

Echtes Beispiel für die beiden vorbildlichen Formen:

```
data/knoten.json   {"zeit":1788478632188,"knoten":10,"nodeReset":1788271154961,"augReset":1788441726250}
data/bridge.json   {"ts":1788478608370,"instance":"LIVE","pid":13680,
                    "lastVerifiedBackup":{"file":"LIVE_197f4d61481686_BN10L2_2026-09-04T01-31_connect.json.gz",
                    "ts":"2026-09-03T23:31:53.920Z","ageMin":5,"anlass":"connect"},
                    "settings":{"autosaveInterval":60,"excludeRunningScriptsFromSave":false,
                    "remoteFileApiPort":12525,"autoexecScript":"boot.js",
                    "gelesenAm":"2026-09-03T23:32:48.566Z"},"alarm":null}
```

`bridge.json` beantwortet damit im Spiel bereits alle vier Vorbedingungen der
Sprosse 4a aus 1.2. Nur liest sie niemand.

### 3.4 Stillstandserkennung: 5 von 14 — und der eine Puls, den keiner liest

`bn4net.js:61-67` prüft das Alter von genau fünf Telemetriedateien
(`blade.json`, `sleeve.json`, `bn4life.json`, `ausgang.json`, `bbtrain.json`,
je 10 min). Nicht überwacht sind `bn4rep.js` (850,75 GB, das teuerste
Werkzeug, mit eigenem Puls `hb-rep.txt`), `bn4door.js`, `contracts.js`,
`homegrow.js`, `popups.js`, `wakelock.js`, `hashes.js`, `hacknet.js`,
`sleevecrime.js`. Die Zahl „5 von 14" aus 1.4 ist damit bestätigt.

**Welche Uhr?** Alle drei Alterprüfungen (`bn4net.js:1404`, `:2726 ff.`,
`boot.js:101`) rechnen mit `Date.now()`, also **Echtzeit**. Die Werkzeuge
schreiben ihren Stempel aber in ihrer eigenen Schleife, die von der
Tab-Drosselung gedehnt wird (1 Timer-Wake/min bei verdecktem Tab). Der
Kommentar `bn4net.js:59-60` nennt das und wählt die Grenzen „grosszuegig, weil
ein gedrosselter Tab die Schreibtakte streckt" — 10 min gegen 30-60 s Takt ist
Faktor 10-20 und übersteht den Deckel von 1 Wake/min. Das trägt. Ein
Motorzeit-Feld (`totalPlaytime`) neben `zeit` würde die Frage ganz auflösen und
gehört nach 5.1 ohnehin in jedes Signal.

---

## 4 NEU ANZULEGEN nach 4.6

`src/boot.js` (171 Zeilen, vollständig gelesen) hat heute **drei** Räumstellen:

| Zeilen | Wann | Was |
|---|---|---|
| `boot.js:57-59` | bei **jedem** Aufruf | `data/bn4-stop.txt` |
| `boot.js:77-81` | bei **jedem** Aufruf (einbaugebunden) | `install-sperre.txt`, `beitritt-erledigt.txt`, `rep-modus.txt`, `company-order.txt`, `geldbedarf.txt`, `reload.txt`, `hilfe.txt` |
| `boot.js:100-109` | nur wenn `Date.now() - getResetInfo().lastNodeReset < 300000` | `task.txt`, `exit-ziel.txt`, `simulacrum.txt`, `exit.txt`, `keine-hacknet.txt`, `keine-sleeves.txt` |

Dazu die vierte, indirekte Räumung: `boot.js:120-128` beendet alle fünf
Minuten **alles auf `home` außer sich selbst**, solange `bn4net.js` nicht
läuft. Das löscht keine Dateien, aber es beendet jeden Schreiber.

Zwei Anmerkungen zu diesen Listen, bevor etwas Neues dazukommt:

- **`data/exit-ziel.txt` gehört aus `:104` heraus** — sie hat nach `boot.js:88`
  keinen Schreiber mehr. Eine Räumzeile für eine Datei, die niemand schreibt,
  verdeckt beim Lesen, dass die anderen fünf sehr wohl gebraucht werden.
- **`data/backup-request.txt` und `data/backup-ok.txt` fehlen in beiden
  Listen**, obwohl 4.6 sie ausdrücklich verlangt („plus beide
  Backup-Dateien"). Die Brücke arbeitet mit ihnen bereits
  (`sync/bridge.js:724-756`).

Vorschlag je neuer Datei. „Räumen" heißt: gehört in eine der `boot.js`-Listen.

### 4.1 `data/kpi.json`

```jsonc
{ "ts": 1788478632188,            // ms, Echtzeit (Date.now)
  "playtime": 1321328400,         // ms, MOTORZEIT (Player.totalPlaytime)
  "nodeReset": 1788271154961, "augReset": 1788441726250,
  "node": 10, "level": 2, "verfahren": "V2", "round": 3708,
  "raten": {                      // je Groesse: gemessen, Bestwert, Quote
    "geldProS":  { "ist": 41868263, "best": 0, "quote": null, "fensterMs": 600000, "art": "rate" },
    "repProS":   { "ist": 0.12,     "best": 0, "quote": null, "fensterMs": 600000, "art": "rate" },
    "rangProS":  { "ist": 0.0318,   "best": 0, "quote": null, "fensterMs": 600000, "art": "rate" },
    "expProS":   { "ist": 2227,     "best": 0, "quote": null, "fensterMs": 600000, "art": "rate" }
  },
  "bestand": { "geld": 12680218492035.6, "rang": 652, "hacking": 341,
               "augsEingebaut": 15, "augsWartend": 2 },
  "ram": { "netzGb": 19693, "freiGb": 10906, "brachAnteil": 0.00066, "homeGb": 131072 },
  "figur": "blade.js" }
```

- **Einheiten überall im Feldnamen** (`ProS` = je Sekunde, `Gb`, `Ms`), weil
  genau diese Verwechslung am 30.08. vier von vier Rechnungen gekippt hat.
- `art: "rate" | "bestand"` ist **Pflichtfeld**, nicht Zierde: die Lehre vom
  30.08. („eine gemessene Rate, die aus einem Vorrat gespeist wird, ist keine
  Rate") lässt sich nur prüfen, wenn der Schreiber sich festlegt.
- `fensterMs` beantwortet „über welchen Zeitraum", `playtime` neben `ts`
  beantwortet „welche Uhr".
- **Räumen: NEIN.** 4.6 nennt `kpi.json` ausdrücklich unter denen, die bleiben.
  Der Vergleich über 40 Läufe ist der Zweck; jeder Datensatz trägt `node` und
  `nodeReset`, damit ein Leser nie Knoten mischt. Bauform: Ringpuffer
  (`{aktuell, verlauf:[…]}`), Deckel 500 Einträge nach dem Muster `boot.js:51`.

### 4.2 `data/events.json`

```jsonc
[ { "ts": 1788478632188, "playtime": 1321328400, "nodeReset": 1788271154961,
    "node": 10, "quelle": "bn4net.js", "art": "stillstand",
    "schwere": "warn", "titel": "blade.js seit 12 min stumm",
    "daten": { "datei": "data/blade.json", "alterMs": 720000, "grenzeMs": 600000 } } ]
```

- `art` aus fester Liste: `start`, `stop`, `sprung`, `einbau`, `strafe`,
  `stillstand`, `fehler`, `kauf`, `blockiert`.
- `schwere`: `info` | `warn` | `fehler`.
- Ringpuffer, Deckel 500. Ohne Deckel entsteht ein zweites `aktionen.txt`.
- **Räumen: NEIN** (4.6). Ein Post-mortem, das am Knotenwechsel abreißt, kann
  genau den Sprung nicht erklären, um den es geht.

### 4.3 `data/penalties.json`

```jsonc
{ "ts": 1788478632188, "playtime": 1321328400, "nodeReset": 1788271154961,
  "sprosse": 0, "sprosseName": "keine", "seit": 1788478632188,
  "signal": null, "signalSeit": null,
  "wirkung": "offen",              // offen | gewirkt | wirkungslos
  "wirkungGeprueftAm": null, "versuche": 0,
  "verlauf": [ { "ts": …, "nodeReset": …, "sprosse": 3,
                 "sprosseName": "werkzeug-neustart", "wirkung": "gewirkt" } ] }
```

- **Räumen: NEIN** (4.6) — aber mit einer Bedingung, sonst schlägt sie ins
  Gegenteil um: **`sprosse` gilt nur, wenn `nodeReset` mit
  `getResetInfo().lastNodeReset` übereinstimmt**; sonst liest der Leser 0.
  Der `verlauf` bleibt ungefiltert. Ohne diese Prüfung startet ein frischer
  Knoten auf Sprosse 4 und bestraft sich für einen Hänger, den es nicht mehr
  gibt — genau die Fehlstrafe, gegen die 5.4 einen Riegel verlangt.

### 4.4 `data/watchdog.json`

```jsonc
{ "ts": 1788478632188, "playtime": 1321328400, "nodeReset": 1788271154961,
  "motorRunde": 3708, "motorRundeSeitMs": 9800,
  "uhren": { "echtzeitMs": 1788478632188, "motorzeitMs": 1321328400,
             "driftMs": 0, "wakesJeMin": 60 },
  "werkzeuge": [ { "datei": "blade.js", "host": "werk-0", "pid": 41,
                   "puls": "data/blade.json", "pulsAlterMs": 11035,
                   "grenzeMs": 600000, "urteil": "ok" } ],
  "stillstandSeitMs": 0, "urteil": "ok" }
```

- **Namenskollision, muss entschieden werden:** `sync/bridge.js:1054` liest
  schon heute eine **lokale** Datei `<DATA_DIR>/watchdog.json`, also
  `bitburner\data\watchdog.json` auf der Platte — nicht auf `home`. Zwei
  Dateien gleichen Namens an zwei Orten sind die Vorlage für einen Bericht,
  der die falsche zitiert. Vorschlag: die neue im Spiel heißt
  `data/watchdog.json`, die lokale wird zu `data/bridge-watchdog.json`.
- `wakesJeMin` ist die Antwort auf Verifikationsfrage 1 im laufenden Betrieb:
  60 = Tab sichtbar, 1 = gedrosselt. Ohne dieses Feld ist jedes Urteil über
  einen Stillstand unbelegt.
- **Räumen: JA, knotengebunden** (`boot.js:104`). PIDs, Hosts und
  Rundenzähler des alten Knotens würden in der ersten Sekunde des neuen einen
  Stillstand melden. 4.6 führt die Datei nicht unter den Bleibenden.

### 4.5 `data/graftplan.json`

```jsonc
{ "ts": 1788478632188, "nodeReset": 1788271154961, "augReset": 1788441726250,
  "stadt": "New Tokyo", "simulacrum": false,
  "laufend": null,                 // oder {aug, startTs, dauerMs, endeTs, kosten}
  "plan": [ { "aug": "Graphene Bionic Legs Upgrade", "preis": 13500000000,
              "dauerMs": 3078000, "multSumme": 1.6, "guete": 0.00052 } ],
  "gesperrt": [], "grund": null }
```

- **Räumen: NEIN — stattdessen prüfen.** Der Leser verwirft den Plan, wenn
  `nodeReset` **oder** `augReset` nicht mehr stimmen. Das ist robuster als eine
  Räumliste (die nur greift, wenn `boot.js` läuft) und ist genau die Bauform
  von `beitritt-erledigt.txt` (`bn4life.js:129-130`). `augReset` muss dabei
  sein, weil jeder Einbau die Preise um Faktor 1,9 je Stück verschiebt
  (`bn4rep.js`, Chargenfaktor) — ein Plan von vor dem Einbau ist nicht falsch
  datiert, er ist falsch gerechnet.
- Heute läge dieselbe Falle offen: `data/graft.json` und `data/bbgraft.json`
  auf `home` stammen vom **31.08.** (BitNode 6), und `tools/graftnext.js:56,88`
  liest beide ohne Alterprüfung.

### 4.6 `data/figure.txt`

```
blade.js|bladeburner-aktion|1788478632191|1788478692191|30
```
`<halter>|<zweck>|<ts>|<gueltigBis>|<prioritaet>` — ein Platz, wie `task.txt`.

- **Der Verfall (`gueltigBis`) ist der Kern**, nicht der Halter. Ein Halter,
  der stirbt, darf die Figur nicht für immer binden; genau diesen Fall löst
  `install-sperre.txt` seit dem 22.08. mit 5 min (`bn4rep.js:316-320,327`).
  Vorschlag: `gueltigBis = ts + 60000`, der Halter erneuert je Runde.
- `prioritaet` entscheidet Gleichstand, nicht die Reihenfolge des Schreibens.
  Ohne sie ist es kein Vergabepunkt, sondern ein Wettrennen — und das ist der
  Zustand von heute (C.14: sechs bis sieben Skripte greifen ohne Rangordnung).
- **Endung `.txt` ist Pflicht**, nicht Geschmack: Bitburner lässt nur eine
  kurze Liste von Endungen zu und weist alles andere mit „Invalid file
  extension" ab (`blade.js:1359-1361`, deshalb heißt die JSONL-Datei dort
  `aktionen.txt`). `.json` ist erlaubt, `.jsonl` nicht.
- **Räumen: JA, in beiden Listen** (`:77` und `:104`). Nach
  `installAugmentations` sind alle Skripte tot; ein stehender Halter wäre eine
  Lüge, und sie hielte den ersten Schreiber im neuen Lauf auf.

### 4.7 `data/backup-request.txt` / `data/backup-ok.txt`

```
request:  {"ts":1788478632188,"playtime":1321328400,"nodeReset":1788271154961,
           "anlass":"vor-sprung","wartetBisMs":90000}
ok:       {"ts":1788478642000,"datei":"LIVE_197f4d61481686_BN10L2_2026-09-04T01-31_vor-sprung.json.gz",
           "groesse":655870,"identifier":"197f4d61481686","geprueft":true}
```

- Beide existieren im Brückencode schon: `sync/bridge.js:731` liest `request`,
  `:756` schreibt `ok`, Wartefenster 90 s (`:725`). Der Dateiname im Beispiel
  stammt aus dem echten `data/bridge.json` (`lastVerifiedBackup.file`).
- `anlass` aus fester Liste: `connect`, `vor-sprung`, `vor-einbau`, `stunde`,
  `hand`.
- **Räumen: JA, knotengebunden** — 4.6 verlangt es wörtlich, und es ist der
  gefährlichste der drei Räumfälle: ein liegengebliebenes `backup-ok.txt` aus
  dem alten Knoten ließe `ausgang.js` den nächsten Sprung für gesichert halten,
  obwohl kein frisches Backup existiert. Das ist der Riegel aus 7.2, und er
  fehlt heute in `boot.js`.

### 4.8 `data/bridge.json`

Existiert (`sync/bridge.js:860-878`), Schema oben in 3.3 mit echtem Inhalt.
Ergänzungsvorschlag: `rfaPort` und `dashPort` mit hinein, damit ein Skript im
Spiel die Instanz vollständig identifizieren kann, ohne `instance.txt` zu
brauchen.

- **Räumen: NEIN — und das ist keine Bequemlichkeit.** Wird die Datei geräumt,
  sieht ein Leser im Spiel „Brücke tot", obwohl sie nur noch nicht wieder
  geschrieben hat. Der richtige Test ist das Alter von `ts`, nicht die
  Existenz. Deshalb muss der Leser **immer** `Date.now() - ts` prüfen und darf
  nie `fileExists` allein benutzen — derselbe Fehler wie bei
  `simulacrum.txt` (0.1).

### 4.9 `data/instance.txt`

```
LIVE|197f4d61481686|12525|1788478608370
```
`<instance>|<identifier>|<rfaPort>|<ts>`; Werte aus dem echten `bridge.json`.

- Zweck: ein Skript im Spiel muss unterscheiden können, ob es im Live- oder im
  Testspielstand läuft (7.3) — der Test darf keine Live-Backups anfordern und
  nicht nach `## Sofort` schreiben.
- **Räumen: NEIN** (4.6). Die Instanz ist eine Eigenschaft des Spielstands,
  nicht des Knotens; sie überlebt Sprung und Einbau genauso wie der
  `identifier`.

### 4.10 `data/version.txt`

```
a1b2c3d|bau-2026-09|1788478608370|118
```
`<git-sha7>|<zweig>|<ts-des-pushs>|<anzahl-geschobener-dateien>`

- Schreiber: die Brücke beim `pushAll` (`sync/bridge.js:421-422`).
- Zweck ist ein belegter Vorfall, kein Komfort: am **27.08.** wurden drei
  Änderungen an `blade.js` eingebaut, committet und „neu gestartet" und blieben
  wirkungslos, weil der Prozess unter derselben PID mit altem Code weiterlief;
  „erst ein PID-Vergleich zeigte es" (`bn4net.js:598-604`). Mit `version.txt`
  kann ein Werkzeug beim Start melden, welchen Stand es trägt.
- **Räumen: NEIN.** Skripte überleben den Knotenwechsel
  (`ServerHelpers.ts:224-239` löscht nur `programs` und `messages`) — die Marke
  über ihren Stand muss es dann auch, sonst behauptet sie nach jedem Sprung
  „unbekannter Codestand".

### 4.11 `data/sofort.json`

```jsonc
[ { "ts": 1788478632188, "nodeReset": 1788271154961,
    "quelle": "ausgang.js", "titel": "Sprung blockiert: Wirt < 540 GB",
    "text": "### Sprung blockiert…\n\nexit.js braucht 519,25 GB…",
    "id": "ausgang.js#sprung-blockiert-wirt", "zugestellt": null } ]
```

- `ts`, `nodeReset`, `quelle`, `titel`, `text` sind wörtlich aus 4.6. Die
  Brücke liest die Datei alle 60 s (`sync/bridge.js:914`), entdoppelt über
  `quelle + titel`, legt `nodes/BAU-2026-09/sofort/<ts>-<quelle>.md` mit
  `### <titel>` als erster Zeile an und ruft
  `node tools/liste.js --eintragen sofort --datei <pfad>`.
- **Zwei Felder schlage ich zusätzlich vor**, weil die Entdopplung sonst nur im
  Speicher der Brücke lebt und jeden Brückenneustart verliert — und 4.6
  verspricht ausdrücklich, dass gestaute Einträge „beim naechsten Verbinden
  nachgereicht" werden und „nicht doppelt eingetragen" werden:
  - `id` — stabiler Schlüssel, damit ein leicht geänderter Titel keinen zweiten
    Eintrag erzeugt;
  - `zugestellt` — ms oder `null`, von der Brücke gesetzt. Der Zustand liegt
    damit **in der Datei**, überlebt Brückenneustart, Einbau und Sprung.
  Dass diese Sorge nicht theoretisch ist, zeigt `data/popups-beitritt.txt`:
  dort steht „beigetreten: Tian Di Hui" dreimal innerhalb von zwei Sekunden
  (21:38:44, 21:38:45, 21:38:45).
- **Räumen: NEIN, ausdrücklich** (4.6: „Ringpuffer, überlebt Einbau und Sprung,
  **nicht** in den Räumlisten"). Deckel trotzdem nötig — Vorschlag 200
  Einträge, zugestellte zuerst verwerfen.

### 4.12 Zusammenfassung der Räumliste, wie sie nach dem Bau aussehen sollte

| `boot.js`-Liste | heute | neu dazu | heute streichen |
|---|---|---|---|
| jeder Aufruf (`:57-59`, `:77-81`) | `bn4-stop`, `install-sperre`, `beitritt-erledigt`, `rep-modus`, `company-order`, `geldbedarf`, `reload`, `hilfe` | `figure.txt` | `hilfe.txt` (kein Schreiber mehr) |
| Knotenwechsel (`:104-108`) | `task`, `exit-ziel`, `simulacrum`, `exit`, `keine-hacknet`, `keine-sleeves` | `watchdog.json`, `backup-request.txt`, `backup-ok.txt`, `batch-ziele.txt` | `exit-ziel.txt` (kein Schreiber) |
| bleibt immer | `verfahren.txt` | `kpi.json`, `events.json`, `penalties.json`, `sofort.json`, `instance.txt`, `version.txt`, `bridge.json`, `graftplan.json` | — |

---

## 5 Was überlebt einen Knotenwechsel?

**Die Regel ist einfacher als erwartet, und sie ist im Quellcode belegt:**

| Schritt | Datei:Zeile (v3.0.1) | Wirkung auf `data/` |
|---|---|---|
| `prestigeAllServers()` | `reference/v301/src/Server/AllServers.ts:136-138` — `AllServers.clear()` | **alle** Server verschwinden, danach wird nur `home` wieder eingehängt (`Prestige.ts:230`). Jede Kopie einer `data/`-Datei auf `werk-*` ist damit **weg** |
| `prestigeHomeComputer(homeComp)` | `reference/v301/src/Server/ServerHelpers.ts:224-239` | leert **nur** `programs` und `messages`. `textFiles` kommt in der ganzen Funktion nicht vor (`grep textFiles ServerHelpers.ts Prestige.ts` → 0 Treffer) |

> **Also: jede Datei unter `data/` auf `home` überlebt sowohl den
> Augmentierungs-Einbau als auch den BitNode-Wechsel. Das Einzige, was eine
> Datei entfernt, ist `boot.js` (oder ein ausdrückliches `ns.rm`).**

Damit ist die Tabelle eine Tabelle über `boot.js`, nicht über die Engine:

| Gruppe | Dateien | Überlebt Einbau? | Überlebt Knotenwechsel? |
|---|---|---|---|
| **A** — `boot.js:57-59,77-81`, jeder Aufruf | `bn4-stop.txt`, `install-sperre.txt`, `beitritt-erledigt.txt`, `rep-modus.txt`, `company-order.txt`, `geldbedarf.txt`, `reload.txt`, `hilfe.txt` | **NEIN** | **NEIN** |
| **B** — `boot.js:104-108`, nur bei Knotenwechsel | `task.txt`, `exit-ziel.txt`, `simulacrum.txt`, `exit.txt`, `keine-hacknet.txt`, `keine-sleeves.txt` | **JA** | **NEIN** |
| **C** — alle übrigen **122** Dateien | u. a. `verfahren.txt`, `batch-ziele.txt`, `aktionen.txt`, alle Telemetrien, alle Leichen aus Abschnitt 2 | **JA** | **JA** |

Drei Einschränkungen zu dieser Tabelle, jede mit einer der drei
Verifikationsfragen:

1. **Welche Uhr?** Die Gruppe-B-Räumung hängt an
   `Date.now() - ns.getResetInfo().lastNodeReset < 300000` (`boot.js:101`).
   Beide Größen sind **Echtzeit**, damit ist der Vergleich in sich stimmig —
   ein gedrosselter Tab verzerrt ihn nicht, weil `boot.js` als
   `callbackScript` unmittelbar nach dem Reset startet und die Räumung noch
   **vor** der Warteschleife läuft (`:100-109` vor `:120`). Der `catch` in
   `:102` fällt bewusst auf `true` zurück („im Zweifel raeumen").
2. **Was bei Stillstand und Nachholen?** Fällt `boot.js` aus — die Datei fehlt
   auf `home`, oder `installAugmentations` wird ohne Rückruf aufgerufen —
   räumt **niemand**, und Gruppe A und B verhalten sich wie Gruppe C. Das ist
   kein Randfall: `data/simulacrum.txt` steht heute genau deshalb falsch (0.1),
   nur aus dem anderen Grund (die Räumzeile war am Sprungtag noch nicht
   gebaut). **Deshalb ist die Räumliste die schwächere Bauform, und der
   Stempel im Inhalt die stärkere** — `beitritt-erledigt.txt` wäre auch ohne
   `boot.js` korrekt.
3. **Rate oder Bestand?** Alle Dateien der Gruppe C sind **Bestände**. Wird
   eine von ihnen nach einem Sprung als Rate gelesen — `graft.json` vom 31.08.
   in `tools/graftnext.js:56`, `bbspann.json` vom 30.08. in `tools/spann.js:42`
   — ist das Ergebnis nicht ungenau, sondern aus einem anderen BitNode.
   Kein Leser dieser beiden prüft ein Alter.

### 5.1 Ein Sonderfall, der in keiner der drei Gruppen steht

Sieben Skripte schreiben ihre Datei zuerst lokal und kopieren sie dann per
`ns.scp` nach `home` (`bn4rep.js:1206,1794`, `hashes.js:49`,
`sleevecrime.js:56`, `blade.js:1393`, `joinrun.js:43`, `graft.js:48`). Läuft
das Skript auf einem gekauften Rechner und stirbt der Rechner beim Reset,
bleibt auf `home` die **letzte kopierte** Fassung stehen — nicht die letzte
geschriebene. Für `keine-hacknet.txt` und `keine-sleeves.txt` fängt `boot.js`
das ab; für `rep-modus.txt` fängt es der 120-s-Verfall ab; für `simulacrum.txt`
fängt es **nichts** ab.
