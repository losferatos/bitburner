---
name: bb
description: Der Besuch beim Bitburner-Bot alle paar Tage — läuft noch alles in die richtige Richtung, und hat der Bot den BitNode-Wechsel selbst geschafft? Nutzen bei /bb und wenn Eric fragt „wie steht's im Bot", „läuft der noch richtig", „sind wir noch on track", „ist er schon gesprungen". NICHT nutzen zum Aufsetzen von Dauerloops (das war /bb-loops, seit 31.08.2026 abgeschafft). Zeigt der Besuch ein Problem, wird es im selben Zug gefixt (Arbeitsauftrag seit 22.09.2026).
---

# Bitburner: der Check-in

Eric spielt Bitburner, wenn er am Rechner sitzt, und schaltet es sonst aus.
Alle paar Tage kommt er mit **einer** Frage vorbei: *Läuft es, oder läuft
was schief?* Dieser Skill beantwortet genau das.

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`

**Zeigt der Besuch ein Problem, ist das ein Arbeitsauftrag (seit 22.09.2026).**
Erics Ansage: *„Der ingame Bot soll so autonom und optimal (wir haben immerhin
den source code) wie möglich agieren. Die Claude Code Session dient nur dafür
dies zu gewährleisten."* Eine Unregelmäßigkeit wird also **gefixt**, nicht nur
eingetragen: messen, Ursache belegen, bauen, Test (rot gegen alten Code, grün
gegen neuen), Skeptiker-Subagent, committen, einspielen (`tools/einspielen.js
--pruefen`, `tools/neustart.js` mit PID-Beleg), im Spiel nachmessen. Und nicht
beim Berichten anhalten, solange Befunde offen sind. Subagenten sind erlaubt.

Was sich damit NICHT ändert: keine Dauerloops, kein Handsprung, keine
Augmentierungen von Hand, keine Push-Nachrichten (Abschnitt unten).

**Vorsicht, die Brücke schiebt `src/` sofort ins Spiel.** Jede gespeicherte
Änderung dort liegt 400 ms später im laufenden Spiel (nur die Datei - laufende
Skripte behalten ihren Code bis zum Neustart). Unfertiges also nicht in `src/`
liegen lassen; Gegenproben gegen alten Code in einer Kopie außerhalb fahren.

**Seit dem 02.09.2026 springt der Bot selbst.** `src/ausgang.js` liest
`src/route.json` (die Roadmap als Datei) und `ns.getResetInfo()`, kennt beide
Ausgangswege (21 Black Ops ODER Red Pill + Hacking-Level) und startet
`exit.js` dort, wo Platz ist. Es gibt keinen Handsprung mehr und keine
Rückfrage — der Skill prüft nur, ob das Skript läuft und was es sagt.

## 1. Messen — ein einziger Aufruf

```bash
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/checkin.js
```

Das Werkzeug rechnet alles Deterministische selbst: Lauf und Verfahren aus
`data/ausgang.json`, Rang gegen die 400.000 von Operation Daedalus, Rate,
ETA, Vergleich mit dem letzten Besuch. **Übernimm seine Zahlen, rechne nicht
daneben.** Die letzte Zeile ist das Urteil.

**Vorsicht mit der Uhr.** Das Spiel schreibt Offline-Zeit voll auf
`totalPlaytime` (`engine.tsx:344`); ein Fenster, in dem der Rechner aus war,
liefert deshalb „Tempo 1,0" und eine Rate, die in Wahrheit ein Bestand ist
(Befund im Audit vom 02.09., Abschnitt F). Sieh dir die Raten nur an, wenn
das Spiel seit dem letzten Besuch durchgelaufen ist.

Ist die Brücke tot (`URTEIL: BLIND`), starte **nur sie**:

Per WMI im PowerShell-Werkzeug, NICHT per nohup (29.09.2026): Aus dem
Bash- oder PowerShell-Werkzeug gestartet, starb die Brücke still, sobald die
Claude-App ihre Prozesse abräumte (vermutlich Job-Objekt; kein Eintrag in
data/bridge.log). Per WMI gestartet hat sie die Nacht zum 30.09. überlebt.

```powershell
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'cmd /c "cd /d C:\Users\erche\Desktop\claude_projecto\bitburner && "C:\Program Files\nodejs\node.exe" sync/bridge.js --instance LIVE > %TEMP%\bridge-live.log 2>&1"'; CurrentDirectory = 'C:\Users\erche\Desktop\claude_projecto\bitburner' }
```

Danach fünf Sekunden warten und den Prüflauf wiederholen.

**Nicht `node tools/aufsicht.js` nehmen.** Das würde den residenten Wächter
`tools/wache.js` mitstarten, und der gehört zur alten Betriebsart; er startet
Werkzeuge doppelt (Audit 02.09., Befund C.12/13). Läuft er trotzdem (der
Windows-Autostart `Bitburner-Aufsicht.cmd` wirft ihn beim Hochfahren an),
sag Eric das in einem Halbsatz.

## 2. Nach dem Urteil handeln

| Urteil | Was zu tun ist |
|---|---|
| `AUF KURS` | Nichts. Drei Zeilen ausgeben, fertig. |
| `SPRINGT` | `exit.js` läuft. Eine Minute warten, erneut messen: steht der neue Knoten (Lauf +1 oder anderer Knoten), ist der Wechsel geglückt. |
| `SPRUNG KLEMMT` | Ausgang offen, aber `exit.js` findet keinen Platz oder endete ohne Sprung. `data/ausgang.txt` über die Brücke lesen, die letzte Zeile sagt warum. Ursache fixen. |
| `GEWERK FEHLT` | Der Knoten ist fertig, und nur noch Einträge mit fehlendem Gewerk sind offen (`boerse.js` für BN8; `hashes.js` für BN9 gibt es seit 02.09.). Eric sagen, was fehlt — das ist der einzige Fall, in dem der Bot wirklich auf einen Menschen wartet. |
| `AUSGANG FEHLT` | `data/ausgang.json` ist alt oder fehlt: `ausgang.js` läuft nicht, also springt am Ende niemand. Starten: `node tools/task.js ausgang.js`, dann erneut messen. |
| `HACKINGWEG` | V1-Knoten (BN1, 5, 12, 8): kein Rang, der Träger ist das Hacking-Level gegen w0r1d_d43m0n. Stand steht in der Kopfzeile. |
| `ANLAUF` | V2-Knoten vor dem Bladeburner-Beitritt: Kampfwerttraining trägt, `node tools/tor.js` rechnet die Phase. |
| `ZAEH` | Die ETA ist gegenüber dem letzten Besuch **gestiegen**. Nachsehen, woran (Abschnitt 3); ist es ein Bot-Fehler, fixen. |
| `STEHT` | Der Rang bewegt sich nicht. Erst `node tools/rueckstand.js` — hängt das Spiel nur der Uhr hinterher, ist nichts kaputt. Sonst Abschnitt 3. |
| `HILFE` | Der Bot hat selbst `data/hilfe.txt` geschrieben (nur noch `bbtrain.js`). Den Text lesen und Eric sagen, was er bedeutet. |
| `ACHTUNG`-Zeile im Bericht | Der Rang liegt über 400.000, aber die Black-Ops-Liste war nicht lesbar. Eine Minute später erneut messen. |
| `SPIEL ZU` | Kein Fehler. Eric sagen, dass der Tab zu ist — mehr nicht. |
| `BLIND` | Brücke starten (oben), dann neu messen. |

**Die Route ändert niemand auf Zuruf.** Sie liegt in `src/route.json`
(die Brücke schiebt `.json` ins Spiel), abgeleitet aus
`nodes/AUDIT-ROADMAP-2026-08-24.md`. Jede Änderung braucht ein grünes
`node tools/test-route.js`.

## 3. Wenn etwas schiefläuft — die drei Fragen, die es meistens sind

Bevor du irgendetwas anderes vermutest:

- **Steht die Zweit-Tab-Sperre?** `data/zweittab-alarm.json` — wenn diese
  Datei liegt, geht seit ihrem Zeitstempel **nichts** mehr ins Spiel: kein
  Hot-Swap, kein `tools/task.js`, kein `tools/hand.js`, kein
  `tools/nightshift.js`. Der Bot läuft im Spiel ungehindert weiter, aber von
  außen ist er nicht mehr erreichbar, und das sieht von hier aus wie „das
  Werkzeug antwortet nicht".

  Die Brücke setzt sie nur, wenn sich eine zweite RFA-Verbindung meldet
  **während die bestehende noch antwortet** — also wenn zwei Spiele auf
  demselben Spielstand laufen. Das ist kein Verdacht, sondern ein Befund, und
  der Schaden daran (zwei Instanzen autosaven alle 60 s in dieselbe
  IndexedDB, der letzte gewinnt) ist genau der, den Eric ausgeschlossen haben
  will.

  **Aufheben darf nur ein Mensch**, und erst nachdem geklärt ist, ob wirklich
  ein zweiter Tab offen war: `totalPlaytime` in den letzten Sicherungen
  ansehen (`backups/INDEX.tsv`) — sinkt sie irgendwo, hat ein zweiter Stand
  geschrieben. Sonst war es ein Fehlalarm. Danach die Datei löschen; ein
  Brückenneustart ist dafür **nicht** nötig und wäre selbst ein Eingriff.

  Solange sie steht, sichert die Brücke alle fünf Minuten unter dem Anlass
  `race` (nicht `hourly` — sonst fräße der Stückzahldeckel in vier Stunden
  genau die Historie weg, die man zum Nachsehen braucht).

- **War der Rechner aus oder der Tab verdeckt?** Ein verdeckter Tab ist
  KEIN Befund, solange der Tonanker `wakelock.js` laeuft - `checkin.js`
  schreibt es hinter "Tab verdeckt" dazu (am 22./23.10. gemessen: verdeckt
  6 Runden je Minute, volle Fahrt). Eric NICHT raten, den Tab in den
  Vordergrund zu holen; nur "OHNE Tonanker" ist ein Fall zum Fixen
  (wakelock.js neu starten). Ein ausgeschalteter Rechner schreibt beim Laden die
  zuletzt laufende Arbeit als Klumpen auf EINEN Wert (10 h Gym gingen am
  02.09. komplett auf Agility). Beides sieht wie „langsam" aus und ist
  keins von beiden ein Bot-Fehler.
- **Holen die Sleeves nach?** Sie haben einen Zyklusdeckel und arbeiten
  nach einer Pause mit 15-facher Geschwindigkeit — im Gym 36.000 $/s je
  Sleeve. Ein Konto, das plötzlich fällt, ist meist das.

Erst danach lohnt ein Blick auf `node tools/strategie-check.js` und
`node tools/plan.js`. Findest du eine echte Ursache: **fixen** (Ablauf oben). Änderungen an `src/`
laufen unbeaufsichtigt weiter und gehören vor dem Einbau durch einen
Skeptiker-Subagenten — der ist Teil des Fixes, keine eigene Verabredung.

## 4. Ausgabe

**Höchstens 5 Stichpunkte**, keine Vorrede, keine Tabellen:

1. Wo wir stehen (Knoten, Lauf, Verfahren, Ziel danach; im V2-Knoten Rang
   absolut gegen 400.000 und offene Black Ops)
2. Was der Bot gerade tut
3. Nur falls vorhanden: was schiefläuft und was es heißt
4. Nur falls `GEWERK FEHLT`: welches Gewerk, und dass der Bot bis dahin im
   fertigen Knoten wartet

**Und als LETZTE Zeile, immer und ohne Ausnahme, die Fertig-Schätzung.**
`checkin.js` gibt sie als `FERTIG VORAUSSICHTLICH:` aus — übernimm sie als
Kalenderdatum, nicht als Stundenzahl, und stell sie ans Ende. Erics Ansage vom
31.08.2026: *„am Ende vom /bb soll die aktuelle Schätzung kommen, wann der BN
fertig sein wird."* Eine weggelassene Schätzung ist keine ehrlichere Antwort,
nur eine unbequemere.

Läuft alles, sind drei Zeilen plus die Schlusszeile genug.

## Was dieser Skill NICHT tut

- **Loops aufsetzen.** `/bb-loops` ist seit dem 31.08.2026 abgelöst.
- **Von Hand springen.** `node tools/task.js exit.js <ziel>` umgeht die
  Route und die Gewerk-Prüfung — das war der Weg bis zum 01.09. und ist es
  nicht mehr. Wenn der Bot nicht springt, sagt `data/ausgang.txt` warum.
- **Push-Nachrichten schicken.** Der ntfy-Kanal ist seit dem 31.08.2026
  dauerhaft aus (`~/.claude/notify-aus`), auf Erics ausdrückliche Ansage.
- **Augmentierungen von Hand kaufen**, einen zweiten Tab auf
  bitburner-official.github.io öffnen, `b1tflum3` oder den Destroy-Knopf
  anfassen. Gilt unverändert.
- **Die BitNode-Reihenfolge bewerten.** Sie steht durch Fables Analyse fest
  (`nodes/AUDIT-ROADMAP-2026-08-24.md`, als Datei `src/route.json`).

Systemzeit immer per `date`, nie schätzen.
