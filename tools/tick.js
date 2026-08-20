/**
 * Der Zwischenstand - eine Mini-Tabelle, alle 20 Minuten.
 *
 * WARUM DIESE DATEI UND NICHT lage.js
 *
 * lage.js beantwortet "wie steht es gerade". Diese Datei beantwortet "was hat
 * sich seit dem letzten Blick bewegt" - und das ist beim Zusehen die
 * interessantere Frage. Sie legt dafuer jeden Stand in data/tick-last.json ab
 * und rechnet beim naechsten Aufruf die Differenz. Eine ueber 20 Minuten
 * gemittelte Rate ist ausserdem ehrlicher als die 60-Sekunden-Messung in
 * lage.js --reprate: Der Bot arbeitet in Runden, und eine Minute trifft mal
 * eine Ernte und mal keine.
 *
 * DIE ZIELMARKEN
 *
 * Alles zielt auf Daedalus (Faction/FactionInfo.tsx:138-145):
 *   - 30 Augmentierungen installiert
 *   - 100 Mrd $
 *   - Hacking 2500  ODER  Kampfwerte 1500
 * Daedalus ist die einzige Faktion, die The Red Pill verkauft, und die ist der
 * Ausgang aus BitNode 1.
 *
 * ACHTUNG bei der Aug-Zaehlung: geprueft wird p.augmentations.length
 * (Faction/FactionJoinCondition.ts:130), also die Laenge des Feldes. Der
 * NeuroFlux Governor steht dort als EIN Eintrag, egal auf welcher Stufe. Seine
 * 28 Stufen zaehlen fuer Daedalus als eins - Stapeln bringt hier nichts.
 *
 * Aufruf:  node tools/tick.js          Tabelle ausgeben und Stand merken
 *          node tools/tick.js --peek   nur ausgeben, Stand NICHT ueberschreiben
 */

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://localhost:8795";
const HIER = path.dirname(fileURLToPath(import.meta.url));
const SPEICHER = path.join(HIER, "..", "data", "tick-last.json");
const PEEK = process.argv.includes("--peek");

// Zielmarken fuer Daedalus
const ZIEL_AUGS = 30;
const ZIEL_HACK = 2500;
const ZIEL_GELD = 100e9;
// Ab Favor 150 darf man spenden (Constants.ts:31 BaseFavorToDonate)
const ZIEL_FAVOR = 150;

// Faction/formulas/favor.ts
const favorToRep = (f) => 25000 * Math.expm1(0.019802627296153 * f);
const repToFavor = (r) => Math.log1p(r / 25000) / 0.019802627296153;

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t", "q"];
  let i = 0;
  let x = n;
  while (Math.abs(x) >= 1000 && i < u.length - 1) { x /= 1000; i++; }
  return "$" + (Math.abs(x) < 10 ? x.toFixed(2) : x.toFixed(1)) + u[i];
};

const zahl = (n) => {
  if (!Number.isFinite(n)) return "--";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return n.toFixed(Math.abs(n) < 10 ? 1 : 0);
};

// Ein Zuwachs mit Vorzeichen - ohne Vorzeichen kann man Stillstand nicht von
// Rueckgang unterscheiden, und beides bedeutet etwas voellig anderes.
const delta = (jetzt, vorher, fmt) => {
  if (!Number.isFinite(vorher)) return "";
  const d = jetzt - vorher;
  if (Math.abs(d) < 1e-9) return "0";
  return (d > 0 ? "+" : "-") + fmt(Math.abs(d));
};

async function hole(pfad) {
  const res = await fetch(BASE + pfad);
  return await res.json();
}

async function stand() {
  const body = await hole("/api/rpc?method=getSaveFile");
  if (body.error) throw new Error(body.error);
  const roh = Buffer.from(body.result.save, "latin1");
  return JSON.parse(zlib.gunzipSync(roh).toString("utf8"));
}

function sammle(s, tele) {
  const p = JSON.parse(s.data.PlayerSave).data;
  const f = JSON.parse(s.data.FactionsSave);
  const mitglied = p.factions || [];

  // Depotwert - beim Install ersatzlos weg, gehoert deshalb getrennt gezeigt.
  let depot = 0;
  if (s.data.StockMarketSave) {
    const sm = JSON.parse(s.data.StockMarketSave);
    for (const k of Object.keys(sm)) {
      const a = sm[k] && (sm[k].data || sm[k]);
      if (a && a.playerShares) depot += a.playerShares * (a.price || 0);
    }
  }

  // Die Faktion, an der gerade gearbeitet wird - ihr Fortschritt ist der
  // eigentliche Zwischenstand.
  const w = p.currentWork && (p.currentWork.data || p.currentWork);
  const arbeitAn = w && w.factionName ? w.factionName : null;

  const faktionen = {};
  for (const k of mitglied) {
    const d = (f[k] && (f[k].data || f[k])) || {};
    const rep = Number.isFinite(d.playerReputation) ? d.playerReputation : 0;
    const favor = Number.isFinite(d.favor) ? d.favor : 0;
    faktionen[k] = {
      rep, favor,
      // Was aus der angesammelten Reputation beim naechsten Reset an Favor
      // wird. DAS ist der Fortschrittsbalken, nicht der heutige Favor-Wert -
      // der bewegt sich zwischen zwei Resets ueberhaupt nicht.
      favorNachReset: repToFavor(favorToRep(favor) + rep),
    };
  }

  // Zaehlt der Fokus gerade? Nur ohne das Neuroreceptor Management Implant
  // (PlayerObjectGeneralMethods.ts:622-628). work.js entscheidet das drinnen
  // an der Oberflaeche, weil ein Skript die Augmentierungen nicht abfragen
  // kann - hier draussen steht die Wahrheit im Spielstand, und damit ist das
  // hier die Gegenprobe auf die Entscheidung von drinnen. Stimmen beide nicht
  // ueberein, verlieren wir lautlos ein Fuenftel jeder Arbeitsstunde.
  const nrm = (p.augmentations || []).some((a) => a.name === "Neuroreceptor Management Implant");

  const t = tele.telemetry || {};
  return {
    t: Date.now(),
    nrm,
    hack: p.skills.hacking,
    multHack: (p.mults || {}).hacking || 1,
    multRep: (p.mults || {}).faction_rep || 1,
    geld: p.money,
    depot,
    augs: (p.augmentations || []).length,
    queue: (p.queuedAugmentations || []).length,
    arbeitAn,
    fokus: !!p.focus,
    faktionen,
    ertrag: (t.income || {}).scriptIncome,
    expRate: (t.income || {}).scriptExpGain,
    ramUsed: (t.ram || {}).used,
    ramMax: (t.ram || {}).max,
    rooted: (t.network || {}).rooted,
    runde: t.cycle,
    phase: t.phase,
  };
}

function tabelle(n, v) {
  const dt = v ? (n.t - v.t) / 1000 : null;
  const min = dt ? (dt / 60).toFixed(0) : "?";
  const uhr = new Date(n.t).toTimeString().slice(0, 5);

  const zeilen = [];
  const zeile = (was, stand, ziel, zuwachs) => zeilen.push([was, stand, ziel, zuwachs || ""]);

  zeile("Hacking", String(n.hack), ZIEL_HACK + " (Daedalus)",
    delta(n.hack, v && v.hack, (x) => String(Math.round(x))));
  zeile("Augmentierungen", String(n.augs) + (n.queue ? " +" + n.queue + " offen" : ""),
    ZIEL_AUGS + " verschiedene",
    delta(n.augs, v && v.augs, (x) => String(Math.round(x))));
  zeile("hacking-Mult", n.multHack.toFixed(3), "der eigentliche Hebel",
    delta(n.multHack, v && v.multHack, (x) => x.toFixed(3)));

  const fa = n.arbeitAn;
  if (fa && n.faktionen[fa]) {
    const d = n.faktionen[fa];
    const vd = v && v.faktionen && v.faktionen[fa];
    const rate = vd && dt ? (d.rep - vd.rep) / dt : null;
    zeile("Rep " + fa, zahl(d.rep),
      rate ? rate.toFixed(1) + " Rep/s" : "-",
      delta(d.rep, vd && vd.rep, zahl));
    zeile("  Favor n. Reset", d.favorNachReset.toFixed(1),
      ZIEL_FAVOR + " (Spenden)",
      delta(d.favorNachReset, vd && vd.favorNachReset, (x) => x.toFixed(1)));
    if (rate && rate > 0) {
      const fehlt = favorToRep(ZIEL_FAVOR) - favorToRep(d.favor) - d.rep;
      if (fehlt > 0) {
        const h = fehlt / rate / 3600;
        zeile("  Rest bis 150", (h < 1 ? (h * 60).toFixed(0) + " min" : h.toFixed(1) + " h"),
          zahl(fehlt) + " Rep", "");
      }
    }
  } else {
    zeile("Faktionsarbeit", "KEINE", "ohne laeuft keine Rep", "");
  }

  // Der stille Verlust: ohne Implant und ohne Fokus laufen 20 % ins Leere,
  // und nichts im Spiel zeigt es an.
  if (fa && !n.nrm && !n.fokus) {
    zeile("  ACHTUNG Fokus", "aus, kein Implant", "kostet 20 % Rep!", "");
  }

  zeile("Geld", geld(n.geld), n.geld >= ZIEL_GELD ? "Ziel erfuellt" : geld(ZIEL_GELD),
    delta(n.geld, v && v.geld, geld));
  if (n.depot > 0) {
    zeile("  Depot", geld(n.depot), "beim Install weg",
      delta(n.depot, v && v.depot, geld));
  }
  zeile("Ertrag", geld(n.ertrag) + "/s", "-",
    delta(n.ertrag, v && v.ertrag, geld));
  zeile("Netz", Math.round((n.ramUsed || 0) / 1000) + " / "
    + Math.round((n.ramMax || 0) / 1000) + " TB belegt",
    n.rooted + " Rechner", "");

  const b = [
    Math.max(...zeilen.map((z) => z[0].length)),
    Math.max(...zeilen.map((z) => z[1].length)),
    Math.max(...zeilen.map((z) => z[2].length)),
  ];
  const strich = "  " + "-".repeat(b[0] + b[1] + b[2] + 15);

  console.log("");
  console.log("  ZWISCHENSTAND " + uhr
    + (v ? "   (Delta ueber " + min + " min)" : "   (erster Tick)")
    + "   Runde " + n.runde + ", " + n.phase);
  console.log(strich);
  for (const z of zeilen) {
    console.log("  " + z[0].padEnd(b[0]) + "  " + z[1].padStart(b[1])
      + "  " + z[2].padEnd(b[2]) + "  " + z[3].padStart(9));
  }
  console.log(strich);
  console.log("");
}

async function main() {
  let s, tele;
  try {
    [s, tele] = await Promise.all([stand(), hole("/api/state")]);
  } catch (e) {
    console.log("KEIN ZUGRIFF: " + e.message);
    console.log("Laeuft die Bruecke? bitburner\\start.cmd");
    process.exit(1);
  }
  const jetzt = sammle(s, tele);

  let vorher = null;
  try {
    vorher = JSON.parse(fs.readFileSync(SPEICHER, "utf8"));
  } catch { /* erster Lauf - kein Vergleich moeglich, das ist kein Fehler */ }

  tabelle(jetzt, vorher);
  if (!PEEK) fs.writeFileSync(SPEICHER, JSON.stringify(jetzt), "utf8");
}

main().catch((e) => console.log("Fehler: " + e.message));
