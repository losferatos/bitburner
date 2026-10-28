const M = require("./modell.cjs");
const SPW = "C:/Users/erche/AppData/Local/Temp/claude/C--Users-erche-Desktop-claude-projecto/feee1757-fe7d-46ac-8a39-80b39fc941eb/scratchpad/save6.json";
const s = require(SPW); const p = s.PlayerSave.data; const b = p.bladeburner.data;
const st = { skills: p.skills, levels: b.skills, stamina: b.stamina, maxStamina: b.maxStamina, augMult: p.mults.bladeburner_success_chance,
  city: { ...b.cities["New Tokyo"].data }, teamCount: 0 };
const L = (n) => b.operations[n].data.level;
console.log("stamina", st.stamina, st.maxStamina, "augMult", st.augMult);
console.log("Typhoon real  (Soll blade.json 0.136):", M.chance("Operation Typhoon", 1, st).toFixed(4));
console.log("Raid9 real (Soll 0.085 = Schaetzwert/Spanne?):", M.chance("Raid", 9, st).toFixed(4), " est:", M.chance("Raid", 9, st, { est: true }).toFixed(4));
console.log("Raid9 Zeit (Soll 86 s):", M.actionTime("Raid", 9, st));
const c = st.city; const r = c.pop / c.popEst; const real = M.chance("Raid", 9, st), est = M.chance("Raid", 9, st, { est: true });
const lo = Math.max(0, real - Math.abs(real - est)); const hi = real + Math.abs(real - est);
console.log("city", st.city, "r", r.toFixed(3), "Spanne(min,max)=", (r < 1 ? lo * r : lo).toFixed(4), Math.min(1, r < 1 ? hi : hi * Math.min(1, r)).toFixed(4), "(Soll min 0.085 aus blade.json)");
