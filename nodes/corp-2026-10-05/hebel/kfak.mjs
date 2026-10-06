// Hebel-Vorlage 06.10.2026: k (Competence-Faktor = Chance-Faktor bei gleichen Stufen) der Corp-Torrunde je
// Faktionsmenge. Planer = echte waehleTorRunde ueber rechnung/rundenplan.mjs (cands/plan), unbegrenztes Budget,
// Bestechung aller Nicht-BB-Faktionen. Nur lesen. Aufruf: node nodes/corp-2026-10-05/hebel/kfak.mjs
import { cands, plan } from "../bot/rechnung/rundenplan.mjs";
const base = ["NiteSec", "Aevum", "Sector-12", "Tetrads", "Slum Snakes", "CyberSec"];
const sets = [
  ["heute beigetreten ohne Syndicate", base],
  ["+ The Syndicate (heute beigetreten)", [...base, "The Syndicate"]],
  ["+ Black Hand + Tian Di Hui", [...base, "The Syndicate", "The Black Hand", "Tian Di Hui"]],
  ["+ Speakers", [...base, "The Syndicate", "The Black Hand", "Tian Di Hui", "Speakers for the Dead"]],
  ["+ Speakers + Dark Army", [...base, "The Syndicate", "The Black Hand", "Tian Di Hui", "Speakers for the Dead", "The Dark Army"]],
  ["ohne Syndicate, + Black Hand/TDH (BN3.2 Zyklus 1 ohne Karma)", [...base, "The Black Hand", "Tian Di Hui"]],
];
for (const bb of [60000, 1e7]) {
  console.log("BB-Ruf", bb);
  for (const [lab, f] of sets) {
    const c = cands(f, { bribe: true, bbRep: bb });
    const out = [1e12, 1e13, 1e14, 1e15, Infinity].map((m) => { const p = plan(c, m); return `${m === Infinity ? "inf" : m.toExponential(0)}: k ${p.gain.toFixed(2)} n ${p.steps.length}`; });
    console.log("  " + lab.padEnd(58) + out.join(" | "));
  }
}
