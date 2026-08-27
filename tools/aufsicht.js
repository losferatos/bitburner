/** Die Aufsicht: sorgt dafuer, dass Bruecke, Waechter und Spiel-Tab leben.
 *
 * WOZU
 *
 * Am 27.08.2026 hat eine Fremdpruefung die einzige Frage gestellt, die dem
 * ganzen Aufbau bis dahin niemand gestellt hatte: Wer repariert das System,
 * wenn es nachts um drei bricht? Die Antwort war: niemand. Es gab keine
 * geplante Aufgabe und keinen Autostart-Eintrag - `start.cmd` musste von Hand
 * doppelgeklickt werden, und der Waechter lief zu dem Zeitpunkt seit 05:09,
 * die Bruecke seit dem Vortag. Er war also schon einmal gestorben und von
 * Hand ersetzt worden, ohne dass es jemandem auffiel.
 *
 * Ein Windows-Neustart (Patchday, aktive Stunden enden 23 Uhr) reisst Bruecke,
 * Waechter, Claude-Sitzung und Spiel-Tab gleichzeitig weg. Opera kommt hoch
 * und laedt die Startseite - danach laeuft NICHTS mehr, auch nicht das Spiel.
 * Erwartungswert bis dahin: 3 bis 10 Tage.
 *
 * Dieses Skript ist die Antwort. Es laeuft aus der Windows-Aufgabenplanung
 * (siehe `tools/aufsicht-einrichten.cmd`), prueft drei Dinge und stellt sie
 * her, wenn sie fehlen. Es ist **idempotent**: Laeuft schon alles, tut es
 * nichts und endet.
 *
 * WAS ES BEWUSST NICHT TUT
 *
 * Es startet keine Claude-Loops - die brauchen eine Sitzung und ein
 * Kontingent, das ist eine eigene Entscheidung. Und es oeffnet **niemals**
 * blind einen Bitburner-Tab: Zwei Tabs auf demselben Spielstand ueberschreiben
 * sich gegenseitig. Geoeffnet wird nur, wenn nachweislich keiner da ist.
 *
 *   node tools/aufsicht.js           pruefen und herstellen
 *   node tools/aufsicht.js --pruefen nur berichten, nichts anfassen
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WURZEL = path.resolve(__dirname, "..");
const BRUECKE_PORT = 8795;
const DEBUG_PORT = 9222;                  // Opera mit Fernsteuerung
const SPIEL_URL = "bitburner-official.github.io";
const PROTOKOLL = path.join(WURZEL, "data", "aufsicht.log");
const NUR_PRUEFEN = process.argv.includes("--pruefen");

const jetzt = () => new Date().toLocaleString("sv-SE");   // Ortszeit, nicht UTC
const meldungen = [];
function sag(text) {
  const zeile = jetzt() + "  " + text;
  meldungen.push(zeile);
  console.log(zeile);
}

/** Laeuft ein Node-Prozess, dessen Befehlszeile `muster` enthaelt? */
function laeuft(muster) {
  try {
    const roh = execSync(
      "powershell -NoProfile -Command \"Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | "
      + "Select-Object -ExpandProperty CommandLine\"",
      { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "ignore"] });
    return roh.split("\n").some((z) => z.includes(muster));
  } catch { return false; }
}

/** Antwortet ein lokaler Port binnen `ms`? */
function antwortet(port, pfad, ms) {
  return new Promise((fertig) => {
    const req = http.get(
      { host: "127.0.0.1", port, path: pfad, timeout: ms },
      (res) => { res.resume(); fertig(res.statusCode > 0); });
    req.on("error", () => fertig(false));
    req.on("timeout", () => { req.destroy(); fertig(false); });
  });
}

/** Startet ein Node-Skript abgekoppelt - es ueberlebt das Ende dieses Laufs. */
function starte(skript, name) {
  const log = fs.openSync(path.join(WURZEL, "data", name + ".log"), "a");
  const kind = spawn(process.execPath, [skript], {
    cwd: WURZEL, detached: true, stdio: ["ignore", log, log],
  });
  kind.unref();
  return kind.pid;
}

(async () => {
  const fehlte = [];

  // --- 1. Die Bruecke ------------------------------------------------------
  // Erst den Port fragen, nicht die Prozessliste: Ein Prozess, der lebt aber
  // nicht mehr annimmt, ist schlimmer als keiner - der Waechter haelt ihn
  // dann faelschlich fuer gesund.
  if (await antwortet(BRUECKE_PORT, "/api/wache", 4000)) {
    sag("Bruecke antwortet auf " + BRUECKE_PORT + ".");
  } else if (laeuft("bridge.js")) {
    sag("WARNUNG: bridge.js laeuft, antwortet aber nicht auf " + BRUECKE_PORT
      + ". Nicht angefasst - ein Neustart wuerde zwei Prozesse ergeben.");
    fehlte.push("bruecke-stumm");
  } else if (NUR_PRUEFEN) {
    sag("FEHLT: Bruecke."); fehlte.push("bruecke");
  } else {
    const pid = starte(path.join(WURZEL, "sync", "bridge.js"), "bridge");
    sag("Bruecke gestartet (PID " + pid + ").");
    fehlte.push("bruecke");
  }

  // --- 2. Der Waechter -----------------------------------------------------
  // Er hat keinen Port. Massgeblich ist sein Lebenszeichen auf der Platte -
  // ein Prozess allein beweist nichts (dieselbe Lehre wie bei bn4life am
  // 25.08.: die Existenzpruefung sah einen Prozess, der seit acht Stunden
  // nichts mehr getan hatte).
  const zustand = path.join(WURZEL, "data", "wache-zustand.json");
  let alterMin = Infinity;
  try { alterMin = (Date.now() - fs.statSync(zustand).mtimeMs) / 60000; } catch { /* fehlt */ }
  if (alterMin < 15) {
    sag("Waechter frisch (" + alterMin.toFixed(0) + " min).");
  } else if (NUR_PRUEFEN) {
    sag("FEHLT: Waechter (Lebenszeichen " + (alterMin === Infinity ? "keins"
      : alterMin.toFixed(0) + " min alt") + ")."); fehlte.push("waechter");
  } else {
    // Einen stummen Prozess vorher wegraeumen, sonst laufen zwei.
    if (laeuft("wache.js")) {
      try {
        execSync("powershell -NoProfile -Command \"Get-CimInstance Win32_Process -Filter "
          + "\\\"Name='node.exe'\\\" | Where-Object { $_.CommandLine -like '*wache.js*' } | "
          + "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }\"",
          { timeout: 20000, stdio: "ignore" });
        sag("Stummen Waechter beendet.");
      } catch { /* schon weg */ }
    }
    const pid = starte(path.join(WURZEL, "tools", "wache.js"), "wache");
    sag("Waechter gestartet (PID " + pid + ").");
    fehlte.push("waechter");
  }

  // --- 3. Der Spiel-Tab ----------------------------------------------------
  // HIER IST VORSICHT PFLICHT. Zwei Tabs auf demselben Spielstand schreiben
  // beide in dieselbe IndexedDB und ueberschreiben sich gegenseitig - ein
  // halber Tag Fortschritt ist damit weg. Deshalb wird nur geoeffnet, wenn
  // die Fernsteuerung ERREICHBAR ist und dort NACHWEISLICH kein Spiel-Tab
  // steht. Antwortet Port 9222 gar nicht, laeuft Opera vermutlich ohne
  // Fernsteuerung - dann ist keine Aussage moeglich, und dann wird nichts
  // getan. Lieber ein stehendes Spiel als zwei Tabs.
  let tabs = null;
  try {
    tabs = await new Promise((fertig) => {
      const req = http.get(
        { host: "127.0.0.1", port: DEBUG_PORT, path: "/json/list", timeout: 4000 },
        (res) => {
          let s = "";
          res.on("data", (d) => (s += d));
          res.on("end", () => { try { fertig(JSON.parse(s)); } catch { fertig(null); } });
        });
      req.on("error", () => fertig(null));
      req.on("timeout", () => { req.destroy(); fertig(null); });
    });
  } catch { tabs = null; }

  if (!Array.isArray(tabs)) {
    sag("Fernsteuerung auf " + DEBUG_PORT + " antwortet nicht - Spiel-Tab nicht"
      + " pruefbar, nichts angefasst.");
  } else {
    const spiel = tabs.filter((t) => (t.url || "").includes(SPIEL_URL));
    if (spiel.length === 1) {
      sag("Spiel-Tab steht.");
    } else if (spiel.length > 1) {
      sag("ALARM: " + spiel.length + " Bitburner-Tabs offen. Nicht automatisch"
        + " geschlossen - welcher der richtige ist, kann nur ein Mensch sagen.");
      fehlte.push("doppeltab");
    } else if (NUR_PRUEFEN) {
      sag("FEHLT: Spiel-Tab."); fehlte.push("spieltab");
    } else {
      // Kein Tab da, Fernsteuerung erreichbar: jetzt ist das Oeffnen sicher.
      try {
        execSync("powershell -NoProfile -Command \"Start-Process 'opera' "
          + "-ArgumentList 'https://" + SPIEL_URL + "/'\"",
          { timeout: 20000, stdio: "ignore" });
        sag("Spiel-Tab geoeffnet (es war keiner offen).");
      } catch (e) {
        sag("Spiel-Tab konnte nicht geoeffnet werden: " + String(e.message || e));
      }
      fehlte.push("spieltab");
    }
  }

  // --- Protokoll -----------------------------------------------------------
  // Nur schreiben, wenn etwas zu berichten war. Ein Lauf, der alles in Ordnung
  // vorfindet, hinterlaesst nichts - sonst waechst die Datei um 144 Zeilen
  // am Tag und niemand liest sie mehr.
  if (fehlte.length) {
    try {
      fs.appendFileSync(PROTOKOLL, meldungen.join("\n") + "\n");
    } catch { /* Protokoll ist Beiwerk, kein Grund zu scheitern */ }
    // Nur bei echten Eingriffen ans Handy - "Tab nicht pruefbar" ist keiner.
    const meldenswert = fehlte.filter((f) => f !== "bruecke-stumm");
    if (meldenswert.length) {
      try {
        execSync("bash \"" + process.env.USERPROFILE.replace(/\\/g, "/")
          + "/.claude/notify.sh\" --title Bitburner --tag warning "
          + "\"Aufsicht hat eingegriffen: " + meldenswert.join(", ") + "\"",
          { timeout: 20000, stdio: "ignore" });
      } catch { /* ntfy ist Beiwerk */ }
    }
  }
  process.exit(fehlte.length ? 1 : 0);
})();
