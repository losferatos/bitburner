const fs=require('fs'),zlib=require('zlib');
const f='C:/Users/erche/Desktop/claude_projecto/bitburner/backups/LIVE_197f4d61481686_BN5L2_2026-09-26T17-19_pre-install.json.gz';
let raw=zlib.gunzipSync(fs.readFileSync(f)).toString();
let j=JSON.parse(raw);
fs.writeFileSync('save.json',JSON.stringify(j));
console.log(Object.keys(j));
const s=j.save?j.save:j; console.log(Object.keys(s));
const d=s.data||s; console.log(Object.keys(d));
