/**
 * Aktienhandel mit 4S-Marktdaten.
 *
 * Der Zugang wurde am 20.08. vor dem Reset gekauft (31,2 Mrd fuer alle vier
 * Posten) und ueberlebt jeden Install - anders als jeder Dollar Bargeld. Bis
 * jetzt lag er ungenutzt.
 *
 * WARUM DAS UEBERHAUPT LOHNT, obwohl Geld nicht unser Engpass ist
 *
 * Heute ist es keiner: Der Bot verdient mehr, als er ausgeben kann, und der
 * Serverausbau steht am Anschlag. Ab Favor 150 aendert sich das schlagartig -
 * dann kauft Spenden Reputation zum 36,7-fachen der Arbeitsrate
 * (Faction/formulas/donation.ts:8-10), und Geld wird zur eigentlichen
 * Waehrung. Der Handel ist die Vorbereitung darauf, nicht der Selbstzweck.
 *
 * DIE ENTSCHEIDUNGSREGEL
 *
 * `getForecast(sym)` gibt die Wahrscheinlichkeit, dass das Papier im naechsten
 * Zyklus STEIGT. Ueber 0,5 lohnt eine Kaufposition, darunter eine
 * Leerverkaufsposition. Ohne 4S-Daten waere das eine Wette; mit ihnen ist es
 * eine Rechnung. Der Abstand zu 0,5 ist zugleich das Mass fuer die
 * Zuversicht - deshalb wird erst ab einem Mindestabstand gehandelt und nicht
 * bei jedem Rauschen.
 *
 * WAS DABEI SCHIEFGEHEN KANN, und wie es abgefangen ist
 *
 *  - Jede Transaktion kostet 100.000 $ Kommission
 *    (StockMarket/data/Constants.ts:11), und zwar beim Kauf UND beim Verkauf.
 *    Eine Position, die weniger Gewinn verspricht als 200.000 $, ist ein
 *    Verlustgeschaeft. Deshalb ein Mindesteinsatz.
 *  - Offene Positionen sind beim Install ERSATZLOS weg. Vor jedem Reset muss
 *    alles verkauft sein - dafuer gibt es den Schalter --liquidate.
 *  - Der Bot braucht sein Geld fuer Server und Augmentierungen. Deshalb wird
 *    nie mehr als ANTEIL des Guthabens eingesetzt, und eine gesetzte
 *    Sperrkasse (data/reserve.txt) wird respektiert.
 *
 * Aufruf:
 *   node tools/task.js stocks.js               laeuft dauerhaft
 *   node tools/task.js stocks.js --liquidate   alles verkaufen und beenden
 *   node tools/task.js stocks.js --dry         nur rechnen und berichten
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const argumente = ns.args.map(String);
  const liquidate = argumente.includes("--liquidate");
  const dry = argumente.includes("--dry");

  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    while (zeilen.length > 60) zeilen.shift();
    ns.write("data/stocks.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/stocks.txt", "home", ns.getHostname());
  };

  if (!ns.stock.has4SDataTixApi()) return sag("4S-TIX-Zugang fehlt - ohne getForecast ist das eine Wette.");

  // Nie mehr als diesen Anteil des Guthabens im Markt. Der Rest gehoert dem
  // Verwalter, der davon Server und Augmentierungen kauft.
  const ANTEIL = 0.5;
  // Ab diesem Abstand von 0,5 gilt eine Vorhersage als belastbar.
  const SCHWELLE = 0.10;
  // Unter diesem Abstand wird eine bestehende Position aufgeloest - frueher
  // als beim Einstieg, damit nicht bei jedem Rauschen hin- und hergehandelt
  // wird (die Kommission faellt zweimal an).
  const AUSSTIEG = 0.03;
  const KOMMISSION = 100e3;
  // Ein Kauf muss den doppelten Kommissionsaufwand deutlich uebersteigen,
  // sonst frisst die Gebuehr den Gewinn.
  const MINDESTEINSATZ = KOMMISSION * 100;

  const symbole = ns.stock.getSymbols();
  sag("Handel beginnt: " + symbole.length + " Papiere, Einsatzanteil "
    + Math.round(ANTEIL * 100) + " %, Schwelle " + SCHWELLE);

  const alleVerkaufen = () => {
    let erloes = 0;
    for (const s of symbole) {
      const [lang, , kurz] = ns.stock.getPosition(s);
      if (lang > 0) erloes += ns.stock.sellStock(s, lang) * lang;
      if (kurz > 0) erloes += ns.stock.sellShort(s, kurz) * kurz;
    }
    return erloes;
  };

  if (liquidate) {
    // ZUERST die Dauerinstanzen abschalten. Ohne das verkauft dieser Lauf
    // alles, und die noch laufende Instanz kauft in derselben Minute wieder
    // ein - das Depot waere nach dem "Liquidieren" so voll wie vorher. Genau
    // darauf kommt es vor einem Reset an: Offene Positionen sind beim Install
    // ersatzlos weg.
    const gesehen = new Set(["home"]);
    const schlange = ["home"];
    while (schlange.length) {
      for (const nachbar of ns.scan(schlange.shift())) {
        if (gesehen.has(nachbar)) continue;
        gesehen.add(nachbar);
        schlange.push(nachbar);
      }
    }
    let beendet = 0;
    for (const host of gesehen) {
      for (const proc of ns.ps(host)) {
        if (proc.filename !== ns.getScriptName()) continue;
        if (host === ns.getHostname() && proc.pid === ns.pid) continue;
        ns.kill(proc.pid);
        beendet++;
      }
    }
    if (beendet) {
      sag(beendet + " laufende Instanz(en) beendet - sonst kaufen sie sofort nach.");
      await ns.sleep(500);
    }
    const e = alleVerkaufen();
    return sag("Alles verkauft, Erloes rund $" + Math.round(e / 1e6) + " Mio. Positionen sind jetzt leer.");
  }

  let runde = 0;
  for (;;) {
    runde++;
    // nextUpdate wartet auf den naechsten Kurswechsel des Spiels - genauer
    // und billiger als ein fester Schlaf.
    await ns.stock.nextUpdate();

    let reserve = 0;
    if (ns.fileExists("data/reserve.txt", "home")) {
      const roh = Number(ns.read("data/reserve.txt"));
      if (Number.isFinite(roh) && roh > 0) reserve = roh;
    }
    const bar = ns.getServerMoneyAvailable("home");
    const einsetzbar = Math.max(0, bar - reserve) * ANTEIL;

    let verkauft = 0, gekauft = 0, wert = 0;

    // Erst raeumen, dann kaufen - so ist das Geld aus aufgeloesten Positionen
    // in derselben Runde wieder verfuegbar.
    for (const s of symbole) {
      const [lang, langPreis, kurz, kurzPreis] = ns.stock.getPosition(s);
      if (lang === 0 && kurz === 0) continue;
      const f = ns.stock.getForecast(s);
      wert += lang * ns.stock.getBidPrice(s) + kurz * (2 * kurzPreis - ns.stock.getAskPrice(s));
      if (lang > 0 && f < 0.5 + AUSSTIEG) {
        if (!dry) ns.stock.sellStock(s, lang);
        verkauft++;
        sag("verkauft " + s + " (" + lang + " Stueck, Prognose " + f.toFixed(3) + ")");
      }
      if (kurz > 0 && f > 0.5 - AUSSTIEG) {
        if (!dry) ns.stock.sellShort(s, kurz);
        verkauft++;
        sag("Leerverkauf gedeckt " + s + " (" + kurz + " Stueck, Prognose " + f.toFixed(3) + ")");
      }
    }

    // Die aussichtsreichsten zuerst - das Geld ist begrenzt.
    // NUR Kaufpositionen. Leerverkaeufe verlangen BitNode 8 oder Source-File 8
    // Stufe 2 (NetscriptFunctions/StockMarket.ts:160 `checkSFAccess(ctx, 2)`),
    // und wir haben weder das eine noch das andere.
    //
    // Aufgefallen ist das erst im scharfen Lauf: Der Trockenlauf ueberspringt
    // die Kaufaufrufe - und damit genau die Stelle, die scheitert. Ein
    // Trockenlauf, der die eigentliche Handlung auslaesst, prueft sie eben
    // nicht. Fuer Aufrufe, die an einer Berechtigung haengen, taugt er nicht
    // als Nachweis.
    //
    // Das halbiert die Gelegenheiten: Papiere mit fallender Prognose sind
    // nicht mehr handelbar, sondern nur noch ein Grund, nichts zu tun.
    const kandidaten = symbole
      .map((s) => ({ s, f: ns.stock.getForecast(s), v: ns.stock.getVolatility(s) }))
      .filter((k) => k.f - 0.5 >= SCHWELLE)
      .sort((a, b) => (b.f - 0.5) * b.v - (a.f - 0.5) * a.v);

    let uebrig = einsetzbar;
    for (const k of kandidaten) {
      if (uebrig < MINDESTEINSATZ) break;
      const [lang, , kurz] = ns.stock.getPosition(k.s);
      if (lang > 0 || kurz > 0) continue;
      const preis = ns.stock.getAskPrice(k.s);
      const platz = ns.stock.getMaxShares(k.s);
      // Nicht alles auf ein Papier. Der erste Trockenlauf am 20.08. hat genau
      // das getan: 12,3 Mrd auf APHE, danach war das Budget leer und die
      // uebrigen Kandidaten - teils mit besserer Prognose - kamen nie zum Zug.
      //
      // Die Prognose ist eine Wahrscheinlichkeit, keine Zusage: Bei 0,38 faellt
      // das Papier in knapp vier von zehn Zyklen trotzdem in die andere
      // Richtung. Wer alles auf eine Karte setzt, hat den Erwartungswert auf
      // seiner Seite und die Streuung gegen sich. Ueber mehrere Papiere
      // gemittelt bleibt der Erwartungswert derselbe, die Schwankung sinkt.
      const MAX_JE_PAPIER = einsetzbar / 5;
      const budget = Math.min(uebrig, MAX_JE_PAPIER);
      const stueck = Math.min(Math.floor((budget - KOMMISSION) / preis), platz);
      if (stueck <= 0) continue;
      const kosten = stueck * preis + KOMMISSION;
      if (kosten > uebrig || kosten < MINDESTEINSATZ) continue;
      if (!dry) ns.stock.buyStock(k.s, stueck);
      uebrig -= kosten;
      gekauft++;
      sag("gekauft " + k.s + " " + stueck + " Stueck fuer $"
        + Math.round(kosten / 1e6) + " Mio (Prognose " + k.f.toFixed(3) + ")");
    }

    if (runde % 20 === 0 || verkauft || gekauft) {
      sag("Runde " + runde + ": " + gekauft + " Kaeufe, " + verkauft + " Aufloesungen, Depotwert rund $"
        + Math.round(wert / 1e9) + " Mrd, bar $" + Math.round(bar / 1e9) + " Mrd");
    }
  }
}
