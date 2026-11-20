// Startbrett gegen "????????????" (19x19 Bitverse-Form mit Vorgabesteinen) als Zeilen ausgeben.
// Aufruf: node --import ./tools/goprobe/register.mjs tools/goprobe/board-wd.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const REF = path.resolve(HIER, "../../reference/bitburner-src/src/Go");
const imp = (p) => import(pathToFileURL(path.join(REF, p)).href);
const { Player } = await import("@player");
Player.hasAugmentation = () => true;
const { Go } = await imp("Go.ts");
const impl = await imp("effects/netscriptGoImplementation.ts");
const { simpleBoardFromBoard } = await imp("boardAnalysis/boardAnalysis.ts");
impl.resetBoardState({}, "????????????", 19);
console.log(JSON.stringify(simpleBoardFromBoard(Go.currentGame.board)));
