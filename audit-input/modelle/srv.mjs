import fs from "node:fs";
const r = JSON.parse(fs.readFileSync(process.argv[2]));
const S = r.servers;
let tot=0, rootTot=0, used=0; const perScript = {}; const perTarget={};
const rows=[];
for (const [n, o] of Object.entries(S)) {
  const s = o.data;
  if (s.hasAdminRights) { rootTot += s.maxRam; }
  tot += s.maxRam;
  let u=0;
  for (const rs of (s.runningScripts||[])) {
    const d = rs.data||rs; const th = d.threads; const ram = d.ramUsage*th; u+=ram;
    const k = d.filename; perScript[k] = perScript[k]||{threads:0, gb:0}; perScript[k].threads+=th; perScript[k].gb+=ram;
    if (k.startsWith("worker/")) { const t = String(d.args[0]); const kk = k+"->"+t; perTarget[kk]=(perTarget[kk]||0)+th; }
  }
  used+=u;
  rows.push({n, ram:s.maxRam, cores:s.cpuCores, root:s.hasAdminRights, used:Math.round(u), base:s.baseDifficulty, min:s.minDifficulty, sec:s.hackDifficulty, req:s.requiredHackingSkill, mmax:s.moneyMax, m:s.moneyAvailable, g:s.serverGrowth, pb:s.purchasedByPlayer});
}
console.log("rootRam", rootTot, "used", Math.round(used));
console.log(JSON.stringify(perScript));
console.log(JSON.stringify(Object.entries(perTarget).sort((a,b)=>b[1]-a[1]).slice(0,30)));
fs.writeFileSync(process.argv[3], JSON.stringify(rows));
rows.sort((a,b)=>b.ram-a.ram); for (const x of rows.slice(0,40)) console.log(JSON.stringify(x));
