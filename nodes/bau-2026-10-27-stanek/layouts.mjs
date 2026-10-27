// Beste Layouts fuer V2 (Zielfunktion kompetenzLog) je Gitter und Ladestufe; Wirkung NETTO nach Genesis.
// Aufruf: node nodes/bau-2026-10-27-stanek/layouts.mjs
import path from "node:path"; import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as S from "./stanekmodell.mjs";
import { lade } from "./chain.mjs";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "../..");
const { ACTIONS } = await import(pathToFileURL(path.join(ROOT, "tools/bbrank/bbmodel.mjs")).href);
const bo = JSON.parse(fs.readFileSync(path.join(ROOT, "src/lib/blackops.json"), "utf8")).ops[0];
const aktionen = [ACTIONS["Raid"], ACTIONS["Stealth Retirement Operation"], ACTIONS["Assassination"], { w: bo.weights, d: bo.decays }];
const st = await lade("14L3");
const ref = st.find((s) => s.h > 16 && s.h < 17).P.skills;       // Spielerstufen BN14.3 h16,2 (Rang 28k)
const BN13 = { pow: 2, extra: 1 };
const COMBAT_BB = [10, 12, 14, 16, 30, 100, 101, 102, 103, 104, 105, 106, 107];
const MIT_HACK = [...COMBAT_BB, 6, 0, 1];
const MIT_REP = [...COMBAT_BB, 6, 25];
function netto(layout, W, H, h, n, sf) {
  const ch = layout.map(() => ({ hc: h, n }));
  const m = S.calcMults(layout, W, H, ch, BN13.pow);
  const s = S.strafe(sf >= 3 ? 3 : sf >= 2 ? 2 : 1); // hier Genesis (Stufe 1) = 0,9
  return { m, s };
}
const zeilen = [];
for (const [gname, sf13] of [["BN13.1 (SF13=0)", 0], ["BN13.2 (SF13=1)", 1], ["BN13.3 (SF13=2)", 2]]) {
  const { w: W, h: H } = S.gridSize(BN13.extra, sf13);
  console.log(`\n=== ${gname}: Gitter ${W}x${H} = ${W * H} Zellen`);
  for (const [vname, erl] of [["Kampf+BB+Booster", COMBAT_BB], ["+HackMoney+Hacking", MIT_HACK]]) {
    for (const h of [4, 16, 64, 256, 1024]) {
      const n = 300;
      const ziel = (m) => S.kompetenzLog(m, 0.9, ref, aktionen);
      const r = S.suche({ W, H, bnPow: BN13.pow, ziel, erlaubt: erl, h, n, iter: 25000, seed: 7 });
      const ch = r.layout.map(() => ({ hc: h, n }));
      const m = S.calcMults(r.layout, W, H, ch, BN13.pow);
      const f = (k) => (m[k] * 0.9).toFixed(3);
      const nF = r.layout.filter((p) => S.BY_ID[p.id].typ !== "Booster").length, nB = r.layout.length - nF;
      console.log(`${vname.padEnd(20)} H=${String(h).padStart(4)}  exp(J)=${Math.exp(r.wert).toFixed(3)}  netto: str ${f("strength")} def ${f("defense")} dex ${f("dexterity")} agi ${f("agility")}  bbChance ${m.bladeburner_success_chance.toFixed(3)} bbStamina ${m.bladeburner_max_stamina.toFixed(3)}  hack ${f("hacking")} hackMoney ${f("hacking_money")} facRep ${f("faction_rep")}  [${nF} Fragmente+${nB} Booster]`);
      zeilen.push({ gitter: gname, variante: vname, h, J: r.wert, layout: r.layout, W, H, netto: Object.fromEntries(Object.keys(m).map((k) => [k, m[k] * (S.GENESIS[k] ?? 1)])), bbChance: m.bladeburner_success_chance });
    }
  }
}
fs.writeFileSync(path.join(HIER, "layouts-ergebnis.json"), JSON.stringify(zeilen));
