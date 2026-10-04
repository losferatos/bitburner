# Audit "vollstaendig" 03.10.2026 - Stand und Wiedereinstieg

**ABGESCHLOSSEN 04.10.2026 ~14:00 auf Erics Ansage** ("Verzichte auf die ganzen
Gegenpruefungen und komme zum Ende"; vorher: zu viel CPU-Last durch drei
parallele Laeufe). Ergebnis: `nodes/AUDIT-VOLLSTAENDIG-2026-10-03.md`
(erzeugt mit tools/audit/audit-doku.mjs). Reste stehen in nodes/BAUSTELLEN.md
unter "Audit vollstaendig abgeschlossen". Abgebrochene Laeufe:
wf_b3d51941-a4a (P2e + Torfrequenz), wf_eed3a15c-8f7 (Gegenpruefung, 7 Gruppen
fertig), wf_735d79f5-a82 (nur noch die Inventar-Kritik offen). Nicht fortsetzen
ohne neuen Auftrag.

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

### Stand 04.10. 00:30

- Bau fertig, alle mit Opus-Skeptiker + Reparatur: P0 (Stand-alone-Repo
  C:/Users/erche/Desktop/claude_projecto/.claude/worktrees/bb-p0-bau, 404a505..f1ef8ce),
  P1 (Klon C:/Users/erche/Desktop/claude_projecto-bb-p1, Branch audit-p1-kaufaufschub,
  f100d73), P2 (C:/Users/erche/Desktop/claude_projecto/.claude/worktrees/wf_41beb6c5-e41-3/bitburner,
  p2-gang, 08270e3).
- Zusammenfuehrung laeuft (Sonnet-Agent) in bitburner/.claude/worktrees/integ-gang,
  Branch integ-gang-2026-10-04. Danach LIVE: Einzeldatei-Checkout nach master
  (8 src-Dateien: bn4rep, hacknet, lib/hackaugs, lib/einbau, lib/blackops.json,
  blade, gang, registry.json), Commit [skeptiker], push, einspielen.js --pruefen,
  neustart bn4net (Registry!), bn4rep, hacknet, blade; RAM messen
  (eichung-messen --schreib, VERALTET_ERLAUBT leeren); bn4rep.json pruefen
  (v1Positiv false, torRunde); DANN Schalter data/gang-an.txt im Spiel anlegen.

### Stand 04.10. 01:15 - GANG LIVE

- master f79a1f7+: P0/P1/P2 integriert (ce6262d [skeptiker]), eingespielt
  (8/8 sha), Neustarts belegt, RAM gemessen, VERALTET_ERLAUBT leer,
  test-alles 66/66. Schalter data/gang-an.txt 01:01:41 gesetzt; gang.js hat
  Slum Snakes gegruendet, 3 Mitglieder, Fehler 0; Torrunde 'locked'.
- 2-h-Pruefung 04.10. 03:06: BESTANDEN - 10 Mitglieder, Strafe 0,998, Fehler 0, createGang 1x, Respekt 270.760, Faktionsruf 4.940, 12 Aufstiege, Torrunde weiter locked (kein Kauf).
- Einbau-Tor 04.10. 07:05:32 (pre-install-Backup): 12 Augs eingebaut
  (Augmented Targeting II ... LuminCloaking-V1), KEIN TRP, gang.js 07:05:36
  wieder gestartet. Abbruchkriterium "am Tor" BESTANDEN. Nach dem Einbau
  ~190 Ruf/s (07:32-07:34, Wanduhr) - Ruf ist kein Engpass mehr.
- Eric 04.10. 07:4x: Ausruestung/Territorium fehlen - "ist das korrekt?" ->
  P2b vorgezogen: Workflow `wf_bb23637e-2d1` (gang-p2b-rechnen: Geldmodus,
  Territorium, Ausruestung, Reglerwerte, geeicht an der Live-Gang; Wert des
  Geldes am Tor; 2 Opus-Skeptiker). Eric gibt das Restkontingent der Woche
  frei; was nicht fertig wird, ab 13:00 weiter.
- P2b ERGEBNIS (bab69c5): BN2.1-Ausgang kommt vor dem Tor 19:13 -> Gang-
  Umbau bringt in BN2.1 0 h. Fuer BN2.2/2.3: Geldmodus + Ausruestung
  (+0,8-1,6 h je Knoten), Territorium/Mitglieds-Augs/Reglerwerte NICHT.
  Zeitkritisch: Kaufaufschub schon VOR der Gruendung (q0 2->0, x2,35->x3,21).
  Offener Pruefauftrag (gross?): Torfrequenz - zwei halbe Runden gegen eine
  (x5,66 vs x3,21 bei 36 Mrd), inkl. Einbaukosten; S5 Ausruestung schon in
  der Respektphase (staerkster Resthebel, Konkurrenz Serverkauf pruefen).
- P2c Kaufaufschub vor der Gang: LIVE 10:17 (00c2297 [skeptiker], 2/2 sha,
  bn4rep neu pid 38287, RAM gemessen 14136c7, test-alles gruen). Greift ab
  dem Boot in BN2.2. NACHZIEHEN VOR BN2.3 (eigener Skeptiker): Frist 6 h ->
  ~10 h oder ans Tor binden UND Ruecklage im Aufschub nur ueber COMBAT_AUGS
  (Simulacrum 150 Mrd als Phantom), negatives Alter = 0, catch behaelt
  Vorrundenwert, Logtext "Gang nicht erkannt", Tests X1-X3 als H6-H8
  (Skeptiker-Bericht im Chat 04.10. ~10:15, Pruefskripte im Scratchpad).
  Pruefen in BN2.2: Log "KAUFAUFSCHUB VOR DER GANG", gangHold true bis zur
  Gruendung, 0 GEKAUFT davor.
- BN2.1 AUSGANG ~10:38, BN2.2 laeuft. 11:49: P2c greift (gangHold true,
  wartend 0, kein GEKAUFT), gang.js gang-2 wartet (no_faction).
- P2d LIVE 12:21 (a5e56c3 [skeptiker], c850b42 RAM): Bruecke schob die 4
  Dateien beim Checkout 12:15 in EINEM Schub; bn4rep pid 18388, gang.js gang-3
  pid 18456 auf run4theh111z (29,95 GB gemessen), Fehler 0, wartet no_faction.
  ABNAHME OFFEN: (1) ~2 min nach der Gruendung torRunde.repNeed/repNeedWhy in
  bn4rep.json und /bb-Zeile "Modus RESPECT (Ruf/Bedarf)"; (2) beim Umschalten
  auf MONEY (~8-9 h nach der Gruendung): moneyGainRate gegen
  tools/audit/gang-p2b-gegen.mjs innerhalb 5 % - VORHER B8 fixen ("Slum Snakes"
  fest verdrahtet, Z. 145/157/208 -> gang.facName); penalty >= 0,95, Fehler 0,
  kein Ausruestungskauf unter die Ruecklage. Notschalter: data/gang-geld-aus.txt.
  Optional offen: E6 (Befund bei absichtlichem Notschalter), E7 (Grenzen der
  exportpruefung im Kopf), B3/B5.
- 13:06 GANG BN2.2 GEGRUENDET (Slum Snakes, Karma -9 um 13:05:55). P2d-
  ABNAHME (1) BESTANDEN: torRunde locked, repNeed 1.275.000 (SPTN-97, wie
  gerechnet), gang mode respect, Fehler 0, kein GEKAUFT vor der Gruendung
  (P2c hielt 10:54-13:06), /bb-Zeile "Modus RESPECT (Ruf 0 / Bedarf 1.275.000)".
  B8 erledigt (3a8416c). Abnahme (2) beim Umschalten auf MONEY (~21-22 Uhr).
- 13:1x Laeufe: `wf_b3d51941-a4a` (P2e-Nacharbeiten im Worktree
  .claude/worktrees/p2e-nacharbeit + Pruefauftrag Torfrequenz), `wf_735d79f5-a82`
  (WF1-Rest per Resume). Danach Gegenpruefung in 3 Stuecken: (1) G03-G06,
  G09-G11; (2) G07, G08, G12, G13, G15-G17; (3) G18, G19, G21, G24, G25, G28,
  B1, B2 + Praemisse.
- (erledigt) 12:38 Gang in BN2.2 noch NICHT gegruendet (no_faction). Karma
  -4,28 um 12:17 (Slum Snakes braucht -9), Sleeves auf CLASS statt Crime.
  P2c-Frist laeuft 16:38 ab (Knotenstart ~10:38 + 6 h) - danach kauft die
  alte Schleife alles Verdiente. Ab 13:04: Karmarate messen; reicht sie nicht
  bis ~16:00, P2c-Fix 1 (Frist ans Tor / ~10 h) VORZIEHEN, mit Skeptiker, vor
  16:38 einspielen. Pruefen, wer Karma macht (sleeve.js Crime vs CLASS).
- (Bauverlauf P2d) gebaut im Worktree .claude/worktrees/p2d-geldmodus
  (Branch p2d-geldmodus, HEAD a84142c, NICHT gepusht). Skeptiker 1: EINSPIELEN
  MIT FIX, Reparatur drin (B1 /bb-Zeile, B2 importpruefung, Notschalter
  data/gang-geld-aus.txt, Kopf mit Frischknoten-Zahlen). Zweiter Skeptiker
  (Reparatur ungeprueft) laeuft 11:50. DANN: Einzeldatei-Checkout nach master,
  test-alles, [skeptiker], EIN einspielen-Schritt lib/einbau.js + bn4rep.js +
  gang.js + registry.json (vorher importpruefung bn4rep.js gang.js --
  lib/einbau.js), neustart bn4net/bn4rep/gang.js, RAM messen, VERALTET_ERLAUBT
  leeren. Frist: vor Ruf ~1,275 Mio (~8-9 h nach der Gruendung). Offen B8:
  gang-p2b-gegen.mjs hat "Slum Snakes" fest (Abnahme 5 % moneyGainRate).
- Auflage (b) erledigt: /bb meldet "Gang laeuft, aber keine Torrunde".
- Abbruchkriterien (gang.js-Kopf): +2 h >= 6 Mitglieder, Abzug >= 0,9,
  Fehler 0; bis zum Tor kein 'GEKAUFT' bei aktiver Sperre; am Tor TRP nie in
  der Warteschlange, erstes Stueck = Planstueck; nach Einbau gang.js binnen
  5 min neu. Pruefen mit node tools/audit/live-gangcheck.mjs bzw. /bb.
- Hinweis G01-Substanz fuer spaeter: Reglerwerte 400-700 / Aufstieg 1,2/1,5
  (672-Regler-Sim) gegen die gebauten 500 / 1,3/2 nachrechnen (P2b, ebenso
  Respekt- gegen Geldmodus).
- NAECHSTES (nach Wochenreset So 13:00): WF1-Rest (FLUSS, VERSION, Kritik)
  per Resume, dann restliche Gegenpruefung G03-G28/B1-B2 mit Sonnet, Audit-
  Datei, weitere Pakete (G02-Folgen N1-N3, G03 Doppelbestellung, G04 share,
  BLADE-1/2, Sleeves, Grafting-Zuender, Infiltration, BN3-Corp).

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
