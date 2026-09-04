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
import { hackNutzen, levelNutzen, combatNutzen } from "lib/hackaugs.js";

// Zeitstempel der letzten "Faktionsarbeit ausgesetzt"-Meldung. Modulweit,
// weil die Meldung sonst jede Runde kaeme (alle 16 s) - siehe die Korrektur
// weiter unten bei `bladeSperreArbeit()`.
let bladeSperreGemeldet = 0;

import { lage as endspurtLage, einbauErlaubt } from "lib/endspurt.js";
import { beantrage as figBeantrage, darf as figDarf } from "lib/figurns.js";
import { PRIO as FIG_PRIO } from "lib/figur.js";
import { handschlag } from "lib/handschlag.js";

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

  // BLADEBURNER-KNOTEN: EINE STELLE, NICHT FUENF (29.08.2026, 09:10).
  //
  // Bis heute stand `n === 6 || n === 7` an vier Stellen in dieser Datei und
  // an drei weiteren in tools/. Beim Wechsel nach BitNode 10 am 28.08. wurde
  // die 10 an keiner davon ergaenzt - am 29.08. um 04:15 baute der Bot
  // deshalb acht Augmentierungen zwei Stunden vor dem Divisionsbeitritt ein
  // und warf 90.810 Erfahrung weg, rund 6,6 Stunden.
  //
  // Die Liste steht jetzt an genau einer Stelle. Wer einen Kampfknoten
  // ergaenzt, aendert diese Zeile - und nichts sonst.
  // DAS VERFAHREN KOMMT AUS DER ROUTE, NICHT AUS EINER LISTE (02.09.2026).
  //
  // Hier stand `BLADE_KNOTEN = [6, 7, 10]`. ausgang.js legt je Runde
  // data/verfahren.txt auf home ab: "V2 10 2" = Verfahren, Knoten, Stufe
  // dieses Laufs - abgeleitet aus route.json und ns.getResetInfo(). Die
  // Route faehrt Bladeburner in acht Knoten, die in der Liste nie standen
  // (4, 9, 2, 3, 11, 13, 14, 15).
  //
  // RUECKFALL IST V2, NICHT DIE LISTE (Skeptiker 02.09.). Fehlt die Datei
  // oder stammt sie aus einem anderen Knoten, laeuft ausgang.js nicht - dann
  // soll bn4rep dasselbe annehmen wie bn4net (das blade.js und bbtrain in
  // dem Fall startet): Kampfknoten, also Einbausperre vor dem Beitritt und
  // keine Faktionsarbeit. Zwei verschiedene Rueckfaelle waren der Vorfall vom
  // 25.08. (Faktionsarbeit gegen Bladeburner-Aktion im Sekundentakt) in
  // acht neuen Knoten.
  const bladeburnerTraegtHier = () => {
    try {
      const knoten = ns.getResetInfo().currentNode;
      if (ns.fileExists("data/verfahren.txt", "home")) {
        if (ns.getHostname() !== "home") ns.scp("data/verfahren.txt", ns.getHostname(), "home");
        const teile = ns.read("data/verfahren.txt").trim().split(/\s+/);
        if (Number(teile[1]) === knoten && (teile[0] === "V1" || teile[0] === "V1b")) return false;
      }
      return true;
    }
    catch { return true; }   // kein Zugriff heisst: vorsichtig sein, also Kampfknoten
  };

  // Der Ausgangsschluessel. Steht HIER OBEN und nicht bei einzelWert weiter
  // unten, weil der Endspiel-Riegel ihn rund zweihundert Zeilen frueher
  // braucht - ein const-Zugriff von dort landete in der temporalen Totzone
  // und warf "Cannot access EXIT_KEY before initialization" in jeder Runde.
  // Genau das ist am 23.08.2026 passiert, zwei Minuten lang.
  //
  // Der Wert 10 ist eine Setzung: The Red Pill hat keine Statistikwerte
  // (Augmentations.ts:1946-1953) und faellt durch jede Nutzenrechnung, ist
  // aber das Stueck, ohne das w0r1d_d43m0n nicht am Netz haengt. 10
  // entspricht dem Gewicht des gesamten uebrigen Daedalus-Angebots -
  // absichtlich nicht unendlich, weil der Ausgang auch Hacking 9000
  // verlangt und das nur ueber Multiplikatoren kommt, also ueber Einbauten.
  const EXIT_KEY = "The Red Pill";
  const EXIT_KEY_VALUE = 10;

  // Das Hacking-Level, das der Knoten am Ende verlangt: 3000 mal
  // WorldDaemonDifficulty (Server/data/servers.ts:1536, ServerHelpers.ts:384).
  // Solange w0r1d_d43m0n nicht am Netz haengt - also vor dem Einbau von
  // The Red Pill - laesst er sich nicht abfragen, deshalb die Tabelle aus
  // BitNode.tsx. BitNode 12 skaliert mit der Knotenstufe und faellt auf den
  // Standardwert 2 zurueck; das ist dort ohnehin nur eine Schaetzung fuer die
  // Rangfolge, kein Grenzwert.
  // BitNode 8 fehlt in BitNode.tsx, gilt also mit dem Vorgabewert 1 - hier
  // stand faelschlich 2. BitNode 12 skaliert mit der Knotenstufe und faellt
  // ebenfalls auf 1 zurueck; das ist dort nur eine Schaetzung fuer die
  // Rangfolge, kein Grenzwert.
  // FactionWorkRepGain je BitNode - nur die Knoten, die ihn ueberhaupt setzen
  // (BitNode.tsx), alle uebrigen lassen ihn bei 1. Steht HIER OBEN, weil die
  // Einbau-Schwelle ihn 450 Zeilen frueher braucht als die Spendenrechnung;
  // eine const-Definition weiter unten landete in der temporalen Totzone.
  // Das ist am 23.08.2026 dreimal passiert, jedes Mal mit demselben Muster.
  const FACTION_REP_GAIN = { 2: 0.5, 4: 0.75, 13: 0.6, 14: 0.2 };

  const WD_DIFFICULTY = { 1: 1, 2: 5, 3: 2, 4: 3, 5: 1.5, 6: 2, 7: 2, 8: 1,
    9: 2, 10: 2, 11: 1.5, 12: 1, 13: 3, 14: 5, 15: 2 };
  const zielLevel = (() => {
    try {
      if (ns.serverExists("w0r1d_d43m0n")) {
        const r = ns.getServer("w0r1d_d43m0n").requiredHackingSkill;
        if (r > 0) return r;
      }
    } catch (e) { /* haengt noch nicht am Netz */ }
    // Der Knoten selbst weiss es genauer als die Tabelle - BitNode 12
    // skaliert mit 1,02^Stufe (BitNode.tsx:993). Tabelle nur als Rueckfall.
    try {
      const wd = Number(ns.getBitNodeMultipliers().WorldDaemonDifficulty);
      if (wd > 0) return 3000 * wd;
    } catch { /* kein Zugriff */ }
    return 3000 * (WD_DIFFICULTY[ns.getResetInfo().currentNode] || 2);
  })();

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
  // Reihenfolge nach dem, was hinter der Faktion liegt - gerechnet mit
  // levelNutzen bei Multiplikator 9,13 und Ziel 9000:
  //
  //   ECorp    PC Direct-Neural Interface 2,41 + Optimization Submodule 3,08
  //   NWO      Xanipher 5,28 (hacking 1,20 UND hacking_exp 1,15)
  //   Blade    PC Direct-Neural Interface 2,41
  //
  // Fulcrum ist NICHT dabei, aus zwei Gruenden: Die Faktion heisst "Fulcrum
  // Secret Technologies", die Firma aber "Fulcrum Technologies" (Company und
  // Faction Enums.ts) - die Gleichsetzung von Firmen- und Faktionsnamen, auf
  // der die Pruefung `spieler.factions.includes(c)` beruht, gilt dort nicht.
  // Und die Faktion verlangt ohnehin keine Firmenreputation, sondern eine
  // Backdoor auf fulcrumassets. Ihr wertvollstes Stueck (Optimization
  // Submodule) liegt zudem auch bei ECorp.
  //
  // Zusammen rund 14 Punkte, also fast das Dreifache von nextSENS. Alle vier
  // bieten daneben dieselbe ENM-Kette wie Daedalus an - die zaehlt hier
  // nicht, sie ist ueber Daedalus ohnehin erreichbar.
  //
  // Der Umweg kostet je Firma rund 300.000 Firmenreputation (400.000 mal dem
  // Backdoor-Rabatt), bei gemessenen 110 rep/s also etwa 45 Minuten. Die
  // Einladung ueberlebt jeden Einbau (keepOnInstall), es ist eine einmalige
  // Investition je BitNode.
  //
  // Der Bot geht sie NICHT stur der Reihe nach durch: Die Firmenphase startet
  // nur, wenn keine naehere nuetzliche Augmentierung offen ist (COMPANY_GAP).
  const COMPANIES = ["Clarke Incorporated", "OmniTek Incorporated",
    "ECorp", "NWO", "Blade Industries"];
  // ACHTUNG, das sind NICHT immer 400.000: calculateEffectiveRequiredReputation
  // (Company/utils.ts:15-19) multipliziert die verlangte Reputation mit
  // CONSTANTS.CompanyRequiredReputationMultiplier = 0,75, sobald auf dem
  // FIRMENSERVER eine Backdoor liegt. Mit Backdoor genuegen also 300.000.
  //
  // Am 23.08.2026 aufgefallen, weil die Clarke-Einladung schon bei 302.063
  // kam, waehrend die Anzeige weiter 400.000 als Ziel auswies. Ein Leerlauf
  // war das NICHT: Der Ausstieg aus der Firmenphase haengt an der
  // Mitgliedschaft (spieler.factions.includes), nicht an dieser Zahl - der
  // Bot hat im selben Zyklus gekuendigt. Die Zahl ist reine Telemetrie, aber
  // eine falsche Telemetrie laedt zu falschen Schluessen ein, und genau das
  // ist hier passiert. Beide Firmenserver sind laengst gerootet und mit
  // Backdoor versehen, der Rabatt ist also der Normalfall.
  const COMPANY_SERVER = {
    "Clarke Incorporated": "clarkinc",
    "OmniTek Incorporated": "omnitek",
    "ECorp": "ecorp",
    "NWO": "nwo",
    "Blade Industries": "blade",
  };
  const companyRepGoal = (firma) => {
    const host = COMPANY_SERVER[firma];
    let rabatt = false;
    try { rabatt = !!ns.getServer(host).backdoorInstalled; } catch (e) { rabatt = false; }
    return 400e3 * (rabatt ? 0.75 : 1);
  };

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

  // ZEIT STATT REPUTATION (23.08.2026). Hier stand 15.000 Reputation, mit dem
  // Kommentar "bei ~40/min ueber sechs Stunden". Die Rate ist inzwischen
  // 40 bis 190 je SEKUNDE - die Konstante war um Faktor 63 veraltet, und
  // 15.000 Reputation sind heute anderthalb bis sechs Minuten. Die Bedingung
  // "naechste Huerde zu weit weg, also lieber einbauen" war damit praktisch
  // immer wahr.
  //
  // Der Sinn der Regel ist eine Zeitaussage, keine Reputationsaussage:
  // Lohnt es sich noch zu warten, oder holt ein Einbau mehr heraus? Deshalb
  // steht hier jetzt die Zeit, und die Reputationsschwelle wird daraus
  // gerechnet.
  const LUECKE_ZU_GROSS_MINUTEN = 45;

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
  // Drossel fuer die Endspiel-Meldung: alle fuenf Minuten genuegt, sonst
  // fuellt sie bei 15-Sekunden-Runden das Log.
  let letzteAusgangsmeldung = 0;
  let letzteBladeMeldung = 0;
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

  // Hier stand `rufeMenschen` - der Notruf nach draussen ueber
  // data/hilfe.txt. Seit dem 02.09.2026 hat er keinen Aufrufer mehr: Der
  // Ausgang wohnt in ausgang.js und kennt keinen Zustand, in dem ein Mensch
  // gebraucht wird; die Leitung (tools/wache.js, ntfy) ist seit 31.08. aus.

  const geldText = (n) => {
    for (const [t, k] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
      if (Math.abs(n) >= t) return "$" + (n / t).toFixed(2) + k;
    }
    return "$" + n.toFixed(0);
  };

  // Ein liegengebliebener Notruf aus einem frueheren Lauf ist Laerm: Der
  // Waechter meldet ihn stuendlich weiter, obwohl die Lage laengst bereinigt
  // ist - und ein NEUER Notruf kaeme wegen der Drosselung erst eine Stunde
  // spaeter durch. Beim Start ist die Leitung deshalb frei.
  loeschAufHome("data/hilfe.txt");

  // Traegt in diesem Knoten die Division statt der Reputation? inBladeburner()
  // kostet 0 GB (RamCostGenerator.ts), die Abfrage ist also gratis.
  // ZWEI LUECKEN, BEIDE AM 29.08.2026 UM 05:45 GEMESSEN.
  //
  // 1. Die 10 fehlte. Fuenfte Fundstelle derselben Klasse in dieser Nacht
  //    (vorher: strategie-check 856 und 492, wache 780, bn4rep 683/904/1396).
  // 2. `inBladeburner()` machte die Sperre erst NACH dem Beitritt scharf.
  //    Davor traegt aber das Gym, und Faktionsarbeit bricht ein Gym-Training
  //    genauso ab wie eine Bladeburner-Aktion.
  //
  // Gemessen 05:08 bis 05:37: `currentWork` war FactionWork (CyberSec,
  // hacking), die Kampferfahrung stieg um **22 je Minute** statt der 230 vom
  // Vortag. Der Restweg von 221.844 Erfahrung braucht damit 168 Stunden statt
  // 16. Die Reputationsarbeit selbst ist in diesem Knoten ohnehin verworfen
  // (`nodes/ERLEDIGT.md`, 22:52: Gym allein 14,7 h gegen 23,5 h mit
  // Augmentierungsrunde).
  //
  // In einem Kampfknoten wird also gar nicht mehr fuer Faktionen gearbeitet -
  // weder vor noch nach dem Beitritt. bn4rep behaelt alles andere: Kaufen und
  // Einbauen brauchen keine Arbeit, nur Geld und vorhandene Reputation.
  const bladeSperreArbeit = bladeburnerTraegtHier;

  // --- Die Figur-Wache (Position C.11) --------------------------------------
  //
  // `workForFaction` und `workForCompany` beenden jede laufende Arbeit der
  // Figur - auch einen Graft, der bis zu 14,63 Mrd gekostet hat und erst mit
  // dem letzten Prozent etwas wert ist. Der Kern entscheidet, wer darf
  // (bn4net.js, Abschnitt 9a); hier wird beantragt und nachgesehen.
  //
  // Der Antrag wird in JEDEM Aufruf erneuert. Er laeuft nach einer Minute ab -
  // ein Gewerk, das nicht mehr laeuft, gibt die Figur damit von selbst frei,
  // ohne dass jemand aufraeumen muss.
  let figSeq = null;
  let figGrundLetzt = null;
  const figFrei = (aktion, detail, grund) => {
    figBeantrage(ns, "bn4rep.js", FIG_PRIO.faktion, aktion, detail, grund);
    const w = figDarf(ns, "bn4rep.js", figSeq);
    if (w.seq !== null) figSeq = w.seq;
    if (w.darf) { figGrundLetzt = null; return true; }
    if (figGrundLetzt !== w.grund) {
      sag("Figur nicht frei: " + w.grund + " - Arbeit ausgesetzt.");
      figGrundLetzt = w.grund;
    }
    return false;
  };

  // WAS DIE REPUTATION WIRKLICH KOSTET, WIRD GEMESSEN (27.08.2026, 09:50).
  //
  // `repPerSecond` unten rechnet die Rate aus den Stats des Spielers, also aus
  // der Annahme, er ARBEITE fuer die Faktion. In BitNode 6 tut er das nicht -
  // `bladeSperreArbeit()` haelt ihn bei der Division, und die Reputation kommt
  // passiv herein (Bladeburner-Rang, Coding Contracts). Gemessen 08:50 gegen
  // 09:47, 57 Minuten:
  //
  //     Aevum        15.726 -> 17.671   34 rep/min      Formel: rund 543
  //     Sector-12    14.941 -> 17.011   36 rep/min
  //     CyberSec     22.115 -> 24.063   34 rep/min
  //     Bladeburners  4.580 ->  5.665   19 rep/min      Formel: rund 335
  //     Slum Snakes     655 ->    820    2,9 rep/min
  //
  // Die Formel liegt durchgehend um Faktor 16 bis 18 daneben. In der
  // Guete-RANGFOLGE kuerzt sich das weitgehend weg, weil der Fehler alle
  // Faktionen aehnlich trifft - die Wahl war also nie falsch. Die Zahl `sek`
  // aber ist es: Sie sagte um 09:47 "356 Sekunden bis ORION-MKIV", real sind
  // es rund 101 Minuten. Wer von aussen den naechsten Einbau vorhersagt,
  // rechnet damit siebzehnfach zu frueh - genau das ist um 08:53 passiert.
  //
  // Deshalb wird die Rate jetzt beobachtet: je Faktion der letzte Stand mit
  // Zeitstempel, und sobald REP_MESSFENSTER Sekunden vergangen sind, ersetzt
  // die gemessene Rate die Formel. Bis dahin bleibt die Formel - ein Bot, der
  // beim Start zehn Minuten lang keine Rangfolge bilden kann, waere schlimmer
  // als eine ungenaue.
  const REP_MESSFENSTER = 300;                     // Sekunden
  const repMessung = new Map();                    // faktion -> {rep, zeit, rate}

  for (;;) {
   try {
    // DER PULS (24.08.2026).
    //
    // data/bn4rep.json taugt NICHT als Lebenszeichen. Das Skript steigt an
    // mindestens vier Stellen vor der Telemetriezeile aus der Runde aus:
    // Firmenphase (:959), nichts mehr zu kaufen (:462-470, laut eigenem
    // Kommentar "der Normalfall am Ende eines Zyklus"), Ausgangsphase (:715)
    // und leere Zielliste (:1281). In all diesen Zustaenden arbeitet es
    // einwandfrei und schweigt trotzdem - ein Waechter, der daraus auf
    // Stillstand schliesst, schlaegt stundenlang grundlos Alarm.
    //
    // Diese Zeile steht deshalb GANZ oben und ohne jede Bedingung. Sie ist
    // das einzige verlaessliche "ich lebe" dieses Skripts.
    schreibNachHome("data/hb-rep.txt", String(Date.now()));
    // DER KNOTENSTEMPEL GEHOERT NEBEN DEN PULS (28.08.2026, 09:28).
    //
    // Der Waechter las `knoten` bisher aus `data/bn4rep.json` - und pruefte
    // dabei richtigerweise, ob die Datei frisch ist. Sie ist es fast nie:
    // Gemessen am 28.08. um 09:26 war sie **drei Tage alt** (25.08.), weil das
    // Skript an mindestens vier Stellen vor der Telemetriezeile aus der Runde
    // aussteigt - genau der Grund, aus dem oben der Puls steht. Damit lief die
    // Knotenwechsel-Erkennung des Waechters faktisch nie; ihr blieb allein der
    // home-Speicher-Einbruch, und der greift erst ab 1024 GB.
    //
    // Also dieselbe Stelle, dieselbe Bedingungslosigkeit. `getResetInfo`
    // kostet 1 GB (`RamCostGenerator.ts:664`), aber bn4rep ruft es ohnehin
    // an vier Stellen - der Aufruf hier ist gratis.
    //
    // `lastNodeReset` wird ausschliesslich in `prestigeSourceFile()` gesetzt
    // (`PlayerObjectGeneralMethods.ts:173`), `lastAugReset` nur bei einem
    // Einbau (`:126`). Damit trennt der Waechter genau, was Eric verlangt
    // hat: Knoteneintritt melden - auch derselbe Knoten noch einmal -,
    // gewoehnlicher Reset nicht.
    try {
      const ri = ns.getResetInfo();
      schreibNachHome("data/knoten.json", JSON.stringify({
        zeit: Date.now(),
        knoten: ri.currentNode,
        nodeReset: ri.lastNodeReset,
        augReset: ri.lastAugReset,
      }));
    } catch { /* ohne Stempel laeuft der Rest weiter */ }

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
      // levelNutzen, nicht hackNutzen: Diese Zeile entscheidet, ob eine
      // Firmenphase beginnt - also ob es sich lohnt, die Faktionsarbeit fuer
      // Stunden zu unterbrechen. Mit hackNutzen galt ECorp HVMind (Wert 2,00,
      // aber reiner hacking_grow) als lohnendes Ziel und haette die Phase
      // verhindert, obwohl es zum Knotenabschluss null beitraegt.
      .filter((k) => k.rep < k.repReq
        && levelNutzen(k.aug, spieler.mults.hacking, zielLevel) > 0)
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

    // NUR LEERLAUFEN, WENN AUCH NICHTS EINZUBAUEN IST (24.08.2026).
    //
    // Hier stand `if (!kandidaten.length && !companyTarget)`, und das war ein
    // Verklemmer: Der Zustand "nichts mehr zu kaufen" ist genau der, der einen
    // Einbau ausloesen SOLL - `nichtsMehrOffen` steht als Bedingung im
    // Einbaublock weiter unten. Dieser Ausstieg liegt aber DAVOR. Damit war
    // `nichtsMehrOffen` toter Code, und der Bot schlief im Minutentakt an
    // seiner eigenen Warteschlange vorbei.
    //
    // Aufgefallen am 24.08. um 21:18 in BitNode 5: fuenf Augmentierungen
    // wartend, darunter The Red Pill, alles gekauft, Hacking 5177 weit ueber
    // der Schwelle 4500 - und der Knoten waere trotzdem nie fertig geworden.
    // Der Puls lief weiter, die Telemetrie stand seit 20:46. Ein Waechter, der
    // nur nach Lebenszeichen sieht, kann so etwas nicht finden.
    if (!kandidaten.length && !companyTarget && wartend === 0) {
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
    // KEIN EINBAU VOR DEM DIVISIONSBEITRITT (25.08.2026).
    //
    // In BitNode 6 und 7 fuehrt der Ausgang ueber 21 Black Operations, nicht
    // ueber das Hackniveau. Der Beitritt zur Bladeburner-Division verlangt
    // alle vier Kampfwerte auf 100 - und ein Augmentierungs-Einbau setzt
    // genau die auf 1 zurueck (Prestige.ts). Solange der Beitritt aussteht,
    // wirft jeder Einbau also drei Stunden Training weg und bringt fuer den
    // Knotenabschluss nichts.
    //
    // Genau das ist am 25.08. um 05:50 passiert: sechs Augmentierungen
    // eingebaut, Kampfwerte von 13/13/17/19 zurueck auf 1.
    //
    // NACH dem Beitritt ist der Einbau wieder unbedenklich - Rang und
    // Faehigkeiten der Division ueberleben ihn vollstaendig
    // (Bladeburner.ts:259-263). Die Sperre gilt also nur fuer das Zeitfenster
    // davor. inBladeburner kostet 0 GB (RamCostGenerator.ts:338).
    let bladeSperre = false;
    // BITNODE 10 GEHOERT DAZU (29.08.2026, 04:25 - nach dem Vorfall um 04:15).
    // Hier stand `=== 6 || === 7`. In BitNode 10 traegt Bladeburner genauso
    // (nodes/KURS.md, 18:55), und der Beitritt verlangt dieselben vier
    // Kampfwerte auf 100. Ohne die 10 griff die Sperre nicht: Um 04:15 wurden
    // acht Augmentierungen eingebaut, Tiefstand 88 -> 1.
    const knotenJetzt = ns.getResetInfo().currentNode;
    if (bladeburnerTraegtHier()) {
      try { bladeSperre = !ns.bladeburner.inBladeburner(); }
      catch { bladeSperre = true; }   // kein Zugriff heisst: erst recht warten
    }

    let gesperrt = bladeSperre;
    // WAEHREND EINES GRAFTS WIRD NICHT EINGEBAUT (30.08.2026, 21:30).
    //
    // `installAugmentations` fuehrt ueber `prestigeAugmentation` zu
    // `this.finishWork(true, true)` (`Prestige.ts:137`) - ein laufendes Graft
    // ist damit weg, und sein Geld wird NICHT erstattet
    // (`Work/GraftingWork.tsx:75-83`). Beim Simulacrum sind das $450 Mrd.
    //
    // Die bestehende Sperre traegt das nicht: `bladeSperre` ist
    // `!inBladeburner()` (siehe oben), und der Spieler IST Mitglied - sie
    // greift also gerade dann nicht, wenn gegraftet wird. Der Fall ist auch
    // nicht fern: Das Paket in `nodes/GRAFTING.md` braucht rund 42 Stunden,
    // und der Einbau feuert in dieser Zeit mit hoher Wahrscheinlichkeit.
    let graftLaeuft = false;
    try {
      const arbeit = ns.singularity.getCurrentWork();
      graftLaeuft = !!arbeit && arbeit.type === "GRAFTING";
    } catch { graftLaeuft = false; }
    if (graftLaeuft) gesperrt = true;
    if (bladeSperre && Date.now() - letzteBladeMeldung > 600000) {
      letzteBladeMeldung = Date.now();
      sag("Kein Einbau: Divisionsbeitritt steht aus, ein Reset wuerde die"
        + " Kampfwerte auf 1 werfen (BitNode " + knotenJetzt + ").");
    }
    if (lockInhalt) {
      // DIE FIRMENSPERRE DARF DIE BLADE-SPERRE NICHT AUFHEBEN (29.08.2026,
      // 06:20). Hier stand `gesperrt = ...` als Zuweisung. Ein abgelaufenes
      // Firmenschloss setzte damit `gesperrt` auf false - auch dann, wenn
      // `bladeSperre` true war, der Divisionsbeitritt also noch aussteht.
      // Genau dieser Einbau hat am 29.08. um 04:15 6,6 Stunden gekostet.
      // Die beiden Sperren sind unabhaengig: es reicht, wenn eine greift.
      const lockStempel = Number(lockInhalt.split("|")[1]);
      const lockGilt = !Number.isFinite(lockStempel)
        || Date.now() - lockStempel < INSTALL_LOCK_MAX_AGE;
      if (!lockGilt) {
        loeschAufHome(INSTALL_LOCK_FILE);
        sag("Einbausperre war ueber fuenf Minuten alt - aufgehoben.");
      }
      // UND SIE DARF AUCH KEINE ANDERE SPERRE AUFHEBEN (31.08.2026, 01:35,
      // aus dem Skeptiker-Loop). Die Zuweisung heilte 2026-08-29 nur den
      // Blade-Fall, indem sie ihn ausdruecklich mitnahm - jede SPAETER
      // hinzugefuegte Sperre faellt wieder heraus. Genau das ist am 30.08.
      // mit dem Graft-Riegel aus Zeile 741 passiert: Bei laufendem Graft,
      // erfolgtem Divisionsbeitritt (bladeSperre false) und abgelaufenem
      // Firmenschloss (lockGilt false) stand `gesperrt` danach wieder auf
      // false, und der Einbau haette das Graft getoetet - ohne Erstattung
      // (`Work/GraftingWork.tsx:75-83`), beim Simulacrum $450 Mrd.
      // Deshalb ODER statt Zuweisung: eine gesetzte Sperre bleibt gesetzt.
      gesperrt = gesperrt || bladeSperre || lockGilt;
    }
    // FAVOR-EINBAU (23.08.2026). Der Einbau ist nicht nur ein Preis, den man
    // zahlt, um weiterzukommen - er ist selbst ein Ertrag. Beim Einbau wird
    // die gesammelte Reputation zu Favor (Faction.ts:77-85), und Favor geht
    // als (1 + favor/100) direkt in die Reputationsrate ein
    // (PersonObjects/formulas/reputation.ts:8-13, mult()).
    //
    // Gerechnet am laufenden Spiel: BitRunners steht bei Favor 16,4 mit
    // 50.000 Reputation. Ein Einbau jetzt hebt den Favor auf 61,6 und damit
    // die Rate um 39 Prozent - dauerhaft. Bis zur Spendenschwelle 150
    // braucht es in einem Zug 20,3 Stunden, ueber Zyklen nur 17,0.
    //
    // Dagegen steht der Levelverlust: die Rate haengt linear an
    // (hacking + int/3)/975, und nach dem Einbau faengt das Level bei eins
    // an. Gemessen am 22.08. dauerte die Erholung 4,5 Stunden bei etwa
    // halber Rate, kostete also rund 44.500 Reputation - bei +2,1 rep/s ist
    // das nach knapp sechs Stunden wieder eingespielt.
    //
    // Deshalb die Schwelle bei 25 Prozent Ratengewinn: darunter lohnt der
    // Umweg ueber die Erholung nicht, darueber schon. Sie greift nur, wenn
    // ohnehin genug in der Warteschlange liegt, damit der Einbau nicht wegen
    // eines einzelnen Stuecks ausgeloest wird.
    const RATEN_GEWINN_SCHWELLE = 1.25;
    // Ueber alle Faktionen, nicht nur ueber das aktuelle Ziel: das Ziel steht
    // an dieser Stelle noch nicht fest, und der Einbau hebt ohnehin den Favor
    // JEDER Faktion, bei der Reputation liegt. Massgeblich ist die beste.
    let favorGewinn = 1;
    let favorFaktion = "";
    for (const f of spieler.factions) {
      const alt = favor[f] || 0;
      const kumuliert = 25000 * Math.expm1(0.019802627296179712 * alt);
      const jetzt = ns.singularity.getFactionRep(f);
      if (jetzt < 1000) continue;   // unter tausend lohnt die Rechnung nicht
      const neu = Math.log1p((kumuliert + jetzt) / 25000) / 0.019802627296179712;
      const gewinn = (1 + neu / 100) / (1 + alt / 100);
      if (gewinn > favorGewinn) { favorGewinn = gewinn; favorFaktion = f; }
    }
    const favorLohnt = favorGewinn >= RATEN_GEWINN_SCHWELLE;
    // SPENDENRECHT EINLOESEN (23.08.2026). Favor waechst nur beim Einbau
    // (Faction.ts:77-85). Wer die Reputation fuer Favor 150 beisammen hat und
    // nicht einbaut, hat sie umsonst erarbeitet - das Schwellenziel
    // verschwindet dann aus der Rangfolge, und der Bot arbeitet stattdessen
    // die volle Augmentierungshuerde nach. Genau der Weg, den der Umbau der
    // Guetefunktion vermeiden soll.
    //
    // Diese eine Bedingung darf deshalb an der Mindestwarteschlange vorbei -
    // aber nie an der LEEREN: installAugmentations gibt bei leerer Liste
    // false zurueck (Singularity.ts:203-206), und die Zeile danach beendet
    // dieses Skript bedingungslos.
    const REP_ZUM_SPENDEN = 25000 * Math.expm1(0.019802627296179712 * ns.getFavorToDonate());
    const spendenrechtFaellig = spieler.factions.some((f) => {
      if ((favor[f] || 0) >= ns.getFavorToDonate()) return false;
      const kumuliert = 25000 * Math.expm1(0.019802627296179712 * (favor[f] || 0));
      if (kumuliert + ns.singularity.getFactionRep(f) < REP_ZUM_SPENDEN) return false;
      // NUR WENN DORT AUCH ETWAS ZU HOLEN IST. Eine Faktion, deren Angebot
      // vollstaendig gekauft ist, macht das Spendenrecht wertlos - ein Einbau
      // dafuer waere reiner Verlust.
      return ns.singularity.getAugmentationsFromFaction(f)
        .some((a) => a !== NFG && !besitz.has(a));
    });

    // --- ENDSPIEL-RIEGEL (23.08.2026) ---------------------------------------
    //
    // Ist The Red Pill eingebaut, haengt w0r1d_d43m0n am Netz und es fehlt nur
    // noch das Hacking-Level. Das kommt aus Erfahrung - und jeder weitere
    // Einbau setzt die Erfahrung auf den Wert von Level 1 zurueck
    // (Prestige.ts:44). Ein Einbau in dieser Phase macht den Knotenabschluss
    // also nicht schneller, sondern verhindert ihn.
    //
    // Der Kritiker hat diesen Fall am 23.08. gefunden: Ohne den Riegel
    // erreicht waehrend des Aufstiegs von Level 1 auf 9000 mit Sicherheit
    // eine der sieben Faktionen unter Favor 150 ihre Spendenschwelle, loest
    // einen Einbau aus und wirft das Level wieder auf 1. Der Ausgang waere
    // unerreichbar gewesen, solange ueberhaupt eine Faktion unter 150 steht.
    // Die Bedingung im if unten genuegt - eine Sperrdatei waere hier falsch,
    // weil die Firmenphase ihre eigene Sperre am Praefix erkennt und alles
    // wegraeumt, was damit anfaengt.
    // EINGEBAUT, NICHT GEKAUFT. `besitz` enthaelt auch die gekauften Stuecke,
    // die noch in der Warteschlange liegen (getOwnedAugmentations(true)).
    // The Red Pill kostet null Dollar und wird deshalb in derselben Runde
    // gekauft, in der die Reputation reicht - stuende hier `besitz`, sperrte
    // der Riegel ab der naechsten Runde den einzigen installAugmentations-
    // Aufruf des Projekts. Das Stueck bliebe fuer immer in der Warteschlange,
    // w0r1d_d43m0n kaeme nie ans Netz, und der Knoten waere unverlassbar -
    // waehrend das Log "The Red Pill ist eingebaut" meldet.
    //
    // Genau so war es zwischen 13:55 und 15:00 am 23.08.2026 gebaut. Der
    // Riegel gegen einen Fehler war selbst der schwerere Fehler.
    // Die Reputationsschwelle aus der Zeitvorgabe. Grobe Schaetzung der Rate
    // reicht: sie entscheidet nur, ob eine Huerde als "zu weit" gilt.
    // Bewusst ohne Favor und ohne share-Bonus - beides hebt die echte Rate
    // noch, die Schwelle ist damit eher zu niedrig als zu hoch, und das ist
    // die sichere Richtung (lieber einmal zu lange arbeiten als einmal zu oft
    // einbauen).
    const grobRate = Math.max(1,
      5 * spieler.skills.hacking / 975 * spieler.mults.faction_rep
        * (FACTION_REP_GAIN[ns.getResetInfo().currentNode] || 1));
    const lueckeZuGross = grobRate * 60 * LUECKE_ZU_GROSS_MINUTEN;

    const ausgangSteht = eingebauteAugs.includes(EXIT_KEY);
    if (ausgangSteht && Date.now() - letzteAusgangsmeldung > 300000) {
      letzteAusgangsmeldung = Date.now();
      sag("The Red Pill ist eingebaut - ab jetzt kein Einbau mehr, nur noch"
        + " Hacking-Level (" + spieler.skills.hacking + " von " + zielLevel + ").");
    }

    // --- DEN KNOTEN VERLASSEN: DAS TUT SEIT DEM 02.09.2026 ausgang.js ----
    //
    // Hier stand der Ausgang: Bedingung `The Red Pill` plus Hacking-Level,
    // Ziel aus data/exit-ziel.txt (die nur ein Mensch schrieb), Riegel gegen
    // den eigenen Knoten und gegen Ziele ueber 13, exec von exit.js fest auf
    // home. Unter der Praemisse "kein Mensch" war das ein Stillstand an jedem
    // Uebergang: Die Route verlangt 25 Spruenge in denselben Knoten und 6
    // nach BitNode 14/15, der Black-Ops-Weg wurde gar nicht erkannt, und
    // exit.js (519 GB mit SF4.1) passte auf kein home. Am 01.09. musste ein
    // Mensch den fertigen Knoten abschliessen.
    //
    // ausgang.js (singularityfrei, ganz oben in der Werkzeugliste) kennt
    // beide Wege, liest route.json und startet exit.js dort, wo Platz ist.
    // bn4rep tut bei erfuelltem Hackingweg nur noch eines: nichts mehr
    // kaufen und nichts mehr einbauen, damit der Sprung sauber kommt.
    if (ausgangSteht && spieler.skills.hacking >= zielLevel) {
      await ns.sleep(15000);
      continue;
    }

    // IM KAMPFKNOTEN KOSTET JEDER EINBAU STUNDEN (28.08.2026, 10:12).
    //
    // Der Spendenrecht-Zweig darf bewusst an der Mindestwarteschlange vorbei
    // (Begruendung oben, 23.08.). In einem Hackingknoten stimmt das: Der
    // Einbau kostet dort Erfahrung, die schnell zurueckkommt.
    //
    // In BitNode 6 und 7 nicht. Dort traegt der Bladeburner-Rang, und der
    // haengt an den Kampfwerten - die ein Einbau auf 1 setzt, waehrend die
    // AKTIONSSTUFE ihn ueberlebt (`Bladeburner.prestigeAugmentation()` macht
    // nur `resetAction()` + `joinFaction()`). Der Motor findet danach keine
    // Aktion mehr ueber seiner Schwelle.
    //
    // Gemessen am 28.08.: Der Einbau um **05:53 baute genau EIN Stueck ein**
    // (25 installierte Augmentierungen um 01:25, 26 um 09:33) und kostete
    // **3 Stunden 49 Minuten** bis zur ersten wieder fahrbaren Aktion um
    // 09:42. Bei der Reisegeschwindigkeit von 226 Rang je Minute sind das
    // rund **50.000 Rang** - ein Fuenftel des Restwegs, fuer ein einziges
    // Stueck.
    //
    // Die Mindestwarteschlange gilt deshalb in den Kampfknoten auch fuer den
    // Spendenrecht-Zweig. Das Spendenrecht geht nicht verloren, es wird nur
    // spaeter eingeloest - zusammen mit zwei weiteren Stuecken, die dieselbe
    // Wiederaufbaupause mitbenutzen.
    const kampfKnotenEinbau = bladeburnerTraegtHier();
    const spendenAusnahme = spendenrechtFaellig
      && wartend >= (kampfKnotenEinbau ? MINDEST_WARTESCHLANGE : 1);

    // IM KAMPFKNOTEN MUSS DIE WARTESCHLANGE DEN WIEDERAUFBAU VERKUERZEN
    // (28.08.2026, 13:15).
    //
    // Ein Einbau setzt die vier Kampfwerte auf 1, waehrend Rang, Faehigkeits-
    // und AKTIONSSTUFEN ihn ueberleben (`Bladeburner.prestigeAugmentation()`
    // macht nur `resetAction()` + `joinFaction()`, `Bladeburner.ts:259-263`).
    // Der Motor muss die Werte also wieder hochziehen, bevor er Aktionen auf
    // Stufe 20 fahren kann. Gemessen am 28.08.: Einbau 05:53, erste wieder
    // fahrbare Aktion 09:42 - **3 h 49 min**. Bei der Rate von 13:02
    // (354 Rang/min ueber 49 Minuten) sind das **81.000 Rang**, gut ein
    // Drittel des Restwegs von 214.361.
    //
    // Verkuerzen laesst sich diese Pause nur durch Multiplikatoren, die auf
    // die Kampfwerte oder die Ausdauer wirken - `strength`, `defense`,
    // `dexterity`, `agility` samt ihren `_exp`-Varianten, dazu
    // `bladeburner_max_stamina` und `bladeburner_stamina_gain`. Alles andere
    // zahlt die Pause, ohne sie zu verkuerzen.
    //
    // Der aktuelle Fall zeigt, warum das kein theoretischer Punkt ist: In der
    // Warteschlange liegt `Hyperion Plasma Cannon V2`, und sein EINZIGER
    // Multiplikator ist `bladeburner_success_chance: 1.08`
    // (`Augmentation/Augmentations.ts:964-974`). Die Erfolgschancen stehen
    // aber schon bei 1,000 - alle sechs Operationen und alle drei Vertraege
    // (`data/bbspann.json`, 12:56), weil `getSuccessChance` mit
    // `Math.min(1, competence/difficulty)` klemmt (`Actions/Action.ts:196`).
    // Die acht Prozent wirken damit nur auf Black Ops, und dort heben sie die
    // naechste (Deckard) von 0,719 auf 0,777 - weiterhin unter der
    // Feuerschwelle 0,90. Fuer diesen Gewinn waere eine mehrstuendige Pause
    // zu zahlen.
    //
    // Die Regel gilt nur in den Kampfknoten. In einem Hackingknoten ist der
    // Wiederaufbau billig, dort bleibt jedes Stueck willkommen.
    const WIEDERAUFBAU_MULTS = [
      "strength", "defense", "dexterity", "agility",
      "strength_exp", "defense_exp", "dexterity_exp", "agility_exp",
      "bladeburner_max_stamina", "bladeburner_stamina_gain",
    ];
    let wiederaufbauHilfe = !kampfKnotenEinbau;
    if (kampfKnotenEinbau) {
      try {
        const eingebaut = new Set(eingebauteAugs);
        for (const aug of alleAugs) {
          if (eingebaut.has(aug)) continue;
          let m = null;
          try { m = ns.singularity.getAugmentationStats(aug); } catch { continue; }
          if (!m) continue;
          if (WIEDERAUFBAU_MULTS.some((k) => Number(m[k]) > 1)) {
            wiederaufbauHilfe = true; break;
          }
        }
      } catch {
        // Ohne die Abfrage lieber die alte, grosszuegige Regel: eine Sperre,
        // die aus einem Fehler heraus greift, waere schlimmer als ein Einbau
        // zuviel.
        wiederaufbauHilfe = true;
      }
    }

    // EINE REGEL, DEREN GREIFEN NIEMAND SIEHT, IST NICHT NACHMESSBAR
    // (28.08.2026, 11:40).
    //
    // Die Sperre oben wurde um 10:12 eingebaut, und die Nachmessung lautete
    // "beim naechsten faelligen Spendenrecht darf kein Einbau mit weniger als
    // drei Stuecken stattfinden". Von aussen war das nicht pruefbar: Dass
    // 86 Minuten spaeter immer noch 26 Augmentierungen installiert waren,
    // belegt nur, dass NICHT eingebaut wurde - nicht, dass die Sperre der
    // Grund war. Vielleicht war das Spendenrecht nie faellig.
    //
    // Deshalb steht der Zustand jetzt in der Telemetrie. Die Datei ist klein
    // und wird bei jedem Durchlauf geschrieben, damit ein Loop sie ohne
    // Auftragskanal lesen kann.
    try {
      schreibNachHome("data/einbau.json", JSON.stringify({
        zeit: Date.now(),
        wartend,
        mindest: MINDEST_WARTESCHLANGE,
        kampfknoten: kampfKnotenEinbau,
        spendenrechtFaellig,
        spendenAusnahme,
        // Das ist die Zahl, die die Sperre belegt: faellig, aber zu wenige
        // Stuecke - genau dann haette die alte Fassung eingebaut.
        gesperrt: kampfKnotenEinbau && spendenrechtFaellig
          && wartend < MINDEST_WARTESCHLANGE,
        // Zweite Sperre: genug Stuecke, aber keines davon verkuerzt den
        // Wiederaufbau. Auch sie muss von aussen sichtbar sein, sonst ist sie
        // nicht nachmessbar.
        wiederaufbauHilfe,
        gesperrtOhneHilfe: kampfKnotenEinbau && !wiederaufbauHilfe
          && (wartend >= MINDEST_WARTESCHLANGE || spendenAusnahme),
      }));
    } catch { /* ohne Telemetrie laeuft der Rest weiter */ }

    if (!ausgangSteht
        && wiederaufbauHilfe
        && (wartend >= MINDEST_WARTESCHLANGE || spendenAusnahme)
        && ((kleinsteLuecke !== null && kleinsteLuecke > lueckeZuGross)
            || nichtsMehrOffen || geldWegZu || naechstesUnbezahlbar || favorLohnt
            || spendenrechtFaellig)
        && !gesperrt) {
      sag("EINBAU: " + wartend + " Augmentierungen. Grund: "
        + (favorLohnt ? "Favor bei " + favorFaktion + " hebt die Reputationsrate um "
            + Math.round((favorGewinn - 1) * 100) + " Prozent"
          : geldWegZu ? "naechstes Stueck kostet "
            + Math.round(teuerstesVerdiente / 1e6) + "m bei "
            + Math.round(geld / 1e6) + "m Guthaben"
          : naechstesUnbezahlbar ? "naechstes Stueck (" + naechstes.aug + ") kostet "
              + Math.round(naechstes.preis / 1e6) + "m bei "
              + Math.round(geld / 1e6) + "m Guthaben - Arbeit daran waere vergeblich"
          : nichtsMehrOffen ? "nichts mehr offen in den beigetretenen Faktionen"
          : "naechste Huerde erst in " + Math.round(kleinsteLuecke) + " Reputation") + ". "
        + "bn4life.js startet danach von selbst.");
      // NEUROFLUX ZULETZT (22.08.2026). NFG ist der einzige Multiplikator,
      // der sich rein mit Geld kaufen laesst - jede Stufe gibt x1,01 auf
      // hacking, und die Stufen sind unbegrenzt. Der Bot hat NFG bisher
      // ueberall uebersprungen (Zeile 247), weil er fuer die 30er-Zaehlung
      // nur einmal zaehlt.
      //
      // Fuer den Multiplikator zaehlt aber JEDE Stufe, und Geld ist gerade
      // im Ueberfluss da (552 Mrd bei nichts Kaufbarem). Gemessen am
      // laufenden Spiel ist der Multiplikator 1,745 - Level 2500 damit
      // unerreichbar, bei 5,24 dagegen 13 Stunden. Jeder Zehntelpunkt zaehlt.
      //
      // WARUM ERST HIER, unmittelbar vor dem Einbau: getLevel() zaehlt jede
      // gekaufte Stufe als eigenen Eintrag in queuedAugmentations
      // (Augmentation.ts:238-246), und jeder Eintrag verteuert JEDEN weiteren
      // Kauf um 1,9. Frueher gekauft wuerde NFG also alle anderen
      // Augmentierungen des Zyklus mitverteuern. Nach dem letzten Kauf kostet
      // es nichts mehr ausser Geld.
      //
      // Abbruch, sobald eine Stufe mehr kostet als vorhanden oder die
      // Reputation der Faktion nicht reicht - beides steigt je Stufe, der
      // Preis mit 1,14 mal dem 1,9-Aufschlag, die Reputation mit 1,14.
      // FEHLENDE REPUTATION WIRD GESPENDET (23.08.2026). Bis hierher brach die
      // Schleife ab, sobald die Reputation der Faktion nicht mehr reichte -
      // und das tat sie zuverlaessig, denn der Reputationsbedarf waechst je
      // Stufe mit 1,14 (NeuroFluxGovernorLevelMult, Constants.ts:36). Stufe
      // 60 verlangt 500 * 1,14^59 = 1.138.795 Reputation; die hoechste
      // Faktionsreputation im Spielstand lag bei 57.177. Seit Stufe 59 wurde
      // deshalb keine einzige weitere gekauft.
      //
      // Dabei ist genau das der groesste Hebel des Knotens: Stufe 59 traegt
      // allein x1,80 zum Hacking-Multiplikator bei - mehr als jedes einzelne
      // Katalogstueck je koennte -, und die fehlende Reputation kostet bei
      // einer spendenberechtigten Faktion rund 421 Mrd. Das sind sechs
      // Sekunden Einkommen.
      //
      // Der Deckel ist damit nicht mehr die Reputation, sondern das Geld: der
      // Kaufpreis waechst je Stufe mit 1,14 mal dem 1,9-Aufschlag aus
      // getGenericAugmentationPriceMultiplier (AugmentationHelpers.ts:32-37).
      // Bei rund 100 Bio Guthaben sind das etwa 14 Stufen je Zyklus, also
      // x1,15 auf den Multiplikator - drei Zyklen von 9,13 auf 14.
      // Beide Werte hier LOKAL, nicht aus dem Block weiter unten: dort stehen
      // sie erst ab Zeile ~910, und ein const-Zugriff von hier oben liefe in
      // die temporale Totzone - ReferenceError mitten im Einbau. Genau dieser
      // Fehler ist am 22.08. schon einmal passiert.
      const nfgSpendenSchwelle = ns.getFavorToDonate();
      const NFG_REP_GAIN = { 2: 0.5, 4: 0.75, 13: 0.6, 14: 0.2 };
      const nfgKnotenFaktor = NFG_REP_GAIN[ns.getResetInfo().currentNode] || 1;
      const nfgGeldFuerRep = (fehlend) =>
        fehlend * 1e6 / Math.max(0.01, spieler.mults.faction_rep) / nfgKnotenFaktor;

      let nfgStufen = 0;
      let nfgGespendet = 0;
      for (let i = 0; i < 40; i++) {
        const geldJetzt = ns.getServerMoneyAvailable("home");
        let gekauft = false;
        for (const f of spieler.factions) {
          if (!ns.singularity.getAugmentationsFromFaction(f).includes(NFG)) continue;
          const preis = ns.singularity.getAugmentationPrice(NFG);
          if (preis > geldJetzt) continue;
          const noetig = ns.singularity.getAugmentationRepReq(NFG);
          const habe = ns.singularity.getFactionRep(f);
          if (noetig > habe) {
            // Nur spenden, wenn das Recht besteht UND danach noch Geld fuer
            // den Kauf selbst bleibt - sonst waere die Spende verbrannt.
            if ((favor[f] || 0) < nfgSpendenSchwelle) continue;
            const kosten = nfgGeldFuerRep(noetig - habe) * 1.02;
            if (kosten + preis > geldJetzt) continue;
            if (!ns.singularity.donateToFaction(f, kosten)) continue;
            nfgGespendet += kosten;
          }
          if (ns.singularity.purchaseAugmentation(f, NFG)) { nfgStufen++; gekauft = true; break; }
        }
        if (!gekauft) break;
        await ns.sleep(50);
      }
      if (nfgStufen) {
        sag("NeuroFlux: " + nfgStufen + " Stufen vor dem Einbau gekauft"
          + (nfgGespendet > 0
            ? " (dafuer " + Math.round(nfgGespendet / 1e9) + " Mrd Reputation zugekauft)"
            : "") + ".");
      }

      await ns.sleep(1500);
      // DAS RUECKSTART-SKRIPT MUSS AUF home PASSEN (25.08.2026).
      //
      // Hier stand "bn4life.js". Das Spiel startet das Callback nach dem
      // Reset auf home (Singularity.ts:210, runAfterReset) - und bn4life
      // braucht ausserhalb von BitNode 4 volle 293,8 GB, weil es voller
      // Singularity-Aufrufe steckt. Auf einem home mit 256 GB passt es nicht.
      //
      // Folge: Der Rueckstart schlaegt LAUTLOS fehl. Am 25.08. um 05:50 hat
      // dieser Einbau den ganzen Bot stillgelegt - alle Skripte tot, kein
      // Callback, keine Wache, kein Weg zurueck ausser einem Menschen an der
      // Tastatur. Genau der Fall, den das Callback verhindern sollte.
      //
      // boot.js kostet 4 GB, passt also immer, und startet die Kette
      // boot -> bn4net -> Werkzeuge. Mehr braucht das Callback nicht zu
      // koennen: Es muss nur den ersten Dominostein umwerfen.
      // LETZTE GRAFTPRUEFUNG, UNMITTELBAR VOR DEM EINBAU (31.08.2026,
      // 01:45, aus dem Skeptiker-Loop). Die Pruefung am Rundenanfang
      // (:736-741) ist hier bis zu 3,5 Sekunden alt: dazwischen liegen
      // bis zu vierzig `await ns.sleep(50)` und ein `await ns.sleep(1500)`.
      // In dieser Luecke kann `graft.js` ein Graft gestartet haben, und
      // `installAugmentations` toetet es ueber `prestigeAugmentation` ->
      // `finishWork(true, true)` ohne Erstattung
      // (`Work/GraftingWork.tsx:75-83`) - beim Simulacrum $450 Mrd.
      // Die Pruefung kostet nichts; ein verpasster Einbau wird in der
      // naechsten Runde nachgeholt, ein getoetetes Graft nie.
      try {
        const jetztArbeit = ns.singularity.getCurrentWork();
        if (jetztArbeit && jetztArbeit.type === "GRAFTING") {
          sag("Einbau abgebrochen: in den letzten Sekunden hat ein Graft"
            + " begonnen (" + (jetztArbeit.augmentation || "unbekannt")
            + "). Naechste Runde erneut.");
          return;
        }
      } catch { /* nicht lesbar - dann gilt die Pruefung von oben */ }
      // AUSGANGS-INTERLOCK (Position C.3, 04.09.2026).
      //
      // Der Riegel weiter oben (:909) haengt an `ausgangSteht`, und das ist
      // `eingebauteAugs.includes("The Red Pill")` (:887). Red Pill gibt es nur
      // im V1-Weg. In den 30 Bladeburner-Laeufen der Route greift er also NIE -
      // und genau dort darf bn4rep in dem Moment einbauen, in dem alle 21
      // Black Ops gefallen sind und ausgang.js exit.js starten will.
      //
      // Was dann passiert, ist kein Geldproblem, sondern ein Engine-Schritt:
      // installAugmentations loescht ueber prestigeAugmentation ALLE gekauften
      // Rechner (Prestige.ts:73) und setzt das Guthaben auf 1000 Dollar. Damit
      // ist weder ein Wirt fuer die 519 GB von exit.js da noch das Geld, einen
      // zu kaufen. Gegen ein genulltes Konto hilft keine Reserve.
      //
      // Dieser Riegel ist verfahrensunabhaengig: er fragt data/ausgang.json,
      // nicht welche Tuer offen steht.
      try {
        const lg = endspurtLage(ns, Date.now());
        const erlaubt = einbauErlaubt(lg, Date.now(), lg.offenSeit ?? null);
        if (!erlaubt.ok) {
          sag("Einbau ausgesetzt. " + erlaubt.grund);
          return;
        }
        if (erlaubt.grund) sag(erlaubt.grund);
      } catch { /* keine Lage lesbar - dann gilt Normalbetrieb */ }

      // DER HANDSCHLAG VOR DEM EINBAU (Auftrag 7.2, gebaut 04.09.2026).
      //
      // Die Brueckenseite stand seit heute frueh, die Spielseite nicht - ein
      // Skeptiker hat es gefunden: `grep -rn "backup-request" src/` war leer.
      // Damit entstand die Sicherungsklasse `pre-install`, die als einzige
      // neben `pre-jump` NIE rotiert wird, ueberhaupt nie.
      //
      // Kommt keine Antwort und ist die letzte gruene Sicherung aelter als
      // sechs Stunden, wird NICHT eingebaut: ein Einbau ist beliebig oft
      // nachholbar, der Verlust bei einem Fehlgriff betraegt Tage.
      // `handschlag` setzt dann selbst `data/install-sperre.txt`.
      {
        const hs = await handschlag(ns, "install", "bn4rep",
            ns.getResetInfo().lastNodeReset, sag);
        if (!hs.darf) {
          sag("Einbau ausgesetzt: " + hs.grund);
          return;
        }
        if (!hs.gesichert) {
          sag("HINWEIS: Einbau ohne frische Sicherung, letzte gruene "
            + (Number.isFinite(hs.alterMs)
              ? (hs.alterMs / 3600000).toFixed(1) + " h alt" : "unbekannt"));
        }
      }

      ns.singularity.installAugmentations("boot.js");
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
          if (bladeSperreArbeit()) {
            // Siehe die Begruendung bei workForFaction weiter unten: In BN6/7
            // bricht jede Arbeit die laufende Bladeburner-Aktion ab.
          } else if (figFrei("arbeit", companyTarget,
                       "Firmenreputation fuer den Backdoor-Rabatt")
                     && ns.singularity.workForCompany(companyTarget, true)) {
            sag("Arbeite fuer " + companyTarget + " als " + job + ": "
              + Math.round(companyRep) + " von " + companyRepGoal(companyTarget) + " Firmenreputation.");
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
          goal: companyRepGoal(companyTarget),
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
    // NUTZEN_GEWICHT 1 seit dem 23.08.2026. Die Zahl gehoerte zu hackNutzen,
    // dessen Werte zwischen 0 und 2 lagen; levelNutzen liefert 0 bis 7 und
    // ist damit schon in der richtigen Groessenordnung. Ein Zaehlplatz wiegt
    // jetzt so viel wie ein sehr schwaches Stueck - das ist richtig herum,
    // denn die 30er-Huerde ist laengst erfuellt.
    const NUTZEN_GEWICHT = 1;
    const zaehlplatzWert = alleAugs.length < 30 ? 1 : 0;
    // DER AUSGANGSSCHLUESSEL (23.08.2026). The Red Pill hat keinerlei Werte
    // (Augmentations.ts:1946-1953, stats: ""), faellt also durch jede
    // Nutzenrechnung: hackNutzen ist null, und der Zaehlplatz-Bonus greift nur
    // unter 30 Stueck - bei 46 eingebauten nie. Sobald die uebrigen
    // Daedalus-Stuecke gekauft sind, ist seine Guetezahl EXAKT null.
    //
    // Sein Wert ist ein anderer: ohne ihn haengt w0r1d_d43m0n gar nicht am
    // Netz (Prestige.ts:173-181) - der Knoten ist ohne ihn nicht zu verlassen.
    //
    // WARUM 10 UND NICHT UNENDLICH. Der Ausgang braucht ZWEI Dinge, den
    // Schluessel UND Hacking 9000. Das Level kommt nur ueber den
    // Multiplikator, der nur ueber Einbauten - und jeder Einbau wirft die
    // Daedalus-Mitgliedschaft weg (kein keepOnInstall, FactionInfo.tsx:138-149,
    // Vorgabewert false in :105). Ein unendlicher Wert liesse den Bot zwoelf
    // Stunden lang 2,5 Mio Reputation erarbeiten, in denen er nicht einbauen
    // darf; der Multiplikator staende still, und der ist der eigentliche
    // Engpass. 10 entspricht dem Gewicht des gesamten uebrigen
    // Daedalus-Angebots. Setzung wie NUTZEN_GEWICHT, keine Messung.
    // levelNutzen statt hackNutzen (23.08.2026). hackNutzen multipliziert alle
    // sechs Hacking-Multiplikatoren gleichwertig - richtig fuer den Geldfluss,
    // grob falsch fuer ein Levelziel. Der Multiplikator sitzt im Exponenten
    // der Levelformel, hacking_money und hacking_grow tragen ueberhaupt nichts
    // bei, und hacking_chance wird auf 1,0 geklemmt.
    //
    // Was das aendert, an den beiden Extremfaellen im Bestand:
    //   ECorp HVMind   hackNutzen 2,00 (zweithoechster Wert) -> levelNutzen 0
    //   DataJack       hackNutzen 0,25                       -> levelNutzen 0
    //   nextSENS       hackNutzen 0,20                       -> levelNutzen 5,14
    // Der Bot haette also zweimal ein Stueck gekauft, das zum Knotenabschluss
    // nichts beitraegt, und dabei jedes weitere um Faktor 1,9 verteuert.
    // DER KAMPFTERM (27.08.2026, 03:50).
    //
    // In BitNode 6 und 7 fuehrt der Ausgang ueber 21 Black Operations, nicht
    // ueber das Hackniveau. Die Guetezahl oben kannte davon nichts: Ihre drei
    // Summanden zielen alle auf den Hacking-Ausgang, und SPTN-97 mit x1,75 auf
    // alle vier Kampfwerte bekam damit `0 + 1 + 0 = 1` - so viel wie ein
    // wertloses Stueck.
    //
    // Warum das in BitNode 6 nicht nur suboptimal, sondern falsch ist,
    // gemessen am 27.08. um 02:48: Der effektive Hacking-Multiplikator liegt
    // bei 0,559 (1,605 mal die Knotendaempfung 0,35). Der Backdoor auf
    // w0r1d_d43m0n verlangt Hacking 6000, das sind bei diesem Multiplikator
    // **2,44 x 10^148 Erfahrung** gegen einen Bestand von 3,55 Millionen.
    // Der Bladeburner-Weg dagegen braucht Faktor 5,63 in den Kampfwerten -
    // die zehn staerksten Stuecke aus `lib/combataugs.js` ergeben zusammen
    // x6,91.
    //
    // GEWICHT 10, und die Zahl ist nicht gegriffen: `levelNutzen` liefert 0
    // bis 7, `combatNutzen` 0 bis 0,655 (SPTN-97). Mal zehn stehen beide in
    // derselben Groessenordnung, und ein starkes Kampfstueck wiegt damit so
    // viel wie ein starkes Hackstueck - nicht mehr. In einem Knoten, in dem
    // der Hacking-Weg 146 Groessenordnungen entfernt ist, ist das eher zu
    // vorsichtig als zu forsch.
    //
    // Der Term greift NUR in den Kampfknoten. Ueberall sonst bleibt die
    // Guetezahl exakt wie bisher - das ist der Grund fuer die Abfrage statt
    // einer pauschalen Addition.
    const KAMPF_GEWICHT = 10;
    const kampfKnoten = bladeburnerTraegtHier();
    const einzelWert = (k) => (k.aug === EXIT_KEY ? EXIT_KEY_VALUE : 0)
      + zaehlplatzWert
      + NUTZEN_GEWICHT * Math.max(0, levelNutzen(k.aug, spieler.mults.hacking, zielLevel))
      + (kampfKnoten ? KAMPF_GEWICHT * combatNutzen(k.aug) : 0);

    // BESTAND, NICHT SUMME (22.08.2026). Reputation ist ein Bestand je
    // Faktion, keine Zahl je Augmentierung. Wer bei Tetrads 9.994 Reputation
    // erreicht, hat damit ALLE Tetrads-Stuecke unterhalb dieser Schwelle
    // freigeschaltet, nicht nur das eine. Die vorige Fassung bewertete jedes
    // Stueck einzeln und waehlte deshalb immer die kleinste Einzelluecke -
    // sie sprang zwischen Faktionen hin und her und liess jedesmal den Rest
    // liegen, obwohl er fast geschenkt gewesen waere.
    //
    // Der Ertrag eines Ziels ist deshalb die Summe ueber alles, was bei
    // DERSELBEN Faktion mit dem Erreichen seiner Schwelle mit freikommt.
    // FAVOR ALS ZWEITER ERTRAG (23.08.2026). Reputation zahlt doppelt: sie
    // schaltet Augmentierungen frei UND wird beim Einbau zu Favor
    // (Faction.ts:77-85 ruft addRepToFavor). Ab Favor 150 darf gespendet
    // werden, und dann gilt rep = betrag/1e6 * mults.faction_rep - bei den
    // 1,53 Billionen, die gerade herumliegen, sind das 1,78 Millionen
    // Reputation auf einen Schlag.
    //
    // Gerechnet am laufenden Spiel: Favor 150 entspricht 462.490 kumulierter
    // Reputation (favorToRep, favor.ts:12-15). BitRunners steht bei Favor
    // 16,4 = 9.593 kumuliert plus 44.393 aktuell, es fehlen also 408.504 -
    // rund 20 Stunden bei gemessenen 5,5 rep/s. Danach ist JEDE Huerde dort
    // sofort kaufbar, auch BitRunners Neurolink mit 875.000.
    // Direkt erarbeitet kostete Neurolink allein 44 Stunden. Der Umweg lohnt
    // sich also, sobald mehr als zwei Stuecke bei derselben Faktion liegen.
    //
    // Deshalb bekommt eine Faktion Zuschlag, je naeher sie an der
    // Spendenschwelle steht. Der Zuschlag ist bewusst klein gehalten: er soll
    // bei aehnlicher Guete den Ausschlag geben und den Bot bei EINER Faktion
    // halten, statt die Rangfolge umzuwerfen.
    // favorNaehe ist am 23.08.2026 entfallen. Der Zuschlag konnte hoechstens
    // Faktor 2 sein, wirkte gleichmaessig auf ALLE Stuecke einer Faktion statt
    // auf die eine Reputationsmarke, an der das Regime kippt, und belohnte
    // auch Faktionen, bei denen gar nichts mehr offen ist. Die Schwelle ist
    // jetzt ein eigener Kandidat, weiter unten.

    // SPENDENRECHT SCHLAEGT ALLES (23.08.2026). Hat eine Faktion Favor 150,
    // ist Reputation dort keine Zeitfrage mehr, sondern eine Geldfrage:
    // rep = betrag/1e6 * mults.faction_rep (Faction/formulas/donation.ts).
    // Gemessen am laufenden Spiel: BitRunners stand auf Favor 171 mit 48
    // Billionen auf der Hand - das sind ueber 50 Millionen Reputation auf
    // Zuruf. Der Bot arbeitete trotzdem an PCMatrix bei einer anderen
    // Faktion, weil die Guetezahl nur die Reputationsluecke sah und nicht,
    // dass diese Luecke woanders mit Geld sofort verschwindet.
    //
    // Deshalb wird fuer spendenberechtigte Faktionen die Luecke nicht in
    // Reputation, sondern in Geld gemessen. Reicht das Guthaben, ist sie
    // effektiv null und das Ziel gewinnt jede Rangfolge - zu Recht, denn es
    // kostet keine Zeit. Reicht es nicht, zaehlt der fehlende Betrag.
    const spendenSchwelle = ns.getFavorToDonate();

    // FactionWorkRepGain gehoert in die Spendenformel. donationForRep teilt
    // NICHT nur durch mults.faction_rep, sondern zusaetzlich durch den
    // Knotenfaktor (Faction/formulas/donation.ts:12-14):
    //
    //   geld = rep * 1e6 / mults.faction_rep / FactionWorkRepGain
    //
    // In BitNode 4 ist der 0,75 (BitNode.tsx:651). Ohne ihn rechnet der Bot
    // jede Spende um ein Drittel zu billig - und `kosten + preis <= geld`
    // weiter unten wird zu frueh wahr, der Kauf schlaegt dann fehl.
    //
    // ns.getBitNodeMultipliers() gibt es nur mit SF5 oder in BitNode 5, wir
    // haben beides nicht. Deshalb die Werte aus dem Quelltext, und zwar nur
    // fuer die Knoten, die den Faktor ueberhaupt setzen - alle uebrigen lassen
    // ihn bei 1. BitNode 12 skaliert ihn mit der Knotenstufe; dort greift
    // bewusst der sichere Wert 1, weil eine zu hoch geschaetzte Spende nur
    // Geld kostet, eine zu niedrig geschaetzte dagegen den Kauf verfehlt.
    const knotenRepFaktor = FACTION_REP_GAIN[ns.getResetInfo().currentNode] || 1;
    const geldFuerRep = (fehlend) =>
      fehlend * 1e6 / Math.max(0.01, spieler.mults.faction_rep) / knotenRepFaktor;

    // --- Der Preis eines Ziels: SEKUNDEN, nicht rohe Reputation --------------
    // Bis zum 23.08.2026 stand im Nenner die rohe Reputationsluecke. Das
    // vergleicht Ungleiches: dieselben 7.000 Reputation kosten bei einer
    // Faktion mit Favor 130 nur 46 Prozent der Zeit, die sie bei Favor 0
    // kosten - mult(favor) = 1 + favor/100 geht direkt in die Rate ein
    // (PersonObjects/formulas/reputation.ts:8-14).
    //
    // Alles, was fuer JEDE Faktion gleich ist - share-Bonus, Intelligenzbonus,
    // die fuenf Zyklen je Sekunde -, kuerzt sich in einer Rangfolge weg und
    // steht deshalb absichtlich nicht in der Formel.
    //
    // Der Passivertrag (FactionHelpers.tsx:132-170) steht bewusst NICHT drin.
    // Er sieht groesser aus, als er ist: Aktive Arbeit ersetzt die passive
    // Rate der bearbeiteten Faktion, der Gewinn ist also (1 - passivAnteil)
    // und damit hoechstens zehn Prozent. Ein erster Versuch am 23.08. hat
    // stattdessen DURCH den Passivanteil geteilt und damit Faktionen mit
    // niedrigem Favor um Faktor 6 bevorzugt - genau falsch herum, denn hoher
    // Favor verdoppelt die Arbeitsrate. Der Versuch wurde zurueckgenommen.
    //
    // NICHT JEDE FAKTION BIETET HACKING-ARBEIT (23.08.2026). Wo sie fehlt,
    // faellt der Bot weiter unten auf Feld- oder Sicherheitsarbeit zurueck,
    // und deren Formeln sind voellig andere (reputation.ts):
    //
    //   hacking:  (hacking + int/3) / 975
    //   field:    0,9 * (str+def+dex+agi+cha + (hacking+int)*share) / 975 / 5,5
    //   security: dieselbe Summe / 975 / 4,5
    //
    // Bei Kampfwerten um 2 - der Bot trainiert sie nicht - ist Feldarbeit
    // rund ein Sechstel der Hacking-Rate. Genau die Faktionen, die der
    // Beitrittslauf nachholt (Tetrads, Slum Snakes), bieten kein Hacking;
    // ohne diese Unterscheidung erschiene ihr Schwellenziel sechsmal
    // billiger, als es ist. Seit die Beitrittsmarke wieder verfaellt, ist
    // das kein hypothetischer Fall mehr.
    const ARBEITSTEILER = { hacking: 1, field: 5.5 / 0.9, security: 4.5 / 0.9 };
    const arbeitsart = (faktion) => {
      const typen = ns.singularity.getFactionWorkTypes(faktion);
      // Reihenfolge nach dem Nenner der Formel (reputation.ts): hacking ohne
      // Teiler, security durch 4,5, field durch 5,5. Hier stand field vor
      // security - das verschenkte 22 Prozent bei jeder Faktion, die beides
      // anbietet, und das sind genau die Kampf-Faktionen wie Tetrads.
      return typen.includes("hacking") ? "hacking"
        : typen.includes("security") ? "security"
        : typen.includes("field") ? "field" : (typen[0] || "hacking");
    };
    const repPerSecond = (faktion) => {
      // Die Beobachtung schlaegt die Formel, sobald sie lang genug lief.
      const m = repMessung.get(faktion);
      if (m && m.rate > 0) return m.rate;
      const art = arbeitsart(faktion);
      const k = spieler.skills;
      // Bei Feld- und Sicherheitsarbeit zaehlen alle Werte, bei Hacking nur
      // das Hacking-Level. Der share-Bonus auf den Hacking-Anteil ist
      // weggelassen: er ist faktionsunabhaengig und kuerzt sich in einer
      // Rangfolge weg.
      const basis = art === "hacking"
        ? k.hacking + (k.intelligence || 0) / 3
        : k.strength + k.defense + k.dexterity + k.agility + k.charisma
          + k.hacking + (k.intelligence || 0);
      return Math.max(0.01,
        5 * basis / 975 / (ARBEITSTEILER[art] || 1)
          * spieler.mults.faction_rep
          * (1 + (favor[faktion] || 0) / 100)
          * knotenRepFaktor);
    };

    // Umkehrung von geldFuerRep - gleiche Fundstelle, gleicher Knotenfaktor.
    const repForMoney = (betrag) => betrag / 1e6
      * spieler.mults.faction_rep * knotenRepFaktor;

    // --- Die Spendenschwelle als EIGENES Ziel --------------------------------
    // Favor 150 ist keine Verbesserung, sondern ein Regimewechsel: danach
    // kostet jede weitere Huerde dieser Faktion nur noch Geld. Deshalb steht
    // hier ein zusaetzlicher Kandidat je Faktion - "arbeite bis zu der
    // Reputation, die beim naechsten Einbau Favor 150 ergibt". Sein Ertrag
    // ist das GANZE restliche Angebot der Faktion. Ist nichts mehr offen, ist
    // der Ertrag null und das Ziel verschwindet von selbst.
    //
    // Favor waechst NUR beim Einbau, aus der dann gehaltenen Reputation
    // (Faction.ts:77-85). Deshalb wird die Restluecke gegen den schon
    // kumulierten Favor gerechnet. Ueber mehrere Zyklen verteilt geht nichts
    // verloren, addRepToFavor ist additiv in der Reputation.
    const LOG_1_02 = 0.019802627296179712;          // = log(1,02), favor.ts
    const favorToRep = (f) => 25000 * Math.expm1(LOG_1_02 * f);
    const REP_FOR_DONATION = favorToRep(spendenSchwelle);

    // Messstand fortschreiben. `k.rep` ist je Faktion gleich, ein Kandidat
    // je Faktion genuegt also. Die Rate wird nur uebernommen, wenn sie
    // positiv ist - ein Einbau setzt die Reputation zurueck, und eine
    // negative Rate wuerde die Rangfolge zerstoeren.
    // DER ANKER BLEIBT STEHEN (27.08.2026, 11:49).
    //
    // Bis eben wurde der Messpunkt bei jeder Uebernahme nachgezogen, die Rate
    // also immer ueber genau 300 Sekunden gebildet. Das ist zu kurz: Nachgemessen
    // um 11:47 sagte der Motor Bladeburners 39,4 rep/min, real waren es 24,4
    // (6.380 um 10:17 gegen 8.580 um 11:47), und fuer Aevum 20 gegen real 40,1.
    // Beide Male daneben, und zwar in ENTGEGENGESETZTE Richtung - das ist kein
    // systematischer Fehler mehr, das ist Rauschen.
    //
    // Der Grund ist derselbe wie bei der Rangrate: Die Bladeburner-Reputation
    // haengt am Rangzuwachs, und der schwankt mit dem Ausdauerzyklus zwischen
    // 4,5 und 7,4 je Minute. Die Aevum-Reputation kommt aus Coding Contracts,
    // die unregelmaessig anfallen - in 300 Sekunden kann schlicht keiner liegen.
    // Wer ein so kurzes Fenster misst, misst dessen Phase.
    //
    // Deshalb bleibt der erste Messpunkt jetzt als ANKER stehen und nur die
    // Rate wird fortgeschrieben. Das Fenster waechst mit der Laufzeit: nach
    // einer Stunde ist es eine Stunde lang, ohne dass jemand eine Wartezeit
    // festlegen muesste. 300 Sekunden sind nur noch das MINDESTfenster fuer
    // die allererste Rate.
    const jetztSek = Date.now() / 1000;
    for (const k of kandidaten) {
      const alt = repMessung.get(k.faktion);
      // Faellt die Reputation, war ein Einbau dazwischen - neu ankern, sonst
      // rechnete der Anker gegen einen Bestand, den es nicht mehr gibt.
      if (!alt || k.rep < alt.rep) {
        repMessung.set(k.faktion, { rep: k.rep, zeit: jetztSek, rate: 0 });
        continue;
      }
      const dt = jetztSek - alt.zeit;
      if (dt < REP_MESSFENSTER) continue;
      alt.rate = (k.rep - alt.rep) / dt;
    }

    const alleOffenen = kandidaten.filter((k) => k.rep < k.repReq);
    const schwellenZiele = [];
    for (const faktion of new Set(alleOffenen.map((k) => k.faktion))) {
      if ((favor[faktion] || 0) >= spendenSchwelle) continue;
      const eigene = alleOffenen.filter((k) => k.faktion === faktion);
      const rep = eigene[0].rep;                    // Bestand, je Faktion gleich
      const fehlt = REP_FOR_DONATION - favorToRep(favor[faktion] || 0) - rep;
      if (fehlt <= 0) continue;                     // beim Einbau ohnehin da
      // Das Ziel traegt das billigste offene Stueck als Namen: gearbeitet wird
      // ohnehin auf die FAKTION, so muessen Protokoll, Kaufschleife und
      // Telemetrie nichts Neues lernen.
      const billigstes = eigene.slice().sort((a, b) => a.repReq - b.repReq)[0];
      schwellenZiele.push({
        aug: billigstes.aug, faktion, rep, repReq: rep + fehlt,
        preis: billigstes.preis, istSchwelle: true,
      });
    }

    // Was die Luecke kostet, in Sekunden. Bei einer spendenberechtigten
    // Faktion faellt der Teil weg, den der Kassenstand sofort kauft; was dann
    // noch fehlt, wird erarbeitet. Damit braucht es keinen geratenen
    // Wechselkurs zwischen Dollar und Sekunden.
    const kostenSekunden = (k) => {
      let luecke = Math.max(0, k.repReq - k.rep);
      if ((favor[k.faktion] || 0) >= spendenSchwelle) {
        luecke = Math.max(0, luecke - repForMoney(Math.max(0, geld - k.preis)));
      }
      return luecke / repPerSecond(k.faktion);
    };

    // Der Ertrag ist der BESTAND, nicht die Einzelzahl (22.08.2026). Ein
    // Schwellenziel schaltet nach dem Einbau das ganze Angebot frei.
    const ertragBis = (faktion, repReq) => kandidaten
      .filter((m) => m.faktion === faktion && m.repReq <= repReq)
      .reduce((n, m) => n + einzelWert(m), 0);
    const ertragGesamt = (faktion) => kandidaten
      .filter((m) => m.faktion === faktion)
      .reduce((n, m) => n + einzelWert(m), 0);

    // GUETE = Ertrag je Sekunde Wartezeit. Erarbeiten und Spenden stehen damit
    // in DERSELBEN Einheit; der Sonderfall "ertrag * 1e6" fuer eine bezahlbare
    // Spende entfaellt, er ergibt sich aus Kosten null von selbst.
    const guete = (k) => {
      const wert = k.istSchwelle ? ertragGesamt(k.faktion) : ertragBis(k.faktion, k.repReq);
      if (wert <= 0) return 0;
      return wert / Math.max(1, kostenSekunden(k));
    };
    const offen = alleOffenen.concat(schwellenZiele)
      .sort((a, b) => guete(b) - guete(a));

    // RANGLISTE NACH DRAUSSEN (23.08.2026). Bis heute stand in der Telemetrie
    // nur das Ergebnis der Wahl, nicht ihre Begruendung. Wer von aussen fragen
    // wollte, warum ein offensichtlich billigeres Ziel NICHT gewaehlt wurde,
    // musste die Guetefunktion im Kopf nachrechnen - und genau dabei ist am
    // 23.08. eine Stunde verlorengegangen. Die fuenf besten Kandidaten mit
    // Ertrag und Kosten kosten nichts und beantworten die Frage sofort.
    const rangliste = offen.slice(0, 5).map((k) => ({
      aug: k.aug, faktion: k.faktion, schwelle: !!k.istSchwelle,
      wert: Math.round((k.istSchwelle ? ertragGesamt(k.faktion)
        : ertragBis(k.faktion, k.repReq)) * 1000) / 1000,
      sek: Math.round(kostenSekunden(k)),
      guete: Math.round(guete(k) * 1e6) / 1e6,
    }));

    if (!offen.length) { await ns.sleep(20000); continue; }

    const ziel = offen[0];

    // DAS ZIEL GEHOERT NEBEN DEN PULS (27.08.2026, 07:55).
    //
    // `data/bn4rep.json` steht am Ende der Runde, und das Skript steigt an
    // mindestens vier Stellen davor aus (siehe den Kommentar beim Puls, :355).
    // Gemessen am 27.08. um 07:47: Der Puls war **0 Minuten** alt, die
    // Telemetrie **2.323** - also von gestern Vormittag. Von aussen war damit
    // nicht zu sehen, worauf der Motor gerade spart.
    //
    // Das ist mehr als Kosmetik: Seit dem 27.08., 04:10 bewertet `einzelWert`
    // auch Kampfwert-Augmentierungen (`lib/hackaugs.js`, `combatNutzen`), und
    // ob das greift, laesst sich **nur** am gewaehlten Ziel ablesen. Ohne
    // diese Zeile bleibt der Punkt in BAUSTELLEN.md dauerhaft ungemessen.
    //
    // Eigene Datei statt Anhang an `hb-rep.txt`: Der Waechter liest den Puls
    // mit `Number(...)` (`wache.js:176-180`), ein Textzusatz wuerde dort NaN
    // ergeben und einen Ausfall melden, den es nicht gibt.
    //
    // NACHTRAG 27.08., 08:52: Die Rangliste faehrt mit. Sie wird oben
    // ohnehin gebaut (:1424), landete aber nur in `data/bn4rep.json` - und
    // die steht seit dem 25.08. um 17:45 still, gemessen 39,7 Stunden alt.
    // Ohne sie sieht man WAS gewaehlt wurde, aber nicht WARUM und nicht, wie
    // lange es noch dauert. Genau die Frage stand um 08:50 offen: 7,97 Mrd
    // auf der Hand, 0 wartende Stuecke, fuenf Stunden nach dem Einbau - ist
    // die Reputation fuers Ziel unerreichbar, oder liegt ein bezahlbares
    // Stueck daneben? `sek` je Kandidat beantwortet das.
    //
    // Zeile 1 bleibt unveraendert `<ms>|<aug>|<faktion>`; die Rangliste steht
    // als JSON in Zeile 2. Wer nur die erste Zeile liest, merkt nichts.
    // Zeile 3: was der Motor als Reputationsrate ANNIMMT, in rep je Minute.
    // Nachgerechnet um 10:17 stimmte sie nicht: aus `sek` liess sich auf rund
    // 115 rep/min zurueckschliessen, real waren es 23,8 (Bladeburners 5.665
    // um 09:47 gegen 6.380 um 10:17). Rueckrechnen ueber `sek` braucht die
    // repReq-Werte und ist damit selbst unsicher - die Zahl gehoert direkt
    // herausgeschrieben. Ein Stern markiert einen Wert aus der Formel.
    const ratenSicht = {};
    for (const f of repMessung.keys()) {
      const m = repMessung.get(f);
      ratenSicht[f] = Math.round(repPerSecond(f) * 60 * 10) / 10
        + (m && m.rate > 0 ? "" : "*");
    }
    schreibNachHome("data/rep-ziel.txt",
      Date.now() + "|" + ziel.aug + "|" + ziel.faktion
      + "\n" + JSON.stringify(rangliste)
      + "\n" + JSON.stringify(ratenSicht));

    // --- Spendenweg, sobald eine Faktion Favor 150 hat ------------------------
    // Ab dieser Marke bringt Geld direkt Reputation:
    //     rep = betrag / 1e6 * mults.faction_rep     (Faction/formulas/donation.ts)
    // Fuer einen Bot, der Hunderttausende je Minute aus Coding Contracts zieht
    // und dessen Engpass die Reputation ist, kehrt das die Wirtschaft um:
    // Zeit wird durch Geld ersetzbar. Solange keine Faktion so weit ist, bleibt
    // es bei der Arbeit - der Aufruf waere sonst nur ein teurer Fehlschlag.
    if (favor[ziel.faktion] >= ns.getFavorToDonate()) {
      // NUR SOVIEL WIE NOETIG (23.08.2026). Vorher ging der gesamte Bestand
      // abzueglich der bereits verdienten Stuecke raus. Das ist zweifach
      // verkehrt: Reputation ueber der Schwelle kauft nichts mehr, und der
      // Ueberschuss faellt spaetestens beim naechsten Einbau der
      // Geldvernichtung zum Opfer (PlayerObjectGeneralMethods.ts:102 setzt
      // auf 1262 zurueck). Gerechnet am Stand vom 23.08. waeren 300 Bio
      // gespendet worden, gebraucht war weniger als ein Prozent davon.
      //
      // Der Zuschlag von zwei Prozent faengt ab, dass die Reputation zwischen
      // Rechnung und Ueberweisung leicht anders steht als hier angenommen.
      const fehlt = Math.max(0, ziel.repReq - ns.singularity.getFactionRep(ziel.faktion));
      const noetig = geldFuerRep(fehlt) * 1.02;
      const verfuegbar = ns.getServerMoneyAvailable("home") - teuerstesVerdiente;
      const uebrig = Math.min(noetig, verfuegbar);
      if (uebrig > 1e9) {
        if (ns.singularity.donateToFaction(ziel.faktion, uebrig)) {
          sag("GESPENDET: " + Math.round(uebrig / 1e6) + "m an " + ziel.faktion
            + " fuer " + Math.round(fehlt) + " fehlende Reputation"
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
      // Dieselbe Reihenfolge wie in arbeitsart oben - beide muessen
      // uebereinstimmen, sonst schaetzt die Rangfolge eine andere Rate, als
      // die Arbeit dann erzielt.
      const typen = ns.singularity.getFactionWorkTypes(ziel.faktion);
      const art = typen.includes("hacking") ? "hacking"
        : typen.includes("security") ? "security"
        : typen.includes("field") ? "field" : typen[0];
      // BLADEBURNER SCHLAEGT FAKTIONSARBEIT (25.08.2026).
      //
      // Eine Bladeburner-Aktion und eine Faktionsarbeit koennen nicht
      // nebeneinander laufen: workForFaction ersetzt die laufende Handlung, das
      // Spiel meldet "Your Bladeburner action was cancelled because you started
      // doing something else", und blade.js startet seine Aktion sofort neu.
      // Beide Seiten kommen dann nie zum Abschluss.
      //
      // Am 25.08. um 16:50 ist bn4rep nach elf Stunden wieder angelaufen - und
      // sofort waren die Dialoge zurueck, die eine Stunde vorher an derselben
      // Ursache in bn4life behoben worden waren.
      //
      // In BitNode 6 und 7 fuehrt der Ausgang ueber 21 Black Operations, nicht
      // ueber Reputation. Also gewinnt Bladeburner. bn4rep verliert dadurch
      // seine Arbeitsphasen, behaelt aber alles andere: Kaufen und Einbauen von
      // Augmentierungen brauchen keine Arbeit, nur Geld und vorhandene
      // Reputation. Der Preis ist bekannt und gewollt - eine halb gelaufene
      // Faktionsarbeit alle zwei Sekunden ist keine Reputation, sondern nur
      // ein Dialogfenster.
      if (bladeSperreArbeit()) {
        // KAPUTT SEIT COMMIT 3016d1f, BEHOBEN 30.08.2026 12:55.
        //
        // Hier stand `if (runde % 20 === 0)`. Die Variable `runde` gibt es in
        // dieser Datei nicht - sie stammt aus `bn4net.js`. Der Zweig wird im
        // Kampfknoten IMMER genommen, also warf die Runde ab da jedes Mal
        // `ReferenceError: runde is not defined` (belegt in
        // `data/bn4rep-log.txt`, alle 16 Sekunden).
        //
        // Kauf und Einbau liegen davor und liefen weiter; alles danach nicht -
        // insbesondere das Schreiben von `data/bn4rep.json`. `bn4net.js:750`
        // fand die Datei veraltet, setzte vorsichtshalber `wartend = 99` und
        // senkte damit `amortDeckel` von 1800 auf 600. Im Log stand deshalb
        // "amortisiert in 760 s (Deckel 600)" - der Serverausbau war blockiert,
        // obwohl `data/einbau.json` `wartend: 0` meldet.
        if (Date.now() - bladeSperreGemeldet > 300000) {
          bladeSperreGemeldet = Date.now();
          sag("Faktionsarbeit ausgesetzt: die Bladeburner-Division traegt"
            + " diesen Knoten, Arbeit wuerde ihre Aktionen abbrechen.");
        }
      } else if (figFrei("faktion", ziel.faktion,
                   "Reputation fuer " + (ziel.aug || "die Spendenschwelle"))
                 && ns.singularity.workForFaction(ziel.faktion, art, true)) {
        // Ein Schwellenziel traegt den Namen der billigsten offenen
        // Augmentierung, aber die Reputationsmarke der Spendenschwelle. Wer
        // das nicht weiss, liest "Synfibril Muscle: 31918 von 458941" und
        // haelt den Bot fuer entgleist - die Zahl gehoert zu keiner
        // Augmentierung. Deshalb steht hier, was wirklich gemeint ist.
        sag(ziel.istSchwelle
          ? "Arbeite fuer " + ziel.faktion + " (" + art + ") auf SPENDENRECHT: "
            + Math.round(ziel.rep) + " von " + Math.round(ziel.repReq)
            + " Reputation - danach ist der ganze Katalog dieser Faktion"
            + " eine Geldfrage."
          : "Arbeite fuer " + ziel.faktion + " (" + art + ") auf "
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
      // Fuer tools/wache.js: woran erkennt man von aussen einen
      // Knotenwechsel? getResetInfo ist hier ohnehin schon aufgerufen
      // (FACTION_REP_GAIN weiter oben), die Zahl kostet also kein Gigabyte
      // extra - anders als dieselbe Zeile in bn4net.js, das auf jedem
      // Rechner des Netzes liegt.
      knoten: ns.getResetInfo().currentNode,
      // DIE KNOTENNUMMER ALLEIN REICHT NICHT (28.08.2026, 09:22).
      //
      // Eric will Push bei jedem BitNode-Eintritt - auch wenn DERSELBE Knoten
      // noch einmal gewaehlt wird (Level 2 und 3 verlangen genau das). Die
      // Nummer aendert sich dann nicht, also erkennt der Waechter es daran
      // nicht.
      //
      // `lastNodeReset` erkennt es: Es wird ausschliesslich in
      // `prestigeSourceFile()` gesetzt
      // (`PersonObjects/Player/PlayerObjectGeneralMethods.ts:173`), ein
      // Augmentierungs-Einbau setzt nur `lastAugReset` (`:126`). Damit ist
      // die Unterscheidung exakt die, die Eric verlangt hat: Knoteneintritt
      // meldet, gewoehnlicher Reset nicht.
      nodeReset: ns.getResetInfo().lastNodeReset,
      augReset: ns.getResetInfo().lastAugReset,
      // Die vier Zahlen, an denen das Endspiel haengt - fuer das Dashboard.
      // Alle vier sind an dieser Stelle laengst berechnet, sie kosten also
      // nichts ausser den Bytes in der Datei.
      zielLevel,
      hacking: spieler.skills.hacking,
      multHacking: spieler.mults.hacking,
      redPill: ausgangSteht,
      repGesamt,
      favor,
      favorBeste,
      favorBesteFaktion,
      spendenSchwelle: ns.getFavorToDonate(),
      faktionen: spieler.factions,
      ziel: ziel.aug,
      zielFaktion: ziel.faktion,
      istSchwelle: !!ziel.istSchwelle,
      rangliste,
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
