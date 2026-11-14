# Die Skills, versioniert

**Der aktive Skill liegt global, nicht im Projekt:**
`C:\Users\erche\.claude\skills\<name>\SKILL.md` (so laedt ihn Claude Code
ueberall). Dieser Ordner ist **kein** Git-Repo - ein Rechnerverlust nimmt die
Skills mit. Die Angabe "aktiver Ort ist `claude_projecto\.claude\skills\`" in
frueheren Fassungen dieser Datei stimmt seit dem 19.09.2026 nicht mehr
(Audit Lauf 2, B10, 14.11.2026).

Deshalb liegt hier eine **Sicherungskopie**. Die Richtung ist umgekehrt wie
frueher bei `loops/`:

- **Aendern: am aktiven Ort** (`~/.claude/skills/bb/SKILL.md`). Eine Kopie von
  hier nach dort ueberschriebe jede Aenderung, die seit dem Kopierdatum am
  aktiven Skill gemacht wurde - genau das war der Fehler der alten Anweisung
  ("erst hier aendern, dann kopieren"): `bb.md` stand auf dem Stand vom
  31.08.2026 ("kein Optimieren, keine Subagenten") und widersprach dem
  aktiven Skill (Arbeitsauftrag seit 22.09.2026).
- **Danach hierher spiegeln und committen:**
  `cp ~/.claude/skills/bb/SKILL.md skills/bb.md`
- **Vergleichen, ob die Kopie noch stimmt** (Zeilenenden egal):
  `diff <(tr -d '\r' < skills/bb.md) <(tr -d '\r' < ~/.claude/skills/bb/SKILL.md)`
  ohne Ausgabe = gleich.

Stand der Kopie: `bb.md` = aktiver Skill vom 14.11.2026 (Byte-gleich bis auf
Zeilenenden). Der alte Stand vom 31.08.2026 steht in der Git-Historie
(`git log -- skills/bb.md`).

- `bb.md` - der Besuch alle paar Tage (`/bb`). Loest seit dem 31.08.2026 die
  sechs Dauerloops ab; die alten Loop-Prompts liegen weiter unter `loops/`,
  werden aber nicht mehr aufgesetzt (Skill `bb-loops` ist abgeloest).

Andere Bitburner-Skills (`bitburner`, `bb-loops`, `sonntag`) liegen nur am
aktiven Ort und sind hier nicht gespiegelt; `bitburner` und `bb-loops`
beschreiben die Betriebsart vom August (siehe `nodes/audit-lauf2/5b-betrieb.md`,
B10/B14 - Kuerzen bzw. Archivieren ist ein eigener Schritt nach BN8.3).

**Offene Korrekturen am aktiven `/bb`** (stehen im Audit 5b, gehoeren in den
aktiven Skill, nicht in diese Kopie - eine Sitzung mit Auftrag fuer Skills):
der Autostart-Satz (Abschnitt 1, "Bitburner-Aufsicht.cmd" - Eric hat den
Autostart abgelehnt), der Zustand `BLOCKIERT` fehlt in der Urteilstabelle,
die plan.js-Empfehlung (Abschnitt "Optimieren"), "Schub verweigert" und der
BN8-Hinweis. Neu seit B07: `checkin.js` zeigt eine Zeile `EINBAU ...`
(faellig / steht / gesperrt, mit Sperrgrund) und in BN8 eine Zeile `BN8: ...`;
im JSON steht sie als Feld `einbau`.
