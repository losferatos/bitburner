// Echter Corp-Verlauf aus den Spielstand-Sicherungen (nur lesend).
import fs from "node:fs"; import zlib from "node:zlib"; import path from "node:path";
const dir = "C:/Users/erche/Desktop/claude_projecto/bitburner/backups";
const pat = new RegExp(process.argv[2] || "BN3L[23]");
const files = fs.readdirSync(dir).filter(f => pat.test(f) && f.endsWith(".gz")).sort((a,b)=>a.slice(-40).localeCompare(b.slice(-40)));
const e = (x) => (typeof x === "number" ? x.toExponential(2) : x);
for (const f of files) {
  let txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString("utf8");
  let save = JSON.parse(txt);
  const pd = JSON.parse(save.data.PlayerSave).data;
  const c = pd.corporation?.data;
  const bb = pd.bladeburner?.data;
  const h = (pd.playtimeSinceLastBitnode / 3.6e6).toFixed(2);
  const ha = (pd.playtimeSinceLastAug / 3.6e6).toFixed(2);
  const corp = c ? `val ${e(c.valuation)} funds ${e(c.funds)} rnd ${c.fundingRound} pub ${c.public} own ${(c.numShares/c.totalShares).toFixed(3)} rev ${e(c.revenue)} div ${c.divisions?.data?.length ?? "?"}` : "keine Corp";
  console.log(`${f.slice(23,48)} nodeH ${h} augH ${ha} money ${e(pd.money)} rank ${bb ? Math.round(bb.rank) : "-"} augs ${pd.augmentations.length}+${pd.queuedAugmentations.length} | ${corp}`);
}
