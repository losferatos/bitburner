# Audit fuer den zweiten Lauf (ab 12.11.2026)

Auftrag (Eric, 12.11.2026): Bot, Roadmap, Verlauf, Memory - alles pruefen.
Anlass: rueckblickend Zweifel, ob besonders anfangs optimal entschieden und
alle Mechaniken ausgeschoepft wurden. BN12 wird NICHT weitergelevelt.

**Massstab ist nicht die Vergangenheit, sondern Lauf 2 (spaetestens 2027):**
Was macht ein Bot, der alles weiss, was wir heute wissen, ab dem ersten
Knoten anders - und wie viele Stunden bringt jede Aenderung?

Regeln fuer alle Teile:
- Jede Zahl mit Quelle (Datei:Zeile, Sicherung, Commit). Formeln aus dem
  Spielcode werden als Code nachgebaut und gegen einen bekannten Wert geeicht,
  bevor mit ihnen argumentiert wird.
- Jeder Teil: Pruefer, danach ein Skeptiker mit eigenem Angriffswinkel.
  Berichtet wird nur, was dem Skeptiker standhaelt.
- Befunde als Statusliste (offen / bestaetigt / verworfen / gebaut).
- Hoechstens 2-3 Agenten gleichzeitig (CPU), Subagenten sonnet, opus nur
  fuer die schwersten Urteile (Teil 3).
- Das Audit liest nur. Findet es einen Hebel, der noch in BN8.2/8.3 wirkt,
  wird er nach dem normalen /bb-Ablauf gebaut (Arbeitsauftrag).
- Wochenkontingent: bei 80 % sichern und anhalten.

Ablage: `nodes/audit-lauf2/`.

## Teil 1 - Chronik: wohin sind die Stunden gegangen?

Faktenbasis fuer alle weiteren Teile. Zwei Pruefer parallel:

- **1a Zeitleiste** (`1a-zeitleiste.md` + `chronik.json`): jeder Lauf seit
  19.08.2026 mit Beginn, Ende, Wanduhr, Online-Zeit, Einbauten, Verfahren
  (V1/V2), SF-Stand beim Eintritt, Reihenfolge Soll (Roadmap) gegen Ist.
  Quellen: `backups/INDEX.tsv` (ab 03.09.), Sicherungen, Git-Log, Verlaeufe
  in `data/`.
- **1b Zeitverluste** (`1b-verluste.md`): jeder Vorfall, der Stunden gekostet
  hat - Fehler, Stillstand, falsche Strategie, Warten auf Eric, Betrieb -
  mit Datum, Lauf, geschaetzten Stunden (mit Quelle) und Kategorie.
  Quellen: `nodes/ERLEDIGT.md`, `BAUSTELLEN.md`, Audit-Dokumente, Memory,
  Git-Log.
- **1c Skeptiker**: greift die Stundenzahlen an (Online gegen Wanduhr,
  doppelt gezaehlte Verluste, Bestand statt Rate).
- **Ergebnis** `CHRONIK.md`: Gesamtzeit, Zeit je Knoten, Verlusttopf nach
  Kategorie, die zehn teuersten Fehler.

## Teil 2 - Mechaniken: was lag brach oder kam zu spaet?

Baut auf dem Inventar vom 03.10. auf (`nodes/audit-2026-10-03/inventar-*.md`),
nicht neu. Neu ist die Zeitachse: Ab welchem Lauf war eine Mechanik
verfuegbar, ab wann hat der Bot sie genutzt, was haette die fruehere Nutzung
in Stunden gebracht? Verdaechtige: Boerse (erst BN8), IPvGO (erst BN13-15),
Corporation (nur BN3), Gang, Hacknet/Hashes, Stanek, Grafting, Infiltration,
Darknet, Coding Contracts, Intelligence. Zwei Pruefer (Geld/Ruf-Mechaniken;
Fortschritts- und SF-Wirkungen), ein Skeptiker.

## Teil 3 - Roadmap: welche Reihenfolge fuer Lauf 2?

Ein ausfuehrbares Modell der Knotenfolge, geeicht gegen die echten Laufzeiten
aus Teil 1 (es muss den Ist-Lauf nachrechnen koennen, bevor es Varianten
bewertet). Dann: SF-Wirkungen (SF4, SF9, SF10, SF5, SF13 ...) und die Befunde
aus Teil 2 als Hebel, Varianten der Reihenfolge, Empfehlung mit Spanne.
Pruefer + Skeptiker (opus).

## Teil 4 - Bot-Entscheidungen je Gewerk

Einbau-Zeitpunkt, Augmentierungswahl, Faktionen, Sleeves, Hacking-Stapel,
Rechnerkauf, Bladeburner-Aktionswahl, Boerse. Je Gewerk: Was entscheidet der
Bot heute, was waere optimal, was kostet die Luecke. Zwei Pruefer, ein
Skeptiker.

## Teil 5 - Betrieb, Werkzeuge, Memory, Skills

Was im Betrieb Zeit gekostet hat (aus 1b), was Lauf 2 beim Kaltstart braucht
(8 GB home, kein SF4 am Anfang?), welche Werkzeuge, Memory-Notizen und Skills
veraltet, doppelt oder falsch sind. Ein Pruefer, ein Skeptiker.

## Teil 6 - Synthese: Bauplan fuer Lauf 2

Priorisierte Liste nach gesparten Stunden, was wann gebaut wird, und was
bewusst nicht. Geht an Eric zur Abnahme.

## Stand

| Teil | Status | Ergebnis |
|---|---|---|
| 1 Chronik | fertig 12.11.2026 (2 Pruefer, 2 Skeptiker) | `audit-lauf2/CHRONIK.md`, Weitergabe C1-C10 |
| 2 Mechaniken | fertig 13.11.2026 (2 Pruefer, 1 Skeptiker) | `audit-lauf2/MECHANIKEN.md`; Casino fuer BN8 sofort gebaut |
| 3 Roadmap | laeuft seit 13.11.2026 (3a Modell, Skeptiker folgt) | - |
| 4 Gewerke | laeuft seit 13.11.2026 (4a, Skeptiker folgt) | - |
| 5 Betrieb | offen (braucht 1b) | - |
| 6 Synthese | offen | - |

Erics Entscheidungen 13.11.2026: Lauf 2 startet frisch (BN1.1, keine
Source-Files, 8 GB home). Casino-Roulette erlaubt. Infiltration erst messen,
das Bauverbot bleibt bis dahin.
