// Gegenpruefung G05: Textdateien von home aus einem Spielstand lesen.
// Aufruf: node tools/audit/verify-g05-files.mjs <backup.json.gz> name1 name2 ...
import { loadSave, textFile } from "./hack-save.mjs";
const [file, ...names] = process.argv.slice(2);
const { servers } = loadSave(file);
for (const n of names) {
  console.log("=== " + n);
  const t = textFile(servers.home, n);
  console.log(t === null ? "(fehlt)" : String(t).slice(0, 6000));
}
