// Audit 03.10.2026, Gruppe BN3/BN11: Stimmen src/lib/bitnodes.json und der
// Quellcode 3.0.2 (BitNode/BitNode.tsx getBitNodeMultipliers case 3 / case 11)
// Feld fuer Feld ueberein? Nur lesen.
// Aufruf: node tools/audit/bn311-mults.mjs
import fs from "node:fs";

const tsx = fs.readFileSync("reference/bitburner-src/src/BitNode/BitNode.tsx", "utf8");
const json = JSON.parse(fs.readFileSync("src/lib/bitnodes.json", "utf8"));

function caseBlock(n) {
  const start = tsx.indexOf(`    case ${n}: {`, tsx.indexOf("export function getBitNodeMultipliers"));
  const end = tsx.indexOf("});", start);
  const body = tsx.slice(start, end);
  const out = {};
  for (const m of body.matchAll(/(\w+):\s*(-?[\d.]+),/g)) out[m[1]] = Number(m[2]);
  const lineOf = (k) => tsx.slice(0, tsx.indexOf(k + ":", start)).split("\n").length;
  return { out, lineOf };
}

for (const n of [3, 11]) {
  const { out, lineOf } = caseBlock(n);
  const j = json.knoten[String(n)] || {};
  const keys = new Set([...Object.keys(out), ...Object.keys(j)]);
  let ok = 0, bad = 0;
  for (const k of keys) {
    if (out[k] === j[k]) ok++;
    else { bad++; console.log(`BN${n} ${k}: Quelle ${out[k]} (BitNode.tsx:${lineOf(k)}) / bitnodes.json ${j[k]}`); }
  }
  console.log(`BN${n}: ${keys.size} Felder, ${ok} gleich, ${bad} abweichend`);
}
