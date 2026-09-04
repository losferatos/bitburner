/**
 * Der Rechnerhaendler - kauft Mietrechner im Auftrag des Kerns.
 *
 * ===========================================================================
 * WARUM DAS EIN EIGENES GEWERK IST
 * ===========================================================================
 *
 * Die `ns.cloud.*`-Familie kostet den Kern 3,85 GB:
 *
 *   purchaseServer        2,25
 *   getServerNames        1,05
 *   getServerCost         0,25
 *   upgradeServer         0,25
 *   getRamLimit           0,05
 *
 * Das ist mehr als ein Zehntel des ganzen Kaltstart-Budgets von 32 GB, fuer
 * eine Handlung, die vielleicht einmal je Stunde vorkommt. Der Kern behaelt
 * die ENTSCHEIDUNG - er weiss als einziger, was gerade wartet und was das Geld
 * sonst noch soll - und gibt die AUSFUEHRUNG ab.
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
 * EIN AUFTRAG WIRD GENAU EINMAL AUSGEFUEHRT
 * ===========================================================================
 *
 * Der Kern schreibt `data/kaufauftrag.json`, dieses Gewerk fuehrt aus und
 * loescht den Auftrag. Ohne das Loeschen kaufte es in jeder Runde einen
 * weiteren Rechner - bei 25 erlaubten waere der Park in vier Minuten voll und
 * das Geld weg.
 *
 * Zusaetzlich traegt jeder Auftrag eine `id`; ein Auftrag mit bekannter id
 * wird nicht erneut ausgefuehrt, auch wenn die Datei liegen bleibt.
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
                sag("Kauf abgelehnt vom Spiel (" + gb + " GB) - Auftrag bleibt offen.");
                meldeErgebnis(nachHome, auftrag, false, "abgelehnt", jetzt);
              }
            } else {
              // NICHT als erledigt markieren: das Geld kann in der naechsten
              // Runde da sein. Ein verworfener Auftrag muesste vom Kern neu
              // gestellt werden, und der merkt sich nicht, dass er ihn schon
              // einmal gestellt hat.
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
            } else if (runden % 10 === 0) {
              sag("Ausbau " + ziel + " auf " + gb + " GB kostet "
                + (kosten / 1e6).toFixed(1) + "m - warte auf Geld.");
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
        state: auftrag && !erledigt.has(auftrag.id) ? "work" : "wait",
        blockedReason: null,
        park: park.length,
        limitAnzahl,
        kaufbar: limitAnzahl > 0,
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
