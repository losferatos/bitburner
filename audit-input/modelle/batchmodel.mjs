import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync(process.argv[2]));
const r = JSON.parse(fs.readFileSync(process.argv[3]));
const p = r.player; const L = p.skills.hacking; const m = p.mults;
const intB = 1 + Math.pow(p.skills.intelligence, 0.8)/600;
const BNEXP=0.5, BNSHM=0.15, BNGROW=1;
const hackTime = (req, sec) => 5*((2.5*req*sec+500)/(L+50)) / (m.hacking_speed*intB);
const chance = (req, sec) => Math.min(1, Math.max(0, ((Math.max(1.75*L,1)-req)/Math.max(1.75*L,1))*((100-sec)/100)*m.hacking_chance*intB));
const pct = (req, sec) => Math.min(1, Math.max(0, ((100-sec)/100)*((L-(req-1))/L)*m.hacking_money*BNSHM/240));
const kf = (g, sec, cores=1) => Math.min(Math.log1p(0.03/sec), 0.00349388925425578)*(g/100)*BNGROW*m.hacking_grow*(1+(cores-1)/16);
function growFaeden(k, moneyMax, start, ziel){ const o=Math.max(0,start), n=Math.min(ziel,moneyMax); if(!(n>o))return 0; let x=(n-o)/(1+(n/16+15*o/16)*k), diff=Infinity,w=0; while(Math.abs(diff)>1&&w++<60){const ox=o+x;const neu=(x-ox*Math.log(ox/n))/(1+ox*k);diff=neu-x;x=neu;} let f=Math.ceil(x); const pr=t=>(o+t)*Math.exp(k*t); if(f>0){if(pr(f-1)>=n)f--; else if(pr(f)<n)f++;} return f;}
const RH=1.75, RG=1.8, RW=1.8, GAP=400;
const E = (base)=> (3+0.3*base)*m.hacking_exp*BNEXP;
const out=[];
for (const s of rows) {
  if (!s.root || !s.mmax || s.req > L || s.pb) continue;
  const pm = pct(s.req, s.min), c = chance(s.req, s.min), k = kf(s.g, s.min);
  const tH = hackTime(s.req, s.min)*1000, tW = 4*tH;
  const slots = Math.max(1, Math.floor(tW/(4*GAP)));
  const plan = (f, gm=1.15, wm=1.5) => { const hackT=Math.max(1,Math.floor(f/pm)); const echt=Math.min(0.99,pm*hackT); const growT=Math.max(1,Math.ceil(growFaeden(k,s.mmax,s.mmax*(1-echt),s.mmax)*gm)); const w1=Math.max(1,Math.ceil(hackT*0.002*wm/0.05)); const w2=Math.max(1,Math.ceil(growT*0.004*wm/0.05)); return {hackT,growT,w1,w2,echt, ram: hackT*RH+growT*RG+(w1+w2)*RW, geld: echt*s.mmax*c}; };
  const p5 = plan(0.5), p9 = plan(0.9);
  // RAM-Sekunden je Stapel: alle Ops halten RAM bis zur Landung ~ tW (+ Vorlauf bis 14 s, Mittel ~7 s)
  out.push({n:s.n, req:s.req, mmax:s.mmax.toExponential(2), c:+c.toFixed(3), tW_s:+(tW/1000).toFixed(2), slots,
    f05_perS:(p5.geld/1.6).toExponential(2), f05_stapelGb:Math.round(p5.ram), f05_needGb: Math.round(p5.ram*slots),
    f09_perS:(p9.geld/1.6).toExponential(2), f09_needGb: Math.round(p9.ram*slots),
    E:+E(s.base).toFixed(1)});
}
out.sort((a,b)=>Number(b.f05_perS)-Number(a.f05_perS));
for (const o of out.slice(0,25)) console.log(JSON.stringify(o));
console.log("L",L);
