import fs from "node:fs"; import zlib from "node:zlib";
const top = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])).toString("utf8"));
const t = top.data ?? top;
const srv = typeof t.AllServersSave === "string" ? JSON.parse(t.AllServersSave) : t.AllServersSave;
const rows=[];
for (const [name, s0] of Object.entries(srv)) { const s = s0.data ?? s0; if (!s.hasAdminRights || !s.maxRam) continue;
  let used=0; const by={}; for (const rs0 of s.runningScripts||[]) { const rs=rs0.data??rs0; const r=(rs.ramUsage||0)*(rs.threads||1); used+=r; by[rs.filename]=(by[rs.filename]||0)+r; }
  rows.push([name, s.maxRam, used, JSON.stringify(Object.fromEntries(Object.entries(by).map(([k,v])=>[k,Math.round(v)])))]); }
rows.sort((a,b)=>b[1]-a[1]); for (const r of rows.slice(0,8)) console.log(r[0].padEnd(20), r[1], Math.round(r[2]), r[3].slice(0,300));
