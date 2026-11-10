/**
 * Der Einbauplan fuer BitNode 8 (10.11.2026) - reine Funktionen, kein `ns`.
 *
 * ===========================================================================
 * WARUM BN8 EINEN EIGENEN PLAN BRAUCHT
 * ===========================================================================
 * Aus dem Spielquellcode (reference/v301/src), nachgerechnet in
 * tools/audit/bn8-route.mjs, das DIESELBEN Funktionen benutzt:
 *
 *  - Ruf ist kaeuflich: `FavorToDonateToFaction: 0` (BitNode.tsx case 8), also
 *    Spende ab Favor 0; rep = Dollar / 1e6 * faction_rep (donation.ts:8-30).
 *  - Der Ausgang haengt am Hacking-LEVEL (2500 fuer Daedalus, 3000 fuer
 *    w0r1d_d43m0n), und das Level haengt am MULTIPLIKATOR, kaum an der
 *    Erfahrung: skill = floor(m*(32*ln(exp)-200)) (skill.ts:5-13). Bei m = 1,5
 *    braeuchte Level 2500 Erfahrung 1e25, bei m = 5 nur 1e10.
 *  - Jeder Einbau setzt Geld (250 Mio), Erfahrung, Faktionen und gekaufte
 *    Rechner zurueck (Prestige.ts); home-RAM und die 4S-API bleiben.
 *  - Jedes wartende Stueck verteuert alle weiteren um 1,9 * SF11-Rabatt
 *    (AugmentationHelpers.ts:127-162). Dreissig Stueck in EINER Runde sind
 *    deshalb unbezahlbar (1,77^29), in zwei Runden zu je 15 nicht.
 *  - Daedalus verlangt 30 INSTALLIERTE Stuecke (FactionInfo.tsx:138-146).
 *
 * Daraus die Route (Median 30 h je Stufe, 467 Varianten gerechnet, die besten
 * liegen innerhalb einer halben Stunde beieinander):
 *   Runde 1  bei 300 Mrd Vermoegen: rund 15 Stuecke, darunter die beiden
 *            Ruf-Verstaerker (verbilligen alle spaeteren Spenden um 21 %).
 *   Runde 2  bei 1 Bio: auf 30 Stuecke kommen, grosses home-RAM kaufen.
 *   Runde 3  Hacking 2500 -> Daedalus -> Ruf fuer The Red Pill spenden.
 *   Schluss  Hacking 3000, w0r1d_d43m0n.
 * Die Regeln der anderen Knoten ("ab drei Stueck einbauen, wenn die naechste
 * Huerde weit ist") bauten hier viel zu oft ein.
 */

export const ZIEL_STUECKE = 30;
export const RED_PILL = "The Red Pill";
export const NFG = "NeuroFlux Governor";

/** Vermoegen, ab dem Runde 1 bzw. Runde 2 einbaut (bn8-route.mjs: flaches Optimum). */
export const RUNDE1_VERMOEGEN = 300e9;
export const RUNDE2_VERMOEGEN = 1e12;

/**
 * Ab so vielen installierten Stuecken gilt Runde 1 als gelaufen. Runde 1 baut
 * mit mindestens 8 Stuecken ein; dazu NeuroFlux als eines: 9. Laege die Marke
 * hoeher, bliebe ein Lauf mit 9-11 Stuecken in "Runde 1" und baute bei 300 Mrd
 * noch einmal ein.
 */
export const RUNDE2_AB = 9;
export const RUNDE1_MINDEST = 8;

/** home-RAM, das Runde 2 kauft (ueberlebt die Einbauten; 128 -> 32768 GB kostet 463 Mrd). */
export const HOME_ZIEL = 32768;

/**
 * Was ein Stueck wert ist. Hacking-Mult zaehlt fuenfzehnfach: fuer die Zeit
 * bis Level L gilt d ln t = -(L/(32 m)) d ln m - d ln exp - d ln speed, und
 * L/(32 m) liegt bei L = 2500, m = 5 um 15. Ruf-Mult verbilligt die Spenden
 * (Red Pill: 2,5 Mio Ruf). `zahl` ist der Zaehlplatz fuer die 30 Stueck.
 */
// ACHTUNG NAME: ein Feld namens `hack` kostete jedes importierende Skript
// 0,1 GB - das Spiel rechnet RAM nach Namen im Quelltext (tools/ram-namen.js).
export const GEWICHTE = { hackMult: 15, exp: 1, speed: 1, frep: 4, zahl: 0.05 };

const SF11_RABATT = [1, 0.96, 0.94, 0.93];
/** Preisfaktor je wartendem Stueck. */
export function preisFaktor(sf11) {
  return 1.9 * SF11_RABATT[Math.max(0, Math.min(3, Math.floor(sf11 || 0)))];
}

/** Kosten des home-RAM-Ausbaus von `von` auf `bis` GB (ServerPurchases.ts:169-185). */
export function homeKosten(von, bis) {
  let k = 0;
  for (let r = von; r < bis; r *= 2) k += r * 32000 * Math.pow(1.58, Math.log2(r));
  return k;
}

/**
 * Kaufreihenfolge: teuerstes zuerst (es bekommt den kleinsten Aufschlag), aber
 * Vorbedingungen vor ihrem Nachfolger - das Spiel verlangt sie beim Kauf.
 * @param liste [{name, preis, vor:[namen]}] - `vor` nennt nur NICHT besessene Vorbedingungen
 * @returns Array in Kaufreihenfolge, oder null bei unerfuellbarer Vorbedingung
 */
export function reihenfolge(liste) {
  const offen = new Map(liste.map((a) => [a.name, a]));
  const aus = [];
  while (offen.size) {
    let best = null;
    for (const a of offen.values()) {
      if ((a.vor || []).some((p) => offen.has(p))) continue;
      if ((a.vor || []).some((p) => !offen.has(p) && !aus.some((x) => x.name === p))) return null;
      if (!best || a.preis > best.preis) best = a;
    }
    if (!best) return null;
    aus.push(best);
    offen.delete(best.name);
  }
  return aus;
}

/**
 * Was eine Auswahl kostet: Preise mit Aufschlag je Position plus die Spenden,
 * die den fehlenden Ruf kaufen. Jedes Stueck wird der Faktion zugeordnet, bei
 * der es den wenigsten zusaetzlichen Ruf braucht.
 * @param ctx {q, repMult, rufHaben:{faktion:ruf}, aufschlag}
 */
export function kosten(liste, ctx) {
  const folge = reihenfolge(liste);
  if (!folge) return null;
  let geld = 0;
  folge.forEach((a, i) => { geld += a.preis * Math.pow(ctx.q, i); });
  const ziel = {};
  const zuordnung = {};
  for (const a of folge.slice().sort((x, y) => y.ruf - x.ruf)) {
    let best = null, plus = Infinity;
    for (const f of a.faktionen || []) {
      const stand = Math.max(ziel[f] || 0, (ctx.rufHaben && ctx.rufHaben[f]) || 0);
      const p = Math.max(0, a.ruf - stand);
      if (p < plus) { plus = p; best = f; }
    }
    if (best === null) return null;
    zuordnung[a.name] = best;
    ziel[best] = Math.max(ziel[best] || 0, a.ruf);
  }
  const spenden = {};
  let spendeSumme = 0;
  for (const f of Object.keys(ziel)) {
    const fehlt = Math.max(0, ziel[f] - ((ctx.rufHaben && ctx.rufHaben[f]) || 0));
    if (fehlt <= 0) continue;
    spenden[f] = fehlt * 1e6 / ctx.repMult * (ctx.aufschlag || 1.02);
    spendeSumme += spenden[f];
  }
  return { folge, geld, spenden, ziel, zuordnung, gesamt: geld + spendeSumme };
}

function wert(a, g) {
  return g.hackMult * Math.log(a.hackMult || 1) + g.exp * Math.log(a.exp || 1) + g.speed * Math.log(a.speed || 1)
    + g.frep * Math.log(a.frep || 1) + g.zahl;
}

/**
 * Die beste Auswahl fuer ein Budget: gierig nach Wert je zusaetzlichem Dollar,
 * Vorbedingungen werden mitgenommen.
 * @param kandidaten [{name, preis, ruf, faktionen, vor, hackMult, exp, speed, frep}]
 *                   preis = heutiger Preis (enthaelt den Aufschlag der schon wartenden Stuecke)
 * @param pflicht Namen, die drin sein MUESSEN (z.B. The Red Pill)
 * @returns null, wenn schon die Pflicht nicht ins Budget passt; sonst
 *          {kaeufe:[{name, faktion, preis}], spenden:[{faktion, betrag, rufZiel}], kosten, stueck, hackMult, frep}
 */
export function planeRunde({ kandidaten, budget, q, repMult, rufHaben = {}, gewichte = GEWICHTE, pflicht = [], maxStueck = 40 }) {
  const nach = new Map(kandidaten.map((a) => [a.name, a]));
  const ctx = { q, repMult, rufHaben };
  const huelle = (namen) => {
    const s = new Set(namen);
    let wuchs = true;
    while (wuchs) {
      wuchs = false;
      for (const n of [...s]) {
        const a = nach.get(n);
        if (!a) return null;
        for (const p of a.vor || []) if (!s.has(p)) { if (!nach.has(p)) return null; s.add(p); wuchs = true; }
      }
    }
    return s;
  };
  const rechne = (set) => kosten([...set].map((n) => nach.get(n)), ctx);
  let wahl = huelle(pflicht.filter((n) => nach.has(n)));
  if (!wahl || pflicht.some((n) => !nach.has(n))) return null;
  let stand = rechne(wahl);
  if (!stand || stand.gesamt > budget) return null;
  for (;;) {
    let best = null;
    for (const a of kandidaten) {
      if (wahl.has(a.name)) continue;
      const neu = huelle([...wahl, a.name]);
      if (!neu || neu.size > maxStueck) continue;
      const k = rechne(neu);
      if (!k || k.gesamt > budget) continue;
      let w = 0;
      for (const n of neu) if (!wahl.has(n)) w += wert(nach.get(n), gewichte);
      if (!(w > 0)) continue;
      const guete = w / Math.max(1, k.gesamt - stand.gesamt);
      if (!best || guete > best.guete) best = { neu, k, guete };
    }
    if (!best) break;
    wahl = best.neu;
    stand = best.k;
  }
  let hackMult = 1, frep = 1;
  for (const a of stand.folge) { hackMult *= a.hackMult || 1; frep *= a.frep || 1; }
  return {
    kaeufe: stand.folge.map((a) => ({ name: a.name, faktion: stand.zuordnung[a.name], preis: a.preis })),
    spenden: Object.keys(stand.spenden).map((f) => ({ faktion: f, betrag: stand.spenden[f], rufZiel: stand.ziel[f] })),
    kosten: stand.gesamt, stueck: stand.folge.length, hackMult, frep,
  };
}

/**
 * In welcher Runde steht der Lauf?
 *  1  noch keine grosse Runde eingebaut
 *  2  Runde 1 ist drin, es fehlen Stuecke bis 30
 *  3  30 Stuecke installiert: Daedalus und The Red Pill
 *  4  The Red Pill ist installiert: nur noch Hacking 3000
 * @param distinkt Zahl der INSTALLIERTEN verschiedenen Stuecke (NeuroFlux zaehlt als eines)
 */
export function runde({ distinkt, pilleInstalliert }) {
  if (pilleInstalliert) return 4;
  if (distinkt >= ZIEL_STUECKE) return 3;
  if (distinkt >= RUNDE2_AB) return 2;
  return 1;
}

/**
 * Soll jetzt eingebaut werden?
 * @param plan Ergebnis von planeRunde fuer das heutige Vermoegen (oder null)
 * @returns {{ja:boolean, grund:string}}
 */
export function einbauFaellig({ runde: r, vermoegen, plan, distinkt, wartend = 0 }) {
  const stueck = (plan ? plan.stueck : 0) + wartend;
  if (r === 4) return { ja: false, grund: "The Red Pill ist installiert - kein Einbau mehr" };
  if (r === 3) {
    const pille = !!plan && plan.kaeufe.some((k) => k.name === RED_PILL);
    return pille
      ? { ja: true, grund: "The Red Pill ist bezahlbar (Runde 3)" }
      : { ja: false, grund: "Runde 3 wartet: The Red Pill ist nicht im Angebot (Daedalus-Beitritt, V1-Nachweis) oder noch nicht bezahlbar" };
  }
  if (r === 1) {
    if (vermoegen >= RUNDE1_VERMOEGEN && stueck >= RUNDE1_MINDEST) return { ja: true, grund: "Runde 1: Vermoegen ueber 300 Mrd, " + stueck + " Stuecke" };
    if (vermoegen >= 3 * RUNDE1_VERMOEGEN && stueck >= 3) return { ja: true, grund: "Runde 1 (Rueckfall): nur " + stueck + " Stuecke erreichbar" };
    return { ja: false, grund: "Runde 1 wartet auf 300 Mrd Vermoegen und mindestens 8 Stuecke (jetzt " + stueck + ")" };
  }
  const erreicht = distinkt + stueck >= ZIEL_STUECKE;
  if (vermoegen >= RUNDE2_VERMOEGEN && erreicht) return { ja: true, grund: "Runde 2: Vermoegen ueber 1 Bio, " + (distinkt + stueck) + " Stuecke nach dem Einbau" };
  if (vermoegen >= 2 * RUNDE2_VERMOEGEN && stueck >= 3) return { ja: true, grund: "Runde 2 (Rueckfall): 30 Stuecke nicht erreichbar, " + stueck + " jetzt" };
  return { ja: false, grund: "Runde 2 wartet auf 1 Bio Vermoegen und 30 Stuecke (nach Einbau " + (distinkt + stueck) + ")" };
}
