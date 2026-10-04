// Gegenpruefung G05: data/bn4net.json (brachAnteil, kapFreiGb, mischung.grenz) aus Spielstaenden. Aufruf: node tools/audit/verify-g05-bn4net.mjs <backups...>
import { loadSave, textFile } from "./hack-save.mjs";
for (const f of process.argv.slice(2)) {
  const { servers } = loadSave(f);
  const t = textFile(servers.home, "data/bn4net.json");
  if (!t) { console.log(f, "keine bn4net.json"); continue; }
  const j = JSON.parse(t);
  console.log(f.split("_").slice(-2).join("_"), "brachAnteil", j.brachAnteil, "kapFreiGb", j.kapFreiGb ?? (j.mischung && j.mischung.kapFreiGb), "ramTotal", j.ramTotal, "mischung.grenz", JSON.stringify(j.mischung && j.mischung.grenz), "keys", Object.keys(j).slice(0,40).join(","));
}
