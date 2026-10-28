const fs=require('fs');const SPW=process.argv[2];
const t0=1793123976403;
const L=fs.readFileSync(SPW+'/aktionen.txt','utf8').trim().split('\n').map(x=>JSON.parse(x)).filter(a=>a.von>=t0);
console.log(L.length,'Abschnitte seit BN13-Start', new Date(L[0].von).toISOString(), new Date(L[L.length-1].bis).toISOString());
// pro volle Stunde Zeitanteile
const byH={};
for(const a of L){const h=new Date(a.von).toISOString().slice(5,13); byH[h]=byH[h]||{};const k=a.aktion.replace('Operations/','Op/').replace('Contracts/','C/').replace('General/','G/'); byH[h][k]=(byH[h][k]||0)+(a.bis-a.von)/60000;}
for(const [h,v] of Object.entries(byH)) console.log(h, Object.entries(v).sort((a,b)=>b[1]-a[1]).map(([k,m])=>k+' '+m.toFixed(0)).join(' | '));
// Zeitanteil insgesamt
const sum={};let tot=0;
for(const a of L){const d=(a.bis-a.von)/1000;const k=a.aktion; sum[k]=sum[k]||{t:0,n:0,rang:0}; sum[k].t+=d; sum[k].n++; if(Number.isFinite(a.rangBis)&&Number.isFinite(a.rangVon)) sum[k].rang+=a.rangBis-a.rangVon; tot+=d;}
for(const [k,v] of Object.entries(sum).sort((a,b)=>b[1].t-a[1].t)) console.log(k.padEnd(36),(v.t/60).toFixed(0).padStart(5),'min',(100*v.t/tot).toFixed(0).padStart(3)+'%','n',String(v.n).padStart(4),'rang',v.rang.toFixed(0).padStart(6),'rang/h',(v.rang/(v.t/3600)).toFixed(0));
console.log('erfasst h',(tot/3600).toFixed(2));
const grund={}; for(const a of L){const g=(a.grund||'').slice(0,60); grund[a.aktion+' | '+g]=(grund[a.aktion+' | '+g]||0)+1;}
console.log(Object.entries(grund).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,n])=>n+'x '+k).join('\n'));
