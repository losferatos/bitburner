// Audit geldwert BN3 (05.10.2026): Competence-Faktor k der tatsaechlichen Einbauten frueherer Laeufe.
// k = Competence(Stufen x Mults der wartenden Stuecke) / Competence(Stufen) mit den Gewichten der naechsten
// Black Op - dieselbe Zielgroesse wie waehleTorRunde (src/lib/einbau.js:804ff, gateMultsProduct :621).
// Nur lesen. Aufruf: node tools/audit/geld-bn3-kist.mjs <spielstand...>
import { loadBot, loadState } from "./gang-p2b-lib.mjs";
const bot = await loadBot();
export function kOf(bot, levelsRaw, reaper, evasive, multsList, opName) {
  const bo = bot.blackOpWeights(bot.blackopsTable, opName);
  const levels = bot.effectiveLevels(levelsRaw, bot.bladeEffFactors(reaper, evasive));
  const extra = bot.gateMultsProduct(multsList);
  const c = (ex) => { let s = 0; for (const st of Object.keys(bo.weights)) { const w = bo.weights[st]; if (!(w > 0)) continue;
    s += w * Math.pow((levels[st] || 0) * (ex[st] || 1), bo.decays[st] ?? 1); } return s * (ex.bladeburner_success_chance || 1); };
  return { k: c(extra) / c({}), extra };
}
if (process.argv[1].endsWith("geld-bn3-kist.mjs")) {
  for (const f of process.argv.slice(2)) {
    const s = loadState(f);
    const names = s.p.queuedAugmentations.map(a => a.name);
    const bbs = Object.fromEntries((s.bb.skills && (s.bb.skills.data || s.bb.skills)) ? Object.entries(s.bb.skills.data ? Object.fromEntries(s.bb.skills.data) : s.bb.skills) : []);
    const op = bot.blackopsTable.ops[Math.min(20, s.bb.numBlackOpsComplete)].name;
    const r = kOf(bot, s.p.skills, bbs["Reaper"] || 0, bbs["Evasive System"] || 0, names.map(n => bot.COMBAT_AUGS[n]).filter(Boolean), op);
    console.log(f.slice(-40), "q", names.length, "Rang", Math.round(s.bb.rank), "BO", s.bb.numBlackOpsComplete, "Reaper/Evasive", bbs["Reaper"], bbs["Evasive System"], "k", r.k.toFixed(3), JSON.stringify(Object.fromEntries(Object.entries(r.extra).map(([a,b])=>[a.slice(0,5),+b.toFixed(2)]))));
  }
}
