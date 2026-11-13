/**
 * Casino-Roulette (Erics Freigabe vom 13.11.2026) - reine Funktionen, kein ns,
 * kein Dokument. casino.js bedient das Spiel, hier steht alles, was sich ohne
 * Spiel pruefen laesst (tools/test-casino.js).
 *
 * ===========================================================================
 * WARUM DAS GEHT
 * ===========================================================================
 *
 * Das Roulette wuerfelt mit einem Wichmann-Hill-Generator (Casino/RNG.ts:39-66),
 * der beim ersten Zeichnen der Seite mit der Uhrzeit gesaet wird
 * (Roulette.tsx:118: `useState(new WHRNG(new Date().getTime()))`). Sein
 * Zustand (s1, s2, s3) liegt als erster React-Hook der Roulette-Komponente im
 * Fiber-Baum - lesbar wie die Klick-Handler, die join.js seit Wochen benutzt.
 * Wer den Zustand liest, kennt die naechste Zahl: `floor(random() * 37)`
 * (Roulette.tsx:147). Kein Raten des Saatwerts noetig.
 *
 * Einzige Unbekannte: Das Haus betruegt. Gewinnt der Spieler, wuerfelt es mit
 * 10 % Wahrscheinlichkeit (Math.random, nicht vorhersagbar) so lange neu, bis
 * er verliert (Roulette.tsx:149-154). Das kostet dann einen Einsatz und zieht
 * den Generator weiter - deshalb wird der Zustand vor JEDEM Dreh neu gelesen.
 *
 * Erwartung je Dreh mit Hoechsteinsatz 1e7 und Einzelzahl (Auszahlung 36,
 * Roulette.tsx:107): 0,9 * 3,6e8 - 0,1 * 1e7 = 3,23e8. Die Sperre greift erst,
 * wenn die Casino-Gewinne seit dem letzten Einbau 10 Mrd UEBERSTEIGEN
 * (Game.ts:4-18, geprueft VOR der Buchung) - der letzte Gewinn landet also
 * noch, Endstand bis rund 10,36 Mrd. `moneySourceA` leert sich bei jedem
 * Einbau (PlayerObjectGeneralMethods.ts:128): je Einbauzyklus einmal.
 *
 * WOZU IN BN8: Die Boerse waechst exponentiell. 10 Mrd Startkapital statt
 * 250 Mio sind gut fuenf Verdopplungen; gerechnet 5,9 statt 11,4 h bis zur
 * ersten Einbaurunde (nodes/audit-lauf2/2a-geld-ruf.md, Modell gegen vier
 * echte BN8-Zyklen geeicht).
 */

/** Sperrgrenze der Casino-Gewinne je Einbauzyklus (Casino/Game.ts:4). */
export const CASINO_LIMIT = 10e9;

/** Hoechsteinsatz am Roulette (Casino/Roulette.tsx:11). */
export const MAX_BET = 1e7;

/** Auszahlung einer Einzelzahl (Roulette.tsx:107). */
export const SINGLE_PAYOUT = 36;

/** So viel Bargeld haelt boerse.js zurueck, solange gespielt wird: zwei Einsaetze. */
export const CASH_WISH = 2 * MAX_BET;

/** Reisekosten nach Aevum sind 200k; mit Puffer. */
export const TRAVEL_RESERVE = 1e6;

/** Telemetrie von casino.js; boerse.js liest daraus den Geldwunsch. */
export const TEL_FILE = "data/casino.json";

/**
 * Ein Geldwunsch aelter als das gilt nicht mehr (casino.js schreibt je Dreh).
 * 5 min statt 2: in einem gedrosselten Tab kann ein Dreh Minuten dauern, und
 * ein abgelaufener Wunsch liesse boerse.js das Einsatzgeld wegkaufen (Skeptiker 13.11.).
 */
export const WISH_FRESH_MS = 300000;

/**
 * So lange nach einem Einbau wird auf den Beitritt zu Tian Di Hui gewartet,
 * bevor trotzdem gespielt wird. bn4life.js reist dafuer nach Chongqing und
 * wartet dort auf die Einladung (BN8_MAX_TRIPS = 2); eine Casino-Reise nach
 * Aevum in diesem Fenster verbraucht ihm einen Versuch (Skeptiker 13.11.).
 */
export const WAIT_TDH_MS = 10 * 60000;

/** Pause nach einem Abbruch ohne Dreh: 2, 4, 8, 16 min, dann 16. Reisen kosten 2 x 200k. */
export const STOP_COOLDOWN_MIN = [2, 4, 8, 16];

/** Pause nach einer gestoerten Sitzung (Vorhersage stimmt nicht, Knopf fehlt). */
export const ERROR_COOLDOWN_MS = 3600000;

export const CASINO_CITY = "Aevum";
export const CASINO_LOCATION = "Iker Molina Casino";

/** Ein Schritt des Wichmann-Hill-Generators, exakt wie Casino/RNG.ts:55-66. */
export function whrngStep(state) {
  const s1 = (171 * state.s1) % 30269;
  const s2 = (172 * state.s2) % 30307;
  const s3 = (170 * state.s3) % 30323;
  return { state: { s1, s2, s3 }, value: (s1 / 30269.0 + s2 / 30307.0 + s3 / 30323.0) % 1.0 };
}

/** Die Zahl, die der naechste Dreh zieht (Roulette.tsx:147), ohne den Zustand zu veraendern. */
export function predictNumber(state) {
  return Math.floor(whrngStep(state).value * 37);
}

/** Sieht ein Wert aus wie der WHRNG des Spiels? */
export function looksLikeRng(v) {
  return !!v && typeof v === "object"
    && Number.isFinite(v.s1) && Number.isFinite(v.s2) && Number.isFinite(v.s3)
    && typeof v.random === "function";
}

/** Die Werte der Hook-Kette eines Fiber-Knotens (useState legt den Wert in memoizedState ab). */
export function hookValues(fiber, max = 12) {
  const out = [];
  let h = fiber && fiber.memoizedState;
  for (let i = 0; h && typeof h === "object" && "memoizedState" in h && i < max; i++) {
    out.push(h.memoizedState);
    h = h.next;
  }
  return out;
}

/**
 * Sucht vom Fiber eines Knopfes aufwaerts die Roulette-Komponente: die erste,
 * deren erster Hook der Generator ist. Reihenfolge der Hooks (Roulette.tsx:118-123):
 * rng, investment, canPlay, status, n, lock.
 *
 * @returns {{rng:object, investment:number, canPlay:boolean, n:number}|null}
 */
export function findRouletteState(fiber, maxUp = 25) {
  let f = fiber;
  for (let i = 0; f && i < maxUp; i++) {
    const v = hookValues(f);
    if (v.length >= 5 && looksLikeRng(v[0])) {
      return { rng: v[0], investment: v[1], canPlay: v[2], n: v[4] };
    }
    f = f.return;
  }
  return null;
}

/**
 * Wie viel Bargeld soll boerse.js gerade fuer das Casino zurueckhalten?
 * 0, wenn casino.js nicht spielt oder nicht mehr meldet.
 *
 * `state` ist das Herzschlag-Feld (work/wait/done, lib/herzschlag.js) fuer den
 * Waechter; was casino.js gerade tut, steht in `phase`.
 */
export function cashWish(telRaw, now) {
  let t = null;
  try { t = telRaw ? JSON.parse(telRaw) : null; } catch { t = null; }
  if (!t || !Number.isFinite(t.ts) || now - t.ts > WISH_FRESH_MS) return 0;
  if (t.phase !== "playing" && t.phase !== "wait-cash") return 0;
  return t.wantCash > 0 ? Math.min(t.wantCash, 10 * MAX_BET) : 0;
}

/**
 * Soll in diesem Einbauzyklus noch gespielt werden?
 * @param o.node          laufender Knoten
 * @param o.winnings      Casino-Gewinne seit dem Einbau (getMoneySources)
 * @param o.cash          Bargeld
 * @param o.pauseActive   bn4rep hat die Boersenpause gelegt (Einbaurunde)
 * @param o.abrufActive   bn4rep hat Bargeld abgerufen (Kauf/Spende/Daedalus)
 * @param o.tdhJoined     Tian Di Hui ist beigetreten
 * @param o.msSinceInstall seit dem letzten Einbau
 */
export function shouldPlay({ node, winnings, cash, pauseActive, abrufActive = false, tdhJoined = true, msSinceInstall = Infinity }) {
  if (node !== 8) return { play: false, reason: "nur in BitNode 8" };
  if (!(winnings >= 0)) return { play: false, reason: "Casino-Gewinne nicht lesbar" };
  if (winnings > CASINO_LIMIT) return { play: false, reason: "Grenze erreicht" };
  if (pauseActive) return { play: false, reason: "Einbaurunde laeuft (Boersenpause)" };
  if (abrufActive) return { play: false, reason: "Abruf von bn4rep laeuft" };
  if (!tdhJoined && msSinceInstall < WAIT_TDH_MS) return { play: false, reason: "wartet auf Tian Di Hui" };
  if (!(cash >= MAX_BET + TRAVEL_RESERVE)) return { play: false, reason: "wait-cash" };
  return { play: true, reason: "" };
}

/** Pause nach dem n-ten Abbruch ohne Dreh in Folge (n >= 1), in ms. */
export function stopCooldownMs(n) {
  const i = Math.max(0, Math.min(STOP_COOLDOWN_MIN.length - 1, n - 1));
  return STOP_COOLDOWN_MIN[i] * 60000;
}

/**
 * Den gespeicherten Pausenstand aus der eigenen Telemetrie lesen - damit ein
 * Neustart durch den Waechter die Pause nicht aufhebt (Skeptiker 13.11.).
 * @returns {{cooldownUntil:number, failStreak:number}}
 */
export function readCooldown(telRaw, now) {
  let t = null;
  try { t = telRaw ? JSON.parse(telRaw) : null; } catch { t = null; }
  const until = t && Number.isFinite(t.cooldownUntil) ? t.cooldownUntil : 0;
  const streak = t && Number.isFinite(t.failStreak) ? t.failStreak : 0;
  // Eine Pause, die weiter als die laengste moegliche in der Zukunft liegt, ist kaputt.
  return { cooldownUntil: until > now + ERROR_COOLDOWN_MS ? 0 : until, failStreak: streak };
}

/** Einsatz fuer den naechsten Dreh: Hoechsteinsatz, aber nie mehr als das Bargeld. */
export function nextBet(cash) {
  return Math.max(0, Math.min(MAX_BET, Math.floor(cash)));
}
