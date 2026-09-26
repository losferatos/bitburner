import fs from "node:fs"; import zlib from "node:zlib";
const top = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2])).toString("utf8"));
const t = top.data ?? top;
const srv = typeof t.AllServersSave === "string" ? JSON.parse(t.AllServersSave) : t.AllServersSave;
const agg = {}; let total = 0, maxTot = 0; const sizes = [];
for (const [name, s0] of Object.entries(srv)) {
  const s = s0.data ?? s0; if (!s.hasAdminRights) continue; maxTot += s.maxRam || 0;
  if (s.purchasedByPlayer && name !== "home") sizes.push(s.maxRam);
  for (const rs0 of s.runningScripts || []) { const rs = rs0.data ?? rs0;
    const key = rs.filename + " " + (String(rs.filename).startsWith("worker/") ? String(rs.args?.[0]) : "");
    const ram = (rs.ramUsage || 0) * (rs.threads || 1);
    agg[key] = (agg[key] || 0) + ram; total += ram; }
}
console.log("maxRam total (rooted)", maxTot.toExponential(3), "used", total.toExponential(3), "cloud sizes", JSON.stringify(sizes.slice(0,30)));
for (const [k,v] of Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,25)) console.log(k.padEnd(45), v.toExponential(3), (100*v/total).toFixed(1)+"%");
