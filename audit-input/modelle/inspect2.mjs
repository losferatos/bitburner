import fs from "node:fs";
const r = JSON.parse(fs.readFileSync(process.argv[2]));
const S = r.servers;
const home = S.home.data;
console.log("home maxRam", home.maxRam, "cores", home.cpuCores);
const tf = home.textFiles;
const files = (tf.data||tf).map? (tf.data||tf) : tf;
const list = Array.isArray(files)? files : Object.entries(files);
console.log("textFiles type", typeof tf, Array.isArray(tf), tf.ctor);
const entries = tf.ctor==="JSONMap"? tf.data : list;
for (const e of entries) { const [name, obj] = Array.isArray(e)? e : [e.filename, e]; const txt = obj.data?.text ?? obj.text ?? ""; console.log(name, txt.length); }
