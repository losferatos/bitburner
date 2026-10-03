// Audit 03.10.2026 (INFRA): gibt Textdateien von home aus einem Spielstand aus.
// Aufruf: node tools/audit/infra-files.mjs <datei.json.gz> <regex> [maxZeichen]
import { readSave } from "./infra-save.mjs";

const [file, pattern, maxArg] = process.argv.slice(2);
const max = Number(maxArg || 6000);
const { servers } = readSave(file);
const home = servers.home.data;
const re = new RegExp(pattern || ".");
for (const [name, tf] of home.textFiles.data) {
  if (!re.test(name)) continue;
  const text = tf && tf.data ? tf.data.text : (tf.text || "");
  console.log("===== " + name + " (" + text.length + " Zeichen)");
  console.log(text.length > max ? "...\n" + text.slice(-max) : text);
}
