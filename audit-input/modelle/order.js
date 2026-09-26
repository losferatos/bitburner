const zlib=require("zlib"),fs=require("fs");
const T=JSON.parse(fs.readFileSync(process.argv[2]+"/augtable.json"));const C=new Map(T.map(r=>[r[0],{base:r[2],pre:r[4]?r[4].split("|"):[]}]));
const files=process.argv.slice(3);let totA=0,totO=0;
for(const f of files){const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());const S=JSON.parse(j.data.AllServersSave);
 let txt="";const tf=S.home.data.textFiles;const ent=tf.ctor==="JSONMap"?tf.data:Object.entries(tf);for(const [n,t] of ent) if(n==="data/bn4rep-log.txt") txt=t.data.text;
 const p=JSON.parse(j.data.PlayerSave).data;const q=p.queuedAugmentations.map(a=>a.name).filter(n=>n!=="NeuroFlux Governor");
 // Kaufpreise aus dem Log, eindeutig je Aug
 const paid=new Map();for(const l of txt.split("\n")){const m=l.match(/GEKAUFT: (.+) von .+ fuer \$([\d.]+)([mbt])\./);if(m){const mul={m:1e6,b:1e9,t:1e12}[m[3]];paid.set(m[1],+m[2]*mul);}}
 const items=q.filter(n=>C.has(n));if(!items.length)continue;
 const actual=items.reduce((s,n)=>s+(paid.get(n)??NaN),0);
 // optimal: absteigend nach Grundpreis, Voraussetzungen innerhalb der Auswahl vorziehen
 let rest=items.slice().sort((a,b)=>C.get(b).base-C.get(a).base);const seq=[];
 while(rest.length){const i=rest.findIndex(n=>C.get(n).pre.every(pr=>!rest.includes(pr)));seq.push(rest.splice(i,1)[0]);}
 const opt=seq.reduce((s,n,i)=>s+C.get(n).base*2*Math.pow(1.9,i),0);
 totA+=actual;totO+=opt;
 console.log(f.split("_").slice(3).join("_").slice(0,22),"q="+items.length,"tatsaechlich",(actual/1e9).toFixed(2)+"b","optimal",(opt/1e9).toFixed(2)+"b","Faktor",(actual/opt).toFixed(2),"| Reihenfolge Log:",items.map(n=>n.slice(0,14)).join(","));
}
console.log("Summe tatsaechlich",(totA/1e9).toFixed(1),"b  optimal",(totO/1e9).toFixed(1),"b");
