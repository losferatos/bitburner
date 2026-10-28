const M = require("./modell.cjs");
const SPW = "C:/Users/erche/AppData/Local/Temp/claude/C--Users-erche-Desktop-claude-projecto/feee1757-fe7d-46ac-8a39-80b39fc941eb/scratchpad/save6.json";
const s = require(SPW); const p = s.PlayerSave.data; const b = p.bladeburner.data;
const RM = 0.45;
const mk = (cityName) => ({ skills: p.skills, levels: b.skills, stamina: b.stamina, maxStamina: b.maxStamina, augMult: p.mults.bladeburner_success_chance,
  city: { ...b.cities[cityName].data }, teamCount: 0 });
const lv = (n) => { const a = b.contracts[n] || b.operations[n]; return a ? a.data.level : 1; };
const diffMult = M.diffMult;
console.log("Stadt        Aktion                 Lv  chReal chEst  Zeit  Gew  Verl  EV/Lauf  Rang/h(unbegrenzt)  hp-Schaden(Fehlschlag)");
for (const city of Object.keys(b.cities)) {
  const st = mk(city);
  for (const name of Object.keys(M.ACT)) {
    if (M.ACT[name].t === "B") continue;
    const L = lv(name); const c = M.chance(name, L, st); const ce = M.chance(name, L, st, { est: true });
    const t = M.actionTime(name, L, st); const g = M.rankGain(name, L, RM); const l = M.rankLoss(name, L);
    const ev = c * g - (1 - c) * l; const dmg = M.ACT[name].hp * diffMult(M.difficulty(M.ACT[name], L));
    if (city === "New Tokyo" || ["Raid"].includes(name))
    console.log(city.padEnd(12), name.padEnd(28), String(L).padStart(2), c.toFixed(3), ce.toFixed(3), String(t).padStart(4), g.toFixed(2).padStart(6), l.toFixed(2).padStart(5), ev.toFixed(2).padStart(7), (ev * 3600 / t).toFixed(0).padStart(8), dmg.toFixed(0));
  }
}
