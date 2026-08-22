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

// --- Bezugswerte des Stapelbetriebs -------------------------------------
// FESTGESCHRIEBEN, wie KAP_ABZUG 0.2 weiter unten, und aus demselben Grund:
// Die Obergrenze ist die Bezugsgroesse, gegen die jede Fassung des Bots
// gemessen wird. Zoege sie mit jedem Drehen an einem Regler nach, vergliche
// der Prozentsatz jede Fassung nur noch mit sich selbst.
//
// Was hier NICHT steht, ist Absicht: BATCH_ZIELE, F_NETZANTEIL, BATCH_ANTEIL
// und MONEY_TARGET_COUNT sind die ZUTEILUNGSregler. Genau die soll die
// Obergrenze ja bewerten - sie darf deshalb nicht von ihnen abhaengen. Die
// hier aufgefuehrten Groessen beschreiben dagegen das VERFAHREN (wie ein
// Stapel gebaut ist), und ein anderes Verfahren ist ein anderer Massstab.
// Wer daran dreht, darf die Decke ueberschreiten - das ist dann das
// Ergebnis, nicht ein Fehler der Messung.
const GAP_MS = 400;            // src/bn4net.js, Abstand der Landungen
const WEAKEN_MARGIN = 1.5;     // Aufschlag auf die Ausgleichsfaeden
const GROW_MARGIN = 1.15;      // Aufschlag auf das Nachwachsen
const F_LEITER = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5];

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

/** Wie src/bn4net.js (dort ausserhalb von main, weil es 0 GB kosten muss). */
function growFaeden(k, moneyMax, start, ziel) {
  if (!(k > 0)) return 0;
  const o = Math.max(0, start);
  const n = Math.min(ziel, moneyMax);
  if (!(n > o)) return 0;
  let x = (n - o) / (1 + (n / 16 + (15 * o) / 16) * k);
  let diff = Infinity, wache = 0;
  while (Math.abs(diff) > 1 && wache++ < 60) {
    const ox = o + x;
    const neu = (x - ox * Math.log(ox / n)) / (1 + ox * k);
    diff = neu - x;
    x = neu;
  }
  if (!Number.isFinite(x) || x < 0) return 0;
  let faeden = Math.ceil(x);
  if (faeden > 0) {
    const probe = (t) => (o + t) * Math.exp(k * t);
    if (probe(faeden - 1) >= n) faeden--;
    else if (probe(faeden) < n) faeden++;
  }
  return Math.max(0, faeden);
}

/**
 * Was ein Ziel im STAPELBETRIEB leisten kann, je Erntanteil f.
 *
 * Nachbau von src/bn4net.js (stapelPlan). Gegen die Telemetrie geprueft am
 * 22.08.2026: omega-net f=0.05 gemeldet 257 GB je Stapel / 81 Kalender-
 * plaetze / $4.91m/s, hier gerechnet 250 / 80 / $4.91m/s; phantasy f=0.15
 * 647/40/$6.31m gegen 629/39/$6.31m; the-hub f=0.02 134/184/$3.80m gegen
 * 130/183/$3.80m. Abweichung unter 3 %, Ursache ist die Sicherheitsdrift
 * zwischen Ablesung und Rechnung.
 *
 * Zwei Groessen je Sprosse:
 *   uptake  wieviel Arbeitsspeicher ein voller Kalender bindet
 *   rate    was er dann je Sekunde bringt (eine Landung je 4*GAP_MS)
 */
function batchOptions(s, p) {
  const hd = s.minDifficulty;
  const pM = percentHacked(s, p, hd);
  const ch = hackChance(s, p, hd);
  const k = growthLog(s, p, hd);
  const t = hackTime(s, p, hd);
  if (!(pM > 0) || !(ch > 0) || !(k > 0) || !(t > 0) || !s.moneyMax) return null;
  // Ein Stapel belegt seinen Platz eine weaken-Dauer lang (4*hackTime), und
  // alle 4*GAP_MS passt der naechste hinein.
  const plaetze = Math.max(1, Math.floor((t * 4 * 1000) / (4 * GAP_MS)));
  const opts = [];
  for (const f of F_LEITER) {
    const hackT = Math.max(1, Math.floor(f / pM));
    const echt = Math.min(0.99, pM * hackT);
    const growT = Math.max(1, Math.ceil(
      growFaeden(k, s.moneyMax, s.moneyMax * (1 - echt), s.moneyMax) * GROW_MARGIN));
    const w1 = Math.max(1, Math.ceil(hackT * FORTIFY_HACK * WEAKEN_MARGIN / WEAKEN_POWER));
    const w2 = Math.max(1, Math.ceil(growT * FORTIFY_GROW * WEAKEN_MARGIN / WEAKEN_POWER));
    const ram = hackT * RAM_HACK + growT * RAM_GROW + (w1 + w2) * RAM_WEAKEN;
    opts.push({
      f,
      uptake: ram * plaetze,
      rate: (echt * s.moneyMax * ch) / (4 * GAP_MS / 1000),
    });
  }
  return { plaetze, opts };
}

/**
 * Die Sprossen eines Ziels als GRENZschritte, auf der konkaven Huelle.
 *
 * Warum die Huelle noetig ist: Die Guete ist ueber f nicht monoton. Bei
 * phantasy bringt f=0.02 248 $/GB*s und f=0.05 259 - die erste Sprosse ist
 * SCHLECHTER als die zweite, weil hackT = floor(f/p) abrundet und bei
 * kleinem f Rundungsverlust entsteht. Ein Greedy ueber die rohen Sprossen
 * wuerde die schlechte erste Sprosse zuerst nehmen und danach nie wieder
 * hergeben. Die konkave Huelle fasst solche Sprossen zusammen, und damit ist
 * der Greedy exakt optimal statt nur ungefaehr.
 */
function grenzSchritte(name, b) {
  const pts = [{ u: 0, r: 0 }, ...b.opts.map((o) => ({ u: o.uptake, r: o.rate }))];
  const hull = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const k = pts[i];
    while (hull.length >= 2) {
      const last = hull[hull.length - 1], vor = hull[hull.length - 2];
      if ((k.r - last.r) / (k.u - last.u) >= (last.r - vor.r) / (last.u - vor.u)) hull.pop();
      else break;
    }
    hull.push(k);
  }
  const out = [];
  for (let i = 1; i < hull.length; i++) {
    const gb = hull[i].u - hull[i - 1].u;
    if (gb > 0) out.push({ name, gb, eff: (hull[i].r - hull[i - 1].r) / gb });
  }
  return out;
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
  // NICHT die Bezugsgroesse: Das Mischungsmodell ist nachweislich zu
  // optimistisch (gemessen 110 gegen 208 $/GB*s). Es steht hier nur, weil
  // die Zuteilung selbst danach sortiert. Der Nenner steht ganz unten.
  console.log("  Modelldecke Mischung      $" + fmt(deckeSumme) + "/s  (unerreichbar, s. u.)");
  // Dieselbe Summe, aber nur ueber Ziele, die das Gate durchlaesst - das ist
  // die Decke, die der Bot HEUTE ohne weitere Aenderung erreichen koennte.
  const offen = zeilen.filter((z) => !z.anlauf || !(z.steadyEff < massstab && massstab > 0));
  console.log("  davon fuer den Bot offen  $"
    + fmt(offen.reduce((n, z) => n + z.steadyEff * z.kap, 0)) + "/s  ("
    + Math.round(offen.reduce((n, z) => n + z.kap, 0)) + " GB)");

  // --- Die Bezugsgroesse fuer jeden Umbau --------------------------------
  //
  // WARUM SIE HIER IM CODE STEHT. Der Bericht zum Stapel-Umbau nannte eine
  // Obergrenze von $28.31m/s und daraus "64 % erreicht". Die Zahl stand
  // nirgends im Code, nur im Commit-Text, und war rekonstruierbar als
  // "aktuelles Netz-RAM mal die Guete genau des besten Ziels". So eine
  // Obergrenze wandert mit jedem Umbau mit und ist zugleich unerreichbar -
  // das beste Ziel kann das Netz gar nicht allein aufnehmen, und die Ziele
  // dahinter fallen steil ab. Eine Bezugsgroesse, die man im Fliesstext
  // erfindet, ist keine.
  //
  // Deshalb: gierig auffuellen ueber die ECHTE Stapelguete, mit einer
  // Aufnahmegrenze je Ziel. Das ist "was mit DIESEM Netz moeglich waere,
  // wenn der Speicher ideal auf die Stapel verteilt waere" - erreichbar,
  // nachrechenbar, und unabhaengig von den Zuteilungsreglern des Bots.
  //
  // Warum die STAPELguete und nicht steadyEff der Mischung: steadyEff ist
  // nachweislich unerreichbar (gemessen 110 gegen 208 $/GB*s), weil die
  // offene Steuerung ihre Wellen nicht taktet. Der Stapel ist geschlossen
  // und liefert, was er verspricht - siehe die Telemetriepruefung bei
  // batchOptions. Eine Obergrenze aus einem Modell, das der Bot beweisbar
  // nicht erreicht, taugt nicht als Nenner.
  const inkremente = [];
  for (const [name, w] of Object.entries(servers)) {
    const s = w.data;
    if (!s.hasAdminRights || !s.moneyMax) continue;
    if (s.requiredHackingSkill > p.skills.hacking) continue;
    const b = batchOptions(s, p);
    if (b) inkremente.push(...grenzSchritte(name, b));
  }
  inkremente.sort((a, b) => b.eff - a.eff);
  let rest = arbeiterRam, decke = 0, gefuellt = 0;
  const anteile = new Map();
  for (const inc of inkremente) {
    const nimm = Math.min(inc.gb, rest);
    if (nimm <= 0) break;
    decke += inc.eff * nimm;
    gefuellt += nimm;
    rest -= nimm;
    anteile.set(inc.name, (anteile.get(inc.name) || 0) + nimm);
  }
  // Dieselbe Decke auf den Speicher, der GERADE auf Zielen liegt. Nur so ist
  // eine Messung ehrlich vergleichbar: Der Bot kann nichts dafuer, dass ein
  // Teil des Netzes in zu kleinen Stuecken liegt - aber er kann etwas dafuer,
  // was er aus dem macht, was er belegt hat.
  let rest2 = belegtSumme, deckeBelegt = 0;
  for (const inc of inkremente) {
    const nimm = Math.min(inc.gb, rest2);
    if (nimm <= 0) break;
    deckeBelegt += inc.eff * nimm;
    rest2 -= nimm;
  }
  console.log("  " + "-".repeat(88));
  console.log("  Arbeiterspeicher im Netz  " + Math.round(arbeiterRam) + " GB");
  console.log("  OBERGRENZE (Stapel-Greedy) $" + fmt(decke) + "/s  auf "
    + Math.round(gefuellt) + " GB");
  console.log("     ideale Verteilung:      "
    + [...anteile.entries()].sort((a, b) => b[1] - a[1])
      .map(([n, gb]) => n + " " + Math.round(gb) + " GB").join(", "));
  console.log("  dieselbe Decke auf die tatsaechlich belegten "
    + Math.round(belegtSumme) + " GB: $" + fmt(deckeBelegt) + "/s");
  console.log("     <- DAS ist der Nenner. Zaehler ist der gemessene Ertrag"
    + " (node tools/meter.js).");
  console.log("");
}

main().catch((e) => { console.log("ziele abgestuerzt: " + e.message); process.exitCode = 1; });
