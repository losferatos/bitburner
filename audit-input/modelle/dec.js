const zlib=require("zlib"),fs=require("fs"),path=require("path");
const f=process.argv[2];
const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const p=JSON.parse(j.data.PlayerSave).data;
const F=JSON.parse(j.data.FactionsSave);
const out={file:path.basename(f), bn:p.bitNodeN, playtime:p.totalPlaytime, sinceAug:p.playtimeSinceLastAug, sinceBN:p.playtimeSinceLastBitnode,
 money:p.money, hack:p.skills&&p.skills.hacking, exp:p.exp&&p.exp.hacking,
 augsInstalled:p.augmentations.length, queued:p.queuedAugmentations.map(a=>a.name+(a.level>1?"@"+a.level:"")),
 factions:p.factions, invites:p.factionInvitations, mults:{hack:p.mults.hacking,hexp:p.mults.hacking_exp,frep:p.mults.faction_rep,money:p.mults.hacking_money}};
out.rep={}; for(const [k,v] of Object.entries(F)){const d=v.data||v; if(d.playerReputation>0||d.favor>0) out.rep[k]=[Math.round(d.playerReputation),Math.round(d.favor*100)/100];}
if(process.argv[3]==="full") console.log(JSON.stringify(out,null,1)); else console.log(JSON.stringify({file:out.file,pt:(out.playtime/3.6e6).toFixed(2),sinceAugH:(out.sinceAug/3.6e6).toFixed(2),money:out.money.toExponential(2),hack:out.hack,inst:out.augsInstalled,queued:out.queued.length,q:out.queued.join(","),hexp:out.mults.hexp.toFixed(2),hm:out.mults.hack.toFixed(2)}));
