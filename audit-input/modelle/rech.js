const t=(s)=>{const [h,m,x]=s.split(':').map(Number);return h*3600+m*60+(x||0)};
// Fokus
const f1=t('12:53:00')-t('10:26:51'), c1=t('12:53:00')-t('10:01:00');
const f2=t('16:37:00')-t('15:17:51'), c2=t('16:37:00')-t('15:12:00');
console.log('unfocused 10:26:51-12:53', (f1/60).toFixed(1),'min of cycle',(c1/60).toFixed(1),'=',(f1/c1*100).toFixed(1)+'%');
console.log('unfocused 15:17:51-16:37', (f2/60).toFixed(1),'min of cycle',(c2/60).toFixed(1),'=',(f2/c2*100).toFixed(1)+'%');
console.log('rep-verlust-aequivalent min', (f1*0.2/60).toFixed(1), (f2*0.2/60).toFixed(1));
const snaps=25, unf=14; const eff=1-0.2*unf/snaps; console.log('snapshot share',unf/snaps,'eff',eff.toFixed(4),'dauerfaktor',(1/eff).toFixed(4));
// home overhead 01:04
const home=[6.1,10.8,23.85,2.25,3.95,5.95,8.15,27.85,10.45,17.65]; const hs=home.reduce((a,b)=>a+b,0);
const aus=[13.5,5.35,10.5,63.25,4.35]; const as=aus.reduce((a,b)=>a+b,0);
console.log('home tools',hs.toFixed(2),'of 128 =',(hs/128*100).toFixed(1)+'%','; remote tools',as.toFixed(2),'; total',(hs+as).toFixed(2),'of net 1341 =',((hs+as)/1341*100).toFixed(1)+'%', '; ratio to money budget 34 GB',((hs+as)/34).toFixed(1));
// normal vs kaltstart diff
const normalOnly=[5.35,17.65,4.35,3.95,63.25,10.5]; const kaltOnly=[12.65];
console.log('normal-only',normalOnly.reduce((a,b)=>a+b,0).toFixed(2),'minus cdump',(normalOnly.reduce((a,b)=>a+b,0)-12.65).toFixed(2));
// income windows
const w=[['BN-Start 00:39:42 -> 01:04',1498,0],['01:45 -> 02:04',1138,0],['04:48 -> 05:04',959,2.07e5],['12:53 -> 13:04',658,1.87e7]];
for(const [n,s,m] of w) console.log(n, (s/60).toFixed(1),'min, hack$',m,'=',(m/s).toFixed(0),'$/s');
const r=(1.85e11-1.87e7)/(4258-658); console.log('12:53-Zyklus Folgerate',r.toExponential(3),'Obergrenze Verlust',(658*r).toExponential(3),'Anteil am Zyklus 8.07e11',(658*r/8.07e11*100).toFixed(1)+'%');
// events
console.log('events figur',315+79+3,'of',400,((315+79+3)/400*100).toFixed(1)+'%', 'Fenster', ((1790435059371-1790422758833)/3600000).toFixed(2),'h');
// log spam
console.log('bn4net-log figur frei',155,'of 200',(155/200*100).toFixed(1)+'%','Fenster 16:11:54-16:37:36',((t('16:37:36')-t('16:11:54'))/60).toFixed(1),'min');
// guard karenz
const cyc=[t('16:37')-t('15:12'),t('16:57')-t('16:37'),t('17:19')-t('16:57')].map(x=>x/60); console.log('Zyklen min',cyc, 'Karenzanteil', cyc.map(c=>(10/c*100).toFixed(0)+'%'));
// server purchase throughput
console.log('Kaufdauer 21 Rechner',(t('17:04:41')-t('16:59:29'))/60,'min');
// joinrun
console.log('joinrun ping-pong Obergrenze', 20*15,'s von Zyklus', (t('15:12')-t('12:53'))*1,'s =', (300/((t('15:12')-t('12:53')))*100).toFixed(2)+'%');
