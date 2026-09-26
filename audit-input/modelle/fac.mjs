import fs from "node:fs"; import zlib from "node:zlib";
const top = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])).toString("utf8"));
const t = top.data ?? top;
const fs2 = typeof t.FactionsSave === "string" ? JSON.parse(t.FactionsSave) : t.FactionsSave;
for (const [k,v] of Object.entries(fs2)) { const d = v.data ?? v; if ((d.playerReputation||0) > 0 || (d.favor||0) > 0) console.log(k.padEnd(28), "rep", Math.round(d.playerReputation||0), "favor", (d.favor||0).toFixed(1)); }
const ps = typeof t.PlayerSave === "string" ? JSON.parse(t.PlayerSave) : t.PlayerSave; const p = ps.data ?? ps;
console.log("work", JSON.stringify(p.currentWork)?.slice(0,300));
console.log("sleeves", (p.sleeves||[]).map(s => { const d=s.data??s; return JSON.stringify({sk:d.skills?.hacking, shock:d.shock, sync:d.sync, work:(d.currentWork?.data??d.currentWork)?.type ?? d.currentWork?.ctor}) }).join(" "));
const srv = typeof t.AllServersSave === "string" ? JSON.parse(t.AllServersSave) : t.AllServersSave;
const home = srv.home?.data ?? srv.home; console.log("home ram", home?.maxRam, "cores", home?.cpuCores, "programs", home?.programs?.join(","));
const wd = srv["w0r1d_d43m0n"]?.data; console.log("wd", wd?.requiredHackingSkill);
