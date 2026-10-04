// Erzeugt nodes/AUDIT-VOLLSTAENDIG-2026-10-03.md aus dem Journal von Workflow 1
// (strukturierte Befunde) plus dem Bau- und Pruefstand. Einmalwerkzeug zum
// Abschluss des Audits (Eric 04.10.2026: "Verzichte auf die ganzen
// Gegenpruefungen und komme zum Ende").
// Aufruf: node tools/audit/audit-doku.mjs <journal.jsonl>
import fs from "node:fs";
import path from "node:path";

const journal = process.argv[2];
if (!journal) { console.error("Aufruf: node tools/audit/audit-doku.mjs <journal.jsonl>"); process.exit(1); }
const results = fs.readFileSync(journal, "utf8").split("\n").filter(Boolean)
  .map((l) => JSON.parse(l)).filter((e) => e.type === "result" && e.result);

// Stand je Befund. Gebaut = live mit Skeptiker; gegengeprueft = Urteil der Gegenpruefung.
const STATUS = {
  "GANG-1": "GEBAUT P2/P2d (gang.js gang-3, live)",
  "GANG-2": "GEBAUT P0 (TRP nur mit V1-Nachweis)",
  "BN2-3": "GEBAUT P2 (Teil von G01)",
  "HASH-4": "GEBAUT P0 (hacknetNachEinbau)",
  "BN2-1": "GEBAUT P0 (hacknetNachEinbau)",
  "BN311-2": "GEBAUT P0 (gleiche Regel, alle Knoten)",
  "AUG-4": "GEBAUT P1/P2c (Kaufaufschub + Torrunde)",
};
const VERDICT = {
  "GANG-1": "G01 TEILWEISE (lohnt nur mit Kaufplaner)",
  "GANG-2": "G01 BESTAETIGT",
  "BN2-3": "G01 TEILWEISE",
  "HASH-4": "G02 TEILWEISE (8,92 statt 12,46 Mrd)",
  "BN2-1": "G02 TEILWEISE",
  "BN311-2": "G02 TEILWEISE",
};
// Urteile der (abgebrochenen) Gegenpruefung aus weiteren Journalen (2. Argument ff.).
for (const j of process.argv.slice(3)) {
  for (const e of fs.readFileSync(j, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))) {
    if (e.type !== "result" || !e.result || !Array.isArray(e.result.per_finding)) continue;
    for (const p of e.result.per_finding) {
      VERDICT[p.id] = e.result.gid + " " + p.verdict + ": " + String(p.corrected_gain ?? "").replace(/\s+/g, " ").slice(0, 110);
    }
  }
}
// Nur in BN8/13/14/15 wirksam -> bis vor den Knoten zurueckgestellt (STAND.md).
const DEFERRED = new Set(["BN8-1", "BN8-2", "BN8-3", "BN8-4", "BN8-5", "BN8-6", "BOERSE-2", "BOERSE-3",
  "BOERSE-5", "BOERSE-6", "INFRA-5", "FAKT-7", "SLEEVE-6", "BN15-1", "BN15-2", "NETZ-4", "NETZ-5",
  "BOERSE-7", "STGO-2", "STGO-3", "STGO-5", "BN1413-2"]);

const cut = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").replace(/\|/g, "/").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const firstRef = (s) => cut(String(s ?? "").split(/[,;]\s*(?=src\/|tools\/|reference\/)/)[0], 60);

const areas = [];
const findings = [];
for (const e of results) {
  const r = e.result;
  const name = path.basename(String(r.report_path || "?"));
  areas.push({ name, inv: r.inventory_count, cov: r.coverage_counts || {}, n: (r.findings || []).length });
  for (const f of r.findings || []) findings.push({ ...f, src: name });
}
const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 };
findings.sort((a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9) || String(a.id).localeCompare(String(b.id)));

const statusOf = (f) => STATUS[f.id] || (DEFERRED.has(f.id) ? "ZURUECKGESTELLT bis vor den Knoten" : (VERDICT[f.id] ? "OFFEN, gegengeprueft" : "OFFEN, nicht gegengeprueft"));

let md = "";
md += "# Audit \"vollstaendig\" 03./04.10.2026 - Abschluss\n\n";
md += "Erzeugt mit `node tools/audit/audit-doku.mjs` aus dem Journal von Workflow 1\n";
md += "(Lauf `wf_735d79f5-a82`). Abgeschlossen auf Erics Ansage vom 04.10.2026: die\n";
md += "uebrige Gegenpruefung entfaellt. Alles ausser den Zeilen mit GEBAUT bzw.\n";
md += "einem Urteil ist ein ungepruefter Erstbefund (Ertrag laut Erstpruefer).\n\n";

md += "## 1. Was gebaut und live ist\n\n";
md += "| Paket | Inhalt | Commit | Beleg live |\n|---|---|---|---|\n";
md += "| P0 | TRP-Falle zu (Kauf nur mit positivem V1-Nachweis), Hacknet-Augs erst nach dem Einbau | ce6262d [skeptiker] | BN2.1-Tor 07:05: 12 Augs, kein TRP |\n";
md += "| P1 | Kaufaufschub bis zum Einbau-Tor, geplante Torrunde (waehleTorRunde) | ce6262d [skeptiker] | Torrunde locked bis zum Tor, 0 Kaeufe davor |\n";
md += "| P2 | gang.js (Kampfgang, Schalter data/gang-an.txt) | ce6262d [skeptiker] | BN2.1: 2-h-Pruefung bestanden (10 Mitglieder, Strafe 0,998) |\n";
md += "| P2c | Kaufaufschub schon vor der Gang-Gruendung | 00c2297 [skeptiker] | BN2.2: hielt 10:54-13:06, 0 Kaeufe |\n";
md += "| P2d | gang-3: Geldmodus (Human Trafficking ab Rufbedarf der Torrunde) + Ausruestung aus Geld ueber der Ruecklage | a5e56c3 [skeptiker] | BN2.2: repNeed 1.275.000 wie gerechnet, Modus respect, Fehler 0 |\n";
md += "| Nebenbei | Endlosschleife maennerNoetig in blade.js (Tab fror ein) | 0d1bf69 | Tab stabil seit 03.10. 18:43 |\n\n";

md += "## 2. Inventar und Abdeckungsmatrix (Zaehlung je Bereich)\n\n";
md += "Details je Bereich in `nodes/audit-2026-10-03/<Bericht>` (Feature | Fundstelle | BN | Hebel).\n\n";
md += "| Bericht | Features | optimal | suboptimal | tot | nicht genutzt | n. a. | Befunde |\n|---|---|---|---|---|---|---|---|\n";
let tot = { inv: 0, o: 0, s: 0, t: 0, g: 0, a: 0, n: 0 };
for (const a of areas.sort((x, y) => x.name.localeCompare(y.name))) {
  const c = a.cov;
  md += `| ${a.name} | ${a.inv} | ${c.optimal ?? 0} | ${c.suboptimal ?? 0} | ${c.tot ?? 0} | ${c.nicht_genutzt ?? 0} | ${c.nicht_anwendbar ?? 0} | ${a.n} |\n`;
  tot.inv += a.inv || 0; tot.o += c.optimal || 0; tot.s += c.suboptimal || 0; tot.t += c.tot || 0;
  tot.g += c.nicht_genutzt || 0; tot.a += c.nicht_anwendbar || 0; tot.n += a.n;
}
md += `| **Summe** | ${tot.inv} | ${tot.o} | ${tot.s} | ${tot.t} | ${tot.g} | ${tot.a} | ${tot.n} |\n\n`;
md += "Nicht gelaufen: die Inventar-Kritik (Vollstaendigkeitspruefer) von Workflow 1.\n\n";

md += "## 3. Befund-Statusliste\n\n";
md += "| ID | Befund | Beleg (Bot) | Ertrag (Erstpruefer) | Basis | BN | Aufwand | Prio | Stand |\n|---|---|---|---|---|---|---|---|---|\n";
for (const f of findings) {
  const st = statusOf(f) + (VERDICT[f.id] ? "; " + VERDICT[f.id] : "");
  md += `| ${f.id} | ${cut(f.title, 110)} | ${firstRef(f.bot_ref)} | ${cut(f.gain, 90)} | ${cut(f.gain_basis, 12)} | ${cut(f.affected_bns, 30)} | ${cut(f.effort, 10)} | ${f.priority ?? ""} | ${st} |\n`;
}
const nOpen = findings.filter((f) => statusOf(f).startsWith("OFFEN")).length;
const nDef = findings.filter((f) => DEFERRED.has(f.id)).length;
const nBuilt = findings.filter((f) => STATUS[f.id]).length;
md += `\n${findings.length} Befunde: ${nBuilt} gebaut, ${nDef} zurueckgestellt, ${nOpen} offen und nicht gegengeprueft.\n\n`;

md += "## 4. Bewusst nicht umgesetzt (mit Zahl)\n\n";
md += "| Was | Warum nicht | Zahl | Beleg |\n|---|---|---|---|\n";
md += "| Gang-Territorium (Warfare) | 1,9^q-Preisfaktor saettigt den Rundenwert; mehr Geld bringt am Tor kaum mehr Competence | S2 auf S3-Basis 1.690 Mrd Gang-Geld, aber G noetig nur 1,08 -> 0,92; Ziel Territorium 1,0 bis Tor: Verlustgeschaeft (67 Mrd) | verify-p2b-gang.md |\n";
md += "| Gang-Mitglieds-Augs | lohnt nicht gegen ihren Preis | +0,14 ln Competence fuer 306 Mrd | verify-p2b-gang.md S3g |\n";
md += "| Andere Gang-Reglerwerte (Training 300-700, Aufstieg 1,5) | Wirkung unter 2 % Competence | trainUntil < 0,3 % Geld; ascWork 1,5: x8,41 -> x8,59 | verify-p2b-gang.md S4 |\n";
md += "| Gang-Umbau noch in BN2.1 | Ausgang kam vor dem naechsten Tor | 0 h | verify-p2b-praemisse.md Abschnitt 1 |\n";
md += "| Ausruestung schon in der Respektphase (S5) | konkurriert frueh mit dem Serverkauf, nicht gerechnet | R ~2,6 h frueher, +0,10-0,15 ln (ungeprueft gegen Serverkonkurrenz) | verify-p2b-substanz.md |\n";
md += "| Uebrige Gegenpruefung (G03-G28, B1, B2) | Eric 04.10.: verzichtet (Kontingent, CPU) | 28 Pruefer nicht gelaufen | STAND.md |\n\n";

md += "## 5. Offen nach dem Abschluss\n\n";
md += "- P2c-Nacharbeiten vor BN2.3 (Frist an das Tor binden statt 6 h, Ruecklage nur ueber COMBAT_AUGS, Fehlerfaelle, Logtext, Tests H6-H10): Bau im Worktree `.claude/worktrees/p2e-nacharbeit` abgebrochen, nicht eingespielt, ohne Skeptiker. Risiko heute: nur wenn die Gang-Gruendung in BN2.3 laenger als 6 h dauert.\n";
md += "- P2d-Abnahme (2) beim ersten Umschalten auf Geld (~8-9 h nach der Gruendung 13:06): moneyGainRate gegen `node tools/audit/gang-p2b-gegen.mjs --live` innerhalb 5 %, Strafe >= 0,95, Fehler 0. Notschalter `data/gang-geld-aus.txt`.\n";
md += "- Pruefauftrag Torfrequenz (zwei halbe Runden gegen eine: rein auf der Competence-Seite x5,66 gegen x3,21 bei 36 Mrd, Einbaukosten nicht gerechnet) - abgebrochen, nicht gerechnet.\n";
md += "- Die " + nOpen + " offenen Erstbefunde oben: Ertraege sind ungepruefte Erstpruefer-Zahlen. Die mit Prio P1 sind die Kandidaten fuer kuenftige Pakete.\n";
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../nodes/AUDIT-VOLLSTAENDIG-2026-10-03.md");
fs.writeFileSync(out, md);
console.log("geschrieben:", out, findings.length, "Befunde,", nBuilt, "gebaut,", nDef, "zurueckgestellt,", nOpen, "offen");
