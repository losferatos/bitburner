export const meta = {
  name: 'bb-audit-pruefung',
  description: 'Bitburner-Audit: jeden Befund unabhaengig nachrechnen und zu widerlegen versuchen, danach Praemissen-Skeptiker',
  phases: [
    { title: 'Gegenpruefung', detail: 'je Befundgruppe ein oder zwei Opus-Widerleger (Substanz / Betrieb)' },
    { title: 'Praemisse', detail: 'ist die Route/Strategie angesichts der Funde noch optimal?' },
  ],
}

const ROOT = 'C:\\Users\\erche\\Desktop\\claude_projecto\\bitburner'
const OUT = 'nodes/audit-2026-10-03'

const COMMON = `Du bist GEGENPRUEFER im Vollstaendigkeits-Audit des Bitburner-Bots. Projektwurzel ${ROOT}.
ZUERST ${OUT}/BRIEFING.md lesen (Pfade, Spielstand, Arbeitsregeln: src/ NICHT aendern, Spiel NICHT anfassen, eigene Dateien nur unter ${OUT}/ und tools/audit/). Abschnitt "ENTSCHIEDEN" in nodes/BAUSTELLEN.md (Zeilen 8-45) beachten.
Dein Auftrag ist es, die Befunde unten zu WIDERLEGEN, nicht zu bestaetigen. Zustimmung ist wertlos. Im Zweifel lautet das Urteil TEILWEISE oder WIDERLEGT, und du sagst genau, was nicht haelt.
Die Befunde stammen aus den Berichten unten; lies dort die Herleitung und die Rechner (tools/audit/*.mjs), aber verlasse dich nicht darauf - pruefe Datei:Zeile im Bot (src/) und im Spielquellcode (reference/bitburner-src/src/) selbst.
Rechenfallen (globale CLAUDE.md): sequenzielle Mutation, Additivitaet, aehnliche Feldnamen (exp vs mults), BitNode-Multiplikatoren, Echtzeit gegen Spielzeit, Offline-Nachholen, Rate gegen Bestand. Ertrag ABSOLUT gegen die beste Alternative (Rang/h, Ruf/h, $/h, h bis Knotenende). Ein Ausschluss gilt nur, wenn dein Werkzeug den Fall zeigen koennte.
Eigene Rechner nach tools/audit/verify-<gruppe>-*.mjs, mit Eichung gegen einen echten Spielstandwert (Soll/Ist ausgeben). Bericht nach ${OUT}/verify-<gruppe>-<winkel>.md.`

const LENS = {
  SUBSTANZ: `WINKEL SUBSTANZ: Stimmen Zahlen, Formeln und Annahmen? Baue die Ertragsrechnung UNABHAENGIG nach (nicht den Rechner des Erstpruefers wiederverwenden, hoechstens zum Vergleich), eiche sie gegen einen echten Spielstandwert aus backups/*.json.gz, und vergleiche mit der besten Alternative. Ist der behauptete Ertrag real, kleiner, groesser, oder gar keiner? Welche Annahme traegt das Ergebnis, und haelt sie?`,
  BETRIEB: `WINKEL BETRIEB: Verhaelt sich der Bot wirklich so (Datei:Zeile, Live-Belege aus data/ und backups/)? Ist der Fall im Alltag erreichbar? Und: Was bricht die vorgeschlagene Loesung im unbeaufsichtigten Betrieb (Figur-Vergabe lib/figur.js, RAM, andere Skripte, Einbau/Sprung, Offline-Nachholen, gedrosselter Tab, Spielstand-Migration, ENTSCHIEDEN-Liste)? Liefere eine konkrete Bauvorgabe (Dateien, Regel, Tests rot/gruen, Abbruchkriterien).`,
  BEIDE: `WINKEL SUBSTANZ UND BETRIEB: (1) Zahlen, Formeln, Annahmen unabhaengig nachrechnen und gegen Spielstand eichen; (2) Bot-Verhalten an Datei:Zeile und Live-Belegen pruefen; (3) Fehlermodi der Loesung im unbeaufsichtigten Betrieb; (4) konkrete Bauvorgabe.`,
}

const VERDICT = {
  type: 'object',
  properties: {
    gid: { type: 'string' },
    lens: { type: 'string' },
    verdict: { type: 'string', enum: ['BESTAETIGT', 'TEILWEISE', 'WIDERLEGT'] },
    per_finding: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      verdict: { type: 'string', enum: ['BESTAETIGT', 'TEILWEISE', 'WIDERLEGT'] },
      corrected_gain: { type: 'string', description: 'eigener Ertrag absolut, mit Einheit' },
      gain_basis: { type: 'string', enum: ['GERECHNET_GEEICHT', 'GERECHNET_UNGEEICHT', 'GESCHAETZT'] },
      note: { type: 'string' } },
      required: ['id', 'verdict', 'corrected_gain', 'gain_basis', 'note'] } },
    calibration: { type: 'string', description: 'was gegen welchen Spielstandwert geeicht wurde, Soll/Ist' },
    counter_evidence: { type: 'string' },
    conditions: { type: 'string', description: 'wann der Befund gilt und wann nicht' },
    build_spec: { type: 'string', description: 'konkrete Bauvorgabe oder leer' },
    risks_unattended: { type: 'string' },
    report_path: { type: 'string' },
  },
  required: ['gid', 'lens', 'verdict', 'per_finding', 'counter_evidence', 'report_path'],
}

const TASK = (g, lens) => `${COMMON}

GRUPPE ${g.gid} (${g.prio}): ${g.title}
Befunde: ${g.ids.join(', ')}
Behauptung(en):
${g.claim}
Berichte mit Herleitung: ${g.reports.map(r => `${OUT}/${r}`).join(', ')}
${g.extra ? 'Besonders pruefen: ' + g.extra : ''}

${LENS[lens]}
Berichtsdatei: ${OUT}/verify-${g.gid.toLowerCase()}-${lens.toLowerCase()}.md`

const groups = args.groups
phase('Gegenpruefung')
const verdicts = await pipeline(
  groups,
  g => parallel(g.lenses.map(lens => () =>
    agent(TASK(g, lens), { label: `${g.gid}:${lens}`, phase: 'Gegenpruefung', schema: VERDICT, model: g.model || args.model || 'sonnet' }))),
  (vs, g) => ({ gid: g.gid, ids: g.ids, title: g.title, prio: g.prio, verdicts: (vs || []).filter(Boolean) }),
)
const done = verdicts.filter(Boolean)
log(`Gegenpruefung: ${done.length}/${groups.length} Gruppen, ${done.reduce((s, v) => s + v.verdicts.length, 0)} Urteile`)

let premise = null
if (args.premise) {
  phase('Praemisse')
  const summary = done.map(v => `${v.gid} [${v.ids.join(',')}] ${v.title}: ${v.verdicts.map(x => `${x.lens}=${x.verdict}`).join(' / ')} | ${v.verdicts.flatMap(x => x.per_finding.map(p => `${p.id}:${p.verdict} ${p.corrected_gain}`)).join(' ; ').slice(0, 900)}`).join('\n')
  premise = await agent(`${COMMON}

PRAEMISSEN-SKEPTIKER. Alle Berichte liegen in ${OUT}/ (inventar-*.md, bn-*.md, robust-*.md, verify-*.md). Gegengeprueft wurde:
${summary}

Deine Frage ist nicht, ob einzelne Befunde stimmen, sondern ob die STRATEGIE noch stimmt:
1. Ist die feste Route (src/route.json, nodes/AUDIT-ROADMAP-2026-08-24.md) angesichts der Funde noch optimal - Reihenfolge der Restknoten (BN2.1-2.3, 3, 11, 6.2-6.3, 7, 14, 13, 15, 8) und das Ausgangsverfahren je Knoten (V1/V2)? Nur mit Zahlen, ENTSCHIEDEN gilt nur ohne neue Fundstelle.
2. Optimiert der Bot lokal an der falschen Stelle? Was ist in BN2 jetzt und in BN3 als naechstes der eine groesste Hebel, und in welcher Reihenfolge sollen die Befunde gebaut werden (Abhaengigkeiten, Wechselwirkungen - z.B. Gang/Infiltration/Boerse/Graft konkurrieren um Geld, Ruf, Figur und RAM)?
3. Welche bestaetigten Befunde heben sich gegenseitig auf oder werden durch einen groesseren Hebel wertlos?
4. Was fehlt noch komplett?
Bericht nach ${OUT}/praemisse.md mit einer Bauliste (Paket, Befunde, Reihenfolge, Begruendung).`, { label: 'praemisse', phase: 'Praemisse', model: 'opus' })
}

return { verdicts: done, premise }
