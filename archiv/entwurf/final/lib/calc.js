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
export function growThreads(server, targetMoney, startMoney, p, cores = 1) {
  const k = growthLogPerThread(server, p.multGrow, cores);
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
 * @param {number} secDelta
 * @param {number} cores
 */
export function weakenThreads(secDelta, cores = 1) {
  if (secDelta <= 0) return 0;
  return Math.ceil(secDelta / (SERVER_WEAKEN_AMOUNT * coreBonus(cores)));
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
