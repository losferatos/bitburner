// Wirkung von Stanek (echte Layouts, netto nach Genesis) auf die Zeit bis Rang 400k, auf allen gut
// geeichten V2-Laeufen (Kalibrierung kalib.mjs: Modell/gemessen 0,93-1,08). Rangmult je Referenz = der des Knotens;
// Zusatzspalte mit 0,45 (BN13) als Was-waere-wenn.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { lade, kette } from "./chain.mjs";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const L = JSON.parse(fs.readFileSync(path.join(HIER, "layouts-ergebnis.json"), "utf8"));
const wahl = (h) => L.find((z) => z.gitter.startsWith("BN13.1") && z.variante.startsWith("Kampf") && z.h === h);
const REF = [["4L2", 1], ["9L2", 0.9], ["11L3", 1], ["7L1", 0.6], ["7L2", 0.6], ["14L1", 0.6], ["14L2", 0.6], ["14L3", 0.6]];
const HS = [16, 64, 256];
const kopf = ["Referenz", "ohne h", "Genesis"].concat(HS.map((h) => "H" + h));
console.log(kopf.map((s) => s.padStart(9)).join(""));
const summe = {}; let nref = 0;
for (const rmMode of ["eigen", "0.45"]) {
  console.log("\nRangmultiplikator:", rmMode === "eigen" ? "der Referenz selbst" : "0,45 (BN13)");
  const acc = Object.fromEntries(["gen", ...HS].map((k) => [k, []]));
  for (const [tag, rm0] of REF) {
    const st = await lade(tag); const rm = rmMode === "eigen" ? rm0 : 0.45;
    const t0 = kette(st, { ab: 0, dt: 0.1, bnRank: rm }).t - st[0].h;
    const g = kette(st, { fk: { strength: .9, defense: .9, dexterity: .9, agility: .9, hacking: .9, charisma: .9 }, ab: 0, dt: 0.1, bnRank: rm }).t - st[0].h;
    const row = [tag, t0.toFixed(1), ((g / t0 - 1) * 100).toFixed(1) + "%"]; acc.gen.push(g / t0 - 1);
    for (const h of HS) {
      const z = wahl(h); const nm = z.netto;
      const t = kette(st, { fk: { strength: nm.strength, defense: nm.defense, dexterity: nm.dexterity, agility: nm.agility, hacking: .9, charisma: .9 }, bbChance: z.bbChance, ab: 0, dt: 0.1, bnRank: rm }).t - st[0].h;
      row.push(((t / t0 - 1) * 100).toFixed(1) + "%"); acc[h].push(t / t0 - 1);
    }
    console.log(row.map((s) => String(s).padStart(9)).join(""));
  }
  const mean = (a) => (a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(1) + "%";
  console.log(["Mittel", "", mean(acc.gen), ...HS.map((h) => mean(acc[h]))].map((s) => String(s).padStart(9)).join(""));
}
