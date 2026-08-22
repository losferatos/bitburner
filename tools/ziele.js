/**
 * Zieltafel: was jeder Geldserver im Gleichgewicht bringen KOENNTE, was er
 * aufnehmen kann, in welchem Zustand er steht und wieviel Arbeiterspeicher
 * gerade auf ihm liegt.
 *
 * WOZU
 *
 * tools/meter.js sagt, wieviel herauskommt. Es sagt nicht, WARUM ein Ziel
 * nichts bekommt. Genau diese Frage stand am 22.08.2026 im Weg: Die Telemetrie
 * meldete 137.000 GB Aufnahmefaehigkeit im Netz, zugeteilt wurden aber nur
 * 3.400 GB je Runde, und der Rest ging als "Ueberschuss" an die Erfahrung.
 * Ohne eine Aufstellung je Ziel laesst sich nicht unterscheiden, ob die Ziele
 * voll sind, ob das Nutzen-Gate der Anlaufphase sie aussperrt oder ob sie gar
 * nicht erst in der Kandidatenliste stehen.
 *
 * WARUM DIE FORMELN HIER NACHGEBAUT SIND
 *
 * Sonst gilt in diesem Projekt: lieber das Spiel fragen als nachrechnen. Hier
 * geht das nicht - jede ns-Abfrage kostet Arbeitsspeicher IM Spiel und muesste
 * in bn4net.js laufen, also genau in dem Skript, das gerade gemessen wird.
 * Ein Werkzeug, das den Messgegenstand veraendert, ist wertlos. Deshalb die
 * Formeln aus reference/bitburner-src, jede mit Fundstelle. Sie werden gegen
 * die Telemetrie von bn4net.js gegengeprueft (kapGesamtGb, deckeDollarProS);
 * laufen die auseinander, ist DIESE Datei falsch, nicht das Spiel.
 *
 * Aufruf:  node tools/ziele.js [--alle]
 */

import zlib from "node:zlib";

const BASE = "http://localhost:8795";

// BitNode 4 (BitNode.tsx:626-655). Was dort nicht steht, ist 1
// (BitNodeMultipliers.ts).
const BN = { ScriptHackMoney: 0.2, HackExpGain: 0.4, HackingSpeedMultiplier: 1, ServerGrowthRate: 1 };
const SERVER_BASE_GROWTH_INCR = 0.03;          // Server/data/Constants.ts:7
const SERVER_MAX_GROWTH_LOG = 0.00349388925425578; // :8
const FORTIFY_HACK = 0.002;                    // :9
const FORTIFY_GROW = 0.004;                    // hack-Betrag mal zwei
const WEAKEN_POWER = 0.05;                     // :10
// Dieselben Konstanten wie in src/bn4net.js. Weichen sie ab, misst dieses
// Werkzeug etwas anderes als der Bot tut.
const MIX_MONEY_HIGH = 0.95;
const MIX_MONEY_LOW = 0.75;
// Schwelle der Anlaufphase, seit 22.08.2026 vom Regelband entkoppelt
// (src/bn4net.js, MIX_MONEY_PANIK).
const MIX_MONEY_PANIK = 0.40;
const MIX_SEC_BAD = 5.0;
const RAM_HACK = 1.7, RAM_GROW = 1.75, RAM_WEAKEN = 1.75;

async function fetchSave() {
  const res = await fetch(BASE + "/api/rpc?method=getSaveFile");
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return JSON.parse(zlib.gunzipSync(Buffer.from(body.result.save, "latin1")).toString("utf8"));
}

const intBonus = (intelligence, weight = 1) =>
  1 + (weight * Math.pow(intelligence || 0, 0.8)) / 600;

/** Hacking.ts:59-77. Sekunden. */
function hackTime(s, p, hd) {
  const skillFactor = (2.5 * s.requiredHackingSkill * hd + 500) / (p.skills.hacking + 50);
  return (5 * skillFactor)
    / (p.mults.hacking_speed * BN.HackingSpeedMultiplier * intBonus(p.skills.intelligence));
}

/** Hacking.ts:42-56. Anteil des AKTUELLEN Guthabens je Faden. */
function percentHacked(s, p, hd) {
  if (hd >= 100) return 0;
  const skillMult = (p.skills.hacking - (s.requiredHackingSkill - 1)) / p.skills.hacking;
  return Math.min(1, Math.max(
    ((100 - hd) / 100 * skillMult * p.mults.hacking_money * BN.ScriptHackMoney) / 240, 0));
}

/** Hacking.ts:9-23. */
function hackChance(s, p, hd) {
  if (hd >= 100) return 0;
  const skillMult = Math.max(1, 1.75 * p.skills.hacking);
  const skillChance = (skillMult - s.requiredHackingSkill) / skillMult;
  return Math.min(1, Math.max(0,
    skillChance * ((100 - hd) / 100) * p.mults.hacking_chance * intBonus(p.skills.intelligence)));
}

/** grow.ts:8-28, ein Faden, ein Kern. Das ist das k der Mischung. */
function growthLog(s, p, hd) {
  if (!s.serverGrowth) return 0;
  let adj = Math.log1p(SERVER_BASE_GROWTH_INCR / hd);
  if (adj >= SERVER_MAX_GROWTH_LOG) adj = SERVER_MAX_GROWTH_LOG;
  return adj * (s.serverGrowth / 100) * BN.ServerGrowthRate * p.mults.hacking_grow;
}

/**
 * Die beiden Kennzahlen, die src/bn4net.js unter demselben Namen fuehrt -
 * beide auf minDifficulty gerechnet, also fuer den Zustand NACH dem Saeubern.
 */
function kennzahlen(s, p) {
  const hd = s.minDifficulty;
  const pM = percentHacked(s, p, hd);
  const chance = hackChance(s, p, hd);
  const k = growthLog(s, p, hd);
  const t = hackTime(s, p, hd);
  const beute = pM * chance;
  if (!(beute > 0) || !(k > 0) || !(t > 0)) return null;
  const gph = beute / k;                                       // grow je hack
  const wph = (FORTIFY_HACK * chance + FORTIFY_GROW * gph) / WEAKEN_POWER;
  const gbSekProEinheit = t * (RAM_HACK + 3.2 * gph * RAM_GROW + 4 * wph * RAM_WEAKEN);
  return {
    steadyEff: (s.moneyMax * MIX_MONEY_HIGH * beute) / gbSekProEinheit,
    kapazitaet: 0.2 * gbSekProEinheit / (t * beute),   // mit KAP_ABZUG 0.2
    kapProAbzug: gbSekProEinheit / (t * beute),        // je Einheit KAP_ABZUG
    hackTime: t, beute, gph, wph,
  };
}

const fmt = (n) => {
  for (const [d, sfx] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
    if (Math.abs(n) >= d) return (n / d).toFixed(2) + sfx;
  }
  return n.toFixed(1);
};

async function main() {
  const alle = process.argv.includes("--alle");
  const save = await fetchSave();
  const p = JSON.parse(save.data.PlayerSave).data;
  const servers = JSON.parse(save.data.AllServersSave);

  // Belegter Arbeiterspeicher je Ziel, aus denselben laufenden Skripten, die
  // auch bn4net.js ueber ns.ps sieht.
  const belegt = {};
  for (const w of Object.values(servers)) {
    for (const e of w.data.runningScripts || []) {
      const r = e.data;
      if (!r.filename.startsWith("worker/") || r.filename === "worker/share.js") continue;
      const t = String(r.args[0] ?? "?");
      belegt[t] = (belegt[t] || 0) + r.ramUsage * r.threads;
    }
  }

  // Arbeiterspeicher, den es im Netz ueberhaupt gibt. Gebraucht fuer die
  // Obergrenze: Ist die Aufnahme aller Ziele groesser als das Netz, ist nicht
  // sie der Engpass, sondern der Speicher.
  let netzRam = 0, werkzeugRam = 0;
  for (const w of Object.values(servers)) {
    const s = w.data;
    if (!s.hasAdminRights) continue;
    netzRam += s.maxRam || 0;
    for (const e of s.runningScripts || []) {
      if (!e.data.filename.startsWith("worker/")) werkzeugRam += e.data.ramUsage * e.data.threads;
    }
  }
  // Wie in src/bn4net.js: home behaelt ein Viertel, mindestens 24 GB, und
  // share ist auf 400 GB gedeckelt.
  const homeMax = servers["home"] ? servers["home"].data.maxRam : 0;
  const arbeiterRam = Math.max(0, netzRam - werkzeugRam - Math.max(24, homeMax / 4) - 400);

  const zeilen = [];
  let kapSumme = 0, deckeSumme = 0, belegtSumme = 0;
  for (const [name, w] of Object.entries(servers)) {
    const s = w.data;
    if (!s.hasAdminRights || !s.moneyMax) continue;
    if (s.requiredHackingSkill > p.skills.hacking) continue;
    const kz = kennzahlen(s, p);
    if (!kz) continue;
    const frac = s.moneyAvailable / s.moneyMax;
    const secOver = s.hackDifficulty - s.minDifficulty;
    const anlauf = secOver > MIX_SEC_BAD || frac < MIX_MONEY_PANIK;
    zeilen.push({
      name, frac, secOver, anlauf,
      steadyEff: kz.steadyEff, kap: kz.kapazitaet, kapProAbzug: kz.kapProAbzug,
      moneyMax: s.moneyMax, belegt: belegt[name] || 0,
    });
    kapSumme += kz.kapazitaet;
    deckeSumme += kz.steadyEff * kz.kapazitaet;
    belegtSumme += belegt[name] || 0;
  }
  zeilen.sort((a, b) => b.steadyEff - a.steadyEff);

  // Massstab des Nutzen-Gates, wie src/bn4net.js ihn seit dem 22.08.2026
  // bildet: Der Anlauf verdraengt nur dann etwas, wenn der Speicher knapp
  // ist. Reicht er fuer den vollen Bedarf des Dauerbetriebs, ist der
  // Grenzertrag null und das Gate aus; sonst zaehlt das SCHLECHTESTE
  // laufende Ziel, denn genau das wird verdraengt.
  const laufend = zeilen.filter((z) => !z.anlauf);
  const bedarf = laufend.reduce((n, z) => n + Math.max(0, z.kap - z.belegt), 0);
  const knapp = arbeiterRam - belegtSumme <= bedarf;
  const massstab = !knapp ? 0
    : (laufend.length ? Math.min(...laufend.map((z) => z.steadyEff)) : 0);

  console.log("");
  console.log("  ZIELTAFEL   Hacking " + p.skills.hacking
    + "   Massstab des Gates " + Math.round(massstab) + " $/GB*s");
  console.log("  " + "-".repeat(88));
  console.log("  Ziel                 $/GB*s     Kap GB   belegt GB   frei GB   frac   sec+   Zustand");
  for (const z of zeilen) {
    if (!alle && z.steadyEff < 1) continue;
    const zustand = z.anlauf
      ? (z.steadyEff < massstab && massstab > 0 ? "ANLAUF-GESPERRT (Gate)" : "Anlauf")
      : "Dauerbetrieb";
    console.log("  " + z.name.padEnd(20)
      + Math.round(z.steadyEff).toString().padStart(7)
      + Math.round(z.kap).toString().padStart(11)
      + Math.round(z.belegt).toString().padStart(12)
      + Math.round(Math.max(0, z.kap - z.belegt)).toString().padStart(10)
      + z.frac.toFixed(3).padStart(7)
      + z.secOver.toFixed(1).padStart(7)
      + "   " + zustand);
  }
  console.log("  " + "-".repeat(88));
  console.log("  Aufnahme aller Ziele      " + Math.round(kapSumme) + " GB");
  console.log("  davon belegt              " + Math.round(belegtSumme) + " GB");
  console.log("  Modelldecke (alle voll)   $" + fmt(deckeSumme) + "/s");
  // Dieselbe Summe, aber nur ueber Ziele, die das Gate durchlaesst - das ist
  // die Decke, die der Bot HEUTE ohne weitere Aenderung erreichen koennte.
  const offen = zeilen.filter((z) => !z.anlauf || !(z.steadyEff < massstab && massstab > 0));
  console.log("  davon fuer den Bot offen  $"
    + fmt(offen.reduce((n, z) => n + z.steadyEff * z.kap, 0)) + "/s  ("
    + Math.round(offen.reduce((n, z) => n + z.kap, 0)) + " GB)");

  // --- Die Bezugsgroesse fuer jeden Umbau --------------------------------
  // Gierig auffuellen in der Reihenfolge der Guete, begrenzt durch den
  // Speicher, den es wirklich gibt. Das ist "was mit DIESEM Netz moeglich
  // waere" - die Zahl, gegen die gemessen wird.
  //
  // Gerechnet wird ausdruecklich mit dem FESTEN Bezugswert KAP_ABZUG 0.2,
  // nicht mit dem, was gerade in bn4net.js steht. Sonst waechst die
  // Obergrenze mit, sobald jemand an KAP_ABZUG dreht, und der Prozentsatz
  // vergliche jede Fassung nur noch mit sich selbst. Wer KAP_ABZUG anhebt,
  // darf diese Decke ueberschreiten - das ist dann das Ergebnis, nicht ein
  // Fehler der Messung.
  let rest = arbeiterRam, decke = 0, gefuellt = 0;
  for (const z of zeilen) {
    const nimm = Math.min(z.kap, rest);
    if (nimm <= 0) break;
    decke += z.steadyEff * nimm;
    gefuellt += nimm;
    rest -= nimm;
  }
  console.log("  " + "-".repeat(88));
  console.log("  Arbeiterspeicher im Netz  " + Math.round(arbeiterRam) + " GB");
  console.log("  OBERGRENZE mit diesem Netz $" + fmt(decke) + "/s  (bestes zuerst gefuellt, "
    + Math.round(gefuellt) + " GB, Bezug KAP_ABZUG 0.2)");
  console.log("");
}

main().catch((e) => { console.log("ziele abgestuerzt: " + e.message); process.exitCode = 1; });
