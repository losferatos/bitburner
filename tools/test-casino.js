// Test Casino-Roulette (lib/casino.js), 13.11.2026.
// Eichung: die Vorhersage wird gegen den ORIGINAL-Generator des Spiels
// gehalten (reference/v301/src/Casino/RNG.ts, mit TypeScript uebersetzt),
// nicht gegen einen Nachbau.
// Aufruf: node tools/test-casino.js [srcVerzeichnis]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "src"));
let gruen = 0, rot = 0;
const pruefe = (name, ok) => { if (ok) { gruen++; console.log("  ok    " + name); } else { rot++; console.log("  ROT   " + name); } };

const libPfad = path.join(SRC, "lib", "casino.js");
pruefe("lib/casino.js existiert", fs.existsSync(libPfad));
if (!fs.existsSync(libPfad)) { console.log(gruen + " gruen, " + rot + " rot"); process.exit(1); }
const L = await import(pathToFileURL(libPfad).href);

// --- 1. Eichung gegen den Spielgenerator -----------------------------------
const rngTs = path.join(ROOT, "reference", "v301", "src", "Casino", "RNG.ts");
const tsPfad = path.join(ROOT, "reference", "v301", "node_modules", "typescript");
if (fs.existsSync(rngTs) && fs.existsSync(tsPfad)) {
  const require = createRequire(import.meta.url);
  const ts = require(tsPfad);
  const js = ts.transpileModule(fs.readFileSync(rngTs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const G = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  // Saatwerte wie im Spiel: new Date().getTime() -> (ms/1000) % 30000, also
  // mit drei Nachkommastellen. Dazu Randfaelle.
  const saaten = [1794466226511, 1794500000000, 1794500000001, 1794512345678, 1700000000999, 29999999, 1000, 0.5];
  let alleGleich = true;
  let gezogen = 0;
  for (const s of saaten) {
    const g = new G.WHRNG(s);
    let st = { s1: g.s1, s2: g.s2, s3: g.s3 };
    for (let i = 0; i < 500; i++) {
      const vorher = L.predictNumber(st);
      const echt = Math.floor(g.random() * 37);
      gezogen++;
      if (vorher !== echt) { alleGleich = false; break; }
      st = L.whrngStep(st).state;
      if (st.s1 !== g.s1 || st.s2 !== g.s2 || st.s3 !== g.s3) { alleGleich = false; break; }
    }
  }
  pruefe("Vorhersage = Spielgenerator, " + gezogen + " Ziehungen aus " + saaten.length + " Saaten (bitgleich)", alleGleich);
  // Die Vorhersage veraendert den Zustand nicht (sonst liefe der Bot aus dem Takt).
  const g2 = new G.WHRNG(1794466226511);
  const st2 = { s1: g2.s1, s2: g2.s2, s3: g2.s3 };
  L.predictNumber(st2); L.predictNumber(st2);
  pruefe("predictNumber laesst den Zustand unberuehrt", st2.s1 === g2.s1 && st2.s2 === g2.s2 && st2.s3 === g2.s3);
  pruefe("looksLikeRng erkennt den echten WHRNG", L.looksLikeRng(g2));
} else {
  pruefe("Spielquelle RNG.ts und typescript vorhanden (fuer die Eichung)", false);
}

// --- 2. Hook-Suche im Fiber-Baum -------------------------------------------
const kette = (werte) => {
  let kopf = null;
  for (let i = werte.length - 1; i >= 0; i--) kopf = { memoizedState: werte[i], next: kopf };
  return kopf;
};
const rng = { s1: 1, s2: 2, s3: 3, random() { return 0; } };
const roulette = { memoizedState: kette([rng, 1e7, true, "waiting", 17, true, { tag: 5 }]), return: null };
const tabelle = { memoizedState: null, return: roulette };
const knopf = { memoizedState: kette([false]), return: tabelle };
const r = L.findRouletteState(knopf);
pruefe("findRouletteState findet die Komponente zwei Ebenen hoeher", !!r && r.rng === rng);
pruefe("... und liest investment, canPlay, n aus den Hooks 1, 2, 4", !!r && r.investment === 1e7 && r.canPlay === true && r.n === 17);
pruefe("ohne Generator -> null", L.findRouletteState({ memoizedState: kette([1, 2, 3, 4, 5]), return: null }) === null);
pruefe("leerer Fiber -> null", L.findRouletteState(null) === null);

// --- 3. Geldwunsch fuer boerse.js ------------------------------------------
const t0 = 2_000_000_000_000;
const tel = (o) => JSON.stringify({ ts: t0, state: "work", phase: "playing", wantCash: L.CASH_WISH, ...o });
pruefe("spielend und frisch -> Wunsch", L.cashWish(tel(), t0 + 1000) === L.CASH_WISH);
pruefe("wartet auf Geld -> Wunsch", L.cashWish(tel({ state: "wait", phase: "wait-cash" }), t0 + 1000) === L.CASH_WISH);
pruefe("fertig -> kein Wunsch", L.cashWish(tel({ state: "done", phase: "done" }), t0 + 1000) === 0);
pruefe("untaetig -> kein Wunsch", L.cashWish(tel({ state: "wait", phase: "idle" }), t0 + 1000) === 0);
pruefe("veraltet -> kein Wunsch", L.cashWish(tel(), t0 + L.WISH_FRESH_MS + 1) === 0);
pruefe("kaputt/leer -> kein Wunsch", L.cashWish("{kaputt", t0) === 0 && L.cashWish("", t0) === 0 && L.cashWish(null, t0) === 0);
pruefe("ueberzogener Wunsch wird gedeckelt (hoechstens 10 Einsaetze)", L.cashWish(tel({ wantCash: 1e12 }), t0) === 10 * L.MAX_BET);

// --- 4. Spielentscheidung ---------------------------------------------------
const ok = { node: 8, winnings: 0, cash: 2.5e8, pauseActive: false };
pruefe("BN8, nichts gewonnen, Geld da -> spielen", L.shouldPlay(ok).play);
pruefe("anderer Knoten -> nicht", !L.shouldPlay({ ...ok, node: 13 }).play);
pruefe("Grenze ueberschritten -> nicht", !L.shouldPlay({ ...ok, winnings: 10.2e9 }).play);
pruefe("genau an der Grenze -> noch spielen (Sperre greift erst darueber)", L.shouldPlay({ ...ok, winnings: 10e9 }).play);
pruefe("Einbaurunde (Boersenpause) -> nicht", !L.shouldPlay({ ...ok, pauseActive: true }).play);
pruefe("zu wenig Bargeld -> wait-cash", L.shouldPlay({ ...ok, cash: 5e6 }).reason === "wait-cash");
pruefe("Gewinne nicht lesbar -> nicht", !L.shouldPlay({ ...ok, winnings: NaN }).play);
pruefe("Abruf von bn4rep laeuft -> nicht", !L.shouldPlay({ ...ok, abrufActive: true }).play);
pruefe("ohne Tian Di Hui, 3 min nach Einbau -> warten", L.shouldPlay({ ...ok, tdhJoined: false, msSinceInstall: 3 * 60000 }).reason === "wartet auf Tian Di Hui");
pruefe("ohne Tian Di Hui, 11 min nach Einbau -> spielen", L.shouldPlay({ ...ok, tdhJoined: false, msSinceInstall: 11 * 60000 }).play);
pruefe("mit Tian Di Hui sofort -> spielen", L.shouldPlay({ ...ok, tdhJoined: true, msSinceInstall: 30000 }).play);

// --- 4b. Pausen nach Abbruechen ---------------------------------------------
pruefe("Pausen 2/4/8/16/16 min", [1, 2, 3, 4, 9].map((n) => L.stopCooldownMs(n) / 60000).join("/") === "2/4/8/16/16");
const telC = (o) => JSON.stringify({ ts: t0, ...o });
pruefe("Pause ueberlebt den Neustart", L.readCooldown(telC({ cooldownUntil: t0 + 5 * 60000, failStreak: 2 }), t0).cooldownUntil === t0 + 5 * 60000
  && L.readCooldown(telC({ cooldownUntil: t0 + 5 * 60000, failStreak: 2 }), t0).failStreak === 2);
pruefe("kaputte oder fehlende Telemetrie -> keine Pause", L.readCooldown("{x", t0).cooldownUntil === 0 && L.readCooldown(null, t0).failStreak === 0);
pruefe("absurde Pause (weiter als 60 min voraus) wird verworfen", L.readCooldown(telC({ cooldownUntil: t0 + 10 * 3600000 }), t0).cooldownUntil === 0);

// --- 5. Erwartung: so viele Drehungen braucht der Zyklus --------------------
{
  // Mittelwert ueber 2000 Simulationen mit Hauswurf 10 %: 31-33 Drehungen
  // (2a-geld-ruf.md: Median 32). Grobe Plausibilitaet der Konstanten.
  let summe = 0;
  let zufall = 12345;
  const rnd = () => { zufall = (zufall * 1103515245 + 12345) % 2147483648; return zufall / 2147483648; };
  for (let i = 0; i < 2000; i++) {
    let gewinn = 0, dreh = 0;
    while (!(gewinn > L.CASINO_LIMIT) && dreh < 200) {
      dreh++;
      gewinn += rnd() > 0.9 ? -L.MAX_BET : L.MAX_BET * L.SINGLE_PAYOUT;
    }
    summe += dreh;
  }
  const mittel = summe / 2000;
  pruefe("Erwartung " + mittel.toFixed(1) + " Drehungen je Zyklus (Soll 30-34)", mittel >= 30 && mittel <= 34);
}

// --- 6. boerse.js haelt den Wunsch zurueck ----------------------------------
const boerse = fs.readFileSync(path.join(SRC, "boerse.js"), "utf8");
pruefe("boerse.js liest den Casino-Wunsch", boerse.includes("cashWish(") && boerse.includes("CASINO_TEL"));

// --- 7. casino.js schreibt die Telemetrie dorthin, wo boerse.js sie liest ---
const casinoPfad = path.join(SRC, "casino.js");
if (fs.existsSync(casinoPfad)) {
  const c = fs.readFileSync(casinoPfad, "utf8");
  pruefe("casino.js schreibt " + L.TEL_FILE + " (wortlich, gleich lib/casino.js TEL_FILE)", c.includes('"' + L.TEL_FILE + '"'));
  pruefe("casino.js setzt phase und wantCash (sonst haelt boerse.js nichts zurueck)", c.includes('phase: "playing"') && c.includes("wantCash: CASH_WISH"));
  pruefe("casino.js prueft Pause/Abruf je Dreh", /for \(let i = 0; i < MAX_SPINS[\s\S]{0,700}rivalNeedsCash\(ns\)/.test(c));
  pruefe("casino.js raeumt beim Beenden von aussen auf (atExit)", c.includes("ns.atExit("));
}

console.log(gruen + " gruen, " + rot + " rot");
process.exit(rot ? 1 : 0);
