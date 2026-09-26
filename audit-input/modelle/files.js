const zlib=require("zlib"),fs=require("fs");
const [f,pat]=process.argv.slice(2);
const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const S=JSON.parse(j.data.AllServersSave);
for(const [host,v] of Object.entries(S)){const d=v.data;const tf=d.textFiles;if(!tf)continue;
 let entries=[];
 if(tf.ctor==="JSONMap") entries=tf.data; else if(Array.isArray(tf)) entries=tf.map(t=>[t.data.filename,t]); else entries=Object.entries(tf);
 for(const [name,t] of entries){const fn=name||(t.data&&t.data.filename);if(!pat||new RegExp(pat).test(fn)){const txt=(t.data&&t.data.text)||t.text||"";console.log("=== "+host+":"+fn+" ("+txt.length+")");if(process.argv[4]!=="list")console.log(txt);}}
}
