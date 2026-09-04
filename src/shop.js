/**
 * Der Rechnerhaendler - kauft Mietrechner im Auftrag des Kerns.
 *
 * ===========================================================================
 * WARUM DAS EIN EIGENES GEWERK IST
 * ===========================================================================
 *
 * Die `ns.cloud.*`-Familie kostet den Kern 4,00 GB:
 *
 *   purchaseServer        2,25
 *   getServerNames        1,05
 *   getServerCost         0,25
 *   upgradeServer         0,25
 *   getServerUpgradeCost  0,10
 *   getServerLimit        0,05
 *   getRamLimit           0,05
 *
 * (Die Aufzaehlung stand hier zunaechst unvollstaendig und summierte sich auf
 * 3,85 - `getServerUpgradeCost` und `getServerLimit` fehlten, und der Preis
 * des ersten war mit 0,25 statt 0,10 angegeben. Nachgerechnet gegen
 * RamCostGenerator.ts:222-229.)
 *
 * Das ist mehr als ein Zehntel des ganzen Kaltstart-Budgets von 32 GB, fuer
 * eine Handlung, die vielleicht einmal je Stunde vorkommt. Der Kern behaelt
 * die ENTSCHEIDUNG - er weiss als einziger, was gerade wartet und was das Geld
 * sonst noch soll - und gibt die AUSFUEHRUNG ab.
 *
 * ===========================================================================
 * ER LAEUFT AUF ABRUF, NICHT DAUERND
 * ===========================================================================
 *
 * Sieben Gigabyte dauerhaft auf `home` sind im Kaltstart ein Fuenftel des
 * ganzen Budgets - fuer ein Gewerk, das die meiste Zeit dieselbe Preistabelle
 * neu schreibt. Gerechnet (04.09.2026): Kern 10,80 + Waechter 6,10 +
 * Wachhalter 2,25 + Haendler 7,00 = 26,15 von 32 GB. Es blieben 5,85 GB fuer
 * Arbeiter, und mit `boot.js` daneben gar nichts.
 *
 * Deshalb beendet er sich, sobald seine Arbeit getan ist: Preise geschrieben,
 * kein Auftrag offen, mindestens zwei Runden gelaufen. Der Kern startet ihn
 * wieder, wenn `data/preise.json` veraltet oder ein Auftrag zu erledigen ist -
 * die Regel steht in `bn4net.js` beim Werkzeugstarter.
 *
 * Ueber die Zeit gemittelt kostet er damit rund ein Fuenftel: eine Minute je
 * fuenf. Und in genau der Minute, in der wirklich gekauft wird, bleibt er, bis
 * es erledigt ist.
 *
 * ===========================================================================
 * DIE PREISTABELLE IST DER KNIFF
 * ===========================================================================
 *
 * Damit der Kern weiter entscheiden kann, ohne `getServerCost` zu bezahlen,
 * schreibt dieses Gewerk alle Preise nach `data/preise.json`. Der Kern liest
 * sie fuer 0 GB.
 *
 * Gefragt wird das Spiel, nicht gerechnet: in BitNode 4 verteuert
 * `CloudServerSoftcap` 1,2 die grossen Rechner ueberproportional, und eine
 * nachgebaute Formel waere genau die Falle vom 30.08. - vier von vier eigenen
 * Rechnungen falsch, jede fuer sich plausibel.
 *
 * ===========================================================================
 * EIN AUFTRAG WIRD GENAU EINMAL AUSGEFUEHRT - AUCH UEBER NEUSTARTS HINWEG
 * ===========================================================================
 *
 * Der Kern schreibt `data/kaufauftrag.json` mit einer `id`; dieses Gewerk
 * merkt sich die ausgefuehrten ids und ruehrt einen bekannten Auftrag nicht
 * mehr an. Die Datei wird NICHT geloescht - `ns.rm` kostet 0,60 GB (es teilt
 * sich die Konstante mit scp), und das Gedaechtnis unten deckt denselben Fall
 * vollstaendig ab - auch den, in dem das Loeschen selbst fehlschlaegt.
 *
 * Die Falle dabei (Skeptiker 04.09.2026): das Gedaechtnis lebte nur im
 * Prozess. Nach jedem Neustart - Spiel-Reload, Augmentierungs-Einbau,
 * boot.js-Raeumung - war es leer, die Auftragsdatei lag aber noch da, und
 * derselbe Rechner wurde ein zweites Mal gekauft. Bei 25 Plaetzen ist das
 * unmittelbar Geld.
 *
 * Deshalb wird beim Start `data/kaufergebnis.json` gelesen: dort steht die id
 * des zuletzt ausgefuehrten Auftrags. Ein Auftrag, dessen Ergebnis schon
 * geschrieben ist, gilt als erledigt.
 *
 * @param {NS} ns
 */

const TAKT_MS = 30000;

export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 100) log.shift();
    ns.print(t);
    try { ns.write("data/shop-log.txt", log.join("\n") + "\n", "w"); } catch { /* egal */ }
  };

  const nachHome = (datei, inhalt) => {
    try {
      ns.write(datei, inhalt, "w");
      if (ns.getHostname() !== "home") ns.scp(datei, "home", ns.getHostname());
    } catch { /* egal */ }
  };
  const liesVonHome = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return null;
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return null; }
  };

  /** Auftraege, die schon ausgefuehrt wurden - gegen Doppelkaeufe. */
  const erledigt = new Set();
  // Wie oft das Spiel einen Auftrag schon abgelehnt hat (K1).
  const abgelehnt = new Map();

  // DAS GEDAECHTNIS UEBER DEN PROZESS HINAUS (04.09.2026).
  //
  // `erledigt` allein lebt nur, solange dieser Prozess lebt. Nach einem
  // Neustart liegt die Auftragsdatei noch da, das Set ist leer - und derselbe
  // Rechner wird ein zweites Mal gekauft. Das Ergebnis des letzten Auftrags
  // steht dagegen auf der Platte und ueberlebt alles.
  try {
    const vorher = liesVonHome("data/kaufergebnis.json");
    if (vorher) {
      const e = JSON.parse(vorher);
      // NUR bei Erfolg. Ein Auftrag, der am fehlenden Geld gescheitert ist,
      // steht mit `erfolg: false` in der Datei und soll ausdruecklich noch
      // einmal versucht werden - genau dafuer bleibt er offen.
      if (e && e.id && e.erfolg) {
        erledigt.add(e.id);
        sag("Auftrag " + e.id + " war vor dem Neustart schon ausgefuehrt ("
          + e.ergebnis + ") - wird nicht wiederholt.");
      }
    }
  } catch { /* kein Ergebnis lesbar - dann faengt das Gedaechtnis bei null an */ }

  let runden = 0;
  let okRunden = 0;
  let errStreak = 0;
  let lastError = null;

  sag("shop gestartet.");

  for (;;) {
    try {
      runden++;
      const jetzt = Date.now();

      // --- 1. Die Preistabelle nach draussen --------------------------------
      const eigene = ns.cloud.getServerNames();
      const limitAnzahl = ns.cloud.getServerLimit();
      const limitRam = ns.cloud.getRamLimit();

      const preise = {};
      for (let gb = 2; gb <= limitRam; gb *= 2) {
        try {
          const p = ns.cloud.getServerCost(gb);
          if (Number.isFinite(p) && p > 0) preise[gb] = p;
        } catch { /* diese Groesse geht nicht */ }
      }

      // Was die vorhandenen Rechner an RAM haben - der Kern braucht das fuer
      // die Frage "passt das wartende Werkzeug irgendwo hin".
      const park = eigene.map((h) => ({ host: h, ram: ns.getServerMaxRam(h) }));

      nachHome("data/preise.json", JSON.stringify({
        ts: jetzt,
        limitAnzahl,
        limitRam,
        // KEIN MIETRECHNER MOEGLICH ist ein eigener Zustand, keine Null.
        // BitNode 9 setzt CloudServerLimit auf 0; dort traegt home den Ausbau.
        kaufbar: limitAnzahl > 0,
        park,
        preise,
      }));

      // --- 2. Auftraege ausfuehren -------------------------------------------
      // Wird in den Geldzweigen gesetzt und unten im Herzschlag gemeldet.
      let wartetAufGeld = false;
      const roh = liesVonHome("data/kaufauftrag.json");
      let auftrag = null;
      try { auftrag = roh ? JSON.parse(roh) : null; } catch { auftrag = null; }

      if (auftrag && auftrag.id && !erledigt.has(auftrag.id)) {
        const gb = Number(auftrag.gb);
        const art = auftrag.art === "upgrade" ? "upgrade" : "kauf";

        if (!Number.isFinite(gb) || gb <= 0) {
          sag("Auftrag " + auftrag.id + " ohne brauchbare Groesse - verworfen.");
          erledigt.add(auftrag.id);
        } else if (art === "kauf") {
          if (eigene.length >= limitAnzahl) {
            sag("Auftrag " + auftrag.id + ": Park ist voll (" + eigene.length + "/"
              + limitAnzahl + ") - nicht gekauft.");
            erledigt.add(auftrag.id);
            meldeErgebnis(nachHome, auftrag, false, "park_voll", jetzt);
          } else {
            const preis = preise[gb] || 0;
            const geld = ns.getServerMoneyAvailable("home");
            if (preis > 0 && preis <= geld) {
              const name = ns.cloud.purchaseServer("werk-" + eigene.length, gb);
              if (name) {
                sag("Gekauft: " + name + " mit " + gb + " GB fuer "
                  + (preis / 1e6).toFixed(2) + "m. Grund: " + (auftrag.grund || "-"));
                erledigt.add(auftrag.id);
                meldeErgebnis(nachHome, auftrag, true, name, jetzt);
              } else {
                // EIN ABGELEHNTER KAUF DARF NICHT EWIG OFFEN BLEIBEN
                // (Skeptiker Runde 3, K1, 04.09.2026).
                //
                // `purchaseServer` gibt bei Ablehnung "" zurueck - kein
                // Fehler, keine Begruendung. Hier stand nur eine Meldung:
                // weder `erledigt` noch `wartetAufGeld` wurden gesetzt, der
                // Herzschlag meldete `state: "work"`, und das Gewerk beendete
                // sich nie. Es hielt damit 7,00 GB auf home fest - im
                // Kaltstart ein Viertel des Speichers, fuer nichts.
                //
                // Drei Versuche, dann gilt der Auftrag als gescheitert. Der
                // Kern stellt ihn neu, wenn er ihn noch will; das ist der
                // Weg, auf dem eine geaenderte Lage einfliesst.
                const n = (abgelehnt.get(auftrag.id) || 0) + 1;
                abgelehnt.set(auftrag.id, n);
                sag("Kauf abgelehnt vom Spiel (" + gb + " GB, " + n + ". Versuch).");
                if (n >= 3) {
                  sag("Auftrag " + auftrag.id + " nach drei Ablehnungen aufgegeben.");
                  erledigt.add(auftrag.id);
                  meldeErgebnis(nachHome, auftrag, false, "abgelehnt", jetzt);
                }
              }
            } else {
              // NICHT als erledigt markieren: das Geld kann in der naechsten
              // Runde da sein. Ein verworfener Auftrag muesste vom Kern neu
              // gestellt werden, und der merkt sich nicht, dass er ihn schon
              // einmal gestellt hat.
              wartetAufGeld = true;
              if (runden % 10 === 0) {
                sag("Auftrag " + auftrag.id + ": " + gb + " GB kosten "
                  + (preis / 1e6).toFixed(1) + "m, vorhanden "
                  + (geld / 1e6).toFixed(1) + "m - warte auf Geld.");
              }
            }
          }
        } else {
          // Ausbau eines vorhandenen Rechners.
          const ziel = auftrag.host;
          if (!ziel || !eigene.includes(ziel)) {
            sag("Auftrag " + auftrag.id + ": " + ziel + " ist kein eigener Rechner.");
            erledigt.add(auftrag.id);
            meldeErgebnis(nachHome, auftrag, false, "kein_eigener_rechner", jetzt);
          } else {
            let kosten = 0;
            try { kosten = ns.cloud.getServerUpgradeCost(ziel, gb); } catch { kosten = 0; }
            const geld = ns.getServerMoneyAvailable("home");
            if (kosten > 0 && kosten <= geld) {
              const ok = ns.cloud.upgradeServer(ziel, gb);
              sag((ok ? "Ausgebaut: " : "Ausbau abgelehnt: ") + ziel + " auf " + gb
                + " GB fuer " + (kosten / 1e6).toFixed(2) + "m.");
              erledigt.add(auftrag.id);
              meldeErgebnis(nachHome, auftrag, ok, ok ? ziel : "abgelehnt", jetzt);
            } else {
              wartetAufGeld = true;
              if (runden % 10 === 0) {
                sag("Ausbau " + ziel + " auf " + gb + " GB kostet "
                  + (kosten / 1e6).toFixed(1) + "m - warte auf Geld.");
              }
            }
          }
        }
      }

      // --- 3. Herzschlag ------------------------------------------------------
      nachHome("data/shop.json", JSON.stringify({
        schema: 2,
        ts: jetzt, wall: jetzt,
        playtime: (() => { try { return ns.getPlayer().totalPlaytime; } catch { return 0; } })(),
        motorTimeMs: 0,
        round: runden, okRound: okRunden,
        errStreak, lastError,
        host: ns.getHostname(), version: "shop-1",
        // Der Haendler wartet die meiste Zeit. Das ist KEIN Stillstand, und
        // ohne dieses Feld liefe die Frischepruefung auf einen Haenger hinaus,
        // der keiner ist.
        //
        // DREI ZUSTAENDE, NICHT ZWEI (04.09.2026). Vorher galt jeder offene
        // Auftrag als "work" - auch der, der seit einer Stunde am fehlenden
        // Geld haengt. Genau der Fall, fuer den das Feld gebaut wurde, war
        // damit falsch gemeldet: ein Gewerk, das nichts tun KANN, meldete
        // "arbeitet".
        state: !auftrag || erledigt.has(auftrag.id) ? "wait"
          : (wartetAufGeld ? "blocked" : "work"),
        blockedReason: wartetAufGeld ? "money" : null,
        park: park.length,
        limitAnzahl,
        kaufbar: limitAnzahl > 0,
      }));

      okRunden++;
      errStreak = 0;

      // --- 4. Fertig? Dann Platz machen. --------------------------------------
      //
      // ZWEI RUNDEN MINDESTENS, nicht eine. In der ersten Runde koennte ein
      // Auftrag unterwegs sein, den der Kern gerade schreibt, waehrend dieses
      // Gewerk die Datei schon gelesen hat. Zwei Runden sind sechzig Sekunden
      // und damit sechs Kernrunden - lange genug, dass ein Auftrag ankommt.
      //
      // Ein Auftrag, der auf Geld wartet, zaehlt als OFFEN: er soll erledigt
      // werden, sobald das Geld da ist, und ein Neustart wuerde das Warten von
      // vorn beginnen.
      const nochZuTun = auftrag && !erledigt.has(auftrag.id);
      if (!nochZuTun && runden >= 2) {
        nachHome("data/shop.json", JSON.stringify({
          schema: 2, ts: jetzt, wall: jetzt,
          playtime: (() => { try { return ns.getPlayer().totalPlaytime; } catch { return 0; } })(),
          motorTimeMs: 0,
          round: runden, okRound: okRunden, errStreak: 0, lastError,
          host: ns.getHostname(), version: "shop-1",
          state: "done", blockedReason: null,
          park: park.length, limitAnzahl, kaufbar: limitAnzahl > 0,
        }));
        sag("Preise geschrieben, kein Auftrag offen - beende mich und gebe "
          + "7 GB frei. Der Kern holt mich zurueck, wenn die Preise alt werden.");
        return;
      }
    } catch (e) {
      errStreak++;
      const msg = String(e && e.message ? e.message : e);
      lastError = { cls: (e && e.name) || "Error",
        msg: msg.length > 200 ? msg.slice(0, 197) + "..." : msg, at: Date.now() };
      sag("RUNDENFEHLER (" + errStreak + " in Folge): " + msg);
    }
    await ns.sleep(TAKT_MS);
  }
}

/**
 * Das Ergebnis eines Auftrags nach draussen - der Kern muss erfahren, ob sein
 * Auftrag ausgefuehrt wurde, sonst wartet er ewig auf einen Rechner, den es
 * nie geben wird.
 */
function meldeErgebnis(nachHome, auftrag, erfolg, was, jetzt) {
  nachHome("data/kaufergebnis.json", JSON.stringify({
    id: auftrag.id,
    erfolg,
    ergebnis: was,
    gb: auftrag.gb,
    grund: auftrag.grund || null,
    ts: jetzt,
  }));
}
