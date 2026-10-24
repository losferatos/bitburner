// Laedt die Go-Quellen des Spiels (reference/bitburner-src/src/Go) direkt als
// TypeScript und lenkt alles ausserhalb von Go auf Attrappen in stubs/ um.
// Aufruf: node --experimental-transform-types --import ./tools/goprobe/register.mjs ...
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/bitburner-src/src");
const STUB = (n) => pathToFileURL(path.join(HIER, "stubs", n)).href;

// Pfade relativ zu REF (ohne Endung), die durch Attrappen ersetzt werden.
const UMLEITUNG = {
  "utils/Utility": "utility.mjs",
  "utils/helpers/exceptionAlert": "exceptionAlert.mjs",
  "Faction/Factions": "factions.mjs",
  "Faction/formulas/favor": "favor.mjs",
  "utils/EnumHelper": "enumHelper.mjs",
  "BitNode/BitNodeMultipliers": "bitnodeMults.mjs",
  "PersonObjects/Multipliers": "multipliers.mjs",
  "ui/formatNumber": "formatNumber.mjs",
  "Netscript/NetscriptHelpers": "nsHelpers.mjs",
  "Netscript/ErrorMessages": "nsErrors.mjs",
};

export async function resolve(spec, ctx, next) {
  if (spec === "@enums") return { url: STUB("enums.mjs"), shortCircuit: true };
  if (spec === "@player") return { url: STUB("player.mjs"), shortCircuit: true };
  // Spielskripte importieren "lib/x.js" relativ zur Wurzel ihres src-Ordners.
  if (spec.startsWith("lib/") && ctx.parentURL && ctx.parentURL.startsWith("file:")) {
    let d = path.dirname(fileURLToPath(ctx.parentURL));
    if (path.basename(d) === "lib") d = path.dirname(d);
    return { url: pathToFileURL(path.join(d, spec)).href, shortCircuit: true };
  }
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
    // Wert-Importe aus Types.ts sind reine Typen (Node streicht sie sonst nicht).
    src = src.replace(/^import \{([^}]*)\} from "(\.\.?\/)+Types";/gm, (m, names, p) => "import type {" + names + "} from \"" + m.match(/"([^"]+)"/)[1] + "\";");
    // Reine Typnamen in Wert-Importen anderer Module streichen.
    const TYPEN = new Set(["PartialRecord", "Multipliers", "Board", "BoardState", "Neighbor", "Play",
      "PointState", "SimpleBoard", "Move", "MoveOptions", "MoveType", "EyeMove", "OpponentStats"]);
    src = src.replace(/^import \{([^}]*)\} from ("[^"]+");/gm, (m, names, von) => {
      const rest = names.split(",").map((s) => s.trim()).filter((s) => s && !TYPEN.has(s));
      return rest.length ? "import { " + rest.join(", ") + " } from " + von + ";" : "";
    });
    let out;
    try { out = stripTypeScriptTypes(src, { mode: "transform", sourceUrl: url }); }
    catch (e) { throw new Error("TS-Umwandlung " + url + ": " + e.message); }
    return { format: "module", source: out, shortCircuit: true };
  }
  return next(url, ctx);
}
