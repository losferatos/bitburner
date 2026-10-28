const fs=require('fs');const SPW=process.argv[2];
const r=JSON.parse(fs.readFileSync(SPW+'/akt_raw.json','utf8')).result;
fs.writeFileSync(SPW+'/aktionen.txt',r);
const L=r.trim().split('\n').map(x=>JSON.parse(x));
console.log(L.length, new Date(L[0].von).toISOString(), new Date(L[L.length-1].bis).toISOString());
const sum={};let tot=0;
for(const a of L){const d=(a.bis-a.von)/1000; const k=a.aktion; sum[k]=sum[k]||{t:0,n:0,rang:0}; sum[k].t+=d; sum[k].n++; if(Number.isFinite(a.rangBis)&&Number.isFinite(a.rangVon)) sum[k].rang+=a.rangBis-a.rangVon; tot+=d;}
for(const [k,v] of Object.entries(sum).sort((a,b)=>b[1].t-a[1].t)) console.log(k.padEnd(40),(v.t/60).toFixed(0).padStart(5),'min',(100*v.t/tot).toFixed(0).padStart(3)+'%','n',String(v.n).padStart(4),'rang',v.rang.toFixed(0).padStart(6),'rang/h',(v.rang/(v.t/3600)).toFixed(0));
console.log('total h',(tot/3600).toFixed(2));
