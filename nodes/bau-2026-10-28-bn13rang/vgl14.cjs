const M = require("./modell.cjs");
const SP = "C:/Users/erche/AppData/Local/Temp/claude/C--Users-erche-Desktop-claude-projecto/feee1757-fe7d-46ac-8a39-80b39fc941eb/scratchpad/";
for (const [file, label] of [["save14.json", "BN14.3 h9.15"], ["save6.json", "BN13.1 h11.3"]]) {
  const s = require(SP + file); const p = s.PlayerSave.data; const b = p.bladeburner.data;
  console.log("==", label, "stats", p.skills.strength, p.skills.dexterity, "int", p.skills.intelligence, "hack", p.skills.hacking, "bb", JSON.stringify(b.skills));
  for (const city of Object.keys(b.cities)) {
    const c = b.cities[city].data;
    const st = { skills: p.skills, levels: b.skills, stamina: b.stamina, maxStamina: b.maxStamina, augMult: p.mults.bladeburner_success_chance, city: { ...c }, teamCount: 0 };
    const L = b.operations.Raid.data.level;
    console.log(city.padEnd(10), "pop", (c.pop / 1e9).toFixed(2), "est", (c.popEst / 1e9).toFixed(2), "comms", c.comms, "chaos", c.chaos.toFixed(1), "Raid L" + L, "real", M.chance("Raid", L, st).toFixed(3), " L1:", M.chance("Raid", 1, st).toFixed(3), "Assass L1", M.chance("Assassination", 1, st).toFixed(3));
  }
}
