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
 *   node tools/aufsicht.js           einmal pruefen und herstellen
 *   node tools/aufsicht.js --pruefen nur berichten, nichts anfassen
 *   node tools/aufsicht.js --dauer   alle 10 Minuten wiederholen (Autostart)
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WURZEL = path.resolve(__dirname, "..");
const BRUECKE_PORT = 8795;
const DEBUG_PORT = 9222;                  // Opera mit Fernsteuerung
const SPIEL_URL = "bitburner-official.github.io";
const PROTOKOLL = path.join(WURZEL, "data", "aufsicht.log");
const NUR_PRUEFEN = process.argv.includes("--pruefen");
const DAUERLAUF = process.argv.includes("--dauer");
const TAKT_MS = 10 * 60 * 1000;

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

const NOTNAGEL_STAND = path.join(WURZEL, "data", "notnagel.json");
const NOTNAGEL_STILL_MIN = 75;     // ab wann die Loops als gestorben gelten
const NOTNAGEL_ABSTAND_MIN = 20;   // Mindestabstand zweier Laeufe
const NOTNAGEL_PRO_TAG = 30;       // hartes Kontingent, rund 6,50 USD

// DER NOTNAGEL: HEADLESS-LAEUFE, WENN DIE LOOPS STEHEN (27.08.2026, 21:12).
//
// Cron-Jobs haengen an der Claude-Sitzung: Sie sterben mit ihr und laufen
// ohnehin nach sieben Tagen aus. Bis heute war der einzige Rueckfall eine
// ntfy-Meldung an Eric - also ein Mensch, der nachts nicht da ist.
//
// GEMESSEN, BEVOR ES GEBAUT WURDE (21:08 und 21:09, zwei Laeufe):
//
//     claude -p mit loop-wache.md   0,2162 USD   10,4 s   Ergebnis "SPUR."
//     derselbe Aufruf noch einmal   0,2188 USD   10,3 s   Ergebnis "SPUR."
//
// Der zweite Lauf zeigt das Entscheidende: `cache_creation` 17.791 statt
// `cache_read` - **jede headless-Sitzung zahlt ihren Kaltstart voll**, der
// Cache der vorigen hilft ihr nicht. Als Dauerbetrieb waeren das allein fuer
// die Wache 72 x 0,217 = 15,60 USD am Tag, mit allen fuenf Loops grob 60 bis
// 150. Das ist nicht, was Eric mit "tokenoekonomisch" gemeint hat - der Takt
// wird deshalb NICHT dauerhaft uebernommen.
//
// Als Notnagel rechnet es sich dagegen: Stehen die Loops eine Nacht lang,
// kosten 24 Wachelaeufe 5,20 USD und halten den Bot in Bewegung, statt ihn
// zwoelf Stunden stehenzulassen.
//
// DREI SICHERUNGEN, damit daraus kein Dauerbetrieb wird:
//   1. Ausloeser ist `data/verlauf-strategie.json` aelter als 75 Minuten -
//      `tools/strategie-check.js` schreibt sie bei JEDEM Lauf, und der
//      Wache-Loop taktet alle 20 Minuten. Drei verpasste Laeufe sind der
//      Beweis, dass niemand mehr taktet.
//
//      HIER STAND `data/ziele.md`, UND DAS WAR AB 10:25 FALSCH (29.08.2026,
//      17:00). Der Reportloop wurde an dem Vormittag auf Erics Ansage hin auf
//      zwei Zeilen gekuerzt und schreibt `ziele.md` seither nicht mehr. Die
//      Datei blieb auf dem Stand von 10:08 stehen; ab 11:23 hielt der Notnagel
//      die Loops fuer tot und feuerte alle 20 Minuten einen headless-Lauf -
//      **30 Stueck bis 16:08, rund 6,50 USD**, waehrend alle fuenf Loops
//      einwandfrei liefen. Um 16:28 kam die Meldung "Kontingent erschoepft".
//
//      Die Lehre steckt nicht im Dateinamen: Ein Waechter darf nicht an einem
//      Nebenprodukt haengen, das ein Loop beilaeufig schreibt. Er haengt jetzt
//      an der Datei, die der Pruefer selbst fuehrt - solange irgendein Loop
//      prueft, ist sie frisch.
//   2. Hoechstens ein Lauf je 20 Minuten (der Dauerlauf taktet alle 10).
//   3. Hartes Tageskontingent in `data/notnagel.json`. Ist es erschoepft,
//      gibt es eine ntfy-Meldung und danach Ruhe.
async function notnagel() {
  const puls = path.join(WURZEL, "data", "verlauf-strategie.json");
  let stillMin = Infinity;
  try { stillMin = (Date.now() - fs.statSync(puls).mtimeMs) / 60000; } catch { /* fehlt */ }
  if (stillMin < NOTNAGEL_STILL_MIN) return;

  let stand = { tag: "", laeufe: 0, zuletzt: 0, gemeldet: false };
  try { stand = JSON.parse(fs.readFileSync(NOTNAGEL_STAND, "utf8")); } catch { /* erster Lauf */ }
  const heute = new Date().toLocaleDateString("sv-SE");
  if (stand.tag !== heute) stand = { tag: heute, laeufe: 0, zuletzt: 0, gemeldet: false };

  if ((Date.now() - stand.zuletzt) / 60000 < NOTNAGEL_ABSTAND_MIN) return;
  if (stand.laeufe >= NOTNAGEL_PRO_TAG) {
    // Nur einmal am Tag melden, nicht bei jedem Durchgang.
    if (!stand.gemeldet) {
      stand.gemeldet = true;
      fs.writeFileSync(NOTNAGEL_STAND, JSON.stringify(stand));
      try {
        execSync("bash \"" + process.env.USERPROFILE.replace(/\\/g, "/")
          + "/.claude/notify.sh\" --title Bitburner --tag rotating_light --priority high "
          + "\"Notnagel-Kontingent erschoepft - Loops stehen, bitte /bb-loops\"",
          { timeout: 20000, stdio: "ignore" });
      } catch { /* ntfy ist Beiwerk */ }
    }
    return;
  }

  // Der Prompt beginnt bei der ersten Zeile mit "BITBURNER-" - davor stehen
  // Ueberschrift und Erklaerung, die nicht mitgehen duerfen.
  let text = "";
  try { text = fs.readFileSync(path.join(WURZEL, "loops", "loop-wache.md"), "utf8"); }
  catch { return; }
  const i = text.indexOf("BITBURNER-");
  if (i < 0) return;

  sag("Loops stehen seit " + stillMin.toFixed(0) + " min - headless-Wachelauf ("
    + (stand.laeufe + 1) + " von " + NOTNAGEL_PRO_TAG + " heute).");
  // Ueber stdin statt als Argument: Der Prompt ist 10 KB lang und enthaelt
  // Anfuehrungszeichen, Backslashes und Zeilenumbrueche. Auf der Kommandozeile
  // waere jedes davon eine eigene Fehlerquelle - `input` kennt keine.
  try {
    spawnSync("claude", ["-p", "--allowedTools", "Bash"],
      // windowsHide: sonst blitzt bei jedem Lauf ein cmd-Fenster mit Titel
      // "claude" auf Erics Bildschirm auf (er hat es am 29.08. 18:40 gemeldet).
      { input: text.slice(i), timeout: 300000, stdio: ["pipe", "ignore", "ignore"],
        shell: true, windowsHide: true });
  } catch { /* ein gescheiterter Lauf ist kein Grund, die Aufsicht zu stoppen */ }
  stand.laeufe += 1;
  stand.zuletzt = Date.now();
  fs.writeFileSync(NOTNAGEL_STAND, JSON.stringify(stand));
}

async function durchgang() {
  const fehlte = [];
  meldungen.length = 0;

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

  // --- 4. Der Selbstheilungsschalter im Spiel ------------------------------
  // `Settings.AutoexecScript` wird beim Laden der Seite auf `home` gestartet
  // (`NetscriptWorker.ts:185-253`, `createAutoexec` in
  // `loadAllRunningScripts`). Steht dort `boot.js`, heilt sich der Bot nach
  // jedem Seitenladen selbst - auch dann, wenn ALLE Skripte tot sind und
  // kein Prestige stattgefunden hat. Das ist der einzige Fall, den sonst
  // nichts abdeckt:
  //
  //   Rechnerneustart      -> gedeckt, die Engine stellt laufende Skripte
  //                           selbst wieder her (dieselbe Funktion)
  //   geplanter Einbau     -> gedeckt, `bn4rep.js:960` ruft
  //                           `installAugmentations("boot.js")`
  //   alles tot, kein Reset -> NUR ueber Autoexec
  //
  // Risikofrei, weil `boot.js` idempotent ist: Es prueft `ns.ps("home")`,
  // bevor es etwas startet (`boot.js:86,118`).
  //
  // Setzen laesst es sich nur in der Oberflaeche (Options -> System ->
  // "Autoexec Script + Args") - die NS-API kennt die Einstellung nicht, und
  // ueber das DOM ginge es nur mit der Fernsteuerung. Deshalb prueft die
  // Aufsicht es und erinnert daran, statt dass es jemand vergisst.
  try {
    const res = await fetch("http://127.0.0.1:" + BRUECKE_PORT
      + "/api/rpc?method=getSaveFile", { signal: AbortSignal.timeout(20000) });
    const body = await res.json();
    if (body?.result?.save) {
      const save = JSON.parse(zlib.gunzipSync(
        Buffer.from(body.result.save, "latin1")).toString("utf8"));
      const st = JSON.parse(save.data.SettingsSave);
      const auto = (st.data ?? st).AutoexecScript ?? "";
      if (auto.trim()) {
        sag("Autoexec steht auf '" + auto.trim() + "'.");
      } else {
        sag("OFFEN: Autoexec ist leer. Ein Handgriff im Spiel schliesst die"
          + " letzte Luecke der Selbstheilung: Options -> System ->"
          + " 'Autoexec Script + Args' auf 'boot.js' setzen.");
        fehlte.push("autoexec");
      }
    }
  } catch { /* Spielstand nicht lesbar - dann ist die Bruecke das Problem */ }

  // --- 5. Notnagel: headless-Laeufe, wenn die Loops stehen ----------------
  if (!NUR_PRUEFEN) {
    try { await notnagel(); }
    catch (e) { sag("Notnagel fehlgeschlagen: " + String(e.message || e)); }
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
    // "autoexec" ist eine Erinnerung, keine Stoerung - sie geht nicht ans Handy.
    const meldenswert = fehlte.filter((f) => f !== "bruecke-stumm" && f !== "autoexec");
    if (meldenswert.length) {
      try {
        execSync("bash \"" + process.env.USERPROFILE.replace(/\\/g, "/")
          + "/.claude/notify.sh\" --title Bitburner --tag warning "
          + "\"Aufsicht hat eingegriffen: " + meldenswert.join(", ") + "\"",
          { timeout: 20000, stdio: "ignore" });
      } catch { /* ntfy ist Beiwerk */ }
    }
  }
  return fehlte.length;
}

// DER DAUERLAUF IST DER AUTOSTART-MODUS (27.08.2026, 19:58).
//
// `Register-ScheduledTask` verlangt Adminrechte, die hier nicht da sind, und
// `schtasks` wird vom Berechtigungsfilter geblockt. Der Autostart-Ordner
// braucht beides nicht: Er startet dieses Skript beim Anmelden, und die
// Schleife uebernimmt die Wiederholung. Damit ist derselbe Zweck erfuellt -
// nach einem Neustart kommt alles von allein hoch, und stirbt zwischendurch
// etwas, wird es binnen zehn Minuten ersetzt.
//
// Diese Schleife ist der einzige Prozess ohne Aufsicht ueber sich selbst.
// Deshalb ist sie bewusst duenn: kein Netzwerkdienst, kein Zustand auf der
// Platte, nichts was haengenbleiben kann. Stirbt sie doch, kommt sie beim
// naechsten Anmelden zurueck - und bis dahin laeuft das Spiel im Browser
// ohnehin weiter, nur ohne Selbstheilung.
if (DAUERLAUF) {
  sag("Aufsicht im Dauerlauf, Takt " + (TAKT_MS / 60000) + " min.");
  const runde = async () => {
    try { await durchgang(); }
    catch (e) { sag("Durchgang fehlgeschlagen: " + String(e.message || e)); }
    setTimeout(runde, TAKT_MS);
  };
  runde();
} else {
  durchgang().then((n) => process.exit(n ? 1 : 0));
}
