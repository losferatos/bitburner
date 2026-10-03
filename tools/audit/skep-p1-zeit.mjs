// Skeptiker P1: Laufzeit von waehleTorRunde bei grossem Budget (alle Stuecke in der Runde).
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseAugs, gangOffer } from "./gang-augs.mjs";
const KLON = "C:/Users/erche/Desktop/claude_projecto-bb-p1";
const E = await import(pathToFileURL(path.join(KLON, "src/lib/einbau.js")).href);
const H = await import(pathToFileURL(path.join(KLON, "src/lib/hackaugs.js")).href);
const augs = parseAugs();
const offer = gangOffer(augs, 2, 1).filter((a) => H.kampfknotenNuetzlich(a.name, true) && H.COMBAT_AUGS[a.name] && a.name !== "The Red Pill");
const bbAugs = augs.filter((a) => a.factions.includes("Bladeburners") && H.COMBAT_AUGS[a.name]);
const cand = [...offer, ...bbAugs].map((a) => ({ aug: a.name, faktion: "X", rep: 1e12, repReq: a.repCost, preis: a.moneyCost, prereq: a.prereqs, mults: H.COMBAT_AUGS[a.name] }));
const skills = { hacking: 400, strength: 270, defense: 270, dexterity: 330, agility: 270, intelligence: 150 };
console.log("Kandidaten: " + cand.length);
for (const budget of [1e10, 1e12, 1e14, 1e16, 1e20]) {
  const t0 = performance.now();
  const r = E.waehleTorRunde(cand, budget, new Set(), { skills });
  const t1 = performance.now();
  console.log("Budget " + budget.toExponential(0) + ": " + r.seq.length + " Stuecke, x" + r.gain.toFixed(2) + ", " + (t1 - t0).toFixed(0) + " ms");
}
