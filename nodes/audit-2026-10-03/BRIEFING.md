# Briefing Audit "vollstaendig" 03.10.2026

Gemeinsamer Kontext fuer alle Pruefer. Projektwurzel:
`C:\Users\erche\Desktop\claude_projecto\bitburner` (git, Branch master).

## Ziel

Der Bot soll in jeder Lage, jedem BitNode und jeder Phase (Kaltstart, Aufbau,
Einbauzyklus, Endspiel, Sprung) optimal entscheiden. Gesucht ist vor allem die
Fehlerklasse "Feature gibt es im Spiel, Bot nutzt es nicht oder falsch":
26.09. Hacknet-Hashes ungenutzt, 27.09. Sleeves in Hackingknoten nur Shoplift,
truppAnfrage ohne Leser, 03.10. vier Black-Op-Aufrufe in blade.js seit Wochen
tot (Funktion ausserhalb ihres Scopes, Fehler von try/catch verschluckt).

## Wo was liegt

- Bot (LIVE, NICHT AENDERN): `src/*.js`, `src/lib/*.js`, `src/route.json`,
  `src/registry.json`, `src/lib/bitnodes.json`, `src/lib/blackops.json`.
  Die Bruecke schiebt `src/` sofort ins laufende Spiel.
- Werkzeuge: `tools/` (Tests `tools/test-*.js`, Formeln `tools/lib/formeln.js`,
  Scope-Pruefer `tools/lib/scope-tot.js` + `tools/test-scope-tot.js`).
- Spielquellcode 3.0.2 (nur lesen): `reference/bitburner-src/src/`
  (NetscriptFunctions/*.ts, ScriptEditor/NetscriptDefinitions.d.ts,
  BitNode/BitNode.tsx, SourceFile/, Prestige.ts, Constants.ts, ...).
  `reference/v301/` ist die alte 3.0.1 (fuer Versionsvergleiche).
- Lage/Befunde: `nodes/BAUSTELLEN.md` (Abschnitt "ENTSCHIEDEN - nicht wieder
  aufmachen" Zeilen 8-45: nur mit NEUER Messung oder NEUER Fundstelle
  anfechten), `nodes/ERLEDIGT.md`, letztes Audit
  `nodes/AUDIT-PERFEKT-2026-09-26.md` + Berichte `nodes/audit-2026-09-26/*.md`
  (1 BitNode-Regeln, 2 Hacking, 3 Progression, 4 Bladeburner,
  5 Nebensysteme, 6 Orchestrierung) - NICHT wiederholen, darauf aufbauen.
  Route: `src/route.json`, `nodes/AUDIT-ROADMAP-2026-08-24.md`.
- Spielstaende zum Eichen: `backups/*.json.gz` (200 Dateien, Index
  `backups/INDEX.tsv`, Spalten ts/datei/.../bitNode/lauf/totalPlaytime/anlass).
  Format: gzip -> JSON; `save.data.PlayerSave` ist ein JSON-String, darin
  `.data` = Spieler (sourceFiles als JSONMap `{"ctor":"JSONMap","data":[[n,stufe]]}`,
  `bladeburner` LIEGT IM PlayerSave, sleeves, hacknetNodes, hashManager, gang,
  corporation ...). Weitere Schluessel: AllServersSave, FactionsSave,
  CompaniesSave, StockMarketSave, AllGangsSave, StaneksGiftSave, GoSave,
  DarknetSave, InfiltrationsSave. Dekoder-Beispiel: `sync/backup.js`
  Funktion `lesenKennwerte`. Laufende Telemetrie: `data/*.json`.

## NACHTRAG STAND 04.10.2026 13:15 (geht dem Abschnitt darunter vor)

- BN2.1 ist durch (Ausgang ~10:38). JETZT LAEUFT BN2.2 (Start ~10:38, V2).
  Zahlen in den Berichten vom 03.10. stammen aus BN2.1 - fuer Ertraege den
  frischen Knoten BN2.2/2.3 und die folgenden Knoten der Route rechnen.
- Seit dem 03./04.10. GEBAUT UND LIVE (nicht erneut als Befund fuehren, aber
  Wechselwirkungen pruefen): P0 TRP-Falle zu + Hacknet-Augs erst nach dem
  Einbau (GANG-2, HASH-4/BN2-1); P1 Kaufaufschub bis zum Einbau-Tor + Torrunde
  `waehleTorRunde` (AUG-4); P2 src/gang.js (GANG-1, Kampfgang, Schalter
  data/gang-an.txt); P2c Kaufaufschub schon vor der Gang-Gruendung; P2d gang-3
  Geldmodus (Human Trafficking ab torRunde.repNeed) + Ausruestung aus Geld
  ueber data/geldbedarf.txt. Gang Slum Snakes in BN2.2 seit 13:06.
  Belege: nodes/audit-2026-10-03/STAND.md, verify-g01-*.md, verify-g02-*.md,
  verify-p2b-*.md, verify-p2d-skeptiker.md (im Branch p2d-geldmodus).
- In Arbeit (nicht doppelt pruefen): P2e (Nacharbeiten P2c), Pruefauftrag
  Torfrequenz (eine Torrunde gegen mehrere kleinere Einbauten).

## Aktueller Stand (aus Spielstand 03.10.2026 09:59)

- BitNode 2, Lauf 1 (BN2.1), 5,3 h Spielzeit im Knoten, 1071 h gesamt.
- Source Files: SF1.3, SF4.3, SF5.3, SF6.1, SF9.3, SF10.3, SF12.3.
- Karma -145, 3 Sleeves, Bladeburner Rang 1734 (0 Black Ops), Geld 9,4 Mrd,
  Hacking 372, Kampfwerte ~181-194, Int 153. Faktionen: Black Hand, NiteSec,
  Aevum, Sector-12, Slum Snakes, Netburners, Tian Di Hui, CyberSec,
  Bladeburners. 1 Aug installiert, 4 in der Warteschlange.
- KEINE Gang (in BN2 ist die Gang ohne Karmaschwelle zugaenglich,
  `PersonObjects/Player/PlayerObjectGangMethods.ts:12-30`), keine
  Corporation, kein Stanek, kein IPvGO im Bot (grep: 0 Dateien mit
  ns.gang / corporation / ns.stanek / ns.go).
- Restroute (fest, ENTSCHIEDEN): BN2.1-2.3 V2, BN3.1-3.3 V2, BN11.1-11.3 V2,
  BN6.2-6.3 V2, BN7.1-7.3 V2, BN14.1-14.3 V2, BN13.1-13.3 V2,
  BN15.1-15.3 V2 (V1b-Hinweis), BN8.1-8.3 V1 (braucht boerse.js).
  V1 = Hacking-Ausgang (Red Pill + w0r1d_d43m0n), V2 = Bladeburner
  (21 Black Ops). Die Reihenfolge der Knoten anzufechten ist Sache des
  Praemissen-Skeptikers, und nur mit Zahlen.

## Arbeitsregeln fuer Pruefer

- `src/` NICHT aendern, nichts committen, keine git-Operationen ausser lesen.
- Das Spiel NICHT anfassen: kein `tools/task.js`, `tools/einspielen.js`,
  `tools/neustart.js`, keine Schreibaufrufe an die Bruecke (Port 8795/12525).
  Lesen von `data/` und `backups/` ist erlaubt.
- Eigene Dateien nur unter `nodes/audit-2026-10-03/` (Berichte) und
  `tools/audit/` (Rechner, `.mjs`). Rechner: Formel aus dem Quellcode als
  ausfuehrbaren Code, gegen einen echten Spielstandwert geeicht, Ausgabe der
  Eichung (Soll/Ist) im Bericht.
- Kein `find /`. Rechenlast auf ~4 Kerne begrenzen. Im Bash-Werkzeug keine
  Backticks im Befehl (auch nicht im Heredoc) - solche Dateien per Write.
- Bezeichner englisch, Kommentare deutsch ohne Umlaute.
- Rechenfallen (globale CLAUDE.md): sequenzielle Mutation, Additivitaet,
  aehnliche Feldnamen (exp vs mults), BitNode-Multiplikatoren, Echtzeit gegen
  Spielzeit, Offline-Nachholen, Rate gegen Bestand. Ertrag immer ABSOLUT
  gegen die beste Alternative (Rang/h, Rep/h, $/h, h bis Knotenende).
- Ein Ausschluss gilt nur, wenn das Werkzeug den Fall ueberhaupt zeigen kann.

## Kategorien der Abdeckungsmatrix

NICHT GENUTZT / GENUTZT-SUBOPTIMAL / GENUTZT-TOT (Code erreicht nie oder
wirft verschluckt) / OPTIMAL / NICHT ANWENDBAR (mit Grund, z. B. Feature erst
mit SF x).
