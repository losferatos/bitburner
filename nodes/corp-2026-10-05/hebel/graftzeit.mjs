// Hebel-Vorlage 06.10.2026: Graft-Kosten und -Dauer nach GraftableAugmentation.ts (cost = baseCost x 3,
// time = (1 h x log2(Summe Mults != 1) + 0,5 h) / 2) / Int-Bonus (GraftingHelpers.ts, intelligence.ts) / Fokus.
// Eichung gegen Spiel-API-Werte aus data/bbgraft.json + data/graft.json (BN10, Int 97). Nur lesen.
import { loadAugs } from "../../../tools/audit/aug-data.mjs";
export const AUGS = loadAugs();
export const intBonus = (int) => 1 + Math.pow(int, 0.8) / 600;
export function graftH(name, int = 155, focus = true) {
  const m = Object.values(AUGS[name].mults || {}).filter((x) => x !== 1);
  const s = Math.max(1, m.reduce((a, b) => a + b, 0));
  return (Math.log2(s) + 0.5) / 2 / intBonus(int) / (focus ? 1 : 0.8);
}
export const graftCost = (name) => AUGS[name].moneyCost * 3;
if ((process.argv[1] || "").endsWith("graftzeit.mjs")) {
  const eich = [["Augmented Targeting III", 1485151.5228696228], ["Synthetic Heart", 4402713.013703567], ["Graphene Bionic Legs Upgrade", 51.3 * 60000]];
  for (const [n, ms] of eich) console.log("EICHUNG", n.padEnd(30), "Formel", (graftH(n, 97) * 3.6e6).toFixed(1), "ms  Spiel", ms.toFixed(1), "Abw.", ((graftH(n, 97) * 3.6e6 / ms - 1) * 100).toFixed(4), "%");
  for (const n of ["The Blade's Simulacrum", "Neuroreceptor Management Implant", "SPTN-97 Gene Modification", "Bionic Legs", "Graphene Bionic Legs Upgrade", "Bionic Spine", "Graphene Bionic Spine Upgrade", "Synthetic Heart", "Photosynthetic Cells", "CordiARC Fusion Reactor", "NEMEAN Subdermal Weave", "Graphene Bone Lacings", "Bionic Arms", "Graphene Bionic Arms Upgrade", "Hyperion Plasma Cannon V1", "Hyperion Plasma Cannon V2"])
    console.log(n.padEnd(34), "Kosten", (graftCost(n) / 1e9).toFixed(2).padStart(8), "Mrd  Dauer Int155 fokussiert", graftH(n).toFixed(2), "h, ohne Fokus", graftH(n, 155, false).toFixed(2), "h  Faktionen", AUGS[n].factions.join("/"), "Vorauss.", (AUGS[n].prereqs || []).join("/"));
}
