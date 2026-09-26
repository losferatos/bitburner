import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
const dir = "C:/Users/erche/Desktop/claude_projecto/bitburner/backups";
const files = fs.readdirSync(dir).filter(f => f.includes(process.argv[2]||"BN5L2")).sort();
for (const f of files) {
  try {
    const top = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,f))).toString("utf8"));
    const t = top.data ?? top;
    const ps = typeof t.PlayerSave === "string" ? JSON.parse(t.PlayerSave) : t.PlayerSave; const p = ps.data ?? ps;
    const q = p.queuedAugmentations.map(a=>a.name);
    console.log(f.slice(28,50).padEnd(24), "hack", String(p.skills.hacking).padStart(5), "exp", p.exp.hacking.toExponential(2), "inst", p.augmentations.length, "q", q.length, "sinceAug h", (p.playtimeSinceLastAug/3.6e6).toFixed(2), "BN h", (p.playtimeSinceLastBitnode/3.6e6).toFixed(2), "money", p.money.toExponential(2), "hmult", p.mults.hacking.toFixed(2), "hexp", p.mults.hacking_exp.toFixed(2), "srv", (p.purchasedServers||[]).length, "fac", p.factions.length, q.includes("The Red Pill")?"REDPILL":"", p.augmentations.some(a=>a.name==="The Red Pill")?"RP-inst":"");
  } catch(e) { console.log(f, "ERR", e.message); }
}
