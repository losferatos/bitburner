// G09: Geld, Hospital-Zaehler, Kampfwerte des Spielers je Stand.
import { listRun, readSave, bbOf, fmt } from "./verify-g09-lib.mjs";
const run = process.argv[2] || "BN2L1";
let prev = null;
console.log("h_node  geld(Mrd)  dGeld/h(Mrd)  rank  numHosp moneyLost(Mrd) | hp  | str def dex agi cha int hack | maxStam stam | team");
for (const f of listRun(run)) {
  const { p } = readSave(f);
  const bb = bbOf(p);
  const h = p.playtimeSinceLastBitnode / 3.6e6;
  const d = prev ? (p.money - prev.m) / 1e9 / (h - prev.h) : NaN;
  const s = p.skills;
  console.log([fmt(h, 2).padStart(6), fmt(p.money / 1e9, 3).padStart(9), fmt(d, 2).padStart(8), fmt(bb.rank, 0).padStart(7),
    String(bb.numHosp).padStart(5), fmt(bb.moneyLost / 1e9, 3).padStart(7), "|", `${fmt(p.hp.current,0)}/${p.hp.max}`, "|",
    s.strength, s.defense, s.dexterity, s.agility, s.charisma, s.intelligence, s.hacking, "|", fmt(bb.maxStamina, 1), fmt(bb.stamina, 1), "|", bb.teamSize].join(" "));
  prev = { m: p.money, h };
}
