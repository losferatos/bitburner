import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync("rows1719.json"));
const r = JSON.parse(fs.readFileSync("s1719.json"));
const p = r.player; const L = p.skills.hacking; const m = p.mults;
const intB = 1 + Math.pow(p.skills.intelligence, 0.8)/600;
const hackTime = (req, sec) => 5*((2.5*req*sec+500)/(L+50)) / (m.hacking_speed*intB);
const pct = (req, sec) => Math.min(1, Math.max(0, ((100-sec)/100)*((L-(req-1))/L)*m.hacking_money*0.15/240));
const kf = (g, sec, cores=1) => Math.min(Math.log1p(0.03/sec), 0.00349388925425578)*(g/100)*m.hacking_grow*(1+(cores-1)/16);
function growFaeden(k, mm, start, ziel){ const o=Math.max(0,start), n=Math.min(ziel,mm); if(!(n>o))return 0; let x=(n-o)/(1+(n/16+15*o/16)*k), diff=Infinity,w=0; while(Math.abs(diff)>1&&w++<60){const ox=o+x;const neu=(x-ox*Math.log(ox/n))/(1+ox*k);diff=neu-x;x=neu;} let f=Math.ceil(x); const pr=t=>(o+t)*Math.exp(k*t); if(f>0){if(pr(f-1)>=n)f--; else if(pr(f)<n)f++;} return f;}
for (const n of ["clarkinc","the-hub"]) { const s = rows.find(x=>x.n===n);
 const pm=pct(s.req,s.min);
 const plan=(f,gm,wm,cores)=>{const k=kf(s.g,s.min,cores); const cb=1+(cores-1)/16; const hackT=Math.max(1,Math.floor(f/pm)); const echt=pm*hackT; const growT=Math.max(1,Math.ceil(growFaeden(k,s.mmax,s.mmax*(1-echt),s.mmax)*gm)); const w1=Math.max(1,Math.ceil(hackT*0.002*wm/(0.05*cb))); const w2=Math.max(1,Math.ceil(growT*0.004*wm/(0.05*cb))); const ram=hackT*1.75+growT*1.8+(w1+w2)*1.8; return {hackT,growT,w1,w2,ram:Math.round(ram), growShare:+(growT*1.8/ram).toFixed(3)};};
 for (const f of [0.05,0.3]) { const a=plan(f,1.15,1.5,1), b=plan(f,1.15,1.5,5), c=plan(f,1.03,1.1,1), d=plan(f,1.03,1.1,5);
  console.log(n,"f",f,"bot",JSON.stringify(a),"| 5 Kerne",b.ram,(1-b.ram/a.ram).toFixed(3),"| Margen 1.03/1.1",c.ram,(1-c.ram/a.ram).toFixed(3),"| beides",d.ram,(1-d.ram/a.ram).toFixed(3)); }
 // p-Drift ueber tW+14s bei 0.35 lvl/s
 const tW=4*hackTime(s.req,s.min); const dl=0.35*(tW+14); console.log(n,"tW",tW.toFixed(0),"Leveldrift",dl.toFixed(0),"dp/p",((s.req-1)/(L*(L-s.req+1))*dl*100).toFixed(2)+"%");
}
