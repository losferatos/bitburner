// RAM je Skript des Corp-Gewerks mit tools/ram.js (geeicht gegen 114 Live-Messungen).
// Wurzel: bau/src, Bibliotheken herzschlag/hostdatei kommen aus dem echten src/ (temporaer gespiegelt).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../../..");
const { rechne } = await import(pathToFileURL(path.join(ROOT, "tools/ram.js")).href);
const BAU = path.resolve(here, "../src");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "corpram-"));
const copy = (from, rel) => { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(from, path.join(tmp, rel)); };
for (const f of fs.readdirSync(BAU)) if (f.endsWith(".js")) copy(path.join(BAU, f), f);
for (const f of fs.readdirSync(path.join(BAU, "lib"))) copy(path.join(BAU, "lib", f), "lib/" + f);
for (const f of ["herzschlag.js", "hostdatei.js"]) copy(path.join(ROOT, "src/lib", f), "lib/" + f);
const out = {};
for (const f of fs.readdirSync(BAU).filter((f) => f.endsWith(".js")).sort()) {
  const r = rechne(f, { wurzel: tmp, sf4: 3 });
  out[f] = { gb: r.gb, fehler: r.fehler, posten: r.posten.filter((p) => p.gb > 0).map((p) => `${p.name} ${p.gb}`) };
  console.log(f.padEnd(22), String(r.gb).padStart(7), r.fehler || "", "|", out[f].posten.join(", "));
}
fs.writeFileSync(path.join(here, "ram-bau.json"), JSON.stringify(out, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
