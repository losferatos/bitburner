const fs=require('fs');
const src=fs.readFileSync('C:/Users/erche/Desktop/claude_projecto/bitburner/reference/bitburner-src/src/StockMarket/data/InitStockMetadata.ts','utf8');
const blocks=src.split(/\n  \{\n/).slice(1);
let ideal=0,cap=0,n=0;
for(const b of blocks){const g=(re)=>{const m=b.match(re);return m?Number(m[1]):NaN;};
 const mc=g(/marketCap: ([0-9.e]+)/); const mvmax=g(/mv: \{[^}]*max: ([0-9.]+)/s), mvmin=g(/mv: \{[^}]*min: ([0-9.]+)/s), mvdiv=g(/mv: \{[^}]*divisor: ([0-9.]+)/s); const ot=g(/otlkMag: ([0-9.]+)/);
 if(!isFinite(mc)) continue; n++;
 const mv=(mvmax+mvmin)/2/mvdiv; const val=mc*0.2; cap+=val;
 ideal+=val*(mv/2/100)*(2*ot/100);
}
console.log('Aktien',n,'Wert aller maxShares',(cap/1e12).toFixed(1),'T');
console.log('ideale Long-Rendite je Tick (Startausblick, ohne Kursdruck/Spread)',(ideal/1e9).toFixed(2),'G  je Stunde',(ideal*600/1e12).toFixed(2),'T');
