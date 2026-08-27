/** Die Raid-Rundreise vorrechnen: Wo liegt wieviel Rang, und was kostet er?
 *
 * WOZU
 *
 * Jede Stadt hat einen eigenen Vorrat an Synthoid-Gemeinden (`comms`), und
 * jeder erfolgreiche Raid verbraucht genau eine (`Bladeburner.ts:836`);
 * `Operation.getSuccessChance` gibt 0 zurueck, sobald `comms <= 0`
 * (`Actions/Operation.ts:63-68`). Raid ist also kein Dauerlaeufer, sondern ein
 * ENDLICHER Vorrat je Stadt - und der Bot hat bis zum 27.08.2026 nie die Stadt
 * gewechselt, also nur die 15 Gemeinden von Sector-12 gesehen.
 *
 * Ueber alle sechs Staedte sind es 384. Das sind rund 37.000 Rang, also gut
 * ein Zehntel des Restwegs zum Knotenausgang.
 *
 * Unbrauchbar macht die anderen Staedte allein das Chaos: `getChaosSuccessFactor`
 * schlaegt ab 50 mit `sqrt(1+chaos-50)` auf die Schwierigkeit. Und das loest
 * `Diplomacy` billig auf - `charisma^0,045 + charisma/1000` Prozent je Lauf
 * (`Bladeburner.ts:735-743`), ein Lauf dauert fest 60 Sekunden
 * (`data/GeneralActions.ts:39`).
 *
 * Dieses Werkzeug liest die Zahlen aus dem Spielstand (die API kennt `comms`
 * nicht) und rechnet aus, in welcher Reihenfolge sich die Rundreise lohnt.
 * Es aendert nichts - es ist die Grundlage fuer die Regel, die noch in
 * `blade.js` fehlt.
 *
 *   node tools/staedte.js
 */
import zlib from "node:zlib";

const BASE = "http://localhost:8795";
const CHAOS_ZIEL = 49;          // knapp unter der 50er-Schwelle
const DIPLOMACY_SEK = 60;       // data/GeneralActions.ts:39, fest
const RAID_BASIS = 55;          // data/Operations.ts:124, rankGain

async function spielstand() {
  const res = await fetch(BASE + "/api/rpc?method=getSaveFile", { signal: AbortSignal.timeout(20000) });
  const body = await res.json();
  if (body.error) throw new Error(String(body.error));
  return JSON.parse(zlib.gunzipSync(Buffer.from(body.result.save, "latin1")).toString("utf8"));
}

(async () => {
  let save;
  try { save = await spielstand(); }
  catch (e) {
    console.log("Spielstand nicht lesbar: " + String(e.message || e));
    console.log("Laeuft die Bruecke? (node tools/aufsicht.js)");
    process.exit(1);
  }

  const p = JSON.parse(save.data.PlayerSave).data;
  const bb = p.bladeburner?.data ?? p.bladeburner;
  if (!bb) { console.log("Nicht in der Division."); return; }

  const cha = p.skills.charisma;
  const diploProzent = Math.pow(cha, 0.045) + cha / 1000;
  const staedte = bb.cities?.data ?? bb.cities ?? {};
  const hier = bb.city;

  // Die Aktionsstufe von Raid bestimmt den tatsaechlichen Ertrag:
  // `rankGain * rewardFac^(level-1)` mit rewardFac 1,1 (`data/Operations.ts:123`).
  let stufe = 1;
  try {
    const ops = bb.operations?.data ?? bb.operations ?? {};
    const raid = ops.Raid?.data ?? ops.Raid;
    stufe = raid?.level ?? 1;
  } catch { /* Vorgabe 1 */ }
  const raidRang = RAID_BASIS * Math.pow(1.1, Math.max(0, stufe - 1));

  const zeilen = [];
  for (const [name, roh] of Object.entries(staedte)) {
    const c = roh.data ?? roh;
    const chaos = c.chaos ?? 0;
    // Diplomacy senkt PROZENTUAL, also braucht es log-viele Laeufe.
    const laeufe = chaos <= CHAOS_ZIEL ? 0
      : Math.ceil(Math.log(CHAOS_ZIEL / chaos) / Math.log(1 - diploProzent / 100));
    const kostenMin = (laeufe * DIPLOMACY_SEK) / 60;
    const ertrag = (c.comms ?? 0) * raidRang;
    zeilen.push({
      name, comms: c.comms ?? 0, chaos, pop: c.pop ?? 0, ertrag, laeufe, kostenMin,
      // Rang je investierter Diplomacy-Minute - danach wird sortiert. Wer
      // ohnehin unter der Schwelle liegt, kostet nichts und kommt zuerst.
      guete: kostenMin > 0 ? ertrag / kostenMin : Infinity,
    });
  }
  zeilen.sort((a, b) => b.guete - a.guete);

  console.log("Charisma " + cha + " -> Diplomacy senkt " + diploProzent.toFixed(3)
    + " % je Lauf (60 s). Raid Stufe " + stufe + " gibt " + raidRang.toFixed(0) + " Rang.");
  console.log("");
  console.log("Stadt         comms   chaos   Diplomacy   Ertrag Rang   Rang/Diplo-Min");
  let summe = 0, kosten = 0;
  for (const z of zeilen) {
    summe += z.ertrag; kosten += z.kostenMin;
    console.log(
      (z.name === hier ? "* " : "  ") + z.name.padEnd(11)
      + String(z.comms).padStart(6)
      + z.chaos.toFixed(1).padStart(8)
      + (z.laeufe ? z.laeufe + " min" : "keine").padStart(12)
      + Math.round(z.ertrag).toLocaleString("de-DE").padStart(14)
      + (z.guete === Infinity ? "sofort" : Math.round(z.guete).toLocaleString("de-DE")).padStart(17));
  }
  console.log("");
  console.log("Gesamt: " + Math.round(summe).toLocaleString("de-DE") + " Rang fuer "
    + Math.round(kosten) + " Minuten Diplomacy.");
  console.log("Der Stern markiert die aktuelle Stadt. `switchCity` ist ein reines"
    + " Feldsetzen und kostet null Sekunden.");
  console.log("");
  console.log("ACHTUNG bei der Umsetzung: Raid hebt das Chaos selbst um 1 bis 5"
    + " Prozent je Lauf (`Bladeburner.ts:843`).");
  console.log("Ein Vorrat von 138 Gemeinden ist also nicht am Stueck abzuarbeiten -"
    + " es wird ein Wechselspiel aus Raid und Diplomacy.");
})();
