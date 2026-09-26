import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
const dir = "C:/Users/erche/Desktop/claude_projecto/bitburner/backups";
for (const f of fs.readdirSync(dir).filter(f => f.includes(process.argv[2])).sort()) {
  const top = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,f))).toString("utf8")); const t = top.data ?? top;
  const srv = typeof t.AllServersSave === "string" ? JSON.parse(t.AllServersSave) : t.AllServersSave;
  const ps = typeof t.PlayerSave === "string" ? JSON.parse(t.PlayerSave) : t.PlayerSave; const p = ps.data ?? ps;
  let cloud = [], used = 0, max = 0, share = 0, idleHome = 0;
  for (const [n, s0] of Object.entries(srv)) { const s = s0.data ?? s0; if (!s.hasAdminRights) continue; max += s.maxRam||0;
    let u = 0; for (const r0 of s.runningScripts||[]) { const r = r0.data??r0; const x=(r.ramUsage||0)*(r.threads||1); u+=x; if (r.filename==="worker/share.js") share+=x; }
    used += u; if (n==="home") idleHome = s.maxRam - u;
    if (s.purchasedByPlayer && n !== "home") cloud.push(s.maxRam); }
  cloud.sort((a,b)=>b-a);
  console.log(f.slice(28,50).padEnd(23), "money", p.money.toExponential(2), "cloudN", cloud.length, "cloud max/min", cloud[0], cloud[cloud.length-1], "netz", max.toExponential(2), "genutzt", (100*used/max).toFixed(0)+"%", "share", (100*share/max).toFixed(0)+"%", "home frei", idleHome.toExponential(2));
}
