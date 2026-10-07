# Prompt: Roadmap-Pruefung (fuer Opus 5.5)

Du pruefst die BitNode-Roadmap eines autonomen Bitburner-Bots. Du sollst Fehler finden, nicht bestaetigen. Zustimmung ohne Beleg ist wertlos.

## Lage

- Projekt: `C:\Users\erche\Desktop\claude_projecto\bitburner`
- Roadmap, Begruendung: `nodes/AUDIT-ROADMAP-2026-08-24.md`
- Roadmap als Datei, die der Bot wirklich faehrt: `src/route.json`
  - Sie wird von `src/ausgang.js` gelesen.
  - Jede Aenderung braucht ein gruenes `node tools/test-route.js`.
- Spielquellcode: `reference/`. Nur dort lesen, nicht kopieren und keine Junction darauf legen.
- Stand heute, 07.10.2026:
  - BN3 laeuft im dritten Durchgang, danach ist SF3.3 komplett.
  - Laut Route geht es danach nach BN11.
  - Das Corp-Werkzeug ist live (`src/corp.js`, Kinder `src/corp-*`, Bot-Seite `src/lib/corpgeld.js`). Es erzeugt in BN3 Kapital aus Investorenrunden und Aktienverkauf.
- Die Roadmap entstand am 24.08.2026, also lange bevor es ein Corp-Werkzeug gab.
  - Verdacht: Corporation wurde als Werkzeug in spaeteren Nodes nie mitgedacht.
  - Gleiches pruefen fuer alles, was seither gebaut wurde: Gang, Bladeburner, Sleeves, Grafting, Stanek, Hacknet-Hashes, Boerse.
  - Was gebaut ist, zeigen `src/` und `nodes/ERLEDIGT*.md`.

## Auftrag

1. **Annahmen der Roadmap herausziehen.** Liste jede Annahme, auf der die Reihenfolge und die Ausgangswege beruhen: Geldquellen je Node, verfuegbare Mechaniken, SF-Synergien, Zeitschaetzungen.

2. **Gegen den Quellcode eichen.**
   - Fuer jeden noch offenen Node der Route die relevanten BitNode-Multiplikatoren aus `reference/` lesen (Datei mit den BitNodeMultipliers je Node), mit Dateipfad und Zeile.
   - Mindestens diese Faktoren: CorporationValuation, CorporationSoftcap, CorporationDivisions, ScriptHackMoney, ServerMaxMoney, HacknetNodeMoney, Gang-, Bladeburner- und Augmentierungskosten-Faktoren, CompanyWorkMoney, CrimeMoney.
   - Pruefen, was eine Corp-Gruendung ausserhalb von BN3 kostet und was SF3.1 bis SF3.3 jeweils freischalten. Belegen, nicht erinnern.

3. **Rechnen, nicht ueberschlagen.**
   - Wo du eine Formel aus dem Quellcode nutzt (Corp-Bewertung, Investorenangebot, Aktienverkauf, Bestechung fuer Fraktionsruf), bau sie als ausfuehrbares Node-Skript im Scratch-Ordner nach.
   - Eiche sie gegen einen bekannten Wert aus `data/corp.json` oder `data/corp-log.txt` aus BN3.2 / BN3.3. Erst dann damit argumentieren.

4. **Je offenem Node beantworten:**
   - Lohnt die Corp dort? Schaetze die Corp-Geldmenge und den Zeitpunkt gegen die sonstige Haupt-Geldquelle des Nodes.
   - Aendert die Corp den schnellsten Ausgangsweg, etwa Augmentierungen frueher kaufen oder Fraktionsruf per Bestechung statt Arbeit?
   - Haette eine andere Reihenfolge mit Corp als Werkzeug einen messbaren Zeitvorteil? Welcher Node waere frueher sinnvoll, welcher spaeter?

5. **Fehlt etwas Grundsaetzliches?** Gibt es neben der Corp weitere seit August gebaute oder freigeschaltete Hebel, die die Roadmap ignoriert?

## Grenzen

- **Nur lesen und im Scratch-Ordner rechnen.**
  - Nichts in `src/` aendern. Die Bruecke schiebt `src/` in 400 ms ins laufende Spiel.
  - Kein Werkzeug starten, das ins Spiel greift (`tools/task.js`, `tools/hand.js`, `tools/neustart.js`, `tools/einspielen.js`).
  - Den Browser nicht anfassen.
- Kein `find /`. Suche nur im Projektordner.
- Hoechstens 2 bis 3 Subagents gleichzeitig. Jeder Subagent bekommt `reference/` nur zum Lesen am Ort.

## Ergebnis

Schreib `nodes/AUDIT-ROADMAP-PRUEFUNG-2026-10.md` mit:

- **Befundliste als Status:** je Befund belegt, plausibel oder verworfen, jeweils mit Quelle (Pfad:Zeile oder Rechenskript plus Eichwert).
- **Je offenem Node:** eine Zeile Corp lohnt ja/nein mit Zahl, sowie Hauptgeldquelle.
- **Konkreter Vorschlag fuer `src/route.json`**, falls eine Aenderung sich lohnt:
  - als Diff, nicht eingespielt,
  - mit erwartetem Zeitgewinn in Stunden Spielzeit,
  - und mit der Aussage, was passiert, wenn die Annahme falsch ist.
- **Was du ausdruecklich NICHT aendern wuerdest, und warum.**

Danach drei getrennte Skeptiker-Subagents (sonnet) auf deinen Bericht ansetzen:

- einer gegen die **Praemisse** (ist eine Routenaenderung ueberhaupt noetig?),
- einer gegen die **Zahlen und Formeln**,
- einer gegen **Fehlermodi** (was passiert im Bot, wenn die neue Route laeuft).

Nur die Einwaende einarbeiten, die standhalten. Am Ende in hoechstens 5 Stichpunkten zusammenfassen.
