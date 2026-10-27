// Erzeugt fragmente.json aus dem ECHTEN Spielcode (v301/CotMG/Fragment.ts) - nicht abgetippt.
// Aufruf: node --import ./nodes/bau-2026-10-27-stanek/probe/register.mjs nodes/bau-2026-10-27-stanek/dump-fragmente.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/v301/src/CotMG");
const { Fragments } = await import(pathToFileURL(path.join(REF, "Fragment.ts")).href);
const { FragmentTypeEnum } = await import(pathToFileURL(path.join(REF, "FragmentType.ts")).href);
const typName = Object.fromEntries(Object.entries(FragmentTypeEnum).map(([k, v]) => [v, k]));
const out = {
  hinweis: "ERZEUGT von dump-fragmente.mjs aus reference/v301/src/CotMG/Fragment.ts. Nicht von Hand pflegen.",
  fragmente: Fragments.map((f) => ({
    id: f.id, typ: typName[f.type], typNr: f.type, power: f.power, limit: f.limit,
    shape: f.shape.map((row) => row.map((x) => (x ? 1 : 0))),
  })),
};
fs.writeFileSync(path.join(HIER, "fragmente.json"), JSON.stringify(out, null, 1));
console.log("fragmente.json:", out.fragmente.length, "Fragmente");
