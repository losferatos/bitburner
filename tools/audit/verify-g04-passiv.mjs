// Audit 04.10.2026, Gegenpruefung G04: passiver Faktionsruf (FactionHelpers.tsx:132-170)
// gegen Spielstand eichen. Soll = Ruf je Faktion im Stand / Spielzeit seit letztem Einbau
// (Mittelwert; Level driftet, daher nur Groessenordnung), Ist = Formel mit Stand-Werten.
// Aufruf: node tools/audit/verify-g04-passiv.mjs <backup.json.gz> [FactionWorkRepGain=1]
import fs from "node:fs";
import zlib from "node:zlib";
import { loadSave, runningScripts } from "./hack-save.mjs";
const file = process.argv[2];
const fwrg = Number(process.argv[3] || 1);
const { save, p, servers } = loadSave(file);
const facs = JSON.parse(save.data.FactionsSave);
const intB = (int, w) => 1 + (w * Math.pow(int, 0.8)) / 600;          // intelligence.ts
const hackingRep = (favor, S) => ((p.skills.hacking + p.skills.intelligence / 3) / 975) * p.mults.faction_rep * intB(p.skills.intelligence, 1) * (1 + favor / 100) * fwrg * S;
const secRep = (favor, S) => 0.9 * (p.skills.strength + p.skills.defense + p.skills.dexterity + p.skills.agility + (p.skills.hacking + p.skills.intelligence) * S) / 975 / 4.5 * p.mults.faction_rep * (1 + favor / 100) * fwrg * intB(p.skills.intelligence, 1);
const fieldRep = (favor, S) => 0.9 * (p.skills.strength + p.skills.defense + p.skills.dexterity + p.skills.agility + p.skills.charisma + (p.skills.hacking + p.skills.intelligence) * S) / 975 / 5.5 * p.mults.faction_rep * (1 + favor / 100) * fwrg * intB(p.skills.intelligence, 1);
// share: effektive Faeden = Faeden * intB(int,2) * Kernbonus(Wirt)
let eff = 0, thr = 0;
for (const s of Object.values(servers)) for (const r of runningScripts(s)) if (r.filename === "worker/share.js") { thr += r.threads; eff += r.threads * intB(p.skills.intelligence, 2) * (1 + ((s.cpuCores || 1) - 1) / 16); }
const S = 1 + Math.log(Math.max(1, eff + 1)) / 25;   // shareThreads startet bei 1 (Share.ts:5)
console.log("Stand", file.slice(-40), "Level", p.skills.hacking, "int", p.skills.intelligence, "faction_rep", p.mults.faction_rep.toFixed(3), "share-Faeden", thr, "eff", eff.toFixed(0), "S =", S.toFixed(4), "SpielzeitSeitAug h", (p.playtimeSinceLastAug / 3.6e6).toFixed(2));
console.log("faktion\tfavor\trep\tMember\tSoll rep/h (Mittel)\tIst passiv rep/h mit S\tIst ohne share (S=1)\tshare-Anteil rep/h");
for (const [n, f] of Object.entries(facs)) {
  const d = f.data || f;
  if (!p.factions.includes(n) || n === "Bladeburners") continue;
  const favor = d.favor || 0;
  const rate = (SS) => Math.max(hackingRep(favor, SS), secRep(favor, SS), fieldRep(favor, SS));   // je Zyklus ohne favorMult
  const fm = Math.min(0.1, favor / 1000 + 0.01);
  const proH = (SS) => Math.max(rate(SS) * fm, 1 / 120) * 5 * 3600;
  console.log([n, favor.toFixed(1), (d.playerReputation || 0).toFixed(0), ((d.playerReputation || 0) / (p.playtimeSinceLastAug / 3.6e6)).toFixed(0), proH(S).toFixed(0), proH(1).toFixed(0), (proH(S) - proH(1)).toFixed(0)].join("\t"));
}
