// G09: Aktionszaehler je Stand (Versuche/Erfolge/Vorrat/Stufe) fuer Raid, Retirement-Op, Assassination, Vertraege.
import { listRun, readSave, bbOf, mapEntries, fmt } from "./verify-g09-lib.mjs";
const run = process.argv[2] || "BN2L1";
const files = listRun(run);
let prev = null;
console.log("h_node rank | Raid: succ fail cnt lvl maxL | Retire(Contract): s f cnt | Bounty s f cnt | Track s f cnt | Assass s f cnt | city chaos pop popEst comms");
for (const f of files) {
  const { p } = readSave(f);
  const bb = bbOf(p);
  const ops = mapEntries(bb.operations), con = mapEntries(bb.contracts);
  const h = p.playtimeSinceLastBitnode / 3.6e6;
  const R = ops["Raid"], A = ops["Assassination"], SR = ops["Stealth Retirement Operation"];
  const T = con["Tracking"], B = con["Bounty Hunter"], Ret = con["Retirement"];
  const cities = mapEntries(bb.cities);
  const c = cities[bb.city];
  const line = [fmt(h, 2).padStart(6), fmt(bb.rank, 0).padStart(7), "|",
    `${R.successes} ${R.failures} ${fmt(R.count, 1)} ${R.level}/${R.maxLevel}`, "|",
    `${Ret.successes} ${Ret.failures} ${fmt(Ret.count, 1)}`, "|", `${B.successes} ${B.failures} ${fmt(B.count, 1)}`, "|",
    `${T.successes} ${T.failures} ${fmt(T.count, 1)}`, "|", `${A.successes} ${A.failures} ${fmt(A.count, 1)}`, "|",
    bb.city, fmt(c.chaos, 1), Math.round(c.pop / 1e6) + "M", Math.round(c.popEst / 1e6) + "M", c.comms].join(" ");
  console.log(line);
}
