/**
 * Der Strategiepruefer.
 *
 * WARUM DIESES SKRIPT EXISTIERT
 *
 * Es gibt bereits tools/wache.js. Die fragt: "Lebt der Bot?" - und sie fragt
 * es gut. Am 25.08.2026 hat sie sieben Stunden lang wahrheitsgemaess "laeuft"
 * gemeldet, waehrend der Bot in BitNode 6 in eine Richtung arbeitete, die
 * diesen Knoten nie oeffnet: Netz 91/91 gerootet, Geld im zweistelligen
 * Millionenbereich - und drei von vier Kampfwerten auf 1, obwohl der Ausgang
 * hier ueber 21 Black Operations fuehrt.
 *
 * Ein Pulspruefer kann diesen Fehler nicht finden. Er misst Bewegung, nicht
 * Richtung. Dieses Skript misst die Richtung.
 *
 * WARUM ES EIN SKRIPT IST UND KEIN PROMPT
 *
 * Es wird aus einem wiederkehrenden Loop gerufen, und ein Loop hat kein
 * Gedaechtnis: Die Sitzung dahinter wird zusammengefasst, neu angemeldet oder
 * fuellt ihren Kontext. Ein Pruefer, der "vergleiche mit dem letzten Mal"
 * verlangt, prueft irgendwann gegen eine Erinnerung, die es nicht mehr gibt.
 * Deshalb liegt der Verlauf in einer Datei, nicht im Kopf.
 *
 * AUSGABE
 *
 * Wenige Zeilen Klartext plus ein Urteil in der letzten Zeile:
 *   URTEIL: SPUR         alles laeuft in Richtung Knotenausgang
 *   URTEIL: STAGNATION   der Traeger bewegt sich nicht mehr
 *   URTEIL: BLIND        die Lage ist nicht messbar (Bruecke/Spiel/Telemetrie)
 *   URTEIL: STOERUNG     der Bot hat selbst um Hilfe gerufen
 *
 * Aufruf:  node tools/strategie-check.js [--json]
 */

const BRIDGE = "http://localhost:8795";
const VERLAUF = "data/verlauf-strategie.json";
// So lange darf der Traeger stehen, bevor es Stagnation heisst. Grosszuegig
// gewaehlt: Kampfwerttraining und Rangaufbau sind langsam, und ein Fehlalarm
// kostet mehr Vertrauen als eine halbe Stunde spaetere Meldung.
const STILLSTAND_MS = 75 * 60000;
// Aelter als das, und die Telemetrie beschreibt nicht mehr die Gegenwart.
const FRISCH_MS = 6 * 60000;

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const verlaufPfad = path.join(WURZEL, VERLAUF);

async function rpc(params) {
  const url = new URL("/api/rpc", BRIDGE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const b = await r.json();
    if (b.error) return null;
    return b.result;
  } catch { return null; }
  finally { clearTimeout(t); }
}

const liesJson = async (name) => {
  const roh = await rpc({ method: "getFile", filename: name, server: "home" });
  if (typeof roh !== "string" || !roh.trim()) return null;
  try { return JSON.parse(roh); } catch { return null; }
};

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));

// Der BN6-Steckbrief wird nicht dauernd geschrieben - er ist ein Auftrag, kein
// Dauerlaeufer. Also erst anstossen, dann lesen. Der Auftragskanal wird nur
// belegt, wenn er frei ist: Eine fremde Zeile darf nicht ueberschrieben werden.
async function frischerSteckbrief() {
  const belegt = await rpc({ method: "getFile", filename: "data/task.txt", server: "home" });
  if (typeof belegt === "string" && belegt.trim()) return await liesJson("data/bblage.json");
  await rpc({ method: "pushFile", filename: "data/task.txt",
    content: JSON.stringify(["bblage.js"]), server: "home" });
  for (let i = 0; i < 12; i++) {
    await schlaf(4000);
    const d = await liesJson("data/bblage.json");
    if (d && Date.now() - d.zeit < 90000) return d;
  }
  return await liesJson("data/bblage.json");
}

function ladeVerlauf() {
  try { return JSON.parse(fs.readFileSync(verlaufPfad, "utf8")); }
  catch { return { punkte: [] }; }
}

function speichereVerlauf(v) {
  // Nur die letzten 200 Messpunkte. Der Verlauf ist ein Gedaechtnis, kein
  // Archiv - wer weiter zurueck will, liest die Commits.
  v.punkte = v.punkte.slice(-200);
  fs.mkdirSync(path.dirname(verlaufPfad), { recursive: true });
  fs.writeFileSync(verlaufPfad, JSON.stringify(v, null, 1));
}

/**
 * Der TRAEGER ist die eine Zahl, an der dieser Knoten haengt.
 *
 * Sie ist knotenabhaengig, und genau darin lag der Fehler vom 25.08.: In
 * BitNode 5 war es das Hackniveau, in BitNode 6 ist es der Bladeburner-Rang -
 * ueberwacht wurde weiter das Hackniveau. Wer den Traeger nicht mit dem Knoten
 * wechselt, ueberwacht ab dem Knotenwechsel das falsche Ding.
 */
function traeger(knoten, bb, rep) {
  const bladeKnoten = knoten === 6 || knoten === 7;
  if (bladeKnoten) {
    if (!bb) return null;
    if (!bb.inBladeburner) {
      return { name: "Kampfwert-Tiefstand", wert: bb.tiefstand, ziel: 100,
        phase: "Tor zur Division" };
    }
    return { name: "Bladeburner-Rang", wert: bb.rang, ziel: null,
      phase: "Black Operations" };
  }
  if (!rep) return null;
  return { name: "Hackniveau", wert: rep.hacking, ziel: rep.zielLevel || null,
    phase: "Hacking-Weg" };
}

(async () => {
  const alsJson = process.argv.includes("--json");
  const zeilen = [];
  const sag = (t) => zeilen.push(t);
  let urteil = "SPUR";
  const jetzt = Date.now();

  const aus = () => {
    if (alsJson) {
      console.log(JSON.stringify({ urteil, zeilen, zeit: jetzt }, null, 1));
    } else {
      for (const z of zeilen) console.log(z);
      console.log("URTEIL: " + urteil);
    }
    process.exit(urteil === "SPUR" ? 0 : 1);
  };

  // --- 1. Ist ueberhaupt etwas messbar? ------------------------------------
  const puls = await rpc({ method: "getFile", filename: "data/bn4net.json", server: "home" });
  if (puls === null) {
    sag("Bruecke oder Spiel nicht erreichbar (Port 8795 / RFA 12525).");
    urteil = "BLIND";
    return aus();
  }
  let net = null;
  try { net = JSON.parse(puls); } catch {}
  if (!net || !(jetzt - net.zeit < FRISCH_MS)) {
    const alter = net ? Math.round((jetzt - net.zeit) / 60000) + " min" : "unlesbar";
    sag("bn4net.js meldet sich nicht (Telemetrie " + alter + " alt) - der Motor steht.");
    urteil = "BLIND";
    return aus();
  }

  // --- 2. Hat der Bot selbst um Hilfe gerufen? -----------------------------
  const hilfe = await rpc({ method: "getFile", filename: "data/hilfe.txt", server: "home" });
  if (typeof hilfe === "string" && hilfe.trim()) {
    sag("NOTRUF aus dem Spiel: " + hilfe.trim().slice(0, 300));
    urteil = "STOERUNG";
  }

  // --- 3. Wo stehen wir, und ist das die richtige Richtung? ----------------
  const rep = await liesJson("data/bn4rep.json");
  const bb = await frischerSteckbrief();
  const knoten = (bb && bb.knoten) || (rep && rep.knoten) || null;

  if (!knoten) {
    sag("BitNode nicht bestimmbar - weder Steckbrief noch Reputationsmelder da.");
    urteil = "BLIND";
    return aus();
  }

  const t = traeger(knoten, bb, rep);
  sag("BitNode " + knoten + ", Netz " + net.gerootet + "/" + net.netz
    + ", Geld " + (bb ? Math.round(bb.geld / 1e6) + "m" : "?"));

  if (!t) {
    sag("Der Traeger dieses Knotens ist nicht messbar - Steckbrief fehlt.");
    urteil = "BLIND";
    return aus();
  }

  sag("Phase: " + t.phase);
  sag("Traeger: " + t.name + " = " + t.wert + (t.ziel ? " von " + t.ziel : ""));
  if (bb && (knoten === 6 || knoten === 7)) {
    sag("  Kampf str " + bb.kampf.str + " def " + bb.kampf.def
      + " dex " + bb.kampf.dex + " agi " + bb.kampf.agi
      + "  Stadt " + bb.stadt
      + "  Arbeit " + (bb.arbeit ? (bb.arbeit.klasse || bb.arbeit.typ)
        + (bb.arbeit.ort ? " @ " + bb.arbeit.ort : "") : "keine"));
  }

  // --- 4. Bewegt sich der Traeger? ----------------------------------------
  const v = ladeVerlauf();
  const frueher = v.punkte.filter((x) => x.knoten === knoten && x.traeger === t.name);
  // Bezugspunkt ist der letzte Messpunkt, der NIEDRIGER lag als jetzt - also
  // der Moment, in dem zuletzt etwas vorwaerts ging. Gegen den unmittelbar
  // vorigen Punkt zu vergleichen wuerde jede langsame, aber gesunde Steigung
  // als Stillstand lesen.
  const letzterFortschritt = [...frueher].reverse().find((x) => x.wert < t.wert);
  const aeltester = frueher.length ? frueher[0] : null;

  if (frueher.length === 0) {
    sag("Erster Messpunkt fuer diesen Traeger - Stagnation erst ab dem naechsten Lauf pruefbar.");
  } else {
    const bezug = letzterFortschritt || aeltester;
    const stillMs = jetzt - bezug.zeit;
    const stillMin = Math.round(stillMs / 60000);
    const delta = t.wert - bezug.wert;
    if (delta > 0) {
      sag("Fortschritt: +" + delta + " in " + stillMin + " min.");
    } else if (stillMs > STILLSTAND_MS) {
      sag("STAGNATION: " + t.name + " steht seit " + stillMin
        + " min auf " + t.wert + ".");
      if (urteil === "SPUR") urteil = "STAGNATION";
    } else {
      sag("Kein Fortschritt seit " + stillMin + " min - noch innerhalb der Toleranz ("
        + Math.round(STILLSTAND_MS / 60000) + " min).");
    }
  }

  v.punkte.push({ zeit: jetzt, knoten, traeger: t.name, wert: t.wert,
    phase: t.phase, netz: net.gerootet, geld: bb ? bb.geld : null });
  speichereVerlauf(v);

  return aus();
})();
