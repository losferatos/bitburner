/**
 * Planung von HWGW-Stapeln ("Batches").
 *
 * Ein Stapel besteht aus vier Auftraegen, die NACHEINANDER auf demselben Ziel
 * landen sollen:
 *
 *   1. hack     nimmt einen festen Anteil f des Guthabens weg
 *   2. weaken   hebt die Sicherheit wieder auf, die der hack erzeugt hat
 *   3. grow     holt das Guthaben zurueck auf das Maximum
 *   4. weaken   hebt die Sicherheit auf, die der grow erzeugt hat
 *
 * Der Sinn: JEDER hack-Thread trifft ein Ziel, das genau auf Hoechstguthaben
 * und Mindestsicherheit steht. Genau dort ist sowohl der Beuteanteil je Thread
 * als auch die Erfolgswahrscheinlichkeit am groessten und die Laufzeit am
 * kuerzesten. Ohne diese Reihenfolge trifft der hack irgendeinen Zwischenstand
 * und bringt entsprechend weniger.
 *
 * Diese Datei rechnet nur - kein einziger ns-Aufruf, also 0 GB RAM.
 * Alle Spielformeln kommen aus lib/calc.js.
 */
import * as calc from "calc";

/**
 * Rechnet einen vollstaendigen Stapel fuer ein vorbereitetes Ziel durch.
 *
 * Wichtig: gerechnet wird IMMER im vorbereiteten Zustand (sec = secMin,
 * money = moneyMax), nicht im gerade beobachteten. Das ist kein Schoenrechnen,
 * sondern die Voraussetzung: der Stapel stellt diesen Zustand ja selbst her.
 * Wer stattdessen mit dem Momentanzustand rechnet, bekommt bei jedem Stapel
 * andere Threadzahlen und damit eine Kette, die sich gegenseitig verschiebt.
 *
 * @param {{host: string, moneyMax: number, secMin: number, reqSkill: number, growth: number}} t
 * @param {object} player Ausgabe von playerFacts()
 * @param {{fraction: number, weakenMargin: number, ram: {hack: number, grow: number, weaken: number}, hackChunks?: number[]}} o
 * @returns {null | {hack: number, grow: number, weaken1: number, weaken2: number,
 *                   fraction: number, ram: number, money: number,
 *                   tHack: number, tGrow: number, tWeaken: number}}
 */
export function batchPlan(t, player, o) {
  const prepped = {
    sec: t.secMin,
    reqSkill: t.reqSkill,
    root: true,
    growth: t.growth,
    moneyMax: t.moneyMax,
  };
  const pct = calc.hackPercent(prepped, player);
  const chance = calc.hackChance(prepped, player);
  if (!(pct > 0) || !(chance > 0) || !(t.moneyMax > 0)) return null;

  // Threadzahl fuer den gewuenschten Anteil. Abgerundet: lieber etwas weniger
  // wegnehmen als versehentlich mehr, denn grow muss multiplikativ zurueck.
  const hack = Math.max(1, Math.floor(o.fraction / pct));

  // Der TATSAECHLICHE Anteil haengt davon ab, ob die hack-Threads in einem
  // Stueck laufen oder auf mehrere Rechner verteilt werden muessen. Bei einer
  // Aufteilung wirken die Bloecke nacheinander auf ein bereits verkleinertes
  // Guthaben - zwei Bloecke a 10 % nehmen zusammen 19 %, nicht 20 %.
  // Wer das ignoriert, laesst grow zu viel nachlegen; das ist zwar harmlos
  // (der Deckel greift), kostet aber Threads.
  const fraction = realFraction(pct, o.hackChunks && o.hackChunks.length ? o.hackChunks : [hack]);
  if (!(fraction > 0) || fraction >= 1) return null;

  const grow = calc.growThreads(prepped, t.moneyMax, t.moneyMax * (1 - fraction), player, 1);
  if (!Number.isFinite(grow) || grow < 0) return null;

  // Beide Ausgleichsauftraege bewusst grosszuegig bemessen.
  //
  // Ueberzaehlige weaken-Threads richten keinen Schaden an: die Sicherheit ist
  // nach unten auf secMin gedeckelt (Server.ts:91). Zu WENIGE dagegen sind der
  // gefaehrlichste Fehler im ganzen Verfahren - dann bleibt nach jedem Stapel
  // ein Rest Sicherheit stehen, der sich ueber hunderte Stapel aufschaukelt,
  // bis Beute und Tempo einbrechen. Der Aufschlag kostet nur wenige Prozent
  // des Stapels und kauft dafuer Unempfindlichkeit gegen Rundungsfehler,
  // verrutschte Landungen und den Kernbonus, den wir nicht kennen.
  const margin = o.weakenMargin ?? 1.5;
  const weaken1 = calc.weakenThreads(hack * calc.SERVER_FORTIFY_AMOUNT * margin);
  const weaken2 = calc.weakenThreads(grow * calc.GROW_FORTIFY_AMOUNT * margin);

  const tHack = calc.hackTime(prepped, player) * 1000;
  return {
    hack,
    grow,
    weaken1: Math.max(1, weaken1),
    weaken2: Math.max(1, weaken2),
    fraction,
    money: fraction * t.moneyMax * chance,
    ram: hack * o.ram.hack + grow * o.ram.grow + (Math.max(1, weaken1) + Math.max(1, weaken2)) * o.ram.weaken,
    tHack,
    tGrow: tHack * calc.GROW_TIME_FACTOR,
    tWeaken: tHack * calc.WEAKEN_TIME_FACTOR,
  };
}

/**
 * Anteil, den mehrere nacheinander wirkende hack-Bloecke zusammen wegnehmen.
 * Ein Block mit n Threads nimmt pct*n des GERADE vorhandenen Guthabens.
 * @param {number} pct
 * @param {number[]} chunks
 */
export function realFraction(pct, chunks) {
  let rest = 1;
  for (const n of chunks) rest *= Math.max(0, 1 - pct * n);
  return 1 - rest;
}

/**
 * Waehlt den Beuteanteil f so, dass ein Ziel das ihm zugedachte RAM-Budget
 * auch wirklich verbraucht.
 *
 * Warum das noetig ist: die Zahl der Stapel, die gleichzeitig unterwegs sein
 * koennen, ist nach oben begrenzt. Zwischen zwei Stapeln muessen vier
 * Landungen Platz haben, also 4*gap. In eine weaken-Zeit passen damit
 * tWeaken/(4*gap) Stapel - mehr gibt der Kalender nicht her, egal wie viel
 * Speicher herumliegt. Wer trotzdem mehr Speicher hat, muss GROESSERE Stapel
 * fahren, also f erhoehen.
 *
 * Umgekehrt gilt: kleines f ist speichereffizienter. hack nimmt linear weg,
 * grow muss multiplikativ zurueckholen - bei f=0.4 kostet ein Dollar Beute
 * spuerbar mehr grow-Threads als bei f=0.05. Deshalb wird das KLEINSTE f
 * gesucht, das das Budget noch fuellt, nicht das groesste moegliche.
 *
 * @param {object} t Ziel
 * @param {object} player
 * @param {number} ramBudget GB, die dieses Ziel binden darf
 * @param {{gapMs: number, weakenMargin: number, ram: object, min: number, max: number}} o
 * @returns {{fraction: number, plan: object} | null}
 */
export function chooseFraction(t, player, ramBudget, o) {
  const min = o.min ?? 0.005;
  const max = o.max ?? 0.9;
  const probe = (f) => batchPlan(t, player, { fraction: f, weakenMargin: o.weakenMargin, ram: o.ram });

  const klein = probe(min);
  if (!klein) return null;
  const maxStapel = Math.max(1, Math.floor(klein.tWeaken / (4 * o.gapMs)));
  const wunsch = ramBudget / maxStapel; // so gross muss ein Stapel sein

  if (klein.ram >= wunsch) return { fraction: min, plan: klein };
  const gross = probe(max);
  if (!gross) return { fraction: min, plan: klein };
  if (gross.ram <= wunsch) return { fraction: max, plan: gross };

  // Der Speicherbedarf waechst streng mit f, also greift die Bisektion.
  let lo = min, hi = max, best = gross;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const p = probe(mid);
    if (!p) break;
    if (p.ram >= wunsch) { hi = mid; best = p; } else lo = mid;
  }
  return { fraction: hi, plan: best };
}

/**
 * Sucht Platz fuer eine Reihe von Auftraegen und liefert die Belegung -
 * oder null, wenn auch nur EINER nicht vollstaendig unterkommt.
 *
 * Alles-oder-nichts ist hier kein Luxus, sondern die zentrale Sicherung.
 * Ein halber Stapel ist schlimmer als gar keiner: der hack landet, das
 * Guthaben faellt, und der grow, der es zurueckholen sollte, wurde nie
 * gestartet. Genau daraus entsteht ein Ziel, das langsam ausblutet.
 *
 * @param {{host: string, frei: number}[]} hosts wird NICHT veraendert
 * @param {{kind: string, script: string, threads: number, cost: number, landAt: number, opMs: number}[]} ops
 * @returns {null | {placements: {host: string, op: object, threads: number}[], frei: Map<string, number>}}
 */
export function placeOps(hosts, ops) {
  const frei = new Map();
  for (const h of hosts) frei.set(h.host, h.frei);
  const placements = [];

  for (const op of ops) {
    let rest = op.threads;
    if (rest < 1) continue;

    // Erst versuchen, den ganzen Auftrag auf EINEN Rechner zu legen, und zwar
    // auf den kleinsten, der ihn fasst. Das haelt die grossen Rechner fuer die
    // grossen Auftraege frei und vermeidet beim hack den Aufteilungsverlust.
    let bester = null;
    for (const [host, platz] of frei) {
      const passt = Math.floor(platz / op.cost);
      if (passt >= rest && (bester === null || platz < frei.get(bester))) bester = host;
    }
    if (bester !== null) {
      frei.set(bester, frei.get(bester) - rest * op.cost);
      placements.push({ host: bester, op, threads: rest });
      continue;
    }

    // Passt nirgends am Stueck: aufteilen, groesste Rechner zuerst.
    const order = [...frei.entries()].sort((a, b) => b[1] - a[1]);
    for (const [host, platz] of order) {
      if (rest <= 0) break;
      const passt = Math.floor(platz / op.cost);
      if (passt < 1) continue;
      const n = Math.min(passt, rest);
      frei.set(host, platz - n * op.cost);
      placements.push({ host, op, threads: n });
      rest -= n;
    }
    if (rest > 0) return null;
  }
  return { placements, frei };
}

/**
 * Baut die vier Auftraege eines Stapels mit ihren Landezeitpunkten.
 *
 * Der Abstand gap zwischen den Landungen ist der einzige echte
 * Zeitsteuerungsparameter. Zu klein, und eine verrutschte Landung dreht die
 * Reihenfolge um; zu gross, und der Kalender wird zum Engpass, weil jeder
 * Stapel 4*gap Kalenderzeit belegt.
 *
 * @param {object} plan Ausgabe von batchPlan
 * @param {string} host Zielrechner
 * @param {number} landHack Zeitpunkt (ms seit 1970), zu dem der hack landen soll
 * @param {number} gapMs
 * @param {{hack: string, grow: string, weaken: string}} scripts
 * @param {{hack: number, grow: number, weaken: number}} ram
 */
export function batchOps(plan, host, landHack, gapMs, scripts, ram) {
  return [
    { kind: "hack", script: scripts.hack, threads: plan.hack, cost: ram.hack, landAt: landHack, opMs: plan.tHack, target: host },
    { kind: "weaken1", script: scripts.weaken, threads: plan.weaken1, cost: ram.weaken, landAt: landHack + gapMs, opMs: plan.tWeaken, target: host },
    { kind: "grow", script: scripts.grow, threads: plan.grow, cost: ram.grow, landAt: landHack + 2 * gapMs, opMs: plan.tGrow, target: host },
    { kind: "weaken2", script: scripts.weaken, threads: plan.weaken2, cost: ram.weaken, landAt: landHack + 3 * gapMs, opMs: plan.tWeaken, target: host },
  ];
}
