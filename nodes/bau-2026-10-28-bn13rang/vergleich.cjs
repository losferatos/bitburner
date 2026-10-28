const fs=require('fs'),z=require('zlib');
function load(f){const s=JSON.parse(z.gunzipSync(fs.readFileSync('backups/'+f)).toString());return {s,p:JSON.parse(s.data.PlayerSave).data};}
for(const f of process.argv.slice(2)){
  const {s,p}=load(f); const b=p.bladeburner.data;
  console.log('==',f);
  const m=p.mults; console.log('mults str',m.strength.toFixed(3),'strexp',m.strength_exp.toFixed(3),'dex',m.dexterity.toFixed(3),'agi',m.agility.toFixed(3),'succ',m.bladeburner_success_chance,'maxstam',m.bladeburner_max_stamina,'hp?');
  console.log('augs',p.augmentations.map(a=>a.name+(a.level>1?'x'+a.level:'')).join(','));
  console.log('queued',p.queuedAugmentations.map(a=>a.name).join(','));
  console.log('SF',JSON.stringify(p.sourceFiles.data));
  console.log('bbskills',JSON.stringify(b.skills));
  console.log('sleeves',p.sleeves.map(x=>{const d=x.data;return JSON.stringify([d.skills.strength,d.shock.toFixed(0),d.sync,d.memory,d.currentWork&&d.currentWork.data.type,d.currentWork&&d.currentWork.data.actionId&&d.currentWork.data.actionId.name,d.augmentations.length])}).join(' '));
  console.log('work',JSON.stringify(p.currentWork&&p.currentWork.data), 'city',p.city, 'int',p.skills.intelligence,'cha',p.skills.charisma,'hack',p.skills.hacking);
}
