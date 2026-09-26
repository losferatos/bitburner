import zlib from "node:zlib"; import fs from "node:fs";
const f = process.argv[2]; const out = process.argv[3];
const s = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString("utf8"));
const d = s.data;
const all = JSON.parse(d.AllServersSave);
fs.mkdirSync(out,{recursive:true});
const home = all.home.data;
for (const [k,v] of home.textFiles.data) fs.writeFileSync(out+"/"+k.replace(/\//g,"__"), v.data.text);
const lines=[];
for (const [hn,sv] of Object.entries(all)) { const x=sv.data; for (const r of (x.runningScripts||[])) { const y=r.data; lines.push([hn,y.filename,y.threads,y.ramUsage,(y.args||[]).join(","),Math.round(y.onlineRunningTime)].join(" ")); } }
fs.writeFileSync(out+"/_running.txt", lines.filter(l=>!/worker\//.test(l)).join("\n")+"\n#workers "+lines.filter(l=>/worker\//.test(l)).length);
const p = JSON.parse(d.PlayerSave).data;
const srv = Object.entries(all).map(([k,v])=>[k,v.data.maxRam,v.data.purchasedByPlayer]).filter(x=>x[2]||x[0]==="home");
fs.writeFileSync(out+"/_player.json", JSON.stringify({money:p.money, lastUpdate:p.lastUpdate, totalPlaytime:p.totalPlaytime, playtimeSinceLastAug:p.playtimeSinceLastAug, lastAugReset:p.lastAugReset, lastNodeReset:p.lastNodeReset, currentWork:p.currentWork, focus:p.focus, homeRam: home.maxRam, cores: home.cpuCores, skills:p.skills, bitNodeN:p.bitNodeN, augs:(p.augmentations||[]).length, queued:(p.queuedAugmentations||[]).map(a=>a.name), purchased:srv, sleeves:(p.sleeves||[]).length},null,1));
console.log(fs.readFileSync(out+"/_running.txt","utf8"));
