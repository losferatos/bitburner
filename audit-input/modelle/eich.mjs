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
const RH=1.75, RG=1.8, RW=1.8, GAP=400, F=[0.02,0.05,0.1,0.15,0.2,0.3,0.4,0.5];
const ramTotal = 91896; const wunsch = ramTotal*0.15;
for (const n of ["phantasy","the-hub","max-hardware"]) {
  const s = rows.find(x=>x.n===n);
  const pm=pct(s.req,s.min), c=chance(s.req,s.min), k=kf(s.g,s.min), tH=hackTime(s.req,s.min)*1000, tW=4*tH;
  const slots=Math.max(1,Math.floor(tW/(4*GAP)));
  const plan=f=>{const hackT=Math.max(1,Math.floor(f/pm)); const echt=Math.min(0.99,pm*hackT); const growT=Math.max(1,Math.ceil(growFaeden(k,s.mmax,s.mmax*(1-echt),s.mmax)*1.15)); const w1=Math.max(1,Math.ceil(hackT*0.002*1.5/0.05)); const w2=Math.max(1,Math.ceil(growT*0.004*1.5/0.05)); return {hackT,growT,w1,w2,ram:hackT*RH+growT*RG+(w1+w2)*RW, geld:echt*s.mmax*c};};
  let fi=F.length-1; for(let i=0;i<F.length;i++){ fi=i; if(plan(F[i]).ram*slots>=wunsch)break; }
  const pl=plan(F[fi]);
  console.log(n, "f",F[fi],"slots",slots,"stapelGb",Math.round(pl.ram),"erwartetProS",Math.round(pl.geld/1.6), "tW_s",(tW/1000).toFixed(2), JSON.stringify(pl));
}
