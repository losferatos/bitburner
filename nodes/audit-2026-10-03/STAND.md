# Audit "vollstaendig" 03.10.2026 - Stand und Wiedereinstieg

Stand 03.10.2026 18:16 (Systemzeit). PAUSIERT auf Erics Ansage ("pausiere
jetzt, ich starte dich im naechsten 5h-Fenster ueber Nacht").

## Erics Entscheidungen (03.10.2026, 18:15)

Freigegeben zum Bau, JEWEILS NUR wenn die Gegenpruefung den Ertrag
bestaetigt (hebt die Sperren aus `nodes/AUFTRAG-BAU-2026-09.md` Abschnitt 12
und `data/nicht-schieben.txt` fuer genau diese Punkte auf):

- Gang in BN2 (GANG-1/GANG-2/BN2-3; GANG-2 Red-Pill-Falle VORHER schliessen)
- Grafting-Zuender in V2 (AUG-1/AUG-2; graftplan.json)
- Infiltration-Automatik ueber die Minispiel-Modelle (NETZ-1)
- Corporation in BN3, zuerst nur Seed-Auszahlung (CORP-1/CORP-4)

Kontingentregeln: Workflows bei >80 % des 5-h-Fensters anhalten und per
Resume fortsetzen; bei 95 % Wochennutzung pausieren (Wochenreset So 04.10.
13:00). Stand beim Anhalten: 5 h 81 %, Woche 77 %.

## PRIORITAET (Eric 03.10. 18:5x): GANG ZUERST - aktueller Knoten BN2

Gegenpruefung G01 (Gang) + G02 (Hacknet-Augs) laeuft als Workflow-Run
`wf_458bac1f-b67` (3 Opus-Pruefer). Bei Abbruch fortsetzen mit
`Workflow({scriptPath: "...\\nodes\\audit-2026-10-03\\workflow-2-pruefung.js", resumeFromRunId: "wf_458bac1f-b67", args: <G01+G02 wie gestartet, ZUSAETZLICH "model": "opus">})`
- das Skript nimmt seit 03.10. sonnet als Standard; ohne "model": "opus"
aendern sich die opts und die Pruefer starten neu statt weiterzulaufen.
Danach SOFORT bauen: GANG-2 (Red-Pill-Falle) vor GANG-1 (Gang in BN2), dann
G02-Fix. Erst danach Rest von Workflow 1 und die uebrige Gegenpruefung
(Subagents jetzt sonnet, opus nur Praemisse/Skeptiker mit hohem Schaden).

### Stand 03.10. 22:45

- G02 Urteil TEILWEISE (P1 bleibt, Schaden 8,92 Mrd statt 12,46; Bauvorgabe
  hacknetNachEinbau). G01-BETRIEB TEILWEISE: Gang lohnt nur mit Kaufaufschub
  bis zum Tor + Rundenplaner; GANG-2 BESTAETIGT. G01-SUBSTANZ steht noch aus.
- Bau-Workflow `wf_41beb6c5-e41` (workflow-3-bau.js): P0 (TRP-Falle + G02),
  P1 (Kaufaufschub + waehleTorRunde), P2 (gang.js + Registry, Schalter
  data/gang-an.txt) je Sonnet-Bauer im Worktree -> Opus-Skeptiker -> 1
  Reparatur. Danach: P0 und P1 zusammenfuehren (verschiedene Stellen in
  bn4rep.js), Einzeldatei-Checkout nach master, test-alles, [skeptiker],
  einspielen, neustart, RAM. Schalter erst, wenn P0 (+P1) live sind.
- Einbau-Tor BN2.1 oeffnet ~So 07:04 - Gang muss vorher laufen.
- WF1-Rest (FLUSS, VERSION, Kritik) laeuft parallel als Resume.

## Was fertig ist

- Workflow 1 (Inventar + Matrix), Run `wf_735d79f5-a82`: 20 von 23 Pruefern
  fertig - 14 Bereiche (`inventar-*.md`), 5 BitNode-Gruppen (`bn-*.md`),
  Robustheit SCOPE (`robust-scope-catch.tsv`, Rechner
  `tools/audit/scope-alle.mjs`). ~105 Befunde. Commit faf765e.
- Gegenpruef-Skript `workflow-2-pruefung.js` und Gruppen
  `workflow-2-gruppen.json` (24 Gruppen, 32 Opus-Pruefer) liegen bereit.

## Was als Naechstes kommt (Reihenfolge)

1. Workflow 1 fortsetzen (FLUSS, VERSION, Inventar-Kritik + Nachtrag):
   `Workflow({scriptPath: "C:\\Users\\erche\\Desktop\\claude_projecto\\bitburner\\nodes\\audit-2026-10-03\\workflow-1-inventar.js", resumeFromRunId: "wf_735d79f5-a82"})`
   Fertige Agenten kommen aus dem Cache, abgebrochene laufen mit ihrem
   Transkript weiter. Befunde danach aus
   `~/.claude/projects/C--Users-erche-Desktop-claude-projecto/7f8cd9dc-3f6b-43c0-bb4b-6229155514aa/subagents/workflows/wf_735d79f5-a82/journal.jsonl`
   (Eintraege type "result", Feld `result.findings`).
2. Gruppen ergaenzen: SCOPE-4 (P2, scope-alle.mjs --gate in test-alles) als
   eigene Gruppe; SCOPE-1/2/3/5 in B2; Befunde aus FLUSS/VERSION/Kritik
   einsortieren. Dann Workflow 2 mit `args` = Inhalt von
   `workflow-2-gruppen.json` (beim letzten Stueck `"premise": true`).
   In Stuecken von ~8-12 Pruefern starten, 5-h-Fenster beobachten.
3. Audit-Datei `nodes/AUDIT-VOLLSTAENDIG-2026-10-03.md` schreiben: Inventar
   (aus inventar-*.md), Matrix, Befund-Statusliste nur mit Befunden, die die
   Gegenpruefung ueberstehen, "Bewusst nicht umgesetzt" mit Zahl.
4. Bauen in Paketen (nach dem Wochenreset So 13:00): Worktree, Test rot gegen
   alt / gruen gegen neu, Skeptiker, Commit mit [skeptiker], einspielen
   (`tools/einspielen.js --stufe N`, max. 8 Dateien), `tools/neustart.js`,
   RAM messen, `tools/test-alles.js`. In der Live-Arbeitskopie KEIN merge/
   switch/reset/stash/rebase/revert (AUFTRAG-BAU Abschnitt 12) - vorher
   nachsehen, wie die Merges 50fda84/296ef4f gemacht wurden.

## Erste Bau-Kandidaten (vorlaeufig, vor der Gegenpruefung)

- BN2-1/HASH-4: Hacknet-Augs werden im Kampfknoten LIVE gekauft (12,46 Mrd
  Mehrkosten in BN2.1) - kleiner Fix in lib/hackaugs.js.
- INFRA-1/HACK-2: Doppelbestellung blockiert den Park 600 s.
- HACK-1: share laeuft in V2 ohne Abnehmer.
- GANG-2 vor GANG-1; dann Gang BN2.
- BLADE-1/BLADE-2, SLEEVE-1/2/3.

## Zurueckgestellt bis vor den jeweiligen Knoten (nicht gegengeprueft)

BN8: BN8-1..6, BOERSE-2/3/5/6, INFRA-5, FAKT-7, SLEEVE-6. BN15: BN15-1/2,
NETZ-4/5, BOERSE-7. BN13/14: STGO-2/3/5, BN1413-2. Die IPvGO-Gruppe (G08)
gilt fuer alle V2 und wird jetzt geprueft.

## Offen ausserhalb des Audits

- ERLEDIGT 03.10. 18:43: Tab-Einfrieren war eine Endlosschleife in
  blade.js maennerNoetig (0d1bf69, ERLEDIGT.md). Bot laeuft wieder, Autosave
  frisch. Lehre fuer den Bau: jede Schleife mit harter Obergrenze, Tests mit
  Zeitlimit und Extremwerten.
