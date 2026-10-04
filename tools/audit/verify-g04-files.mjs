// Audit 03.10.2026, Gegenpruefung G04: Textdateien auf home eines Standes auflisten / ausgeben
// Aufruf: node tools/audit/verify-g04-files.mjs <backup> [name ...]
import { loadSave, textFile } from "./hack-save.mjs";
const { servers } = loadSave(process.argv[2]);
const tf = servers.home.textFiles;
const arr = tf && tf.data ? tf.data : Array.isArray(tf) ? tf : [];
const names = process.argv.slice(3);
if (!names.length) {
  for (const e of arr) { const [path, obj] = Array.isArray(e) ? e : [e.filename, e]; const d = obj && obj.data ? obj.data : obj; console.log(path, String((d && (d.text ?? d.content)) || "").length); }
} else for (const n of names) { console.log("=== " + n); console.log(textFile(servers.home, n)); }
