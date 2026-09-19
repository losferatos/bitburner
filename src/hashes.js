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
 *   - ANLAUF (19.09.2026, nach Erics Ansage): in einem V2-Knoten VOR der
 *     Aufnahme in die Division gehen die Hashes in "Improve Gym Training"
 *     (+20 % Gym-EXP je Stufe fuer Spieler UND Sleeves, Work/Formulas.ts:113;
 *     Kosten 50*(Stufe+1), HashUpgrade.ts:72-81; verfaellt beim Install).
 *     Der Bonus ist ADDITIV (getTrainingMult = 1 + 0,2*Stufe,
 *     HashManager.ts:42): 6 Stufen = Faktor 2,2, gemessen 19.09. 02:47.
 *
 *     ZWEI GRENZEN, beide vom Skeptiker-Lauf 19.09.:
 *     (1) GYM_AB_GELD 50 Mio. Beim Knoteneintritt steht das Konto auf
 *         1.000 $ (PlayerObjectGeneralMethods.ts:102), und Hashes sind in
 *         BitNode 9 die einzige Einnahme (0,28 Hashes/s vom Gratis-Server =
 *         70.000 $/s). bbtrain.js trainiert erst ab 5 Mio (GYM_MIN_GELD),
 *         sleeve.js ab 20 Mio plus Gebuehr. Gingen die Hashes ab Sekunde 1
 *         ins Gym, kaeme niemand je ins Gym - der Faktor multiplizierte
 *         nichts. Also erst verkaufen, bis beide trainieren koennen.
 *     (2) GYM_MAX_STUFE 6. Break-even gerechnet gegen die Anlaufphase von
 *         rund 10 h EXP-Zeit: Stufe L kostet 50*(L+1) Hashes = 179*(L+1) s
 *         Produktion und spart 36.000 s * 0,2 / (f*(f+0,2)) mit f = 1+0,2*L.
 *         Stufe 6 spart 1.364 s fuer 1.250 s Kosten, Stufe 7 nur noch
 *         1.154 s fuer 1.429 s. Ohne Deckel liefe es bis Stufe 20 (10.500
 *         Hashes = 10,4 h Produktion = 2,6 Mrd $ entgangen fuer +4 % EXP).
 *     Nach einem Install sind Hashes, Stufen UND Server weg
 *     (PlayerObjectGeneralMethods.ts:130-131); gekaufte Server haben
 *     Cache 1 = 64 Hashes Speicher, dort reicht es fuer eine Stufe.
 *     Uebersteigt der Stufenpreis den Hash-Speicher, faellt es auf Verkauf
 *     zurueck - sonst laege der Vorrat fuer immer am Deckel.
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
  const GYM = "Improve Gym Training";
  const RANG_AB_GELD = 1e9;
  const GYM_AB_GELD = 50e6;
  const GYM_MAX_STUFE = 6;
  const GYM_PREIS_JE_STUFE = 50;
  const gymStufe = (preis) => Math.round(preis / GYM_PREIS_JE_STUFE) - 1;

  let knoten = 0;
  try { knoten = ns.getResetInfo().currentNode; } catch { knoten = 0; }
  const liesVerfahren = () => {
    try {
      if (!ns.fileExists("data/verfahren.txt", "home")) return "";
      const teile = liesVonHome(ns, "data/verfahren.txt").trim().split(/\s+/);
      return Number(teile[1]) === knoten ? teile[0] : "";
    } catch { return ""; }
  };

  // Der Marker sperrt das Gewerk fuer diesen Knoten (Registry forbidsFile);
  // boot.js raeumt ihn beim Knotenwechsel (boot.js:166-171).
  const sperren = (grund) => {
    ns.write("data/keine-hacknet.txt", String(knoten), "w");
    // bn4net liest den Marker auf home - dieses Skript laeuft meist auf
    // der Werkbank.
    if (ns.getHostname() !== "home") { try { ns.scp("data/keine-hacknet.txt", "home", ns.getHostname()); } catch { /* egal */ } }
    ns.print(grund + " - Marker gesetzt, beende mich.");
  };
  const schreibeStand = (o) => {
    ns.write("data/hashes.json", JSON.stringify({ zeit: Date.now(), knoten, ...o }), "w");
    if (ns.getHostname() !== "home") { try { ns.scp("data/hashes.json", "home", ns.getHostname()); } catch { /* egal */ } }
  };

  // BITNODE 8 PRODUZIERT KEINE HASHES (Skeptiker 19.09.2026). HacknetNodeMoney
  // ist dort 0 (BitNode.tsx:770), calculateHashGainRate damit 0
  // (Hacknet/formulas/HacknetServers.ts:16). Mit SF9 gibt es die Server
  // trotzdem (maxNumNodes 20), der Wartezweig unten wuerde also nie den
  // Marker setzen und 5,95 GB fuer nichts belegen - drei Laeufe lang.
  if (knoten === 8) { sperren("BitNode 8: Hacknet erzeugt keine Hashes (HacknetNodeMoney 0)"); return; }

  let verkauft = 0, getauscht = 0, gym = 0, letzteMeldung = "";
  while (true) {
    try {
      let kapazitaet = 0, serverModus = false;
      try { kapazitaet = ns.hacknet.hashCapacity(); serverModus = ns.hacknet.maxNumNodes() === 20; } catch { kapazitaet = 0; }
      if (!(kapazitaet > 0)) {
        if (!serverModus) { sperren("Keine Hacknet-Server in BitNode " + knoten); return; }
        if (letzteMeldung !== "warte") { ns.print("Server-Modus, aber noch kein Hacknet-Server - hacknet.js kauft den ersten."); letzteMeldung = "warte"; }
        // HERZSCHLAG AUCH BEIM WARTEN (Skeptiker 19.09.2026). Ohne Telemetrie
        // hielte der Waechter das Gewerk nach 15 min fuer tot (S1), killte es
        // und startete es neu - in dieselbe stumme Schleife. `state: "wait"`
        // ist der Vertrag, den lib/leiter.js dafuer kennt (leiter.js:166).
        schreibeStand({ state: "wait", kapazitaet: 0, verkauft, getauscht, gym, art: null });
        await ns.sleep(60000); continue;
      }
      letzteMeldung = "";

      let inDivision = false;
      try { inDivision = ns.bladeburner.inBladeburner(); } catch { inDivision = false; }
      const v2 = liesVerfahren() === "V2";
      const rangTausch = inDivision && v2 && ns.getServerMoneyAvailable("home") > RANG_AB_GELD;
      // Anlauf: V2, aber noch nicht in der Division - Gym-Training, solange
      // eine Stufe in den Speicher passt (sonst bliebe der Vorrat am Deckel).
      let gymKauf = false;
      if (v2 && !inDivision && ns.getServerMoneyAvailable("home") >= GYM_AB_GELD) {
        let gymPreis = 0;
        try { gymPreis = ns.hacknet.hashCost(GYM); } catch { gymPreis = 0; }
        // Die Stufe steckt im Preis: 50*(Stufe+1) (HashUpgrade.ts:72-81,
        // costPerLevel 50 in HashUpgradesMetadata.tsx:72). So bleibt
        // getHashUpgradeLevel ungenutzt - das waeren 0,5 GB mehr und eine
        // neue RAM-Messung.
        gymKauf = gymPreis > 0 && gymPreis <= kapazitaet && gymStufe(gymPreis) < GYM_MAX_STUFE;
      }
      const art = rangTausch ? RANG : gymKauf ? GYM : VERKAUF;
      for (let i = 0; i < 1000; i++) {
        const preis = ns.hacknet.hashCost(art);
        if (!(preis > 0) || ns.hacknet.numHashes() < preis) break;
        if (!ns.hacknet.spendHashes(art)) break;
        if (rangTausch) getauscht++; else if (gymKauf) gym++; else verkauft++;
        // Gym: jede Stufe ist teurer - passt die naechste nicht mehr in den
        // Speicher oder ist der Deckel erreicht, ist hier Schluss; der Rest
        // geht in der naechsten Runde in den Verkauf.
        if (gymKauf) {
          const naechster = ns.hacknet.hashCost(GYM);
          if (naechster > kapazitaet || gymStufe(naechster) >= GYM_MAX_STUFE) break;
        }
      }
      schreibeStand({ state: "work", hashes: ns.hacknet.numHashes(), kapazitaet, verkauft, getauscht, gym, art });
    } catch (e) {
      ns.print("Fehler in der Runde: " + String(e));
    }
    await ns.sleep(TAKT_MS);
  }
}
