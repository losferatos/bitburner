// Laedt die Stanek-Quellen des Spiels (reference/v301/src/CotMG) direkt als TypeScript und
// lenkt alles ausserhalb davon auf Attrappen in stubs/ um. v301 = die LAUFENDE Spielfassung
// (reference/bitburner-src ist der dev-Zweig, siehe nodes/AUDIT-VOLLSTAENDIG VERS-1).
// Muster von tools/goprobe/loader.mjs.
// Aufruf: node --import ./nodes/bau-2026-10-27-stanek/probe/register.mjs <skript>
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../../reference/v301/src");
const STUB = (n) => pathToFileURL(path.join(HIER, "stubs", n)).href;

const UMLEITUNG = {
  "utils/JSONReviver": "reviver.mjs",
  "BitNode/BitNodeMultipliers": "bitnodeMults.mjs",
  "Faction/Factions": "factions.mjs",
  "Augmentation/Augmentations": "augmentations.mjs",
};

export async function resolve(spec, ctx, next) {
  if (spec === "@enums") return { url: STUB("enums.mjs"), shortCircuit: true };
  if (spec === "@player") return { url: STUB("player.mjs"), shortCircuit: true };
  if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL && ctx.parentURL.startsWith("file:")) {
    const eltern = fileURLToPath(ctx.parentURL);
    if (eltern.startsWith(REF)) {
      const ziel = path.resolve(path.dirname(eltern), spec);
      const rel = path.relative(REF, ziel).split(path.sep).join("/").replace(/\.(ts|tsx|js)$/, "");
      if (UMLEITUNG[rel]) return { url: STUB(UMLEITUNG[rel]), shortCircuit: true };
      for (const e of [".ts", ".tsx", "/index.ts"]) {
        if (fs.existsSync(ziel + e)) return { url: pathToFileURL(ziel + e).href, shortCircuit: true };
      }
    }
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
    let src = fs.readFileSync(fileURLToPath(url), "utf8");
    // Reine Typnamen in Wert-Importen streichen (Node entfernt sie bei gemischten Importen nicht).
    const TYPEN = new Set(["IReviverValue", "Multipliers", "IActiveFragmentParams"]);
    src = src.replace(/^import {([^}]*)} from ("[^"]+");/gm, (m, names, von) => {
      const rest = names.split(",").map((x) => x.trim()).filter((x) => x && !TYPEN.has(x));
      return rest.length ? "import { " + rest.join(", ") + " } from " + von + ";" : "";
    });
    let out;
    try { out = stripTypeScriptTypes(src, { mode: "transform", sourceUrl: url }); }
    catch (e) { throw new Error("TS-Umwandlung " + url + ": " + e.message); }
    return { format: "module", source: out, shortCircuit: true };
  }
  return next(url, ctx);
}
