// G09: Grenzwert eines zusaetzlichen Raid-Versuchs gegen die Stadtbevoelkerung; Raid-Budget je Stadt bis zur Chaoswand;
// erwartete Hunger/Gym-Ueberlappung ueber den zufaelligen Startvorrat U[1,150].
import { listRun, readSave, fmt } from "./verify-g09-lib.mjs";
import { ACT, ctxOf, chance, actionTime, rankGain, rankLossAt, damage, K } from "./verify-g09-model.mjs";
const f = listRun("BN2L1").find((x) => x.includes("T09-19"));
const { p } = readSave(f);
const { ctx, levels } = ctxOf(p);
const L = levels["Raid"].level;
const full = { ...ctx, stamina: ctx.maxStamina };
console.log("Zustand BN2.1 09:19 (Stufe", L + ", Kampfwerte", p.skills.strength, p.skills.defense, p.skills.dexterity, p.skills.agility + ", Skills aus Spielstand), Chaos < 50, Stamina voll");
const ret = ACT["Retirement"], Lr = levels["Retirement"].level;
const pr = chance(ret, Lr, full), tr = actionTime(ret, Lr, full);
const dispRate = pr * rankGain(ret, Lr) / tr;      // Rang je Sekunde, die ein Retirement-Vertrag in der Raid-Zeit braechte
const tRaid = actionTime(ACT.Raid, L, full);
console.log(`verdraengter Vertrag: Retirement p ${fmt(pr, 3)} t ${tr}s -> ${fmt(dispRate * 3600, 0)} Rang/h; Raid-Dauer ${tRaid}s => ${fmt(dispRate * tRaid, 2)} Rang je Raid-Zeitfenster`);
console.log("pop (Mio) | p Raid | EV je Versuch | netto nach verdraengtem Vertrag | Krankenhaus Mio je Versuch | Mio $ je netto-Rang");
for (const pop of [300, 450, 587, 800, 1000, 1250, 1485]) {
  const c = { ...full, city: { ...ctx.city, pop: pop * 1e6, popEst: pop * 1e6, chaos: 10 } };
  const pp = chance(ACT.Raid, L, c);
  const ev = pp * rankGain(ACT.Raid, L) - (1 - pp) * rankLossAt(ACT.Raid, L);
  const hosp = (1 - pp) * damage(ACT.Raid, L) * K.hospPerHp / 1e6;
  const net = ev - dispRate * tRaid;
  console.log(String(pop).padStart(6), "|", fmt(pp, 3), "|", fmt(ev, 2).padStart(6), "|", fmt(net, 2).padStart(6), "|", fmt(hosp, 1).padStart(6), "|", net > 0 ? fmt(hosp / net, 1) : "-");
}
console.log("\nRaid-Budget je Stadt bis zur Chaoswand (Chaos multipliziert sich je Raid um E[1+U(1..5)%]; bei Chaos 0 bleibt er 0):");
let lnMean = 0; for (let k = 1; k <= 5; k++) lnMean += Math.log(1 + k / 100) / 5;
for (const c0 of [0.5, 1.1, 2, 5, 10]) {
  const n = Math.log(50 / c0) / lnMean;
  console.log(`  Start-Chaos ${c0}: ${fmt(n, 0)} Raids; bei 40/h ${fmt(n / 40, 1)} h, bei nur natuerlichem Vorrat (15,75/h) ${fmt(n / 15.75, 1)} h`);
}
console.log("\nErwartete Ueberlappung Hunger/Gym-Phase (Gym 4,3 h, Raid-Verbrauch 35/h gegen Zufluss 15,75/h; S0 ~ U[1,150]):");
let tot = 0, nn = 0;
for (let s0 = 1; s0 <= 150; s0++) { const th = s0 / (35 - 15.75); tot += Math.max(0, 4.3 - th); nn++; }
console.log(`  E[Stunden Hunger waehrend Gym] = ${fmt(tot / nn, 2)} h; Anteil Knoten mit Ueberlappung > 0: ${fmt(100 * [...Array(150).keys()].filter((s) => (s + 1) / 19.25 < 4.3).length / 150, 0)} % (S0 < 83)`);
console.log("  BN2.1: S0 ~ 50 (Vorrat 39,3 nach 24 Versuchen bei h0,85), BN2.2: S0 ~ 114 (124,5 ohne Versuch bei h0,65)");
