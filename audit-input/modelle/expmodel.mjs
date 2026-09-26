import fs from "node:fs";
const r = JSON.parse(fs.readFileSync("s1719.json"));
const p = r.player; const L = p.skills.hacking; const m = p.mults;
const intB = 1 + Math.pow(p.skills.intelligence, 0.8)/600;
// Eichung: Level aus exp nachrechnen (calculateSkill)
const skill = (e, mult) => Math.max(Math.floor(mult*(32*Math.log(e+534.6)-200)),1);
console.log("Eichung Level: berechnet", skill(p.exp.hacking, m.hacking), "Spielstand", L);
const hackTime = (req, sec) => 5*((2.5*req*sec+500)/(L+50)) / (m.hacking_speed*intB);
const E = (3+0.3*20)*m.hacking_exp*0.5; // foodnstuff base 20
const tH = hackTime(1, 7);
console.log("foodnstuff E/Faden", E.toFixed(2), "tH", tH.toFixed(4), "tG", (3.2*tH).toFixed(4), "tW", (4*tH).toFixed(4));
const surplus = 42907, round = (1790435983315-1790435081074)/1000/(132-42);
console.log("Rundendauer gemessen", round.toFixed(3), "s");
const heute = (surplus/1.8)*E/round;
const growLoop = (surplus/1.75)*E/(3.2*tH);
const weakenLoop = (surplus/1.75)*E/(4*tH);
// hack-Ofen: je hack-Faden 0.002 Sicherheit -> 0.04 weaken-Faeden je hack-Aufruf, weaken dauert 4 tH -> 0.16 weaken-Slots je hack-Slot
const ramPerHackSlot = 1.7 + 0.16*1.75; const expPerHackSlotPerTH = E*(1 + 0.04);
const hackOfen = (surplus/ramPerHackSlot)*expPerHackSlotPerTH/tH;
console.log("Ofen heute (Einweg, 1x je Runde):", Math.round(heute), "exp/s");
console.log("grow-Dauerlaeufer:", Math.round(growLoop), "exp/s  Faktor", (growLoop/heute).toFixed(1));
console.log("weaken-Dauerlaeufer (expfarm.js):", Math.round(weakenLoop), "exp/s  Faktor", (weakenLoop/heute).toFixed(1));
console.log("hack-Ofen mit weaken-Anteil:", Math.round(hackOfen), "exp/s  Faktor", (hackOfen/heute).toFixed(1));
// gemessene Gesamtrate
const r4 = JSON.parse(fs.readFileSync("s1704.json")).player;
const gemessen = (p.exp.hacking - r4.exp.hacking)/((p.playtimeSinceLastAug - r4.playtimeSinceLastAug)/1000);
console.log("gemessen gesamt 17:04-17:19:", Math.round(gemessen), "exp/s");
// exp bis 4500 bei heutigem Mult
const need = Math.exp((4500/m.hacking + 200)/32) - 534.6;
console.log("exp fuer 4500 bei mult", m.hacking.toFixed(3), ":", need.toExponential(3), "Check", skill(need, m.hacking));
for (const [name, rate] of [["heute", gemessen], ["grow-Loop", gemessen - heute + growLoop], ["hack-Ofen", gemessen - heute + hackOfen]])
  console.log(name, (rate).toExponential(3), "exp/s ->", (need/rate/3600).toFixed(1), "h");
// Park 25 x 65536 GB
const parkGb = 25*65536, cost = 65536*55000*Math.pow(1.2, 16-6);
console.log("Park 25x64TB kostet", (25*cost).toExponential(3), "je Rechner", cost.toExponential(3), "-> grow-Loop exp/s", ((parkGb/1.75)*E/(3.2*tH)).toExponential(3), "-> 4500 in", (need/((parkGb/1.75)*E/(3.2*tH))/3600).toFixed(2), "h");
