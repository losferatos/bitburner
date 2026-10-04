// G09-Betrieb: rohe currentWork der Sleeves aus einem Spielstand. Aufruf: node ... <backupmuster>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave } from "./sleeve-save.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pat = process.argv[2];
const f = fs.readdirSync(path.join(root, "backups")).filter((x) => x.includes(pat))[0];
const { player: p } = loadSave(path.join(root, "backups", f));
console.log(f);
for (const s of p.sleeves) { const d = s.data || s; console.log(JSON.stringify(d.currentWork).slice(0, 300), "| city", d.city, "| cha", d.skills.charisma, "| storedCycles", d.storedCycles); }
