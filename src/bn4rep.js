/**
 * Reputation erarbeiten und Augmentierungen kaufen.
 *
 * WARUM DAS JETZT DER ENGPASS IST
 *
 * Geld ist keiner mehr: Die Coding Contracts bringen in BitNode 4
 * ungedaempfte 25 bis 75 Millionen je Stueck, waehrend Verbrechen bei
 * CrimeMoney 0.2 und Hacking bei 0.0225 duempeln. Was fehlt, ist
 * Reputation - und die gibt es nur gegen Zeit.
 *
 * Genau deshalb darf die Spielfigur nicht mehr shopliften. Ihre Zeit ist in
 * Faktionsarbeit mehr wert als in einem Verbrechen, dessen Ertrag wir nicht
 * mehr brauchen. bn4life.js haelt sich zurueck, solange data/rep-modus.txt
 * liegt.
 *
 * WARUM NICHT SPENDEN
 *
 * Spenden waere schneller, ist aber gesperrt: Es verlangt Favor 150
 * (Constants.ts BaseFavorToDonate), und Favor wird beim BitNode-Wechsel auf
 * null gesetzt (Faction.ts prestigeSourceFile -> setFavor(0)). Der in
 * BitNode 1 erarbeitete Vorsprung existiert hier nicht. Favor waechst nur
 * ueber Augmentierungs-Installationen, also erst nach dem ersten Reset.
 *
 * WELCHE AUGMENTIERUNG ZUERST
 *
 * Die mit der niedrigsten Reputationshuerde, die noch fehlt. Nicht die
 * teuerste, nicht die staerkste: Jede gekaufte Augmentierung verteuert die
 * naechste um den Faktor 1,9, und der Weg zu w0r1d_d43m0n fuehrt ueber
 * Hacking 9000 - also ueber viele kleine Multiplikatoren, nicht ueber ein
 * einzelnes Prunkstueck.
 *
 * @param {NS} ns
 */
import { hackNutzen } from "lib/hackaugs.js";

export async function main(ns) {
  ns.disableLog("ALL");

  const NL = String.fromCharCode(10);
  let log = [];
  const sag = (t) => {
    const zeile = new Date().toLocaleTimeString() + "  " + t;
    ns.print(zeile);
    log.push(zeile);
    if (log.length > 150) log = log.slice(-150);
    ns.write("data/bn4rep-log.txt", log.join(NL) + NL, "w");
  };
  sag("bn4rep gestartet.");

  // NeuroFlux ist ein Sonderfall: unendlich stapelbar, aber immer nur eine
  // Stufe hoeher als die gekaufte. Er wuerde jede Auswahl dominieren und dabei
  // alle anderen Augmentierungen um 1,9 je Stueck verteuern. Erst zum Schluss.
  const NFG = "NeuroFlux Governor";

  // --- Firmenfaktionen (M4) ------------------------------------------------
  // Clarke Incorporated und OmniTek Incorporated laden nicht ein, weil man
  // etwas gehackt hat, sondern weil man bei IHNEN ANGESTELLT ist und
  // 400.000 FIRMENreputation hat (FactionInfo.tsx:292-295 und :311-314,
  // CONSTANTS.CorpFactionRepRequirement = 400e3 in Constants.ts:25). Das ist
  // der einzige Weg zu nextSENS x1,2, Neuronal Densification x1,15,
  // OmniTek InfoLoad x1,2 und PCDNI x1,08 - ohne sie endet der
  // Hacking-Multiplikator bei etwa 4,6 statt bei 8,3.
  //
  // Firmenname und Faktionsname sind derselbe Text. Das ist kein Zufall,
  // sondern die Datenstruktur des Spiels (CompanyName und FactionName tragen
  // beide "Clarke Incorporated"), und es erspart eine Uebersetzungstabelle.
  const COMPANIES = ["Clarke Incorporated", "OmniTek Incorporated"];
  const COMPANY_REP_GOAL = 400e3;

  // IT statt Software. Beide Leitern haben dieselbe zweite Sprosse
  // (repMultiplier 1,1 / hackingEffectiveness 85), aber die IT-Leiter ist
  // billiger zu erklimmen: IT Intern hat hackingEffectiveness 90 statt 85
  // beim gleichen repMultiplier 0,9, und IT Analyst verlangt Hacking 26+224
  // und 7.000 Firmenreputation statt 51+224 und 8.000
  // (CompanyPositionsMetadata.ts:113-135 gegen :7-30, Aufschlag
  // jobStatReqOffset 224 aus CompaniesMetadata.ts:67/75).
  const COMPANY_FIELD = "IT";

  // Ab hier ist Schluss ohne Charisma. IT Manager verlangt Charisma 51+224=275
  // (CompanyPositionsMetadata.ts:137-149), und Charisma steht bei 1. Der
  // Aufstieg auf IT Analyst bringt +22 % Rate, der weitere auf IT Manager
  // noch einmal +11 % - und kostet an der Universitaet rund 12 Stunden
  // (Leadership 4 chaExp/s x expMult 4 in Volhaven; e^((275/1,163+200)/32)
  // = 837.000 Erfahrung). Zwoelf Stunden Training fuer elf Prozent auf einen
  // sechzehnstuendigen Posten ist ein Verlustgeschaeft, deshalb wird Charisma
  // NICHT trainiert. Nebenbefund: currentNodeMults.ClassGymExpGain wird in
  // v3.0.2 nirgends angewandt (nur in BitNodeMultipliers.ts:28 definiert),
  // die 0,5 aus BitNode 4 daempfen das Studium also gar nicht.
  //
  // Die Firmenreputation ist in BitNode 4 UNGEDAEMPFT: case 4
  // (BitNode.tsx:627-655) setzt CompanyWorkMoney 0.1 und CompanyWorkExpGain
  // 0.5, aber KEIN CompanyWorkRepGain - der steht nur in case 11
  // (BitNode.tsx:1066). Fuer die Reputation ist BitNode 4 also ein normaler
  // Knoten; nur der Lohn und die Erfahrung sind gekuerzt.
  //
  // WANN DIE FIRMENPHASE LAEUFT - und warum es KEINE Levelschwelle ist
  //
  // Die vollstaendige Rate ist (Work/Formulas.ts:124-158, CompanyPosition.ts:156-172):
  //
  //   rep/s = 5 x repMult x SUM(effectiveness x skill)/975/100
  //           x mults.company_rep x (1 + Firmenfavor/100) x CompanyWorkRepGain
  //           (+ intelligence/975 innerhalb der Klammer; hier 0, ohne SF5)
  //
  // Die Faktionsarbeit folgt derselben Bauart
  // (PersonObjects/formulas/reputation.ts:16-24):
  //
  //   rep/s = 5 x (hacking + int/3)/975 x mults.faction_rep
  //           x (1 + Favor/100) x FactionWorkRepGain(0,75) x shareBonus
  //
  // BEIDE sind exakt proportional zum Hackinglevel. Das Verhaeltnis ist
  // deshalb KONSTANT und vom Level unabhaengig: als IT Intern
  // (0,9 x 90/100)/0,75 = 1,08, als IT Analyst (1,1 x 85/100)/0,75 = 1,25 -
  // je zum Faktor mults.company_rep/mults.faction_rep. Firmenarbeit ist in
  // BitNode 4 auf JEDEM Level ertragreicher je Sekunde, weil hier
  // FactionWorkRepGain auf 0,75 gedaempft ist und CompanyWorkRepGain gar
  // nicht. Eine Hackingschwelle waere also schlicht das falsche Kriterium -
  // eine frueher hier stehende Marke von 2.000 hat nach jedem Einbau die
  // Firmenphase erneut fuer Stunden zugesperrt, ohne dafuer irgendetwas zu
  // gewinnen.
  //
  // Das richtige Kriterium ist AUFZINSUNG, nicht Niveau. Faktionsreputation
  // zahlt in Stufen aus: 15.000 hier, 45.000 dort, und jede gekaufte
  // Augmentierung hebt den Multiplikator, der alles andere beschleunigt.
  // Firmenreputation zahlt erst nach vollen 300.000-400.000 ueberhaupt etwas
  // aus. Solange also noch eine hackingrelevante Augmentierung in Reichweite
  // liegt, ist die Faktion trotz der schlechteren Sekundenrate das bessere
  // Geschaeft. Erst wenn die naechste Huerde so weit weg ist, dass sie in
  // diesem Zyklus ohnehin nicht faellt, lohnt der Umstieg.
  //
  // 150.000 als Reichweite: bei den heute gemessenen 2,9 rep/s sind das 14
  // Stunden, bei Hacking 2.500 noch gut zwei. Alles darueber ist keine
  // Zyklusarbeit mehr, sondern ein eigenes Vorhaben - und dann ist die Firma
  // das naeherliegende, weil sie wenigstens abschliesst.
  //
  // Ein erwuenschter Nebeneffekt: Nach dem Beitritt zu Clarke sind deren
  // eigene Augmentierungen (187.500 und 437.500 Faktionsreputation) allesamt
  // ausserhalb der Reichweite, und der Bot geht zuerst die zweite Firma an,
  // statt Clarkes Faktionsreputation zu erarbeiten. Das ist richtig herum:
  // Die Faktionsreputation faellt bei jedem Einbau auf null, die einmal
  // ausgesprochene EINLADUNG dagegen nicht (keepOnInstall). Was den Einbau
  // ueberlebt, holt man zuerst.
  const COMPANY_GAP = 150e3;

  // Und die Phase laeuft NUR, wenn kein Einbau ansteht. Beides zugleich geht
  // nicht: Der Einbau setzt company.playerReputation auf null
  // (Company.ts:77-80) - bis zu 400.000 erarbeitete Firmenreputation waeren
  // weg, umgerechnet in Favor zwar nicht ganz verloren, aber der Weg zur
  // Einladung finge von vorn an. Deshalb zuerst einbauen, dann Firma; und
  // waehrend der Phase wird der Einbau gesperrt (siehe INSTALL_LOCK_FILE).
  const MINDEST_WARTESCHLANGE = 3;
  const LUECKE_ZU_GROSS = 15000;   // Reputation; bei ~40/min ueber sechs Stunden

  // Die Sperrdatei aus dem Tuerschloss von heute frueh, jetzt auch von diesem
  // Skript selbst benutzt. Zwei Schreiber, eine Datei - unterscheidbar am
  // Praefix: Was mit FIRMENPHASE beginnt, gehoert uns und wird von uns wieder
  // weggeraeumt; alles andere ist von Hand gesetzt und wird nie angefasst.
  //
  // Der Zeitstempel ist die Lebensversicherung. Stirbt bn4rep mitten in der
  // Firmenphase, bliebe die Sperre sonst liegen und der Bot koennte NIE mehr
  // einbauen - also genau die Falle vom 20.08., nur in die andere Richtung.
  // Eine Sperre ohne Zeitstempel gilt unbefristet (das ist der Handbetrieb),
  // eine mit Zeitstempel nur fuenf Minuten; die Phase erneuert sie alle 15 s.
  const INSTALL_LOCK_FILE = "data/install-sperre.txt";
  const INSTALL_LOCK_TAG = "FIRMENPHASE";
  const INSTALL_LOCK_MAX_AGE = 300000;

  // Der Aussenschalter. Inhalt:
  //   "off"                    - nie Firmenarbeit (Notbremse)
  //   "auto"                   - wie ohne Datei
  //   "<Firmenname>|<bis-ms>"  - erzwingt diese Firma bis zu diesem Zeitpunkt
  // Der Zeitpunkt ist Absicht und keine Bequemlichkeit: Ein erzwungener Modus
  // ohne Verfallsdatum ist genau die Falle, die am 20.08. fuenf Stunden
  // Stillstand gekostet hat. Laeuft die Frist ab, faellt der Bot von selbst
  // auf Faktionsarbeit zurueck, auch wenn niemand hinsieht.
  const COMPANY_ORDER_FILE = "data/company-order.txt";

  // Dateien auf home lesen und schreiben, obwohl dieses Skript auf der
  // Werkbank laeuft. ns.read und ns.write arbeiten LOKAL, ns.fileExists und
  // ns.rm koennen jeden Rechner ansprechen - diese Asymmetrie hat schon
  // einmal eine Bremse wirkungslos gemacht (45 statt 190 Reputation je
  // Minute), deshalb steht sie hier genau einmal und nicht viermal verstreut.
  const liesVonHome = (datei) => {
    if (!ns.fileExists(datei, "home")) {
      // Auf home geloescht heisst geloescht. Eine liegengebliebene Kopie auf
      // der Werkbank wuerde den Befehl ueberdauern, den es nicht mehr gibt.
      if (ns.getHostname() !== "home" && ns.fileExists(datei, ns.getHostname())) {
        ns.rm(datei, ns.getHostname());
      }
      return "";
    }
    if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
    return String(ns.read(datei)).trim();
  };
  const schreibNachHome = (datei, inhalt) => {
    ns.write(datei, inhalt, "w");
    if (ns.getHostname() !== "home") ns.scp(datei, "home", ns.getHostname());
  };
  const loeschAufHome = (datei) => {
    try { ns.rm(datei, "home"); } catch { /* lag nie dort */ }
    if (ns.getHostname() !== "home") {
      try { ns.rm(datei, ns.getHostname()); } catch { /* auch gut */ }
    }
  };

  const geldText = (n) => {
    for (const [t, k] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
      if (Math.abs(n) >= t) return "$" + (n / t).toFixed(2) + k;
    }
    return "$" + n.toFixed(0);
  };

  for (;;) {
   try {
    const spieler = ns.getPlayer();
    // Einmal abfragen, dreimal benutzt. Die Warteschlangenlaenge steht seit
    // dem 22.08.2026 hier oben statt beim Einbaukriterium, weil schon die
    // Entscheidung ueber die Firmenphase sie braucht: Solange genug Stuecke
    // fuer einen Einbau warten, wird eingebaut und nicht gearbeitet.
    const alleAugs = ns.singularity.getOwnedAugmentations(true);
    const eingebauteAugs = ns.singularity.getOwnedAugmentations(false);
    const besitz = new Set(alleAugs);
    const wartend = alleAugs.length - eingebauteAugs.length;
    const geld = ns.getServerMoneyAvailable("home");

    // Favor je Faktion mitzaehlen. Ab 150 (Constants.ts BaseFavorToDonate, in
    // BitNode 4 mit Multiplikator 1) faellt die Trennung zwischen Geld und
    // Reputation: Spenden bringt dann rep = betrag/1e6 * faction_rep, und Geld
    // hat dieser Bot im Ueberfluss, waehrend Reputation der Engpass ist. Das
    // ist der einzige Hebel, der die Preisspirale von 1,9 je wartendem Stueck
    // dauerhaft durchbricht.
    //
    // Favor waechst nur beim Einbau, und zwar aus der gesammelten Reputation
    // (favor.ts repToFavor). Entscheidend ist, dass EINE Faktion die Marke
    // erreicht, nicht alle - deshalb wird je Faktion gezaehlt, nicht in Summe.
    const favor = {};
    let favorBeste = 0, favorBesteFaktion = null;
    for (const f of spieler.factions) {
      favor[f] = ns.singularity.getFactionFavor(f);
      if (favor[f] > favorBeste) { favorBeste = favor[f]; favorBesteFaktion = f; }
    }

    // --- 1. Alle erreichbaren Augmentierungen sammeln -------------------------
    const kandidaten = [];
    for (const faktion of spieler.factions) {
      const rep = ns.singularity.getFactionRep(faktion);
      for (const aug of ns.singularity.getAugmentationsFromFaction(faktion)) {
        if (aug === NFG || besitz.has(aug)) continue;
        kandidaten.push({
          aug, faktion, rep,
          repReq: ns.singularity.getAugmentationRepReq(aug),
          preis: ns.singularity.getAugmentationPrice(aug),
        });
      }
    }

    // --- 1b. Steht eine Firmenphase an? --------------------------------------
    // Die Entscheidung faellt HIER oben und nicht erst bei der Arbeit, weil
    // der Ausstieg direkt darunter ("keine offenen Augmentierungen") sie sonst
    // ueberspringt. Genau dieser Zustand ist der Normalfall am Ende eines
    // Zyklus: Alles aus den beigetretenen Faktionen ist gekauft, und die
    // einzige verbliebene Arbeit ist die Firma.
    const companyOrder = liesVonHome(COMPANY_ORDER_FILE);
    const [orderName, orderUntil] = companyOrder.split("|");
    const orderActive = !!orderName && orderName !== "off" && orderName !== "auto"
      && Date.now() < (Number(orderUntil) || 0);

    // Wie weit ist die naechste Augmentierung, die den Hacking-Multiplikator
    // hebt? Nur die zaehlt fuer diese Entscheidung - eine Kampfaugmentierung
    // in Reichweite ist kein Grund, die Firma zu vertagen.
    //
    // Math.min OHNE den Startwert Infinity und mit ausdruecklicher
    // Leerpruefung. Math.min(Infinity, ...[]) ergibt Infinity, und das las das
    // Einbaukriterium als "die naechste Huerde ist unendlich weit" statt als
    // "es gibt gar keine Huerde mehr" - dieselbe Zahl, zwei gegensaetzliche
    // Bedeutungen. Hier wird der leere Fall benannt, statt ihn zu verkleiden.
    const offeneNuetzliche = kandidaten
      .filter((k) => k.rep < k.repReq && hackNutzen(k.aug) > 0)
      .map((k) => k.repReq - k.rep);
    const naechsteNuetzlicheLuecke = offeneNuetzliche.length
      ? Math.min(...offeneNuetzliche) : null;      // null = nichts mehr offen

    let companyTarget = null;
    if (orderActive && COMPANIES.includes(orderName)) {
      companyTarget = orderName;
    } else if (orderName !== "off"
        && (naechsteNuetzlicheLuecke === null || naechsteNuetzlicheLuecke > COMPANY_GAP)
        && wartend < MINDEST_WARTESCHLANGE) {
      for (const c of COMPANIES) {
        // Ist die Einladung durch, ist die Firma erledigt: Die Faktion traegt
        // keepOnInstall (FactionInfo.tsx:282/301), und Prestige.ts:59-66
        // sammelt vor dem Reset alle Faktionen ein, die schon in
        // Player.factions oder Player.factionInvitations stehen, und spricht
        // die Einladung danach neu aus (:118-120). Ab dem ERSTEN Beitritt
        // sind die 400.000 Firmenreputation damit ein einmaliger Posten fuer
        // den ganzen BitNode; davor gilt die Zusage nicht.
        if (spieler.factions.includes(c)) continue;
        companyTarget = c;
        break;
      }
    }

    // Keine Firmenphase heisst: keine Anstellung halten und keine Sperre.
    //
    // Die Kuendigung ist Hygiene, kein Hebel. Eine der vier Belohnungsarten
    // eines Codingvertrags ist Firmenreputation, und sie faellt nur dann auf
    // Faktionsreputation zurueck, wenn Player.jobs LEER ist
    // (PlayerObjectGeneralMethods.ts:539-548). Wieviel das ausmacht, weiss
    // ich nicht - in 42 Minuten Anstellung ist am 22.08. kein einziger
    // solcher Vertrag aufgetreten. Der Eingriff kostet nichts (die
    // Firmenreputation bleibt stehen, PlayerObjectGeneralMethods.ts:393), und
    // eine Anstellung ohne Zweck ist kein Zustand, den man haelt.
    if (!companyTarget) {
      for (const c of COMPANIES) {
        if (!ns.getPlayer().jobs[c]) continue;
        ns.singularity.quitJob(c);
        sag("Gekuendigt bei " + c + " - keine Firmenphase mehr.");
      }
      // Unsere eigene Einbausperre wieder wegraeumen. NUR unsere: Was nicht
      // mit FIRMENPHASE beginnt, hat ein Mensch gesetzt und bleibt liegen.
      const lock = liesVonHome(INSTALL_LOCK_FILE);
      if (lock.startsWith(INSTALL_LOCK_TAG)) {
        loeschAufHome(INSTALL_LOCK_FILE);
        sag("Einbausperre der Firmenphase aufgehoben.");
      }
    }

    if (!kandidaten.length && !companyTarget) {
      // Nichts mehr zu holen: Bremse loesen, damit bn4life wieder Geld
      // verdienen darf, statt dass die Figur untaetig herumsteht.
      if (ns.fileExists("data/rep-modus.txt", "home")) {
        ns.rm("data/rep-modus.txt", "home");
        sag("Keine offenen Augmentierungen - Verbrechen wieder freigegeben.");
      }
      await ns.sleep(60000);
      continue;
    }

    // --- 0. Lohnt ein Einbau? -------------------------------------------------
    // Der Multiplikator ist alles. Das Hacking-Level folgt
    //     Level = mult * (32*ln(exp+534.6) - 200)   (Hacking.ts)
    // also LOGARITHMISCH aus der Erfahrung und LINEAR aus dem Multiplikator.
    // Fuer Level 9000 - was w0r1d_d43m0n in diesem BitNode verlangt - braeuchte
    // es bei Multiplikator 1 eine Erfahrung von e^287; bei Multiplikator 30
    // genuegen sechs Millionen. Erfahrung sammeln fuehrt nicht zum Ziel,
    // Augmentierungen einbauen schon.
    //
    // Eingebaut wird, wenn die Warteschlange sich lohnt und nichts Weiteres in
    // absehbarer Zeit erreichbar ist. Das Callback-Skript ist der Grund, warum
    // das ohne Menschen geht: installAugmentations startet es nach dem Reset
    // von selbst (Singularity.ts:210 runAfterReset).
    // Zwei Bedingungen, nicht eine. Ein Einbau kostet alles, was nicht
    // Augmentierung ist: gekaufte Rechner (Prestige.ts:73), Programme, TOR,
    // das Hacking-Level. Der Wiederaufbau dauert eine gute Viertelstunde -
    // dafuer muessen genug Stuecke in der Warteschlange liegen UND darf
    // nichts Weiteres in Reichweite sein.
    // Die offenen Luecken, und der leere Fall AUSDRUECKLICH. Vorher stand
    // hier Math.min(Infinity, ...leer) - das ergibt Infinity, und die
    // Bedingung darunter las das als "die naechste Huerde ist unendlich weit"
    // und baute ein. Gemeint war aber "es gibt gar keine Huerde mehr", und
    // das ist ein anderer Zustand: Er kann auch heissen, dass alles Erreichbare
    // verdient und nur noch nicht bezahlt ist. Jetzt ist der leere Fall null
    // und wird eigens behandelt.
    const offeneLuecken = kandidaten
      .filter((k) => k.rep < k.repReq).map((k) => k.repReq - k.rep);
    const kleinsteLuecke = offeneLuecken.length ? Math.min(...offeneLuecken) : null;
    // VORAUSSCHAU, 22.08.2026. teuerstesVerdiente unten sieht nur, was schon
    // verdient ist - und genau deshalb sah der Bot am 22.08. keinen Grund
    // einzubauen, obwohl kein einziges Stueck mehr bezahlbar war: verdient war
    // nichts, also stand die Zahl auf null. Die kleinste Luecke betrug 1.494
    // Reputation, was nach "gleich geschafft" aussieht; das Stueck dahinter
    // kostete bei elf wartenden Augmentierungen aber 1,9^11 = 1.165 mal seinen
    // Grundpreis, also 11 Billionen bei 104 Milliarden Guthaben.
    // Der Bot haette acht Minuten Reputation erarbeitet, die der danach
    // ohnehin faellige Einbau wieder auf null setzt - Faktionsreputation
    // ueberlebt den Einbau nicht, nur Favor.
    // Deshalb hier derselbe Test auf das NAECHSTE Stueck statt nur auf die
    // schon verdienten. Fuer die Bewertung zaehlt der Preis, nicht die Naehe.
    const naechstes = kandidaten
      .filter((k) => k.rep < k.repReq)
      .sort((a, b) => (a.repReq - a.rep) - (b.repReq - b.rep))[0];
    const naechstesUnbezahlbar = !!naechstes && naechstes.preis > geld * 4;
    // "Nichts mehr offen" ist nur dann ein Einbaugrund, wenn auch nichts mehr
    // zu KAUFEN ist. Sonst baute der Bot ein, waehrend eine verdiente und
    // bezahlbare Augmentierung noch im Regal liegt - und die waere nach dem
    // Einbau wieder unerreichbar, weil die Faktionsreputation auf null faellt.
    const kaufbarJetzt = kandidaten.some((k) => k.rep >= k.repReq && geld >= k.preis);
    const nichtsMehrOffen = kleinsteLuecke === null && !kaufbarJetzt;
    // Der zweite Weg kann genauso zu sein wie der erste. Jede gekaufte
    // Augmentierung verteuert die naechste um Faktor 1,9
    // (AugmentationHelpers: getAugCost), bei drei Stueck in der Warteschlange
    // also fast das Siebenfache. Gemessen: Cranial Signal Processors Gen I war
    // verdient und kostete 480 Millionen bei 9 Millionen Guthaben. Der Einbau
    // setzt den Faktor zurueck, die Reputation bleibt - was jetzt unbezahlbar
    // ist, ist danach der Normalpreis.
    const teuerstesVerdiente = Math.max(0, ...kandidaten
      .filter((k) => k.rep >= k.repReq).map((k) => k.preis));
    // Faktor 4, nicht 10. Gemessen am laufenden Spiel: Eine verdiente
    // Augmentierung kostete 483 Millionen bei 65 Millionen Guthaben und einem
    // Zufluss von 557.000 je Minute - zwoelfeinhalb Stunden Warten. Ein
    // Einbau kostet dagegen rund eine halbe Stunde Wiederaufbau und setzt den
    // Preisfaktor 1,9 je wartendem Stueck auf eins zurueck, womit dieselbe
    // Augmentierung wieder ihren Grundpreis kostet. Ab etwa dem Vierfachen
    // des Guthabens ist Warten das schlechtere Geschaeft.
    const geldWegZu = teuerstesVerdiente > geld * 4;

    // TUERSCHLOSS, 22.08.2026 umgedreht. Vorher stand hier
    // fileExists("data/install-frei.txt") - eine Freigabedatei, die KEIN
    // Skript je geschrieben hat. Der Einbau war damit dauerhaft gesperrt,
    // und weil der Hacking-Multiplikator ausschliesslich aus eingebauten
    // Augmentierungen kommt, stand das eigentliche Ziel des ganzen Laufs
    // still: drei Stuecke lagen in der Warteschlange, m blieb bei 1,385,
    // und Level 9000 braucht bei diesem m rund 10^91 Erfahrung.
    // Jetzt sperrt eine Datei, statt freizugeben - wer den Einbau anhalten
    // will, legt data/install-sperre.txt an. Ein vergessenes Schloss haelt
    // dann den Bot nicht mehr auf, sondern hoechstens eine Sperre offen,
    // und das faellt sofort auf.
    // Zwei Sorten Sperre in einer Datei. Ein Mensch schreibt einen Text ohne
    // Zeitstempel - der gilt, bis er sie loescht. Die Firmenphase schreibt
    // "FIRMENPHASE <Firma>|<ms>" und erneuert das alle 15 Sekunden; stirbt
    // sie, verfaellt die Sperre nach fuenf Minuten von selbst. Ohne diesen
    // Verfall waere eine abgestuerzte Firmenphase gleichbedeutend mit einem
    // Bot, der nie wieder einbaut - und der Einbau ist das einzige, was den
    // Multiplikator hebt.
    const lockInhalt = liesVonHome(INSTALL_LOCK_FILE);
    let gesperrt = false;
    if (lockInhalt) {
      const lockStempel = Number(lockInhalt.split("|")[1]);
      gesperrt = !Number.isFinite(lockStempel)
        || Date.now() - lockStempel < INSTALL_LOCK_MAX_AGE;
      if (!gesperrt) {
        loeschAufHome(INSTALL_LOCK_FILE);
        sag("Einbausperre war ueber fuenf Minuten alt - aufgehoben.");
      }
    }
    if (wartend >= MINDEST_WARTESCHLANGE
        && ((kleinsteLuecke !== null && kleinsteLuecke > LUECKE_ZU_GROSS)
            || nichtsMehrOffen || geldWegZu || naechstesUnbezahlbar)
        && !gesperrt) {
      sag("EINBAU: " + wartend + " Augmentierungen. Grund: "
        + (geldWegZu ? "naechstes Stueck kostet "
            + Math.round(teuerstesVerdiente / 1e6) + "m bei "
            + Math.round(geld / 1e6) + "m Guthaben"
          : naechstesUnbezahlbar ? "naechstes Stueck (" + naechstes.aug + ") kostet "
              + Math.round(naechstes.preis / 1e6) + "m bei "
              + Math.round(geld / 1e6) + "m Guthaben - Arbeit daran waere vergeblich"
          : nichtsMehrOffen ? "nichts mehr offen in den beigetretenen Faktionen"
          : "naechste Huerde erst in " + Math.round(kleinsteLuecke) + " Reputation") + ". "
        + "bn4life.js startet danach von selbst.");
      await ns.sleep(1500);
      ns.singularity.installAugmentations("bn4life.js");
      return;   // ab hier laeuft dieses Skript ohnehin nicht mehr
    }

    // --- 2. Kaufen, was bezahlt und verdient ist ------------------------------
    let gekauft = 0;
    // ABSTEIGEND, nicht aufsteigend (22.08.2026). Jedes gekaufte Stueck
    // verteuert JEDES weitere um Faktor 1,9 (AugmentationHelpers getAugCost) -
    // der Aufschlag haengt an der Zahl der schon wartenden Stuecke, nicht am
    // Stueck selbst. Wer zuerst billig kauft, zahlt das teure Stueck danach
    // mit dem vollen Aufschlag; wer zuerst teuer kauft, zahlt den Aufschlag
    // auf die billigen. Bei vier Stueck und Preisen wie 900m/475m/343m/100m
    // sind das rund 1,2 Milliarden Unterschied fuer dieselbe Ausbeute.
    // Der Rest der Schleife bleibt: was gerade nicht bezahlbar ist, wird
    // uebersprungen und in der naechsten Runde erneut versucht.
    for (const k of kandidaten.slice().sort((a, b) => b.preis - a.preis)) {
      if (k.rep < k.repReq) continue;
      if (ns.getServerMoneyAvailable("home") < k.preis) continue;
      if (ns.singularity.purchaseAugmentation(k.faktion, k.aug)) {
        sag("GEKAUFT: " + k.aug + " von " + k.faktion + " fuer " + geldText(k.preis) + ".");
        gekauft++;
      }
    }
    if (gekauft) { await ns.sleep(2000); continue; }   // Preise haben sich verschoben

    // Geldbedarf nach home melden. bn4net.js kauft sonst Rechner von dem Geld,
    // das hier fuer eine bereits verdiente Augmentierung gebraucht wird - und
    // Augmentierungen sind dauerhafter Fortschritt, Rechenzeit ist es nicht.
    // Der Umweg ueber scp ist noetig, weil dieses Skript auf der Werkbank
    // laeuft und ns.write nur lokal schreibt.
    // Steht seit dem 22.08.2026 VOR der Arbeitsentscheidung statt danach: In
    // der Firmenphase und bei leerer Zielliste wurde die Meldung sonst gar
    // nicht mehr geschrieben, und bn4net haette das Kaufgeld verbaut.
    const bedarf = kandidaten
      .filter((k) => k.rep >= k.repReq)
      .reduce((n, k) => n + k.preis, 0);
    ns.write("data/geldbedarf.txt", String(Math.round(bedarf)), "w");
    if (ns.getHostname() !== "home") ns.scp("data/geldbedarf.txt", "home", ns.getHostname());

    // --- 2b. Firmenphase (M4) -------------------------------------------------
    // Firmenarbeit und Faktionsarbeit schliessen einander aus: Player hat genau
    // EINE laufende Arbeit, und workForCompany ersetzt eine laufende
    // Faktionsarbeit kommentarlos. Deshalb ist das hier eine Weiche und kein
    // Nebenlaeufer - und deshalb steht sie in bn4rep.js und nicht in einem
    // eigenen Skript: Zwei Skripte, die beide die Figur an die Arbeit
    // schicken, sind derselbe Fehler wie ein commitCrime auf laufende Arbeit.
    if (companyTarget) {
      // KEINE Bremse, bevor die Stelle steht. Genau andersherum stand es bis
      // eben, und das war der schlimmere Fehler von beiden: Scheitert die
      // Bewerbung (Hacking unter 225, der Normalzustand direkt nach einem
      // Einbau), faellt die Phase durch, Abschnitt 3 findet nichts zu tun und
      // schlaeft - waehrend die Bremse in jeder Runde erneuert wird und
      // bn4life deshalb nie ein Verbrechen startet. Die Figur haette bei
      // einem erzwungenen Auftrag bis zum Fristende voellig stillgestanden.
      // Die Bremse wird jetzt erst gesetzt, wenn tatsaechlich gearbeitet wird.

      // Nur EINE Anstellung halten - dieselbe Hygiene wie oben, und aus
      // demselben Grund: Die Vertragsbelohnung "Firmenreputation" geht an eine
      // ZUFAELLIG gewaehlte Firma aus Player.jobs
      // (PlayerObjectGeneralMethods.ts:539-555). Wieviel das ausmacht, ist
      // ungemessen; dass es sich nicht auf zwei Firmen verteilen soll, ist
      // trotzdem klar.
      for (const c of COMPANIES) {
        if (c === companyTarget) continue;
        if (!ns.getPlayer().jobs[c]) continue;
        ns.singularity.quitJob(c);
        sag("Gekuendigt bei " + c + " - Vertragsreputation soll ganz auf "
          + companyTarget + " gehen.");
      }

      const companyRep = ns.singularity.getCompanyRep(companyTarget);
      // ns.getPlayer().jobs ist frei - der Aufruf ist ohnehin bezahlt. Eine
      // eigene Abfrage waere 2 GB fuer nichts.
      let job = ns.getPlayer().jobs[companyTarget] || null;

      // Bewerben. applyForJob klettert die Leiter von SELBST so weit hoch,
      // wie die Werte reichen (PlayerObjectGeneralMethods.ts:325-329) und gibt
      // ein Result-Objekt zurueck (:304/342/347); erst der Singularity-Mantel
      // macht daraus null statt einer Ausnahme (Singularity.ts:697-706). Der
      // Aufruf ist damit zugleich Bewerbung und Befoerderung und darf in jeder
      // Runde stehen - auch die schon erreichte Hoechststelle antwortet nur
      // mit null.
      //
      // KEINE REISE. Weder applyForJob noch workForCompany pruefen die Stadt
      // (PlayerObjectGeneralMethods.ts:300-352, Singularity.ts:662-708). Der
      // Abschlussplan rechnet fuer OmniTek mit einer Reise nach Volhaven; die
      // ist ueber Singularity nicht noetig, und sie zu unterlassen erspart
      // zugleich das Risiko, die Aevum-Mitgliedschaft anzufassen.
      const newJob = ns.singularity.applyToCompany(companyTarget, COMPANY_FIELD);
      if (newJob && newJob !== job) {
        sag("ANGESTELLT bei " + companyTarget + " als " + newJob
          + " (Firmenreputation " + Math.round(companyRep) + ").");
        job = newJob;
      }

      if (!job) {
        // Das ist der Zustand direkt nach einem Augmentierungs-Einbau:
        // Player.jobs wird geleert (PlayerObjectGeneralMethods.ts:107), und
        // das Hackinglevel faellt auf etwa den Multiplikator zurueck - IT
        // Intern verlangt aber 1+224 = 225. Bis das Level wieder da ist, gibt
        // es keine Firmenarbeit; dann ist Faktionsarbeit besser als Nichtstun.
        // Ohne diesen Ausgang haette der Bot nach jedem Einbau stundenlang
        // vergeblich Bewerbungen geschrieben.
        sag("Keine Stelle bei " + companyTarget + " (Hacking "
          + ns.getPlayer().skills.hacking + ", noetig 225) - zurueck zur Faktionsarbeit.");
        companyTarget = null;
        // Aufraeumen, was die Phase gesetzt haben koennte. Ohne das bliebe
        // eine Bremse aus einer frueheren Runde liegen und bn4life duerfte
        // kein Verbrechen begehen, obwohl niemand arbeitet.
        loeschAufHome("data/rep-modus.txt");
        const lock = liesVonHome(INSTALL_LOCK_FILE);
        if (lock.startsWith(INSTALL_LOCK_TAG)) loeschAufHome(INSTALL_LOCK_FILE);
      } else {
        // Jetzt erst die Bremse - die Stelle steht, gearbeitet wird gleich.
        // Format wie bei der Faktionsarbeit (Name|Zeitstempel), weil
        // bn4life.js genau daraus den Zeitstempel liest und nichts weiter.
        schreibNachHome("data/rep-modus.txt", companyTarget + "|" + Date.now());

        // Und die Einbausperre. Ein Einbau mitten in der Firmenphase wuerde
        // company.playerReputation auf null setzen (Company.ts:77-80) - bis zu
        // 400.000 muehsam erarbeitete Firmenreputation, dazu die Anstellung
        // selbst (Player.jobs = {}), und danach faengt die Phase bei Hacking
        // ~m von vorn an. Der Zeitstempel laesst die Sperre verfallen, falls
        // dieses Skript stirbt.
        schreibNachHome(INSTALL_LOCK_FILE,
          INSTALL_LOCK_TAG + " " + companyTarget + "|" + Date.now());

        const arbeitJetzt = ns.singularity.getCurrentWork();
        // Nicht ueber isBusy pruefen, sondern ueber das, was tatsaechlich
        // laeuft - dieselbe Falle wie beim Verbrechen in bn4life.js.
        if (!arbeitJetzt || arbeitJetzt.companyName !== companyTarget) {
          if (ns.singularity.workForCompany(companyTarget, true)) {
            sag("Arbeite fuer " + companyTarget + " als " + job + ": "
              + Math.round(companyRep) + " von " + COMPANY_REP_GOAL + " Firmenreputation.");
          }
        }

        // Messfaden nach draussen. Firmenreputation ist die einzige Groesse
        // dieses Plans, die nie gemessen wurde - deshalb wird hier nicht nur
        // der Stand, sondern auch die Rate aus zwei Proben geschrieben.
        ns.write("data/bn4job.json", JSON.stringify({
          zeit: Date.now(),
          company: companyTarget,
          job,
          companyRep,
          companyFavor: ns.singularity.getCompanyFavor(companyTarget),
          goal: COMPANY_REP_GOAL,
          hacking: ns.getPlayer().skills.hacking,
          charisma: ns.getPlayer().skills.charisma,
          forced: orderActive,
          forcedUntil: orderActive ? Number(orderUntil) : 0,
        }), "w");
        if (ns.getHostname() !== "home") ns.scp("data/bn4job.json", "home", ns.getHostname());
        await ns.sleep(15000);
        continue;
      }
    }

    // --- 3. Sonst: an der naechsterreichbaren Huerde arbeiten -----------------
    // Die kleinste Luecke zuerst. Wer am teuersten Ziel arbeitet, hat lange
    // gar nichts; wer am naechsten arbeitet, kauft frueh und oft.
    // Nach Nutzen je Aufwand, nicht nach blosser Erreichbarkeit. Die alte
    // Regel "kleinste Luecke zuerst" hat den Bot fuenfundvierzig Minuten an
    // "Augmented Targeting I" arbeiten lassen - einer Kampf-Augmentierung, die
    // fuer Hacking 9000 nichts beitraegt.
    //
    // Der Summand 0.15 sorgt dafuer, dass nutzlose Stuecke nicht voellig
    // liegenbleiben: Daedalus verlangt 30 VERSCHIEDENE Augmentierungen
    // (BitNodeMultipliers.ts:61), und ohne Daedalus gibt es keine Red Pill und
    // damit keinen Zugang zu w0r1d_d43m0n. Sie sind also nicht wertlos, nur
    // nachrangig.
    // Zweistufig statt gewichtet. Eine gemeinsame Guetezahl aus Nutzen und
    // Luecke hat nicht getragen: Bei einer Luecke von 2.800 gegen 20.000
    // gewinnt das nahe Ziel auch dann, wenn es nichts beitraegt. Deshalb eine
    // klare Rangordnung - erst alles, was Hacking staerkt, und darunter nach
    // Naehe; der Rest kommt nur dran, wenn nichts Nuetzliches erreichbar ist.
    //
    // Ganz weglassen darf man den Rest nicht: Daedalus verlangt 30
    // VERSCHIEDENE Augmentierungen, und ohne Daedalus gibt es keine Red Pill
    // und keinen Zugang zu w0r1d_d43m0n.
    // 22.08.2026 ERSETZT. Die zweistufige Rangordnung war unter einer
    // Annahme richtig, die nicht mehr gilt: dass nuetzliche und nutzlose
    // Stuecke aehnlich teuer sind. Am laufenden Spiel gemessen sind sie es
    // nicht. Der Bot arbeitete The Black Hand auf 50.000 Rep fuer EIN Stueck,
    // waehrend bei Netburners SECHS Stueck zwischen 1.875 und 12.500 Rep
    // lagen - Faktor 4 bis 27 je gezaehlter Augmentierung. Weil immer noch 19
    // nuetzliche Stuecke offen waren, kam die zweite Stufe nie an die Reihe.
    //
    // Jetzt eine gemeinsame Guetezahl: Reputationskosten je Fortschritt.
    // Fortschritt ist zweierlei, und beides zaehlt fuer den Knotenabschluss:
    //   - ein Zaehlplatz Richtung der 30 verschiedenen Augmentierungen, die
    //     Daedalus verlangt (ohne Daedalus keine Red Pill, kein Zugang zu
    //     w0r1d_d43m0n)
    //   - der Hacking-Multiplikator, der das Level ueberhaupt erreichbar macht
    //
    // Der Zaehlplatz faellt weg, sobald die 30 zusammen sind - danach ist eine
    // Augmentierung ohne Multiplikator wirklich wertlos, und die Rangfolge
    // kippt von selbst auf reinen Nutzen zurueck. Genau das war der berechtigte
    // Kern der alten Regel.
    //
    // NUTZEN_GEWICHT 5: hackNutzen liefert den Multiplikator minus eins, also
    // typisch 0,15 bis 0,30. Mal fuenf wiegt ein durchschnittliches nuetzliches
    // Stueck damit etwa so schwer wie ein Zaehlplatz. Das ist eine Setzung,
    // keine Messung - sie sagt aus, dass beide Wege zum Knotenabschluss
    // ungefaehr gleich wichtig sind.
    const NUTZEN_GEWICHT = 5;
    const zaehlplatzWert = alleAugs.length < 30 ? 1 : 0;
    const guete = (k) => (zaehlplatzWert + NUTZEN_GEWICHT * Math.max(0, hackNutzen(k.aug))) / Math.max(1, k.repReq - k.rep);
    const alleOffenen = kandidaten.filter((k) => k.rep < k.repReq);
    const offen = alleOffenen.sort((a, b) => guete(b) - guete(a));

    if (!offen.length) { await ns.sleep(20000); continue; }

    const ziel = offen[0];

    // --- Spendenweg, sobald eine Faktion Favor 150 hat ------------------------
    // Ab dieser Marke bringt Geld direkt Reputation:
    //     rep = betrag / 1e6 * mults.faction_rep     (Faction/formulas/donation.ts)
    // Fuer einen Bot, der Hunderttausende je Minute aus Coding Contracts zieht
    // und dessen Engpass die Reputation ist, kehrt das die Wirtschaft um:
    // Zeit wird durch Geld ersetzbar. Solange keine Faktion so weit ist, bleibt
    // es bei der Arbeit - der Aufruf waere sonst nur ein teurer Fehlschlag.
    if (favor[ziel.faktion] >= ns.getFavorToDonate()) {
      const uebrig = ns.getServerMoneyAvailable("home") - teuerstesVerdiente;
      if (uebrig > 1e9) {
        if (ns.singularity.donateToFaction(ziel.faktion, uebrig)) {
          sag("GESPENDET: " + Math.round(uebrig / 1e6) + "m an " + ziel.faktion
            + " (Favor " + Math.round(favor[ziel.faktion]) + ").");
          await ns.sleep(1000);
          continue;
        }
      }
    }

    const arbeit = ns.singularity.getCurrentWork();
    const arbeitetSchon = arbeit && arbeit.factionName === ziel.faktion;

    // Die Bremse in JEDER Runde erneuern, nicht nur beim Arbeitsbeginn. Sonst
    // fehlt sie nach einem Neustart dieses Skripts genau dann, wenn die Arbeit
    // schon laeuft - und bn4life.js schiebt wieder Verbrechen dazwischen.
    ns.write("data/rep-modus.txt", ziel.faktion + "|" + Date.now(), "w");
    if (ns.getHostname() !== "home") ns.scp("data/rep-modus.txt", "home", ns.getHostname());

    if (!arbeitetSchon) {
      // Bremse VOR dem Arbeitsbeginn setzen, nicht danach: Zwischen Start und
      // Datei liegt sonst ein Fenster, in dem bn4life ein Verbrechen
      // dazwischenschiebt.
      // ns.write schreibt LOKAL. Dieses Skript laeuft auf der Werkbank, die
      // Bremse muss aber auf home liegen - dort sucht bn4life.js sie. Ohne das
      // scp lag die Datei auf dem falschen Rechner, die Bremse griff nie, und
      // jede Sekunde ersetzte ein commitCrime die Faktionsarbeit. Messbar an
      // der Reputationsrate: 45 statt 190 je Minute.
      ns.write("data/rep-modus.txt", ziel.faktion + "|" + Date.now(), "w");
      if (ns.getHostname() !== "home") ns.scp("data/rep-modus.txt", "home", ns.getHostname());
      await ns.sleep(1200);
      const typen = ns.singularity.getFactionWorkTypes(ziel.faktion);
      const art = typen.includes("hacking") ? "hacking"
        : typen.includes("field") ? "field" : typen[0];
      if (ns.singularity.workForFaction(ziel.faktion, art, true)) {
        sag("Arbeite fuer " + ziel.faktion + " (" + art + ") auf "
          + "[Nutzen " + hackNutzen(ziel.aug).toFixed(2) + "] "
          + ziel.aug + ": " + Math.round(ziel.rep) + " von "
          + Math.round(ziel.repReq) + " Reputation.");
      } else {
        sag("workForFaction(" + ziel.faktion + ", " + art + ") abgelehnt.");
        try { ns.rm("data/rep-modus.txt", "home"); } catch { /* lag nie dort */ }
      }
    }

    // Summe ueber alle Faktionen. Die Reputation des aktuellen Ziels taugt
    // nicht zur Fortschrittsmessung: Sie springt bei jedem Zielwechsel zurueck,
    // und die Ueberwachung meldete deshalb negative Raten, obwohl der Bot
    // fleissig war. Die Summe faellt nur beim Einbau, und der ist ein
    // Fortschritt, kein Stillstand.
    const repGesamt = spieler.factions
      .reduce((n, f) => n + ns.singularity.getFactionRep(f), 0);

    ns.write("data/bn4rep.json", JSON.stringify({
      zeit: Date.now(),
      repGesamt,
      favor,
      favorBeste,
      favorBesteFaktion,
      spendenSchwelle: ns.getFavorToDonate(),
      faktionen: spieler.factions,
      ziel: ziel.aug,
      zielFaktion: ziel.faktion,
      rep: Math.round(ziel.rep),
      repReq: Math.round(ziel.repReq),
      preis: ziel.preis,
      offen: offen.length,
      kaufbereit: kandidaten.filter((k) => k.rep >= k.repReq).length,
      wartend,
      teuerstesVerdiente,
      bedarf,
      geld,
    }), "w");
    if (ns.getHostname() !== "home") ns.scp("data/bn4rep.json", "home", ns.getHostname());
   } catch (e) {
    sag("RUNDENFEHLER: " + String(e));
   }
   await ns.sleep(15000);
  }
}
