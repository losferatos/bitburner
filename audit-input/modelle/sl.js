// Formeln: Crime.ts:120-136, Crimes.ts, Work/Formulas.ts:58-97, reputation.ts, Share.ts, intelligence.ts
const intB=(i,w=1)=>1+w*Math.pow(i,0.8)/600;
const C={ // time, money, diff, weights
 Shoplift:[2e3,15e3,1/20,{dex:1,agi:1}], RobStore:[60e3,400e3,1/5,{hack:.5,dex:2,agi:1}], Mug:[4e3,36e3,1/5,{str:1.5,def:.5,dex:1.5,agi:.5}],
 Larceny:[90e3,800e3,1/3,{hack:.5,dex:1,agi:1}], DealDrugs:[10e3,120e3,1,{cha:3,dex:2,agi:1}], BondForgery:[300e3,4.5e6,1/2,{hack:.05,dex:1.25}],
 TraffickArms:[40e3,600e3,2,{cha:1,str:1,def:1,dex:1,agi:1}], Homicide:[3e3,45e3,1,{str:2,def:2,dex:.5,agi:.5}]};
const CrimeMoneyBN=0.5;
function chance(sk,w,diff,cs=1){let c=(w.hack||0)*sk.hack+(w.str||0)*sk.str+(w.def||0)*sk.def+(w.dex||0)*sk.dex+(w.agi||0)*sk.agi+(w.cha||0)*sk.cha+0.025*sk.int; c/=975; c/=diff; c*=cs; c*=intB(sk.int,1); return Math.min(c,1);}
const P=require('./player.json');
for(const s of P.sleeves){const x=s.data; const sk={hack:x.skills.hacking,str:x.skills.strength,def:x.skills.defense,dex:x.skills.dexterity,agi:x.skills.agility,cha:x.skills.charisma,int:x.skills.intelligence};
 const out=Object.entries(C).map(([n,[t,m,d,w]])=>{const ch=chance(sk,w,d); return [n, ch.toFixed(3), (m*CrimeMoneyBN*ch/(t/1000)).toFixed(0)];}).sort((a,b)=>b[2]-a[2]);
 console.log('Sleeve int',sk.int,'shock',x.shock.toFixed(1),'sync',x.sync, JSON.stringify(out));
 // Daedalus: hacking + field (reputation.ts), share bonus
 const shareThreads=2756*intB(P.skills.intelligence,2)*(1+(5-1)/16); const share=1+Math.log(shareThreads)/25;
 const hackRep=((sk.hack+sk.int/3)/975)*1*intB(sk.int)*1*share;
 const fieldRep=(0.9*(sk.str+sk.def+sk.dex+sk.agi+sk.cha+(sk.hack+sk.int)*share))/975/5.5*1*1*intB(sk.int);
 const shockB=(100-x.shock)/100;
 console.log('  Rep/s Daedalus: hacking',(hackRep*5*shockB).toFixed(4),' field',(fieldRep*5*shockB).toFixed(4));
}
// Spieler Faktionsarbeit hacking Daedalus (favor 0), Fokus -> kein Abzug
const sk=P.skills; const shareThreads=2756*intB(sk.intelligence,2)*(1+(5-1)/16); const share=1+Math.log(shareThreads)/25;
const pRep=((sk.hacking+sk.intelligence/3)/975)*P.mults.faction_rep*intB(sk.intelligence)*share;
console.log('share bonus',share.toFixed(4),'Spieler Rep/s hacking',(pRep*5).toFixed(2), ' 2,5 Mio Ruf in h:', (2.5e6/(pRep*5)/3600).toFixed(1));
// Schock-Erholung: Sleeve.ts:269-272 passiv 0.0001*intB(int,0.75)/Zyklus, SleeveRecoveryWork 0.0002*intB/Zyklus
for(const s of P.sleeves){const x=s.data; const b=intB(x.skills.intelligence,0.75); console.log('Schock',x.shock.toFixed(1),'-> 0: mit Recovery h',(x.shock/((0.0001+0.0002)*b*5)/3600).toFixed(1),' passiv h',(x.shock/(0.0001*b*5)/3600).toFixed(1));}
