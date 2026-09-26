const j=require('./save.json'); const d=j.data;
const S=JSON.parse(d.AllServersSave);
const home=S.home.data; const tf=home.textFiles; const files=(tf.data||tf);
for(const f of files){ if(f[0]==='data/contracts.txt'){ const t=f[1].data?f[1].data.text:f[1].text; require('fs').writeFileSync('contracts.txt',t);} }
// Offene Vertraege im Netz
let n=0; for(const [h,v] of Object.entries(S)){for(const c of (v.data.contracts||[])){n++; const x=c.data; console.log(h,x.fn,x.type,JSON.stringify(x.reward),x.tries);}}
console.log('offen',n);
const P=JSON.parse(d.PlayerSave).data; console.log('jobs',JSON.stringify(P.jobs));
