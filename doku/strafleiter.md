# Die Strafleiter

Stand 04.09.2026. Quelle des Verhaltens ist der Code, nicht dieses Dokument —
wo beides auseinandergeht, gilt `src/lib/leiter.js` und `src/guard.js`.

## Wozu

Ein Bot, der vierzig BitNode-Durchgänge unbeaufsichtigt schaffen soll, braucht
eine Antwort auf die Frage „was, wenn etwas hängt". Ohne sie steht er, und
niemand merkt es — das ist die Fehlerklasse, die dieses Projekt schon mehrfach
Stunden gekostet hat: am 20.08. fünf Stunden Stillstand, am 25.08. dreizehneinhalb.

Die Leiter ist die Antwort. Sie eskaliert von der billigsten wirksamen Handlung
zur teuersten, prüft nach jeder Stufe die **Wirkung** und hört auf, wenn nichts
mehr hilft.

## Die Signale

Sie stehen in `src/lib/leiter.js`, Funktion `signale`. Jedes trägt eine
Schwere; **Schwere 0 speist die Leiter nicht** — sie wird nur protokolliert.

| Signal | Was es bedeutet | Uhr | Schwere |
|---|---|---|---|
| S1 | Ein Werkzeug schreibt seine Telemetrie nicht mehr | Motor → Engine → Wand | 1 |
| S2 | Der Träger (Hacking-Level oder Bladeburner-Rang) wächst nicht mehr | Motorzeit | 2 |
| S3a | Der Kern schreibt seinen Herzschlag nicht mehr | Wächterzeit | 3 |
| S3b | Die Engine tickt nicht mehr (Puls) | Enginezeit | 3 |
| S4 | Der Tab ist verdeckt, das Spiel ist gedrosselt | — | **0** |
| S5 | Die Brücke ist weg | — | **0** |
| S6 | Fehlerserie im Kern (`errStreak ≥ 5`) | — | 3 |

**S4 und S5 haben Schwere 0, und das ist der wichtigste Eintrag der Tabelle.**
Ein verdeckter Tab liefert belegt genau einen Timer-Aufruf je Minute. Speisten
S4 und S5 die Leiter, wäre jede Nacht ein garantierter EXHAUSTED-Zustand — und
Abnahmestufe B verlangt ausdrücklich eine Nacht mit verdecktem Tab.

## Die drei Uhren

Das ist die Stelle, an der in diesem Projekt am häufigsten etwas schiefging.

- **Wanduhr** (`Date.now()`) — läuft immer, auch wenn das Spiel steht.
- **Enginezeit** (`totalPlaytime`) — läuft, solange das Spiel rechnet. Im
  gedrosselten Tab langsamer, im Nachholklumpen sprunghaft.
- **Motorzeit** — die Summe der plausiblen Rundenabstände des Kerns. Sie steht
  still, sobald der Kern hängt.

**Keine Wächterfrist läuft in Motorzeit** (außer der von Sprosse 5, siehe
unten). Der Grund ist einfach: sobald der Kern hängt, steht seine Motorzeit —
und jede in ihr gemessene Frist liefe genau in dem Fall nie ab, für den sie
gebaut wurde.

S1 fragt die Uhren in dieser Reihenfolge: Motorzeit, wenn das Werkzeug sie
wirklich führt; sonst Enginezeit aus dem Herzschlag v2; sonst Wanduhr — und
die **nur bei sichtbarem Tab**.

## Die Sprossen

| Nr | Handlung | Uhr | Deckel | Wirkung heißt |
|---|---|---|---|---|
| 0 | nichts (Befund protokollieren) | Wächter | — | Umgebung wieder in Ordnung |
| 1 | Werkzeug beenden, der Kern holt es zurück | Wächter | 6 je 6 h | Telemetrie wird wieder frisch |
| 2 | Wirt sperren (`data/blocked-hosts.json`, 60 min) | Wächter | 6 je 6 h | Werkzeug läuft woanders |
| 3 | alles auf home beenden außer Schonliste, `boot.js` starten | Wächter | 2 je 6 h | `round` wächst UND `errStreak == 0` |
| 4a | Reload von innen | Engine | 1 je 6 h | **nicht gebaut** |
| 5 | Soft-Reset durch Augmentierungs-Einbau | Motor | eigene | `lastAugReset` gesprungen, Konto > 0 |

**Sprosse 4a ist nicht gebaut und wird es nicht ohne Messung.** Der Auftrag
macht ihren Bau von einem Ebene-3-Beleg abhängig: ein skriptausgelöster Reload
darf keinen `beforeunload`-Dialog stehen lassen. Aus dem Spielquelltext ist
belegt, was sich ohne Browser belegen lässt — der `save`-Prop existiert
(`GameRoot.tsx:536-541`), und der Dialog hängt an einer schlichten Zuweisung
`window.onbeforeunload = ...` (`index.tsx:55`), ist also mit `= null` aufhebbar.
Was fehlt, ist die Messung, nicht die Kenntnis. Die Leiter **überspringt** die
Sprosse (`naechste` sucht die nächste **gebaute**), sie bleibt nicht daran hängen.

**Sprosse 5 führt der Wächter nicht selbst aus.** Das ist Arithmetik, nicht
Vorsicht: `installAugmentations` ist `SingularityFn3` und kostet bei SF4.1
achtzig Gigabyte, der Wächter hat sechs. Er schreibt einen Auftrag nach
`data/watchdog.json` unter `orders`, der Kern findet ihn (jünger als 15 Minuten,
höchstens einer je Runde, nie zweimal derselbe) und startet `src/punish.js`.
Die acht Vorbedingungen prüft `punish.js` selbst — am Zustand des Augenblicks,
in dem es läuft, nicht am Schnappschuss des Wächters.

## Der Trockenmodus — zweimal

Zwei Riegel, unabhängig voneinander:

1. **Der Wächter** liest `data/guard-modus.txt` in jeder Runde. Ohne die Datei
   gilt `observe`: er protokolliert, was er täte, und tut es nicht. `boot.js`
   setzt sie auf `enforce`. Die Handbremse ist `data/guard-observe.txt` — legt
   ein Mensch sie an, fällt der Wächter **sofort** in derselben Runde auf
   `observe` zurück, nicht erst beim nächsten Wiederanlauf. Sie steht in keiner
   Räumliste: ein gezogener Riegel bleibt über Resets gezogen.

2. **Sprosse 5** läuft trocken, solange `data/punish-scharf.txt` nicht auf home
   liegt. Der Kern hängt `scharf` nur dann an. Bis dahin landet jede Auslösung
   nur im Protokoll — das ist der Trockenlauf, den der Auftrag vor der Schärfe
   verlangt.

## Schutz vor Fehlstrafen

- **Karenz nach jedem Reset**: zehn Minuten, in denen keine Frist läuft. Der
  Kern kann in diesem Fenster gar nicht laufen; ihn dafür zu bestrafen wäre die
  häufigste Fehlstrafe überhaupt.
- **Zeitsprung-Karenz**: erkennt der Uhrenvergleich einen Nachholklumpen, ruhen
  die Fristen ebenfalls.
- **Wirkungsprüfung mit Frische UND Reihenfolge**: grün ist eine Sprosse nur,
  wenn die Telemetrie frisch ist **und** jünger als die Ausführung. Ohne den
  zweiten Teil wäre sie genau dann grün, wenn eskaliert werden müsste.
- **Deckel** je Sprosse, in der Uhr der Sprosse.
- **EXHAUSTED** nach der letzten gebauten Sprosse, zwölf Stunden lang. Danach
  gibt `freigeben()` das Ziel wieder frei.

## Wo was steht

| Was | Datei |
|---|---|
| Signale, Sprossen, Automat, Deckel | `src/lib/leiter.js` |
| Der Wächter selbst, Ausführung der Sprossen | `src/guard.js` |
| Sprosse 5 | `src/punish.js` |
| Auftragsausführung durch den Kern | `src/bn4net.js`, Abschnitt 9c |
| Uhren | `src/lib/uhren.js`, `src/lib/motorzeit.js` |
| Protokoll der Strafen | `data/penalties.json` (im Spiel) |
| Zustand der Leiter | `data/watchdog.json` (im Spiel) |
| Ereignisse ab Sprosse 3 | `data/events.json` (im Spiel) |

## Tests

| Was | Datei |
|---|---|
| Automat, Deckel, Uhren, EXHAUSTED | `tools/test-leiter.js` |
| Der Wächter gegen den ns-Mock | `tools/test-guard-ebene2.js` |
| Die acht Vorbedingungen von Sprosse 5 | `tools/test-punish.js` |
| Die Kette Wächter → Kern → punish.js | `tools/test-sprosse5-kette.js` |
| Stillstandserkennung | `tools/test-stillstandsuhr.js` |

## Was noch nicht gemessen ist

Je Sprosse ein im laufenden Spiel provozierter Hänger. Der Pflichttest aus
Auftrag 5.2 — Kern-Motorzeit eingefroren, Engine tickt weiter — lässt sich nur
dort stellen. Bis dahin ist die Leiter gegen Mock-Zustände geprüft, nicht gegen
das Spiel.
