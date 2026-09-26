const j=require('./save.json'); const d=j.data;
const P=JSON.parse(d.PlayerSave).data;
require('fs').writeFileSync('player.json',JSON.stringify(P,null,1));
console.log(Object.keys(P).join(' '));
console.log('SF',JSON.stringify(P.sourceFiles));
console.log('bn',P.bitNodeN,'money',P.money,'skills',JSON.stringify(P.skills),'exp',JSON.stringify(P.exp));
console.log('mults',JSON.stringify(P.mults));
console.log('karma',P.karma,'playtime',P.totalPlaytime,P.playtimeSinceLastAug, P.playtimeSinceLastBitnode);
console.log('augs',P.augmentations.length, JSON.stringify(P.augmentations.map(a=>a.name)));
console.log('queued',JSON.stringify(P.queuedAugmentations.map(a=>a.name)));
console.log('factions',JSON.stringify(P.factions));
console.log('sleeves',P.sleeves.length);
for(const s of P.sleeves){const x=s.data; console.log(JSON.stringify({shock:x.shock,sync:x.sync,skills:x.skills,exp:x.exp,mults:x.mults,work:x.currentWork,city:x.city,stored:x.storedCycles,memory:x.memory,augs:(x.augmentations||[]).length}));}
console.log('hacknet', P.hacknetNodes.length, P.hashManager? JSON.stringify(P.hashManager).slice(0,800):'');
console.log('work',JSON.stringify(P.currentWork).slice(0,500));
console.log('focus',P.focus, 'hasTor', P.hasTorRouter?.());
console.log('bnmults?', P.bitNodeOptions);
