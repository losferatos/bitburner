// Audit 03.10.2026 (BLADE): Was bringt dieselbe Figur in jeder der sechs
// Staedte? Wahre Chancen (pop, nicht popEst), Rang je Minute je Aktion,
// ausdauerbegrenzte Dauerrate mit Regenerationskammer, und was die
// Stadtwahl des Bots (blade.js:2758-2780, Wert = popEst/Chaosfaktor) sieht.
// Formeln: blade-formeln.mjs (geeicht in blade-eichung.mjs).
// Aufruf: node tools/audit/blade-stadt.mjs [backupdatei]
import path from "node:path";
import fs from "node:fs";
import { ladeSpielstand, flach } from "./blade-lage.mjs";
import { AKTIONEN, successChance, successRange, actionTime, maxStamina, staminaGainPerSecond, rankGain, rankLoss, staminaCost } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const datei = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const { p } = ladeSpielstand(path.join(root, "backups", path.basename(datei)));
const bb = flach(p.bladeburner);
const P = { skills: p.skills, mults: p.mults };
const BB = { skills: bb.skills, stamina: bb.maxStamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus }; // volle Ausdauer: Strafe 1
const mx = maxStamina(P, BB);
const R = staminaGainPerSecond(P, BB, mx);            // je Sekunde, passiv
const H = mx * 0.01 / 60;                              // Kammer: +1 % max je 60 s (Bladeburner.ts:1197-1202), je Sekunde
const lvl = (n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;
const NAMEN = ["Tracking", "Bounty Hunter", "Retirement", "Investigation", "Undercover Operation", "Sting Operation", "Raid", "Stealth Retirement Operation", "Assassination"];
console.log("maxStamina", mx.toFixed(3), "Regeneration/min", (R * 60).toFixed(3), "Kammer zusaetzlich/min", (H * 60).toFixed(3));

function lageStadt(city) {
  const zeilen = [];
  for (const n of NAMEN) {
    const a = AKTIONEN[n];
    const L = lvl(n);
    const p1 = successChance(a, L, P, BB, city);
    const T = actionTime(a, L, P, BB);
    const g = p1 * rankGain(a, L) - (1 - p1) * rankLoss(a, L);
    const s = staminaCost(a, L);
    // Dauerrate: Arbeitsanteil w = (R+H)/(s/T+H), wenn s/T > R
    const verbrauch = s / T;
    const w = verbrauch <= R ? 1 : (R + H) / (verbrauch + H);
    zeilen.push({ n, L, p: p1, T, g, rangMinRoh: 60 * g / T, w, rangMinDauer: 60 * w * g / T });
  }
  return zeilen;
}
const ergebnis = {};
for (const [name, c0] of Object.entries(bb.cities)) {
  const city = { pop: c0.pop, popEst: c0.popEst, chaos: c0.chaos, comms: c0.comms };
  const z = lageStadt(city);
  const faktor = city.chaos > 50 ? Math.sqrt(1 + city.chaos - 50) : 1;
  const botWert = city.popEst / faktor;
  const wahrWert = city.pop / faktor;
  const popFaktor = Math.pow(city.pop / 1e9, 0.7);
  const beste = [...z].sort((a, b) => b.rangMinDauer - a.rangMinDauer)[0];
  ergebnis[name] = { botWert, wahrWert, popFaktor, beste };
  console.log("\n" + name + (name === bb.city ? "  <- Division hier" : ""), "pop", (city.pop / 1e6).toFixed(0) + "M", "popEst", (city.popEst / 1e6).toFixed(0) + "M",
    "chaos", city.chaos.toFixed(2), "comms", city.comms, "PopFaktor", popFaktor.toFixed(3), "Bot-Wert(popEst)", (botWert / 1e6).toFixed(0) + "M", "wahr", (wahrWert / 1e6).toFixed(0) + "M");
  for (const r of z) console.log("  " + r.n.padEnd(30), "L" + String(r.L).padEnd(3), "p " + r.p.toFixed(3), "T " + String(r.T).padStart(4) + "s",
    "EV/Versuch " + r.g.toFixed(2).padStart(7), "Rang/min roh " + r.rangMinRoh.toFixed(2).padStart(6), "Arbeitsanteil " + r.w.toFixed(2), "Rang/min dauer " + r.rangMinDauer.toFixed(2));
}
const hier = bb.city;
const besteStadtWahr = Object.entries(ergebnis).sort((a, b) => b[1].beste.rangMinDauer - a[1].beste.rangMinDauer)[0];
console.log("\nHier", hier, "beste Aktion", ergebnis[hier].beste.n, ergebnis[hier].beste.rangMinDauer.toFixed(2), "Rang/min");
console.log("Beste Stadt (wahr)", besteStadtWahr[0], besteStadtWahr[1].beste.n, besteStadtWahr[1].beste.rangMinDauer.toFixed(2), "Rang/min");
const botBeste = Object.entries(ergebnis).sort((a, b) => b[1].botWert - a[1].botWert)[0];
console.log("Bot-Regel: bester Wert", botBeste[0], (botBeste[1].botWert / 1e6).toFixed(0) + "M gegen hier", (ergebnis[hier].botWert / 1e6).toFixed(0) + "M -> Wechsel nur ueber Faktor 2:", botBeste[1].botWert > 2 * ergebnis[hier].botWert);
