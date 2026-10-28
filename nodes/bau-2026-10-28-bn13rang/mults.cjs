const fs=require('fs'),z=require('zlib');
const pat=new RegExp(process.argv[2]);
for(const f of fs.readdirSync('backups').filter(f=>pat.test(f)).sort()){
  const s=JSON.parse(z.gunzipSync(fs.readFileSync('backups/'+f)).toString());
  const p=JSON.parse(s.data.PlayerSave).data; const m=p.mults;
  let st='-'; try{const g=JSON.parse(s.data.StaneksGiftSave).data; st=(g.fragments||[]).length+'frag';}catch(e){}
  console.log(f.slice(27,55),(p.playtimeSinceLastBitnode/3.6e6).toFixed(1),'str',m.strength.toFixed(3),'agi',m.agility.toFixed(3),'strexp',m.strength_exp.toFixed(3),'hack',m.hacking.toFixed(3),'stanek',st,'entropy',p.entropy, 'augs',p.augmentations.length);
}
