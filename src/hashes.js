/**
 * Hash-Verkaeufer - der kleine Teil des BitNode-9-Gewerks (rund 5 GB, damit er
 * neben bn4net und ausgang.js auf ein frisches 32-GB-home passt). Ausbau und
 * Wirt fuer exit.js macht hacknet.js auf der Werkbank.
 *
 * WAS ES TUT (02.09.2026, nach dem Skeptiker-Lauf)
 *
 *   - Hashes verkaufen ("Sell for Money", konstant 4 Hashes je 1 Mio,
 *     HashUpgrade.ts:73-75). Das Spiel verkauft Ueberlauf zwar selbst
 *     (HacknetHelpers.tsx:419-429), aber erst, wenn der Speicher voll ist -
 *     beim Gratis-Server nach 61 Minuten. Im Kaltstart zaehlt jede Minute.
 *   - In einem Bladeburner-Knoten (data/verfahren.txt = V2) und in der
 *     Division bei Konto > 1 Mrd: Hashes in Rang tauschen ("Exchange for
 *     Bladeburner Rank") - das ist dort die Ausgangswaehrung.
 *   - Ohne Hacknet-Server: ist der Knoten im Server-Modus (maxNumNodes 20,
 *     Hacknet.ts:57-62), wartet es auf hacknet.js, das den ersten kauft;
 *     sonst schreibt es data/keine-hacknet.txt mit der Knotennummer und
 *     beendet sich - bn4net startet es in diesem Knoten dann nicht mehr.
 *
 * @param {NS} ns
 */

// Steuer- und Lagedateien wohnen auf home; dieses Gewerk laeuft nicht
// zwingend dort. `ns.read` liest immer LOKAL - siehe lib/hostdatei.js.
import { liesVonHome } from "lib/hostdatei.js";

export async function main(ns) {
  ns.disableLog("ALL");
  const TAKT_MS = 10000;
  const VERKAUF = "Sell for Money";
  const RANG = "Exchange for Bladeburner Rank";
  const RANG_AB_GELD = 1e9;

  let knoten = 0;
  try { knoten = ns.getResetInfo().currentNode; } catch { knoten = 0; }
  const liesVerfahren = () => {
    try {
      if (!ns.fileExists("data/verfahren.txt", "home")) return "";
      const teile = liesVonHome(ns, "data/verfahren.txt").trim().split(/\s+/);
      return Number(teile[1]) === knoten ? teile[0] : "";
    } catch { return ""; }
  };

  let verkauft = 0, getauscht = 0, letzteMeldung = "";
  while (true) {
    try {
      let kapazitaet = 0, serverModus = false;
      try { kapazitaet = ns.hacknet.hashCapacity(); serverModus = ns.hacknet.maxNumNodes() === 20; } catch { kapazitaet = 0; }
      if (!(kapazitaet > 0)) {
        if (!serverModus) {
          ns.write("data/keine-hacknet.txt", String(knoten), "w");
          // bn4net liest den Marker auf home - dieses Skript laeuft meist auf
          // der Werkbank.
          if (ns.getHostname() !== "home") { try { ns.scp("data/keine-hacknet.txt", "home", ns.getHostname()); } catch { /* egal */ } }
          ns.print("Keine Hacknet-Server in BitNode " + knoten + " - Marker gesetzt, beende mich.");
          return;
        }
        if (letzteMeldung !== "warte") { ns.print("Server-Modus, aber noch kein Hacknet-Server - hacknet.js kauft den ersten."); letzteMeldung = "warte"; }
        await ns.sleep(60000); continue;
      }
      letzteMeldung = "";

      let inDivision = false;
      try { inDivision = ns.bladeburner.inBladeburner(); } catch { inDivision = false; }
      const rangTausch = inDivision && liesVerfahren() === "V2" && ns.getServerMoneyAvailable("home") > RANG_AB_GELD;
      const art = rangTausch ? RANG : VERKAUF;
      for (let i = 0; i < 1000; i++) {
        const preis = ns.hacknet.hashCost(art);
        if (!(preis > 0) || ns.hacknet.numHashes() < preis) break;
        if (!ns.hacknet.spendHashes(art)) break;
        if (rangTausch) getauscht++; else verkauft++;
      }
      ns.write("data/hashes.json", JSON.stringify({ zeit: Date.now(), knoten, hashes: ns.hacknet.numHashes(),
        kapazitaet, verkauft, getauscht, art }), "w");
      if (ns.getHostname() !== "home") { try { ns.scp("data/hashes.json", "home", ns.getHostname()); } catch { /* egal */ } }
    } catch (e) {
      ns.print("Fehler in der Runde: " + String(e));
    }
    await ns.sleep(TAKT_MS);
  }
}
