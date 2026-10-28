const fs=require('fs'),z=require('zlib');
const dir='backups/';
const files=fs.readdirSync(dir).filter(f=>/BN14L3/.test(f)).sort();
let prev=null;
for(const f of files){
  const s=JSON.parse(z.gunzipSync(fs.readFileSync(dir+f)).toString());
  let p; try{p=JSON.parse(s.data.PlayerSave).data}catch(e){continue}
  const b=p.bladeburner&&p.bladeburner.data; 
  const row={f:f.replace(/LIVE_\w+_BN13L1_/,'').replace('.json.gz',''),h:(p.playtimeSinceLastBitnode/3.6e6).toFixed(2)};
  if(b){
    row.rank=b.rank.toFixed(0); row.hosp=b.numHosp; row.sp=b.totalSkillPoints;
    for(const k of ['contracts','operations']) for(const [n,a] of Object.entries(b[k])){const d=a.data;
      if(d.successes+d.failures>0) row[n.slice(0,6)]=`${d.successes}/${d.failures} L${d.level} c${d.count.toFixed(0)}`;}
    row.str=p.skills.strength; row.agi=p.skills.agility; row.def=p.skills.defense; row.dex=p.skills.dexterity;
    row.hpmax=p.hp.max; row.act=b.action&&b.action.name; row.city=b.city;
  }
  row.work=p.currentWork&&(p.currentWork.data.factionWorkType||p.currentWork.data.classType||p.currentWork.ctor);
  row.money=(p.money/1e6).toFixed(0)+'M';
  console.log(JSON.stringify(row));
}
