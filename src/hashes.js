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
 *   - WIEDERAUFBAU IN DER DIVISION (23.09.2026, Erics Frage "gerade nach
 *     einem Reset muesste Improve Gym Training attraktiv sein"). Die
 *     Division ueberlebt einen Einbau, die Kampfwerte nicht: nach den
 *     Einbauten vom 22.09. (16:21, 20:38) standen sie wieder bei 1, und der
 *     Bot trainierte stundenlang - aber Gym kaufte dieses Gewerk nur
 *     "nicht in der Division". Gemessen im Spielstand vom 23.09. 07:26:
 *     Improve Gym Training Stufe 0. Jetzt gilt auch ein KAMPFAUFBAU in der
 *     Division als Anlauf: data/blade.json frisch (juenger als der letzte
 *     Einbau und als 15 min) und tiefstand < 100 oder weichtTraining (blade
 *     trainiert auch ueber 100 weiter, wenn nichts ueber der Schwelle liegt).
 *   - DER STUFENDECKEL RECHNET MIT DER GEMESSENEN RATE UND DER RESTZEIT.
 *     Die Grenze 6 war fuer 0,28 Hashes/s und volle 10 h gerechnet; am
 *     23.09. waren es 4,47/s. Stufe L lohnt, solange 50*(L+1)/rate kleiner
 *     ist als T * 0,2 / (f*(f+0,2)) mit T = 36.000 s mal dem Rest der noch
 *     noetigen Erfahrung. Der Rest folgt der Skill-Kurve
 *     exp ~ e^(lvl/(32*m)) (formulas/skill.ts, m ~ 0,6 = 1,339 * 0,45 in
 *     BN9): bei Tiefstand 75 fehlen 73 %, bei 90 41 %, bei 99 5 %
 *     (gegen eine unabhaengige Nachrechnung des Skeptikers geeicht). Ohne
 *     Rate gilt die alte 6. Die Einheiten (Sekunden Hash-Produktion gegen
 *     Sekunden Training) sind eine gesetzte Gleichwertigkeit, keine Physik.
 *   - DER RANGTAUSCH HING AM SPEICHER (23.09.2026). Stufe L kostet
 *     250*(L+1) Hashes (HashUpgrade.ts:72-81) fuer 100 Rang und damit rund
 *     33 Skillpunkte (RanksPerSkillPoint 3). Der Speicher fasste 576 (9
 *     Server, Cache 1 = 64 je Server), ab Stufe 2 (750) passte nichts mehr,
 *     und das Gewerk wartete ewig auf einen Kauf, der nie kommen konnte.
 *     Jetzt: passt er nicht, meldet es bedarfKapazitaet (hacknet.js baut
 *     darauf den Cache aus) und verkauft bis dahin. Ein Ausweichen in
 *     Skillpunkte wurde gebaut und vom Skeptiker gekippt: gleiche Preise,
 *     10 SP statt 100 Rang + 33 SP, und das stehende Konto blockierte den
 *     Cache-Ausbau (12-h-Simulation: 2.800 statt 3.800 Rang).
 *   - DAS GELD FUER AUGS IST TABU (Skeptiker 23.09.2026). Getauscht wird nur,
 *     was ueber data/geldbedarf.txt (Ruecklage von bn4rep.js fuer verdiente
 *     Augmentierungen) hinaus 1 Mrd uebrig ist - sonst haette der Rangtausch
 *     die 9,68 Mrd Ruecklage vom 23.09. nie wachsen lassen.
 *   - Der Rang aus Hashes steht als rangAusHashes (mit augReset-Stempel) in
 *     data/hashes.json. bn4net.js zieht ihn vom Traeger ab: sonst verdeckten
 *     100 Rang alle paar Minuten einen stehenden Motor vor dem Waechter.
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
  const GYM_MAX_STUFE = 6;           // ohne gemessene Rate
  const GYM_MAX_STUFE_HART = 20;     // auch mit Rate nie hoeher
  const AUFBAU_ZEIT_S = 36000;       // voller Anlauf, wie oben gerechnet
  const BLADE_FRISCH_MS = 15 * 60000;
  const RANG_PREIS_JE_STUFE = 250;
  const RANG_JE_STUFE = 100;
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
  // Hash-Rate aus dem eigenen Takt: Zuwachs zwischen dem Ende einer Runde
  // und dem Anfang der naechsten (dazwischen gibt niemand aus). Gewertet nur,
  // wenn der Speicher dabei nicht voll war - ein voller Speicher verkauft
  // den Ueberlauf selbst, und der Zuwachs waere zu klein.
  let hashesEnde = null, wallEnde = 0, rate = null;

  /** Anteil der Erfahrung bis Kampfwert 100, die noch fehlt (0..1). */
  const restAnteil = (tiefstand) => {
    if (!Number.isFinite(tiefstand)) return 1;
    const m = 0.6;
    const e = (l) => Math.exp(l / (32 * m));
    const t = Math.max(1, Math.min(100, tiefstand));
    return (e(100) - e(t)) / (e(100) - e(1));
  };

  /** Lohnt Gym-Stufe "stufe" (die naechste zu kaufende)? */
  const gymLohnt = (stufe, tiefstand) => {
    if (!(rate > 0)) return stufe < GYM_MAX_STUFE;
    if (stufe >= GYM_MAX_STUFE_HART) return false;
    const f = 1 + 0.2 * stufe;
    const kostenS = GYM_PREIS_JE_STUFE * (stufe + 1) / rate;
    // Untergrenze 0,1: blade trainiert auch ueber 100 weiter (weichtTraining).
    const restS = AUFBAU_ZEIT_S * Math.max(0.1, restAnteil(tiefstand));
    return kostenS < restS * 0.2 / (f * (f + 0.2));
  };

  /** Kampfaufbau in der Division? blade.json muss frisch sein. */
  const kampfLage = (letzterEinbau) => {
    try {
      const b = JSON.parse(liesVonHome(ns, "data/blade.json") || "null");
      if (!b || !Number.isFinite(b.zeit) || !Number.isFinite(b.tiefstand)) return null;
      if (b.zeit <= letzterEinbau || Date.now() - b.zeit > BLADE_FRISCH_MS) return null;
      return { aufbau: b.tiefstand < 100 || b.weichtTraining === true, tiefstand: b.tiefstand };
    } catch { return null; }
  };
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

      const jetztH = ns.hacknet.numHashes();
      const jetztW = Date.now();
      if (hashesEnde !== null && jetztW > wallEnde && hashesEnde < kapazitaet * 0.9
          && jetztH < kapazitaet * 0.9 && jetztH >= hashesEnde) {
        const messung = (jetztH - hashesEnde) / ((jetztW - wallEnde) / 1000);
        rate = rate === null ? messung : 0.8 * rate + 0.2 * messung;
      }
      let letzterEinbau = 0;
      try { letzterEinbau = ns.getResetInfo().lastAugReset || 0; } catch { letzterEinbau = 0; }
      const geld = ns.getServerMoneyAvailable("home");
      let ruecklage = 0;
      try {
        ruecklage = ns.fileExists("data/geldbedarf.txt", "home")
          ? Number(liesVonHome(ns, "data/geldbedarf.txt")) || 0 : 0;
      } catch { ruecklage = 0; }

      let inDivision = false;
      try { inDivision = ns.bladeburner.inBladeburner(); } catch { inDivision = false; }
      const v2 = liesVerfahren() === "V2";
      const lage = v2 && inDivision ? kampfLage(letzterEinbau) : null;
      const aufbau = !!(lage && lage.aufbau);
      const tiefstand = lage ? lage.tiefstand : NaN;
      // Anlauf: V2 vor der Division ODER Kampfaufbau in der Division -
      // Gym-Training, solange eine Stufe in den Speicher passt (sonst bliebe
      // der Vorrat am Deckel) und sich laut Rate und Restzeit lohnt.
      let gymKauf = false;
      if (v2 && (!inDivision || aufbau) && geld >= GYM_AB_GELD) {
        let gymPreis = 0;
        try { gymPreis = ns.hacknet.hashCost(GYM); } catch { gymPreis = 0; }
        // Die Stufe steckt im Preis: 50*(Stufe+1) (HashUpgrade.ts:72-81,
        // costPerLevel 50 in HashUpgradesMetadata.tsx:72). So bleibt
        // getHashUpgradeLevel ungenutzt - das waeren 0,5 GB mehr und eine
        // neue RAM-Messung.
        gymKauf = gymPreis > 0 && gymPreis <= kapazitaet && gymLohnt(gymStufe(gymPreis), tiefstand);
      }
      // Rang erst, wenn keine lohnende Gym-Stufe mehr ansteht, und nur aus
      // dem, was ueber der Aug-Ruecklage liegt.
      let rangTausch = false, bedarfKapazitaet = null;
      const rangPreis = ns.hacknet.hashCost(RANG);
      if (!gymKauf && inDivision && v2 && geld - ruecklage > RANG_AB_GELD) {
        if (rangPreis > 0 && rangPreis <= kapazitaet) rangTausch = true;
        else bedarfKapazitaet = rangPreis;
      }
      const art = gymKauf ? GYM : rangTausch ? RANG : VERKAUF;
      for (let i = 0; i < 1000; i++) {
        const preis = ns.hacknet.hashCost(art);
        if (!(preis > 0) || ns.hacknet.numHashes() < preis) break;
        if (!ns.hacknet.spendHashes(art)) break;
        if (gymKauf) gym++; else if (rangTausch) getauscht++; else verkauft++;
        // Gym und Rang: jede Stufe ist teurer - passt die naechste nicht mehr
        // in den Speicher (oder lohnt Gym nicht mehr), ist hier Schluss; die
        // naechste Runde entscheidet neu.
        if (gymKauf) {
          const naechster = ns.hacknet.hashCost(GYM);
          if (naechster > kapazitaet || !gymLohnt(gymStufe(naechster), tiefstand)) break;
        } else if (rangTausch) {
          const naechster = ns.hacknet.hashCost(RANG);
          if (naechster > kapazitaet) { bedarfKapazitaet = naechster; break; }
        }
      }
      hashesEnde = ns.hacknet.numHashes();
      wallEnde = Date.now();
      // Rang aus Hashes in diesem Einbauzyklus: die Stufe steckt im Preis
      // 250*(Stufe+1), und die Stufen fallen beim Einbau auf 0.
      const rangStufe = Math.max(0, Math.round(ns.hacknet.hashCost(RANG) / RANG_PREIS_JE_STUFE) - 1);
      schreibeStand({ state: "work", hashes: hashesEnde, kapazitaet, verkauft, getauscht, gym, art,
        aufbau, rate: rate === null ? null : Number(rate.toFixed(3)), bedarfKapazitaet,
        rangAusHashes: rangStufe * RANG_JE_STUFE, augReset: letzterEinbau });
    } catch (e) {
      ns.print("Fehler in der Runde: " + String(e));
    }
    await ns.sleep(TAKT_MS);
  }
}
