/**
 * Haelt das Rollback-Archiv wirklich, was im Spiel LAG?
 *
 * ===========================================================================
 * WOZU DIESE PRUEFUNG UEBERHAUPT NOETIG IST
 * ===========================================================================
 *
 * `archiv/rollback-2026-09-04/` soll die exakten Bytes aus dem Spiel halten,
 * wie sie unmittelbar vor der Einspielung dort lagen - NICHT den Stand eines
 * Commits. Der Unterschied ist der ganze Zweck: was im Spiel liegt, ist der
 * Stand des letzten erfolgreichen Schubs, und der faellt nicht mit einem
 * Commit zusammen. Ein Rollback aus dem Commit spielt im Ernstfall eine
 * dritte, nie gelaufene Fassung ein.
 *
 * Behaupten laesst sich das leicht. Pruefen laesst es sich nur an den
 * Dateien, die noch NICHT eingespielt sind: dort muss die Archivfassung
 * byteweise dem entsprechen, was jetzt im Spiel liegt.
 *
 * ===========================================================================
 * WAS AM 04.09.2026 DABEI HERAUSKAM
 * ===========================================================================
 *
 * 6 von 6 unberuehrten Dateien deckten sich byteweise - blade, bbtrain,
 * bn4life, bn4rep, contracts, boot. Das Archiv ist also eine Spielaufnahme,
 * und `tools/rollback.js` stellt her, was lief.
 *
 * Das Einspielprotokoll nannte daneben eine Tabelle mit vier Stichproben
 * ("bn4net.js im Spiel dc0075c7e610"). Diese Zahl liess sich nicht
 * reproduzieren - gemessen wurde fb3466fd63d7, und zwar uebereinstimmend vom
 * Archiv UND vom Einspielwerkzeug beim Schreiben. Ein Vergleich gegen den
 * Commit ist ausserdem schwerer als er aussieht: Git speichert LF, Spiel und
 * Archiv haben CRLF (ohne Normalisierung weicht ALLES ab), und nach einem
 * Fast-Forward ist `<merge>^` gar nicht der alte Master-Stand, sondern ein
 * Commit des Bauzweigs. Die Tabelle im Protokoll ist deshalb als
 * unbelegt markiert; diese Pruefung hier ist an ihre Stelle getreten, weil
 * sie sich jederzeit wiederholen laesst.
 *
 *   node tools/archivpruefung.js
 *
 * Exit 0 = das Archiv deckt sich mit dem Spiel.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const BASE = "http://localhost:8795";
const ARCHIV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "archiv", "rollback-2026-09-04");
const h = (t) => createHash("sha256").update(t, "utf8").digest("hex").slice(0, 12);

// Noch nicht angefasst - hier muss Archiv == Spiel gelten.
const UNBERUEHRT = ["blade.js", "bbtrain.js", "bn4life.js", "bn4rep.js", "contracts.js", "boot.js"];
// Schon eingespielt - hier darf es abweichen, das ist der Zweck.
const EINGESPIELT = ["bn4net.js", "ausgang.js", "popups.js", "exit.js", "wakelock.js", "shop.js"];

async function spiel(d) {
  const q = new URLSearchParams({ instance: "LIVE", method: "getFile", server: "home", filename: d });
  try { return (await (await fetch(BASE + "/api/rpc?" + q)).json()).result ?? null; }
  catch { return null; }
}

let abweichung = 0;
console.log("\n=== UNBERUEHRT: hier MUSS Archiv == Spiel gelten ===\n");
for (const d of UNBERUEHRT) {
  const p = ARCHIV + "/" + d.split("/").join("_");
  if (!fs.existsSync(p)) { console.log("  " + d.padEnd(14) + "nicht im Archiv"); continue; }
  const a = h(fs.readFileSync(p, "utf8"));
  const s = await spiel(d);
  const sg = s === null ? "(fehlt)" : h(s);
  const ok = a === sg;
  if (!ok) abweichung++;
  console.log("  " + d.padEnd(14) + "Archiv " + a + "   Spiel " + sg + "   " + (ok ? "gleich" : "ABWEICHUNG"));
}

console.log("\n=== EINGESPIELT: hier ist Abweichung der Zweck ===\n");
for (const d of EINGESPIELT) {
  const p = ARCHIV + "/" + d.split("/").join("_");
  const a = fs.existsSync(p) ? h(fs.readFileSync(p, "utf8")) : "(nicht im Archiv)";
  const s = await spiel(d);
  console.log("  " + d.padEnd(14) + "Archiv " + a + "   Spiel " + (s === null ? "(fehlt)" : h(s)));
}

console.log("\n" + (abweichung
  ? "=== " + abweichung + " ABWEICHUNG(en) - das Archiv ist KEINE Spielaufnahme ==="
  : "=== Archiv deckt sich mit dem Spiel - der Rollback traegt ==="));
console.log("");
process.exitCode = abweichung ? 1 : 0;
