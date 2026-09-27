/**
 * Hacknet-Server-Ausbau und Wirt fuer exit.js - der grosse Teil des
 * BitNode-9-Gewerks. Der Verkauf der Hashes steckt bewusst NICHT hier,
 * sondern in hashes.js (4 GB), damit der Verkauf auf ein frisches 32-GB-home
 * passt. Dieses Skript hier braucht rund 9 GB und laeuft auf der Werkbank.
 *
 * WAS ES TUT (02.09.2026)
 *
 *   1. Meldet ausgang.js in data/ausgang.json `wirtFehlt` (exit.js findet
 *      keinen Rechner - in BitNode 9 gibt es keine Mietrechner), wird der RAM
 *      des ersten Hacknet-Servers verdoppelt, bis exit.js passt (bis 8 TB,
 *      HacknetServerConstants.MaxRam). Laufende Skripte druecken die
 *      Hash-Rate ueber ramRatio - das gilt nur fuer den Moment des Sprungs.
 *   2. Ausbau in kleinen Happen, NUR in BitNode 9: RAM (billig), dann
 *      Kerne (bis 5 % des Kontos), dann Level; ein neuer Server, wenn er
 *      hoechstens 5 % kostet; der ERSTE Server ohne Prozentregel, weil
 *      nach einem Einbau keiner mehr da ist. Das ist eine Bremse, keine
 *      Optimierung.
 *
 * Ohne Hacknet-Server (hashCapacity 0) wartet es fuenf Minuten je Runde.
 * Alle Hacknet-Aufrufe kosten 0,5 GB, kein Singularity.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const TAKT_MS = 30000;
  const TAKT_OHNE_SERVER_MS = 5 * 60000;
  const ANTEIL_AUSBAU = 0.02;
  const ANTEIL_NEUER_SERVER = 0.05;

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 40) log.shift();
    ns.write("data/hacknet.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") { try { ns.scp("data/hacknet.txt", "home", ns.getHostname()); } catch { /* egal */ } }
  };
  const liesVonHome = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return "";
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return ""; }
  };

  sag("hacknet.js laeuft auf " + ns.getHostname() + ".");
  let letzteMeldung = "";

  // DER MARKER, DEN hashes.js SCHON KENNT (26.09.2026, Audit-Fund 5#6, C3
  // Nachtrag). bn4net.js:3428-3433 liest ihn und startet weder hashes.js
  // noch hacknet.js erneut in diesem Knoten - ohne diesen Aufruf haette
  // hacknet.js sonst geschrieben "wartet" und wuerde ewig weiterlaufen.
  const sperren = () => {
    let knotenFuerMarke = 0;
    try { knotenFuerMarke = ns.getResetInfo().currentNode; } catch { knotenFuerMarke = 0; }
    ns.write("data/keine-hacknet.txt", String(knotenFuerMarke), "w");
    if (ns.getHostname() !== "home") { try { ns.scp("data/keine-hacknet.txt", "home", ns.getHostname()); } catch { /* egal */ } }
  };

  while (true) {
    try {
      // DER KNOTEN WIRD ZUERST GEPRUEFT (26.09.2026, Audit-Fund 5#6/C3).
      //
      // Hier stand die Knotenpruefung erst bei Punkt 2, NACH dem Kauf des
      // ersten Servers weiter unten. Das Hacknet-Server-Feature ist aber
      // nicht an BitNode 9 gebunden - `hasHacknetServers` gilt ab SF9 in
      // JEDEM Knoten (lib/reg.js:merkmale) -, und der Server faellt bei
      // JEDEM Augmentierungs-Einbau weg (PlayerObjectGeneralMethods.ts:130-131),
      // nicht nur beim Knotenwechsel. Ohne diese Sperre kaufte hacknet.js
      // also nach jedem Einbau in JEDEM V1-Knoten einen ersten Server fuer
      // rund 19.000 $, der 0,0005 H/s = 125 $/s Verkaufswert bringt und
      // danach nur noch RAM belegt (Bericht 5#6) - Hacking bringt dort das
      // Tausendfache (Punkt 2 unten), der Kauf zahlt sich nie zurueck.
      let knoten = 0;
      try { knoten = ns.getResetInfo().currentNode; } catch { knoten = 0; }

      let kapazitaet = 0, serverModus = false;
      try { kapazitaet = ns.hacknet.hashCapacity(); serverModus = ns.hacknet.maxNumNodes() === 20; } catch { kapazitaet = 0; }
      if (!(kapazitaet > 0)) {
        // DER ERSTE SERVER (Skeptiker C/D): Nach einem Augmentierungs-Einbau
        // ist der Gratis-Server weg (Prestige.ts legt ihn nur beim
        // Knotenwechsel an). Im Server-Modus (maxNumNodes 20) den ersten
        // ohne Prozentregel kaufen - 50.000 $, und er ist in BitNode 9 die
        // einzige Einnahme. NUR DORT: anderswo ist er wertlos (s.o.).
        if (serverModus && knoten === 9 && ns.hacknet.numNodes() === 0) {
          const preis = ns.hacknet.getPurchaseNodeCost();
          if (preis > 0 && preis <= ns.getServerMoneyAvailable("home")) {
            if (ns.hacknet.purchaseNode() >= 0) { sag("Ersten Hacknet-Server gekauft fuer " + (preis / 1e6).toFixed(2) + "m."); continue; }
          }
          if (letzteMeldung !== "erster") { sag("Kein Hacknet-Server - der erste kostet " + (preis / 1e6).toFixed(2) + "m, warte auf Geld."); letzteMeldung = "erster"; }
          await ns.sleep(TAKT_MS); continue;
        }
        if (knoten !== 9) {
          // AUSSERHALB BN9 OHNE KAPAZITAET HEISST: KEIN SF9.3-GRATIS-SERVER
          // (MEHR) DA (26.09.2026, Audit-Fund 5#6, C3-Nachtrag).
          //
          // `kapazitaet > 0` (oben) faengt den Gratis-Server aus SF9.3 ab,
          // solange er lebt (er entsteht bei jedem Sprung, verschwindet erst
          // beim ersten Einbau, PlayerObjectGeneralMethods.ts:130-131) - dann
          // verkauft hashes.js seine Hashes ganz normal, unabhaengig vom
          // Knoten. Ist die Kapazitaet hier 0, ist dieser Server also weg,
          // und ausserhalb BN9 kauft dieses Skript nie einen neuen (s.o.,
          // "NUR in BitNode 9"). Ohne Ausstieg liefe es bis zum naechsten
          // Sprung leer weiter und haette dafuer dauerhaft ~9 GB auf der
          // Werkbank reserviert. Der Marker ist derselbe, den hashes.js
          // schon setzt - bn4net.js startet dann keins von beiden erneut in
          // diesem Knoten.
          sag("BitNode " + knoten + ": kein Hacknet-Server mehr (SF9.3-Gratis-Server weg) - beende mich, nur BN9 kauft neu.");
          sperren();
          return;
        }
        if (letzteMeldung !== "keine") {
          sag("Keine Hacknet-Server in diesem Knoten - warte.");
          letzteMeldung = "keine";
        }
        await ns.sleep(TAKT_OHNE_SERVER_MS); continue;
      }
      if (letzteMeldung === "keine" || letzteMeldung === "erster") letzteMeldung = "";

      const geld = ns.getServerMoneyAvailable("home");
      // Die Aug-Ruecklage von bn4rep.js ist tabu (Skeptiker 23.09.2026): alle
      // Ausbauten unten rechnen vom freien Konto. Nur der Wirt fuer exit.js
      // (Punkt 1) darf das ganze Konto sehen - der Sprung verwirft die
      // gekauften Augs ohnehin.
      const ruecklage = Number(liesVonHome("data/geldbedarf.txt")) || 0;
      const frei = Math.max(0, geld - ruecklage);
      const n = ns.hacknet.numNodes();

      // 1. Wirt fuer exit.js
      let wirtFehlt = null;
      try { wirtFehlt = JSON.parse(liesVonHome("data/ausgang.json")).wirtFehlt || null; } catch { wirtFehlt = null; }
      if (wirtFehlt && n > 0) {
        const s0 = ns.hacknet.getNodeStats(0);
        const noetig = Number(wirtFehlt.braucht) + 8;
        if (s0.ram < noetig) {
          const kosten = ns.hacknet.getRamUpgradeCost(0, 1);
          if (Number.isFinite(kosten) && kosten > 0 && kosten * 2 <= geld) {
            if (ns.hacknet.upgradeRam(0, 1)) sag(s0.name + ": RAM " + s0.ram + " -> " + (s0.ram * 2)
              + " GB fuer " + (kosten / 1e6).toFixed(1) + "m - exit.js braucht " + noetig.toFixed(0) + " GB.");
          } else if (letzteMeldung !== "wirt") {
            sag("exit.js braucht " + noetig.toFixed(0) + " GB auf " + s0.name + " (" + s0.ram + " GB); naechste Stufe kostet "
              + (kosten / 1e6).toFixed(1) + "m, Konto " + (geld / 1e6).toFixed(0) + "m - warte.");
            letzteMeldung = "wirt";
          }
          await ns.sleep(TAKT_MS); continue;
        }
      }

      // 2. Ausbau in kleinen Happen - NUR in BitNode 9 (Skeptiker C/D):
      //    anderswo bringt Hacking das Tausendfache, und die Stufen zahlen
      //    sich nie zurueck (Level 101 = 6,9 Mrd fuer 700 $/s).
      //    `knoten` kommt schon von oben (Audit-Fund 5#6/C3).
      if (knoten !== 9) { await ns.sleep(TAKT_MS); continue; }
      let gekauft = "";
      // 2a. CACHE FUER DEN RANGTAUSCH (23.09.2026). hashes.js tauscht Hashes
      // in Bladeburner-Rang; Stufe L kostet 250*(L+1) Hashes, und der Kauf
      // muss auf einmal in den Speicher passen. Cache c fasst 32*2^c
      // (HacknetServer.ts:121-122), der Ausbau kostet 10 Mio * 1,85^(c-1)
      // (formulas/HacknetServers.ts:90-110). Bis heute baute niemand den
      // Cache aus: 9 Server mit Cache 1 = 576, der Rangtausch stand ab
      // Stufe 2 (750) still, und 4,47 Hashes/s gingen in den Verkauf statt
      // in rund 100 Rang je Stufe. hashes.js meldet den Bedarf in
      // data/hashes.json (bedarfKapazitaet); hier wird der kleinste Cache
      // ausgebaut, solange er hoechstens 5 % des freien Kontos kostet (ohne
      // die Aug-Ruecklage aus data/geldbedarf.txt). Nur mit
      // frischer Meldung aus diesem Knoten - sonst baut niemand auf Vorrat.
      try {
        const h = JSON.parse(liesVonHome("data/hashes.json") || "null");
        const frisch = h && h.knoten === knoten && Number.isFinite(h.zeit) && Date.now() - h.zeit < 5 * 60000;
        if (frisch && Number.isFinite(h.bedarfKapazitaet) && h.bedarfKapazitaet > kapazitaet) {
          let bester = -1, besterCache = Infinity;
          for (let i = 0; i < n; i++) {
            const c = ns.hacknet.getNodeStats(i).cache;
            if (Number.isFinite(c) && c < besterCache) { besterCache = c; bester = i; }
          }
          if (bester >= 0) {
            const k = ns.hacknet.getCacheUpgradeCost(bester, 1);
            if (Number.isFinite(k) && k > 0 && k <= frei * ANTEIL_NEUER_SERVER && ns.hacknet.upgradeCache(bester, 1)) {
              gekauft = "Cache auf Server " + bester + " (" + besterCache + " -> " + (besterCache + 1)
                + ") fuer " + (k / 1e6).toFixed(1) + "m - Rangtausch braucht " + h.bedarfKapazitaet
                + " Hashes Speicher, hat " + kapazitaet;
            }
          }
        }
      } catch { /* dann eben kein Cache in dieser Runde */ }
      if (!gekauft && n < ns.hacknet.maxNumNodes()) {
        const preis = ns.hacknet.getPurchaseNodeCost();
        if (preis > 0 && preis <= frei * ANTEIL_NEUER_SERVER && ns.hacknet.purchaseNode() >= 0) gekauft = "Server " + n + " fuer " + (preis / 1e6).toFixed(1) + "m";
      }
      // Reihenfolge nach Preis (nachgerechnet 02.09.): RAM ist am billigsten
      // (1 -> 2 GB 200k, +7 %), Kerne mittel (Kern 11 = 51,6 Mio, +5.000 $/s,
      // amortisiert in 3 h), Level auf dem Gratis-Server unbezahlbar
      // (Level 101 = 6,9 Mrd). Kerne deshalb bis 5 % des Kontos.
      for (let i = 0; i < n && !gekauft; i++) {
        const r = ns.hacknet.getRamUpgradeCost(i, 1);
        if (Number.isFinite(r) && r > 0 && r <= frei * ANTEIL_AUSBAU && ns.hacknet.upgradeRam(i, 1)) { gekauft = "RAM auf Server " + i; break; }
        const c = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (Number.isFinite(c) && c > 0 && c <= frei * ANTEIL_NEUER_SERVER && ns.hacknet.upgradeCore(i, 1)) { gekauft = "Kern auf Server " + i; break; }
        const l = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (Number.isFinite(l) && l > 0 && l <= frei * ANTEIL_AUSBAU && ns.hacknet.upgradeLevel(i, 1)) { gekauft = "Level auf Server " + i; break; }
      }
      if (gekauft) sag("Ausbau: " + gekauft + ".");
    } catch (e) {
      sag("Fehler in der Runde: " + String(e));
    }
    await ns.sleep(TAKT_MS);
  }
}
