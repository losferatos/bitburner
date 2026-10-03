// Skeptiker P0 (03.10.2026): RAM vorher/nachher fuer die drei geaenderten
// Dateien, mit dem Rechner aus dem Bau-Worktree (tools/ram.js), einmal gegen
// den Baseline-Stand (git archive master -> Scratch) und einmal gegen HEAD.
// Aufruf: node skep-p0-ram.mjs <worktree> <baseline-src>
import path from "node:path";
import { pathToFileURL } from "node:url";

const wt = process.argv[2];
const baseSrc = process.argv[3];
const ram = await import(pathToFileURL(path.join(wt, "tools", "ram.js")).href);
const dateien = ["bn4rep.js", "hacknet.js", "lib/hackaugs.js", "bn4net.js", "bn4life.js", "ausgang.js", "hashes.js"];
for (const d of dateien) {
  const neu = ram.rechne(d, { sf4: 1, wurzel: path.join(wt, "src") });
  const alt = ram.rechne(d, { sf4: 1, wurzel: baseSrc });
  console.log(d.padEnd(18), "alt", String(alt.gb).padStart(8), "neu", String(neu.gb).padStart(8),
    alt.gb === neu.gb ? "GLEICH" : "ANDERS", neu.fehler || "", alt.fehler || "");
}
