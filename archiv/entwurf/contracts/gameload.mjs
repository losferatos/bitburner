/**
 * Laedt die Vertragsdefinitionen aus dem Spielquelltext (reference/v301) als
 * lauffaehige Module.
 *
 * Der Umweg ist noetig, weil die Dateien TypeScript sind und auf Pfade wie
 * "@enums" zeigen, die nur der Bundler des Spiels kennt. Node kann Typen seit
 * v22.6 selbst entfernen (module.stripTypeScriptTypes); die Importe biege ich
 * davor auf gameshim.mjs um. Ergebnis: der ECHTE `solver` des Spiels laeuft
 * hier - und der, nicht meine Lesart der Aufgabenstellung, entscheidet im
 * Spiel ueber Erfolg oder verbrannten Versuch.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const HIER = dirname(fileURLToPath(import.meta.url));
export const QUELLE = join(HIER, "..", "..", "reference", "v301", "src", "CodingContract", "contracts");
const SHIM = pathToFileURL(join(HIER, "gameshim.mjs")).href;

/**
 * Alle Importe zeigen auf den Shim. Absolute file:-URL, weil das Modul
 * gleich als data:-URL geladen wird und eine data:-URL keine relativen
 * Pfade aufloesen kann.
 */
function importeUmbiegen(quelltext) {
  return quelltext.replace(/from\s+"(?:@enums|\.\.\/[^"]*|\.\/[^"]*)"/g, `from "${SHIM}"`);
}

export async function ladeSpielVertraege() {
  const definitionen = {};
  for (const datei of readdirSync(QUELLE).filter((n) => n.endsWith(".ts"))) {
    const roh = readFileSync(join(QUELLE, datei), "utf8");
    const js = stripTypeScriptTypes(importeUmbiegen(roh), { mode: "strip" });
    const modul = await import("data:text/javascript;base64," + Buffer.from(js, "utf8").toString("base64"));
    for (const exportiert of Object.values(modul)) {
      if (!exportiert || typeof exportiert !== "object") continue;
      for (const [name, def] of Object.entries(exportiert)) {
        // Nur echte Vertragsdefinitionen, keine Hilfsobjekte.
        if (def && typeof def.solver === "function") definitionen[name] = def;
      }
    }
  }
  return definitionen;
}
