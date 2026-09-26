import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync("rows1719.json"));
const r = JSON.parse(fs.readFileSync("s1719.json"));
const p = r.player; const L = p.skills.hacking; const m = p.mults;
const intB = 1 + Math.pow(p.skills.intelligence, 0.8)/600;
const hackTime = (req, sec) => 5*((2.5*req*sec+500)/(L+50)) / (m.hacking_speed*intB);
const chance = (req, sec) => Math.min(1, Math.max(0, ((Math.max(1.75*L,1)-req)/Math.max(1.75*L,1))*((100-sec)/100)*m.hacking_chance*intB));
const pct = (req, sec) => Math.min(1, Math.max(0, ((100-sec)/100)*((L-(req-1))/L)*m.hacking_money*0.15/240));
const kf = (g, sec) => Math.min(Math.log1p(0.03/sec), 0.00349388925425578)*(g/100)*m.hacking_grow;
function growFaeden(k, mm, start, ziel){ const o=Math.max(0,start), n=Math.min(ziel,mm); if(!(n>o))return 0; let x=(n-o)/(1+(n/16+15*o/16)*k), diff=Infinity,w=0; while(Math.abs(diff)>1&&w++<60){const ox=o+x;const neu=(x-ox*Math.log(ox/n))/(1+ox*k);diff=neu-x;x=neu;} let f=Math.ceil(x); const pr=t=>(o+t)*Math.exp(k*t); if(f>0){if(pr(f-1)>=n)f--; else if(pr(f)<n)f++;} return f;}
const RH=1.75, RG=1.8, RW=1.8;
// Bot-steadyEff (kennzahlen) bei secMin
const steady = (s) => { const pm=pct(s.req,s.min), c=chance(s.req,s.min), k=kf(s.g,s.min), tH=hackTime(s.req,s.min); const gph=pm*c/k; const wph=(0.002*c+0.004*gph)/0.05; const gbs=tH*(RH+3.2*gph*RG+4*wph*RW); return s.mmax*0.95*pm*c/gbs; };
const res=[];
for (const s of rows) { if(!s.root||!s.mmax||s.pb||s.req>L) continue;
  const pm=pct(s.req,s.min), c=chance(s.req,s.min), k=kf(s.g,s.min), tH=hackTime(s.req,s.min)*1000, tW=4*tH;
  const plan=(f,gap)=>{const hackT=Math.max(1,Math.floor(f/pm)); const echt=Math.min(0.99,pm*hackT); const growT=Math.max(1,Math.ceil(growFaeden(k,s.mmax,s.mmax*(1-echt),s.mmax)*1.15)); const w1=Math.max(1,Math.ceil(hackT*0.002*1.5/0.05)); const w2=Math.max(1,Math.ceil(growT*0.004*1.5/0.05)); const slots=Math.max(1,Math.floor(tW/(4*gap))); return {ram:hackT*RH+growT*RG+(w1+w2)*RW, geld:echt*s.mmax*c, slots, perS: echt*s.mmax*c/(4*gap/1000), needGb:(hackT*RH+growT*RG+(w1+w2)*RW)*slots, effGBs: echt*s.mmax*c/((hackT*RH+growT*RG+(w1+w2)*RW)*(tW/1000))}; };
  const a=plan(0.5,400);
  res.push({n:s.n, at100:s.sec>=100, min:s.min, tW:+(tW/1000).toFixed(1), steadyEff: Math.round(steady(s)), batchEff_f05:Math.round(a.effGBs), slots:a.slots, perS_f05:a.perS.toExponential(2), needGb:Math.round(a.needGb)});
}
res.sort((a,b)=>b.steadyEff-a.steadyEff);
for (const x of res) console.log(JSON.stringify(x));
