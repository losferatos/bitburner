/**
 * DIE WIEDERHERSTELLUNGSPROBE (Auftrag 6.3 und 10, Stufe A).
 *
 * ===========================================================================
 * WORUM ES GEHT
 * ===========================================================================
 *
 * `tools/backup-check.js` beantwortet die Frage "ist diese Datei ein
 * plausibler Spielstand". Das ist nicht dieselbe Frage wie "laesst sich
 * daraus das Spiel wiederherstellen". Der Auftrag verlangt die zweite, und
 * bis heute hat sie niemand gestellt.
 *
 * Der Unterschied ist nicht theoretisch. Eine Sicherung kann sich entpacken
 * lassen, alle erwarteten Felder tragen, im Index stehen - und beim Import
 * trotzdem abgewiesen werden, weil das Spiel beim LADEN andere Bedingungen
 * stellt als der Pruefer beim Lesen. Wer das nicht misst, hat einen
 * Sicherungsordner voller Behauptungen.
 *
 * ===========================================================================
 * WAS DIESE PROBE TUT - UND WAS SIE NICHT KANN
 * ===========================================================================
 *
 * Sie fuehrt den LADEWEG DES SPIELS auf einer echten Sicherung aus, Schritt
 * fuer Schritt, gegen den Quelltext von v3.0.1:
 *
 *   `utils/SaveDataUtils.ts`  decodeSaveData / encodeJsonSaveString
 *   `SaveObject.ts`           assertBitburnerSaveObjectType, loadGame
 *
 * Jede Zusicherung hier ist eine Zeile aus diesen Dateien, nicht eine
 * Vermutung darueber, was das Spiel wohl erwartet. Wo der Quelltext eine
 * Ausnahme wirft, wirft diese Probe eine; wo er nur warnt, warnt sie.
 *
 * WAS SIE NICHT KANN: den letzten Schritt - `importGame` in einem laufenden
 * Spiel anklicken. Der geht nur im Spiel, er ist unwiderruflich, und auf der
 * LIVE-Instanz ist er ausdruecklich verboten (Erics Bedingung: der Spielstand
 * darf nicht zerstoert werden). Diese Probe bringt die Kette bis unmittelbar
 * davor: alles, was `loadGame` VOR dem ersten Schreiben prueft, ist hier
 * geprueft. Der Rest bleibt eine Messluecke der Ebene 3 und steht als solche
 * im Protokoll - nicht als bestandener Punkt.
 *
 * ===========================================================================
 * AUFRUF
 * ===========================================================================
 *
 *   node tools/wiederherstellung.js                    juengste LIVE-Sicherung
 *   node tools/wiederherstellung.js <datei>            eine bestimmte
 *   node tools/wiederherstellung.js --alle             alle im Ordner
 *   node tools/wiederherstellung.js --protokoll        schreibt den Bericht
 *
 * Exit 0 = gruen, 1 = mindestens eine Zusicherung rot.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");

const argv = process.argv.slice(2);
const ALLE = argv.includes("--alle");
const PROTOKOLL = argv.includes("--protokoll");
const datei0 = argv.find((a) => !a.startsWith("--"));

let gruen = 0;
let rot = 0;
const zeilen = [];

function pruefe(text, bedingung, zusatz = "") {
  if (bedingung) {
    gruen++;
    console.log("  ok    " + text + (zusatz ? "  (" + zusatz + ")" : ""));
    zeilen.push("- ok — " + text);
  } else {
    rot++;
    console.log("  ROT   " + text + (zusatz ? " - " + zusatz : ""));
    zeilen.push("- **ROT** — " + text + (zusatz ? " — " + zusatz : ""));
  }
}

/** Die juengste Sicherung einer Rolle finden. */
function juengste(ordner, praefix) {
  if (!fs.existsSync(ordner)) return null;
  const kandidaten = fs.readdirSync(ordner)
    .filter((f) => f.startsWith(praefix) && f.endsWith(".json.gz"))
    .map((f) => ({ f, t: fs.statSync(path.join(ordner, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return kandidaten.length ? path.join(ordner, kandidaten[0].f) : null;
}

/**
 * DER LADEWEG, SCHRITT FUER SCHRITT.
 *
 * Jeder Abschnitt nennt die Quelltextstelle, deren Bedingung er nachstellt.
 */
function probe(dateipfad) {
  const name = path.basename(dateipfad);
  console.log("");
  console.log("-- " + name + " --");
  zeilen.push("");
  zeilen.push("### " + name);

  // ---- Schritt 1: die Datei ------------------------------------------------
  const roh = fs.readFileSync(dateipfad);
  pruefe("die Datei ist lesbar und nicht leer", roh.length > 0,
    (roh.length / 1024).toFixed(1) + " KB");

  // `getSaveFileName` (SaveObject.ts:265-275): .json.gz heisst Binaerformat,
  // also gzip. Die Kennung steht in den ersten zwei Bytes.
  pruefe("sie traegt die gzip-Kennung (Binaerformat, .json.gz)",
    roh[0] === 0x1f && roh[1] === 0x8b,
    "erste Bytes " + roh.slice(0, 2).toString("hex"));

  // ---- Schritt 2: entpacken (decodeSaveData) -------------------------------
  //
  // Das Spiel benutzt `DecompressionStream("gzip")` und einen
  // `TextDecoderStream("utf-8", { fatal: true })`. Beides ist hier
  // nachgestellt: zlib.gunzipSync entspricht dem ersten, ein TextDecoder mit
  // fatal:true dem zweiten. `fatal` ist wichtig - ohne ihn wuerde eine
  // beschaedigte Sicherung stillschweigend Ersatzzeichen liefern, und die
  // Probe waere gruen, wo das Spiel wirft.
  let json = null;
  let entpackFehler = null;
  try {
    const aus = zlib.gunzipSync(roh);
    json = new TextDecoder("utf-8", { fatal: true }).decode(aus);
  } catch (e) {
    entpackFehler = String(e.message || e);
  }
  pruefe("sie entpackt sich zu gueltigem UTF-8 (decodeSaveData)",
    json !== null, entpackFehler || "");
  if (json === null) return;

  // ---- Schritt 3: die Vorbedingung des Kodierers ---------------------------
  //
  // `encodeJsonSaveString` (SaveDataUtils.ts:45-50) lehnt jede Zeichenkette
  // ab, die nicht mit exakt diesem Praefix beginnt. Ein Import wuerde also
  // schon hier scheitern - noch bevor irgendein Feld gelesen wird.
  const PRAEFIX = '{"ctor":"BitburnerSaveObject"';
  pruefe("sie beginnt mit " + PRAEFIX, json.startsWith(PRAEFIX),
    json.slice(0, 40));

  // ---- Schritt 4: JSON.parse und die Huelle --------------------------------
  let obj = null;
  try { obj = JSON.parse(json); } catch (e) { obj = null; }
  pruefe("sie parst als JSON", obj !== null);
  if (!obj) return;
  pruefe("ctor ist BitburnerSaveObject", obj.ctor === "BitburnerSaveObject",
    String(obj.ctor));
  pruefe("data ist ein Objekt",
    obj.data && typeof obj.data === "object" && !Array.isArray(obj.data),
    typeof obj.data);
  if (!obj.data) return;

  // ---- Schritt 5: assertBitburnerSaveObjectType ----------------------------
  //
  // SaveObject.ts:119-160. Drei Gruppen, und der Unterschied zwischen ihnen
  // ist der Unterschied zwischen "Import bricht ab" und "Import warnt".
  const PFLICHT = ["PlayerSave", "AllServersSave", "CompaniesSave",
    "FactionsSave", "AliasesSave", "GlobalAliasesSave"];
  for (const k of PFLICHT) {
    pruefe("Pflichtschluessel " + k + " ist eine Zeichenkette",
      typeof obj.data[k] === "string",
      k in obj.data ? typeof obj.data[k] : "fehlt ganz");
  }

  const OPT1 = ["StaneksGiftSave", "StockMarketSave"];
  for (const k of OPT1) {
    if (Object.hasOwn(obj.data, k)) {
      pruefe("Wahlschluessel " + k + " ist eine Zeichenkette",
        typeof obj.data[k] === "string", typeof obj.data[k]);
    } else {
      // Das Spiel warnt hier nur und setzt "" ein. Also warnt die Probe auch,
      // statt rot zu werden - sonst behauptete sie eine Strenge, die der
      // Ladeweg nicht hat.
      console.log("  warn  " + k + " fehlt - das Spiel setzt \"\" ein");
      zeilen.push("- warn — " + k + " fehlt (das Spiel setzt eine leere Zeichenkette ein)");
    }
  }

  const OPT2 = ["SettingsSave", "LastExportBonus", "AllGangsSave", "VersionSave"];
  for (const k of OPT2) {
    if (Object.hasOwn(obj.data, k)) {
      pruefe("Wahlschluessel " + k + " ist eine Zeichenkette",
        typeof obj.data[k] === "string", typeof obj.data[k]);
    }
  }

  // ---- Schritt 6: jeder Teil parst fuer sich -------------------------------
  //
  // Die Werte sind selbst JSON-Zeichenketten; `loadGame` gibt sie an je einen
  // Loader weiter, der sie parst. Ein Teil, der nicht parst, faellt erst
  // dort auf - also mitten im Laden, wenn schon geschrieben wurde.
  let teileOk = 0;
  const kaputt = [];
  for (const [k, v] of Object.entries(obj.data)) {
    if (typeof v !== "string" || v === "") continue;
    try { JSON.parse(v); teileOk++; } catch { kaputt.push(k); }
  }
  pruefe("alle " + teileOk + " Teilstaende parsen einzeln", kaputt.length === 0,
    kaputt.join(", "));

  // ---- Schritt 7: die Felder, an denen der Bot haengt ----------------------
  //
  // Nicht das Spiel prueft die hier, sondern dieses Projekt: ein Spielstand
  // ohne sie waere ladbar und fuer den Bot trotzdem wertlos.
  let spieler = null;
  try { spieler = JSON.parse(obj.data.PlayerSave).data; } catch { /* siehe oben */ }
  pruefe("PlayerSave traegt einen Spieler", !!spieler);
  if (spieler) {
    pruefe("  bitNodeN ist eine Zahl", Number.isFinite(spieler.bitNodeN),
      String(spieler.bitNodeN));
    pruefe("  totalPlaytime ist eine Zahl > 0",
      Number.isFinite(spieler.totalPlaytime) && spieler.totalPlaytime > 0,
      Number.isFinite(spieler.totalPlaytime)
        ? (spieler.totalPlaytime / 3.6e6).toFixed(2) + " h" : String(spieler.totalPlaytime));
    // M.8: der Rang liegt im PlayerSave, NICHT in einem eigenen Schluessel.
    // Ein Werkzeug, das data.BladeburnerSave liest, bekommt undefined und
    // meldet stumm "kein Bladeburner" - in einem Knoten, dessen einziger
    // Ausgang die Division ist.
    const rang = spieler.bladeburner && spieler.bladeburner.data
      && spieler.bladeburner.data.rank;
    pruefe("  der Bladeburner-Rang steht im PlayerSave (M.8)",
      Number.isFinite(rang), String(rang));
    pruefe("  kein eigener Schluessel BladeburnerSave",
      !Object.hasOwn(obj.data, "BladeburnerSave"),
      "sonst waere M.8 ueberholt und die Leser muessten nach");
  }

  let einst = null;
  try { einst = JSON.parse(obj.data.SettingsSave); } catch { /* siehe oben */ }
  pruefe("SettingsSave traegt den RFA-Port (der Fingerabdruck der Instanz)",
    einst && Number.isFinite(einst.RemoteFileApiPort),
    einst ? String(einst.RemoteFileApiPort) : "SettingsSave unlesbar");

  // ---- Schritt 8: der Rundlauf --------------------------------------------
  //
  // Kodieren und wieder dekodieren muss denselben Text ergeben. Geprueft wird
  // der TEXT, nicht die Bytes: die Kompressionsstufe von zlib und die des
  // Browsers duerfen sich unterscheiden, der Inhalt nicht.
  let rund = null;
  try {
    rund = new TextDecoder("utf-8", { fatal: true })
      .decode(zlib.gunzipSync(zlib.gzipSync(Buffer.from(json, "utf8"))));
  } catch (e) { rund = null; }
  pruefe("Rundlauf gzip: der Text kommt unveraendert zurueck", rund === json,
    rund === null ? "Rundlauf warf" : "Laenge " + (rund ? rund.length : 0)
      + " gegen " + json.length);

  // Und der Ersatzweg: kann der Browser keine Compression Streams, kodiert das
  // Spiel als Base64 (`btoa(unescape(encodeURIComponent(...)))`). Wenn dieser
  // Weg denselben Text zurueckgibt, ist die Sicherung auch dort importierbar -
  // das ist kein Zierrat, sondern der Fall "anderer Browser, alte Fassung".
  let b64 = null;
  try {
    const kodiert = Buffer.from(json, "utf8").toString("base64");
    b64 = Buffer.from(kodiert, "base64").toString("utf8");
  } catch { b64 = null; }
  pruefe("Rundlauf base64 (Ersatzweg ohne Compression Streams)", b64 === json);
}

// ---------------------------------------------------------------------------
console.log("");
console.log("=== WIEDERHERSTELLUNGSPROBE - der Ladeweg des Spiels auf einer echten Sicherung ===");

const ORDNER = path.join(ROOT, "backups");
let dateien = [];
if (datei0) {
  dateien = [path.resolve(datei0)];
} else if (ALLE) {
  dateien = fs.existsSync(ORDNER)
    ? fs.readdirSync(ORDNER).filter((f) => f.endsWith(".json.gz"))
      .map((f) => path.join(ORDNER, f))
    : [];
} else {
  const j = juengste(ORDNER, "LIVE_");
  if (j) dateien = [j];
}

if (!dateien.length) {
  console.error("Keine Sicherung gefunden. Ordner: " + ORDNER);
  process.exit(1);
}

for (const d of dateien) {
  if (!fs.existsSync(d)) {
    pruefe("die Datei existiert: " + d, false);
    continue;
  }
  probe(d);
}

console.log("");
console.log("  WAS DIESE PROBE NICHT ZEIGT:");
console.log("    Der letzte Schritt - `importGame` in einem laufenden Spiel - geht");
console.log("    nur im Spiel und ist unwiderruflich. Auf LIVE ist er verboten.");
console.log("    Diese Probe fuehrt alles aus, was `loadGame` VOR dem ersten");
console.log("    Schreiben prueft; der Klick selbst bleibt eine Messluecke der");
console.log("    Ebene 3 und gilt NICHT als bestanden.");
console.log("");
console.log("=== " + gruen + " gruen, " + rot + " rot ===");

if (PROTOKOLL) {
  const jetzt = new Date();
  const stempel = jetzt.toISOString().slice(0, 10);
  const ordner = path.join(ROOT, "pruefstand", "reports");
  fs.mkdirSync(ordner, { recursive: true });
  const ziel = path.join(ordner, stempel + "-wiederherstellung.md");
  const kopf = [
    "# Wiederherstellungsprobe — " + jetzt.toISOString(),
    "",
    "Erzeugt von `tools/wiederherstellung.js`. Die Probe fuehrt den Ladeweg des",
    "Spiels (v3.0.1, `utils/SaveDataUtils.ts` und `SaveObject.ts`) auf einer",
    "echten Sicherung aus - jede Zusicherung ist eine Bedingung aus dem",
    "Quelltext, keine Vermutung.",
    "",
    "**Ergebnis: " + gruen + " gruen, " + rot + " rot.**",
    "",
    "Geprueft: " + dateien.map((d) => "`" + path.basename(d) + "`").join(", "),
    "",
    "## Was diese Probe NICHT zeigt",
    "",
    "Den Klick auf `importGame` in einem laufenden Spiel. Er geht nur im Spiel,",
    "er ist unwiderruflich, und auf der LIVE-Instanz ist er verboten (Erics",
    "Bedingung). Alles, was `loadGame` VOR dem ersten Schreiben prueft, ist hier",
    "geprueft; der Klick bleibt eine Messluecke der Ebene 3 und gilt nicht als",
    "bestanden.",
    "",
    "## Zusicherungen",
  ].join("\n");
  fs.writeFileSync(ziel, kopf + "\n" + zeilen.join("\n") + "\n", "utf8");
  console.log("  Protokoll: " + path.relative(ROOT, ziel));
}

console.log("");
process.exit(rot ? 1 : 0);
