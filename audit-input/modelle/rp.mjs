import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
const dir = "C:/Users/erche/Desktop/claude_projecto/bitburner/backups";
for (const f of fs.readdirSync(dir).filter(f => f.includes(process.argv[2])).sort()) {
  const top = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,f))).toString("utf8")); const t = top.data ?? top;
  const ps = typeof t.PlayerSave === "string" ? JSON.parse(t.PlayerSave) : t.PlayerSave; const p = ps.data ?? ps;
  const fs2 = typeof t.FactionsSave === "string" ? JSON.parse(t.FactionsSave) : t.FactionsSave;
  const d = fs2.Daedalus?.data ?? fs2.Daedalus ?? {};
  const q = p.queuedAugmentations.map(a=>a.name);
  const w = p.currentWork?.data ?? p.currentWork;
  console.log(f.slice(28,50).padEnd(23), "BNh", (p.playtimeSinceLastBitnode/3.6e6).toFixed(2).padStart(6), "L", String(p.skills.hacking).padStart(5), "m", p.mults.hacking.toFixed(2), "inst", p.augmentations.length, "q", q.length, "Dae rep", Math.round(d.playerReputation||0), "fav", (d.favor||0).toFixed(0), "mem", p.factions.includes("Daedalus")?"j":"n", q.includes("The Red Pill")?"RP-q":"", p.augmentations.some(a=>a.name==="The Red Pill")?"RP-inst":"", "work", w?.factionName ?? w?.type ?? "-");
}
