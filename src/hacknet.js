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

  while (true) {
    try {
      let kapazitaet = 0, serverModus = false;
      try { kapazitaet = ns.hacknet.hashCapacity(); serverModus = ns.hacknet.maxNumNodes() === 20; } catch { kapazitaet = 0; }
      if (!(kapazitaet > 0)) {
        // DER ERSTE SERVER (Skeptiker C/D): Nach einem Augmentierungs-Einbau
        // ist der Gratis-Server weg (Prestige.ts legt ihn nur beim
        // Knotenwechsel an). Im Server-Modus (maxNumNodes 20) den ersten
        // ohne Prozentregel kaufen - 50.000 $, und er ist in BitNode 9 die
        // einzige Einnahme.
        if (serverModus && ns.hacknet.numNodes() === 0) {
          const preis = ns.hacknet.getPurchaseNodeCost();
          if (preis > 0 && preis <= ns.getServerMoneyAvailable("home")) {
            if (ns.hacknet.purchaseNode() >= 0) { sag("Ersten Hacknet-Server gekauft fuer " + (preis / 1e6).toFixed(2) + "m."); continue; }
          }
          if (letzteMeldung !== "erster") { sag("Kein Hacknet-Server - der erste kostet " + (preis / 1e6).toFixed(2) + "m, warte auf Geld."); letzteMeldung = "erster"; }
          await ns.sleep(TAKT_MS); continue;
        }
        if (letzteMeldung !== "keine") { sag("Keine Hacknet-Server in diesem Knoten - warte."); letzteMeldung = "keine"; }
        await ns.sleep(TAKT_OHNE_SERVER_MS); continue;
      }
      if (letzteMeldung === "keine" || letzteMeldung === "erster") letzteMeldung = "";

      const geld = ns.getServerMoneyAvailable("home");
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
      let knoten = 0;
      try { knoten = ns.getResetInfo().currentNode; } catch { knoten = 0; }
      if (knoten !== 9) { await ns.sleep(TAKT_MS); continue; }
      let gekauft = "";
      if (n < ns.hacknet.maxNumNodes()) {
        const preis = ns.hacknet.getPurchaseNodeCost();
        if (preis > 0 && preis <= geld * ANTEIL_NEUER_SERVER && ns.hacknet.purchaseNode() >= 0) gekauft = "Server " + n + " fuer " + (preis / 1e6).toFixed(1) + "m";
      }
      // Reihenfolge nach Preis (nachgerechnet 02.09.): RAM ist am billigsten
      // (1 -> 2 GB 200k, +7 %), Kerne mittel (Kern 11 = 51,6 Mio, +5.000 $/s,
      // amortisiert in 3 h), Level auf dem Gratis-Server unbezahlbar
      // (Level 101 = 6,9 Mrd). Kerne deshalb bis 5 % des Kontos.
      for (let i = 0; i < n && !gekauft; i++) {
        const r = ns.hacknet.getRamUpgradeCost(i, 1);
        if (Number.isFinite(r) && r > 0 && r <= geld * ANTEIL_AUSBAU && ns.hacknet.upgradeRam(i, 1)) { gekauft = "RAM auf Server " + i; break; }
        const c = ns.hacknet.getCoreUpgradeCost(i, 1);
        if (Number.isFinite(c) && c > 0 && c <= geld * ANTEIL_NEUER_SERVER && ns.hacknet.upgradeCore(i, 1)) { gekauft = "Kern auf Server " + i; break; }
        const l = ns.hacknet.getLevelUpgradeCost(i, 1);
        if (Number.isFinite(l) && l > 0 && l <= geld * ANTEIL_AUSBAU && ns.hacknet.upgradeLevel(i, 1)) { gekauft = "Level auf Server " + i; break; }
      }
      if (gekauft) sag("Ausbau: " + gekauft + ".");
    } catch (e) {
      sag("Fehler in der Runde: " + String(e));
    }
    await ns.sleep(TAKT_MS);
  }
}
