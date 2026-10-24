#!/bin/sh
# Vergleich einer Variante: 4 Prozesse parallel, je GO_MAX_SEK Sekunden, Summe.
# Aufruf: sh tools/goprobe/vergleich.sh '<json-optionen>' <go.js> [sekunden]
O="$1"; F="$2"; T="${3:-240}"
for k in 1 2 3 4; do
  GO_MAX_SEK=$T GO_MCTS_OPT="$O" node --import ./tools/goprobe/register.mjs tools/goprobe/play.mjs 100000 "$F" 2>/dev/null &
done | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=s.trim().split("\n").map(l=>JSON.parse(l));
const sum=(k)=>r.reduce((a,x)=>a+x[k]*(k==="partien"?1:1),0);
const P=sum("partien"),W=sum("siege"),NP=sum("nodePower");
const se=Math.sqrt((W/P)*(1-W/P)/P);
console.log(JSON.stringify({opt:process.argv[1],partien:P,quote:+(W/P).toFixed(3),se:+se.toFixed(3),npJePartie:+(NP/P).toFixed(1),
 schwarz:+(r.reduce((a,x)=>a+x.schwarz*x.partien,0)/P).toFixed(1),sekJePartie:+(r.reduce((a,x)=>a+x.sekunden,0)/P).toFixed(2)}))})' "$O"
