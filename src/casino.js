/**
 * casino.js - Roulette am Iker Molina Casino, einmal je Einbauzyklus bis zur
 * Sperre (rund 10,36 Mrd). Erics Freigabe vom 13.11.2026; zuerst fuer BN8,
 * wo das Geld als Startkapital der Boerse fuenf Verdopplungen spart.
 * Begruendung, Zahlen und Spielstellen: lib/casino.js.
 *
 * ===========================================================================
 * ABLAUF
 * ===========================================================================
 *
 * Alle 20 s: BitNode 8, Grenze nicht erreicht, keine Einbaurunde (Boersen-
 * pause) und kein Geldabruf von bn4rep, Tian Di Hui beigetreten (oder 10 min
 * seit dem Einbau vorbei - sonst stoert die Reise bn4life), keine Pause nach
 * einem Abbruch, Bargeld fuer einen Einsatz da? Dann eine Sitzung:
 *   1. nach Aevum reisen (200k), Casino aufrufen, "Play roulette"
 *   2. Einsatz auf 1e7 setzen; geprueft wird er an der Buchung des ersten
 *      Drehs (+36 oder -1 Einsatz, sonst Abbruch mit Fehler)
 *   3. je Dreh: Generator aus dem Fiber lesen, naechste Zahl vorhersagen,
 *      genau diese Einzelzahl druecken, Ergebnis abwarten
 *   4. aufhoeren, sobald die Casino-Gewinne seit dem Einbau 10 Mrd
 *      uebersteigen (danach wuerde das Spiel nur noch den "cheater"-Dialog
 *      zeigen), dann zurueck in die alte Stadt und auf die alte Seite
 *
 * Der Klick geht ueber den React-Handler mit einem Ereignis, das isTrusted
 * traegt - derselbe Weg wie join.js fuer den Join!-Knopf
 * (Casino/utils.ts:3-8 prueft nur dieses Feld).
 *
 * ===========================================================================
 * WAS SCHIEFGEHEN KANN UND WAS DANN PASSIERT
 * ===========================================================================
 *
 * - Ein anderes Gewerk navigiert waehrend der Sitzung weg (join.js, popups):
 *   die Roulette-Seite ist weg, der naechste Dreh findet keinen Knopf. Die
 *   Sitzung endet, der naechste Takt beginnt neu - mit neuem Generator, der
 *   wieder gelesen wird.
 * - Die Vorhersage traefe nicht: das waere ein Fehler im Lesen. Gewinnt der
 *   Spieler, wuerfelt das Haus mit 10 % neu (nicht vorhersagbar); sechs
 *   Verluste in Folge sind bei 10 % praktisch ausgeschlossen (1e-6). Dann
 *   bricht die Sitzung ab und das Casino ruht eine Stunde (`lastError`).
 * - Zu wenig Bargeld: casino.js meldet `phase: wait-cash` mit `wantCash`,
 *   boerse.js verkauft dafuer zwei Einsaetze frei (lib/casino.js cashWish).
 *
 * Kostet `document` (der RAM-Rechner bucht es namensbasiert) - in BN8 mit
 * 32 TB home ohne Belang.
 *
 * @param {NS} ns
 */
import { liesVonHome, nachHome } from "lib/hostdatei.js";
import { PAUSE_FILE, ABRUF_FILE, pauseLesen, abrufLesen } from "lib/boersepause.js";
import {
  CASINO_LIMIT, MAX_BET, SINGLE_PAYOUT, CASH_WISH, CASINO_CITY, CASINO_LOCATION, ERROR_COOLDOWN_MS,
  predictNumber, findRouletteState, shouldPlay, stopCooldownMs, readCooldown,
} from "lib/casino.js";

const TICK_MS = 20000;
/** Hoechstzahl Drehungen je Sitzung. Erwartung 31, Hauswurf-Pech eingerechnet. */
const MAX_SPINS = 80;
/** Verluste in Folge, ab denen die Vorhersage als gestoert gilt. */
const MAX_LOSS_STREAK = 6;
/** Roulette.tsx:176 - das Ergebnis kommt 1,6 s nach dem Klick. */
const SPIN_MS = 1600;
const LOG_FILE = "data/casino-log.txt";
const TDH = "Tian Di Hui";

/**
 * Die laufende Sitzung, fuer das Aufraeumen beim Beenden von aussen
 * (Waechter, Platzmangel). `finally` laeuft dann nicht, `atExit` schon.
 */
let active = null;

/** Muss bn4rep gerade Geld bewegen? Dann nicht spielen (Pause = Einbaurunde, Abruf = Kauf/Spende). */
function rivalNeedsCash(ns) {
  const now = Date.now();
  const pause = pauseLesen(liesVonHome(ns, PAUSE_FILE), now).aktiv;
  const abruf = abrufLesen(liesVonHome(ns, ABRUF_FILE), now).betrag > 0;
  return { pause, abruf };
}

export async function main(ns) {
  ns.disableLog("ALL");
  const doc = document;
  ns.atExit(() => {
    if (!active) return;
    try { const stop = buttonByText(doc, "Stop playing"); if (stop) click(stop); } catch { /* egal */ }
    try {
      if (active.startCity !== CASINO_CITY && ns.getPlayer().city === CASINO_CITY) ns.singularity.travelToCity(active.startCity);
    } catch { /* egal */ }
    active = null;
  });

  const log = [];
  const say = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 80) log.shift();
    ns.print(t);
    try { nachHome(ns, LOG_FILE, log.join("\n") + "\n"); } catch { /* egal */ }
  };

  let rounds = 0, okRounds = 0, errStreak = 0, lastError = null;
  // Pausenstand aus der letzten Telemetrie: ein Neustart hebt die Pause nicht auf.
  let { cooldownUntil, failStreak } = readCooldown(liesVonHome(ns, "data/casino.json"), Date.now());
  // Zaehler je Einbauzyklus (lastAugReset), fuer Telemetrie und Dashboard.
  let cycle = null;
  let stats = { spins: 0, wins: 0, houseCheats: 0, sessions: 0 };

  const beat = (extra) => {
    try {
      // Wortlich statt TEL_FILE: die Schreiberprobe der Registry sucht den
      // Dateinamen im Quelltext (tools/lib/schreiberprobe.js); der Test haelt
      // beide gleich (tools/test-casino.js).
      nachHome(ns, "data/casino.json", JSON.stringify({
        schema: 2, ts: Date.now(), wall: Date.now(), playtime: 0, motorTimeMs: 0,
        round: rounds, okRound: okRounds, errStreak, lastError,
        host: ns.getHostname(), version: "casino-2",
        cycle, cooldownUntil, failStreak, ...stats, ...extra,
      }));
    } catch { /* egal */ }
  };

  // --once: genau eine Entscheidung (und hoechstens eine Sitzung), dann Ende.
  // Fuer den Test im Spiel: node tools/task.js casino.js --once
  const once = ns.args.includes("--once");
  say("casino.js gestartet" + (once ? " (--once)" : "") + ".");
  while (true) {
    rounds++;
    try {
      const reset = ns.getResetInfo();
      if (cycle !== reset.lastAugReset) {
        cycle = reset.lastAugReset;
        stats = { spins: 0, wins: 0, houseCheats: 0, sessions: 0 };
      }
      const winnings = ns.getMoneySources().sinceInstall.casino;
      const cash = ns.getServerMoneyAvailable("home");
      const rival = rivalNeedsCash(ns);
      const d = shouldPlay({
        node: reset.currentNode, winnings, cash, pauseActive: rival.pause, abrufActive: rival.abruf,
        tdhJoined: ns.getPlayer().factions.includes(TDH),
        msSinceInstall: Date.now() - reset.lastAugReset,
      });

      if (Date.now() < cooldownUntil) {
        beat({ state: "wait", blockedReason: "locked", phase: "cooldown", winnings, wantCash: 0 });
      } else if (d.play) {
        stats.sessions++;
        const r = await session(ns, doc, say, stats, beat);
        winningsAfter(ns, say, r);
        if (r.error) {
          lastError = r.error;
          failStreak++;
          cooldownUntil = Date.now() + ERROR_COOLDOWN_MS;
          say("SITZUNG GESTOERT: " + r.error + " - Casino ruht 60 min.");
        } else if (r.spins === 0) {
          // Abbruch ohne einen einzigen Dreh: jeder neue Versuch kostet zwei
          // Reisen. Steigende Pause statt Takt (Skeptiker 13.11.).
          failStreak++;
          cooldownUntil = Date.now() + stopCooldownMs(failStreak);
          say("Kein Dreh (" + r.stop + ") - naechster Versuch in " + Math.round(stopCooldownMs(failStreak) / 60000) + " min.");
        } else {
          failStreak = 0;
        }
        beat({ state: "wait", blockedReason: null, phase: "idle", wantCash: 0, lastSession: r });
      } else if (d.reason === "wait-cash") {
        beat({ state: "wait", blockedReason: "no_money", phase: "wait-cash", winnings, wantCash: CASH_WISH });
      } else if (d.reason === "Grenze erreicht") {
        beat({ state: "done", blockedReason: null, phase: "done", winnings, wantCash: 0 });
      } else {
        beat({ state: "wait", blockedReason: null, phase: "idle", reason: d.reason, winnings, wantCash: 0 });
      }
      okRounds++;
      errStreak = 0;
    } catch (e) {
      errStreak++;
      lastError = String(e && e.message ? e.message : e).slice(0, 200);
      say("FEHLER: " + lastError);
      beat({ state: "wait", blockedReason: null, phase: "idle", wantCash: 0 });
    }
    if (once) return;
    await ns.sleep(TICK_MS);
  }
}

function winningsAfter(ns, say, r) {
  let w = NaN;
  try { w = ns.getMoneySources().sinceInstall.casino; } catch { /* egal */ }
  say("Sitzung beendet: " + r.spins + " Drehungen, " + r.wins + " Treffer, "
    + r.houseCheats + " Hauswurf, Casino-Gewinn seit Einbau "
    + (Number.isFinite(w) ? (w / 1e9).toFixed(2) + " Mrd" : "?")
    + (r.stop ? " (" + r.stop + ")" : ""));
}

/**
 * Eine Sitzung am Roulette.
 * @returns {Promise<{spins:number, wins:number, houseCheats:number, stop:string, error:string|null}>}
 */
async function session(ns, doc, say, stats, beat) {
  const res = { spins: 0, wins: 0, houseCheats: 0, stop: "", error: null };
  const startCity = ns.getPlayer().city;
  let wasFocused = false;
  try { wasFocused = ns.singularity.isFocused(); } catch { wasFocused = false; }
  active = { startCity };

  try {
    if (startCity !== CASINO_CITY && !ns.singularity.travelToCity(CASINO_CITY)) {
      res.stop = "Reise nach " + CASINO_CITY + " gescheitert";
      return res;
    }
    if (!ns.singularity.goToLocation(CASINO_LOCATION)) {
      res.error = "goToLocation(" + CASINO_LOCATION + ") gescheitert";
      return res;
    }
    await ns.sleep(400);
    const play = buttonByText(doc, "Play roulette");
    if (!play) { res.error = "Knopf 'Play roulette' nicht gefunden"; return res; }
    click(play);
    await ns.sleep(400);

    if (!setBet(doc, MAX_BET)) { res.error = "Einsatzfeld nicht gefunden"; return res; }
    await ns.sleep(300);
    if (!rouletteRng(doc)) { res.error = "Roulette-Zustand nicht lesbar (kein Generator im Fiber)"; return res; }
    say("Am Roulette, Einsatz " + (MAX_BET / 1e6) + " Mio, Generator gelesen.");

    // ERGEBNIS UND EINSATZ AUS DEM SPIELZAEHLER, NICHT AUS DER SEITE.
    // Der Fiber am DOM-Knoten kann die veraltete Haelfte des React-Paars sein
    // (Hook-Werte wie canPlay/n hinken dann nach); der Generator ist in beiden
    // dasselbe Objekt und deshalb sicher. Gewinn oder Verlust zeigt dagegen
    // eindeutig der Casino-Zaehler des Spiels: +36 Einsaetze oder -1 Einsatz
    // (Game.ts win -> gainMoney(n, "casino")). Nichts anderes bucht dorthin.
    let lossStreak = 0;
    let winnings = ns.getMoneySources().sinceInstall.casino;
    for (let i = 0; i < MAX_SPINS; i++) {
      if (winnings > CASINO_LIMIT) { res.stop = "Grenze erreicht"; break; }
      // Je Dreh, nicht nur zum Sitzungsbeginn: legt bn4rep mitten in der
      // Sitzung die Boersenpause (Einbaurunde) oder einen Abruf, gehoert das
      // Bargeld ihm - ein verlorener Einsatz koennte einen knapp gerechneten
      // Kauf kippen (Skeptiker 13.11.).
      const rival = rivalNeedsCash(ns);
      if (rival.pause || rival.abruf) { res.stop = rival.pause ? "Einbaurunde begonnen" : "Abruf von bn4rep"; break; }
      if (ns.getServerMoneyAvailable("home") < MAX_BET) {
        // boerse.js verkauft zwei Einsaetze frei (cashWish); hoechstens 30 s warten.
        beat({ state: "wait", blockedReason: "no_money", phase: "wait-cash", winnings, wantCash: CASH_WISH });
        let ok = false;
        for (let k = 0; k < 15 && !ok; k++) {
          await ns.sleep(2000);
          ok = ns.getServerMoneyAvailable("home") >= MAX_BET;
        }
        if (!ok) { res.stop = "kein Bargeld fuer den Einsatz"; break; }
      }
      beat({ state: "work", blockedReason: null, phase: "playing", winnings, wantCash: CASH_WISH });

      if (!(await waitCanPlay(ns, doc))) { res.stop = "Roulette-Seite verlassen"; break; }
      const rng = rouletteRng(doc);
      if (!rng) { res.stop = "Roulette-Seite verlassen"; break; }
      const n = predictNumber(rng);
      const btn = numberButton(doc, n);
      if (!btn) { res.error = "Knopf fuer Zahl " + n + " nicht gefunden"; break; }
      const before = winnings;
      click(btn);
      // Auf die Buchung warten, nicht auf die Uhr: in einem gedrosselten Tab
      // kommt der 1,6-s-Timer spaeter (Skeptiker 2c). Hoechstens 20 s.
      await ns.sleep(SPIN_MS);
      let delta = 0;
      for (let k = 0; k < 60; k++) {
        winnings = ns.getMoneySources().sinceInstall.casino;
        delta = winnings - before;
        if (delta !== 0) break;
        await ns.sleep(300);
      }
      res.spins++; stats.spins++;
      if (delta === 0) {
        // Kein Dreh gebucht: Klick nicht angekommen oder Seite weg.
        res.stop = rouletteTable(doc) ? "Dreh nicht gebucht" : "Roulette-Seite waehrend des Drehs verlassen";
        break;
      }
      if (delta !== MAX_BET * SINGLE_PAYOUT && delta !== -MAX_BET) {
        res.error = "Einsatz stimmt nicht (Buchung " + delta + ")";
        break;
      }
      if (delta > 0) {
        res.wins++; stats.wins++;
        lossStreak = 0;
      } else {
        // Verloren trotz Vorhersage: entweder der Hauswurf (Roulette.tsx:149-154,
        // 10 % der Gewinne) oder ein Lesefehler. Mehrere in Folge heissen Lesefehler.
        res.houseCheats++; stats.houseCheats++;
        lossStreak++;
        if (lossStreak >= MAX_LOSS_STREAK) {
          res.error = lossStreak + " Verluste in Folge - Vorhersage stimmt nicht";
          break;
        }
      }
    }
    if (!res.stop && !res.error && res.spins >= MAX_SPINS) res.stop = "Hoechstzahl Drehungen";
  } finally {
    // Aufraeumen, auch nach einem Fehler: Spiel verlassen, zurueckreisen, Seite.
    try { const stop = buttonByText(doc, "Stop playing"); if (stop) click(stop); } catch { /* egal */ }
    try {
      if (startCity !== CASINO_CITY && ns.getPlayer().city === CASINO_CITY) ns.singularity.travelToCity(startCity);
    } catch { /* egal */ }
    try {
      if (wasFocused && ns.singularity.getCurrentWork() !== null) {
        // setFocus(true) ist ein No-op, solange der Fokus formal noch besteht
        // (Singularity.ts:571) - die Seite bliebe auf dem Casino. Erst loesen,
        // dann wieder setzen: das fuehrt zurueck auf die Arbeitsseite.
        try { ns.singularity.setFocus(false); } catch { /* egal */ }
        ns.singularity.setFocus(true);
      } else {
        await backToTerminal(ns, doc);
      }
    } catch { /* egal */ }
    active = null;
  }
  return res;
}

// ---------------------------------------------------------------------------
// Seite lesen und bedienen
// ---------------------------------------------------------------------------

function reactKey(node, prefix) {
  if (!node) return null;
  const key = Object.keys(node).find((k) => k.startsWith(prefix));
  return key ? node[key] : null;
}

/** Ein Ereignis, wie die Handler es lesen (trusted() prueft nur isTrusted). */
function trustedEvent(node) {
  return {
    isTrusted: true, type: "click", target: node, currentTarget: node,
    bubbles: true, cancelable: true, defaultPrevented: false, button: 0, detail: 1,
    timeStamp: Date.now(), nativeEvent: null,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {}, persist() {},
  };
}

function click(btn) {
  const props = reactKey(btn, "__reactProps$");
  if (!props || typeof props.onClick !== "function") throw new Error("Knopf ohne React-Handler: " + (btn.textContent || "").trim());
  props.onClick(trustedEvent(btn));
}

function buttonByText(doc, text) {
  for (const b of doc.querySelectorAll("button")) {
    if ((b.textContent || "").trim() === text) return b;
  }
  return null;
}

/** Die Zahlenknoepfe liegen in der Tabelle der Roulette-Komponente (Roulette.tsx:190 ff.). */
function rouletteTable(doc) {
  const zero = buttonByText(doc, "0");
  return zero ? zero.closest("table") : null;
}

function numberButton(doc, n) {
  const table = rouletteTable(doc);
  if (!table) return null;
  for (const b of table.querySelectorAll("button")) {
    if ((b.textContent || "").trim() === String(n)) return b;
  }
  return null;
}

/** Der Generator der gerade gezeigten Roulette-Komponente (lebendes Objekt) oder null. */
function rouletteRng(doc) {
  const table = rouletteTable(doc);
  if (!table) return null;
  const st = findRouletteState(reactKey(table.querySelector("button"), "__reactFiber$"));
  return st ? st.rng : null;
}

/**
 * Wartet, bis gespielt werden darf, hoechstens 5 s. Gelesen am DOM: waehrend
 * eines Drehs sind die Knoepfe gesperrt (Roulette.tsx: disabled={!canPlay}).
 * @returns {Promise<boolean>} false: Seite weg oder haengt
 */
async function waitCanPlay(ns, doc) {
  for (let i = 0; i < 25; i++) {
    const b = numberButton(doc, 0);
    if (!b) return false;
    if (!b.disabled) return true;
    await ns.sleep(200);
  }
  return false;
}

/**
 * Einsatz setzen: Wert ueber den nativen Setter, dann ein input-Ereignis -
 * React liest daraus onChange (BetInput.tsx), ohne isTrusted zu pruefen.
 * Gesucht wird das Eingabefeld der Roulette-Komponente: der naechste Vorfahr
 * der Zahlentabelle, der ein <input> enthaelt.
 */
function setBet(doc, amount) {
  const table = rouletteTable(doc);
  if (!table) return false;
  let input = null;
  for (let p = table.parentElement, i = 0; p && i < 6 && !input; p = p.parentElement, i++) {
    input = p.querySelector("input");
  }
  if (!input || input.id === "terminal-input") return false;
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value").set;
  setter.call(input, String(amount));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Zurueck ans Terminal (wie join.js backToTerminal). */
async function backToTerminal(ns, doc) {
  const there = () => !!doc.getElementById("terminal-input");
  if (there()) return true;
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true, bubbles: true }));
  await ns.sleep(900);
  return there();
}
