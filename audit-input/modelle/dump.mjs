import fs from "node:fs";
const r = JSON.parse(fs.readFileSync(process.argv[2]));
const tf = r.servers.home.data.textFiles.data;
for (const want of process.argv.slice(3)) for (const [n,o] of tf) if (n===want) { console.log("=== "+n); console.log(o.data?.text ?? o.text); }
