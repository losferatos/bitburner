/** Wieviel Spielzeit haengt hinterher? `storedCycles` messen und fortschreiben.
 *
 * WOZU
 *
 * Am 27.08.2026 hat Eric seine Rechnerzeit auf rund 15:30 bis 21:00 begrenzt,
 * also 5,5 von 24 Stunden. Bitburner verliert dadurch keinen Bladeburner-Rang:
 * `engine.tsx:333` legt die Offline-Zeit vollstaendig als `storedCycles` zur
 * Seite (`Bladeburner.ts:275`, `clampInteger(..., 0)` - keine Obergrenze), und
 * `process()` arbeitet sie mit hoechstens fuenf Spielsekunden je Aufruf ab
 * (`Bladeburner.ts:1375-1378`). Der Aufruf kommt alle fuenf Zyklen a 200 ms
 * (`engine.tsx:150,201`, `Constants.ts:19`), also **einmal je Realsekunde**.
 *
 * Daraus folgt eine harte Schwelle:
 *
 *     Abbau je Realstunde = 5 h Spielzeit, davon 1 h "neu"  ->  netto 4 h
 *     Gleichgewicht:  T_on * 4 = 24 - T_on   ->   T_on = 4,8 h am Tag
 *
 * Ueber 4,8 Stunden Rechnerzeit wird alles aufgeholt, darunter waechst der
 * Rueckstand unbegrenzt. Erics 5,5 Stunden liegen darueber - aber nur mit
 * **42 Minuten Puffer**. Ein kuerzerer Tag, und der Rest bleibt stehen.
 *
 * Und es gibt einen zweiten Weg unter die Schwelle: die **Tab-Drosselung**.
 * Ein verdeckter Tab bekommt nur noch eine Timer-Weckung je Minute
 * (`doku/drosselung.md`), dann faellt der Abbau von 5 s/s auf 5 s/min - Faktor
 * zwoelf. Damit reicht auch ein durchlaufender Rechner nicht mehr.
 *
 * Beides ist von aussen nur an EINER Zahl erkennbar, und die steht nicht in
 * der API, sondern im Spielstand. Dieses Werkzeug holt sie und schreibt sie
 * fort, damit aus einer Rechnung eine Messreihe wird.
 *
 *   node tools/rueckstand.js            messen, fortschreiben, bewerten
 *   node tools/rueckstand.js --verlauf  die letzten Messungen zeigen
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(__dirname, "..");
const VERLAUF = path.join(WURZEL, "data", "rueckstand.json");
const BASE = "http://localhost:8795";

const ZYKLEN_JE_SEKUNDE = 5;      // BladeburnerConstants.CyclesPerSecond
const ABBAU_JE_SEKUNDE = 5;       // Math.min(seconds, 5) in process()
const SCHWELLE_STUNDEN = 24 / (ABBAU_JE_SEKUNDE);   // 4,8 h Rechnerzeit am Tag
const MAX_PUNKTE = 400;           // rund vier Tage bei halbstuendlicher Messung

async function holeSpielstand() {
  const res = await fetch(BASE + "/api/rpc?method=getSaveFile", { signal: AbortSignal.timeout(20000) });
  const body = await res.json();
  if (body.error) throw new Error(String(body.error));
  const roh = Buffer.from(body.result.save, "latin1");
  return JSON.parse(zlib.gunzipSync(roh).toString("utf8"));
}

function ladeVerlauf() {
  try { return JSON.parse(fs.readFileSync(VERLAUF, "utf8")); } catch { return { punkte: [] }; }
}

const uhr = (ts) => new Date(ts).toLocaleString("sv-SE").slice(5, 16);

(async () => {
  if (process.argv.includes("--verlauf")) {
    const v = ladeVerlauf();
    if (!v.punkte.length) { console.log("Noch keine Messung."); return; }
    for (const p of v.punkte.slice(-20)) {
      console.log(uhr(p.ts) + "  Rueckstand " + (p.minuten).toFixed(1).padStart(7)
        + " min   (storedCycles " + p.storedCycles + ")");
    }
    return;
  }

  let save;
  try { save = await holeSpielstand(); }
  catch (e) {
    console.log("Spielstand nicht lesbar: " + String(e.message || e));
    console.log("Laeuft die Bruecke? (node tools/aufsicht.js)");
    process.exit(1);
  }

  const p = JSON.parse(save.data.PlayerSave).data;
  const bb = p.bladeburner?.data ?? p.bladeburner;
  if (!bb) { console.log("Nicht in der Division - kein Rueckstand messbar."); return; }

  const storedCycles = bb.storedCycles ?? 0;
  const minuten = storedCycles / ZYKLEN_JE_SEKUNDE / 60;
  const jetzt = Date.now();

  const v = ladeVerlauf();
  v.punkte.push({ ts: jetzt, storedCycles, minuten });
  if (v.punkte.length > MAX_PUNKTE) v.punkte = v.punkte.slice(-MAX_PUNKTE);
  fs.writeFileSync(VERLAUF, JSON.stringify(v));

  console.log("Rueckstand " + minuten.toFixed(1) + " min (storedCycles "
    + storedCycles + ", Stand " + uhr(jetzt) + ")");

  // --- Bewertung -----------------------------------------------------------
  // Ein einzelner Wert sagt wenig: Nach dem Einschalten ist ein grosser
  // Rueckstand normal und richtig, er wird ja gerade abgebaut. Was zaehlt, ist
  // die RICHTUNG ueber mehrere Stunden.
  const alt = v.punkte.filter((x) => jetzt - x.ts >= 2 * 3600e3).pop();
  if (!alt) {
    console.log("Noch keine zwei Stunden Messreihe - Trend ab dem naechsten Tag"
      + " (" + v.punkte.length + " Punkte).");
  } else {
    const dtStunden = (jetzt - alt.ts) / 3600e3;
    const trend = (minuten - alt.minuten) / dtStunden;
    console.log("Trend " + (trend >= 0 ? "+" : "") + trend.toFixed(1)
      + " min je Stunde ueber " + dtStunden.toFixed(1) + " h.");
    if (trend > 5) {
      console.log("WARNUNG: Der Rueckstand WAECHST, obwohl der Rechner laeuft.");
      console.log("  Wahrscheinlichste Ursache ist die Tab-Drosselung - ein"
        + " verdeckter Tab bekommt nur noch eine Weckung je Minute, dann faellt");
      console.log("  der Abbau von 5 s/s auf 5 s/min (doku/drosselung.md).");
      console.log("  Zu pruefen: Steht der Bitburner-Tab im Vordergrund oder"
        + " spielt er einen Ton ab?");
    }
  }

  // --- Die Schwelle --------------------------------------------------------
  console.log("Schwelle: " + SCHWELLE_STUNDEN.toFixed(1) + " h Rechnerzeit am Tag."
    + " Darueber wird jede Offline-Stunde aufgeholt, darunter waechst der"
    + " Rueckstand unbegrenzt.");
  if (minuten > 60) {
    const abbauStunden = minuten / 60 / (ABBAU_JE_SEKUNDE - 1);
    console.log("Aufholzeit beim jetzigen Stand: " + abbauStunden.toFixed(1)
      + " h - so lange laeuft das Spiel fuenffach beschleunigt.");
    console.log("  Merke: In dieser Zeit takten die Claude-Loops weiter in"
      + " Echtzeit, entscheiden also fuenfmal traeger als das Spiel laeuft.");
  }
})();
