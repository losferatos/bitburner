// Audit 03.10.2026 (INFRA): Zeitreihe der Infrastruktur ueber alle Backups
// eines Laufs. Aufruf: node tools/audit/infra-timeline.mjs BN10L3 [schritt]
// Spalten: Zeit seit Knoten (h), seit Einbau (h), Geld, home RAM/Kerne,
// Cloud Anzahl/GB, Hacking, Int, Augs inst+wartend, Ausgaben je Quelle
// (moneySourceA = seit letztem Einbau; B = seit Knoten), Einnahmen hacking.
import fs from "node:fs";
import { infraFacts } from "./infra-save.mjs";

const key = process.argv[2] || "BN2L1";
const step = Number(process.argv[3] || 1);
const idx = fs.readFileSync("backups/INDEX.tsv", "utf8").trim().split("\n").slice(1)
  .map((l) => l.split("\t"))
  .filter((c) => c[1].includes("_" + key + "_") && fs.existsSync("backups/" + c[1]));
const g = (x) => (x / 1e9).toFixed(2);
console.log("datei | hBN | hAug | geld e9 | home | kerne | cloud n/GB | hack | int | augs | B.servers | B.other e6 | B.augs | B.hacking | B.hosp | A.servers | A.augs");
idx.forEach((c, i) => {
  if (i % step !== 0 && i !== idx.length - 1) return;
  let f;
  try { f = infraFacts("backups/" + c[1]); } catch (e) { console.log(c[1], "FEHLER", String(e)); return; }
  const A = f.moneySourceA, B = f.moneySourceB;
  console.log([c[1].slice(19 + key.length + 2, -8), f.sinceBitnodeH.toFixed(1), f.sinceAugH.toFixed(1), g(f.money),
    f.homeRam, f.homeCores, f.purchased.length + "/" + f.purchasedRamTotal, f.hacking, f.intelligence,
    f.augsInstalled + "+" + f.augsQueued, g(B.servers || 0), ((B.other || 0) / 1e6).toFixed(0),
    g(B.augmentations || 0), g(B.hacking || 0), g(B.hospitalization || 0), g(A.servers || 0), g(A.augmentations || 0)].join(" | "));
});
