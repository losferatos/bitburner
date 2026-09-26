// Hacknet-Server-Formeln aus Hacknet/formulas/HacknetServers.ts nachgebaut
const C={HashesPerLevel:0.001,BaseCost:50e3,RamBaseCost:200e3,CoreBaseCost:1e6,PurchaseMult:3.2,UpgradeLevelMult:1.1,UpgradeRamMult:1.4,UpgradeCoreMult:1.55,MaxLevel:300,MaxRam:8192,MaxCores:128};
const rate=(l,ram,c,mult,bn)=>C.HashesPerLevel*l*Math.pow(1.07,Math.log2(ram))*(1+(c-1)/5)*mult*bn;
const lvlCost=(l,cm)=>l+1>C.MaxLevel?Infinity:10*C.BaseCost*Math.pow(C.UpgradeLevelMult,l)*cm; // startingLevel l -> l+1 (loop i=0: pow(mult,currLevel=l))
const ramCost=(ram,cm)=>ram*2>C.MaxRam?Infinity:ram*C.RamBaseCost*Math.pow(C.UpgradeRamMult,Math.round(Math.log2(ram)))*cm;
const coreCost=(c,cm)=>c+1>C.MaxCores?Infinity:C.CoreBaseCost*Math.pow(C.UpgradeCoreMult,c-1)*cm;
const srvCost=(n,cm)=>C.BaseCost*Math.pow(C.PurchaseMult,n-1)*cm; // n = numNodes+1? check
module.exports={rate,lvlCost,ramCost,coreCost,srvCost};
if(require.main===module){
 // Eichung: Spielstand hacknet-server-0 L2 C1 RAM2 -> hashRate 0.001076360294750541
 const mult=2.5148605017536005, bn=0.2, cm=0.3800979450166447;
 console.log('eich server0',rate(2,2,1,mult,bn),'save 0.001076360294750541');
 console.log('eich server2',rate(1,1,1,mult,bn),'save 0.0005029721003507202');
 // Greedy: Budget -> max Hash-Rate
 function greedy(budget,maxServers=20){
  let nodes=[],spent=0; const hist=[];
  for(;;){
   let best=null;
   // neuer Server
   const n=nodes.length;
   if(n<maxServers){const c=srvCost(n+1,cm); /* purchase: calculateServerCost(numNodes+1)? */ const dr=rate(1,1,1,mult,bn); best={k:'buy',c,dr,e:dr/c};}
   nodes.forEach((s,i)=>{
     const r0=rate(s.l,s.ram,s.c,mult,bn);
     let c=lvlCost(s.l,cm), dr=rate(s.l+1,s.ram,s.c,mult,bn)-r0; if(dr/c>(best?best.e:0)) best={k:'lvl',i,c,dr,e:dr/c};
     c=ramCost(s.ram,cm); dr=rate(s.l,s.ram*2,s.c,mult,bn)-r0; if(dr/c>best.e) best={k:'ram',i,c,dr,e:dr/c};
     c=coreCost(s.c,cm); dr=rate(s.l,s.ram,s.c+1,mult,bn)-r0; if(dr/c>best.e) best={k:'core',i,c,dr,e:dr/c};
   });
   if(!best||spent+best.c>budget) break;
   spent+=best.c;
   if(best.k==='buy') nodes.push({l:1,ram:1,c:1}); else {const s=nodes[best.i]; if(best.k==='lvl')s.l++; if(best.k==='ram')s.ram*=2; if(best.k==='core')s.c++;}
  }
  const r=nodes.reduce((a,s)=>a+rate(s.l,s.ram,s.c,mult,bn),0);
  return {spent,r,n:nodes.length,ex:nodes[0]};
 }
 for(const B of [1e6,1e8,1e9,1e10,5e10,1e11,5e11,1e12,1e13]){const g=greedy(B); console.log('budget',B.toExponential(0),'rate h/s',g.r.toFixed(3),'servers',g.n,'srv0',JSON.stringify(g.ex),'  sell $/s',(g.r*250e3).toExponential(2),' payback s (sell)',(g.spent/(g.r*250e3)).toFixed(0));}
}
