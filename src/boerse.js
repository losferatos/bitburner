/**
 * Der Aktienhandel - das einzige Einkommen in BitNode 8 (Position C.15).
 *
 * ===========================================================================
 * WARUM DIESES GEWERK UEBERHAUPT GEBRAUCHT WIRD
 * ===========================================================================
 *
 * In BitNode 8 ist JEDE andere Geldquelle auf null gesetzt
 * (`BitNode.tsx:770-800`, nachgeschlagen, nicht geraten):
 *
 *   CompanyWorkMoney      0     CrimeMoney            0
 *   HacknetNodeMoney      0     ManualHackMoney       0
 *   ScriptHackMoneyGain   0     CodingContractMoney   0
 *   InfiltrationMoney     0     DarknetMoneyMultiplier 0
 *
 * `ScriptHackMoney` steht auf 0,3 - der Server verliert also Geld, der Spieler
 * bekommt aber nichts davon (`ScriptHackMoneyGain: 0`). Hacken bewegt dort nur
 * noch die Kurse; verdienen laesst sich ausschliesslich an der Boerse.
 *
 * Ohne dieses Gewerk stehen die drei BN8-Laeufe der Route still. Der Bot
 * startet mit 250 Mio (`Prestige.ts:38`) und kaeme nie darueber hinaus.
 *
 * ===========================================================================
 * ZWEI PHASEN, WEIL 4S TEUER IST
 * ===========================================================================
 *
 * Die 4Sigma-Marktdaten machen den Handel trivial: `getForecast` liefert die
 * Wahrscheinlichkeit, dass der naechste Tick nach oben geht. Sie kosten aber
 * 1 Mrd fuer die Anzeige und 25 Mrd fuer die API (`Constants.ts`,
 * `MarketData4SCost` / `MarketDataTixApi4SCost`) - und der Lauf beginnt mit
 * 250 Mio.
 *
 *   PHASE 1 (ohne 4S): Die Vorhersage wird aus der eigenen Preishistorie
 *     geschaetzt. Der Kurs bewegt sich je Tick um einen festen Prozentsatz
 *     nach oben ODER unten (`StockMarket.ts:260-290`), mit einer
 *     Wahrscheinlichkeit, die genau der gesuchten Vorhersage entspricht. Der
 *     Anteil der Aufwaertsticks an den letzten N ist damit ein
 *     erwartungstreuer Schaetzer - er braucht nur Zeit.
 *
 *   PHASE 2 (mit 4S-TIX-API): `getForecast` direkt.
 *
 * Der Uebergang: sobald das VERMOEGEN (Bargeld + Depot) SCHWELLE_4S erreicht
 * (lib/handel.js), wird gezielt verkauft und die API gekauft.
 * ===========================================================================
 * BARGELD GIBT ES AUF ABRUF
 * ===========================================================================
 * Das Kapital ist ganz investiert. Wer Geld braucht (bn4rep fuer Kauf, Spende,
 * Daedalus-Schwelle), legt data/boerse-abruf.txt; vor dem Einbau legt bn4rep
 * data/boerse-pause.txt und bekommt alles (lib/boersepause.js).
 *
 * ===========================================================================
 * WAS ES NICHT TUT
 * ===========================================================================
 *
 * Es kauft KEINE 4S-Anzeige (1 Mrd) - die ist nur fuer Menschen. Nur die API.
 *
 * Es haelt KEINE Position ueber einen Knotenwechsel. `Prestige.ts:171` ruft
 * `initStockMarket()`, und damit ist jede Position weg - der Gegenwert
 * ebenfalls. Vor dem Sprung wird alles verkauft; den Anstoss gibt
 * `data/boerse-schliessen.txt`, das `ausgang.js` legt.
 *
 * @param {NS} ns
 */

import { liesVonHome, nachHome as schreibNachHome } from "lib/hostdatei.js";
import { laden as evLaden, anhaengen as evAnhaengen } from "lib/events.js";
import { PAUSE_FILE, ABRUF_FILE, pauseLesen, abrufLesen } from "lib/boersepause.js";
import { REGEL, KOSTEN_4S, BETRIEBSANTEIL, filterNeu, filterSchritt, filterMittel, verpassteSchritte, schaetze, verkaufsliste, kaufliste, freimachen, depotwert, kauf4SFaellig } from "lib/handel.js";


const TAKT_MS = 6000;      // ein Kursschritt dauert 6 s (msPerStockUpdate)
const ABFRAGE_MS = 1000;   // so oft wird nach einem neuen Kursschritt gesehen

/** Die Kommission je Transaktion (StockMarketConstants.StockMarketCommission). */
const KOMMISSION = 100e3;

// Die Handelsregel (Fenster, Schwellen, Positionsgroesse) steht seit dem
// 10.11.2026 in lib/handel.js und ist dort gegen das Marktmodell gerechnet
// (tools/audit/boerse-regel.mjs): bis 1 Bio Vermoegen im Median 14 h statt 23 h.

export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 120) log.shift();
    ns.print(t);
    try {
      ns.write("data/boerse-log.txt", log.join("\n") + "\n", "w");
      if (ns.getHostname() !== "home") ns.scp("data/boerse-log.txt", "home", ns.getHostname());
    } catch { /* egal */ }
  };
  const nachHome = (datei, inhalt) => {
    try {
      ns.write(datei, inhalt, "w");
      if (ns.getHostname() !== "home") ns.scp(datei, "home", ns.getHostname());
    } catch { /* egal */ }
  };

  let symbole = [];
  try { symbole = ns.stock.getSymbols(); }
  catch (e) {
    // Kein WSE-Zugang. In BitNode 8 kann das nicht sein (Prestige.ts:165 setzt
    // ihn), ausserhalb schon - dann ist dieses Gewerk hier nicht zustaendig.
    sag("Kein Boersenzugang (" + String(e && e.message ? e.message : e).slice(0, 80)
      + ") - dieses Gewerk beendet sich.");
    nachHome("data/boerse.json", JSON.stringify({
      schema: 2, ts: Date.now(), wall: Date.now(), playtime: 0, motorTimeMs: 0,
      round: 0, okRound: 0, errStreak: 0, lastError: null,
      host: ns.getHostname(), version: "boerse-1",
      state: "done", blockedReason: "kein Boersenzugang",
    }));
    return;
  }

  /** Preishistorie je Symbol: die letzten REGEL.fenster + 1 Preise. */
  const historie = new Map(symbole.map((s) => [s, []]));

  let runden = 0;
  let okRunden = 0;
  let errStreak = 0;
  let lastError = null;
  let letzteMeldung = "";
  let quittiertFuer = null;
  let sperre4SBis = 0;
  /** Stueckgrenze je Symbol (Stock.ts: 20 % der Aktien) - aendert sich im Lauf nicht. */
  const maxStueck = new Map(symbole.map((sym) => {
    try { return [sym, ns.stock.getMaxShares(sym)]; } catch { return [sym, Infinity]; }
  }));

  sag("boerse gestartet. " + symbole.length + " Symbole.");

  /** Kursfilter je Symbol (lib/handel.js) und die Zahl der beobachteten Kursschritte. */
  const filter = new Map(symbole.map((s) => [s, filterNeu()]));
  let schritte = 0;
  let letzterTickMs = 0;
  let letztePreise = [];
  let letzteRundeMs = 0;
  let bedientFuer = null;
  let fehl4S = 0;

  for (;;) {
    try {
      const jetzt = Date.now();

      // --- Tickgenau statt im festen Takt (Skeptiker 10.11.2026) --------------
      //
      // Der Markt tickt alle 6 s, holt nach einer Pause aber schneller nach.
      // Eine Schleife, die stur 6 s schlaeft, sieht dann mal zwei Ticks als
      // einen (die Schaetzung von f und mv stimmt nicht mehr) und mal keinen.
      // Deshalb jede Sekunde nachsehen und nur bei neuen Preisen eine Runde
      // fahren. Kostet kein RAM. Nach 12 s ohne Tick laeuft die Runde trotzdem
      // (Pause, Abruf und Telemetrie duerfen nicht am Markt haengen).
      const preiseJetzt = symbole.map((sym) => ns.stock.getPrice(sym));
      const neuerTick = preiseJetzt.some((p, i) => p !== letztePreise[i]);
      if (!neuerTick && jetzt - letzteRundeMs < 2 * TAKT_MS) {
        await ns.sleep(ABFRAGE_MS);
        continue;
      }
      letztePreise = preiseJetzt;
      letzteRundeMs = jetzt;
      runden++;

      // --- Schliessen, wenn der Sprung ansteht --------------------------------
      //
      // `Prestige.ts:171` ruft beim Knotenwechsel `initStockMarket()` - jede
      // Position ist danach weg, und mit ihr ihr Gegenwert. Wer hier nicht
      // verkauft, verschenkt alles, was investiert ist.
      if (ns.fileExists("data/boerse-schliessen.txt", "home")) {
        const erloes = alleVerkaufen(ns, symbole, sag);
        nachHome("data/boerse.json", herzschlag({
          state: "done", blockedReason: "Sprung steht an - Depot geschlossen",
          erloesBeimSchliessen: erloes,
        }));
        sag("Depot geschlossen, " + (erloes / 1e9).toFixed(2) + " Mrd erloest."
          + " Dieses Gewerk beendet sich.");
        return;
      }

      // --- Die Historie fortschreiben ------------------------------------------
      if (neuerTick || historie.get(symbole[0]).length === 0) {
        // Verpasste Kursschritte (gedrosselter Tab): der Filter altert fuer sie mit.
        const verpasst = letzterTickMs > 0 ? verpassteSchritte(jetzt - letzterTickMs, TAKT_MS) : 0;
        letzterTickMs = jetzt;
        symbole.forEach((sym, i) => {
          const h = historie.get(sym);
          const davor = h.length ? h[h.length - 1] : null;
          h.push(preiseJetzt[i]);
          while (h.length > REGEL.fenster + 1) h.shift();
          for (let k = 0; k < verpasst; k++) filterSchritt(filter.get(sym), 0);
          if (davor !== null) filterSchritt(filter.get(sym), Math.sign(preiseJetzt[i] - davor));
        });
        schritte++;
      }

      let hat4S = false;
      try { hat4S = ns.stock.has4SDataTixApi(); } catch { hat4S = false; }

      // --- Die Lage je Symbol --------------------------------------------------
      //
      // Mit 4S: Vorhersage und Schwankung aus dem Spiel. Ohne: beides aus der
      // eigenen Historie geschaetzt (lib/handel.js `schaetze`). Der Geldkurs
      // wird gerechnet statt gefragt: Brief = p*(1+s), Geld = p*(1-s)
      // (Stock.ts getAskPrice/getBidPrice), also Geld = 2p - Brief.
      const leseLage = () => {
        const aus = [];
        for (const sym of symbole) {
          const h = historie.get(sym);
          const preis = h[h.length - 1];
          let f = null, mv = 0, quelle = "Historie", ticks = 0;
          if (hat4S) {
            try {
              f = ns.stock.getForecast(sym);
              mv = ns.stock.getVolatility(sym) * 100;
              quelle = "4S"; ticks = 999;
            } catch { f = null; }
          }
          if (f === null) {
            // f aus dem Filter, die Schwankung mv weiter aus dem Fenster.
            f = filterMittel(filter.get(sym));
            mv = schaetze(h, REGEL.fenster).mv;
            ticks = schritte - 1;
            quelle = "Historie";
          }
          const ask = ns.stock.getAskPrice(sym);
          aus.push({ sym, preis, f, vorhersage: f, mv, quelle, ticks,
            lang: ns.stock.getPosition(sym)[0], ask, bid: 2 * preis - ask,
            maxStueck: maxStueck.get(sym) });
        }
        return aus;
      };
      const verkaufe = (sym, stueck, warum) => {
        const p = ns.stock.sellStock(sym, stueck);
        if (p > 0) {
          sag("verkauft " + sym + ": " + stueck + " Stueck zu "
            + (p * stueck / 1e6).toFixed(1) + "m (" + warum + ")");
        }
        return p > 0;
      };
      let lage = leseLage();

      // --- Ausverkauf vor dem Einbau (BN8-1, lib/boersepause.js) -------------
      //
      // Der Einbau loescht das Depot ohne Auszahlung (Prestige.ts:169-172).
      // bn4rep legt die Pause VOR seinen letzten Kaeufen; hier wird verkauft
      // und bis `bis` nichts gekauft. Die Historie oben laeuft weiter, damit
      // nach einer abgeblasenen Einbaurunde nicht von vorn geschaetzt wird.
      {
        const pause = pauseLesen(liesVonHome(ns, PAUSE_FILE), jetzt);
        if (pause.aktiv) {
          if (quittiertFuer !== pause.id) {
            const erloes = alleVerkaufen(ns, symbole, sag);
            // QUITTIERT WIRD NUR EIN LEERES DEPOT (Skeptiker 10.11.2026).
            // `alleVerkaufen` schluckt Fehler je Symbol; eine Quittung trotz
            // Restposten hiesse: bn4rep baut ein und der Rest ist weg. Bleibt
            // etwas liegen, versucht es die naechste Runde erneut.
            lage = leseLage();
            const rest = lage.filter((e) => e.lang > 0);
            if (rest.length === 0) {
              quittiertFuer = pause.id;
              sag("Einbau steht an - Depot verkauft, " + (erloes / 1e9).toFixed(2)
                + " Mrd erloest. Bis zum Ende der Pause wird nichts gekauft.");
              ereignis(ns, nachHome, "boerse: Ausverkauf vor Einbau " + (erloes / 1e9).toFixed(2) + " Mrd");
            } else {
              sag("AUSVERKAUF UNVOLLSTAENDIG: " + rest.length + " Posten liegen noch ("
                + rest.map((e) => e.sym).join(", ") + ") - keine Quittung, neuer Versuch.");
            }
          }
          const geldP = ns.getServerMoneyAvailable("home");
          const restWert = depotwert(lage);
          const quittiert = quittiertFuer === pause.id;
          nachHome("data/boerse.json", herzschlag({
            state: "wait",
            blockedReason: quittiert ? "Einbau steht an - Depot verkauft" : "Einbau steht an - Ausverkauf laeuft",
            hat4S, fehl4S, posten: lage.filter((e) => e.lang > 0).length,
            depotWert: restWert, bar: geldP, gesamt: geldP + restWert,
            ...(quittiert ? { verkauftFuer: pause.id } : {}),
          }));
          okRunden++;
          errStreak = 0;
          await ns.sleep(ABFRAGE_MS);
          continue;
        }
      }

      // --- Die 4S-API kaufen, sobald das VERMOEGEN reicht (BN8-3) ------------
      //
      // Frueher: `geld >= 26e9` - aber das Bargeld lag real bei 0,03 % des
      // Vermoegens, der Kauf kam im Mittel 7 h zu spaet. Jetzt wird ab
      // SCHWELLE_4S gezielt verkauft (schwaechste Posten zuerst) und gekauft.
      // Die API bleibt ueber alle Einbauten des Laufs.
      if (!hat4S && jetzt >= sperre4SBis
          && kauf4SFaellig(ns.getServerMoneyAvailable("home") + depotwert(lage), hat4S)) {
        for (const v of freimachen(lage, ns.getServerMoneyAvailable("home"), KOSTEN_4S + 1e6)) {
          verkaufe(v.sym, v.stueck, "fuer die 4S-API");
        }
        let ok = false;
        try { ok = ns.stock.purchase4SMarketDataTixApi(); } catch { ok = false; }
        if (ok) {
          hat4S = true;
          sag("4S-TIX-API gekauft (25 Mrd). Ab jetzt wird die Vorhersage"
            + " gelesen statt geschaetzt.");
          ereignis(ns, nachHome, "4S-TIX-API gekauft");
        } else {
          // Nicht jede Runde neu verkaufen: das kostet jedes Mal die Spanne.
          // 1 h, 2 h, 4 h, dann 8 h. Ab drei Fehlschlaegen wartet bn4rep nicht
          // mehr auf die API (lib/boersepause.js FEHL_4S_GRENZE).
          fehl4S++;
          const warteH = Math.min(8, 2 ** (fehl4S - 1));
          sperre4SBis = jetzt + warteH * 3600000;
          sag("4S-KAUF MISSLUNGEN (" + fehl4S + ". Mal) trotz Vermoegen ueber der"
            + " Schwelle - naechster Versuch in " + warteH + " h. Bargeld jetzt "
            + (ns.getServerMoneyAvailable("home") / 1e9).toFixed(2) + " Mrd.");
        }
        lage = leseLage();
      }

      // --- Bargeld auf Abruf (BN8-2, lib/boersepause.js) -----------------------
      //
      // Wer kaufen, spenden oder die Daedalus-Schwelle (100 Mrd BAR) zeigen
      // will, legt data/boerse-abruf.txt. Bereitgestellt wird nur, wenn das
      // Vermoegen den Betrag ganz deckt - ein halber Abruf legte Kapital still,
      // ohne dass jemand damit kaufen koennte.
      let reserve = 0;
      {
        const wunsch = abrufLesen(liesVonHome(ns, ABRUF_FILE), jetzt);
        if (wunsch.betrag > 0) {
          const bar = ns.getServerMoneyAvailable("home");
          if (bedientFuer === wunsch.id) {
            // EINMAL BEREITSTELLEN, NICHT NACHFUELLEN (Skeptiker 10.11.2026).
            // Hat der Besteller gekauft, ist das Bargeld weg - ein zweiter
            // Verkauf fuer denselben Abruf legte Kapital still, das niemand
            // mehr will. Was noch da ist, bleibt bis zum Ablauf liegen.
            reserve = Math.min(wunsch.betrag, bar);
          } else if (bar + depotwert(lage) >= wunsch.betrag) {
            reserve = wunsch.betrag;
            const vk = freimachen(lage, bar, wunsch.betrag);
            for (const v of vk) verkaufe(v.sym, v.stueck, "Abruf: " + wunsch.grund);
            bedientFuer = wunsch.id;
            if (vk.length) lage = leseLage();
          }
        }
      }

      // --- Betriebsgeld: 2 % bleiben bar, sobald 4S da ist ---------------------
      //
      // Rechner, home-RAM und Programme zahlen bn4net und homegrow aus dem
      // Bargeld - und das lag bei null. Ohne RAM kein Hacking-Level, ohne Level
      // kein Ausgang. Die 2 % werden nur vom KAUFEN ausgenommen, nie durch
      // Verkauf aufgefuellt: was die anderen ausgeben, kommt erst mit der
      // naechsten Umschichtung wieder. Gerechnet: 1 Bio nach 13,8 statt 13,7 h.
      if (hat4S) {
        const barB = ns.getServerMoneyAvailable("home");
        reserve = Math.max(reserve, BETRIEBSANTEIL * (barB + depotwert(lage)));
      }

      // --- Verkaufen, was gedreht hat ------------------------------------------
      //
      // ZUERST verkaufen, dann kaufen: sonst steht das Geld fuer den Kauf noch
      // in einer Aktie, die gerade faellt.
      {
        const raus = verkaufsliste(lage);
        for (const sym of raus) {
          const e = lage.find((x) => x.sym === sym);
          verkaufe(sym, e.lang, "Vorhersage " + e.f.toFixed(3) + ", " + e.quelle);
        }
        if (raus.length) lage = leseLage();
      }

      // --- Kaufen: das freie Kapital in den Titel mit dem hoechsten Ertrag ----
      for (const k of kaufliste(lage, ns.getServerMoneyAvailable("home"), reserve)) {
        const e = lage.find((x) => x.sym === k.sym);
        const preis = ns.stock.buyStock(k.sym, k.stueck);
        if (preis > 0) {
          sag("gekauft " + k.sym + ": " + k.stueck + " Stueck zu "
            + (preis * k.stueck / 1e6).toFixed(1) + "m (Vorhersage "
            + e.f.toFixed(3) + ", " + e.quelle + ")");
        }
      }

      // --- Bericht -------------------------------------------------------------
      lage = leseLage();
      const geld = ns.getServerMoneyAvailable("home");
      const depot = depotwert(lage);
      const posten = lage.filter((e) => e.lang > 0).length;
      const meldung = posten + " Posten, Depot " + (depot / 1e9).toFixed(2)
        + " Mrd, bar " + (geld / 1e9).toFixed(2) + " Mrd"
        + (hat4S ? ", 4S" : ", Schaetzung");
      if (meldung !== letzteMeldung && runden % 10 === 0) {
        sag(meldung);
        letzteMeldung = meldung;
      }

      nachHome("data/boerse.json", herzschlag({
        state: "work", blockedReason: null,
        hat4S, fehl4S,
        posten,
        // Zum Geldkurs, Kommission je Posten abgezogen: was ein Verkauf JETZT
        // braechte. bn4rep rechnet damit (lib/boersepause.js `boerseSicht`).
        depotWert: depot,
        bar: geld,
        reserve,
        // Die Leitgroesse dieses Knotens: Depot plus Bargeld. Sie muss
        // wachsen, sonst greift S2 im Waechter - und das zu Recht, denn in
        // BitNode 8 gibt es keine zweite Quelle.
        gesamt: depot + geld,
        beste: lage.slice().sort((a, b) => (2 * b.f - 1) * b.mv - (2 * a.f - 1) * a.mv)
          .slice(0, 3).map((e) => ({ sym: e.sym, f: Number(e.f.toFixed(3)) })),
      }));

      okRunden++;
      errStreak = 0;
    } catch (e) {
      errStreak++;
      const msg = String(e && e.message ? e.message : e);
      lastError = { cls: (e && e.name) || "Error",
        msg: msg.length > 200 ? msg.slice(0, 197) + "..." : msg, at: Date.now() };
      sag("RUNDENFEHLER (" + errStreak + " in Folge): " + msg);
    }
    await ns.sleep(ABFRAGE_MS);
  }

  function herzschlag(extra) {
    return JSON.stringify({
      schema: 2,
      ts: Date.now(), wall: Date.now(),
      playtime: (() => { try { return ns.getPlayer().totalPlaytime; } catch { return 0; } })(),
      motorTimeMs: 0,
      round: runden, okRound: okRunden,
      errStreak, lastError,
      host: ns.getHostname(), version: "boerse-1",
      ...extra,
    });
  }
}

/**
 * Alles verkaufen - vor dem Knotenwechsel.
 *
 * @returns {number} der Gesamterloes
 */
function alleVerkaufen(ns, symbole, sag) {
  let erloes = 0;
  for (const sym of symbole) {
    let pos;
    try { pos = ns.stock.getPosition(sym); } catch { continue; }
    const [lang] = pos;
    if (lang <= 0) continue;
    try {
      const p = ns.stock.sellStock(sym, lang);
      if (p > 0) {
        erloes += p * lang;
        sag("Schliessung: " + sym + ", " + lang + " Stueck fuer "
          + (p * lang / 1e6).toFixed(1) + "m.");
      }
    } catch (e) {
      sag("Schliessung von " + sym + " misslungen: "
        + String(e && e.message ? e.message : e).slice(0, 80));
    }
  }
  return erloes;
}

/**
 * Ein Ereignis in den Strom - er ueberlebt das Ueberschreiben der Telemetrie.
 *
 * ===========================================================================
 * ZWEI FEHLER AUF EINMAL (04.09.2026, Skeptiker)
 * ===========================================================================
 *
 * (1) DER STROM WURDE LOKAL GELESEN, ABER AUF home GEPRUEFT. Hier stand
 *     `ns.fileExists("data/events.json", "home")` und direkt darunter
 *     `ns.read("data/events.json")` - die Pruefung sah home-bewusst aus, das
 *     Lesen war es nicht. `boerse.js` hat `hostRule: "werkbank"` und laeuft
 *     per Konstruktion NIE auf home. Die Folge waere gewesen: beim Kauf der
 *     4S-TIX-API haette `nachHome` den gesamten Ereignisstrom auf home durch
 *     EINEN Eintrag ersetzt - `ns.scp` mischt nicht, es ersetzt.
 *
 *     `lib/events.js` nennt diese Datei die einzige Quelle fuer
 *     `jump_latency_min`, `boot_latency_min` und `ladder_rungs_ge3_per_week`.
 *     Alle drei sind ABSTAENDE zwischen Ereignissen und danach nicht mehr
 *     berechenbar. Und es waere niemandem aufgefallen.
 *
 * (2) DER STROM WURDE VON HAND GEBAUT und mit `while (length > 400) shift()`
 *     gestutzt. Damit fiel der Klassenschutz aus `lib/events.js` weg: ein
 *     Knotenwechsel-Eintrag - laut dessen Kommentar "auch nach tausend Runden
 *     noch die wichtigste Zeile der Datei" - konnte von 400 Boersennotizen
 *     hinausgeschoben werden. `beschneiden()` haelt bleibende Eintraege
 *     getrennt; diese Fassung kannte sie nicht.
 *
 * Beides ist jetzt geliehen statt nachgebaut: `lib/hostdatei.js` fuer den
 * Ort, `lib/events.js` fuer die Form.
 */
function ereignis(ns, _nachHome, text) {
  const strom = evLaden(liesVonHome(ns, "data/events.json"));
  evAnhaengen(strom, "note", text, { wall: Date.now() });
  schreibNachHome(ns, "data/events.json", JSON.stringify(strom));
}
