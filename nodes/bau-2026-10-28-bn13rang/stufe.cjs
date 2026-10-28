const M = require("./modell.cjs");
const s = require("C:/Users/erche/AppData/Local/Temp/claude/C--Users-erche-Desktop-claude-projecto/feee1757-fe7d-46ac-8a39-80b39fc941eb/scratchpad/save6.json"); const p = s.PlayerSave.data, b = p.bladeburner.data;
for (const city of ["New Tokyo", "Volhaven"]) {
  const st = { skills: p.skills, levels: b.skills, stamina: b.stamina, maxStamina: b.maxStamina, augMult: p.mults.bladeburner_success_chance, city: { ...b.cities[city].data }, teamCount: 0 };
  console.log(city, "Raid je Stufe: L chance Zeit EV/Lauf EV/h");
  for (const L of [1, 3, 5, 7, 9]) { const c = M.chance("Raid", L, st), t = M.actionTime("Raid", L, st), ev = c * M.rankGain("Raid", L, .45) - (1 - c) * M.rankLoss("Raid", L); console.log("  L" + L, c.toFixed(3), t, ev.toFixed(2), (ev * 3600 / t).toFixed(0)); }
}
