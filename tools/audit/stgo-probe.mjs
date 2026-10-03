// Audit 03.10.2026, STGO: Hilfsprobe - zeigt Spielerwerte und Textdateien auf
// home aus einem Spielstand, um Eichpunkte zu finden. Nur lesen.
// Aufruf: node tools/audit/stgo-probe.mjs <backup-datei>
import path from "node:path";
import { readSave } from "./stgo-save-scan.mjs";

const file = process.argv[2];
const save = readSave(path.resolve(file));
const d = save.data ?? save;
const ps = JSON.parse(d.PlayerSave);
const p = ps.data;
console.log("bitNodeN", p.bitNodeN, "skills", JSON.stringify(p.skills));
console.log("exp", JSON.stringify(p.exp));
console.log("mults", JSON.stringify(p.mults));
const all = JSON.parse(d.AllServersSave);
const home = all.home?.data ?? all.home;
const tf = home.textFiles ?? [];
const list = Array.isArray(tf) ? tf : (tf.data ?? Object.entries(tf));
for (const e of list) {
  const name = e?.data?.filename ?? e?.[0] ?? e?.filename;
  const text = e?.data?.text ?? e?.[1]?.data?.text ?? e?.text ?? "";
  if (/chance/i.test(text)) console.log("TEXT", name, text.length);
}

// Volltext ausgewaehlter Telemetriedateien (Eichpunkte)
const want = (process.argv[3] ?? "").split(",").filter(Boolean);
for (const e of list) {
  const name = e?.data?.filename ?? e?.[0] ?? e?.filename;
  const text = e?.data?.text ?? e?.[1]?.data?.text ?? e?.text ?? "";
  if (want.includes(name)) console.log("=====", name, "\n" + text);
}
