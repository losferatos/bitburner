/**
 * Ebene 0: die Runde am Einbau-Tor im Kampfknoten mit Gang (Paket P1 / AUG-4,
 * 03.10.2026) - `waehleTorRunde`, `gangBonusWait`, `gateBuyMode`,
 * `blackOpWeights`, `gatePriceStep`, `gateMultsProduct` aus `src/lib/einbau.js`
 * und die Gewichte in `src/lib/blackops.json`.
 *
 * Quelle der Vorgabe: nodes/audit-2026-10-03/verify-g01-betrieb.md PAKET 1.
 *
 * ===========================================================================
 * WAS GEPRUEFT WIRD
 * ===========================================================================
 *
 * A. Gegen tools/audit/gang-round.mjs `bestRound` bei 30 / 48 / 100 Mrd (und
 *    q0 = 0 und 4): gleiche Menge, gleiche Reihenfolge, gleiche Kosten, Kosten
 *    <= Budget. Die Eingabe und die Antworten von bestRound stehen in
 *    tools/mock/tor-runde-gang-bn2.json (erzeugt von
 *    tools/audit/tor-runde-fixture.mjs), damit der Test auch ohne Spielquelltext
 *    und Spielstand laeuft. Wo beides vorliegt (Hauptbaum), wird bestRound
 *    ZUSAETZLICH live nachgerechnet und gegen die Datei gehalten (Drift).
 * B. Eigenschaften der Runde mit erfundenen Zahlen: Reihenfolge, Vorgaenger,
 *    Preistreppe, Budget, BB-Chance multiplikativ, Zyklen im Voraussetzungs-
 *    graphen enden, SF11-Preisfaktor.
 * C. Die Wartegrenze auf den Gang-Vorrat (gangBonusWait): Nachholen, Plateau,
 *    gedrosselter Tab, Pause, nicht lesbare Bonuszeit.
 * D. Die Gewichte in blackops.json: 21 Operationen, jeder gewichtete Wert hat
 *    einen Abklingexponenten, Namenssuche.
 * E. Die Bladeburner-Faehigkeiten Reaper und Evasive System (Skeptiker-
 *    Auflage 2): ihre Faktoren gegen den Spielquelltext geeicht, die Planung
 *    mit effektiven Stufen gegen eine unabhaengig gerechnete echte
 *    Competence (Action.ts:173).
 * F. Der Wartezustand ueber einen Neustart (readGateBonusState) und der
 *    Halt des Einbaus nach einer abgebrochenen Torrunde (gateAbortHold).
 * G. COMBAT_AUGS traegt die Hackingfaktoren der Gang-Stuecke (Augmentations.ts).
 *
 * Fehlt eine Funktion (alter Stand), ist das ein ROT und kein Absturz:
 *   BN4REP_SRC=<alter src-Ordner> node tools/test-tor-runde.js
 *
 * Aufruf: node tools/test-tor-runde.js
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HIER, "..");
const SRC = process.env.BN4REP_SRC ? path.resolve(process.env.BN4REP_SRC) : path.join(ROOT, "src");

let gruen = 0;
let rot = 0;
const fehler = [];
function pruefe(name, bedingung, hinweis = "") {
  if (bedingung) { gruen++; console.log("  ok    " + name); return; }
  rot++;
  fehler.push(name + (hinweis ? " - " + hinweis : ""));
  console.log("  ROT   " + name + (hinweis ? " - " + hinweis : ""));
}

const M = await import(pathToFileURL(path.join(SRC, "lib", "einbau.js")).href);
const FEHLT = Symbol("fehlt");
function ruf(name, ...args) {
  if (typeof M[name] !== "function") return FEHLT;
  try { return M[name](...args); } catch (e) { return { wurf: String(e && e.message ? e.message : e) }; }
}
const ist = (r) => r !== FEHLT && !(r && r.wurf);
// Hinweistexte: darf nie werfen, auch wenn die Funktion im alten Stand fehlt.
const js = (x) => (x === FEHLT ? "Funktion fehlt" : String(JSON.stringify(x)));

// Die Tabelle, mit der bn4rep.js rechnet (Gewichte je Black Op).
let tabelle = null;
try { tabelle = JSON.parse(fs.readFileSync(path.join(SRC, "lib", "blackops.json"), "utf8")); } catch { tabelle = null; }

const gleichListe = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);
const nah = (a, b, tol = 1e-9) => typeof a === "number" && typeof b === "number"
  && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

console.log("");
console.log("=== Torrunde im Kampfknoten mit Gang (" + SRC + ") ===");

// ---------------------------------------------------------------------------
console.log("\n-- A. waehleTorRunde gegen bestRound (tools/audit/gang-round.mjs) --");
const fixturePfad = path.join(ROOT, "tools", "mock", "tor-runde-gang-bn2.json");
const fx = JSON.parse(fs.readFileSync(fixturePfad, "utf8"));
const daedalus = ruf("blackOpWeights", tabelle, "Operation Daedalus");
pruefe("blackOpWeights findet Operation Daedalus (Spielname mit Leerzeichen)",
  ist(daedalus) && daedalus.name === "OperationDaedalus" && daedalus.source.startsWith("blackops.json:"),
  js(daedalus).slice(0, 120));

const eingabeAusFixture = (q0) => fx.offer.map((a) => ({
  aug: a.name, faktion: "Slum Snakes", rep: 1e9, repReq: a.repCost,
  preis: a.moneyCost * Math.pow(1.9, q0),
  prereq: a.prereqs,
  mults: Object.fromEntries(["strength", "defense", "dexterity", "agility"]
    .filter((s) => a[s] > 1).map((s) => [s, a[s]])),
}));

for (const c of fx.cases) {
  const r = ruf("waehleTorRunde", eingabeAusFixture(c.q0), c.budget, new Set(fx.owned), {
    skills: fx.levels, weights: daedalus.weights, decays: daedalus.decays, priceStep: 1.9,
  });
  const titel = (c.budget / 1e9) + " Mrd, q0 " + c.q0;
  pruefe(titel + ": gleiche Menge UND gleiche Reihenfolge wie bestRound (" + c.seq.length + " Augs)",
    ist(r) && gleichListe(r.seq, c.seq), ist(r) ? r.seq.join(" > ").slice(0, 300) : js(r));
  pruefe(titel + ": Kosten wie bestRound und <= Budget",
    ist(r) && nah(r.cost, c.cost, 1e-9) && r.cost <= c.budget,
    ist(r) ? (r.cost / 1e9).toFixed(4) + " vs " + (c.cost / 1e9).toFixed(4) : "");
  pruefe(titel + ": Competence-Zuwachs wie bestRound (x" + c.comp.toFixed(3) + ")",
    ist(r) && nah(r.gain, c.comp, 1e-9), ist(r) ? "x" + r.gain.toFixed(6) : "");
}

// Die Produktionsdaten: bn4rep.js speist die Faktoren aus COMBAT_AUGS (lib/hackaugs.js), nicht aus
// dem Quelltext des Spiels. Stimmt die Tabelle fuer alle Angebote der Gang-Faktion, ist die Runde
// im Betrieb dieselbe wie oben.
{
  const H = await import(pathToFileURL(path.join(SRC, "lib", "hackaugs.js")).href);
  const KEYS = ["strength", "defense", "dexterity", "agility"];
  const abw = fx.offer.filter((a) => KEYS.some((s) => Math.abs((a[s] || 1) - ((H.COMBAT_AUGS[a.name] || {})[s] || 1)) > 1e-9));
  pruefe("COMBAT_AUGS traegt fuer alle " + fx.offer.length + " Angebote der Gang-Faktion dieselben Kampffaktoren wie der Spielquelltext",
    abw.length === 0, abw.map((a) => a.name).join(", "));
  const c = fx.cases.find((x) => x.q0 === 0 && x.budget === 100e9);
  const prod = fx.offer.map((a) => ({
    aug: a.name, faktion: "Slum Snakes", rep: 1e9, repReq: a.repCost, preis: a.moneyCost,
    prereq: a.prereqs, mults: H.COMBAT_AUGS[a.name],
  }));
  const r = ruf("waehleTorRunde", prod, c.budget, new Set(fx.owned), {
    skills: fx.levels, weights: daedalus.weights, decays: daedalus.decays, priceStep: 1.9,
  });
  pruefe("mit den Faktoren aus COMBAT_AUGS (Produktionspfad) dieselbe Runde bei 100 Mrd",
    ist(r) && gleichListe(r.seq, c.seq), ist(r) ? r.seq.join(" > ").slice(0, 300) : js(r));
}

// Live-Gegenprobe: bestRound selbst, wo Spielquelltext und Spielstand da sind.
{
  const save = path.join(ROOT, "backups", fx.quelle);
  const quelle = path.join(ROOT, "reference", "bitburner-src", "src", "Augmentation", "Augmentations.ts");
  if (fs.existsSync(save) && fs.existsSync(quelle)) {
    const G = await import(pathToFileURL(path.join(ROOT, "tools", "audit", "gang-round.mjs")).href);
    let drift = 0;
    for (const c of fx.cases) {
      const live = G.bestRound(c.budget, c.q0);
      if (!gleichListe(live.seq, c.seq) || !nah(live.cost, c.cost)) drift++;
    }
    pruefe("die Datei tor-runde-gang-bn2.json ist nicht von bestRound abgedriftet (live nachgerechnet)",
      drift === 0, drift + " Faelle weichen ab - tools/audit/tor-runde-fixture.mjs neu laufen lassen");
  } else {
    console.log("  UEBERSPRUNGEN: Live-Nachrechnung von bestRound (backups/" + fx.quelle
      + " oder reference/bitburner-src fehlt in diesem Baum).");
  }
}

// ---------------------------------------------------------------------------
console.log("\n-- B. Eigenschaften der Runde (erfundene Zahlen) --");
const W = { hacking: 0.1, strength: 0.2, defense: 0.2, dexterity: 0.2, agility: 0.2, charisma: 0, intelligence: 0.1 };
const D = { hacking: 0.6, strength: 0.8, defense: 0.8, dexterity: 0.8, agility: 0.8, charisma: 0, intelligence: 0.75 };
const L = { hacking: 372, strength: 194, defense: 181, dexterity: 181, agility: 181, intelligence: 153 };
const opt = (extra = {}) => ({ skills: L, weights: W, decays: D, priceStep: 1.9, ...extra });
const k = (aug, preis, mults, extra = {}) => ({
  aug, faktion: "Slum Snakes", rep: 1e6, repReq: 1000, preis, prereq: [], mults, ...extra,
});

{
  // Drei unabhaengige Stuecke, alle bezahlbar: teuerste zuerst, Preis x 1,9^i.
  const kand = [
    k("Billig", 1e9, { strength: 1.2 }),
    k("Mittel", 3e9, { defense: 1.5 }),
    k("Teuer", 9e9, { strength: 1.7, defense: 1.7, dexterity: 1.7, agility: 1.7 }),
  ];
  const r = ruf("waehleTorRunde", kand, 1e12, [], opt());
  pruefe("alle drei kaufbar: teuerste zuerst", ist(r) && gleichListe(r.seq, ["Teuer", "Mittel", "Billig"]),
    ist(r) ? r.seq.join(" > ") : js(r));
  const erwartet = 9e9 + 3e9 * 1.9 + 1e9 * 1.9 * 1.9;
  pruefe("Kosten = Preis x 1,9^Position (Teuer 9e9, Mittel 3e9 x 1,9, Billig 1e9 x 3,61)",
    ist(r) && nah(r.cost, erwartet), ist(r) ? String(r.cost) : "");
  pruefe("steps tragen den geplanten Preis je Position",
    ist(r) && r.steps.length === 3 && nah(r.steps[1].price, 3e9 * 1.9) && nah(r.steps[2].price, 1e9 * 3.61)
    && r.steps.every((s) => s.faktion === "Slum Snakes"), ist(r) ? js(r.steps).slice(0, 200) : "");
  pruefe("der Zuwachs ist > 1 (Competence steigt)", ist(r) && r.gain > 1, ist(r) ? String(r.gain) : "");
}
{
  // Das Budget gilt fuer die ganze Reihenfolge, nicht je Stueck.
  const kand = [k("A", 4e9, { strength: 1.5 }), k("B", 4e9, { defense: 1.5 })];
  const r = ruf("waehleTorRunde", kand, 7e9, [], opt());
  // A allein 4e9; A + B = 4e9 + 4e9 x 1,9 = 11,6e9 > 7e9
  pruefe("zwei Stuecke zu je 4 Mrd passen mit Treppe NICHT in 7 Mrd (nur eins)",
    ist(r) && r.seq.length === 1 && r.cost <= 7e9, ist(r) ? r.seq.join(",") + " " + r.cost : js(r));
}
{
  // Voraussetzungen: das Nachfolgestueck bringt den Zuwachs, das Vorgaengerstueck kommt vorher mit.
  const kand = [
    k("Stufe2", 8e9, { strength: 2 }, { prereq: ["Stufe1"] }),
    k("Stufe1", 1e9, { strength: 1.1 }),
    k("Anderes", 5e9, { agility: 1.3 }),
  ];
  const r = ruf("waehleTorRunde", kand, 1e12, [], opt());
  const i1 = ist(r) ? r.seq.indexOf("Stufe1") : -1;
  const i2 = ist(r) ? r.seq.indexOf("Stufe2") : -1;
  pruefe("Vorgaenger vor Nachfolger", i1 >= 0 && i2 >= 0 && i1 < i2, ist(r) ? r.seq.join(" > ") : "");
  pruefe("teuerste Wurzel zuerst, der Vorgaenger rutscht unmittelbar vor seinen Nachfolger",
    ist(r) && gleichListe(r.seq, ["Stufe1", "Stufe2", "Anderes"]), ist(r) ? r.seq.join(" > ") : "");
}
{
  // Ein Vorgaenger, der weder besessen noch kaufbar ist, sperrt den Nachfolger - nicht die Runde.
  const kand = [
    k("Haengt", 2e9, { strength: 3 }, { prereq: ["Fehlt"] }),
    k("Frei", 2e9, { defense: 1.5 }),
  ];
  const r = ruf("waehleTorRunde", kand, 1e12, [], opt());
  pruefe("Nachfolger ohne kaufbaren Vorgaenger fliegt raus, die uebrigen bleiben",
    ist(r) && gleichListe(r.seq, ["Frei"]), ist(r) ? r.seq.join(" > ") : js(r));
  // Ist der Vorgaenger schon BESESSEN (installiert oder gekauft), zaehlt er als erfuellt.
  const r2 = ruf("waehleTorRunde", kand, 1e12, ["Fehlt"], opt());
  pruefe("Vorgaenger besessen: der Nachfolger ist kaufbar und kommt zuerst (hoeherer Zuwachs je Dollar)",
    ist(r2) && r2.seq.includes("Haengt") && !r2.seq.includes("Fehlt"), ist(r2) ? r2.seq.join(" > ") : "");
}
{
  // Verdient (rep >= repReq) und nicht besessen: sonst kein Kandidat.
  const kand = [
    k("OhneRuf", 1e9, { strength: 3 }, { rep: 10, repReq: 1000 }),
    k("Besessen", 1e9, { strength: 3 }),
    k("Gut", 1e9, { strength: 1.2 }),
  ];
  const r = ruf("waehleTorRunde", kand, 1e12, ["Besessen"], opt());
  pruefe("zu wenig Ruf und schon Besessenes kommen nie in die Runde",
    ist(r) && gleichListe(r.seq, ["Gut"]), ist(r) ? r.seq.join(" > ") : js(r));
  pruefe("Kandidatenzahl nennt nur die kaufbaren", ist(r) && r.candidates === 1, ist(r) ? String(r.candidates) : "");
}
{
  // Dasselbe Stueck bei zwei Faktionen: einmal, bei der ersten mit genug Ruf.
  const kand = [
    k("Doppelt", 1e9, { strength: 1.5 }, { faktion: "NiteSec", rep: 5, repReq: 1000 }),
    k("Doppelt", 1e9, { strength: 1.5 }, { faktion: "Slum Snakes" }),
  ];
  const r = ruf("waehleTorRunde", kand, 1e12, [], opt());
  pruefe("zwei Faktionen bieten dasselbe Stueck: einmal, bei der mit genug Ruf",
    ist(r) && r.seq.length === 1 && r.steps[0].faktion === "Slum Snakes", ist(r) ? js(r.steps) : "");
}
{
  // Bladeburner-Erfolgschance geht multiplikativ ein: bei gleichem Preis und gleicher
  // Prozentzahl schlaegt sie den Einzelwert (sie hebt die ganze Summe, nicht nur einen Summanden).
  const kand = [
    k("NurDex", 2e9, { dexterity: 1.10 }),
    k("NurChance", 2e9, { bladeburner_success_chance: 1.10 }),
  ];
  const r = ruf("waehleTorRunde", kand, 2.5e9, [], opt());
  pruefe("bei Budget fuer EIN Stueck gewinnt die Erfolgschance-Aug gegen +10 % auf einen Wert",
    ist(r) && gleichListe(r.seq, ["NurChance"]), ist(r) ? r.seq.join(" > ") : js(r));
  const r2 = ruf("waehleTorRunde", [kand[1]], 1e12, [], opt());
  pruefe("und ihr Zuwachs ist genau x1,10", ist(r2) && nah(r2.gain, 1.10, 1e-12), ist(r2) ? String(r2.gain) : "");
}
{
  // Eine Aug ohne wirksamen Faktor (nur Erfahrung, Hacknet) hat Zuwachs 0 und wird nie geplant.
  const kand = [k("Erfahrung", 1e6, { strength_exp: 1.2 }), k("Hacknet", 1e6, {})];
  const r = ruf("waehleTorRunde", kand, 1e12, [], opt());
  pruefe("ohne Wirkung auf die Competence: nichts geplant, Kosten 0",
    ist(r) && r.seq.length === 0 && r.cost === 0 && r.gain === 1, ist(r) ? js(r).slice(0, 120) : "");
}
{
  // Leere Eingaben und Null-Budget werfen nicht.
  const a = ruf("waehleTorRunde", [], 1e12, [], opt());
  const b = ruf("waehleTorRunde", [k("X", 1e9, { strength: 2 })], 0, [], opt());
  const c = ruf("waehleTorRunde", undefined, 1e12, undefined, undefined);
  pruefe("leere Kandidaten / Budget 0 / fehlende Argumente: leere Runde, kein Wurf",
    ist(a) && ist(b) && ist(c) && a.seq.length === 0 && b.seq.length === 0 && c.seq.length === 0,
    js([a, b, c]).slice(0, 200));
}
{
  // Zyklus im Voraussetzungsgraphen: A braucht B, B braucht A. Beide sind nie kaufbar - die
  // Funktion muss ENDEN (harte Grenzen), nicht haengen.
  const kand = [
    k("A", 1e9, { strength: 2 }, { prereq: ["B"] }),
    k("B", 1e9, { strength: 2 }, { prereq: ["A"] }),
    k("Frei", 1e9, { defense: 1.2 }),
  ];
  const t0 = Date.now();
  const r = ruf("waehleTorRunde", kand, 1e12, [], opt());
  pruefe("zyklische Voraussetzungen enden (kein Haenger) und lassen das freie Stueck zu",
    ist(r) && Date.now() - t0 < 2000 && r.seq.includes("Frei"), ist(r) ? r.seq.join(" > ") : js(r));
}
{
  // Der Preisfaktor je wartendem Stueck: mit SF11 kleiner als 1,9 (AugmentationHelpers.ts:28-30).
  const stufen = [0, 1, 2, 3].map((s) => ruf("gatePriceStep", s));
  pruefe("gatePriceStep: 1,9 / 1,824 / 1,786 / 1,767 fuer SF11 0-3",
    stufen.every((x) => typeof x === "number")
    && nah(stufen[0], 1.9) && nah(stufen[1], 1.824) && nah(stufen[2], 1.786) && nah(stufen[3], 1.767),
    js(stufen));
  pruefe("gatePriceStep klemmt unsinnige Stufen (-1, 7, NaN)",
    nah(ruf("gatePriceStep", -1), 1.9) && nah(ruf("gatePriceStep", 7), 1.767) && nah(ruf("gatePriceStep", NaN), 1.9));
  const kand = [k("A", 4e9, { strength: 1.5 }), k("B", 3e9, { defense: 1.5 })];
  const r19 = ruf("waehleTorRunde", kand, 1e12, [], opt({ priceStep: 1.9 }));
  const r182 = ruf("waehleTorRunde", kand, 1e12, [], opt({ priceStep: 1.824 }));
  pruefe("mit kleinerem Preisfaktor sinken die geplanten Kosten (4 + 3 x Faktor)",
    ist(r19) && ist(r182) && nah(r19.cost, 4e9 + 3e9 * 1.9) && nah(r182.cost, 4e9 + 3e9 * 1.824),
    ist(r19) && ist(r182) ? r19.cost + " / " + r182.cost : "");
}
{
  // Bereits wartende Stuecke (startMults) zaehlen im Zuwachs mit: ein Stueck, das nach einer
  // gleichen wartenden Aug nur noch denselben Faktor bringt, bleibt kaufbar, der Zuwachs
  // bezieht sich aber auf den Stand MIT den wartenden Stuecken.
  const prod = ruf("gateMultsProduct", [{ strength: 2, defense: 1.5, strength_exp: 9 }, { strength: 1.5 }, null]);
  pruefe("gateMultsProduct multipliziert nur die Competence-Schluessel (strength 3, defense 1,5, kein _exp)",
    ist(prod) && nah(prod.strength, 3) && nah(prod.defense, 1.5) && prod.strength_exp === undefined,
    js(prod));
  const kand = [k("Neu", 1e9, { strength: 2 })];
  const ohne = ruf("waehleTorRunde", kand, 1e12, [], opt());
  const mit = ruf("waehleTorRunde", kand, 1e12, [], opt({ startMults: { strength: 3 } }));
  // Eigenstaendige Gegenrechnung (Action.ts:169-195, nur der augabhaengige Teil):
  const comp = (extra) => Object.keys(W).reduce((s, st) => s + (W[st] > 0
    ? W[st] * Math.pow(L[st] * (extra[st] || 1), D[st]) : 0), 0);
  pruefe("Zuwachs ohne wartende Stuecke = comp(Staerke x2) / comp(nichts)",
    ist(ohne) && nah(ohne.gain, comp({ strength: 2 }) / comp({})), ist(ohne) ? String(ohne.gain) : "");
  pruefe("Zuwachs MIT wartender Staerke-Aug x3 = comp(x6) / comp(x3) - der Zuwachs bezieht sich auf den Stand nach dem Einbau der Warteschlange",
    ist(mit) && nah(mit.gain, comp({ strength: 6 }) / comp({ strength: 3 })) && !nah(mit.gain, ohne.gain),
    ist(mit) ? String(mit.gain) : "");
}

// ---------------------------------------------------------------------------
console.log("\n-- C. gangBonusWait: Warten auf den Gang-Vorrat --");
const MIN = 60000;
const H = 3600000;
{
  const r = ruf("gangBonusWait", null, 1000, 5000);
  pruefe("Vorrat unter einer Minute: nicht warten, Zustand zurueckgesetzt",
    ist(r) && r.waits === false && r.state.min === null && r.state.seit === null && r.reason === "", js(r));
  const g = ruf("gangBonusWait", null, 1000, 59999);
  const h = ruf("gangBonusWait", null, 1000, 60000);
  pruefe("Schwelle: 59,999 s wartet nicht, 60 s wartet", ist(g) && g.waits === false && ist(h) && h.waits === true);
}
{
  // Nachholen: 17 min Vorrat, 24 s weniger je Sekunde -> nach 30 s ist er unter der Schwelle.
  let z = null;
  let t = 0;
  let r = ruf("gangBonusWait", z, t, 17 * MIN);
  const erste = r;
  pruefe("Vorrat 17 min: warten", ist(r) && r.waits === true && /Gang-Vorrat 1020 s/.test(r.reason), ist(r) ? r.reason : "");
  let letzte = null;
  for (const bonus of [900000, 600000, 300000, 120000, 59000]) {
    t += 15000;
    z = ist(r) ? r.state : null;
    r = ruf("gangBonusWait", z, t, bonus);
    letzte = r;
  }
  pruefe("faellt der Vorrat Runde fuer Runde, wird gewartet bis er unter die Schwelle sinkt - dann Kauf frei",
    ist(erste) && ist(letzte) && letzte.waits === false, ist(letzte) ? js(letzte) : "");
}
{
  // Plateau: der Vorrat sinkt nicht (gedrosselter Tab). Nach 30 min ohne Fortschritt kauft die Runde trotzdem
  // (Skeptiker-Hinweis 03.10.2026: 2 h waren zu grosszuegig).
  pruefe("Wartegrenze GATE_BONUS_WAIT_MAX_MS = 30 min", M.GATE_BONUS_WAIT_MAX_MS === 30 * MIN, String(M.GATE_BONUS_WAIT_MAX_MS));
  let z = null;
  let r = null;
  let t = 0;
  let nochNichtFrei = true;
  let freiNach = null;
  for (let i = 0; i < 600; i++) {   // 600 x 15 s = 2,5 h
    r = ruf("gangBonusWait", z, t, 5 * MIN);
    if (!ist(r)) break;
    z = r.state;
    if (!r.waits && freiNach === null) { freiNach = t; nochNichtFrei = false; }
    t += 15000;
  }
  pruefe("Plateau 5 min: wartet bis 30 min ohne Fortschritt, dann Kauf frei (Stillstandsschutz)",
    !nochNichtFrei && freiNach >= 30 * MIN && freiNach <= 30 * MIN + 15000, "frei nach " + (freiNach / MIN).toFixed(1) + " min");
  const frei = ruf("gangBonusWait", { min: 5 * MIN, seit: 0, zuletzt: 30 * MIN - 15000 }, 30 * MIN, 5 * MIN);
  pruefe("und die Begruendung nennt es (in Minuten)", ist(frei) && frei.waits === false && /sinkt seit 30 min nicht/.test(frei.reason), ist(frei) ? frei.reason : "");
}
{
  // Gedrosselter Tab: der Vorrat WAECHST (+55 s je Minute). Auch dort Kauf frei nach 30 min.
  let z = null;
  let t = 0;
  let r = null;
  let frei = null;
  for (let i = 0; i < 700; i++) {
    r = ruf("gangBonusWait", z, t, 2 * MIN + (t / MIN) * 55000);
    if (!ist(r)) break;
    z = r.state;
    if (!r.waits && frei === null) frei = t;
    t += 15000;
  }
  pruefe("wachsender Vorrat (gedrosselter Tab): nach 30 min Kauf frei, nicht nie",
    frei !== null && frei >= 30 * MIN && frei <= 30 * MIN + 15000, "frei nach " + (frei === null ? "nie" : (frei / MIN).toFixed(1) + " min"));
}
{
  // Pause: Ruhezustand von 5 h mitten im Plateau -> die Wartezeit beginnt von vorn,
  // sonst wuerde die Wandzeit der Pause die Grenze sofort ausloesen.
  let r = ruf("gangBonusWait", null, 0, 10 * MIN);
  r = ruf("gangBonusWait", r.state, 15000, 10 * MIN);
  const nachPause = ruf("gangBonusWait", r.state, 5 * H, 40 * MIN);
  pruefe("Pause von 5 h zwischen zwei Runden: Wartezeit beginnt neu (wartet weiter)",
    ist(nachPause) && nachPause.waits === true && nachPause.state.seit === 5 * H, ist(nachPause) ? js(nachPause.state) : "");
}
{
  // Fortschritt nach abgelaufener Grenze: sinkt der Vorrat wieder, wartet die Runde erneut.
  // Die Grenze wird in 15-s-Schritten erreicht (ein Sprung waere eine Pause und finge neu an).
  let z = null;
  let t = 0;
  let frei = false;
  for (let i = 0; i < 520; i++) {
    const x = ruf("gangBonusWait", z, t, 10 * MIN);
    z = x.state;
    if (!x.waits) { frei = true; break; }
    t += 15000;
  }
  const wieder = ruf("gangBonusWait", z, t + 15000, 5 * MIN);   // faellt unter 90 % des Tiefstands
  pruefe("nach Ablauf der Grenze: faellt der Vorrat wieder deutlich, wird erneut gewartet",
    frei && ist(wieder) && wieder.waits === true, ist(wieder) ? js(wieder) : "");
}
{
  const a = ruf("gangBonusWait", null, 0, NaN);
  const b = ruf("gangBonusWait", null, 0, -5);
  const c = ruf("gangBonusWait", { min: 600000, seit: -99 * H, zuletzt: 0 }, 1000, undefined);
  pruefe("Bonuszeit nicht lesbar (NaN, negativ, undefined): nie warten",
    ist(a) && ist(b) && ist(c) && !a.waits && !b.waits && !c.waits && /nicht lesbar/.test(a.reason), js([a, b, c]).slice(0, 200));
}
{
  const t = (i, g, b) => ruf("gateBuyMode", { inGang: i, gateOpen: g, bonusWaits: b });
  pruefe("gateBuyMode: ohne Gang immer normal (egal ob Tor offen oder Vorrat)",
    t(false, false, false) === "normal" && t(false, true, true) === "normal" && t(false, true, false) === "normal");
  pruefe("gateBuyMode: mit Gang und gesperrtem Tor: locked (auch wenn der Vorrat hoch ist)",
    t(true, false, false) === "locked" && t(true, false, true) === "locked");
  pruefe("gateBuyMode: Tor offen, Vorrat nachzuholen: bonus; sonst round",
    t(true, true, true) === "bonus" && t(true, true, false) === "round");
}

// ---------------------------------------------------------------------------
console.log("\n-- D. Gewichte der Black Ops (src/lib/blackops.json) --");
{
  const ops = tabelle && Array.isArray(tabelle.ops) ? tabelle.ops : [];
  pruefe("blackops.json fuehrt 21 Operationen", ops.length === 21, String(ops.length));
  pruefe("jede Operation hat weights und decays", ops.length === 21 && ops.every((o) => o.weights && o.decays),
    ops.filter((o) => !o.weights || !o.decays).map((o) => o.name).slice(0, 4).join(", "));
  pruefe("jeder Wert mit Gewicht > 0 hat einen Abklingexponenten > 0 (sonst NaN in der Competence)",
    ops.length === 21 && ops.every((o) => o.weights && o.decays
      && Object.entries(o.weights).every(([s, w]) => !(w > 0) || o.decays[s] > 0)));
  const ty = ops.find((o) => o.name === "OperationTyphoon");
  pruefe("Operation Typhoon: hacking 0,1 / vier Kampfwerte je 0,2 / intelligence 0,1, Exponenten 0,6 / 0,8 / 0,75 (BlackOperations.ts:15-30)",
    !!ty && ty?.weights?.hacking === 0.1 && ty?.weights?.strength === 0.2 && ty?.weights?.agility === 0.2
    && ty?.weights?.intelligence === 0.1 && ty?.decays?.hacking === 0.6 && ty?.decays?.defense === 0.8
    && ty?.decays?.intelligence === 0.75, ty ? js(ty.weights) : "fehlt");
  const zero = ops.find((o) => o.name === "OperationZero");
  pruefe("Operation Zero weicht ab (hacking 0,2, Staerke und Verteidigung je 0,15)",
    !!zero && zero?.weights?.hacking === 0.2 && zero?.weights?.strength === 0.15 && zero?.weights?.defense === 0.15,
    zero ? js(zero.weights) : "fehlt");

  const a = ruf("blackOpWeights", tabelle, "Operation Zero");
  pruefe("blackOpWeights: Spielname 'Operation Zero' findet OperationZero",
    ist(a) && a.name === "OperationZero" && a.weights.hacking === 0.2, ist(a) ? a.source : "");
  const b = ruf("blackOpWeights", tabelle, "Operation Unbekannt");
  pruefe("unbekannter Name: Rueckfall auf die erste Operation, und die Quelle SAGT es",
    ist(b) && b.name === "OperationTyphoon" && /Rueckfall/.test(b.source) && /nicht in der Tabelle/.test(b.source),
    ist(b) ? b.source : "");
  const c = ruf("blackOpWeights", tabelle, null);
  pruefe("kein Name: Rueckfall, die Quelle sagt 'naechste Op unbekannt'",
    ist(c) && /naechste Op unbekannt/.test(c.source), ist(c) ? c.source : "");
  const d = ruf("blackOpWeights", { ops: [{ name: "OperationTyphoon", rang: 1 }] }, "Operation Typhoon");
  const e = ruf("blackOpWeights", null, "x");
  pruefe("Tabelle ohne Gewichte oder gar keine Tabelle: eingebaute Typhoon-Werte, Quelle nennt den Rueckfall",
    ist(d) && ist(e) && /eingebaut/.test(d.source) && /eingebaut/.test(e.source) && d.weights.strength === 0.2 && e.decays.hacking === 0.6,
    ist(d) && ist(e) ? d.source + " | " + e.source : "");
}

// ---------------------------------------------------------------------------
// Der Spielquelltext, soweit vorhanden (Hauptbaum und Klone mit reference/).
// Fehlt er, laufen die Eichungen gegen ihn nicht - das steht dann in der Ausgabe.
function leseQuelle(rel) {
  for (const wurzel of ["reference/v301/src", "reference/bitburner-src/src"]) {
    try { return fs.readFileSync(path.join(ROOT, wurzel, rel), "utf8"); } catch { /* naechste Wurzel */ }
  }
  return null;
}
function ueberspringe(was) { console.log("  skip  " + was + " (Spielquelltext nicht vorhanden)"); }

console.log("\n-- E. Faehigkeiten Reaper / Evasive System: in der Potenz, kuerzen sich nicht heraus --");
{
  // E1: die Faktoren. Unabhaengiger Nachbau von updateSkillMultipliers (Bladeburner.ts:776-784)
  // mit den Werten aus Skills.ts, falls der Quelltext da ist.
  const skillsTs = leseQuelle("Bladeburner/data/Skills.ts");
  const multsVon = (name) => {
    if (!skillsTs) return null;
    const m = new RegExp("name: BladeburnerSkillName\\." + name + ",[\\s\\S]*?mults:\\s*\\{([\\s\\S]*?)\\}").exec(skillsTs);
    if (!m) return null;
    const out = {};
    for (const x of m[1].matchAll(/\[BladeburnerMultName\.(\w+)\]:\s*([0-9.]+)/g)) out[x[1]] = Number(x[2]);
    return out;
  };
  const reaperMults = multsVon("Reaper");
  const evasiveMults = multsVon("EvasiveSystem");
  const bekannt = ruf("bladeEffFactors", 12, 13);
  pruefe("bladeEffFactors(12, 13): Staerke/Verteidigung x1,24, Geschicklichkeit/Beweglichkeit x1,24 x 1,52 = x1,8848",
    ist(bekannt) && nah(bekannt.strength, 1.24) && nah(bekannt.defense, 1.24)
    && nah(bekannt.dexterity, 1.8848) && nah(bekannt.agility, 1.8848), js(bekannt));
  const null0 = ruf("bladeEffFactors", 0, 0);
  const schlecht = ruf("bladeEffFactors", NaN, -3);
  pruefe("Stufe 0, NaN oder negativ: Faktor 1 (ein Lesefehler darf die Runde nicht verzerren)",
    ist(null0) && ist(schlecht) && ["strength", "defense", "dexterity", "agility"].every((k) => null0[k] === 1 && schlecht[k] === 1),
    js([null0, schlecht]));
  if (reaperMults && evasiveMults) {
    const ref = (r, e) => {
      const m = {};
      for (const [lvl, mults] of [[r, reaperMults], [e, evasiveMults]]) {
        if (!lvl) continue;
        for (const [name, base] of Object.entries(mults)) m[name] = (m[name] ?? 1) * (1 + (base * lvl) / 100);
      }
      return m;
    };
    let alleGleich = true;
    let hinweisE = "";
    for (const [r, e] of [[0, 0], [1, 0], [0, 7], [12, 13], [30, 40], [3, 99]]) {
      const x = ruf("bladeEffFactors", r, e);
      const y = ref(r, e);
      const ok = ist(x) && nah(x.strength, y.EffStr ?? 1) && nah(x.defense, y.EffDef ?? 1)
        && nah(x.dexterity, y.EffDex ?? 1) && nah(x.agility, y.EffAgi ?? 1);
      if (!ok) { alleGleich = false; hinweisE += " (" + r + "," + e + ")"; }
    }
    pruefe("bladeEffFactors gleich dem Nachbau von updateSkillMultipliers aus Skills.ts (6 Stufenpaare)", alleGleich, hinweisE);
  } else ueberspringe("bladeEffFactors gegen Skills.ts");

  // E2: effectiveLevels
  const roh = { hacking: 372, strength: 194, defense: 181, dexterity: 181, agility: 181, intelligence: 153 };
  const eff = ruf("bladeEffFactors", 12, 13);
  const effL = ruf("effectiveLevels", roh, eff);
  pruefe("effectiveLevels: vier Kampfwerte mal Faktor, hacking und intelligence unveraendert, Eingabe nicht veraendert",
    ist(effL) && nah(effL.strength, 194 * 1.24) && nah(effL.dexterity, 181 * 1.8848) && effL.hacking === 372
    && effL.intelligence === 153 && roh.strength === 194, js(effL));
  const ohneEff = ruf("effectiveLevels", roh, null);
  pruefe("effectiveLevels ohne Faktoren: eine gleiche Kopie", ist(ohneEff) && ohneEff !== roh && js(ohneEff) === js(roh), js(ohneEff));

  // E3: die Planung. Echte Competence unabhaengig gerechnet (Action.ts:173: pow(effektive Stufe x Aug-Faktor, decay)).
  const H = await import(pathToFileURL(path.join(SRC, "lib", "hackaugs.js")).href);
  const KEYS4 = ["strength", "defense", "dexterity", "agility"];
  const trueComp = (extra) => {
    let c = 0;
    for (const st of Object.keys(daedalus.weights)) {
      const w = daedalus.weights[st];
      if (!(w > 0)) continue;
      const lv = fx.levels[st] * (KEYS4.includes(st) && ist(eff) ? eff[st] : 1) * (extra[st] || 1);
      c += w * Math.pow(lv, daedalus.decays[st]);
    }
    return c * (extra.bladeburner_success_chance || 1);
  };
  const extraVon = (seq) => ruf("gateMultsProduct", seq.map((n) => H.COMBAT_AUGS[n]));
  const trueGain = (seq) => trueComp(extraVon(seq)) / trueComp({});
  const q0 = 4;   // Live-Stand 03.10.: vier Stuecke in der Warteschlange
  const eingabe = fx.offer.map((a) => ({
    aug: a.name, faktion: "Slum Snakes", rep: 1e9, repReq: a.repCost, preis: a.moneyCost * Math.pow(1.9, q0),
    prereq: a.prereqs, mults: H.COMBAT_AUGS[a.name],
  }));
  const planMit = (budget, levels) => ruf("waehleTorRunde", eingabe, budget, new Set(fx.owned), {
    skills: levels, weights: daedalus.weights, decays: daedalus.decays, priceStep: 1.9,
  });
  const zeilen = [];
  let nieSchlechter = true;
  let gainStimmt = true;
  const verhaeltnis = {};
  for (const budget of [10e9, 30e9, 60e9, 150e9]) {
    const a = planMit(budget, roh);
    const b = planMit(budget, effL);
    if (!ist(a) || !ist(b)) { nieSchlechter = false; gainStimmt = false; continue; }
    const ga = trueGain(a.seq);
    const gb = trueGain(b.seq);
    verhaeltnis[budget] = gb / ga;
    if (gb < ga * (1 - 1e-12)) nieSchlechter = false;
    if (!nah(b.gain, gb, 1e-9)) gainStimmt = false;
    zeilen.push((budget / 1e9) + " Mrd: roh x" + ga.toFixed(4) + ", effektiv x" + gb.toFixed(4)
      + (a.seq.join() === b.seq.join() ? " (gleiche Runde)" : " (andere Runde)"));
  }
  pruefe("mit effektiven Stufen geplant ist die ECHTE Competence nie schlechter als mit rohen (10/30/60/150 Mrd)",
    nieSchlechter, zeilen.join(" | "));
  pruefe("bei 60 Mrd waehlt der Planer mit effektiven Stufen eine andere, > 2 % bessere Runde (Reaper 12, Evasive 13)",
    verhaeltnis[60e9] > 1.02, "Verhaeltnis " + (verhaeltnis[60e9] || 0).toFixed(4));
  pruefe("bei 150 Mrd > 1 % besser", verhaeltnis[150e9] > 1.01, "Verhaeltnis " + (verhaeltnis[150e9] || 0).toFixed(4));
  pruefe("der gemeldete Zuwachs der effektiv geplanten Runde ist die echte Competence-Aenderung (rohe Stufen: daneben)",
    gainStimmt && (() => {
      const a = planMit(60e9, roh);
      return ist(a) && !nah(a.gain, trueGain(a.seq), 1e-4);
    })(), zeilen.join(" | "));

  // E4: bladeSkillLevels - nur frische Daten des richtigen Knotens
  const NOW = 1_000_000_000_000;
  const gut = { zeit: NOW - 60000, nodeReset: 77, skillLevels: { reaper: 12, evasive: 13 }, skillLevelsError: null };
  const a = ruf("bladeSkillLevels", gut, NOW, 77);
  pruefe("bladeSkillLevels: frische Datei des Knotens -> ok mit Stufen", ist(a) && a.ok === true && a.reaper === 12 && a.evasive === 13, js(a));
  const lehnt = (name, j, node = 77, jetzt = NOW) => {
    const r = ruf("bladeSkillLevels", j, jetzt, node);
    pruefe("bladeSkillLevels lehnt ab: " + name, ist(r) && r.ok === false && r.reaper === 0 && r.evasive === 0 && r.why.length > 0, js(r));
  };
  lehnt("Datei fehlt", null);
  lehnt("zu alt (31 min)", { ...gut, zeit: NOW - 31 * 60000 });
  lehnt("anderer Knoten (nodeReset)", gut, 78);
  lehnt("ohne skillLevels (altes blade.js)", { zeit: NOW - 1000, nodeReset: 77 });
  lehnt("blade.js meldet einen Fehler", { ...gut, skillLevels: null, skillLevelsError: "Bladeburner nicht verfuegbar" });
  lehnt("Stufen unlesbar", { ...gut, skillLevels: { reaper: "x", evasive: 3 } });
  lehnt("negative Stufe", { ...gut, skillLevels: { reaper: -1, evasive: 3 } });
  lehnt("Zeit in der Zukunft (Uhr springt)", { ...gut, zeit: NOW + 2 * 3600000 });
  const ohneStempel = ruf("bladeSkillLevels", { ...gut, nodeReset: undefined }, NOW, 77);
  pruefe("ohne Knotenstempel in der Datei: wird akzeptiert (aeltere Dateien tragen ihn nicht immer)", ist(ohneStempel) && ohneStempel.ok, js(ohneStempel));
}

// ---------------------------------------------------------------------------
console.log("\n-- F. Wartezustand ueber einen Neustart und Halt nach abgebrochener Torrunde --");
{
  const lesen = (x, jetzt = 10 * H) => ruf("readGateBonusState", x, jetzt);
  const frisch = { min: null, seit: null, zuletzt: null };
  const gueltig = { min: 600000, seit: 1000, zuletzt: 5000 };
  pruefe("readGateBonusState: gueltiger Zustand kommt unveraendert zurueck", js(lesen(gueltig)) === js(gueltig), js(lesen(gueltig)));
  const schlechte = [null, undefined, "x", 5, [], {}, { min: "a", seit: 1, zuletzt: 2 }, { min: -1, seit: 1, zuletzt: 2 },
    { min: 1, seit: 9, zuletzt: 2 }, { min: 1, seit: 1, zuletzt: NaN }, { min: 1, seit: 1, zuletzt: 99 * H }];
  pruefe("readGateBonusState: Muell, fehlende Felder, negative Zahlen, seit nach zuletzt, Zukunft -> frischer Zustand",
    schlechte.every((x) => js(lesen(x)) === js(frisch)), js(schlechte.map((x) => js(lesen(x))).filter((z) => z !== js(frisch))));

  // Neustart nach 29 min Plateau: mit dem Zustand aus der Datei ist die Grenze nach 30 min erreicht, nicht erst nach 59.
  let z = null;
  let t = 0;
  const MINd = 60000;
  for (; t <= 29 * MINd; t += 15000) {
    const r = ruf("gangBonusWait", z, t, 5 * MINd);
    z = r.state;
  }
  const ausDatei = JSON.parse(JSON.stringify(z));   // so landet er in data/torrunde-wait.json
  const bisFrei = (start, zustand) => {
    let zz = zustand;
    for (let tt = start; tt < start + 70 * MINd; tt += 15000) {
      const r = ruf("gangBonusWait", zz, tt, 5 * MINd);
      if (!ist(r)) return null;
      if (!r.waits) return tt;
      zz = r.state;
    }
    return null;
  };
  const mitDatei = bisFrei(t, lesen(ausDatei, t));
  const ohneDatei = bisFrei(t, frisch);
  pruefe("Neustart bei 29 min Plateau MIT wiederhergestelltem Zustand: Kauf frei nach 30 min Gesamtwartezeit",
    mitDatei !== null && mitDatei <= 30 * MINd + 15000, "frei bei " + (mitDatei === null ? "nie" : (mitDatei / MINd).toFixed(1) + " min"));
  pruefe("(Gegenprobe) OHNE Wiederherstellung wartet derselbe Neustart weitere 30 min - das war die Luecke",
    ohneDatei !== null && ohneDatei >= 58 * MINd, "frei bei " + (ohneDatei === null ? "nie" : (ohneDatei / MINd).toFixed(1) + " min"));
  // Nach einer langen Pause (Rechner aus) beginnt die Wartezeit trotz Datei von vorn - gangBonusWait erkennt die Luecke.
  const nachPause = ruf("gangBonusWait", lesen(ausDatei, t + 5 * H), t + 5 * H, 5 * MINd);
  pruefe("Datei aus einer Pause von 5 h: die Wartezeit beginnt neu", ist(lesen(ausDatei, t + 5 * H)) && ist(nachPause) && nachPause.waits === true && nachPause.state.seit === t + 5 * H,
    js(nachPause));

  const halt = (n) => ruf("gateAbortHold", n);
  pruefe("gateAbortHold: 1 bis GATE_ABORT_HOLD_ROUNDS (20) Runden in Folge haelt der Einbau zurueck, danach nicht",
    M.GATE_ABORT_HOLD_ROUNDS === 20 && halt(1) === true && halt(20) === true && halt(21) === false,
    [halt(1), halt(20), halt(21), M.GATE_ABORT_HOLD_ROUNDS].map((x) => String(x)).join(","));
  pruefe("gateAbortHold: 0, negativ, NaN, undefined halten nicht (kein Abbruch, kein Halt)",
    halt(0) === false && halt(-1) === false && halt(NaN) === false && halt(undefined) === false);
}

// ---------------------------------------------------------------------------
console.log("\n-- G. COMBAT_AUGS: Hackingfaktoren der Gang-Stuecke (Augmentations.ts) --");
{
  const H = await import(pathToFileURL(path.join(SRC, "lib", "hackaugs.js")).href);
  const erwartet = {
    "SPTN-97 Gene Modification": 1.15, "nextSENS Gene Modification": 1.2, "Xanipher": 1.2,
    "The Black Hand": 1.1, "Power Recirculation Core": 1.05,
  };
  pruefe("COMBAT_AUGS traegt hacking fuer SPTN-97 1,15, nextSENS 1,2, Xanipher 1,2, The Black Hand 1,1, Power Recirculation Core 1,05",
    Object.entries(erwartet).every(([n, f]) => H.COMBAT_AUGS[n] && H.COMBAT_AUGS[n].hacking === f),
    Object.keys(erwartet).map((n) => n + " " + (H.COMBAT_AUGS[n] || {}).hacking).join(", "));
  const augTs = leseQuelle("Augmentation/Augmentations.ts");
  const enumTs = leseQuelle("Augmentation/Enums.ts");
  if (augTs && enumTs) {
    const schluessel = new Map();
    for (const x of enumTs.matchAll(/^\s*(\w+)\s*=\s*"([^"]+)"/gm)) schluessel.set(x[2], x[1]);
    const abw = [];
    let geprueft = 0;
    for (const [name, c] of Object.entries(H.COMBAT_AUGS)) {
      if (name.startsWith("Stanek")) continue;   // BN13, nicht Teil der Gang-/Bladeburner-Angebote
      const key = schluessel.get(name);
      const i = key ? augTs.indexOf("[AugmentationName." + key + "]:") : -1;
      if (i < 0) { abw.push(name + " (nicht im Quelltext)"); continue; }
      const rest = augTs.slice(i + 10);
      const j = rest.search(/\n    \[AugmentationName\.|\n    \/\/ ===/);
      const body = augTs.slice(i, i + 10 + (j < 0 ? 3000 : j));
      const m = /\n\s*hacking:\s*([0-9.]+)\s*,/.exec(body);
      geprueft++;
      if (Math.abs((m ? Number(m[1]) : 1) - (c.hacking || 1)) > 1e-9) abw.push(name + " Spiel " + (m ? m[1] : 1) + " Tabelle " + c.hacking);
    }
    pruefe("hacking jeder COMBAT_AUGS-Zeile (ausser Stanek) gleich dem Quelltext (" + geprueft + " Stuecke)", abw.length === 0 && geprueft > 50, abw.join("; "));
  } else ueberspringe("COMBAT_AUGS hacking gegen Augmentations.ts");
}

console.log("");
console.log(gruen + " ok, " + rot + " rot von " + (gruen + rot));
if (rot) {
  console.log("\nFehlgeschlagen:");
  for (const f of fehler) console.log("  - " + f);
}
process.exit(rot ? 1 : 0);
