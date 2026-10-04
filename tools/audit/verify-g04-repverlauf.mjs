// Audit 04.10.2026, Gegenpruefung G04: Faktionsruf ueber die Staende eines Knotens.
// Soll BN2 (FactionPassiveRepGain 0): Ruf der Nicht-Gang-Faktionen steigt nicht passiv.
// Aufruf: node tools/audit/verify-g04-repverlauf.mjs <muster> [faktion,...]
import fs from "node:fs";
import { loadSave } from "./hack-save.mjs";
const muster = process.argv[2] || "BN2L1";
const namen = (process.argv[3] || "Sector-12,Aevum,CyberSec,Tian Di Hui,Netburners,NiteSec,The Black Hand,Slum Snakes,Bladeburners").split(",");
const files = fs.readdirSync("backups").filter((f) => f.includes(muster) && f.endsWith(".json.gz")).sort();
console.log("stand\tsinceAug_h\t" + namen.join("\t"));
for (const f of files) {
  const { save, p } = loadSave("backups/" + f);
  const facs = JSON.parse(save.data.FactionsSave);
  console.log([f.replace(/^LIVE_\w+?_/, "").replace(".json.gz", "").slice(5, 28), (p.playtimeSinceLastAug / 3.6e6).toFixed(2),
    ...namen.map((n) => facs[n] && facs[n].playerReputation != null ? Math.round(facs[n].playerReputation) + (p.factions.includes(n) ? "" : "(nm)") : "-")].join("\t"));
}
