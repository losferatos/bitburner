---
name: bb-check
description: Der Besuch beim Bitburner-Bot alle paar Tage — steht der BitNode-Wechsel an, und läuft noch alles in die richtige Richtung? Nutzen bei /bb-check und wenn Eric fragt „können wir schon resetten", „wie steht's im Bot", „läuft der noch richtig", „sind wir noch on track". NICHT nutzen zum Aufsetzen von Dauerloops (das war /bb-loops, seit 31.08.2026 abgeschafft) und nicht für Umbauten am Bot — dafür sagt Eric ausdrücklich Bescheid.
---

# Bitburner: der Check-in

Eric spielt Bitburner, wenn er am Rechner sitzt, und schaltet es sonst aus.
Alle paar Tage kommt er mit **einer** Frage vorbei: *Können wir wechseln, oder
läuft was schief?* Dieser Skill beantwortet genau das und hört dann auf.

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`

**Was hier NICHT passiert** (das ist der Zweck der Umstellung vom 31.08.2026):
kein Optimieren, kein Hebelsuchen, kein Abarbeiten von `nodes/BAUSTELLEN.md`,
keine Subagenten. Bis dahin liefen sechs Dauerloops rund um die Uhr — zu teuer
und ohne Gegenwert, solange der Bot im Spiel seine Arbeit selbst macht. Findest
du unterwegs etwas, das repariert gehört, **trägst du es ein und erwähnst es in
einem Halbsatz**, statt es anzufassen.

## 1. Messen — ein einziger Aufruf

```bash
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node tools/checkin.js
```

Das Werkzeug rechnet alles Deterministische selbst: Rang gegen die 400.000 von
Operation Daedalus, offene Black Ops, Rate, ETA, Vergleich mit dem letzten
Besuch. **Übernimm seine Zahlen, rechne nicht daneben.** Die letzte Zeile ist
das Urteil.

**Die Uhr ist die Spielzeit, nicht der Kalender.** Das Werkzeug rechnet Raten
über `totalPlaytime`, weil Erics Rechner nachts aus ist. Eine Rate aus
Kalenderzeit wäre um den Faktor der Ausschaltzeit zu niedrig und meldete
„off track", wo nur niemand gespielt hat. Es zeigt beides an — nimm für die
Frage *„wann ist es soweit"* die **Kalenderzeit**, für die Frage *„läuft es
gut"* die **Spielzeit**.

Ist die Brücke tot (`URTEIL: BLIND`), einmal `node tools/aufsicht.js` — das
startet Brücke und Wächter idempotent nach — und den Prüflauf wiederholen.

## 2. Nach dem Urteil handeln

| Urteil | Was zu tun ist |
|---|---|
| `AUF KURS` | Nichts. Drei Zeilen ausgeben, fertig. |
| `RESET BEREIT` | Abschnitt 3 — der teuerste Moment des Laufs. |
| `ZAEH` | Die ETA ist gegenüber dem letzten Besuch **gestiegen**. Nachsehen, woran (Abschnitt 4), aber nichts umbauen. |
| `STEHT` | Der Rang bewegt sich nicht. Erst `node tools/rueckstand.js` — hängt das Spiel nur der Uhr hinterher, ist nichts kaputt. Sonst Abschnitt 4. |
| `HILFE` | Der Bot hat selbst `data/hilfe.txt` geschrieben. Den Text lesen und Eric sagen, was er bedeutet. |
| `SPIEL ZU` | Kein Fehler. Eric sagen, dass der Tab zu ist — mehr nicht. |
| `BLIND` | Brücke starten (oben), dann neu messen. |

## 3. Der Reset — der einzige Schritt, der Rückfragen wert ist

**Der Bot löst ihn nicht selbst aus.** `src/bn4rep.js:891` hängt den Aufruf von
`exit.js` allein an `The Red Pill`, also am Hackingweg. In den Kampfknoten (6,
7, 10) führt der Ausgang aber über 21 Black Ops — fällt Operation Daedalus,
bleibt die Bedingung false und **niemand springt**. Auch der Notruf schweigt,
weil `rufeMenschen` innerhalb desselben Blocks steht. Solange das offen ist
(Sofort-Punkt in `nodes/BAUSTELLEN.md`, eingetragen 31.08.), **bist du die
einzige Instanz, die den Knoten abschließt.** Deshalb ist dieser Skill nicht
optional.

Wenn `RESET BEREIT` steht:

1. **Zielknoten holen** aus `nodes/AUDIT-ROADMAP-2026-08-24.md`, Abschnitt
   „2. Empfohlene Reihenfolge". Die Reihenfolge steht fest und wird von
   niemandem geändert — auch nicht von dir, auch nicht auf Zuruf.
2. **Eric das Ziel nennen und einmal bestätigen lassen.** Ein Satz genügt:
   welcher Knoten, der wievielte Lauf, warum dieser. Der Sprung ist
   unumkehrbar, und am 24.08.2026 stand der Bot zwanzig Minuten vor dem
   Ausgang mit einer Zieldatei, die auf den eigenen Knoten zeigte — der Sprung
   hätte den Knoten ein zweites Mal von vorn begonnen, ohne dass irgendetwas
   es gemeldet hätte. Diese eine Rückfrage ist billiger als dieser Fehler.
3. **Auslösen:**
   ```bash
   node tools/task.js exit.js <zielknoten>
   ```
   `src/exit.js` kennt den Black-Ops-Weg (Abschnitt „ZWEITER WEG") und ruft
   `destroyW0r1dD43m0n(ziel, "boot.js")` — Knoten abschließen, nächsten
   betreten und dort `boot.js` starten in einem Zug. Ein Klick im
   BitVerse-Bildschirm täte das **nicht**: `prestigeSourceFile` beendet jedes
   laufende Skript, der Bot stünde im neuen Knoten still.
4. **Nachsehen, ob er drüben angelaufen ist** — nicht darauf vertrauen. Rund
   eine Minute später `node tools/checkin.js`: Steht dort der neue Knoten und
   frische Telemetrie, ist der Wechsel geglückt. Kommt `SPIEL ZU` oder der
   alte Knoten, `data/exit.txt` über die Brücke lesen.
5. **Danach ist `nodes/KURS.md` ungültig.** Die Ausgangsbedingung ist je
   BitNode eine andere. Trag unter `## Sofort` in `nodes/BAUSTELLEN.md` ein,
   dass der Kurs für den neuen Knoten neu hergeleitet werden muss, und sag
   Eric in einem Halbsatz Bescheid.

**Steht der Zielknoten gleich dem aktuellen** (die Roadmap verlangt BN10
dreimal für Level 3), weist `bn4rep.js:907` das ab — der direkte Aufruf von
`exit.js` aus Schritt 3 ist davon **nicht** betroffen und funktioniert.

## 4. Wenn etwas schiefläuft — die zwei Fragen, die es meistens sind

Bevor du irgendetwas anderes vermutest:

- **Läuft der Tab im Vordergrund?** Ein verdeckter Bitburner-Tab wird vom
  Browser hart gedrosselt. Am 31.08. um 17:30 kamen so auf sieben Minuten
  Kalenderzeit **eine** Minute Spielzeit. Das Werkzeug zeigt den Anteil an
  („also X % der Zeit gespielt"); liegt er weit unter 100 %, während der
  Rechner lief, ist das die Ursache — nicht der Bot.
- **Holt das Spiel gerade nach?** `node tools/rueckstand.js`. Nach einer Pause
  arbeitet die Engine bis zu 25-fach beschleunigt auf; in dieser Phase sind
  alle Raten unbrauchbar.

Erst danach lohnt ein Blick auf `node tools/strategie-check.js` und
`node tools/plan.js`. Findest du eine echte Ursache: **eintragen, nicht
reparieren.** Änderungen an `src/` laufen unbeaufsichtigt weiter und gehören
vor dem Einbau durch einen Skeptiker-Lauf — und der ist eine eigene
Verabredung mit Eric, nicht Teil dieses Besuchs.

## 5. Ausgabe

**Höchstens 5 Stichpunkte**, keine Vorrede, keine Tabellen:

1. Wo wir stehen (Knoten, Rang absolut gegen 400.000, offene Black Ops)
2. ETA in Kalenderzeit, und ob sie seit dem letzten Besuch gestiegen oder
   gefallen ist
3. Was der Bot gerade tut
4. Nur falls vorhanden: was schiefläuft und was es heißt
5. Nur falls `RESET BEREIT`: die Rückfrage aus Abschnitt 3

Läuft alles, sind drei Zeilen genug. Ein knapper Check-in ist ein gutes
Ergebnis, kein langweiliges.

## Was dieser Skill NICHT tut

- **Loops aufsetzen.** `/bb-loops` ist seit dem 31.08.2026 abgelöst; wer sie
  wieder anwirft, zahlt rund um die Uhr für Arbeit, die der Bot selbst
  erledigt.
- **Optimieren oder umbauen.** Auch wenn ein Hebel offensichtlich aussieht:
  eintragen, weitergehen.
- **Augmentierungen von Hand kaufen**, einen zweiten Tab auf
  bitburner-official.github.io öffnen, `b1tflum3` oder den Destroy-Knopf
  anfassen. Gilt unverändert.
- **Die BitNode-Reihenfolge bewerten.** Sie steht durch Fables Analyse fest
  (`nodes/AUDIT-ROADMAP-2026-08-24.md`).

Systemzeit immer per `date`, nie schätzen.
