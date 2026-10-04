export const meta = {
  name: 'gang-p2d-bau',
  description: 'Gang BN2.2: Geldmodus (Terrorism bis Ruf-Ziel aus der Planrunde, dann Human Trafficking) + Ausruestung; Bau, Opus-Skeptiker, Reparatur',
  phases: [
    { title: 'Bau', detail: 'Sonnet-Bauer im Worktree p2d-geldmodus' },
    { title: 'Skeptiker', detail: 'Opus: Betrieb + Substanz' },
    { title: 'Reparatur', detail: 'Sonnet: haltbare Einwaende einarbeiten' },
  ],
}

const WT = 'C:/Users/erche/Desktop/claude_projecto/bitburner/.claude/worktrees/p2d-geldmodus'
const RULES = `
ORT: arbeite AUSSCHLIESSLICH im Worktree ${WT} (Branch p2d-geldmodus, basiert auf p2c-aufschub). Committe dort (git -C ${WT} commit), NICHT pushen, NIE etwas im Haupt-Repo C:/Users/erche/Desktop/claude_projecto/bitburner/src aendern (die Bruecke schiebt das live ins Spiel). Spielquelle nur lesen: C:/Users/erche/Desktop/claude_projecto/bitburner/reference/bitburner-src/src (nie kopieren als Junction, nie veraendern). Live-Spiel NUR LESEN (RPC getFile/getSaveFile auf http://localhost:8795/api/rpc?...&instance=LIVE), nie pushFile, nie tools/task.js/einspielen.js/neustart.js. Kein "find /". Bezeichner englisch, Kommentare deutsch ohne Umlaute, Stil wie die umgebende Datei (ausfuehrliche WARUM-Kommentare mit Fundstellen). Jede Schleife mit harter Obergrenze (Lehre 03.10.: Endlosschleife fror den Tab ein). core.autocrlf=true: Dateien haben CRLF - Edit-Werkzeug statt sed fuer mehrzeilige Ersetzungen.
GRUNDLAGE (lesen): nodes/audit-2026-10-03/verify-p2b-gang.md, verify-p2b-substanz.md, verify-p2b-praemisse.md, verify-p2b-geldwert.md; tools/audit/gang-p2b-gegen.mjs und gang-p2b-sim.mjs (geeichte Rechner); src/gang.js (Kopf!), src/bn4rep.js Block 1c (~1600-1780), src/lib/einbau.js (waehleTorRunde, gangHoldBeforeFounding), tools/test-gang.js, tools/test-bn4rep-ebene2.js.
`

const SPEC = `
BAUVORGABE P2d (aus der Gegenpruefung 04.10.2026, nur das, nichts darueber hinaus):
1. bn4rep.js Block 1c: zusaetzlich zum Plan der verdienten Stuecke einen zweiten Plan rechnen - waehleTorRunde ueber ALLE Kampfstuecke ohne Rufgrenze (dieselbe Kandidatenbildung wie der echte Plan, nur ohne den Filter rep >= repReq; The Red Pill bleibt draussen) mit Budget = REP_NEED_BUDGET_FACTOR (4) x aktuelles Geld. repNeed = 1,02 x max repReq der Stuecke DIESES Plans in der Gang-Faktion (andere Faktionen ignorieren - deren Ruf macht die Gang nicht). In die Telemetrie: torRunde.repNeed (Zahl oder null) und torRunde.repNeedFaction. Fehler -> gezaehlt wie die anderen gateErrors, repNeed null. Reine Hilfsfunktion in lib/einbau.js (z. B. gangRepNeed(plan, gangFaction, augRepReq)) mit Test.
2. gang.js: Modus je Runde, zustandslos ableitbar: rep = Faktionsruf der Gang-Faktion (liest gang.js schon, ~Zeile 645), need = repNeed aus data/bn4rep.json (gang.js liest die Datei schon fuer die Voraussetzungssperre; Frische wie dort pruefen). MONEY wenn need eine endliche Zahl > 0 ist UND rep >= need; zurueck auf RESPECT erst, wenn rep < need / 1,02 (Hysterese ueber die aktuell gesetzten Aufgaben ableiten: arbeiten Mitglieder schon auf der Geldaufgabe, gilt die untere Schwelle). Fehlt/veraltet repNeed -> RESPECT (heutiges Verhalten, sicherer Rueckfall). In MONEY bekommen die Mitglieder der Arbeitsphase statt Terrorism die Geldaufgabe "Human Trafficking" (Parameter wortgleich aus Gang/data/tasks.ts in TASKS aufnehmen); Trainingsphase, Aufstieg (1,3/2) und Wanted-Regler (Vigilante bei wanted > 1 und penalty < 0,95) UNVERAENDERT, der Regler muss mit der Geldaufgabe rechnen (wantedGain der jeweils gesetzten Arbeitsaufgabe). Telemetrie gang.json: mode, repNeed, moneyGainRate (getGangInformation().moneyGainRate).
3. Ausruestung NUR im Modus MONEY: Typen Weapon, Armor, Vehicle, Rootkit (NICHT Augmentation). Je Runde hoechstens N Kaeufe (harte Grenze), billigste zuerst, nur wenn getServerMoneyAvailable("home") - geldbedarf >= Preis, geldbedarf aus data/geldbedarf.txt auf home (fehlt/unlesbar -> NICHTS kaufen). Nach einem Aufstieg ist die Ausruestung weg (GangMember.ts) - die naechste Runde kauft neu. Fehler gezaehlt (errors.byCall), nie Abbruch. Telemetrie: equipmentBought, equipmentSpent.
4. Kopf von gang.js aktualisieren (die Begruendung "KEINE Ausruestung" ist durch verify-p2b-gang.md widerlegt; Territorium bleibt AUS mit der neuen Begruendung: 1,9^q-Preisfaktor saettigt den Rundenwert, verify-p2b-gang.md S2). Version gang-3.
5. Tests: tools/test-gang.js um Modus-Wahl (Grenzen, Hysterese, fehlendes/veraltetes repNeed, Install -> rep 0 -> RESPECT), Aufgabenwahl in MONEY, Wanted-Regler mit HT, Ausruestungskauf (Ruecklage, fehlende geldbedarf.txt, Obergrenze je Runde, nie Augmentation, nie in RESPECT); tools/test-bn4rep-ebene2.js um repNeed in der Telemetrie (Plan mit 1,25 Mio / 1,625 Mio je nach Budget, TRP nie dabei). Jeder neue Test muss gegen den Stand von p2c-aufschub ROT und gegen den neuen GRUEN sein - zeige beides (git stash ist verboten: nutze einen WIP-Commit und git checkout HEAD~1 -- <dateien> wie im Repo ueblich, danach zuruecksetzen).
6. Danach im Worktree: node tools/test-gang.js, node tools/test-bn4rep-ebene2.js, node tools/test-bn4rep-einbau.js, node tools/test-ram.js (CRLF-Falschmeldungen erklaeren, nicht wegdiskutieren) - alles gruen. Statischer RAM von gang.js vorher/nachher nennen (tools/ram*.js oder test-ram.js), erwartet +8 GB (purchaseEquipment 4, getEquipmentCost 2, getEquipmentType 2).
7. Abnahmekriterien in den Kopf von gang.js schreiben: nach dem ersten Umschalten moneyGainRate gegen tools/audit/gang-p2b-gegen.mjs auf demselben Spielstand innerhalb 5 %; penalty >= 0,95; errors 0; kein Ausruestungskauf unter die Ruecklage.
`

const BUILD_SCHEMA = { type: 'object', properties: {
  summary: { type: 'string' }, commits: { type: 'array', items: { type: 'string' } },
  tests: { type: 'string', description: 'rot gegen alt / gruen gegen neu, mit Zahlen' },
  ram: { type: 'string' }, open: { type: 'string' } }, required: ['summary', 'commits', 'tests', 'ram', 'open'] }
const VERDICT_SCHEMA = { type: 'object', properties: {
  verdict: { type: 'string', enum: ['EINSPIELEN', 'EINSPIELEN MIT FIX', 'NICHT EINSPIELEN'] },
  objections: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'] }, claim: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } },
    required: ['severity', 'claim', 'evidence', 'fix'] } } }, required: ['verdict', 'objections'] }

phase('Bau')
const build = await agent(`${RULES}\n${SPEC}\nDu bist der BAUER. Baue P2d vollstaendig nach der Vorgabe, teste rot/gruen, committe im Worktree. Gib Zusammenfassung, Commits, Testergebnisse (alt rot / neu gruen), RAM und Offenes zurueck.`,
  { label: 'bau:p2d', phase: 'Bau', schema: BUILD_SCHEMA, model: 'sonnet' })

phase('Skeptiker')
const sk = await agent(`${RULES}\n${SPEC}\nDu bist SKEPTIKER (opus). Der Bauer meldet:\n${JSON.stringify(build, null, 1)}\n\nPruefe den Diff (git -C ${WT} diff p2c-aufschub..HEAD) gegen die Vorgabe und gegen die Spielquelle. Schwachstellen FINDEN, nicht bestaetigen. Angriffswinkel: (a) Fehlermodi im Betrieb nach zwei Wochen unbeaufsichtigt: Flattern zwischen den Modi, Install (Ruf 0), Knotenwechsel BN2.2->2.3, veraltete bn4rep.json, Wanted-Spirale unter HT, Ausruestung frisst Torgeld, Aufstieg verliert Ausruestung in Schleife, RAM auf home reicht nicht, Fehler still geschluckt; (b) Substanz: stimmen die HT-Parameter wortgleich mit Gang/data/tasks.ts, Geld-/Wanted-Formeln (Gang/formulas/formulas.ts), Ausruestungstypen/-preise/Rabatt (Gang/Gang.ts getDiscount, data/upgrades.ts), repNeed-Plan (gleiche Kandidatenbildung, TRP draussen, nur Gang-Faktion), Telemetrie-Leser (tools/lib/gate-round-status.js, tools/checkin.js) unbeeintraechtigt? Fuehre die Tests selbst aus. Rechne nach, statt zu schaetzen. Schreibe nodes/audit-2026-10-03/verify-p2d-skeptiker.md IM WORKTREE.`,
  { label: 'skeptiker:p2d', phase: 'Skeptiker', schema: VERDICT_SCHEMA, model: 'opus' })

phase('Reparatur')
const fix = await agent(`${RULES}\n${SPEC}\nDu bist der REPARATEUR. Der Skeptiker urteilt:\n${JSON.stringify(sk, null, 1)}\n\nArbeite JEDEN Einwand der Schwere hoch und mittel ein (oder begruende im Commit-Text belegt, warum er nicht haelt). Niedrige nach Aufwand. Tests rot/gruen fuer jeden Fix, alle Tests aus Punkt 6 gruen, committen im Worktree. Gib Zusammenfassung, Commits, Tests, RAM, Offenes zurueck.`,
  { label: 'fix:p2d', phase: 'Reparatur', schema: BUILD_SCHEMA, model: 'sonnet' })

return { build, sk, fix }
