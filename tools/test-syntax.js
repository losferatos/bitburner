/**
 * Ebene -1: die billigste Pruefstufe - parst jede Datei in src/.
 *
 * Das ist ein duenner Mantel um `tools/syntax.js`, damit die Pruefung in
 * `test-alles.js` mitlaeuft. Sie gehoert dorthin, weil ein Syntaxfehler im
 * Spiel STILL ist: `ns.exec` gibt 0 zurueck, `getScriptRam` gibt 0, und der
 * Starter im Kern meldet "getScriptRam gibt 0, warte" - ein Tippfehler sieht
 * damit aus wie Speichermangel und kann eine Nacht kosten.
 *
 * Aufruf: node tools/test-syntax.js
 */

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(HIER, "syntax.js")],
  { encoding: "utf8" });
process.stdout.write(r.stdout || "");
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status === 0 ? 0 : 1);
