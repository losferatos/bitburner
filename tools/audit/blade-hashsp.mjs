// Audit 03.10.2026 (BLADE): Hash-Tausch Rang gegen Skillpunkte.
// Kosten je Upgrade eigene Stufe: costPerLevel*(Stufe+1) (Hacknet/HashUpgrade.ts:71-81),
// Rang 250/Stufe -> 100 Rang = 33,3 SP (RanksPerSkillPoint 3, Bladeburner.ts:1282-1291),
// SP 250/Stufe -> 10 SP (HacknetHelpers.tsx:547-554). Gierig je Hash: was mehr SP bringt.
// Aufruf: node tools/audit/blade-hashsp.mjs [hashes]
const H = Number(process.argv[2]) || 160000;
function rein(H) { let L = 0, h = H; while (250 * (L + 1) <= h) { h -= 250 * (L + 1); L++; } return { L, M: 0, sp: 100 * L / 3, rang: 100 * L }; }
function misch(H) { let L = 0, M = 0, h = H; for (;;) { const cR = 250 * (L + 1), cS = 250 * (M + 1); const wR = (100 / 3) / cR, wS = 10 / cS;
  if (wR >= wS && cR <= h) { h -= cR; L++; } else if (cS <= h) { h -= cS; M++; } else if (cR <= h) { h -= cR; L++; } else break; }
  return { L, M, sp: 100 * L / 3 + 10 * M, rang: 100 * L }; }
const a = rein(H), b = misch(H);
console.log("Hashes", H, "nur Rang: Stufe", a.L, "SP", a.sp.toFixed(0), "Rang", a.rang, "| gemischt: Rang-Stufe", b.L, "SP-Stufe", b.M, "SP", b.sp.toFixed(0), "Rang", b.rang, "| SP-Gewinn", (100 * (b.sp / a.sp - 1)).toFixed(1) + " %");
