// G09: Textdateien von home aus einem Stand ausgeben. node verify-g09-dump.mjs <dateimuster> <datei...>
import { listRun, readSave, homeText, bbOf, fmt } from "./verify-g09-lib.mjs";
import fs from "node:fs";
const [pat, ...names] = process.argv.slice(2);
const all = fs.readdirSync("C:/Users/erche/Desktop/claude_projecto/bitburner/backups").filter((f) => f.includes(pat));
for (const f of all) {
  const { save, p } = readSave(f);
  console.log("=====", f, "h", fmt(p.playtimeSinceLastBitnode / 3.6e6, 2));
  for (const n of names) {
    const t = homeText(save, n);
    console.log("--", n, t ? t.length : "fehlt");
    if (t) console.log(t.slice(0, 3500));
  }
}
