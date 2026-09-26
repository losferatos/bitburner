import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync(process.argv[2]));
const r = JSON.parse(fs.readFileSync(process.argv[3]));
const p = r.player; const L = p.skills.hacking; const m = p.mults;
const intB = 1 + Math.pow(p.skills.intelligence, 0.8)/600;
const BNEXP = 0.5, BNSHM = 0.15;
const hackTime = (req, sec) => 5*((2.5*req*sec+500)/(L+50)) / (m.hacking_speed*intB);
const chance = (req, sec) => Math.min(1, Math.max(0, ((Math.max(1.75*L,1)-req)/Math.max(1.75*L,1))*((100-sec)/100)*m.hacking_chance*intB));
const pct = (req, sec) => Math.min(1, Math.max(0, ((100-sec)/100)*((L-(req-1))/L)*m.hacking_money*BNSHM/240));
const out=[];
for (const s of rows) {
  if (!s.root || !s.base || s.req > L || s.pb) continue;
  const E = (3+0.3*s.base)*m.hacking_exp*BNEXP;
  const tH = hackTime(s.req, s.min);
  const c = chance(s.req, s.min);
  out.push({n:s.n, base:s.base, min:s.min, req:s.req, E:+E.toFixed(1), tH:+tH.toFixed(3), c:+c.toFixed(3), pct:+pct(s.req,s.min).toExponential(3),
    wExpPerGBs: +(E/(4*tH*1.75)).toFixed(2), gExpPerGBs: +(E/(3.2*tH*1.75)).toFixed(2), hExpPerGBs: +(E*(c+(1-c)/4)/(tH*1.7)).toFixed(2),
    botRank: +((3+0.3*s.base)/((2.5*s.req*s.min+500)/(L+50))).toFixed(3)});
}
out.sort((a,b)=>b.wExpPerGBs-a.wExpPerGBs);
for (const o of out.slice(0,12)) console.log(JSON.stringify(o));
console.log("L",L,"intB",intB.toFixed(4),"speed",m.hacking_speed);
