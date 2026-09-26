const j=require('./save.json'); const d=j.data;
const S=JSON.parse(d.AllServersSave);
const cnt={};
for(const [h,v] of Object.entries(S)){const x=v.data; for(const r of (x.runningScripts||[])){const rd=r.data; const k=rd.filename; if(!cnt[k])cnt[k]={n:0,threads:0,ram:0,hosts:new Set()}; cnt[k].n++; cnt[k].threads+=rd.threads; cnt[k].ram+=rd.ramUsage*rd.threads; cnt[k].hosts.add(h);}}
for(const [k,v] of Object.entries(cnt).sort((a,b)=>b[1].ram-a[1].ram)) console.log(k.padEnd(30),v.n,v.threads,v.ram.toFixed(1),[...v.hosts].slice(0,3).join(','));
// files on home data/
const home=S.home.data; const tf=home.textFiles; 
const files=(tf.data||tf).map? (tf.data||tf):Object.entries(tf);
for(const f of files){const fn=f[0]||f.filename; if(/hashes|sleeve|hacknet|verfahren|contracts|kontrakt|ziel|batch|target|geldbedarf|darkweb|graft/i.test(fn)) {const t=(f[1]&&f[1].data? f[1].data.text: (f[1]&&f[1].text)) ; console.log('FILE',fn, String(t).slice(0,600));}}
