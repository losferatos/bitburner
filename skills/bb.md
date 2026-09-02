---
name: bb
description: Der Besuch beim Bitburner-Bot alle paar Tage — läuft noch alles in die richtige Richtung, und hat der Bot den BitNode-Wechsel selbst geschafft? Nutzen bei /bb und wenn Eric fragt „wie steht's im Bot", „läuft der noch richtig", „sind wir noch on track", „ist er schon gesprungen". NICHT nutzen zum Aufsetzen von Dauerloops (das war /bb-loops, seit 31.08.2026 abgeschafft) und nicht für Umbauten am Bot — dafür sagt Eric ausdrücklich Bescheid.
---

# Bitburner: der Check-in

Eric spielt Bitburner, wenn er am Rechner sitzt, und schaltet es sonst aus.
Alle paar Tage kommt er mit **einer** Frage vorbei: *Läuft es, oder läuft
was schief?* Dieser Skill beantwortet genau das und hört dann auf.

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`

**Was hier NICHT passiert** (das ist der Zweck der Umstellung vom 31.08.2026):
kein Optimieren, kein Hebelsuchen, kein Abarbeiten von `nodes/BAUSTELLEN.md`,
keine Subagenten. Findest du unterwegs etwas, das repariert gehört, **trägst
du es ein und erwähnst es in einem Halbsatz**, statt es anzufassen.

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

```bash
cd /c/Users/erche/Desktop/claude_projecto/bitburner && node sync/bridge.js > "$TEMP/bridge.log" 2>&1 &
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
| `SPRUNG KLEMMT` | Ausgang offen, aber `exit.js` findet keinen Platz oder endete ohne Sprung. `data/ausgang.txt` über die Brücke lesen, die letzte Zeile sagt warum. Eintragen. |
| `GEWERK FEHLT` | Der Knoten ist fertig, der nächste braucht ein Gewerk, das nicht existiert (`hashes.js` für BN9, `boerse.js` für BN8). Eric sagen, was fehlt — das ist der einzige Fall, in dem der Bot wirklich auf einen Menschen wartet. |
| `AUSGANG FEHLT` | `data/ausgang.json` ist alt oder fehlt: `ausgang.js` läuft nicht, also springt am Ende niemand. Starten: `node tools/task.js ausgang.js`, dann erneut messen. |
| `HACKINGWEG` | V1-Knoten (BN1, 5, 12, 8): kein Rang, der Träger ist das Hacking-Level gegen w0r1d_d43m0n. Stand steht in der Kopfzeile. |
| `ANLAUF` | V2-Knoten vor dem Bladeburner-Beitritt: Kampfwerttraining trägt, `node tools/tor.js` rechnet die Phase. |
| `ZAEH` | Die ETA ist gegenüber dem letzten Besuch **gestiegen**. Nachsehen, woran (Abschnitt 3), aber nichts umbauen. |
| `STEHT` | Der Rang bewegt sich nicht. Erst `node tools/rueckstand.js` — hängt das Spiel nur der Uhr hinterher, ist nichts kaputt. Sonst Abschnitt 3. |
| `HILFE` | Der Bot hat selbst `data/hilfe.txt` geschrieben (nur noch `bbtrain.js`). Den Text lesen und Eric sagen, was er bedeutet. |
| `ACHTUNG`-Zeile im Bericht | Der Rang liegt über 400.000, aber die Black-Ops-Liste war nicht lesbar. Eine Minute später erneut messen. |
| `SPIEL ZU` | Kein Fehler. Eric sagen, dass der Tab zu ist — mehr nicht. |
| `BLIND` | Brücke starten (oben), dann neu messen. |

**Die Route ändert niemand auf Zuruf.** Sie liegt in `src/route.json`
(die Brücke schiebt `.json` ins Spiel), abgeleitet aus
`nodes/AUDIT-ROADMAP-2026-08-24.md`. Jede Änderung braucht ein grünes
`node tools/test-route.js`.

## 3. Wenn etwas schiefläuft — die zwei Fragen, die es meistens sind

Bevor du irgendetwas anderes vermutest:

- **War der Rechner aus oder der Tab verdeckt?** Ein verdeckter Tab wird
  hart gedrosselt; ein ausgeschalteter Rechner schreibt beim Laden die
  zuletzt laufende Arbeit als Klumpen auf EINEN Wert (10 h Gym gingen am
  02.09. komplett auf Agility). Beides sieht wie „langsam" aus und ist
  keins von beiden ein Bot-Fehler.
- **Holen die Sleeves nach?** Sie haben einen Zyklusdeckel und arbeiten
  nach einer Pause mit 15-facher Geschwindigkeit — im Gym 36.000 $/s je
  Sleeve. Ein Konto, das plötzlich fällt, ist meist das.

Erst danach lohnt ein Blick auf `node tools/strategie-check.js` und
`node tools/plan.js`. Findest du eine echte Ursache: **eintragen, nicht
reparieren.** Änderungen an `src/` laufen unbeaufsichtigt weiter und gehören
vor dem Einbau durch einen Skeptiker-Lauf — und der ist eine eigene
Verabredung mit Eric, nicht Teil dieses Besuchs.

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
- **Optimieren oder umbauen.** Auch wenn ein Hebel offensichtlich aussieht:
  eintragen, weitergehen.
- **Push-Nachrichten schicken.** Der ntfy-Kanal ist seit dem 31.08.2026
  dauerhaft aus (`~/.claude/notify-aus`), auf Erics ausdrückliche Ansage.
- **Augmentierungen von Hand kaufen**, einen zweiten Tab auf
  bitburner-official.github.io öffnen, `b1tflum3` oder den Destroy-Knopf
  anfassen. Gilt unverändert.
- **Die BitNode-Reihenfolge bewerten.** Sie steht durch Fables Analyse fest
  (`nodes/AUDIT-ROADMAP-2026-08-24.md`, als Datei `src/route.json`).

Systemzeit immer per `date`, nie schätzen.
