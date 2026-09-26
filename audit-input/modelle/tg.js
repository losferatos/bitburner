const j=require('./save.json'); const d=j.data;
const S=JSON.parse(d.AllServersSave);
const t={};
for(const [h,v] of Object.entries(S)){for(const r of (v.data.runningScripts||[])){const rd=r.data; if(/hack.js|grow.js|weaken.js/.test(rd.filename)){const k=rd.filename+' '+rd.args[0]; t[k]=(t[k]||0)+rd.threads;}}}
console.log(t);
for(const n of ['ecorp','megacorp','clarkinc','omnitek','nwo','4sigma','b-and-a','blade','fulcrumtech','kuai-gong','powerhouse-fitness']){const x=S[n]&&S[n].data; if(x) console.log(n,x.moneyMax.toExponential(3),x.moneyAvailable.toExponential(3),x.minDifficulty,x.hackDifficulty,x.baseDifficulty,x.serverGrowth,x.requiredHackingSkill);}
