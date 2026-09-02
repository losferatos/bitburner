# Audit-Briefing: Bitburner-Bot, Praemisse VOLLE AUTONOMIE

Stand: 02.09.2026, 16:55 Uhr. Auftraggeber: Eric. Sein Wortlaut:
"Ich will wirklich einmal alles auditen mit der Praemisse, dass der Bot
letztendlich ohne deinen und meinen Eingriff ALLES autonom macht, was geht."

Du bist ein SKEPTIKER. Zustimmung ist wertlos. Finde, was bricht, was fehlt,
was falsch gerechnet ist. Wenn du in deinem Winkel nichts Belastbares findest,
sag das in drei Zeilen - erfinde nichts.

## Das Projekt

Arbeitsverzeichnis: `C:\Users\erche\Desktop\claude_projecto\bitburner`
(unter Git Bash: `/c/Users/erche/Desktop/claude_projecto/bitburner`).

Ein autonomer Bot fuer Bitburner v3.0.1 (Webversion). Ziel: alle 15 BitNodes
auf Source-File-Level 3 = 45 Laeufe. Die Reihenfolge steht fest in
`nodes/AUDIT-ROADMAP-2026-08-24.md`, Abschnitt "2. Empfohlene Reihenfolge"
(BN5 L1 fertig, BN6 L1 fertig, jetzt BN10 L2 von 3, dann BN4 L2+L3, BN9 x3,
BN1 L2+L3, BN5 L2+L3, BN12 x3, BN2 x3, BN3 x3, BN11 x3, BN6 L2+L3, BN7 x3,
BN14 x3, BN13 x3, BN15 x3, BN8 x3 ganz am Ende). Die Reihenfolge selbst ist
NICHT Gegenstand des Audits - wohl aber, ob der Bot die kommenden Knoten
ueberlebt.

Skripte im Spiel: `src/*.js` (26.766 Zeilen). Die wichtigsten:
- `src/boot.js` - Rueckruf nach dem Knotenwechsel, startet bn4net.js
- `src/bn4net.js` (3.041 Z.) - Netz, Geld, Rechnerkauf, Werkzeugliste
  (`WERKZEUGE` ab Z. 241), Kaltstart-Leiter (Z. 620-651), Ausbau-Deckel
  (Z. 750-775), Fernbefehle `data/task.txt` (Start) und `data/reload.txt` (KILL)
- `src/bn4life.js` - Faktionen, Arbeit, Verbrechen mit der Spielerfigur
- `src/bn4rep.js` (1.972 Z.) - Augmentierungen kaufen/einbauen, Ausgang:
  Z. 88 `EXIT_KEY = "The Red Pill"`, Z. 871/891 einzige Ausgangs-Bedingung,
  Z. 907 Selbstsprung-Guard, Z. 1202 `installAugmentations("boot.js")`
- `src/exit.js` - ruft `destroyW0r1dD43m0n(ziel, "boot.js")`, kennt den
  Black-Ops-Weg ("ZWEITER WEG")
- `src/blade.js` (3.465 Z.) - Bladeburner-Motor (Rang, Black Ops, Aktionen)
- `src/bbtrain.js` - Kampfwerte auf 100 (Beitrittstor), Gym-Schwelle
  `GYM_MIN_GELD = 5e6` (Z. 236)
- `src/sleeve.js` - Sleeves (Gym/Kontrakte/Verbrechen), KEINE Geldpruefung
- `src/homegrow.js` - home-RAM-Ausbau; `src/darkweb.js` - Portknacker;
  `src/contracts.js` - Coding Contracts; `src/bn4door.js` - Backdoors
- `src/kampfaugs.js`, `src/graft.js`, `src/buyaugs.js`, `src/join.js`,
  `src/travel.js`, `src/stocks.js`, `src/invest.js` - Nebenwerkzeuge
- Werkzeuge ausserhalb des Spiels: `tools/checkin.js` (Check-in),
  `tools/save.js` (liest den Spielstand aus IndexedDB ohne Spiel-API),
  `tools/task.js <skript> [args]` (startet ein Skript im Spiel),
  `tools/rueckstand.js`, `tools/tor.js`, `tools/plan.js`, `tools/strategie-check.js`
- Bruecke: `sync/bridge.js` auf Port 8795 (loopback), schiebt `src/` ins
  Spiel (fs.watch!) und proxied NUR `getFile`/`pushFile`, keine ns-Aufrufe.

Spiel-Quellcode zum Gegenpruefen: `reference/v301/src/` (v3.0.1). Wichtige
Stellen: `BitNode/BitNode.tsx` (Multiplikatoren je Knoten, BN10 ab Z. 844),
`Server/ServerPurchases.ts` (Rechnerpreise), `PersonObjects/formulas/skill.ts`
(Levelformel), `Bladeburner/data/BlackOperations.ts` (Daedalus Z. 708,
Rang 400.000), `NetscriptFunctions/Singularity.ts` (destroyW0r1dD43m0n),
`Prestige.ts` (was ein Reset loescht), `RamCostGenerator.ts` (SF4-Rabatt nur
in BN4 - ausserhalb kostet jeder Singularity-Aufruf das 16-fache).
Vorsicht: `reference/` ist gross - immer mit `timeout 60` und gezielten
Pfaden suchen, nie `grep -r` ueber den ganzen Ordner.

Dokumentation: `nodes/BAUSTELLEN.md` (offene Befunde, `## Sofort` obenauf),
`nodes/ERLEDIGT.md` (Chronik, sehr lang), `nodes/AUDIT-BOT-2026-08-24.md`
(letzter Bot-Audit - was dort steht und erledigt ist, nicht wiederholen),
`nodes/KURS.md` (veraltet, gilt fuer Lauf 1), `nodes/HEBEL.md`.

## Live-Zustand lesen (NUR LESEN)

Das Spiel laeuft gerade (BN10, Lauf 2, Kampftraining vor dem
Bladeburner-Beitritt). Dateien im Spiel liest du so:

    curl -s -m 8 -G "http://localhost:8795/api/rpc" --data-urlencode "method=getFile" --data-urlencode "filename=data/bn4net.json" --data-urlencode "server=home"

Nuetzlich: `data/bn4net.json`, `data/bn4net-log.txt`, `data/bn4life.json`,
`data/bblage.json`, `data/sleeve.json` (liegt auf `werk-10`/`werk-0`),
`data/boot.txt`, `data/exit.txt`. Achtung: Skripte schreiben auf dem Wirt,
auf dem sie laufen - `server=werk-10` probieren, wenn `home` leer ist.
Spielstand ohne Spiel-API: `node tools/save.js`.

## Was heute schon gefunden wurde (nicht wiederholen, aber weiterdenken)

1. `bn4rep.js:891` erkennt den Black-Ops-Ausgang nicht (nur Red Pill).
   In BN6/7/10 springt niemand; der Notruf `rufeMenschen` steht im selben
   toten Block. Am 01.09. musste ein Mensch den fertigen Knoten abschliessen.
2. Kaltstart in BN10: der erste Mietrechner kostet das Fuenffache
   (`CloudServerCost: 5`), die Leiter verlangte 11 Mio - der Bot stand 13,5 h
   bei 8/70 Rechnern, bis ein Mensch fuer 8,8 Mio kaufte.
3. `sleeve.js` schickt Sleeves ohne Geldpruefung ins Gym - Konto in 5 min auf
   -18,5 Mio (das Spiel laesst Gym-Kosten ins Minus laufen). Notstopp von Hand.
4. Tagsueber kam nur 1/19 der Gym-Rate an, obwohl das Spiel mit Tempo 1,0
   lief - die Figur war nicht im Gym, Ursache unbekannt (bn4life gegen
   bbtrain um die Figur?). bn4life "lag still und wurde neu gestartet".
5. `tools/checkin.js` meldet einen 13-h-Stillstand als `ANLAUF`, nicht `STEHT`.
6. `bn4rep.js` (848 GB) findet ausserhalb BN4 lange keinen Platz.
7. Der Bot verlangt an mehreren Stellen einen Menschen (Zielknoten
   bestaetigen, `data/hilfe.txt`, Stub-Eingriffe). Unter der neuen Praemisse
   sind das Fehler, keine Sicherheitsmerkmale - ausser dort, wo ein Fehler
   unumkehrbar Stunden kostet. Dann ist die Frage: kann der Bot die
   Entscheidung selbst pruefen?

## Verbote

- NICHTS aendern: keine Datei im Repo, nichts ins Spiel schieben (kein
  `pushFile`, kein `tools/task.js`, kein `data/reload.txt`), kein git.
- Keine Push-Nachrichten, keine Loops, keine weiteren Subagenten.
- Keinen zweiten Browser-Tab auf bitburner-official.github.io oeffnen.
- Zahlen nicht aus dem Kopf: Formeln aus `reference/v301` als Python/Node
  nachrechnen und gegen einen bekannten Wert eichen, bevor du damit
  argumentierst. Am 30.08. waren vier von vier Kopfrechnungen falsch.

## Ausgabe

Schreib deinen Bericht als Markdown in die Datei, die dein Auftrag nennt.
Format je Befund:

    ### <Kurztitel>
    Schwere: KRITISCH | HOCH | MITTEL | NIEDRIG
    Beleg: <Datei:Zeile, Messwert, Formel - nachpruefbar>
    Was passiert: <konkretes Szenario: Zustand -> falsches Verhalten -> Kosten in Stunden/Laeufen>
    Was der Bot stattdessen tun muesste: <Vorschlag, auch wenn er gross ist>

Hoechstens 12 Befunde, KRITISCH zuerst. Danach ein Abschnitt "Was ich
geprueft und fuer tragfaehig befunden habe" (kurz) und "Was ich nicht
pruefen konnte". Kommentare im Code sind Deutsch ohne Umlaute; dein Bericht
darf Umlaute verwenden. Kein Vorwort, keine Wiederholung dieses Briefings.
