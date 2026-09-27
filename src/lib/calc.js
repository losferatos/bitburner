/**
 * Die Rechenformeln des Spiels, nachgebaut aus dem Quellcode von v3.0.1.
 *
 * Warum nachbauen statt ns.formulas benutzen? Die formulas-API setzt das
 * Programm Formulas.exe voraus, und das kostet 5 Milliarden. Bis dahin waeren
 * wir blind. Diese Datei kostet dagegen 0 GB RAM, weil sie nur rechnet und
 * keine einzige ns-Funktion aufruft.
 *
 * Alle Formeln sind aus dem Spielcode abgeschrieben, Quelle jeweils dabei.
 * Wenn das Spiel aktualisiert wird, gehoert diese Datei geprueft.
 */

// --- Konstanten aus src/Server/data/Constants.ts -------------------------
export const SERVER_BASE_GROWTH_INCR = 0.03;
export const SERVER_MAX_GROWTH_LOG = 0.00349388925425578; // log1p(0.0035)
export const SERVER_FORTIFY_AMOUNT = 0.002; // Security-Zuwachs je hack-Thread
export const SERVER_WEAKEN_AMOUNT = 0.05; // Security-Abbau je weaken-Thread

// grow() erhoeht die Security doppelt so stark wie hack()
export const GROW_FORTIFY_AMOUNT = 2 * SERVER_FORTIFY_AMOUNT;

// Verhaeltnis der Laufzeiten, fest und unabhaengig von Server und Spieler.
// src/Hacking.ts:72, :84, :91
export const GROW_TIME_FACTOR = 3.2;
export const WEAKEN_TIME_FACTOR = 4;

/**
 * Notnagel-Preise der Arbeiter, in GB. NUR als Vorgabewert gedacht - wer
 * rechnen will, reicht die echten Kosten aus ns.getScriptRam durch. Sonst
 * luegt jede Speicherrechnung still weiter, wenn ein Arbeiter sich aendert.
 * 1.60 GB Grundlast (RamCostConstants.Base) + 0.10 hack / 0.15 grow / 0.15 weaken.
 *
 * Die Felder heissen hackT/growT/weakenT und nicht hack/grow/weaken, und das
 * ist kein Schoenheitsfehler, sondern spart bares RAM: Bitburners
 * Speicherrechner laeuft ueber den Syntaxbaum und bucht JEDEN Bezeichner,
 * dessen Name auf eine ns-Funktion passt - auch `costs.hack`, obwohl `costs`
 * kein `ns` ist (Script/RamCalculations.ts, Besucher Identifier und
 * MemberExpression). Ein einziges `costs.hack` irgendwo im Importbaum kostet
 * das Hauptskript 0.10 GB, `.grow` und `.weaken` je 0.15 GB. Schluessel in
 * Objektliteralen sind dagegen frei (acorn-walk besucht bei Property nur den
 * Wert, den Schluessel nur wenn er berechnet ist) - deshalb darf die
 * Telemetrie weiterhin `{ hack: ... }` schreiben.
 */
export const WORKER_RAM = { hackT: 1.7, growT: 1.75, weakenT: 1.75 };

/** Kandidaten fuer den Erntanteil, aufsteigend. */
export const HACK_FRACTIONS = [0.02, 0.05, 0.1, 0.2, 0.4];

/**
 * Speicherbedarf eines VOLLSTAENDIGEN Zyklus fuer den Erntanteil f.
 *
 * Ein Zyklus ist: f des Guthabens abschoepfen, wieder auffuellen, die dabei
 * entstandene Sicherheit abbauen. Nur wenn alle drei Teile zusammen in das
 * Speicherbudget passen, ist f ueberhaupt durchfuehrbar - sonst hackt der Bot
 * ein Ziel leer und bekommt es nie wieder voll.
 *
 * @param {{secMin: number, reqSkill: number, moneyMax: number, growth: number}} s
 * @param {object} p Spielerwerte
 * @param {number} f Anteil des Maximalguthabens
 * @param {{hackT: number, growT: number, weakenT: number}} costs
 * @returns {null | {hackT: number, growT: number, weakenT: number, ram: number}}
 */
export function cycleCost(s, p, f, costs = WORKER_RAM) {
  const prepped = { sec: s.secMin, reqSkill: s.reqSkill, growth: s.growth, moneyMax: s.moneyMax, root: true };
  const pct = hackPercent(prepped, p);
  if (!(pct > 0) || !(f > 0) || f >= 1) return null;

  const hackT = Math.ceil(f / pct);
  // Nicht ln(1/(1-f))/k von Hand: growThreads loest dieselbe Gleichung wie das
  // Spiel und rechnet den additiven $1-je-Faden mit. Die Handformel schaetzt
  // den Bedarf zu hoch und wuerde f unnoetig klein halten.
  const growT = growThreads(prepped, s.moneyMax, s.moneyMax * (1 - f), p, 1);
  if (!Number.isFinite(growT)) return null;

  // Sicherheit, die abschoepfen und nachwachsen erzeugen, wieder abbauen.
  const weakenT = weakenThreads(hackT * SERVER_FORTIFY_AMOUNT + growT * GROW_FORTIFY_AMOUNT);
  const ram = hackT * costs.hackT + growT * costs.growT + weakenT * costs.weakenT;
  return { hackT, growT, weakenT, ram };
}

/**
 * Groesster Erntanteil, dessen voller Zyklus noch ins Budget passt.
 *
 * Warum das kein fester Wert sein darf: 0.1 war fuer ein Netz mit 274 TB
 * gewaehlt. Nach einem Reset stehen 116 GB - dort passt nicht einmal das
 * Nachwachsen eines einzigen 10-Prozent-Happens hinein, der Bot schoepft ab
 * und bekommt das Ziel nie wieder voll. Der Anteil muss also mit dem Netz
 * mitwachsen und nach dem Reset von selbst auf 0.02 zurueckfallen.
 *
 * Passt gar nichts, wird der kleinste Anteil genommen: lieber ein winziger
 * Happen als Stillstand.
 *
 * @param {object} s Server
 * @param {object} p Spielerwerte
 * @param {number} ramShare Speicher, der diesem Ziel zusteht, in GB
 * @param {{hackT: number, growT: number, weakenT: number}} costs
 * @returns {{fraction: number, cost: object|null, fits: boolean}}
 */
export function pickHackFraction(s, p, ramShare, costs = WORKER_RAM) {
  let best = { fraction: HACK_FRACTIONS[0], cost: null, fits: false };
  for (const f of HACK_FRACTIONS) {
    const c = cycleCost(s, p, f, costs);
    if (!c) continue;
    if (!best.cost) best = { fraction: f, cost: c, fits: false };
    if (c.ram <= ramShare) best = { fraction: f, cost: c, fits: true };
  }
  return best;
}

/**
 * Intelligence-Bonus. src/PersonObjects/formulas/intelligence.ts:1
 * @param {number} intelligence
 */
export function intBonus(intelligence) {
  return 1 + Math.pow(intelligence ?? 0, 0.8) / 600;
}

/**
 * Kern-Bonus des ausfuehrenden Rechners. Wirkt NUR auf grow und weaken.
 * src/Server/ServerHelpers.ts:287
 * @param {number} cores
 */
export function coreBonus(cores = 1) {
  return 1 + (cores - 1) / 16;
}

/**
 * Erfolgswahrscheinlichkeit eines hack-Aufrufs.
 * Ohne Root-Zugriff ist sie exakt 0 - Nuken ist Voraussetzung, nicht Kuer.
 * src/Hacking.ts:9
 *
 * @param {{sec: number, reqSkill: number, root: boolean}} server
 * @param {{skill: number, int: number, multChance: number}} p
 */
export function hackChance(server, p) {
  if (!server.root || server.sec >= 100) return 0;
  const skillMult = Math.max(1.75 * p.skill, 1);
  const skillChance = (skillMult - server.reqSkill) / skillMult;
  const difficultyMult = (100 - server.sec) / 100;
  const chance = skillChance * difficultyMult * p.multChance * intBonus(p.int);
  return Math.min(1, Math.max(0, chance));
}

/**
 * Anteil des vorhandenen Geldes, den EIN hack-Thread abschoepft.
 * Kein Intelligence-Bonus. src/Hacking.ts:44
 *
 * @param {{sec: number, reqSkill: number}} server
 * @param {{skill: number, multMoney: number}} p
 * @param {number} bnScriptHackMoney BitNode-Multiplikator, in BN1 gleich 1
 */
export function hackPercent(server, p, bnScriptHackMoney = 1) {
  if (server.sec >= 100) return 0;
  const difficultyMult = (100 - server.sec) / 100;
  const skillMult = (p.skill - (server.reqSkill - 1)) / p.skill;
  const percent = (difficultyMult * skillMult * p.multMoney * bnScriptHackMoney) / 240;
  return Math.min(1, Math.max(0, percent));
}

/**
 * Dauer eines hack-Aufrufs in Sekunden. src/Hacking.ts:60
 *
 * @param {{sec: number, reqSkill: number}} server
 * @param {{skill: number, int: number, multSpeed: number}} p
 * @param {number} bnSpeed
 */
export function hackTime(server, p, bnSpeed = 1) {
  const skillFactor = (2.5 * server.reqSkill * server.sec + 500) / (p.skill + 50);
  return (5 * skillFactor) / (p.multSpeed * bnSpeed * intBonus(p.int));
}

export function growTime(server, p, bnSpeed = 1) {
  return GROW_TIME_FACTOR * hackTime(server, p, bnSpeed);
}

export function weakenTime(server, p, bnSpeed = 1) {
  return WEAKEN_TIME_FACTOR * hackTime(server, p, bnSpeed);
}

/**
 * XP pro Thread - gleich fuer hack, grow und weaken.
 * Haengt an baseDifficulty, NICHT an der aktuellen Security. src/Hacking.ts:30
 *
 * @param {number} secBase
 * @param {number} multExp
 * @param {number} bnExp
 */
export function expPerThread(secBase, multExp = 1, bnExp = 1) {
  if (!secBase) return 0;
  return (3 + 0.3 * secBase) * multExp * bnExp;
}

/**
 * Wachstumsexponent k fuer EINEN grow-Thread.
 * growthMultiplier(threads) = exp(k * threads)
 * src/Server/formulas/grow.ts:8
 *
 * @param {{sec: number, growth: number}} server
 * @param {number} multGrow
 * @param {number} cores
 * @param {number} bnGrowthRate
 */
export function growthLogPerThread(server, multGrow = 1, cores = 1, bnGrowthRate = 1) {
  if (!server.growth) return -Infinity;
  // Der Deckel greift ab sec <= 8.5714: darunter bringt Weakenen dem
  // Wachstum nichts mehr (fuer hack und die Laufzeiten aber schon).
  let adjGrowthLog = Math.log1p(SERVER_BASE_GROWTH_INCR / server.sec);
  if (adjGrowthLog >= SERVER_MAX_GROWTH_LOG) adjGrowthLog = SERVER_MAX_GROWTH_LOG;
  return adjGrowthLog * (server.growth / 100) * bnGrowthRate * multGrow * coreBonus(cores);
}

/**
 * Wie viele grow-Threads braucht es, um von startMoney auf targetMoney zu kommen?
 *
 * Loest n = (o + x) * exp(k*x) nach x auf. Keine geschlossene Loesung, daher
 * Newton-Raphson in Log-Form - exakt so wie im Spielcode.
 * Das ist die Entsprechung zu formulas.hacking.growThreads und beruecksichtigt
 * den additiven $1-pro-Thread-Anteil. ns.growthAnalyze tut das NICHT und ist
 * fuer Batching darum unbrauchbar.
 *
 * src/Server/ServerHelpers.ts:90
 *
 * @param {{sec: number, growth: number, moneyMax: number}} server
 * @param {number} targetMoney
 * @param {number} startMoney
 * @param {{multGrow: number}} p
 * @param {number} cores
 * @returns {number} ganze Zahl an Threads
 */
/**
 * @param {number} bnGrowthRate  BitNodeMultipliers.ServerGrowthRate.
 *
 * DER PARAMETER FEHLTE (04.09.2026, Skeptiker Substanz). Hier stand
 * `growthLogPerThread(server, p.multGrow, cores)` - ohne den letzten
 * Parameter, der damit auf seinen Vorgabewert 1 fiel. In BitNode 2 (0,8),
 * BitNode 3 (0,2) und BitNode 11 (0,2) rechnete die Fadenzahl damit um bis zu
 * Faktor 5 zu klein: der Server waere nach dem grow nicht voll gewesen, und
 * der darauf gebaute hack haette einen Bruchteil geerntet.
 *
 * `bn4net.js` war nicht betroffen - es hat sein eigenes `growFaeden`, dem `k`
 * von aussen gereicht wird. Betroffen sind `lib/batch.js` und `autopilot.js`.
 *
 * Die Vorgabe bleibt 1, damit die vorhandenen Aufrufe unveraendert richtig
 * bleiben, solange sie in einem Knoten ohne Wachstumsmalus laufen - aber ein
 * Aufrufer, der den Faktor kennt, kann ihn jetzt reichen.
 */
export function growThreads(server, targetMoney, startMoney, p, cores = 1, bnGrowthRate = 1) {
  const k = growthLogPerThread(server, p.multGrow, cores, bnGrowthRate);
  if (!(k > 0)) return Infinity;

  if (startMoney < 0) startMoney = 0;
  if (targetMoney > server.moneyMax) targetMoney = server.moneyMax;
  if (targetMoney <= startMoney) return 0;

  const o = startMoney;
  const n = targetMoney;

  // Startwert aus dem Spielcode
  let x = (n - o) / (1 + (n / 16 + (15 * o) / 16) * k);
  let diff = Infinity;
  let guard = 0;
  while (Math.abs(diff) > 1 && guard++ < 60) {
    const ox = o + x;
    const newX = (x - ox * Math.log(ox / n)) / (1 + ox * k);
    diff = newX - x;
    x = newX;
  }

  let threads = Math.ceil(x);
  // Zwei Korrekturpruefungen wie im Original: lieber einen Thread zu viel
  // als einen zu wenig, sonst bleibt der Server unter moneyMax.
  if (threads > 0) {
    const check = (t) => (o + t) * Math.exp(k * t);
    if (check(threads - 1) >= n) threads--;
    else if (check(threads) < n) threads++;
  }
  return Math.max(0, threads);
}

/**
 * Wie viele weaken-Threads senken die Security um so viel?
 *
 * H1 (Audit 26.09.2026, bn12-bericht SHOULD-FIX #1): bnWeakenRate ist
 * BitNodeMultipliers.ServerWeakenRate (ServerHelpers.ts:322 multipliziert
 * sie in den Sicherheitsabbau je Faden ein). Vorgabe 1 - ausserhalb von
 * BN12 unveraendert. In BN12 ist sie < 1 (0,9804/0,9612/0,9423 je Stufe):
 * jeder Faden senkt WENIGER, es werden also MEHR Faeden gebraucht.
 *
 * @param {number} secDelta
 * @param {number} cores
 * @param {number} bnWeakenRate
 */
export function weakenThreads(secDelta, cores = 1, bnWeakenRate = 1) {
  if (secDelta <= 0) return 0;
  const rate = bnWeakenRate > 0 ? bnWeakenRate : 1;
  return Math.ceil(secDelta / (SERVER_WEAKEN_AMOUNT * coreBonus(cores) * rate));
}

/**
 * Bewertung eines Ziels: erwarteter Ertrag pro Sekunde und Thread,
 * ausgewertet im praeparierten Zustand (sec = secMin, money = moneyMax).
 *
 * Das ist die Groesse, nach der wir Ziele sortieren. Sie beruecksichtigt,
 * dass ein hoher reqSkill doppelt bestraft wird (Laufzeit und Geldanteil)
 * und dass das eigene Level alle Ziele beschleunigt.
 *
 * @param {{secMin: number, reqSkill: number, moneyMax: number, growth: number, root: boolean}} s
 * @param {{skill: number, int: number, multMoney: number, multChance: number, multSpeed: number, multGrow: number}} p
 */
export function targetScore(s, p) {
  if (!s.root || s.moneyMax <= 0) return 0;
  if (s.reqSkill > p.skill) return 0;

  const prepped = { sec: s.secMin, reqSkill: s.reqSkill, root: true, growth: s.growth };
  const pct = hackPercent(prepped, p);
  const chance = hackChance(prepped, p);
  const tW = weakenTime(prepped, p);
  if (pct <= 0 || chance <= 0 || !(tW > 0)) return 0;

  // Ein vollstaendiger Zyklus dauert etwa eine weaken-Zeit. In dieser Zeit
  // holt ein hack-Thread pct * moneyMax * chance - abzueglich der Threads,
  // die das Nachwachsen kostet. Der Grow-Aufwand wird als Faktor genaehert.
  const perHackThread = s.moneyMax * pct * chance;
  const growCost = 1 / Math.max(0.05, growthLogPerThread({ sec: s.secMin, growth: s.growth }, p.multGrow, 1) * 400);
  return perHackThread / tW / (1 + growCost);
}

/**
 * Wie lange dauert es, dieses Ziel ueberhaupt erntereif zu machen?
 *
 * Das ist der Punkt, den eine reine Ertragsrechnung uebersieht: ein fetter
 * Server, der eine halbe Stunde Vorbereitung braucht, ist in der Fruehphase
 * schlechter als ein magerer, der sofort bereit ist. Gerechnet wird mit dem
 * Speicher, der TATSAECHLICH zur Verfuegung steht - nicht mit Wunschdenken.
 *
 * Die Arbeiterkosten kommen von aussen. Frueher stand hier 1.75 fest im Code -
 * das ist der heutige Preis von weaken.js und grow.js, aber niemand merkt es,
 * wenn ein Arbeiter eine ns-Funktion dazubekommt: die Vorbereitungszeit wuerde
 * dann still zu kurz gerechnet, und die Zielauswahl haenge an einer Luege.
 * Der Aufrufer kennt die echten Kosten (ns.getScriptRam) und reicht sie durch.
 *
 * @param {{sec: number, secMin: number, moneyNow: number, moneyMax: number, growth: number, reqSkill: number}} s
 * @param {object} p
 * @param {number} ramFree verfuegbarer Speicher im ganzen Netz, in GB
 * @param {{weakenT: number, growT: number}} costs Speicherbedarf je Arbeiterfaden, in GB
 * @returns {number} Sekunden
 */
export function prepSeconds(s, p, ramFree, costs = WORKER_RAM) {
  const tW = weakenTime({ sec: s.sec, reqSkill: s.reqSkill }, p);
  const costW = costs.weakenT > 0 ? costs.weakenT : WORKER_RAM.weakenT;
  const costG = costs.growT > 0 ? costs.growT : WORKER_RAM.growT;
  let seconds = 0;

  // Schritt 1: Sicherheit auf das Minimum druecken.
  const wNeed = weakenThreads(s.sec - s.secMin);
  if (wNeed > 0) {
    const perWave = Math.max(1, Math.floor(ramFree / costW));
    seconds += Math.ceil(wNeed / perWave) * tW;
  }

  // Schritt 2: Guthaben auffuellen. Grow laeuft schneller als weaken,
  // erzeugt aber Sicherheit, die wieder abgebaut werden muss.
  if (s.moneyNow < s.moneyMax * 0.9) {
    const gNeed = growThreads(
      { sec: s.secMin, growth: s.growth, moneyMax: s.moneyMax },
      s.moneyMax,
      Math.max(1, s.moneyNow),
      p,
      1,
    );
    if (Number.isFinite(gNeed) && gNeed > 0) {
      const perWave = Math.max(1, Math.floor(ramFree / costG));
      seconds += Math.ceil(gNeed / perWave) * tW;
    }
  }
  return seconds;
}

/**
 * Erwarteter Ertrag ueber einen Zeitraum, Vorbereitung eingerechnet.
 * Das ist die Groesse, nach der wirklich sortiert werden sollte.
 *
 * @param {object} s Server
 * @param {object} p Spieler
 * @param {number} ramFree
 * @param {number} horizon Betrachtungszeitraum in Sekunden
 * @param {{weakenT: number, growT: number}} costs Speicherbedarf je Arbeiterfaden
 */
export function expectedYield(s, p, ramFree, horizon = 900, costs = WORKER_RAM) {
  const rate = targetScore(s, p);
  if (rate <= 0) return 0;
  const prep = prepSeconds(s, p, ramFree, costs);
  const harvestTime = Math.max(0, horizon - prep);
  return rate * harvestTime;
}

// ===========================================================================
// ZIELWAHL DES KERNS (bn4net.js) - aus bn4net.js herausgeloest, 26.09.2026
// ===========================================================================
//
// WARUM HIER UND NICHT IN bn4net.js (Skeptiker B, Einwand 10). Die Kennzahlen
// standen als Closure in main() und waren damit nur ueber einen ganzen
// Kernlauf pruefbar. Der Test dazu (test-b1) hat sie deshalb im Test
// nachgebaut und ALT gegen NEU verglichen - ein Rueckfall im Kern waere gruen
// geblieben. Als reine Funktionen hier ruft der Kern, der Test und jede
// Nachrechnung mit echten Spielstaenden DIESELBE Stelle auf. Kostet 0 GB:
// keine ns-Funktion, und kein Bezeichner heisst wie eine (siehe WORKER_RAM
// oben - `.hack`/`.grow`/`.weaken` als Eigenschaft wuerden gebucht).
//
// Warum nicht eine neue Datei lib/zielwahl.js: bn4net.js importiert
// lib/calc.js schon, sie liegt also sicher im Spiel. Eine neue Datei, die beim
// Einspielen vergessen wird, laesst den Kern beim Import sterben.

/**
 * Kennzahlen eines Geldziels im VORBEREITETEN Zustand plus die Zeit bis
 * dahin. Rechnung unveraendert aus bn4net.js kennzahlen (Fix B1: direkt bei
 * minDifficulty, nicht vom IST-Wert hochskaliert - bei Sicherheit 100 war
 * der IST-Wert 0 und jedes Vielfache davon auch).
 *
 * @param {object} s ns.getServer-Objekt
 * @param {{skill: number, int: number, multMoney: number, multChance: number, multGrow: number, multSpeed: number}} p
 * @param {number} hackTimeIstSec ns.getHackTime(host)/1000 - vom Spiel, beim IST-Wert
 * @param {{ramHackT: number, ramGrowT: number, ramWeakenT: number, bnScriptHackMoney: number,
 *          bnServerGrowthRate: number, mixMoneyHigh: number, kapAbzug: number,
 *          secOk: number, moneyLow: number, prepRamGb: number}} cfg
 */
export function targetMetrics(s, p, hackTimeIstSec, cfg) {
  // H1: BitNodeMultipliers.ServerWeakenRate, Vorgabe 1 (BN5 hat keinen
  // Eintrag). Siehe weakenThreads oben fuer die Begruendung.
  const bnWeakenRate = Number.isFinite(cfg.bnServerWeakenRate) && cfg.bnServerWeakenRate > 0
    ? cfg.bnServerWeakenRate : 1;
  const hdIst = s.hackDifficulty, hdMin = s.minDifficulty;
  const req = s.requiredHackingSkill;
  const pct = hackPercent({ sec: hdIst, reqSkill: req }, { skill: p.skill, multMoney: p.multMoney },
    cfg.bnScriptHackMoney);
  const chance = hackChance({ sec: hdIst, reqSkill: req, root: s.hasAdminRights }, p);
  const k = growthLogPerThread({ sec: hdIst, growth: s.serverGrowth }, p.multGrow, 1,
    cfg.bnServerGrowthRate);
  const pMin = hackPercent({ sec: hdMin, reqSkill: req }, { skill: p.skill, multMoney: p.multMoney },
    cfg.bnScriptHackMoney);
  const chanceMin = hackChance({ sec: hdMin, reqSkill: req, root: s.hasAdminRights }, p);
  const kMin = growthLogPerThread({ sec: hdMin, growth: s.serverGrowth }, p.multGrow, 1,
    cfg.bnServerGrowthRate);
  // Die Laufzeit kommt vom Spiel (getHackTime am IST-Wert) und wird nur
  // linear auf minDifficulty umgerechnet: hackTime ~ 2.5*req*sec+500
  // (Hacking.ts:64-70). So bleibt jeder Spielfaktor drin, den calc nicht kennt.
  const zeitIst = 2.5 * req * hdIst + 500;
  const zeitMin = 2.5 * req * hdMin + 500;
  const hackTimeMin = hackTimeIstSec * (zeitIst > 0 ? zeitMin / zeitIst : 1);
  const gphMin = kMin > 0 ? (pMin * chanceMin) / kMin : 0;
  const wphMin = (SERVER_FORTIFY_AMOUNT * chanceMin + GROW_FORTIFY_AMOUNT * gphMin)
    / (SERVER_WEAKEN_AMOUNT * bnWeakenRate);
  const gbSekProEinheit = hackTimeMin
    * (cfg.ramHackT + GROW_TIME_FACTOR * gphMin * cfg.ramGrowT
      + WEAKEN_TIME_FACTOR * wphMin * cfg.ramWeakenT);
  const beute = pMin * chanceMin;
  const brauchbar = pMin > 0 && gbSekProEinheit > 0 && beute > 0 && hackTimeMin > 0;

  // VORBEREITUNGSZEIT (Skeptiker B, Einwand 3). Die Zielwahl sortierte rein
  // nach dem Ertrag NACH dem Saeubern - ein Server auf Sicherheit 100
  // brauchte dafuer bei Level 3012 bis 681 s, nach einem Knotenwechsel bei
  // Level 500 rund 39 min, und das stand nirgends in der Rechnung. Genaehert
  // wie die Anlaufphase in bn4net.js arbeitet: erst EINE weaken-Welle (Dauer
  // am IST-Wert, beim Aufruf festgelegt - viele Faeden kosten keine Zeit),
  // dann grow auf das Maximum mit dem nachlaufenden weaken (grow 3,2 + das
  // weaken dahinter landet nach ~4 hackTime am Minimum).
  const secOver = Math.max(0, hdIst - hdMin);
  const moneyFrac = s.moneyMax > 0 ? s.moneyAvailable / s.moneyMax : 0;
  // Passt die weaken-Welle nicht in den Speicher, den die Anlaufphase
  // bekommt (cfg.prepRamGb, in bn4net 30 % des Netzes), braucht es mehrere
  // Wellen hintereinander - nach einem Knotenwechsel mit kleinem Netz der
  // Normalfall (Sicherheit 100 -> 35 sind 1.300 Faeden, 2,3 TB).
  let prepSec = 0;
  if (secOver > cfg.secOk) {
    const gbWelle = weakenThreads(secOver, 1, bnWeakenRate) * cfg.ramWeakenT;
    const wellen = cfg.prepRamGb > 0 ? Math.max(1, Math.ceil(gbWelle / cfg.prepRamGb)) : 1;
    prepSec += wellen * WEAKEN_TIME_FACTOR * hackTimeIstSec;
  }
  // GROW IN WELLEN, NICHT EINE WELLE PAUSCHAL (Gegenpruefung Skeptiker B,
  // 26.09.2026). Hier stand eine einzige grow/weaken-Dauer, egal wie viel
  // wachsen muss. Nach einem Knotenwechsel steht aber jeder Server auf 2 %
  // Guthaben (BN5: ServerStartingMoney 0,5 gegen 25-faches Maximum,
  // Server.ts:76-77), und bei wachstum 20 und Level 290 braucht hong-fang-tea
  // bis 95 % rund 4.500 grow-Faeden = 8,7 TB - in einem Netz von 1 TB. Die
  // alte Rechnung gab 47 s ("vorbereitet"), die Nachspielung mit dem echten
  // Kern sah das Ziel nach 20 min bei 2,8 % und in der Anlaufsperre.
  // Faedenzahl wie planMix in bn4net.js (log(MIX_MONEY_HIGH/Guthaben)/k, k
  // am Minimum), plus das weaken fuer die grow-Sicherheit (0,004/0,05 je
  // Faden), in Wellen zu cfg.prepRamGb wie beim weaken oben.
  if (moneyFrac < cfg.moneyLow) {
    const growFaeden = kMin > 0
      ? Math.log(cfg.mixMoneyHigh / Math.max(moneyFrac, 1e-9)) / kMin : Infinity;
    const gbGrow = growFaeden
      * (cfg.ramGrowT + (GROW_FORTIFY_AMOUNT / (SERVER_WEAKEN_AMOUNT * bnWeakenRate)) * cfg.ramWeakenT);
    const wellenGrow = cfg.prepRamGb > 0 ? Math.max(1, Math.ceil(gbGrow / cfg.prepRamGb)) : 1;
    prepSec += wellenGrow * WEAKEN_TIME_FACTOR * hackTimeMin;
  }

  return {
    p: pct, chance, k,
    pMin, chanceMin, kMin, hackTimeMin, prepSec,
    steadyEff: brauchbar ? (s.moneyMax * cfg.mixMoneyHigh * beute) / gbSekProEinheit : null,
    kapazitaet: brauchbar ? (cfg.kapAbzug * gbSekProEinheit) / (hackTimeMin * beute) : 0,
  };
}

/**
 * Die Vorbereitung, die fuer ein Ziel NOCH zaehlt: fuer ein neues Ziel die
 * geschaetzte, fuer ein amtierendes nur der Rest seiner Eintrittsschaetzung
 * (nie mehr als der Zustand jetzt verlangt, nie unter 0).
 *
 * WARUM EINE EIGENE FUNKTION (Gegenpruefung Skeptiker B, 26.09.2026). Der
 * Rang rechnete schon so, die Einteilung "vorbereitet / unvorbereitet" in
 * selectMoneyTargets aber mit dem Augenblickswert. Ein laufendes Stapelziel
 * steht zwischen zwei landenden weaken-Wellen kurz ueber Minimum + 1 und
 * hatte dann 94-122 s "Vorbereitung": es belegte fuer eine Runde einen der
 * acht Plaetze fuer unvorbereitete Ziele, das achte fiel heraus und kam in
 * der naechsten Runde zurueck. Nachgespielt mit dem echten Kern (Spielstand
 * 19:03, 90 min): 746 Ein- und Austritte bei 25 Geldzielen, einzelne Server
 * pendelten 72-mal. Rang und Einteilung lesen jetzt dieselbe Zahl.
 *
 * @param {number} prepSec geschaetzte Vorbereitung im jetzigen Zustand
 * @param {null | {restSec: number}} incumbent null fuer ein neues Ziel
 */
export function effectivePrepSec(prepSec, incumbent = null) {
  if (!incumbent) return prepSec;
  return Math.max(0, Math.min(prepSec, incumbent.restSec));
}

/**
 * Rangwert fuer die Zielwahl: Ertrag ueber einen Horizont nach Abzug der
 * Vorbereitung, mit Bonus fuer das amtierende Ziel.
 *
 *   neu         steadyEff x (1 - prepSec/horizonSec). Der Ertrag ueber den
 *               Horizont zaehlt nur fuer die Zeit NACH der Vorbereitung.
 *   amtierend   steadyEff x bonus x (1 - restSec/horizonSec). restSec
 *               ist die RESTLICHE Vorbereitung: die beim Eintritt geschaetzte
 *               minus der seither vergangenen Zeit (der Zustand allein
 *               zeigt eine laufende weaken-Welle erst, wenn sie landet). Der
 *               Bonus haelt die Wahl bei zwei fast gleichen Zielen fest
 *               (18:04: ecorp 5,66e6 gegen 4sigma 5,59e6) - sonst wuerde
 *               batchStand bei jedem Levelsprung weggeworfen. Er ist je ROLLE
 *               verschieden (bn4net: Stapelziel 1,3, offenes Geldziel 1,05):
 *               mit einem gemeinsamen Bonus hob sich die Huerde auf, sobald
 *               ein Herausforderer eine Runde als offenes Ziel in der Liste
 *               stand - im Nachspielen 19:04 verdraengten nova-med und zb-def
 *               so phantasy und the-hub mit nur 1,1-fachem Ertrag.
 *               Die Vorbereitung wird dem Amtierenden NICHT erlassen: sonst
 *               waere ein Ziel, das eine Runde lang als offenes Ziel in der
 *               Liste stand, in der naechsten ohne jede Vorbereitungskosten
 *               ins Stapelrennen gegangen (im Nachspielen 19:04 so passiert).
 *   zu teuer    0, wenn ein NEUES Ziel mehr als prepMaxSec braucht: es wird
 *               nicht angefasst, bis das Level die Vorbereitung billig genug
 *               macht (weaken-Dauer faellt mit 1/(Level+50)). Sonst liefe es
 *               in die Anlauffrist und wuerde gesperrt - Brennen und Sperren.
 *
 * @param {{steadyEff: number|null, prepSec: number}} kz
 * @param {{horizonSec: number, prepMaxSec: number}} opts
 * @param {null | {restSec: number, bonus: number}} incumbent null fuer ein neues Ziel
 */
export function targetRank(kz, opts, incumbent = null) {
  if (!(kz.steadyEff > 0)) return 0;
  if (incumbent) {
    const rest = effectivePrepSec(kz.prepSec, incumbent);
    return kz.steadyEff * (incumbent.bonus || 1) * Math.max(0, 1 - rest / opts.horizonSec);
  }
  if (kz.prepSec > opts.prepMaxSec) return 0;
  return kz.steadyEff * Math.max(0, 1 - kz.prepSec / opts.horizonSec);
}

/**
 * Waehlt die Geldziele aus den nach Rang absteigend sortierten Kandidaten.
 *
 * UNVORBEREITETE ZIELE BEKOMMEN NUR EINEN TEIL DER PLAETZE. Ohne diese Grenze
 * verdraengten beim Einspielen um 18:04 die 44 frisch sichtbaren Server auf
 * Sicherheit 100 alle vorbereiteten: von 25 Geldzielen haette 1 gearbeitet
 * (vorher 17 von 18), und die Ertragsluecke dauert die ganze Vorbereitung
 * (471-740 s). Jetzt bleiben vorbereitete Ziele auf ihren Plaetzen, bis ein
 * Nachfolger fertig ist; unvorbereitete bekommen hoechstens
 * max(maxUnprepared, maxTargets - Zahl der vorbereiteten Kandidaten) - nach
 * einem Einbau (nichts vorbereitet) also wie bisher alle.
 *
 *
 * "Unvorbereitet" heisst: mehr als opts.unpreparedSec Vorbereitung. Ein Ziel im
 * Dauerbetrieb steht zwischen zwei Wellen oft kurz unter 75 % Guthaben und
 * hat dann ein paar Sekunden grow vor sich - das ist Betrieb, keine
 * Vorbereitung, und darf keinen der knappen Plaetze kosten.
 *
 * @param {Array<{host: string, rank: number, prepSec: number}>} sorted
 * @param {{maxTargets: number, maxUnprepared: number, unpreparedSec: number}} opts
 * @returns {string[]} Hosts, weiter nach Rang sortiert
 */
export function selectMoneyTargets(sorted, opts) {
  const grenzeSek = opts.unpreparedSec ?? 60;
  const unvorb = (c) => c.prepSec > grenzeSek;
  const vorbereitet = sorted.filter((c) => !unvorb(c)).length;
  const grenzeUnvorbereitet = Math.max(opts.maxUnprepared, opts.maxTargets - vorbereitet);
  const gewaehlt = [];
  let unvorbereitet = 0;
  for (const c of sorted) {
    if (gewaehlt.length >= opts.maxTargets) break;
    if (unvorb(c)) {
      if (unvorbereitet >= grenzeUnvorbereitet) continue;
      unvorbereitet++;
    }
    gewaehlt.push(c.host);
  }
  return gewaehlt;
}

// ===========================================================================
// STAPELDURCHSATZ FUER DIE ZIELAUSWAHL (B5, Audit 26.09.2026 2#4) - 27.09.2026
// ===========================================================================
//
// WARUM: Stapelziele (bn4net.js "batchTargets") wurden bisher als die ersten
// BATCH_ZIELE Eintraege der nach targetRank sortierten Liste gewaehlt -
// derselbe Rang, nach dem auch die OFFENE Mischung sortiert. targetRank sagt
// aber nur, wie GUT ein Ziel pro Gigabyte ist (steadyEff), nicht, wieviel
// Gigabyte es als STAPELZIEL ueberhaupt sinnvoll aufnehmen kann. Ein Ziel mit
// kurzer weaken-Zeit hat wenige Kalenderplaetze (Stapel duerfen nur alle
// GAP_MS landen, siehe bn4net.js-Kerntakt): mehr Speicher als
// plan.ram*kalenderPlaetze bringt dort NICHTS mehr, der Ertrag klemmt fest,
// egal wie viel RAM zugeteilt wird.
//
// Belegt an BN5L2 19:04 (Level 3012, eigene Rechnung mit batchThroughput
// gegen scratchpad/audit/rows1904.json+s1904.json): phantasy (3
// Kalenderplaetze bei f=0.5) und max-hardware (2) sind unter den ersten drei
// nach steadyEff/targetRank, liefern zusammen aber nur 265 Mio $/s und
// saettigen dabei schon bei zusammen ~2,4 TB - waehrend johnson-ortho (27)
// und omega-net (8), die im alten Rang weiter hinten stehen, beim GLEICHEN
// Netzanteil (F_NETZANTEIL) ueber 1 Mrd $/s liefern wuerden. Der Kalenderdeckel
// kommt in steadyEff schlicht nicht vor.
//
// DIE KENNZAHL HIER IST DESHALB NICHT steadyEff, SONDERN DERSELBE
// LEITER-SUCHLAUF WIE DER KERNTAKT (bn4net.js "batchTargets"-Abschnitt,
// stapelPlan/F_LEITER): das kleinste f, dessen VOLLER Kalender den
// Netzanteil erreicht - bleibt der Kalender darunter, endet die Suche bei
// f=0.5 und der Durchsatz ist die echte Kalendergrenze. Damit ist die
// AUSWAHL genau das, was der Kerntakt danach ohnehin tut - vorher konnten
// beide auseinanderlaufen.
//
// Bewusst NICHT der Kerntakt selbst umgebaut: bn4net.js hat sein eigenes
// growFaeden (nimmt k direkt, 0 GB, seit dem 22.08.2026 Faden-fuer-Faden im
// laufenden Spiel erprobt) und seinen eigenen stapelPlan/F_LEITER-Suchlauf
// fuer die TAKTUNG (Kalender, Drifterkennung, Platzierung). Daran wird hier
// nichts angefasst. Diese Datei bekommt eine zweite, gleichwertige Rechnung
// (growThreadsFromK, stapelPlan, batchThroughput) fuer die AUSWAHL, mit
// denselben Konstanten (BATCH_*) wie der Kerntakt - beide Seiten importieren
// diese Konstanten, damit sie nie auseinanderlaufen.

export const BATCH_GAP_MS = 400;
export const BATCH_F_LEITER = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5];
export const BATCH_F_NETZANTEIL = 0.15;
export const BATCH_WEAKEN_MARGIN = 1.5;
export const BATCH_GROW_MARGIN = 1.15;

/**
 * growThreads-Loesung, wenn der Wachstumsexponent k schon bekannt ist (z. B.
 * kMin aus targetMetrics) - dieselbe Newton-Raphson-Gleichung wie
 * growThreads, nur ohne die Herleitung von k aus einem Server-Objekt. Ein
 * Aufrufer, der k fuer denselben Server mehrmals braucht (Stapeldurchsatz
 * ueber die ganze F_LEITER), muss es so nur einmal rechnen.
 *
 * Eigenstaendig gehalten statt growThreads intern umzubauen: growThreads
 * traegt die Korrektur vom 04.09.2026 (fehlender bnGrowthRate-Parameter,
 * Skeptiker Substanz) und wird von lib/batch.js und autopilot.js benutzt -
 * ein Umbau dort ist nicht Teil von B5.
 *
 * @param {number} k
 * @param {number} moneyMax
 * @param {number} startMoney
 * @param {number} targetMoney
 * @returns {number} ganze Faeden, 0 wenn nichts noetig ist
 */
export function growThreadsFromK(k, moneyMax, startMoney, targetMoney) {
  if (!(k > 0)) return 0;
  const o = Math.max(0, startMoney);
  const n = Math.min(targetMoney, moneyMax);
  if (!(n > o)) return 0;

  let x = (n - o) / (1 + (n / 16 + (15 * o) / 16) * k);
  let diff = Infinity;
  let guard = 0;
  while (Math.abs(diff) > 1 && guard++ < 60) {
    const ox = o + x;
    const newX = (x - ox * Math.log(ox / n)) / (1 + ox * k);
    diff = newX - x;
    x = newX;
  }
  if (!Number.isFinite(x) || x < 0) return 0;

  let threads = Math.ceil(x);
  if (threads > 0) {
    const check = (t) => (o + t) * Math.exp(k * t);
    if (check(threads - 1) >= n) threads--;
    else if (check(threads) < n) threads++;
  }
  return Math.max(0, threads);
}

/**
 * Ein Stapel bei Erntanteil f, im vorbereiteten Zustand (Sicherheit am
 * Minimum) gerechnet - dieselbe Formel wie stapelPlan im Kerntakt von
 * bn4net.js (dort mit dem dortigen growFaeden statt growThreadsFromK).
 *
 * @param {number} f
 * @param {{pMin:number, chanceMin:number, kMin:number}} kz aus targetMetrics
 * @param {number} moneyMax
 * @param {{hackT:number, growT:number, weakenT:number}} costs Speicherbedarf je Arbeiterfaden
 * @param {number} bnWeakenRate H1: BitNodeMultipliers.ServerWeakenRate, Vorgabe 1
 */
export function stapelPlan(f, kz, moneyMax, costs = WORKER_RAM, bnWeakenRate = 1) {
  const rate = bnWeakenRate > 0 ? bnWeakenRate : 1;
  const hackT = Math.max(1, Math.floor(f / kz.pMin));
  // Ein Block mit n Faeden nimmt p*n vom AKTUELLEN Guthaben - linear, nicht
  // multiplikativ (NetscriptHelpers.tsx:629).
  const echt = Math.min(0.99, kz.pMin * hackT);
  const growT = Math.max(1, Math.ceil(
    growThreadsFromK(kz.kMin, moneyMax, moneyMax * (1 - echt), moneyMax) * BATCH_GROW_MARGIN));
  const w1 = Math.max(1, Math.ceil(hackT * SERVER_FORTIFY_AMOUNT * BATCH_WEAKEN_MARGIN / (SERVER_WEAKEN_AMOUNT * rate)));
  const w2 = Math.max(1, Math.ceil(growT * GROW_FORTIFY_AMOUNT * BATCH_WEAKEN_MARGIN / (SERVER_WEAKEN_AMOUNT * rate)));
  return {
    hackT, growT, w1, w2, echt,
    ram: hackT * costs.hackT + growT * costs.growT + (w1 + w2) * costs.weakenT,
    geld: echt * moneyMax * kz.chanceMin,
  };
}

/**
 * Erreichbarer Stapeldurchsatz eines Ziels, WENN es Stapelziel waere - die
 * AUSWAHLKENNZAHL fuer B5 (statt steadyEff/targetRank). Siehe Dateikopf oben
 * fuer die Begruendung und den belegten Fall (phantasy/max-hardware gegen
 * johnson-ortho/omega-net).
 *
 * @param {{pMin:number, chanceMin:number, kMin:number, hackTimeMin:number}} kz aus targetMetrics
 * @param {number} moneyMax
 * @param {number} ramTotal Gesamtspeicher des Netzes, in GB (derselbe Wert,
 *   aus dem auch der Kerntakt seinen Netzanteil bildet)
 * @param {{hackT:number, growT:number, weakenT:number}} costs Speicherbedarf je Arbeiterfaden
 * @param {number} bnWeakenRate H1: BitNodeMultipliers.ServerWeakenRate, Vorgabe 1
 * @returns {null | {fraction:number, kalenderPlaetze:number, ram:number, ramCeiling:number, perS:number}}
 */
export function batchThroughput(kz, moneyMax, ramTotal, costs = WORKER_RAM, bnWeakenRate = 1) {
  if (!(kz.pMin > 0) || !(kz.kMin > 0) || !(kz.chanceMin > 0)
    || !(kz.hackTimeMin > 0) || !(moneyMax > 0)) return null;

  const tWeakenMs = kz.hackTimeMin * WEAKEN_TIME_FACTOR * 1000;
  // Kalenderplaetze SIND ganzzahlig (ein Stapel bekommt keinen halben Platz)
  // - fuer die diskreten Felder unten (fraction/ram/ramCeiling, identisch zum
  // Kerntakt) bleibt es deshalb bei floor(). Fuer die GEGLAETTETE
  // Auswahlkennzahl perS wird stattdessen die UNGERUNDETE Platzzahl verwendet
  // (slotsCont) - sonst waere bei kleinen Platzzahlen (1 -> 2 ist +100 %!)
  // schon die Rundung selbst ein Sprung, den keine f-Interpolation heilen
  // kann (Skeptiker B5, Einwand 2b, Gegenprobe: mit floor() blieb bei
  // kalenderPlaetze 1->2 ein Sprung von Faktor 1,92 stehen).
  const slotsCont = Math.max(1, tWeakenMs / (4 * BATCH_GAP_MS));
  const kalenderPlaetze = Math.max(1, Math.floor(slotsCont));
  const wunschGb = ramTotal * BATCH_F_NETZANTEIL;
  const stapelSec = (4 * BATCH_GAP_MS) / 1000;

  // Alle Sprossen einmal rechnen (8 Stueck, billig) - fuer die DISKRETE Wahl
  // (identisch zum Kerntakt, siehe fraction/ram/ramCeiling unten) UND fuer
  // die GEGLAETTETE Auswahlkennzahl perS.
  const plaene = BATCH_F_LEITER.map((f) => stapelPlan(f, kz, moneyMax, costs, bnWeakenRate));
  let idx = BATCH_F_LEITER.length - 1;
  for (let i = 0; i < BATCH_F_LEITER.length; i++) {
    if (plaene[i].ram * kalenderPlaetze >= wunschGb) { idx = i; break; }
  }
  const fraction = BATCH_F_LEITER[idx];
  const plan = plaene[idx];

  // GEGLAETTETE perS (Skeptiker B5, 27.09.2026, Einwand 2b). Die diskrete
  // Sprosse oben klemmt an der Kalendergrenze: eine winzige Aenderung von
  // hackTimeMin (ein einziger Levelaufstieg) kann kalenderPlaetze um 1
  // verschieben und damit "idx" um eine ganze Sprosse springen lassen -
  // gemessen bis zu Faktor 2,5 in perS (F_LEITER 0.02 vs 0.05), waehrend
  // ZIELWAHL.bonusBatch nur 1,3 vertraegt. Ein amtierendes Stapelziel waere
  // so schon durch einen Levelpunkt verdraengbar gewesen - und beim
  // naechsten Levelpunkt zurueckgetauscht: Flattern im unbeaufsichtigten
  // Betrieb.
  //
  // Statt der Sprosse selbst wird deshalb LINEAR zwischen den zwei Sprossen
  // interpoliert, zwischen denen wunschGb tatsaechlich liegt (ramCeiling
  // waechst mit f, die Interpolation ist also wohldefiniert) - so wie ein
  // KONTINUIERLICHES f es taete, wenn man f fein genug raster koennte. Mit
  // slotsCont statt kalenderPlaetze bleibt auch die Kalendergroesse selbst
  // stetig.
  //
  // KEINE VIRTUELLE SPROSSE UNTER F_LEITER[0] (Gegenpruefung nach der ersten
  // Fassung): reicht schon die KLEINSTE Sprosse (0.02) allein weit ueber
  // wunschGb hinaus - ein Ziel mit riesigem Kalender wie ein Konzernserver -,
  // haette eine Interpolation gegen einen Nullpunkt den Durchsatz auf einen
  // winzigen Bruchteil herunterskaliert, obwohl der Kerntakt dort ganz normal
  // die volle Sprosse 0.02 faehrt. idxGlatt = 0 liefert deshalb den vollen,
  // UNSKALIERTEN Wert dieser Sprosse - das ist ohnehin stetig zum Nachbarfall
  // (idxGlatt = 1): am Uebergang naehert sich dessen Interpolation exakt
  // diesem Wert (t -> 0), weil dort ceilUnten (Sprosse 0) gegen wunschGb
  // laeuft.
  let idxGlatt = BATCH_F_LEITER.length - 1;
  for (let i = 0; i < BATCH_F_LEITER.length; i++) {
    if (plaene[i].ram * slotsCont >= wunschGb) { idxGlatt = i; break; }
  }
  const planGlatt = plaene[idxGlatt];
  let perS = planGlatt.geld / stapelSec;
  if (idxGlatt > 0) {
    const ceilOben = planGlatt.ram * slotsCont;
    const ceilUnten = plaene[idxGlatt - 1].ram * slotsCont;
    const geldUnten = plaene[idxGlatt - 1].geld;
    if (ceilOben > ceilUnten) {
      const t = Math.min(1, Math.max(0, (wunschGb - ceilUnten) / (ceilOben - ceilUnten)));
      perS = (geldUnten + t * (planGlatt.geld - geldUnten)) / stapelSec;
    }
  }

  return {
    fraction, kalenderPlaetze,
    ram: plan.ram,
    ramCeiling: plan.ram * kalenderPlaetze,
    perS,
  };
}
