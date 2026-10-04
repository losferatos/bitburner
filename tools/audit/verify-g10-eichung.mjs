// Gegenpruefung G10 (BLADE-1): Eichung der Chancen-Formel gegen echte Spielstandwerte
// UND Auswertung der LIVE-Lage BN2.2 (Spielstand 04.10. 12:17): wahre Chance je Stadt.
// Soll = data/blade.json "chance" (= getActionEstimatedSuccessChance()[0] der laufenden Aktion,
//        3 Stellen) bzw. boChancen (exakt, Bevoelkerung irrelevant).
// Ist  = Nachbau aus blade-formeln.mjs (Quelle Action.ts).
// Aufruf: node tools/audit/verify-g10-eichung.mjs
import path from "node:path";
import { ladeSpielstand, flach, homeDatei } from "./blade-lage.mjs";
import { AKTIONEN, successChance, successRange, actionTime, rankGain, rankLoss } from "./blade-formeln.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const stand = (f) => {
  const { p, servers } = ladeSpielstand(path.join(root, "backups", f));
  const bb = flach(p.bladeburner);
  const bj = JSON.parse(homeDatei(servers, "data/blade.json") || "null");
  return { p, bb, bj };
};
const lvl = (bb, n) => (bb.contracts[n] || bb.operations[n] || { level: 1 }).level;

function eich(f) {
  const { p, bb, bj } = stand(f);
  const P = { skills: p.skills, mults: p.mults };
  const BB = { skills: bb.skills, stamina: bb.stamina, maxStamina: bb.maxStamina, staminaBonus: bb.staminaBonus };
  const city = bb.cities[bb.city];
  const aktion = bb.action && bb.action.name;
  console.log("\n==", f, "Stadt", bb.city, "Aktion", aktion, "Stamina", bb.stamina.toFixed(2) + "/" + bb.maxStamina.toFixed(2));
  // (a) Black-Op-Chance Typhoon: exakt, ohne Bevoelkerung -> prueft Skill-/Stat-Teil der Formel
  const ty = AKTIONEN["Operation Typhoon"];
  const sollTy = bj && bj.boChancen && bj.boChancen["Operation Typhoon"];
  const istTy = successChance(ty, 1, P, { ...BB, stamina: bb.stamina }, city, { teamCount: bb.teamSize || 0 });
  console.log("  Typhoon-Chance   Soll", sollTy, " Ist", istTy.toFixed(4));
  // (b) laufende Aktion: s.min (Spannenuntergrenze) gegen bj.chance
  if (aktion && AKTIONEN[aktion]) {
    const a = AKTIONEN[aktion];
    const [lo, hi, real] = successRange(a, lvl(bb, aktion), P, BB, city, {});
    console.log("  " + aktion + " L" + lvl(bb, aktion) + " s.min Soll", bj && bj.chance, " Ist", lo.toFixed(4), "(max", hi.toFixed(4), "real", real.toFixed(4) + ")");
  }
  return { p, bb, bj, P, BB };
}
eich("LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz");
const live = eich("LIVE_197f4d61481686_BN2L2_2026-10-04T12-17_hourly.json.gz");

// LIVE-Lage BN2.2: Raid und Assassination L1 je Stadt (wahre Chance mit pop, Bot-Sicht mit popEst)
const { bb, P, BB } = live;
console.log("\n== LIVE BN2.2 12:17: Raid L1 je Stadt (Division in " + bb.city + ")");
let hier = null;
const zeilen = [];
for (const [n, c] of Object.entries(bb.cities)) {
  const city = { pop: c.pop, popEst: c.popEst, chaos: c.chaos, comms: c.comms };
  const a = AKTIONEN.Raid;
  const pw = successChance(a, 1, P, BB, city);
  const pe = successChance(a, 1, P, BB, city, { est: true });
  const g = rankGain(a, 1), l = rankLoss(a, 1);
  const ev = pw * g - (1 - pw) * l;
  const T = actionTime(a, 1, P, BB);
  zeilen.push({ n, pw, pe, ev, T, popM: c.pop / 1e6, estM: c.popEst / 1e6, ch: c.chaos, cm: c.comms });
  if (n === bb.city) hier = zeilen[zeilen.length - 1];
}
for (const z of zeilen) console.log("  " + z.n.padEnd(10), "pop", z.popM.toFixed(0).padStart(5) + "M", "popEst", z.estM.toFixed(0).padStart(5) + "M", "chaos", z.ch.toFixed(2),
  "comms", String(z.cm).padStart(3), "| p wahr", z.pw.toFixed(3), "p aus popEst", z.pe.toFixed(3), "| EV/Versuch", z.ev.toFixed(2), "T", z.T + "s", n2(z.n === bb.city ? "<- Division" : ""));
function n2(s) { return s; }
const beste = [...zeilen].sort((a, b) => b.ev - a.ev)[0];
console.log("  Verhaeltnis EV beste/hier:", (beste.ev / hier.ev).toFixed(2), "(" + beste.n + ")");
// Regel des Bots (blade.js:2802-2818): wert = popEst / chaosfaktor, Wechsel nur wenn beste > 2 x hier
const wert = (z) => z.estM * 1e6 / (z.ch > 50 ? Math.sqrt(1 + z.ch - 50) : 1);
const botBeste = [...zeilen].sort((a, b) => wert(b) - wert(a))[0];
console.log("  Bot-Regel: bester Wert", botBeste.n, (wert(botBeste) / 1e6).toFixed(0) + "M gegen hier", (wert(hier) / 1e6).toFixed(0) + "M, Verhaeltnis", (wert(botBeste) / wert(hier)).toFixed(2), "-> Wechsel (>2):", wert(botBeste) / wert(hier) > 2);
