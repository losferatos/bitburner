const j=require('./save.json'); const d=j.data;
const F=JSON.parse(d.FactionsSave);
for(const [k,v] of Object.entries(F)){const x=v.data||v; if(x.playerReputation>0||x.favor>0) console.log(k,Math.round(x.playerReputation),x.favor,x.alreadyInvited,x.isMember);}
const S=JSON.parse(d.AllServersSave);
const hn=Object.entries(S).filter(([k,v])=>k.startsWith('hacknet'));
for(const [k,v] of hn){const x=v.data; console.log(k,x.level,x.cores,x.maxRam,x.ramUsed,x.cache,x.hashRate,x.totalHashesGenerated,x.onlineTimeSeconds);}
const home=S.home.data; console.log('home ram',home.maxRam,home.cpuCores);
const ps=Object.entries(S).filter(([k,v])=>v.data.purchasedByPlayer&&k!=='home'); console.log('pserv',ps.length, ps.map(([k,v])=>v.data.maxRam).join(','));
console.log('w0r1d', S['w0r1d_d43m0n']? S['w0r1d_d43m0n'].data.requiredHackingSkill:'none');
// scripts on home
console.log(home.runningScripts? home.runningScripts.length:'');
const P=JSON.parse(d.PlayerSave).data;
console.log('moneySourceA',JSON.stringify(P.moneySourceA.data));
console.log('moneySourceB',JSON.stringify(P.moneySourceB.data));
const St=JSON.parse(d.StockMarketSave); console.log('stock keys',Object.keys(St).slice(0,5), P.hasWseAccount,P.hasTixApiAccess,P.has4SData,P.has4SDataTixApi);
