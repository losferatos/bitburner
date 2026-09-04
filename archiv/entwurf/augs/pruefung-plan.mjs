// Aufruf: node --experimental-vm-modules entwurf/augs/pruefung-plan.mjs
// Prueft die Rechenteile von buyaugs.js gegen den ECHTEN Spielstand (liest
// ihn ueber die Bruecke auf 8795, schreibt nichts). Der DOM-Teil bleibt aus.
import fs from "node:fs";
import vm from "node:vm";
import zlib from "node:zlib";

const FILE = new URL("./buyaugs.js", import.meta.url);
let src = fs.readFileSync(FILE, "utf8");
// Alles exportieren, damit der Test drankommt.
src = src.replace(/^(async function |function |const |class )/gm, "export $1");
src = src.replace(/^export const AUG_TABLE/m, "export const AUG_TABLE");

const ctx = vm.createContext({ console, Math, Number, Object, Set, Map, Array, JSON, String, Infinity, NaN, isNaN });
const mod = new vm.SourceTextModule(src, { context: ctx, identifier: "buyaugs" });
await mod.link(() => {
  throw new Error("keine Importe erwartet");
});
await mod.evaluate();
const M = mod.namespace;

console.log("Katalog:", M.CATALOG.size, "Augs; SoA:", M.SOA_AUGS.size);

// --- Zustand aus dem Spielstand -------------------------------------------
const q0 = new URLSearchParams({ method: "getSaveFile" });
const b = await (await fetch("http://localhost:8795/api/rpc?" + q0)).json();
const save = JSON.parse(zlib.gunzipSync(Buffer.from(b.result.save, "latin1")).toString("utf8"));
const p = JSON.parse(save.data.PlayerSave).data;
const F = JSON.parse(save.data.FactionsSave);
const factions = p.factions;
const installedList = (p.augmentations || []).map((a) => a.data || a);
const queuedList = (p.queuedAugmentations || []).map((a) => a.data || a);
const installedAugs = new Map(installedList.map((a) => [a.name, a.level]));
const rep = new Map(factions.map((f) => [f, (F[f] && (F[f].data || F[f]).playerReputation) || 0]));

// Die Oberflaeche nachbauen: fuer jede Mitgliedsfaktion alle Augs, die sie
// anbietet, mit dem owned-Kennzeichen aus dem Spielstand.
const haveNames = new Set([...installedList, ...queuedList].map((a) => a.name));
const rows = new Map();
for (const f of factions) {
  for (const [name, entry] of M.CATALOG) {
    if (!entry.factions.includes(f)) continue;
    const prev = rows.get(name);
    const owned = name === "NeuroFlux Governor" ? false : haveNames.has(name);
    if (prev) prev.factions.add(f);
    else rows.set(name, { owned, disabled: false, factions: new Set([f]) });
  }
}

const installedNfg = installedAugs.get("NeuroFlux Governor") ?? 0;
const queuedNfg = queuedList.filter((a) => a.name === "NeuroFlux Governor").length;
const nfgLevel = installedNfg + queuedNfg;
const queuedNonNfg = [...rows.entries()].filter(
  ([n, r]) => r.owned && n !== "NeuroFlux Governor" && !installedAugs.has(n) && !M.SOA_AUGS.has(n),
);
const q = queuedNonNfg.length + queuedNfg;
const g = Math.pow(1.9, q);
console.log(`Geld $${(p.money / 1e9).toFixed(2)} Mrd | q=${q} -> g=${g.toFixed(2)} | NFG-Stufe ${nfgLevel}`);
console.log("Faktionen:", [...rep.entries()].map(([k, v]) => `${k}=${v.toFixed(0)}`).join(", "));

const { candidates, notes } = M.buildCandidates({
  rows,
  rep,
  installed: new Set(installedAugs.keys()),
  nfgLevel,
  distinctBonus: 0.15,
  nfgDepth: 25,
});
for (const n of notes) console.log("  Hinweis:", n);
candidates.sort((a, b) => b.base - a.base);
console.log("\nKandidaten:");
for (const c of candidates)
  console.log(
    `  ${c.name.padEnd(34)} base $${(c.base / 1e6).toFixed(2)}M | Rang0 $${((c.base * g) / 1e9).toFixed(2)} Mrd | Nutzen ${c.score.toFixed(4)}`,
  );

for (const budget of [p.money, p.money - 45e9, 1e15, 1e18]) {
  const plan = M.planPurchases(candidates, budget, g, 6);
  console.log(`\nBudget $${(budget / 1e9).toFixed(2)} Mrd -> ${plan.seq.length} Kaeufe, Summe $${(plan.total / 1e9).toFixed(2)} Mrd, Nutzen ${plan.value.toFixed(4)}`);
  plan.seq.forEach((c, i) => console.log(`   ${i + 1}. ${c.name} $${(plan.costs[i] / 1e9).toFixed(3)} Mrd`));
}

// --- Regressionsproben ----------------------------------------------------
console.log("\n--- Proben ---");
// (1) Reihenfolgeregel: teuerste zuerst ist billiger als umgekehrt
const a1 = { name: "A", base: 100, score: 1, prereqs: [], isNfg: false };
const a2 = { name: "B", base: 10, score: 1, prereqs: [], isNfg: false };
const teuer = M.sequenceCost([a1, a2], 1).total;
const billig = M.sequenceCost([a2, a1], 1).total;
console.log(`teuerste zuerst ${teuer} < umgekehrt ${billig}:`, teuer < billig);
// (2) NFG-Stufen kommen aufsteigend heraus
const nfgs = [0, 1, 2].map((j) => ({ name: "N" + j, base: 750e3 * 1.14 ** (20 + j), score: 0.07, prereqs: [], isNfg: true, nfgIndex: j }));
const ord = M.orderSelection([...nfgs].reverse());
console.log("NFG-Reihenfolge:", ord.map((c) => c.name).join(","), "->", ord.every((c, i) => c.nfgIndex === i));
// (3) Voraussetzung wird vorgezogen
const pre = { name: "Bionic Spine", base: 125e6, score: 0.1, prereqs: [], isNfg: false };
const post = { name: "Graphene Bionic Spine Upgrade", base: 6e9, score: 0.2, prereqs: ["Bionic Spine"], isNfg: false };
const ord2 = M.orderSelection([post, pre]);
console.log("Prereq zuerst:", ord2.map((c) => c.name).join(" -> "), "->", ord2[0].name === "Bionic Spine");
// (4) Auswahl ohne mitgewaehlte Voraussetzung wird verworfen
console.log("Unerfuellbar ->", M.orderSelection([post]) === null);
// (5) sequenceCost verweigert luekenhafte NFG-Folge
console.log("Luecke erkannt ->", M.sequenceCost([nfgs[0], nfgs[2]], 1) === null);
// (6) Score-Vergleich BitWire vs NFG-Stufe
const bw = M.CATALOG.get("BitWire");
console.log("multScore BitWire:", M.multScore(bw.mults).toFixed(4), "| NFG-Stufe:", M.multScore(M.CATALOG.get("NeuroFlux Governor").mults).toFixed(4));
