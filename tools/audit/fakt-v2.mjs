// Audit 03.10.2026, Bereich FAKT: Wohin fliesst die Reputation im V2-Weg (BN2)?
//
// In BN2 gibt es keine Passivreputation (BitNode.tsx:581 FactionPassiveRepGain 0,
// FactionHelpers.tsx:132-135), und bn4rep arbeitet im V2 nie fuer Faktionen
// (src/bn4rep.js:496, :2475). Nicht-Bladeburner-Reputation kommt dann NUR aus
// Coding Contracts - und die gehen ausschliesslich an Faktionen mit
// offerHackingWork (PlayerObjectGeneralMethods.ts:515, :525), gleich verteilt
// (FactionReputationAll) bzw. per Zufall auf eine davon (FactionReputation).
// Erwartungswert je Faktion = Gesamtzufluss / Zahl der Hacking-Faktionen.
//
// Aufruf: node tools/audit/fakt-v2.mjs [sicherung.json.gz]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { loadAugs, v2Value } from "./fakt-augs.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..");
const file = process.argv[2] || "LIVE_197f4d61481686_BN2L1_2026-10-03T09-59_pre-hotswap.json.gz";
const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, "backups", file))).toString());
const p = JSON.parse(save.data.PlayerSave).data;
const FS = JSON.parse(save.data.FactionsSave);
const augs = loadAugs();

// offerHackingWork je Faktion aus FactionInfo.tsx (gelesen, nicht geraten)
const info = fs.readFileSync(path.join(ROOT, "reference/bitburner-src/src/Faction/FactionInfo.tsx"), "utf8");
const facEnumTxt = fs.readFileSync(path.join(ROOT, "reference/bitburner-src/src/Faction/Enums.ts"), "utf8");
const facEnum = {};
for (const m of facEnumTxt.matchAll(/(\w+)\s*=\s*"([^"]+)"/g)) facEnum[m[1]] = m[2];
const offersHacking = {};
for (const m of info.matchAll(/\[FactionName\.(\w+)\]:\s*new FactionInfo\(\{([\s\S]*?)\n  \}\),/g)) {
  offersHacking[facEnum[m[1]]] = /offerHackingWork:\s*true/.test(m[2]);
}

const owned = new Set([...(p.augmentations || []).map((a) => a.name), ...(p.queuedAugmentations || []).map((a) => a.name)]);
const repOf = (f) => { const d = FS[f] && (FS[f].data || FS[f]); return d ? d.playerReputation || 0 : 0; };

console.log("Sicherung:", file, "| Knotenzeit", (p.playtimeSinceLastBitnode / 3.6e6).toFixed(2), "h");
console.log("Hacking-Arbeit je Faktion (FactionInfo.tsx):", Object.entries(offersHacking).filter(([, v]) => !v).map(([k]) => k).join(", "), "= OHNE Hacking-Arbeit\n");

const rows = [];
for (const f of p.factions) {
  const rest = Object.values(augs).filter((a) => a.factions.includes(f) && !owned.has(a.name) && v2Value(a) > 0)
    .sort((a, b) => a.repCost - b.repCost);
  rows.push({ f, hack: !!offersHacking[f], rep: repOf(f), rest });
}
let hackN = 0, hackOhneWert = 0;
for (const r of rows) {
  if (r.hack) { hackN++; if (!r.rest.length) hackOhneWert++; }
  const next = r.rest.slice(0, 4).map((a) => a.name + " " + a.repCost / 1e3 + "k").join(", ");
  console.log(`  ${r.f.padEnd(16)} hackArbeit=${r.hack ? "ja " : "nein"} rep ${Math.round(r.rep).toString().padStart(6)}  offene V2-Stuecke ${String(r.rest.length).padStart(2)}  ${next}`);
}
console.log(`\nHacking-Arbeit-Faktionen: ${hackN}, davon ohne ein einziges offenes V2-Stueck: ${hackOhneWert}`);
console.log(`=> Anteil der Vertragsreputation ohne V2-Wert: ${(100 * hackOhneWert / hackN).toFixed(0)} %; die uebrigen bekaemen bei Verzicht x${(hackN / (hackN - hackOhneWert)).toFixed(2)}`);

// Alternativen der Staedtewahl (FactionInfo.tsx:495-558, Feindeslisten)
console.log("\nStaedtewahl im V2 - eindeutige V2-Stuecke je Stadtfaktion:");
for (const c of ["Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"]) {
  const list = Object.values(augs).filter((a) => a.factions.includes(c) && v2Value(a) > 0);
  const uniq = list.filter((a) => a.factions.length === 1);
  console.log(`  ${c.padEnd(10)} V2-Stuecke ${list.length}, davon nur hier ${uniq.length}: ${uniq.map((a) => a.name + " (" + a.repCost / 1e3 + "k, ln " + v2Value(a).toFixed(3) + ")").join(", ") || "-"}`);
}
const nut = augs["NutriGen Implant"];
console.log(`\nNutriGen Implant: ${JSON.stringify(nut.mults)} - verkuerzt den Kampfwert-Wiederaufbau nach jedem Einbau um 1 - 1/${nut.mults.strength_exp} = ${(100 * (1 - 1 / nut.mults.strength_exp)).toFixed(1)} % (Erfahrungsrate linear)`);

// --- Simulation: ein Einbauzyklus, Reputation NUR aus Coding Contracts ------------
// Annahmen (offen ausgewiesen): Gesamtzufluss R (gemessen BN2.1: 4.932 rep/h, siehe
// fakt-rep.mjs), gleichmaessig auf alle Hacking-Arbeit-Faktionen (Erwartungswert);
// alle Faktionen ab Zyklusbeginn Mitglied; ein Stueck gilt als verfuegbar, sobald
// EINE anbietende Mitgliedsfaktion genug Rep hat. Geld wird nur ausgewiesen (Summe
// bei absteigender Kaufreihenfolge, x1,9 je Kauf, AugmentationHelpers.ts:32-37,
// AugmentationMoneyCost BN2 = 1), nicht als Grenze gerechnet.
export function simulate(members, hours, R, ownedSet) {
  const hackers = members.filter((f) => offersHacking[f]);
  const perFac = R / hackers.length;
  const got = new Map();
  for (const a of Object.values(augs)) {
    if (ownedSet.has(a.name) || v2Value(a) <= 0) continue;
    let tBest = Infinity;
    for (const f of a.factions) if (hackers.includes(f)) tBest = Math.min(tBest, a.repCost / perFac);
    if (tBest <= hours) got.set(a.name, { t: tBest, v: v2Value(a), cost: a.moneyCost });
  }
  const v = [...got.values()].reduce((s, x) => s + x.v, 0);
  const costs = [...got.values()].map((x) => x.cost).sort((x, y) => y - x);
  const money = costs.reduce((s, c, i) => s + c * Math.pow(1.9, i), 0);
  return { n: hackers.length, perFac, count: got.size, v, money, names: [...got.keys()] };
}
const R = 4932;
const scen = {
  "Ist BN2.1 (7 Hacking-Faktionen)": ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Netburners", "Tian Di Hui", "CyberSec", "Slum Snakes"],
  "Ist + Syndicate (Kampf 200)": ["The Black Hand", "NiteSec", "Aevum", "Sector-12", "Netburners", "Tian Di Hui", "CyberSec", "Slum Snakes", "The Syndicate"],
  "nur V2-Leitern: S12, NiteSec, TDH, Syndicate": ["Sector-12", "NiteSec", "Tian Di Hui", "The Syndicate"],
  "Syndicate + NiteSec": ["The Syndicate", "NiteSec"],
  "Asien statt S12/Aevum: NT, Ishima, NiteSec, TDH, Syndicate": ["New Tokyo", "Ishima", "NiteSec", "Tian Di Hui", "The Syndicate"],
  "+ Dark Army (5 Kills, Chongqing): Syndicate, Dark Army, NiteSec": ["The Syndicate", "The Dark Army", "NiteSec"],
};
const ownedNow = new Set(owned);   // installiert + Warteschlange (naechster Zyklus)
console.log(`\nSIMULATION naechster Zyklus, R = ${R} rep/h Vertragsreputation, besessen = installiert + Warteschlange (${ownedNow.size})`);
for (const T of [12, 24]) {
  console.log(`  Zykluslaenge ${T} h:`);
  for (const [name, mem] of Object.entries(scen)) {
    const s = simulate(mem, T, R, ownedNow);
    console.log(`    ${name.padEnd(58)} n=${s.n} je Faktion ${Math.round(s.perFac)}/h -> ${String(s.count).padStart(2)} Stuecke, Summe ln ${s.v.toFixed(3)} (x${Math.exp(s.v).toFixed(2)}), Geld ${(s.money / 1e9).toFixed(1)} Mrd`);
  }
}

// --- Mit Geldgrenze: dieselbe Wahl, aber die Bladeburner-Stuecke konkurrieren um
// dasselbe Konto (jeder Kauf x1,9 fuer alle weiteren). Budget = Geld, das in einem
// Zyklus zur Verfuegung steht (BN2.1 gemessen: 9,38 Mrd nach 5,3 h bei ~3 Mrd/h
// Zufluss -> ~35 Mrd in 12 h, GESCHAETZT). Bladeburners-Rep am Zyklusende:
// 2 x Rang x faction_rep (Bladeburner/Formulas.ts:46-49), Rang ~5.000 -> ~13.000.
// Auswahl gierig nach Wert je Dollar; Bezahlung in absteigender Preisfolge.
function costOf(list) {
  return list.map((x) => x.cost).sort((x, y) => y - x).reduce((s, c, i) => s + c * Math.pow(1.9, i), 0);
}
export function simulateBudget(members, hours, R, ownedSet, budget, bbRep) {
  const hackers = members.filter((f) => offersHacking[f]);
  const perFac = R / hackers.length;
  const avail = [];
  for (const a of Object.values(augs)) {
    if (ownedSet.has(a.name) || v2Value(a) <= 0) continue;
    let ok = a.factions.includes("Bladeburners") && a.repCost <= bbRep;
    for (const f of a.factions) if (hackers.includes(f) && a.repCost / perFac <= hours) ok = true;
    if (ok) avail.push({ name: a.name, v: v2Value(a), cost: a.moneyCost, bb: a.factions.includes("Bladeburners") });
  }
  avail.sort((x, y) => y.v / y.cost - x.v / x.cost);
  const chosen = [];
  for (const x of avail) if (costOf([...chosen, x]) <= budget) chosen.push(x);
  const v = chosen.reduce((s, x) => s + x.v, 0);
  return { count: chosen.length, bb: chosen.filter((x) => x.bb).length, v, money: costOf(chosen), names: chosen.map((x) => x.name) };
}
console.log("\nMIT GELDGRENZE (35 Mrd je 12-h-Zyklus, Bladeburners-Rep 13.000; die 4 jetzigen Warteschlangenstuecke gelten als installiert):");
for (const [name, mem] of Object.entries(scen)) {
  const s = simulateBudget(mem, 12, R, ownedNow, 35e9, 13000);
  console.log(`  ${name.padEnd(58)} ${String(s.count).padStart(2)} Stuecke (davon ${s.bb} Bladeburner), Summe ln ${s.v.toFixed(3)} (x${Math.exp(s.v).toFixed(2)}), Geld ${(s.money / 1e9).toFixed(1)} Mrd`);
}

// Robustere Varianten OHNE Syndicate (Kampf 200 ist nach einem Einbau erst nach
// dem Wiederaufbau erreicht, also nicht ab Zyklusbeginn):
const scen2 = {
  "Ist ohne Syndicate": scen["Ist BN2.1 (7 Hacking-Faktionen)"],
  "S12, NiteSec, TDH": ["Sector-12", "NiteSec", "Tian Di Hui"],
  "New Tokyo, Ishima, NiteSec, TDH": ["New Tokyo", "Ishima", "NiteSec", "Tian Di Hui"],
  "Volhaven, NiteSec, TDH": ["Volhaven", "NiteSec", "Tian Di Hui"],
};
console.log("\nOHNE SYNDICATE, mit Geldgrenze 35 Mrd / 12 h:");
for (const [name, mem] of Object.entries(scen2)) {
  const s = simulateBudget(mem, 12, R, ownedNow, 35e9, 13000);
  console.log(`  ${name.padEnd(34)} ${String(s.count).padStart(2)} Stuecke (davon ${s.bb} BB), Summe ln ${s.v.toFixed(3)} (x${Math.exp(s.v).toFixed(2)}): ${s.names.join(", ")}`);
}

// FAKT-3: Hashes -> "Generate Coding Contract" (HashUpgradesMetadata.tsx:108-114,
// Kosten 25 x Stufe, HashManager.prestige setzt die Stufen beim Einbau zurueck).
// BN2.1 gemessen: ~9.200 Hashes in 5,3 h ausgegeben (1.357 x Verkauf a 4, 5 x Rang
// a 250..1250) -> ~1.700 Hashes/h -> ~20.000 je 12-h-Zyklus -> n mit 25 n(n+1)/2 <= 20.000.
// Ertrag je Vertrag: Formel 0,75 x 2500 x 4,23 / 3 = 2.646 Faktionsruf
// (PlayerObjectGeneralMethods.ts:510-557, mittlere Schwierigkeit der 30 Typen 4,23),
// gemessen nur 41 % davon (4.932 rep/h gegen 11.900 rep/h Formel bei 4,5 Vertraegen/h).
{
  let n = 0; while (25 * (n + 1) * (n + 2) / 2 <= 20000) n++;
  const extraRep = n * 2646 * (4932 / 11900);
  const R2 = R + extraRep / 12;
  console.log(`\nFAKT-3 Hash-Vertraege: ${n} Vertraege je 12 h -> +${Math.round(extraRep)} Ruf (gemessene Ausbeute) -> R = ${Math.round(R2)} rep/h`);
  for (const [name, mem] of Object.entries(scen2)) {
    const a = simulateBudget(mem, 12, R, ownedNow, 35e9, 13000);
    const b = simulateBudget(mem, 12, R2, ownedNow, 35e9 - 5e9, 13000);   // 5 Mrd Verkaufserloes fehlen
    console.log(`  ${name.padEnd(34)} ohne: ln ${a.v.toFixed(3)} (${a.count})  mit Hash-Vertraegen: ln ${b.v.toFixed(3)} (${b.count})  Differenz ln ${(b.v - a.v).toFixed(3)}`);
  }
}
