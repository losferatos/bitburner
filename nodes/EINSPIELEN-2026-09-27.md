# Einspielplan 27.09.2026 - Integrationsstand A+B+C ins Spiel

Fuer Eric, lokal unter Windows, mit den Werkzeugen des Repos. Stand:
`claude/new-session-zf9ris` (A+B+C plus Integrationsfixes), Basis master 5e4c51c.
Grundlage: `tools/einspielen.js`, `tools/neustart.js`, `tools/hotswap.js`,
`sync/bridge.js` (Master-Riegel), `nodes/BAU-2026-09/EINSPIELUNG-2026-09-04.md`,
die drei Skeptikerberichte und `nodes/audit-2026-09-26/skeptiker-integration.md`.

Kurzfassung:
1. Stand nach master bringen (die LIVE-Bruecke schiebt nur, was in `master` steht),
   Einbausperre setzen, `node tools/hotswap.js --pruefen`.
2. Stufe 1 (Bibliotheken, Ofen-Arbeiter, Registry) einspielen - wirkt noch nicht.
3. Stufe 2: `bn4net.js` + `ausgang.js` einspielen, Kern NUR ueber seinen eigenen
   Selbstneustart (`node tools/neustart.js bn4net.js` = `SELBST bn4net.js`), dann ausgang.
4. Stufe 3: bn4rep, bn4life, hacknet, hashes, joinrun einspielen und neu starten.
5. Eine Stunde beobachten (Liste unten), dann RAM live nachmessen, Sperre aufheben.

---

## 0. Was sich aendert (git diff --name-status 5e4c51c..Kopf -- src)

14 Dateien, 13 geaendert (M), 1 neu (A), 0 geloescht.

| Paket | Datei | Art | Inhalt |
|---|---|---|---|
| A | `bn4rep.js` | M | A1 Fokus zurueck nach 30 s, A2/A3 BN12-Spende und Daedalus live, A4-A7 Einbau-Trigger, Handschlag ohne return, Warten mit `state: "wait"` |
| A | `lib/einbau.js` | **A** | reine Entscheidungsfunktionen (Fokus, Horizont, Spendenrecht, Red Pill, Favor) |
| B | `bn4net.js` | M | Ofen mit Frist, Zielwahl mit Vorbereitung und Hysterese, darkweb nur als Notnagel, BN12-Stufen, Ofen raeumbar (Integration) |
| B | `lib/calc.js` | M | neue Exporte `targetMetrics`, `targetRank`, `selectMoneyTargets`, `effectivePrepSec` |
| B | `worker/expfarm.js` | M | Arbeiter mit Frist `[ziel, frist, runde]` statt Endlosschleife |
| B | `ausgang.js` | M | raeumt `worker/expfarm.js` als rueckgewinnbar |
| B | `lib/bitnodes.json` | M | neu erzeugt, BN12-Stufen, keine negativen Werte |
| C | `joinrun.js` | M | Figur mit `PRIO.beitritt` 25, Daedalus-Tor, Antrag waehrend des eigenen Trainings (Integration) |
| C | `lib/figur.js` | M | `PRIO.beitritt = 25` |
| C | `bn4life.js` | M | joinrun/netburn erst ab 5 Mio (Integration), RAM wie master |
| C | `hacknet.js`, `hashes.js` | M | erster Server nur in BN9; ausserhalb BN9 ohne Gratis-Server Ende mit `data/keine-hacknet.txt` |
| C | `lib/handschlag.js` | M | Einbausperre per `nachHome` |
| A/C | `registry.json` | M | bn4rep 10,85/52,70 + needsLibs `lib/einbau.js`; graftauto `verfahren: "V2"` |

**Nur zusammen einspielen** (sonst stirbt ein Skript beim Import oder arbeitet mit dem falschen Protokoll):

- `bn4net.js` + `lib/calc.js` + `worker/expfarm.js` + `ausgang.js` + `lib/bitnodes.json` + `registry.json`
  (bn4net importiert neue calc-Exporte; ein neuer Kern mit altem `expfarm.js` startet Endlos-Arbeiter,
  deren Frist er fuer gueltig haelt - siehe 3.3).
- `bn4rep.js` + `lib/einbau.js` + `registry.json` (Import; der Kern kopiert `lib/einbau.js` nur mit
  der neuen Registry auf die Werkbank).
- `joinrun.js` + `lib/figur.js` (mit altem figur.js ist `PRIO.beitritt` undefiniert, der Antrag gilt nie).
- `hacknet.js` + `hashes.js` (gemeinsamer Marker).
- `lib/handschlag.js` ist unabhaengig (API gleich, `nachHome` gibt es in `lib/hostdatei.js` schon);
  wirkt erst beim Neustart von bn4rep/ausgang.

`data/nicht-schieben.txt` enthaelt nur `graftplan.json` - keine der 14 Dateien ist betroffen,
graftplan.json bleibt draussen.

## 1. RAM vorher/nachher (tools/ram.js, gerechnet)

Spalten: SF4.3 ausserhalb BN4 (der Stand der Route), Registry-Aufteilung Basis/Singularity
(`sing = (SF4.1 - SF4.3) / 15`).

| Skript | master SF4.3 | neu SF4.3 | master Basis/Sing | neu Basis/Sing | Aenderung |
|---|---:|---:|---|---|---|
| bn4rep.js | 63,25 | 63,55 | 10,75 / 52,50 | 10,85 / 52,70 | +0,30 (getTotalScriptIncome, isFocused/setFocus) |
| joinrun.js | 26,35 | 31,45 | 3,35 / 23,00 | 8,45 / 23,00 | +5,10 (getBitNodeMultipliers 4, getResetInfo 1) |
| bn4life.js | 23,85 | 23,85 | 5,85 / 18,00 | 5,85 / 18,00 | 0 |
| bn4net.js | 10,80 | 10,80 | 10,80 / 0 | 10,80 / 0 | 0 |
| hacknet.js | 10,45 | 10,45 | 10,45 / 0 | 10,45 / 0 | 0 |
| ausgang.js | 8,15 | 8,15 | 8,15 / 0 | 8,15 / 0 | 0 |
| hashes.js | 5,95 | 5,95 | 5,95 / 0 | 5,95 / 0 | 0 |
| graftauto.js | 17,25 | 17,25 | 16,75 / 0,50 | 16,75 / 0,50 | 0 (nur Verfahren V2) |
| worker/expfarm.js | 1,75 | 1,75 | - | - | 0 |
| lib/einbau.js, lib/calc.js, lib/figur.js | 1,60 (Grundlast, als Import 0) | 1,60 | - | - | 0 |
| lib/handschlag.js | 2,35 | 2,35 | - | - | 0 |

`node tools/ram.js --registry`: alle 25 Eintraege stimmen. Im Spiel gemessen ist davon noch nichts
(Abschnitt 5.9).

## 2. Vorbereitung (lokal, Windows)

1. Bruecke laeuft (`start.cmd`), Spiel verbunden, `data/bridge.json` zeigt eine gruene Sicherung.
2. **Stand nach master holen.** Die LIVE-Bruecke laesst per Master-Riegel nur Dateien ins Spiel, die in
   `git ls-tree master -- src/` stehen (`sync/bridge.js`, auch der Dashboard-Weg von einspielen.js,
   Antwort 423). `lib/einbau.js` ist neu - ohne master wird sie abgewiesen.
   ```
   git fetch origin
   git switch master
   git merge --ff-only origin/claude/new-session-zf9ris
   ```
   Der Watcher sieht dabei 14 geaenderte Dateien, mehr als SCHUB_MAX 8 - er meldet
   "Grosser Schub verweigert" und schiebt NICHTS. Das ist gewollt: eingespielt wird gestuft (Schritt 3).
   Keine `data/schub-frei.txt` anlegen.
3. **Vorher-Stand festhalten** (Rollback-Beleg) - VOR dem Merge aus Schritt 2, solange der
   Arbeitsbaum auf 5e4c51c steht:
   `node tools/einspielen.js --pruefen ausgang.js bn4life.js bn4net.js bn4rep.js hacknet.js hashes.js joinrun.js lib/bitnodes.json lib/calc.js lib/einbau.js lib/figur.js lib/handschlag.js registry.json worker/expfarm.js`.
   Erwartet: "schon drin" fuer
   jede alte Datei, "WUERDE ... (neu)" fuer `lib/einbau.js`. Weicht eine ab, liegt im Spiel eine
   Fassung, die nicht master ist - dann deren Inhalt erst sichern (`getFile` ueber das Dashboard) und
   den Rollback darauf stuetzen, nicht auf 5e4c51c.
4. **Einbausperre setzen** (kein Einbau waehrend des Umbaus; alte und neue bn4rep lesen JSON mit `bis`):
   ```
   node -e "const n=Date.now();fetch('http://localhost:8795/api/rpc?instance=LIVE&method=pushFile&server=home&filename=data/install-sperre.txt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:JSON.stringify({ts:n,reason:'hotswap',bis:n+3*3600e3})})}).then(r=>r.json()).then(console.log)"
   ```
   (`data/` ist vom Master-Riegel ausgenommen.) Eine Motorrunde warten.
5. `node tools/hotswap.js --pruefen` - Checkliste: kein offener Ausgang (`data/ausgang.json offen:false`),
   kein laufender Graft, Einbausperre gueltig, git sauber. Bei offenem Ausgang NICHT einspielen
   (Sprung abwarten).

## 3. Einspielen und Neustart

Grundregeln:
- `einspielen.js` schreibt Datei fuer Datei und liest jede zurueck (sha256). Es startet nichts neu.
  Seine Schlusszeile nennt `tools/hand.js reload` - **den Aufruf gibt es nicht**; neu gestartet wird
  mit `tools/neustart.js` (PID-Beleg).
- **Der Kern `bn4net.js` wird nur ueber seinen eigenen Mechanismus neu gestartet**: `data/reload.txt`
  mit `SELBST bn4net.js`. bn4net liest das in Abschnitt 0b jeder Runde, beendet sich per `ns.exit()`
  an definierter Stelle - aber nur, wenn ein Rueckholer laeuft (guard.js, popups.js oder bn4life.js;
  liegt `data/bn4-stop.txt`, zaehlt nur popups.js). Sonst bleibt der Befehl stehen und wird verschoben.
  `WERKZEUG bn4net.js` lehnt der Kern ab. `node tools/neustart.js bn4net.js` waehlt den richtigen
  Kanal von selbst, wartet auf die Quittung (reload.txt geleert) und vergleicht die PID.
  Nie `kill`/`killall` auf den Kern.

### 3.1 Stufe 1 - passiv (wirkt erst mit den Neustarts)

```
node tools/einspielen.js --stufe 1 lib/einbau.js lib/calc.js lib/figur.js lib/handschlag.js lib/bitnodes.json worker/expfarm.js registry.json
```
Erwartet: 7 "EINGESPIELT", 0 Fehler. Laufende Skripte behalten ihren geladenen Code.
Hinweise: guard.js liest `registry.json` jede Runde - die neue Registry aendert nur RAM-Zahlen,
bn4rep-needsLibs und graftauto V2, beides unkritisch. Der alte Kern startet keine expfarm-Arbeiter
(er kennt sie nicht), das neue `expfarm.js` bleibt also bis Stufe 2 ungenutzt.

### 3.2 Stufe 2 - Kern und Ausgang

```
node tools/einspielen.js --stufe 2 bn4net.js ausgang.js
node tools/neustart.js bn4net.js
node tools/neustart.js ausgang.js
```
Erwartet: neue PID fuer bn4net (auf home) und ausgang. In `data/bn4net-log.txt`:
"Neuladen angefordert - beende mich, die Wache holt mich zurueck", danach "bn4net gestartet".
In `data/bn4net.json` neu: `bnWerte`, `mischung.rundenTaktMs`.

### 3.3 Laufende Ofen-Arbeiter beim Wechsel

- Der master-Kern startet `worker/expfarm.js` gar nicht (sein Ofen war `worker/weaken.js` als
  Einwegwelle). Im Spiel laufen also normalerweise KEINE alten Endlos-Ofenfaeden
  (Spielstaende 00:23-19:04: keiner). Die alten weaken/grow-Einwegfaeden enden von selbst.
- Laeuft doch ein alter Endlosfaden (`args` nur `[ziel]`, aus einer Fassung vor master), raeumt ihn
  der neue Kern in der ersten Runde (keine Frist -> kill, `test-b8-ofen-gegenpruefung.js` E).
- Deshalb die Reihenfolge: `worker/expfarm.js` (Stufe 1) VOR dem Kernneustart. Ein neuer Kern mit
  altem expfarm.js wuerde Endlosfaeden mit gueltiger Frist starten, die er nicht als alt erkennt.
- Neue Faeden enden selbst an ihrer Frist (naechste Speicherzaehlung minus 250 ms); bei langer
  weaken-Dauer (nach Einbau/Sprung) laufen sie genau einen Aufruf lang.

### 3.4 Stufe 3 - Progression und Nebengewerke

```
node tools/einspielen.js --stufe 3 bn4rep.js bn4life.js joinrun.js hacknet.js hashes.js
node tools/neustart.js bn4rep.js
node tools/neustart.js bn4life.js
node tools/neustart.js hashes.js hacknet.js
```
- bn4rep: der Kern kopiert `lib/einbau.js` (needsLibs) vor dem Start auf die Werkbank.
- bn4life: `WERKZEUG bn4life.js` beendet es netzweit, der Kern (Abschnitt 0a) startet es auf home neu.
- hashes/hacknet: laufen sie nicht (Marker oder Platz), meldet neustart.js "traf NICHTS" - dann nichts tun.
- joinrun.js ist ein Einmallaeufer, den bn4life startet. Laeuft gerade einer, NICHT beenden (die
  Beitrittsmarke ist gesetzt, er kaeme in diesem Zyklus nicht wieder) - er endet nach hoechstens
  45 + 2 min; der naechste Start nimmt die neue Fassung.
- Nicht neu starten muessen: guard.js, popups.js, wakelock.js, boot.js (unveraendert).
- `lib/handschlag.js` und `lib/figur.js` wirken mit den Neustarts oben (bn4rep, ausgang, bn4net, joinrun).

Zum Schluss `node tools/einspielen.js --pruefen` mit allen 14 Dateien: 14 "schon drin".
Einbausperre erst nach der ersten Beobachtungsstunde aufheben (`data/install-sperre.txt` loeschen
oder `bis` ablaufen lassen).

## 4. Erste Stunde: worauf achten, erwartete Zahlen, wo nachsehen

Zahlen aus den Nachspielungen der Skeptiker mit echten Spielstaenden (BN5.2) - gerechnet, nicht gemessen.
Welche Lage gilt, haengt vom Moment ab: im Zyklus mit ausgebautem Netz gilt "18:04-artig"
(~43 TB Ueberschuss, Level ~3900), direkt nach einem Einbau "19:04-artig", nach einem Sprung
"Knotenwechsel" (home 128 GB).

1. **Fokus der Faktionsarbeit (A1).** `node tools/lage.js --arbeit` zeigt "Fokus: JA/NEIN".
   Erwartet: laeuft FactionWork, dann Fokus JA, hoechstens 30 s + eine bn4rep-Runde nach einem
   UI-Eingriff NEIN. `data/bn4rep-log.txt`: "Fokus zurueckgeholt (...)" hoechstens alle 5 min.
   Vorher: 14 von 25 stuendlichen Sicherungen mit FactionWork ohne Fokus (x0,8). Nachher in den
   stuendlichen `backups/*_hourly.json.gz`: 0 von n, solange kein NMI eingebaut ist.
2. **Erfahrung (B2).** 18:04-artig: ~1,45e6 exp/s gegen 1,03e5 vorher (x14). Nach einem Einbau
   (19:04-artig): Level nach 120 s ~4.282 statt 3.423. Nach einem Sprung (Mult 1,43, 1 TB): Level
   nach 5/15/30 min ~157/238/275 (gleich der alten Einwegwelle, nie schlechter). Ablesen:
   `data/bn4net.json` `hacking` (Level) ueber die Zeit, `mischung.ueberschussGb`, `mischung.expStandGb`;
   `brachAnteil` sollte klein sein (19:04 vorher 0,84).
3. **Rundentakt.** `mischung.rundenTaktMs` ~10.000 (kuerzester der letzten 6). Deutlich darueber heisst
   gedrosselter Tab - Ofenfrist folgt dem, kostet aber Erfahrung (Streuung 0-2 s: -4,9 %).
4. **Geldziele ohne Pendeln (B1/S-2).** `data/bn4net.json` `batchZiele`, `zieleAnzahl`,
   `mischung.gesperrt`. 18:04-artig: Stapel wechselt einmal sofort auf 4sigma/ecorp/clarkinc
   (471-636 s Vorbereitung, gewollt), danach stabil; 17 arbeitende Geldziele; Ein-/Austritte von
   Geldzielen ~24 je 90 min (nicht Hunderte). Nach einem Sprung: 5-12 Anlaufabbrueche je 3 h sind normal.
5. **Kein Nullfenster.** Nach einem Einbau Hack-Einnahmen binnen weniger Minuten
   (`geld` in `data/bn4net.json` steigt; Audit 6#2 alt: 11-25 min 0 $). Nach einem Sprung gerechnet
   erstes Geld nach 300-420 s statt 6.150 s.
6. **darkweb.js.** Solange bn4life laeuft: KEINE Zeile "Portknacker nachkaufen: darkweb.js" in
   `data/bn4net-log.txt` (auch nicht in den ersten 2 min nach einem bn4life-Start). Portprogramme
   kauft bn4life (`data/bn4life-log.txt`).
7. **joinrun/netburn nach einem Sprung.** Erst ab 5 Mio Konto: `data/bn4life-log.txt`
   "Nach Einbau: ... joinrun.js gestartet". In `data/joinrun.txt` je Kampfwert EIN "Training ..."
   und kein erneuter Start alle 15 min; `data/figure.txt` owner `joinrun.js` waehrend des Trainings.
8. **shop.js nach einem Sprung.** Laeuft (oder `data/preise.json` juenger als 4 min); keine Logzeile
   "shop.js gehoert auf home und findet dort nur ...". Gerechnet nach dem Sprung: home 128 GB,
   frei 5,30 GB nach guard/bn4net/bn4life/wakelock/cdump/sleevecrime/hashes/shop/ausgang/sleeve/hacknet;
   homegrow wartet.
9. **Waechter.** Keine neuen S1-Eintraege fuer bn4rep/hashes/hacknet in `data/penalties.json`;
   `data/watchdog.json` ohne Eskalation; keine "WERKZEUG ... traf NICHTS"-Schleifen im Kernlog.
   Am Einbau-Tor schreibt bn4rep `state: "wait"` mit `warteGrund` - das ist gesund.
   hashes/hacknet ausserhalb BN9 ohne Gratis-Server: einmal "beende mich" und
   `data/keine-hacknet.txt` mit der Knotennummer - danach kein Neustart.
10. **Ofenfaeden enden selbst.** `node tools/lage.js --procs` (Faeden je Skript aus dem Spielstand)
   zweimal im Abstand einiger Minuten: `worker/expfarm.js` schwankt mit dem Ueberschuss, waechst aber
   nicht stetig. (`ps.js`/`data/ps.json` blendet Arbeiter aus.) Argumente pruefen: im stuendlichen
   Spielstand `backups/*_hourly.json.gz` (AllServersSave -> runningScripts) hat jeder expfarm-Faden
   3 Argumente, `args[1]` (Frist) nahe am Speicherzeitpunkt; kein Faden mit nur `[ziel]`.
11. **share.** Im Repmodus `shareFaeden` ~ 12 % von ramTotal / 4 GB (in allen Spielstaenden exakt 12,00 %).
12. **RAM live nachmessen (test-ram gruen machen).** Binnen 30 min nach der Sonde:
   ```
   node tools/task.js startdiag.js bn4net.js bn4rep.js bn4life.js joinrun.js ausgang.js hacknet.js hashes.js worker/expfarm.js graftauto.js
   node tools/eichung-messen.js            (zeigt Spiel gegen Rechner)
   node tools/eichung-messen.js --schreib  (schreibt doku/ram-messung-2026-09-04.json)
   ```
   Dasselbe fuer die uebrigen Dateien in `VERALTET_ERLAUBT` (`tools/test-ram.js`), bis
   `node tools/test-ram.js` ">= 100 Zeilen geeicht" meldet (heute 76); gemessene Dateien aus
   `VERALTET_ERLAUBT` streichen, beides committen. Erwartete Spielwerte (SF4.3): bn4rep 63,55,
   joinrun 31,45, bn4life 23,85, bn4net 10,80. Weicht das Spiel ab, schreibt eichung-messen nichts -
   das ist dann ein Befund.

## 5. Rollback auf master 5e4c51c

1. Einbausperre setzen (Schritt 2.4), `node tools/hotswap.js --pruefen`.
2. Alte Fassungen in den Arbeitsbaum UND nach master, ohne Geschichte umzuschreiben
   (der Master-Riegel prueft nur Dateinamen, der Watcher schiebt den Inhalt - also muss master
   die alten Inhalte tragen):
   ```
   git switch master
   git checkout 5e4c51c -- src
   git commit -m "Rollback src auf 5e4c51c (Einspielung 27.09. zurueckgenommen)"
   ```
   `lib/einbau.js` bleibt dabei im Baum (checkout loescht keine neuen Dateien) - unschaedlich.
   Der Watcher verweigert den grossen Schub wieder (> 8 Dateien); eingespielt wird gestuft (Schritt 3).
3. Einspielen in umgekehrter Reihenfolge der Abhaengigkeiten, und Kern-Gruppe wieder zusammen:
   ```
   node tools/einspielen.js --stufe R1 bn4rep.js bn4life.js joinrun.js hacknet.js hashes.js
   node tools/einspielen.js --stufe R2 bn4net.js ausgang.js lib/calc.js worker/expfarm.js lib/bitnodes.json registry.json lib/figur.js lib/handschlag.js
   node tools/neustart.js bn4net.js
   node tools/neustart.js ausgang.js bn4rep.js bn4life.js
   ```
   `lib/einbau.js` darf liegen bleiben (niemand importiert sie mehr); Aufraeumen ueber das Dashboard
   (`deleteFile`) ist optional.
4. Ofenfaeden neuer Art enden von selbst an ihrer Frist; der alte Kern startet keine neuen.
5. Dateien, die der neue Code schreibt und die der alte anders liest:
   - `data/keine-hacknet.txt` (Knotennummer): der alte Kern startet dann auch hashes/hacknet nicht -
     loeschen, wenn das alte Verhalten (hacknet kauft in V1 einen Server) gewuenscht ist.
   - `data/install-sperre.txt` (JSON mit `bis`, auch von bn4rep gespiegelt): der alte bn4rep liest
     JSON mit `bis` korrekt (seit 22.09.) - nach dem Rollback bewusst loeschen, sobald eingebaut werden darf.
   - `data/figure-request-joinrun.js.json` mit prio 25: verfaellt nach 150 s, zur Sicherheit loeschen.
   - `data/bn4rep.json` mit `state: "wait"`/`warteGrund`: guard.js ist unveraendert, liest es gleich; harmlos.
   - `data/beitritt-erledigt.txt`: gleiches Format wie vorher; harmlos.
   - `data/bn4net.json` mit `bnWerte`/`mischung.rundenTaktMs`: zusaetzliche Felder, harmlos.
6. `node tools/einspielen.js --pruefen` gegen den master-Stand: alle "schon drin".
