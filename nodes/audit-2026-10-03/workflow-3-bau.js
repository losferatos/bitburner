export const meta = {
  name: 'bb-audit-bau',
  description: 'Bitburner-Audit: Pakete im Worktree bauen (sonnet), Skeptiker (opus), eine Reparaturrunde',
  phases: [
    { title: 'Bau', detail: 'je Paket ein Bauer im eigenen Worktree' },
    { title: 'Skeptiker', detail: 'je Paket ein Opus-Skeptiker, Schwachstellen finden' },
    { title: 'Reparatur', detail: 'Auflagen/Blocker im selben Worktree beheben' },
  ],
}

const ROOT = 'C:\\Users\\erche\\Desktop\\claude_projecto\\bitburner'
const OUT = 'nodes/audit-2026-10-03'

const BAU_COMMON = `Du BAUST ein Paket fuer den Bitburner-Bot. Du arbeitest in einem eigenen git-Worktree (dein aktuelles Arbeitsverzeichnis) - NICHT in der Live-Kopie ${ROOT}, deren src/ die Bruecke sofort ins laufende Spiel schiebt. Pruefe zuerst mit "git rev-parse --show-toplevel", dass du im Worktree bist.
Lies ${ROOT}\\${OUT}\\BRIEFING.md (Kontext, Spielstand, Regeln) und die unten genannten Berichte (absolute Pfade unter ${ROOT}\\${OUT}\\).
Regeln: Bezeichner englisch, Kommentare deutsch ohne Umlaute, im Stil der umliegenden Datei (ausfuehrliche Begruendungen mit Fundstellen). Jede Schleife hat eine harte Obergrenze (am 03.10. fror eine unbegrenzte while-Schleife den Spiel-Tab ein). Keine stillen catch-Bloecke fuer neue Logik: Fehler zaehlen und in die Telemetrie schreiben. Keine neuen ns-Funktionen ohne RAM-Pruefung (tools/ram.js).
Tests: neue/angepasste Tests unter tools/, jeder neue Test ROT gegen den alten Stand (Pfad zur alten Datei: ${ROOT}\\src\\... bzw. per Option) und GRUEN gegen den neuen; in tools/test-alles.js eintragen. Fuer tools/test-syntax.js und tools/test-scope-tot.js braucht der Worktree reference/v301/node_modules/acorn: per "mkdir -p reference/v301/node_modules && cp -r ${ROOT.replace(/\\/g, '/')}/reference/v301/node_modules/acorn reference/v301/node_modules/" KOPIEREN (nie verlinken, nie committen). Danach node tools/test-alles.js laufen lassen und das Ergebnis melden (bekannte Ausnahme: test-ram kann im Klon wegen CRLF rot sein - dann Einzelergebnis nennen).
Am Ende: alles im Worktree committen (Commit-Text: warum, was gemessen; KEIN [skeptiker] - der Skeptiker kommt danach), NICHT pushen, NICHT mergen, nichts in ${ROOT} aendern. Melde Worktree-Pfad, Branch, Commit, geaenderte Dateien und Testergebnisse.`

const RESULT = {
  type: 'object',
  properties: {
    worktree: { type: 'string' }, branch: { type: 'string' }, commit: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    tests: { type: 'string', description: 'Testergebnisse rot/gruen je Test' },
    notes: { type: 'string', description: 'Abweichungen von der Vorgabe, offene Punkte, RAM' },
  },
  required: ['worktree', 'branch', 'commit', 'files', 'tests', 'notes'],
}

const SKEP = {
  type: 'object',
  properties: {
    urteil: { type: 'string', enum: ['FREIGABE', 'AUFLAGE', 'BLOCKER'] },
    befunde: { type: 'array', items: { type: 'object', properties: {
      schwere: { type: 'string', enum: ['BLOCKER', 'AUFLAGE', 'HINWEIS'] },
      ort: { type: 'string' }, problem: { type: 'string' }, abhilfe: { type: 'string' } },
      required: ['schwere', 'ort', 'problem', 'abhilfe'] } },
    zusammenfassung: { type: 'string' },
  },
  required: ['urteil', 'befunde', 'zusammenfassung'],
}

const skepPrompt = (p, b) => `Du bist SKEPTIKER fuer eine Aenderung am Bitburner-Bot, die danach UNBEAUFSICHTIGT im Spiel laeuft. Finde Schwachstellen, bestaetige nicht - Zustimmung ist wertlos.
Worktree: ${b.worktree} (Branch ${b.branch}, Commit ${b.commit}); Diff gegen master: "git -C ${b.worktree} diff master...HEAD". Live-Code zum Vergleich: ${ROOT}\\src (nur lesen). Spielquellcode: ${ROOT}\\reference\\bitburner-src\\src. Kontext: ${ROOT}\\${OUT}\\BRIEFING.md und die Berichte ${p.reports.map(r => `${ROOT}\\${OUT}\\${r}`).join(', ')}.
Paket ${p.key}: ${p.title}
Vorgabe an den Bauer (Kurzfassung): ${p.summary}
Bauer meldet: Dateien ${b.files.join(', ')}; Tests: ${b.tests}; Hinweise: ${b.notes}
Pruefe mit drei getrennten Winkeln: (1) PRAEMISSE - loest es das Problem, oder nur ein Symptom? (2) FEHLERMODI IM ALLTAG - was bricht nach zwei Wochen: Einbau, Knotenwechsel/Sprung, Offline-Nachholen (Bonuszeit 25x bei Gang, 5x Bladeburner), gedrosselter Tab, Neustart mitten im Ablauf, Figur-Vergabe (lib/figur.js), RAM, andere Dienste, unbegrenzte Schleifen, verschluckte Fehler, Telemetrie ohne Leser? (3) SUBSTANZ - stimmen Formeln/Schwellen gegen den Spielquellcode (Datei:Zeile)? Fuehre die Tests selbst aus und baue bei Bedarf eine eigene Gegenprobe. Du darfst im Worktree NICHTS committen (nur lesen/ausfuehren; eigene Pruefskripte nach ${ROOT}\\tools\\audit\\skep-*.mjs).
Urteil FREIGABE / AUFLAGE (was genau zu tun ist) / BLOCKER.`

const fixPrompt = (p, b, s) => `Du REPARIERST ein Paket fuer den Bitburner-Bot nach dem Skeptiker-Urteil. Arbeite im bestehenden Worktree ${b.worktree} (Branch ${b.branch}) - cd dorthin, pruefe mit git rev-parse --show-toplevel. Nichts in ${ROOT} aendern, nicht pushen, nicht mergen.
Paket ${p.key}: ${p.title}
Skeptiker-Urteil ${s.urteil}: ${s.zusammenfassung}
Befunde:
${s.befunde.filter(x => x.schwere !== 'HINWEIS').map((x, i) => `${i + 1}. [${x.schwere}] ${x.ort}: ${x.problem} -> ${x.abhilfe}`).join('\n')}
Hinweise (nach Ermessen): ${s.befunde.filter(x => x.schwere === 'HINWEIS').map(x => x.ort + ': ' + x.problem).join(' | ').slice(0, 1500)}
Behebe alle BLOCKER und AUFLAGEN, Tests ergaenzen (rot gegen den Stand vor der Reparatur, gruen danach), node tools/test-alles.js laufen lassen, committen (Text: welche Befunde wie behoben). Regeln wie beim Bau: harte Schleifengrenzen, keine stillen catch, Kommentare deutsch ohne Umlaute.`

phase('Bau')
const out = await pipeline(
  args.pakete,
  (p) => agent(`${BAU_COMMON}\n\nPAKET ${p.key}: ${p.title}\nBerichte: ${p.reports.join(', ')}\n\nVORGABE:\n${p.prompt}`,
    { label: `bau:${p.key}`, phase: 'Bau', schema: RESULT, model: 'sonnet', isolation: 'worktree' }),
  (b, p) => b && agent(skepPrompt(p, b), { label: `skeptiker:${p.key}`, phase: 'Skeptiker', schema: SKEP, model: 'opus' })
    .then(s => ({ b, s })),
  (r, p) => {
    if (!r || !r.s || r.s.urteil === 'FREIGABE') return { paket: p.key, bau: r && r.b, skeptiker: r && r.s, reparatur: null }
    return agent(fixPrompt(p, r.b, r.s), { label: `fix:${p.key}`, phase: 'Reparatur', schema: RESULT, model: 'sonnet' })
      .then(f => ({ paket: p.key, bau: r.b, skeptiker: r.s, reparatur: f }))
  },
)
return out.filter(Boolean)
