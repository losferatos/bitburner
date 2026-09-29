import { buildWorld, N } from '../src/world.js';
import fs from 'node:fs';
const t0 = performance.now();
const w = await buildWorld();
console.log('ms', (performance.now()-t0).toFixed(0), 'road len', w.road.length.toFixed(0), 'M', w.road.M);
let mn=1e9,mx=-1e9; for (const v of w.H){mn=Math.min(mn,v);mx=Math.max(mx,v);} console.log('h range',mn,mx);
let ymin=1e9,ymax=-1e9; for(const v of w.road.Y){ymin=Math.min(ymin,v);ymax=Math.max(ymax,v);} console.log('road y', ymin, ymax);
const S=512, f=N/S; const buf=Buffer.alloc(S*S*3);
for(let j=0;j<S;j++)for(let i=0;i<S;i++){const idx=(j*f)*N+i*f;const h=w.H[idx];const ny=w.NRM[idx*4+1]/255;const sh=w.NRM[idx*4]/255;
let c; if(h<0){const d=Math.min(1,-h/50);c=[20,80+100*(1-d),120+100*(1-d)];} else {const l=0.5+0.8*(sh-0.5)*-1+0.3; c=h>300?[240,240,240]:h<3?[220,200,150]:[60+h*0.4,120+h*0.2,50]; c=c.map(v=>v*Math.max(0.3,Math.min(1.4,l)));}
if(w.D[idx]<5)c=[40,40,40];
buf.set(c.map(v=>Math.max(0,Math.min(255,v))),(j*S+i)*3);}
fs.writeFileSync('/tmp/claude-0/-home-user-bitburner/10a8a711-b75b-54b5-badb-20b82456bd1d/scratchpad/map.ppm', Buffer.concat([Buffer.from(`P6 ${S} ${S} 255\n`),buf]));
