/**
 * Die Handelsregel (lib/handel.js), das Bargeld auf Abruf (lib/boersepause.js)
 * und boerse.js gegen das nachgebaute Marktmodell (BN8-2/3/4, 10.11.2026).
 *
 * Ebene 0: die reinen Funktionen.
 * Ebene 2: boerse.js laeuft unveraendert gegen einen Mock, dessen Boersen-API
 *          vom Marktmodell aus tools/audit/boerse-sim.mjs gespeist wird. Das
 *          prueft die VERDRAHTUNG - am 10.11. war ein Aufruf mit falscher
 *          Signatur der Grund, dass ein ganzes Feature tot war, und ein Test
 *          der reinen Funktionen sah es nicht.
 *
 * Aufruf: node tools/test-handel.js [srcVerzeichnis]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neuerMock } from "./mock/ns.js";
import { ladeSpielskript } from "./mock/lader.js";
import { Market, Account } from "./audit/boerse-sim.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(process.argv[2] || path.join(HIER, "..", "src"));
let gruen = 0, rot = 0;
const pruefe = (name, ok, hinweis = "") => {
  if (ok) { gruen++; console.log("  ok    " + name); }
  else { rot++; console.log("  ROT   " + name + (hinweis ? " - " + hinweis : "")); }
};
const da = (rel) => fs.existsSync(path.join(SRC, rel));

console.log("\n=== Handelsregel und Bargeld auf Abruf ===\n    " + SRC);
pruefe("lib/handel.js existiert", da("lib/handel.js"));
pruefe("lib/boersepause.js existiert", da("lib/boersepause.js"));
if (!da("lib/handel.js") || !da("lib/boersepause.js")) {
  console.log("\n=== " + gruen + " gruen, " + (rot + 1) + " rot ===");
  process.exit(1);
}
const H = await import(pathToFileURL(path.join(SRC, "lib", "handel.js")).href);
const P = await import(pathToFileURL(path.join(SRC, "lib", "boersepause.js")).href);

console.log("\n-- Ebene 0: Schaetzung --");
{
  pruefe("zu wenige Schritte: keine Meinung", H.schaetze([1, 2, 3]).f === 0.5);
  const steigend = Array.from({ length: 31 }, (_, i) => 100 * 1.01 ** i);
  const e = H.schaetze(steigend);
  pruefe("lauter Aufwaertsticks: f = 1", e.f === 1);
  pruefe("Schrittweite 1 % ergibt mv = 2 (E[av] = mv/200)", Math.abs(e.mv - 2) < 1e-6, String(e.mv));
  const fallend = Array.from({ length: 31 }, (_, i) => 100 / 1.01 ** i);
  pruefe("lauter Abwaertsticks: f = 0, mv gleich", H.schaetze(fallend).f === 0 && Math.abs(H.schaetze(fallend).mv - 2) < 1e-6);
  const lang = [...Array.from({ length: 60 }, (_, i) => 100 / 1.01 ** i)];
  for (let i = 0; i < 30; i++) lang.push(lang[lang.length - 1] * 1.01);
  pruefe("nur das Fenster zaehlt (alte Abwaertsticks fallen heraus)", H.schaetze(lang, 30).f === 1);
  pruefe("Stillstand zaehlt nicht", H.schaetze([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]).f === 0.5);
}

console.log("\n-- Ebene 0: Kauf- und Verkaufsliste --");
{
  const basis = { quelle: "4S", ticks: 999, lang: 0, ask: 100, bid: 99, maxStueck: 1e9 };
  const lage = [
    { ...basis, sym: "SICHER", f: 0.70, mv: 0.5 },   // Ertrag 0,20
    { ...basis, sym: "WILD", f: 0.60, mv: 2.0 },     // Ertrag 0,40
    { ...basis, sym: "KNAPP", f: 0.575, mv: 1.0 },
    { ...basis, sym: "FAELLT", f: 0.40, mv: 3.0, lang: 1000 },
  ];
  const voll = { ...H.REGEL, maxAnteil: 1 };
  const k = H.kaufliste(lage, 1e9, 0, voll);
  pruefe("Rang nach Ertrag (2f-1)*mv, nicht nach f", k.length >= 1 && k[0].sym === "WILD", JSON.stringify(k));
  pruefe("ohne Deckel geht das ganze freie Kapital in den besten Titel", k.length === 1 && Math.abs(k[0].stueck * 100 + H.KOMMISSION - 1e9) < 200);
  const kd = H.kaufliste(lage, 1e9, 0);
  pruefe("Standard: hoechstens die Haelfte des Vermoegens in einem Titel", H.REGEL.maxAnteil === 0.5 && kd.length === 2
    && kd[0].sym === "WILD" && kd[0].stueck * 100 <= 0.5 * (1e9 + 1000 * 99) + 100 && kd[1].sym === "SICHER", JSON.stringify(kd));
  const voller = lage.map((e) => (e.sym === "WILD" ? { ...e, lang: 6e6 } : e));
  pruefe("ein Titel ueber dem Deckel wird nicht aufgestockt", !H.kaufliste(voller, 1e8, 0).some((x) => x.sym === "WILD"));
  const eng = lage.map((e) => (e.sym === "WILD" ? { ...e, maxStueck: 1e6 } : e));
  const k2 = H.kaufliste(eng, 1e9, 0, voll);
  pruefe("Stueckgrenze erreicht: der Rest geht in den naechsten", k2.length >= 2 && k2[0].stueck === 1e6 && k2[1].sym === "SICHER", JSON.stringify(k2));
  pruefe("die Reserve bleibt liegen", H.kaufliste(lage, 1e9, 9.9e8).length === 0);
  const k3 = H.kaufliste(lage, 1e9, 5e8, voll);
  pruefe("ueber der Reserve wird gekauft", k3.length === 1 && k3[0].stueck * 100 <= 5e8);
  pruefe("unter dem Mindestposten wird nichts gekauft", H.kaufliste(lage, 1.5e7, 0).length === 0);
  const hist = [{ ...basis, quelle: "Historie", ticks: 30, sym: "A", f: 0.575, mv: 1 }];
  pruefe("Gleitkomma: 0,575 erfuellt die Schwelle 0,075", H.kaufliste(hist, 1e9, 0).length === 1);
  pruefe("unter der Schwelle nicht", H.kaufliste([{ ...hist[0], f: 0.56 }], 1e9, 0).length === 0);
  pruefe("junge Schaetzung kauft nicht", H.kaufliste([{ ...hist[0], f: 0.9, ticks: 12 }], 1e9, 0).length === 0);
  pruefe("verkauft wird, was unter 0,5 gefallen ist", JSON.stringify(H.verkaufsliste(lage)) === '["FAELLT"]');
  pruefe("junge Schaetzung verkauft nicht", H.verkaufsliste([{ sym: "X", f: 0.2, mv: 1, quelle: "Historie", ticks: 5, lang: 10 }]).length === 0);
}

console.log("\n-- Ebene 0: Bargeld freimachen --");
{
  const lage = [
    { sym: "GUT", f: 0.7, mv: 2, lang: 1000, bid: 1e6 },      // 1 Mrd
    { sym: "SCHWACH", f: 0.52, mv: 1, lang: 1000, bid: 1e6 }, // 1 Mrd
    { sym: "LEER", f: 0.9, mv: 9, lang: 0, bid: 1e6 },
  ];
  pruefe("reicht das Bargeld, wird nichts verkauft", H.freimachen(lage, 5e8, 4e8).length === 0);
  const v = H.freimachen(lage, 0, 5e8);
  pruefe("der schwaechste Posten zuerst, nur anteilig", v.length === 1 && v[0].sym === "SCHWACH" && v[0].stueck < 1000, JSON.stringify(v));
  pruefe("der Erloes deckt den Betrag samt Kommission", v[0].stueck * 1e6 - H.KOMMISSION >= 5e8);
  const v2 = H.freimachen(lage, 0, 1.5e9);
  pruefe("reicht einer nicht, kommt der naechste dran", v2.length === 2 && v2[0].stueck === 1000 && v2[1].sym === "GUT");
  pruefe("Depotwert zum Geldkurs minus Kommission", H.depotwert(lage) === 2e9 - 2 * H.KOMMISSION);
  pruefe("4S faellig ab der Schwelle", H.kauf4SFaellig(H.SCHWELLE_4S, false) && !H.kauf4SFaellig(H.SCHWELLE_4S - 1, false));
  pruefe("4S nie doppelt", !H.kauf4SFaellig(1e15, true));
  pruefe("die Schwelle laesst nach dem Kauf Kapital uebrig", H.SCHWELLE_4S >= H.KOSTEN_4S * 1.3);
}

console.log("\n-- Ebene 0: Abruf und Sicht von bn4rep --");
{
  const t0 = 1e12;
  const roh = P.abrufAnlegen(5e9, "Kauf X", t0);
  pruefe("frischer Abruf gilt", P.abrufLesen(roh, t0 + 1000).betrag === 5e9 && P.abrufLesen(roh, t0 + 1000).grund === "Kauf X");
  pruefe("abgelaufener Abruf gilt nicht", P.abrufLesen(roh, t0 + P.ABRUF_MS).betrag === 0);
  pruefe("kaputte Datei = kein Abruf", P.abrufLesen("{x", t0).betrag === 0 && P.abrufLesen("", t0).betrag === 0);
  pruefe("jeder Abruf hat eine eigene id", P.abrufLesen(roh, t0).id && P.abrufLesen(roh, t0).id !== P.abrufLesen(P.abrufAnlegen(5e9, "Kauf X", t0 + 1), t0 + 1).id);
  const tel = (o) => JSON.stringify({ ts: t0, state: "work", hat4S: true, depotWert: 3e10, ...o });
  pruefe("Boerse traegt: frisch, handelt, hat 4S", P.boerseSicht(tel({}), t0 + 5000).traegt && P.boerseSicht(tel({}), t0).depot === 3e10);
  pruefe("ohne 4S aktiv, aber traegt nicht", P.boerseSicht(tel({ hat4S: false }), t0).aktiv && !P.boerseSicht(tel({ hat4S: false }), t0).traegt);
  const alt = P.boerseSicht(tel({}), t0 + P.TEL_FRISCH_MS + 1, t0 - 1000);
  pruefe("alte Telemetrie: nicht aktiv", !alt.aktiv && alt.depot === 0);
  pruefe("... aber UNKLAR mit dem letzten Depot (kein Einbau!)", alt.unklar === true && alt.depotLetzt === 3e10);
  pruefe("alte Telemetrie ohne Depot ist nicht unklar", !P.boerseSicht(tel({ depotWert: 0 }), t0 + P.TEL_FRISCH_MS + 1, 0).unklar);
  const vorEinbau = P.boerseSicht(tel({}), t0 + 10 * 3600000, t0 + 5000);
  pruefe("Telemetrie von VOR dem letzten Einbau zaehlt nicht (Depot ist weg)", !vorEinbau.unklar && vorEinbau.depotLetzt === 0 && !vorEinbau.aktiv);
  pruefe("4S dreimal gescheitert: traegt auch ohne 4S (kein ewiges Warten)", P.boerseSicht(tel({ hat4S: false, fehl4S: P.FEHL_4S_GRENZE }), t0).traegt
    && !P.boerseSicht(tel({ hat4S: false, fehl4S: P.FEHL_4S_GRENZE - 1 }), t0).traegt);
  pruefe("beendet: nicht aktiv", !P.boerseSicht(tel({ state: "done" }), t0).aktiv);
  pruefe("keine Telemetrie: nicht aktiv, Depot 0", !P.boerseSicht(null, t0).aktiv && P.boerseSicht("kaputt", t0).depot === 0);
  pruefe("Pause (state wait) bleibt aktiv", P.boerseSicht(tel({ state: "wait", depotWert: 0 }), t0).aktiv);
  pruefe("Bargeld reicht: bar", P.kaufAusDepot(1e9, 2e9, 0) === "bar");
  pruefe("Vermoegen >= Faktor x Preis: Abruf", P.kaufAusDepot(1e9, 0, 1e9 * P.KAUF_FAKTOR) === "abruf");
  pruefe("darunter: nein (wartet auf die Einbaurunde)", P.kaufAusDepot(1e9, 0, 1e9 * P.KAUF_FAKTOR - 1) === "nein");
}

// ---------------------------------------------------------------------------
// Ebene 2: boerse.js gegen das Marktmodell
// ---------------------------------------------------------------------------
const modul = await ladeSpielskript(path.join(SRC, "boerse.js"));

async function laufe({ seed, geld, hat4S = false, fehl4S = false, ticks, vorTick }) {
  const market = new Market(seed);
  const acc = new Account(geld);
  const opt = { hat4S, kaeufe: 0, verkaeufe: 0, fehl4S, versuche4S: 0 };
  let tick = 0;
  const m = neuerMock({
    geld,
    maxSchlaf: ticks,
    beiSchlaf: (ms, zustand, vor) => {
      tick++;
      market.tick();
      vor(6000);
      if (vorTick) vorTick(tick, m, market, acc);
    },
  });
  const z = m.zustand;
  const rein = () => { acc.cash = z.spieler.money; };
  const raus = () => { z.spieler.money = acc.cash; z.server.home.geld = acc.cash; };
  const S = (sym) => market.bySym[sym];
  m.ns.stock = {
    getSymbols: () => market.stocks.map((s) => s.symbol),
    getPrice: (sym) => S(sym).price,
    getAskPrice: (sym) => S(sym).getAskPrice(),
    getBidPrice: (sym) => S(sym).getBidPrice(),
    getPosition: (sym) => [S(sym).playerShares, S(sym).playerAvgPx, S(sym).playerShortShares, S(sym).playerAvgShortPx],
    getMaxShares: (sym) => S(sym).maxShares,
    has4SDataTixApi: () => opt.hat4S,
    purchase4SMarketDataTixApi: () => {
      rein();
      opt.versuche4S++;
      if (opt.fehl4S || acc.cash < 25e9) return false;
      acc.cash -= 25e9; raus(); opt.hat4S = true; return true;
    },
    getForecast: (sym) => { if (!opt.hat4S) throw new Error("4S fehlt"); return S(sym).forecast(); },
    getVolatility: (sym) => { if (!opt.hat4S) throw new Error("4S fehlt"); return S(sym).volatility(); },
    buyStock: (sym, n) => { rein(); const ok = acc.buy(S(sym), n); raus(); if (ok) opt.kaeufe++; return ok ? S(sym).getAskPrice() : 0; },
    sellStock: (sym, n) => { rein(); const ok = acc.sell(S(sym), n); raus(); if (ok) opt.verkaeufe++; return ok ? S(sym).getBidPrice() : 0; },
  };
  const zurueck = m.uhrStellen();
  let abbruch = null;
  try { await modul.main(m.ns); } catch (e) { if (!e.mockAbbruch) abbruch = e; } finally { zurueck(); }
  rein();
  const tel = JSON.parse(m.lies("home", "data/boerse.json") || "{}");
  return { m, market, acc, opt, tel, abbruch, vermoegen: acc.wealth(market) };
}

console.log("\n-- Ebene 2: ohne 4S handeln (2 h Markt) --");
{
  const r = await laufe({ seed: 4711, geld: 250e6, ticks: 1200 });
  pruefe("laeuft ohne Ausnahme durch", r.abbruch === null, String(r.abbruch && r.abbruch.stack));
  pruefe("keine Rundenfehler", r.tel.errStreak === 0 && r.tel.lastError === null, JSON.stringify(r.tel.lastError));
  pruefe("es wurde gekauft und verkauft", r.opt.kaeufe > 0 && r.opt.verkaeufe > 0, r.opt.kaeufe + "/" + r.opt.verkaeufe);
  pruefe("Telemetrie: state work, kein 4S", r.tel.state === "work" && r.tel.hat4S === false);
  pruefe("Telemetrie: Depotwert stimmt mit dem Markt (Geldkurs)", Math.abs(r.tel.depotWert - r.acc.depot(r.market)) <= Math.max(1, r.tel.depotWert * 0.02), r.tel.depotWert + " vs " + r.acc.depot(r.market));
  pruefe("das Kapital ist nicht verspielt (>= 60 % nach 2 h)", r.vermoegen >= 150e6, (r.vermoegen / 1e6).toFixed(0) + " Mio");
}

console.log("\n-- Ebene 2: 4S-Kauf aus dem Vermoegen --");
{
  // Start ganz investiert knapp unter der Schwelle geht nicht ohne Vorlauf -
  // also mit Bargeld ueber der Schwelle: erste Runde kauft.
  const r = await laufe({ seed: 7, geld: H.SCHWELLE_4S + 5e9, ticks: 60 });
  pruefe("laeuft durch", r.abbruch === null, String(r.abbruch && r.abbruch.stack));
  pruefe("4S gekauft", r.opt.hat4S === true && r.tel.hat4S === true);
  pruefe("25 Mrd sind weg, der Rest arbeitet", r.vermoegen > H.SCHWELLE_4S + 5e9 - 25e9 - 3e9 && r.vermoegen < H.SCHWELLE_4S + 5e9 - 25e9 + 5e9, (r.vermoegen / 1e9).toFixed(1));
  pruefe("mit 4S wird sofort gekauft (keine 20 Ticks Wartezeit)", r.opt.kaeufe > 0);

  // Unter der Schwelle: kein Kauf, auch wenn Bargeld > 26 Mrd waere.
  const r2 = await laufe({ seed: 7, geld: H.SCHWELLE_4S - 5e9, ticks: 30 });
  pruefe("unter der Schwelle kein 4S-Kauf", r2.opt.hat4S === false);

  // Investiert ueber der Schwelle: es muss verkauft werden, um zu kaufen.
  let gesetzt = false;
  const r3 = await laufe({ seed: 11, geld: 20e9, ticks: 400, vorTick: (t, m, market, acc) => {
    if (t === 300 && !gesetzt) {   // Kursgewinn nachstellen: Depot aufwerten
      gesetzt = true;
      for (const s of market.stocks) if (s.playerShares > 0) { s.price *= 4; s.lastPrice = s.price; }
    }
  } });
  pruefe("investiertes Vermoegen ueber der Schwelle: es verkauft und kauft 4S", r3.opt.hat4S === true, "Vermoegen " + (r3.vermoegen / 1e9).toFixed(1));

  // Fehlschlag darf nicht jede Runde neu verkaufen (jedes Mal die Spanne).
  const r4 = await laufe({ seed: 3, geld: H.SCHWELLE_4S + 5e9, fehl4S: true, ticks: 80 });
  pruefe("misslungener 4S-Kauf: genau ein Versuch in 80 Runden (Sperre 1 h)", r4.opt.versuche4S === 1 && r4.opt.hat4S === false, r4.opt.versuche4S + " Versuche");
  pruefe("... und danach wird normal weitergehandelt", r4.opt.kaeufe > 0 && r4.tel.state === "work");
}

console.log("\n-- Ebene 2: Bargeld auf Abruf --");
{
  let barVor = null, barNach = null, telNach = null;
  const r = await laufe({ seed: 21, geld: 2e9, ticks: 420, vorTick: (t, m) => {
    if (t === 400) { barVor = m.ns.getServerMoneyAvailable("home"); m.lege("home", P.ABRUF_FILE, P.abrufAnlegen(1e9, "Kauf Test", Date.now())); }
    if (t === 403) { barNach = m.ns.getServerMoneyAvailable("home"); telNach = JSON.parse(m.lies("home", "data/boerse.json")); }
  } });
  pruefe("laeuft durch", r.abbruch === null, String(r.abbruch && r.abbruch.stack));
  pruefe("vor dem Abruf ist fast alles investiert (bar < 5 %)", barVor !== null && barVor < 0.05 * r.vermoegen, String(barVor));
  pruefe("nach dem Abruf liegt der Betrag bar", barNach !== null && barNach >= 1e9, String(barNach));
  pruefe("und bleibt liegen (Reserve in der Telemetrie)", telNach && telNach.reserve === 1e9, JSON.stringify(telNach && telNach.reserve));
  pruefe("der Rest bleibt investiert", telNach && telNach.depotWert > 0);

  // Der Besteller gibt das Geld aus: es darf NICHT nachverkauft werden.
  let ausgegeben = false, barSpaeter = null;
  await laufe({ seed: 21, geld: 2e9, ticks: 440, vorTick: (t, m) => {
    if (t === 400) m.lege("home", P.ABRUF_FILE, P.abrufAnlegen(1e9, "Kauf Test", Date.now()));
    if (t === 403) { const z = m.zustand; z.spieler.money -= 1e9; z.server.home.geld = z.spieler.money; ausgegeben = true; }
    if (t === 412) barSpaeter = m.ns.getServerMoneyAvailable("home");
  } });
  pruefe("nach dem Ausgeben wird fuer denselben Abruf nicht nachverkauft", ausgegeben && barSpaeter !== null && barSpaeter < 0.5e9, "bar " + barSpaeter);

  let barGross = null;
  const r2 = await laufe({ seed: 21, geld: 2e9, ticks: 420, vorTick: (t, m) => {
    if (t === 400) m.lege("home", P.ABRUF_FILE, P.abrufAnlegen(500e9, "zu gross", Date.now()));
    if (t === 403) barGross = JSON.parse(m.lies("home", "data/boerse.json"));
  } });
  pruefe("ein Abruf ueber dem Vermoegen wird NICHT bedient (kein Stilllegen)", barGross && barGross.reserve === 0 && barGross.posten > 0, JSON.stringify(barGross && { r: barGross.reserve, p: barGross.posten }));
}

console.log("\n-- Ebene 2: Betriebsgeld mit 4S --");
{
  const r = await laufe({ seed: 5, geld: 10e9, hat4S: true, ticks: 300 });
  pruefe("mit 4S bleiben mindestens rund 2 % bar", r.tel.bar >= 0.015 * r.tel.gesamt, (100 * r.tel.bar / r.tel.gesamt).toFixed(1) + " %");
  pruefe("... die Reserve steht in der Telemetrie", r.tel.reserve >= 0.015 * r.tel.gesamt);
  const r0 = await laufe({ seed: 5, geld: 2e9, ticks: 600 });
  pruefe("ohne 4S keine Betriebsreserve", r0.tel.reserve === 0);
}

console.log("\n-- Ebene 2: Ausverkauf vor dem Einbau --");
{
  let tel = null, id = null;
  const r = await laufe({ seed: 33, geld: 2e9, ticks: 420, vorTick: (t, m) => {
    if (t === 400) { const roh = P.pauseAnlegen(Date.now()); id = JSON.parse(roh).id; m.lege("home", P.PAUSE_FILE, roh); }
    if (t === 410) tel = JSON.parse(m.lies("home", "data/boerse.json"));
  } });
  pruefe("laeuft durch", r.abbruch === null, String(r.abbruch && r.abbruch.stack));
  pruefe("quittiert mit der id der Pause", tel && tel.verkauftFuer === id, JSON.stringify(tel && tel.verkauftFuer));
  pruefe("das Depot ist leer", r.market.stocks.every((s) => s.playerShares === 0));
  pruefe("und es wird nicht zurueckgekauft", tel && tel.state === "wait" && tel.posten === 0);
  pruefe("freigabe() liest die Quittung", tel && P.freigabe(JSON.stringify(tel), id, tel.ts + 1000, tel.ts - 60000) === "quittiert");

  // Ein Verkauf misslingt: KEINE Quittung, solange etwas im Depot liegt.
  let tel2 = null, tel3 = null, klemmt = true;
  await laufe({ seed: 33, geld: 2e9, ticks: 430, vorTick: (t, m) => {
    if (t === 400) {
      const echt = m.ns.stock.sellStock;
      m.ns.stock.sellStock = (sym, n) => { if (klemmt) throw new Error("Verkauf klemmt"); return echt(sym, n); };
      m.lege("home", P.PAUSE_FILE, P.pauseAnlegen(Date.now()));
    }
    if (t === 410) { tel2 = JSON.parse(m.lies("home", "data/boerse.json")); klemmt = false; }
    if (t === 420) tel3 = JSON.parse(m.lies("home", "data/boerse.json"));
  } });
  pruefe("misslingt der Verkauf, wird NICHT quittiert", tel2 && tel2.verkauftFuer === undefined && tel2.depotWert > 0 && tel2.state === "wait", JSON.stringify(tel2 && { v: tel2.verkauftFuer, d: tel2.depotWert }));
  pruefe("... und sobald er gelingt, kommt die Quittung", tel3 && typeof tel3.verkauftFuer === "string" && tel3.depotWert === 0);
}

console.log("\n-- Verdrahtung in bn4rep.js --");
{
  const rep = fs.readFileSync(path.join(SRC, "bn4rep.js"), "utf8");
  pruefe("rechnet mit dem Vermoegen, wenn die Boerse traegt", rep.includes("const geld = boerse.traegt ? bargeld + boerse.depot : bargeld;"));
  pruefe("liest die Telemetrie ueber die eigene liesVonHome(datei)", rep.includes("boerse = boerseSicht(liesVonHome(BOERSE_TEL_FILE), Date.now(), augResetMs)"));
  pruefe("kein Einbau vor der 4S-API", /if \(boerse\.aktiv && !boerse\.traegt\) \{\s*gesperrt = true;/.test(rep));
  const iSperre = rep.indexOf("if (boerse.aktiv && !boerse.traegt)");
  const iTrigger = rep.indexOf("(wartend + einbauKaufbar >= MINDEST_WARTESCHLANGE");
  pruefe("... und die Sperre steht vor dem Einbau-Ausloeser", iSperre > 0 && iSperre < iTrigger);
  pruefe("Geld-Ausloeser aus, wenn die Boerse traegt", rep.includes("const geldWegZu = !boerse.traegt && unbezahlbarInHorizont(")
    && rep.includes("const naechstesUnbezahlbar = !boerse.traegt && !!naechstes"));
  pruefe("die Kaufschleife ruft Bargeld ab", rep.includes('abruf(k.preis, "Kauf " + k.aug)'));
  pruefe("der Abruf wird vor bn4net geschuetzt (geldbedarf.txt)", rep.includes("bedarfSchreiben = Math.max(bedarfSchreiben, abrufSchutz.betrag)"));
  pruefe("Daedalus: 100 Mrd bar werden abgerufen", rep.includes("abruf(BOERSE_DAEDALUS_BAR * 1.01"));
  pruefe("Spende in BN8 nur ganz und mit Abstand", rep.includes("verfuegbar = traegt && !daedalusHalt && barSp >= noetig ? noetig : 0;"));
  pruefe("kein Einbau, wenn die Boerse schweigt und ein Depot bekannt ist", /if \(boerse\.unklar\) \{\s*gesperrt = true;/.test(rep));
  pruefe("kein Einbau ohne Quittung bei bekanntem Depot", rep.includes('if (ausgang !== "quittiert") {') && !rep.includes("baue trotzdem ein"));
  pruefe("die Einbaurunde zaehlt fuer die Mindestschlange mit", rep.includes("(wartend + einbauKaufbar >= MINDEST_WARTESCHLANGE || spendenAusnahme || redPillWartet)"));
  pruefe("die Ruf-Luecke misst sich an der Wiederaufbauzeit", rep.includes("kleinsteLuecke > lueckeEinbau"));
  pruefe("Daedalus-Bargeld ist vor Kauf und Spende geschuetzt", rep.includes("gangHold || daedalusHalt) ? []"));
  pruefe("kein Spenden-Abruf unter der Mindestspende", rep.includes("noetig > 1e9 && barSp < noetig"));
  const iBatch = rep.indexOf('"GEKAUFT (Einbaurunde): "');
  pruefe("die Einbaurunde kauft nach dem Ausverkauf alles Verdiente", iBatch > rep.indexOf("boersePauseAnlegen(") && iBatch < rep.indexOf("NEUROFLUX ZULETZT"));
  const boe = fs.readFileSync(path.join(SRC, "boerse.js"), "utf8");
  pruefe("boerse.js: jede liesVonHome mit ns", !/liesVonHome\((?!ns,)/.test(boe));
  pruefe("boerse.js kennt die alte 15-%-Reserve nicht mehr", !/BARBESTAND/.test(boe));
  const reg = JSON.parse(fs.readFileSync(path.join(SRC, "registry.json"), "utf8"));
  const eintraege = Array.isArray(reg) ? reg : (reg.tools || reg.scripts || Object.values(reg).find(Array.isArray) || []);
  const e = eintraege.find((x) => x && x.name === "boerse.js");
  pruefe("boerse.js bekommt lib/handel.js kopiert", !!e && (e.needsLibs || []).includes("lib/handel.js"));
}

console.log("\n=== " + gruen + " gruen, " + rot + " rot ===");
process.exit(rot ? 1 : 0);
