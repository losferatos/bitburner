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
      console.log(uhr(p.ts) + "  Rueckstand " + (p.minuten || 0).toFixed(1).padStart(7)
        + " min   Tempo "
        + (Number.isFinite(p.tempo) ? p.tempo.toFixed(3) : "  -  "));
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
  const jetzt = Date.now();

  // DER RUECKSTAND HING AN BLADEBURNER - UND DAS WAR EIN DENKFEHLER
  // (28.08.2026, 18:10).
  //
  // Hier stand `bb.storedCycles`, mit Ausstieg "Nicht in der Division - kein
  // Rueckstand messbar". Seit dem Wechsel nach BitNode 10 um 17:05 gab es
  // deshalb gar keine Messung mehr - ausgerechnet fuer die Stoerung, die laut
  // Reportloop kein anderes Werkzeug sieht.
  //
  // Nachgeschlagen statt geraten: `storedCycles` ist **kein** Engine-Wert. Es
  // gibt ihn nur auf Teilsystemen, die ihre eigene Sekundenschleife haben -
  // `Bladeburner.ts:105`, `Corporation.ts:58`, ebenso Gang und Stanek. Ein
  // knotenunabhaengiges Gegenstueck existiert schlicht nicht.
  //
  // Was es gibt, ist besser: `totalPlaytime` (`PlayerObject.ts:74`) waechst
  // nur in `updateGame` - also nur, wenn die Engine wirklich tickt. Der
  // Rueckstand ist damit kein Vorrat mehr, den man ausliest, sondern ein
  // VERHAELTNIS, das man ueber zwei Messungen bildet:
  //
  //     tempo = (Spielzeit jetzt - Spielzeit vorher)
  //           / (Uhrzeit  jetzt - Uhrzeit  vorher)
  //
  // Bei 1,00 laeuft das Spiel so schnell wie die Uhr. Ein gedrosselter Tab
  // bekommt eine Weckung je Minute statt fuenf je Sekunde (doku/drosselung.md)
  // und faellt weit darunter. Das misst dieselbe Stoerung wie vorher, gilt aber
  // in jedem BitNode und braucht kein Teilsystem.
  const spielzeit = Number(p.totalPlaytime);
  if (!Number.isFinite(spielzeit)) {
    console.log("totalPlaytime fehlt im Spielstand - Rueckstand nicht messbar.");
    return;
  }

  const v = ladeVerlauf();
  const vorher = v.punkte.filter((x) => Number.isFinite(x.spielzeit)).pop();
  let tempo = null;
  if (vorher && jetzt - vorher.ts > 30_000) {
    tempo = (spielzeit - vorher.spielzeit) / (jetzt - vorher.ts);
  }
  // Der Rueckstand in Minuten ist ab jetzt der aufgelaufene Verlust, nicht ein
  // Vorrat: Wieviel Spielzeit ist gegenueber der Uhr liegengeblieben?
  const minuten = (vorher && Number.isFinite(vorher.spielzeit))
    ? ((jetzt - vorher.ts) - (spielzeit - vorher.spielzeit)) / 60000
      + (vorher.minuten || 0)
    : 0;

  v.punkte.push({ ts: jetzt, spielzeit, minuten, tempo });
  if (v.punkte.length > MAX_PUNKTE) v.punkte = v.punkte.slice(-MAX_PUNKTE);
  fs.writeFileSync(VERLAUF, JSON.stringify(v));

  if (tempo === null) {
    console.log("Erste Messung dieser Reihe (Spielzeit "
      + (spielzeit / 3600e3).toFixed(1) + " h, Stand " + uhr(jetzt)
      + ") - das Tempo braucht zwei Punkte.");
  } else {
    console.log("Tempo " + tempo.toFixed(3) + " (1,000 = Spiel laeuft wie die"
      + " Uhr), Rueckstand " + minuten.toFixed(1) + " min, Stand " + uhr(jetzt));
    if (tempo < 0.9) {
      console.log("WARNUNG: Das Spiel laeuft langsamer als die Uhr.");
    }
    // AUSFAELLE SIND IM TEMPO UNSICHTBAR (22.09.2026, BAUSTELLEN
    // "rueckstand.js kann einen Spielausfall nicht sehen"). Das Spiel schreibt
    // Offline-Zeit beim Laden voll auf totalPlaytime (engine.tsx:343-351) -
    // ein Fenster, in dem der Tab zu oder der Rechner aus war, liefert
    // deshalb Tempo 1,0. Die Bruecke protokolliert aber jedes Trennen und
    // Verbinden mit Zeitstempel; daraus werden die Ausfaelle im Fenster
    // gezaehlt. Eine Luecke ganz ohne Protokollzeile (Bruecke selbst tot)
    // ist nicht belegbar und wird nur als solche genannt.
    try {
      const log = fs.readFileSync(path.join(WURZEL, "data", "bridge.log"), "utf8").split(/\r?\n/);
      let aus = 0, offenSeit = null, stumm = 0, letzte = null;
      for (const z of log) {
        const m = /^(\d{4}-\d\d-\d\dT[\d:.]+Z)\t\w+\t(.*)$/.exec(z);
        if (!m) continue;
        const t = Date.parse(m[1]);
        if (!(t >= vorher.ts && t <= jetzt)) continue;
        if (letzte !== null && t - letzte > 65 * 60000 && offenSeit === null) stumm += t - letzte;
        letzte = t;
        if (/Spielverbindung getrennt/.test(m[2])) offenSeit = t;
        else if (/Spiel verbunden/.test(m[2]) && offenSeit !== null) { aus += t - offenSeit; offenSeit = null; }
      }
      if (offenSeit !== null) aus += jetzt - offenSeit;
      if (aus > 0) {
        console.log("Davon " + (aus / 60000).toFixed(0) + " min Spiel GETRENNT (Tab zu oder"
          + " Rechner aus) - diese Zeit hat das Spiel beim Laden als Spielzeit"
          + " nachgetragen; das Tempo darin belegt KEIN Laufen.");
      }
      if (stumm > 0) {
        console.log("Dazu " + (stumm / 60000).toFixed(0) + " min ohne jede Brueckenzeile"
          + " (Bruecke tot?) - ob das Spiel lief, ist fuer diese Zeit nicht belegbar.");
      }
    } catch { /* ohne bridge.log keine Ausfallrechnung */ }
  }

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
  //
  // Der Aufholmechanismus mit 5 s je Sekunde gehoert zu Bladeburner
  // (`Bladeburner.ts:1375-1378`: `storedCycles` wird in Sekundenschritten
  // abgearbeitet). Er galt fuer die alte Messung und gilt fuer die neue nicht:
  // `totalPlaytime` holt nichts auf, es zaehlt nur, was die Engine wirklich
  // getickt hat. Die Zahlen unten stehen deshalb nur noch, solange eine
  // Bladeburner-Division existiert - sonst waeren sie eine Beruhigung, die
  // nichts deckt.
  const bb = p.bladeburner?.data ?? p.bladeburner;
  if (bb) {
    console.log("Bladeburner-Schwelle: " + SCHWELLE_STUNDEN.toFixed(1)
      + " h Rechnerzeit am Tag. Darueber wird jede Offline-Stunde aufgeholt,"
      + " darunter waechst der Rueckstand der Division unbegrenzt.");
    const bbMin = (bb.storedCycles ?? 0) / ZYKLEN_JE_SEKUNDE / 60;
    if (bbMin > 60) {
      const abbauStunden = bbMin / 60 / (ABBAU_JE_SEKUNDE - 1);
      console.log("Aufholzeit der Division: " + abbauStunden.toFixed(1)
        + " h - so lange laeuft sie fuenffach beschleunigt.");
      console.log("  Merke: In dieser Zeit takten die Claude-Loops weiter in"
        + " Echtzeit, entscheiden also fuenfmal traeger.");
    }
  }
})();
