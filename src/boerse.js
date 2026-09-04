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
 * Der Uebergang ist kein Sprung: sobald 26 Mrd zusammen sind (25 fuer die API
 * plus einen Puffer), wird gekauft. Danach ist die Historie nur noch
 * Kontrolle.
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

const TAKT_MS = 6000;      // ein Kursschritt dauert 6 s (msPerStockUpdate)

/** Die Kommission je Transaktion (StockMarketConstants.StockMarketCommission). */
const KOMMISSION = 100e3;

/**
 * Wie viele Ticks in die Historie gehen.
 *
 * 40 Ticks sind vier Minuten. Kuerzer wird die Schaetzung zu unruhig - bei 10
 * Ticks liegt die Standardabweichung des Anteils bei 0,16, und eine
 * Vorhersage von 0,60 waere von 0,44 nicht zu unterscheiden. Laenger, und die
 * Schaetzung haengt der Wirklichkeit nach: `otlkMag` aendert sich alle 75
 * Ticks (`TicksPerCycle`).
 */
const HISTORIE = 40;

/** Ab dieser Vorhersage wird gekauft, darunter verkauft. */
const KAUF_SCHWELLE = 0.575;
const VERKAUF_SCHWELLE = 0.5;

/**
 * Wie viel des Vermoegens hoechstens in EINER Aktie steckt.
 *
 * Der Markt hat 33 Symbole, und eine einzelne Vorhersage kann falsch sein -
 * besonders in Phase 1, wo sie geschaetzt ist. Ein Viertel ist der Kompromiss
 * zwischen Streuung und der Kommission, die jede Position kostet.
 */
const ANTEIL_JE_AKTIE = 0.25;

/**
 * Wie viel Geld liegen bleibt.
 *
 * NICHT NULL. In BitNode 8 ist die Boerse die einzige Quelle, aber der Bot
 * braucht Geld auch fuer Rechner, Portprogramme und Augmentierungen. Ein
 * vollstaendig investiertes Konto blockiert alles andere - und Aktien lassen
 * sich zwar verkaufen, aber jede Runde kostet Kommission.
 */
const BARBESTAND = 0.15;

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

  /** Preishistorie je Symbol: die letzten HISTORIE Preise. */
  const historie = new Map(symbole.map((s) => [s, []]));

  let runden = 0;
  let okRunden = 0;
  let errStreak = 0;
  let lastError = null;
  let gekaufte4S = false;
  let letzteMeldung = "";

  sag("boerse gestartet. " + symbole.length + " Symbole.");

  for (;;) {
    try {
      runden++;
      const jetzt = Date.now();

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

      // --- Die 4S-API kaufen, sobald sie bezahlbar ist ------------------------
      //
      // 25 Mrd sind viel, aber sie machen aus einer Schaetzung eine Auskunft.
      // Der Puffer von einer Milliarde ist nicht Zierde: unmittelbar nach dem
      // Kauf soll noch gehandelt werden koennen, sonst steht das Gewerk, bis
      // die Boerse von selbst steigt - und ohne Position tut sie das nicht.
      let hat4S = false;
      try { hat4S = ns.stock.has4SDataTixApi(); } catch { hat4S = false; }
      if (!hat4S && !gekaufte4S) {
        const geld = ns.getServerMoneyAvailable("home");
        if (geld >= 26e9) {
          let ok = false;
          try { ok = ns.stock.purchase4SMarketDataTixApi(); } catch { ok = false; }
          if (ok) {
            gekaufte4S = true;
            hat4S = true;
            sag("4S-TIX-API gekauft (25 Mrd). Ab jetzt wird die Vorhersage"
              + " gelesen statt geschaetzt.");
            ereignis(ns, nachHome, "4S-TIX-API gekauft");
          }
        }
      }

      // --- Die Vorhersage je Symbol ------------------------------------------
      const lage = [];
      for (const sym of symbole) {
        const preis = ns.stock.getPrice(sym);
        const h = historie.get(sym);
        h.push(preis);
        while (h.length > HISTORIE + 1) h.shift();

        let vorhersage = null;
        let quelle = null;
        if (hat4S) {
          try { vorhersage = ns.stock.getForecast(sym); quelle = "4S"; }
          catch { vorhersage = null; }
        }
        if (vorhersage === null) {
          vorhersage = schaetzung(h);
          quelle = "Historie";
        }
        lage.push({ sym, preis, vorhersage, quelle, ticks: h.length - 1 });
      }

      // --- Verkaufen, was gedreht hat ----------------------------------------
      //
      // ZUERST verkaufen, dann kaufen. Sonst steht das Geld fuer den Kauf noch
      // in einer Aktie, die gerade faellt - und die Runde kauft nichts,
      // obwohl sie es koennte.
      for (const e of lage) {
        const pos = ns.stock.getPosition(e.sym);
        const [lang] = pos;
        if (lang <= 0) continue;
        // Eine ZU JUNGE Schaetzung verkauft nicht. In den ersten Minuten nach
        // dem Start hat die Historie zu wenige Punkte, und ein zufaelliger
        // Ausschlag wuerde eine gute Position mit Kommission wieder aufloesen.
        if (e.quelle === "Historie" && e.ticks < 20) continue;
        if (e.vorhersage >= VERKAUF_SCHWELLE) continue;
        const erloes = ns.stock.sellStock(e.sym, lang);
        if (erloes > 0) {
          sag("verkauft " + e.sym + ": " + lang + " Stueck zu "
            + (erloes / 1e6).toFixed(1) + "m (Vorhersage "
            + e.vorhersage.toFixed(3) + ", " + e.quelle + ")");
        }
      }

      // --- Kaufen, was steigt -------------------------------------------------
      const geld = ns.getServerMoneyAvailable("home");
      const einsetzbar = geld * (1 - BARBESTAND);
      const kandidaten = lage
        .filter((e) => e.vorhersage >= KAUF_SCHWELLE)
        .filter((e) => e.quelle === "4S" || e.ticks >= 20)
        .sort((a, b) => b.vorhersage - a.vorhersage);

      for (const e of kandidaten) {
        const frei = ns.getServerMoneyAvailable("home") * (1 - BARBESTAND);
        if (frei <= 0) break;
        const budget = Math.min(frei, einsetzbar * ANTEIL_JE_AKTIE);
        // Die Kommission faellt zweimal an - beim Kauf und beim Verkauf. Ein
        // Handel unter dem Fuenfzigfachen davon lohnt nicht: er muesste ueber
        // vier Prozent gewinnen, nur um die Gebuehr zu decken.
        if (budget < KOMMISSION * 50) continue;
        const stueck = Math.min(
          Math.floor((budget - KOMMISSION) / e.preis),
          ns.stock.getMaxShares(e.sym) - ns.stock.getPosition(e.sym)[0],
        );
        if (stueck <= 0) continue;
        const preis = ns.stock.buyStock(e.sym, stueck);
        if (preis > 0) {
          sag("gekauft " + e.sym + ": " + stueck + " Stueck zu "
            + (preis * stueck / 1e6).toFixed(1) + "m (Vorhersage "
            + e.vorhersage.toFixed(3) + ", " + e.quelle + ")");
        }
      }

      // --- Bericht -------------------------------------------------------------
      let depot = 0;
      let posten = 0;
      for (const sym of symbole) {
        const [lang, kaufpreis] = ns.stock.getPosition(sym);
        if (lang <= 0) continue;
        posten++;
        depot += lang * ns.stock.getPrice(sym);
      }
      const meldung = posten + " Posten, Depot " + (depot / 1e9).toFixed(2)
        + " Mrd, bar " + (geld / 1e9).toFixed(2) + " Mrd"
        + (hat4S ? ", 4S" : ", Schaetzung");
      if (meldung !== letzteMeldung && runden % 10 === 0) {
        sag(meldung);
        letzteMeldung = meldung;
      }

      nachHome("data/boerse.json", herzschlag({
        state: "work", blockedReason: null,
        hat4S,
        posten,
        depotWert: depot,
        bar: geld,
        // Die Leitgroesse dieses Knotens: Depot plus Bargeld. Sie muss
        // wachsen, sonst greift S2 im Waechter - und das zu Recht, denn in
        // BitNode 8 gibt es keine zweite Quelle.
        gesamt: depot + geld,
        beste: lage.slice().sort((a, b) => b.vorhersage - a.vorhersage)
          .slice(0, 3).map((e) => ({ sym: e.sym, f: Number(e.vorhersage.toFixed(3)) })),
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
    await ns.sleep(TAKT_MS);
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
 * Die Vorhersage aus der Preishistorie schaetzen.
 *
 * WARUM DER ANTEIL DER AUFWAERTSTICKS DAS RICHTIGE MASS IST.
 *
 * Der Kurs bewegt sich je Tick um denselben Prozentsatz nach oben oder unten
 * (`StockMarket.ts:260-290`): `chc` entscheidet die RICHTUNG, `av` die
 * Groesse, und `chc` ist genau die Zahl, die `getForecast` liefert. Der Anteil
 * der Aufwaertsticks an den letzten N ist damit ein erwartungstreuer
 * Schaetzer - er braucht nur genug Punkte.
 *
 * Bei weniger als zehn Punkten wird 0,5 zurueckgegeben, also "keine Meinung":
 * die Standardabweichung des Anteils liegt dort bei 0,16, und eine Vorhersage
 * von 0,60 waere von 0,44 nicht zu unterscheiden. Wer darauf handelt, handelt
 * auf Rauschen und zahlt Kommission dafuer.
 *
 * @param {number[]} h  Preise, aeltester zuerst
 */
export function schaetzung(h) {
  if (!Array.isArray(h) || h.length < 11) return 0.5;
  let hoch = 0;
  let schritte = 0;
  for (let i = 1; i < h.length; i++) {
    // Gleiche Preise zaehlen nicht mit - sie kommen vor, wenn die Historie
    // schneller gelesen wird, als der Markt tickt (alle 6 s).
    if (h[i] === h[i - 1]) continue;
    schritte++;
    if (h[i] > h[i - 1]) hoch++;
  }
  if (schritte < 10) return 0.5;
  return hoch / schritte;
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

/** Ein Ereignis in den Strom - er ueberlebt das Ueberschreiben der Telemetrie. */
function ereignis(ns, nachHome, text) {
  let strom = { version: 1, eintraege: [] };
  try {
    if (ns.fileExists("data/events.json", "home")) {
      const g = JSON.parse(ns.read("data/events.json"));
      if (g && Array.isArray(g.eintraege)) strom = g;
    }
  } catch { /* dann ein frischer Strom */ }
  strom.eintraege.push({
    art: "note", text: text.slice(0, 160),
    wall: Date.now(), playtime: 0, motorTimeMs: 0, daten: null,
  });
  while (strom.eintraege.length > 400) strom.eintraege.shift();
  nachHome("data/events.json", JSON.stringify(strom));
}
