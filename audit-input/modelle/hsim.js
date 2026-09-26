const {rate,lvlCost,ramCost,coreCost,srvCost}=require('./hn.js');
const mult=2.5148605017536005, bn=0.2, cm=0.3800979450166447;
function greedy(budget){ let nodes=[],spent=0;
 for(;;){ let best=null; const n=nodes.length;
  if(n<20){const c=srvCost(n+1,cm); const dr=rate(1,1,1,mult,bn); best={k:'buy',c,e:dr/c};}
  nodes.forEach((s,i)=>{const r0=rate(s.l,s.ram,s.c,mult,bn);
   for(const [k,c,r1] of [['lvl',lvlCost(s.l,cm),rate(s.l+1,s.ram,s.c,mult,bn)],['ram',ramCost(s.ram,cm),rate(s.l,s.ram*2,s.c,mult,bn)],['core',coreCost(s.c,cm),rate(s.l,s.ram,s.c+1,mult,bn)]]){const e=(r1-r0)/c; if(e>best.e) best={k,i,c,e};}});
  if(spent+best.c>budget) break; spent+=best.c;
  if(best.k==='buy') nodes.push({l:1,ram:1,c:1}); else {const s=nodes[best.i]; if(best.k==='lvl')s.l++; if(best.k==='ram')s.ram*=2; if(best.k==='core')s.c++;}}
 return {spent, r:nodes.reduce((a,s)=>a+rate(s.l,s.ram,s.c,mult,bn),0), n:nodes.length};}
// Simulation: Rest-Laufzeit R s, Zielertrag X $/s (the-hub), Hashes -> Increase Maximum Money sobald bezahlbar
function sim(B,R,X){const g=greedy(B); let h=0,L=0,gain=0; for(let t=0;t<R;t++){h+=g.r; while(h>=50*(L+1)){h-=50*(L+1);L++;} gain+=X*(Math.pow(1.02,L)-1);} return {B,spent:g.spent,r:g.r,L,gain,net:gain-g.spent,sell:g.r*R*250e3-g.spent};}
for(const X of [200e6,792e6]) for(const R of [1800,3600,7200]) { console.log('--- X',X.toExponential(1),'$/s  Restzeit',R,'s');
 for(const B of [1e8,1e9,5e9,1e10,3e10,1e11,3e11]){const s=sim(B,R,X); console.log(' B',B.toExponential(0),'rate',s.r.toFixed(2),'Stufen',s.L,'Gewinn',(s.gain/1e9).toFixed(1)+'G','netto',(s.net/1e9).toFixed(1)+'G','| Verkauf netto',(s.sell/1e9).toFixed(1)+'G');}}
