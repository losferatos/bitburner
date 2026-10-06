// Rechnung Corp-Geld BN3 (06.10.2026): Was bringt die Torrunde mit Bestechung, je Faktionsmenge und Budget?
// Planer = die ECHTE waehleTorRunde des Bots (src/lib/einbau.js, nur gelesen), Preise/Ruf BN3 x3/x3
// (BitNode.tsx:619-620), Kette x1,9. Stufen, Reaper/Evasive aus dem Spielstand BN3.1 17:10 pre-install.
// k = Competence-Verhaeltnis (dieselbe Zielgroesse wie die Rundenwahl), naechste Black Op Typhoon.
// Nur lesen. Aufruf: node nodes/corp-2026-10-05/bot/rechnung/rundenplan.mjs [--bb=60000]
import { loadBot, loadState, AUGS } from "../../../../tools/audit/gang-p2b-lib.mjs";
const bot = await loadBot();
const S = loadState("BN3L1_2026-10-06T17-10_pre-install");
const bbs = Object.fromEntries(Object.entries(S.bb.skills.data ? Object.fromEntries(S.bb.skills.data) : S.bb.skills));
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? Number(a.split("=")[1]) : d; };
const BB_REP = arg("bb", 60000);
const C = bot.COMBAT_AUGS;
const PM = 3, RM = 3;   // BN3 AugmentationMoneyCost / AugmentationRepCost
const JOINED = ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Tetrads", "Slum Snakes", "Tian Di Hui", "CyberSec"];
const CRIME = ["The Syndicate", "Speakers for the Dead", "The Dark Army"];
// Nach dem Einbau 17:11 installiert: NFG + die fuenf wartenden Stuecke
const OWNED = new Set(["Neurotrainer I", "Wired Reflexes", "Augmented Targeting I", "LuminCloaking-V1 Skin Implant", "Augmented Targeting II"]);

export function cands(factions, { bribe, bbRep = BB_REP, otherRep = 0 }) {
  const out = [];
  for (const f of [...factions, "Bladeburners"]) {
    for (const a of Object.values(AUGS)) {
      if (!a.factions.includes(f) || !C[a.name] || OWNED.has(a.name) || a.name === "NeuroFlux Governor") continue;
      if (a.name.startsWith("Stanek")) continue;
      const repReq = a.repCost * RM;
      const rep = f === "Bladeburners" ? bbRep : (bribe ? Infinity : otherRep);
      out.push({ aug: a.name, faktion: f, rep, repReq, preis: a.moneyCost * PM, prereq: a.prereqs, mults: C[a.name] });
    }
  }
  return out;
}
const bo = bot.blackOpWeights(bot.blackopsTable, "Operation Typhoon");
const opts = { skills: bot.effectiveLevels(S.p.skills, bot.bladeEffFactors(bbs["Reaper"], bbs["Evasive System"])),
  weights: bo.weights, decays: bo.decays, startMults: {}, priceStep: 1.9 };
export const plan = (c, money, owned = OWNED) => bot.waehleTorRunde(c, money, owned, opts);
const bribeRep = (p, c) => {
  const need = {};
  for (const s of p.steps) {
    if (s.faktion === "Bladeburners") continue;
    const k = c.find((x) => x.aug === s.aug && x.faktion === s.faktion);
    need[s.faktion] = Math.max(need[s.faktion] || 0, k.repReq);
  }
  return Object.values(need).reduce((a, b) => a + b, 0);
};
if (process.argv[1].endsWith("rundenplan.mjs")) {
  console.log(`BB-Ruf ${BB_REP}, Stufen ${JSON.stringify(S.p.skills)}, Reaper ${bbs["Reaper"]} Evasive ${bbs["Evasive System"]}`);
  const rows = [
    ["heute (kein Bestechen, Fremdruf 20k)", cands(JOINED, { bribe: false, otherRep: 20000 })],
    ["Bestechung beigetretene Faktionen", cands(JOINED, { bribe: true })],
    ["+ Syndicate/Speakers/Dark Army", cands([...JOINED, ...CRIME], { bribe: true })],
    ["+ dazu The Covenant", cands([...JOINED, ...CRIME, "The Covenant"], { bribe: true })],
  ];
  for (const [lab, c] of rows) {
    console.log("\n" + lab);
    for (const m of [1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e20, Infinity]) {
      const p = plan(c, m);
      console.log(`  Budget ${m === Infinity ? "unbegr." : m.toExponential(0)}: n=${String(p.steps.length).padStart(2)} k=${p.gain.toFixed(3)} Kosten ${p.cost.toExponential(2)} Bestechung ${(bribeRep(p, c) * 1e9).toExponential(2)} $`);
    }
    const p = plan(c, Infinity);
    console.log("  unbegrenzt, Reihenfolge: " + p.steps.map((s) => s.aug + "@" + s.faktion.slice(0, 8)).join(" > "));
  }
}
