// TOR.JS - wie lange noch bis Kampfwert 100 (Tor zur Bladeburner-Division)?
//
// WARUM ES DAS GIBT (29.08.2026, 13:30): Die ETA zum Beitritt wurde bis dahin
// linear aus dem Skill-Zuwachs hochgerechnet ("+1 in 6 min mal 36 Punkte").
// Das ist systematisch zu optimistisch, weil die Erfahrung je Skillpunkt
// exponentiell steigt: Die Rechnung von 12:53 kam auf 5,3 h, die exakte auf
// 8,4 h - 3 Stunden Unterschied in einer Zahl, die Eric stuendlich bekommt.
//
// Gerechnet wird stattdessen mit der Umkehrung der Spielformel
// (`PersonObjects/formulas/skill.ts:13`):
//
//     skill = floor(m * (32*ln(exp + 534.6) - 200))
//     exp(z) = e^((z/m + 200)/32) - 534.6
//
// Der Multiplikator m (Augmentierungen mal BitNode-Faktor) wird nicht
// hartcodiert, sondern aus dem laufenden Stand zurueckgerechnet - so bleibt
// das Werkzeug nach jedem Einbau und in jedem Knoten richtig.
//
// Aufruf: node tools/tor.js
// Schreibt data/tor.json und gibt zwei Zeilen aus.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, "..");
const VERLAUF = path.join(WURZEL, "data", "tor-verlauf.json");
const AUSGABE = path.join(WURZEL, "data", "tor.json");
const ZIEL = 100;
const STATS = ["str", "def", "dex", "agi"];

// Ohne zweite Messung: Powerhouse Gym, 1 exp je Cycle mal Ortsfaktor 10,
// 5 Cycles je Sekunde (`Work/Formulas.ts:116`, `gameCPS`) - **mal dem
// Erfahrungs-Multiplikator der Figur**, den `calculateClassEarnings` als
// letzten Schritt anwendet (`multWorkStats(..., person.mults)`, dort :117).
// Der lag am 29.08. um 13:45 bei 1,287 fuer alle vier Kampfwerte
// (`node tools/save.js`), also 12,87 statt 10,0. Die erste Fassung um 13:18
// hatte den Faktor vergessen und die ETA dadurch um 29 Prozent zu lang
// geschaetzt.
//
// DIE 12,87 WAREN AUF DEN 29.08., 13:45 FESTGESCHRIEBEN (29.08., 21:50).
// Der Erfahrungs-Multiplikator steigt mit **jedem** Augmentierungs-Einbau:
// Nach dem Einbau um 19:05 stand er bei 1,548 statt 1,287, das Gym gab also
// 15,48 exp/s. Die Restzeit-Rechnung von 19:38 kam dadurch auf 8,06 h, wo
// rund 6,7 h richtig waren - 20 Prozent zu lang, und der Fehler waechst mit
// jedem weiteren Einbau. Deshalb wird der Faktor jetzt aus dem laufenden
// Spielstand gelesen (`tools/save.js` liest ihn ohne Browser aus IndexedDB,
// Laufzeit 0,4 s); die 12,87 bleiben nur als Rueckfall stehen.
function gymRate() {
  try {
    const aus = execSync("node tools/save.js", {
      cwd: WURZEL, timeout: 20000, encoding: "utf8" });
    const t = /Erfahrung str ([0-9.]+)/.exec(aus);
    const m = t ? Number(t[1]) : NaN;
    if (Number.isFinite(m) && m > 0) return 10 * m;
  } catch { /* Rueckfall unten */ }
  return 12.87;
}
const RATE_NOTFALL = gymRate();
// Aeltere Messungen sind fuer die Rate wertvoller (glaettet Gym-Pausen),
// aber nicht aelter als das hier - sonst steckt ein Reset darin.
const VERLAUF_MAX_MS = 6 * 3600 * 1000;

const brueckeLies = async (datei) => {
  const u = "http://localhost:8795/api/rpc?method=getFile"
    + "&filename=" + encodeURIComponent(datei) + "&server=home";
  const a = new AbortController();
  const t = setTimeout(() => a.abort(), 8000);
  try {
    const r = await fetch(u, { signal: a.signal });
    const j = await r.json();
    return j && j.result ? JSON.parse(j.result) : null;
  } catch { return null; } finally { clearTimeout(t); }
};

const expFuer = (z, m) => Math.exp((z / m + 200) / 32) - 534.6;

const lage = await brueckeLies("data/bblage.json");
if (!lage || !lage.kampfExp) {
  console.log("Keine Lage - Bruecke tot oder Bot schreibt nicht.");
  console.log("URTEIL: BLIND");
  process.exit(1);
}
if (lage.inBladeburner) {
  console.log("Bereits in der Division - dieses Werkzeug ist hier fertig.");
  process.exit(0);
}

// Verlauf pflegen: aeltester brauchbarer Eintrag traegt die Ratenmessung.
let verlauf = [];
try { verlauf = JSON.parse(fs.readFileSync(VERLAUF, "utf8")); } catch { /* erster Lauf */ }
if (!Array.isArray(verlauf)) verlauf = [];
verlauf = verlauf.filter((e) => e && e.zeit && lage.zeit - e.zeit < VERLAUF_MAX_MS
  && e.summe && e.summe <= STATS.reduce((s, k) => s + lage.kampfExp[k], 0));

const summeJetzt = STATS.reduce((s, k) => s + lage.kampfExp[k], 0);
const alt = verlauf[0];
let rate = RATE_NOTFALL, quelle = "Formel (keine zweite Messung)";
// Mindestens 20 Minuten Fenster. Kuerzere Fenster messen nicht die Rate,
// sondern die Tab-Drosselung: Ein gedrosselter Tab holt schubweise nach, und
// ein 18-Minuten-Fenster ergab am 29.08. einmal 9,10 und einmal 15,37 exp/s -
// beide Male denselben Bot, beide Male neben dem Formelwert 12,87.
if (alt && lage.zeit > alt.zeit + 1200000) {
  const r = (summeJetzt - alt.summe) / ((lage.zeit - alt.zeit) / 1000);
  if (r > 0.1) {
    rate = r;
    quelle = "gemessen ueber " + ((lage.zeit - alt.zeit) / 60000).toFixed(0) + " min";
  }
}

let fehlt = 0;
const zeilen = [];
for (const k of STATS) {
  const e = lage.kampfExp[k];
  // Der Skill ist gerundet; die Mitte der Spanne ist der beste Schaetzer.
  const m = (lage.kampf[k] + 0.5) / (32 * Math.log(e + 534.6) - 200);
  const noch = Math.max(0, expFuer(ZIEL, m) - e);
  fehlt += noch;
  zeilen.push(k + " " + lage.kampf[k] + " fehlt " + Math.round(noch));
}

const stunden = fehlt / rate / 3600;
const fertig = new Date(lage.zeit + stunden * 3600 * 1000);
const pad = (n) => String(n).padStart(2, "0");

fs.writeFileSync(AUSGABE, JSON.stringify({
  zeit: lage.zeit, tiefstand: lage.tiefstand, fehlt: Math.round(fehlt),
  rate, quelle, stunden, fertigMs: lage.zeit + stunden * 3600 * 1000,
}, null, 1));
verlauf.unshift({ zeit: lage.zeit, summe: summeJetzt });
fs.writeFileSync(VERLAUF, JSON.stringify(verlauf.slice(0, 40)));

console.log(zeilen.join(" | "));
console.log("Tor in " + stunden.toFixed(1) + " h -> "
  + pad(fertig.getHours()) + ":" + pad(fertig.getMinutes())
  + "  (" + Math.round(fehlt) + " exp bei " + rate.toFixed(2) + " exp/s, " + quelle + ")");
