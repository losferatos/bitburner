const zlib=require('zlib'),fs=require('fs');const D='C:/Users/erche/Desktop/claude_projecto/bitburner/backups/';
for(const f of fs.readdirSync(D).filter(x=>/BN5L2/.test(x)).sort()){const s=JSON.parse(zlib.gunzipSync(fs.readFileSync(D+f)).toString());const p=JSON.parse(s.data.PlayerSave).data;const a=p.moneySourceA.data||p.moneySourceA;const all=JSON.parse(s.data.AllServersSave);
let w=0;for(const v of Object.values(all)){for(const r of v.data.runningScripts||[]) if(/worker\//.test(r.data.filename)) w+=r.data.ramUsage*r.data.threads;}
const tot=Object.values(all).reduce((x,v)=>x+(v.data.hasAdminRights?v.data.maxRam:0),0);
console.log(f.slice(28,50).padEnd(24), 'tAug', (p.playtimeSinceLastAug/1000).toFixed(0).padStart(6),'hack$',Number(a.hacking).toExponential(2),'avg/s',(a.hacking/(p.playtimeSinceLastAug/1000)).toExponential(2),'hackLvl',p.skills.hacking,'workerGB',w.toFixed(0),'/',tot, 'augs',p.augmentations.length,'q',p.queuedAugmentations.length);}
