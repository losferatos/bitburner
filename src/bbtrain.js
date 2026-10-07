/**
 * Der Eintritt in die Bladeburner-Division.
 *
 * WARUM ES DIESES SKRIPT BRAUCHT
 *
 * BitNode 6 wird nicht ueber das Hackniveau abgeschlossen, sondern ueber 21
 * Black Ops (`destroyW0r1dD43m0n` akzeptiert beides, Singularity.ts:1124-1176).
 * Der Hacking-Weg ist hier praktisch versperrt: WorldDaemonDifficulty 2 hebt
 * das Ziel auf Level 6.000, waehrend HackExpGain 0,25 jede Erfahrung viertelt.
 *
 * Der Bladeburner-Weg hat dafuer ein eigenes Tor: **alle vier Kampfwerte
 * muessen mindestens 100 sein** (NetscriptFunctions/Bladeburner.ts:356). In
 * der Nacht zum 25.08.2026 stand der Bot nach sieben Stunden bei 95 von 95
 * gerooteten Rechnern, 755 Millionen Dollar - und Kampfwerten von jeweils 1.
 * Er hat die ganze Nacht in eine Richtung gearbeitet, die in diesem Knoten
 * nicht zum Ausgang fuehrt.
 *
 * Dieses Skript raeumt das Tor weg und beendet sich danach. Es laeuft einmal
 * je BitNode, nicht dauernd.
 *
 * KOSTEN
 *
 * gymWorkout ist ein Singularity-Aufruf, kostet also mit SF4.1 ausserhalb von
 * BitNode 4 das Sechzehnfache: 32 GB. Zusammen mit dem Rest liegt das Skript
 * bei rund 40 GB - es passt auf home, sobald der Kaltstart vorbei ist, und
 * gehoert deshalb NICHT in die Werkzeugliste des Motors, die auch im frischen
 * Knoten greifen muss.
 *
 * @param {NS} ns
 */

// --- Die Figur-Wache (Position C.11) ---------------------------------------
//
// Es gibt genau EINE Spielfigur, und sechs Gewerke wollen sie. Ohne diesen
// Riegel gewinnt, wer zuletzt schreibt. Der Kern ist der Schiedsrichter
// (Abschnitt 9a in bn4net.js); hier wird nur beantragt und nachgesehen.
import { beantrage as figBeantrage, darf as figDarf } from "lib/figurns.js";
import { PRIO as FIG_PRIO } from "lib/figur.js";

export async function main(ns) {
  ns.disableLog("ALL");
  // Aeussere Schleife: Nach jedem Augmentierungs-Einbau faellt der Beitritt
  // nicht weg, wohl aber - in einem frischen Knoten - die Kampfwerte. Das
  // Skript laeuft deshalb dauerhaft und faengt bei Bedarf von vorn an.
  for (;;) {
    await runde(ns);
    await ns.sleep(30000);
  }
}

/** @param {NS} ns */
async function runde(ns) {

  const ZIEL = Number(ns.args[0]) || 100;
  // DAS BESTE STUDIO, NICHT DAS NAECHSTE (25.08.2026).
  //
  // Der Ortsmultiplikator geht voll in die Erfahrung ein, und die Spanne ist
  // gross (LocationsMetadata.ts):
  //   Powerhouse Gym, Sector-12   expMult 10
  //   Snap Fitness, Aevum         expMult  5
  //   Millenium Fitness, Volhaven expMult  4
  //   Crush Fitness, Aevum        expMult  2
  //   Iron Gym, Sector-12         expMult  1
  //
  // Gemessen am 25.08. um 05:34 in Crush Fitness: von Kampfwert 1 auf gut 3
  // in zehn Minuten. Hochgerechnet auf 100 waeren das Tage. In Powerhouse ist
  // dieselbe Strecke fuenfmal kuerzer, und die Reise kostet einmalig $200.000
  // bei einem Guthaben von 741 Millionen.
  //
  // Die Reise ist unbedenklich: travelToCity aendert nur den Aufenthaltsort.
  // Mitgliedschaften in Stadtfaktionen bleiben bestehen - verloren geht
  // hoechstens die Moeglichkeit, EINER weiteren beizutreten, und die
  // Stadtfaktionen sind fuer diesen Knoten ohne Bedeutung.
  const BESTES_GYM = { stadt: "Sector-12", name: "Powerhouse Gym" };
  const GYM = {
    "Sector-12": "Powerhouse Gym",
    Aevum: "Snap Fitness Gym",
    Volhaven: "Millenium Fitness Gym",
  };
  const WERTE = [
    ["strength", "str"], ["defense", "def"],
    ["dexterity", "dex"], ["agility", "agi"],
  ];

  const sag = (t) => { ns.print(t); ns.tprint("[bbtrain] " + t); };
  // Herzschlag (02.09.2026): bn4net beendet und startet ein Werkzeug neu,
  // dessen Telemetrie zu alt ist - bbtrain hatte keine. Steht am Kopf
  // beider Schleifen unten.
  const herzschlag = () => {
    try {
      // `ziel` veroeffentlicht das Kampfwert-Ziel: bn4rep laesst Faktionsarbeit
      // neben Bladeburner (Simulacrum) erst zu, wenn es erreicht ist.
      ns.write("data/bbtrain.json", JSON.stringify({ zeit: Date.now(), host: ns.getHostname(), ziel: ZIEL }), "w");
      if (ns.getHostname() !== "home") ns.scp("data/bbtrain.json", "home", ns.getHostname());
    } catch { /* egal */ }
  };

  // Schon drin? Dann gibt es hier nichts zu tun.
  // NICHT BEENDEN, SONDERN WARTEN (25.08.2026).
  //
  // Hier stand `return`, sobald der Beitritt stand - mit der Begruendung, das
  // Skript habe seine Arbeit getan. Das war falsch, und zwar teuer: Um 05:50
  // hat bn4rep sechs Augmentierungen eingebaut. Ein Einbau setzt ALLE
  // Kampfwerte auf 1 zurueck und toetet jedes laufende Skript. bbtrain war
  // deshalb weg, stand nicht in der Werkzeugliste (weil es sich ja beendet)
  // und wurde nie wieder gestartet. Drei Stunden Training waren verloren, und
  // niemand hat es gemerkt.
  //
  // Ein Skript, dessen Aufgabe nach jedem Reset erneut anfaellt, darf sich
  // nicht beenden. Es wartet.
  // DER BEITRITT IST NICHT DAS TOR - DIE KAMPFWERTE SIND ES (25.08.2026, 17:50).
  //
  // Hier stand `while (inBladeburner()) sleep`. Das war als Ruhezustand nach
  // getaner Arbeit gedacht und ist eine Falle: Nach dem Beitritt ist die
  // Bedingung fuer immer wahr, also schlaeft bbtrain fuer immer.
  //
  // Ein Augmentierungs-Einbau setzt alle vier Kampfwerte auf 1 zurueck, waehrend
  // Rang und Faehigkeiten ueberleben - bn4rep laesst Einbauten nach dem Beitritt
  // wieder zu (bn4rep.js:618-624 sperrt nur davor). Danach findet blade.js mit
  // Kampf 1/1/1/1 keine Aktion mehr ueber seinen Schwellen und faellt auf
  // Bladeburner-Training durch. Das baut die Werte zwar wieder auf, aber ohne
  // den Ortsmultiplikator des Powerhouse Gym (Faktor 10) und ohne jeden Rang.
  //
  // Ausgerechnet die Reparatur von heute Morgen - "ein Skript, dessen Aufgabe
  // nach jedem Reset erneut anfaellt, darf sich nicht beenden" - hat diesen
  // Zustand erzeugt: Das Beenden wurde durch ein Warten ersetzt, das nie endet.
  // Gefunden hat es eine Fremdpruefung, kein Loop.
  //
  // Gewartet wird deshalb auf den Zustand, nicht auf das Ereignis.
  // GRAFTING DARF NICHT UNTERBROCHEN WERDEN (30.08.2026, 21:15).
  //
  // Dieses Skript startet Gym-Arbeit und ruft `stopAction()`. Beides ist
  // `startWork` beziehungsweise `finishWork(true)` und toetet jedes laufende
  // Graft - das Geld dafuer wird NICHT erstattet
  // (`Work/GraftingWork.tsx:75-83`), beim Simulacrum sind das $450 Mrd.
  //
  // Warum das keine ferne Moeglichkeit ist, sondern der geplante Ablauf:
  // Jedes fertige Graft bucht einen Entropiestapel, und der senkt ALLE
  // Multiplikatoren um zwei Prozent (`EntropyAccumulation.ts:7`). Gerechnet
  // gegen den Spielstand vom 30.08., 20:52:
  //
  //     Entropie 0   str 103  def 102  dex 135  agi 115   Tiefstand 102
  //     Entropie 1   str 101  def 100  dex 132  agi 113   Tiefstand 100
  //     Entropie 2   str  99  def  98  dex 130  agi 111   Tiefstand  98
  //
  // Nach dem zweiten Graft faellt der Tiefstand unter ZIEL, dieses Skript
  // verlaesst seine Warteschleife - und toetet ab dann jedes Graft binnen
  // hoechstens 60 Sekunden. Genau das dritte ist die erste
  // Kampf-Augmentierung des Pakets.
  const graftLaeuft = () => {
    try {
      const w = ns.singularity.getCurrentWork();
      return !!w && w.type === "GRAFTING";
    } catch { return false; }
  };
  let letzterGrund = "";
  for (;;) {
    herzschlag();
    let drin = false;
    try { drin = ns.bladeburner.inBladeburner(); } catch { drin = false; }
    if (!drin) break;
    const k = ns.getPlayer().skills;
    const tief = Math.min(k.strength, k.defense, k.dexterity, k.agility);
    if (tief < ZIEL) {
      if (graftLaeuft()) {
        sag("Kampfwerte bei " + tief + ", aber ein Graft laeuft - warte ab.");
        await ns.sleep(60000);
        continue;
      }
      sag("In der Division, aber Kampfwerte bei " + tief + " - trainiere nach.");
      break;
    }
    await ns.sleep(60000);
  }

  // DIE STADT GEHOERT IN DIE SCHLEIFE, NICHT DAVOR (25.08.2026).
  //
  // Hier wurden Stadt und Studio EINMAL vor der Trainingsschleife bestimmt.
  // Das haelt genau so lange, wie niemand sonst die Figur bewegt - und genau
  // das tut bn4life.js: Es reist nach Aevum, sobald das Guthaben 45 Millionen
  // ueberschreitet, um der Stadtfaktion beizutreten (bn4life.js:203-212).
  //
  // Gemessen am 25.08. um 15:56 in BitNode 6, nach siebeneinhalb Stunden Lauf:
  //   str 93, def 1, dex 1, agi 1 - Stadt Aevum, laufende Arbeit "Powerhouse
  //   Gym" (Sector-12).
  // bbtrain hatte in Sector-12 begonnen, `gym` auf Powerhouse festgeschrieben
  // und die Schleife nie wieder verlassen. Nach der Reise nach Aevum lehnte
  // gymWorkout("Powerhouse Gym", ...) jeden Aufruf ab - der Bot lief alle 30
  // Sekunden in denselben Fehlschlag, waehrend die alte, nie gestoppte
  // str-Arbeit weiterlief. Drei von vier Kampfwerten standen bei 1, und das
  // Beitrittstor ist ein MINIMUM ueber alle vier: der Knoten war zu.
  //
  // Ein Skript, das eine Vorbedingung nur beim Eintritt prueft, verlaesst sich
  // darauf, alleiniger Herr der Figur zu sein. Das ist es hier nie.
  // Fuer die Figur-Wache: die zuletzt gesehene Folgenummer der Vergabe und
  // der zuletzt gemeldete Grund - sonst stuende jede Runde dieselbe Zeile.
  let figSeq = null;
  let figGrundLetzt = null;
  for (;;) {
    herzschlag();
    const p = ns.getPlayer();
    // Der niedrigste Wert zuerst. Das Tor ist ein Minimum ueber alle vier -
    // wer den hoechsten weitertreibt, kommt dem Ziel keinen Schritt naeher.
    let schlechtester = null, tiefstand = Infinity;
    for (const [lang, kurz] of WERTE) {
      const wert = p.skills[lang];
      if (wert < tiefstand) { tiefstand = wert; schlechtester = kurz; }
    }

    if (tiefstand >= ZIEL) break;

    // Jede Runde neu: Wo stehen wir, und welches Studio gilt hier?
    let stadt = p.city;
    if (stadt !== BESTES_GYM.stadt && p.money > 1e6) {
      // Die Reise kostet 200.000 (LocationsMetadata) und bringt den Faktor 10
      // statt 5 - sie rechnet sich nach wenigen Minuten. Die Million als
      // Untergrenze verhindert nur, dass ein knapper Kontoschluss die Reise
      // gegen laufende Kaeufe stellt.
      if (ns.singularity.travelToCity(BESTES_GYM.stadt)) {
        stadt = BESTES_GYM.stadt;
        sag("Zurueck nach " + BESTES_GYM.stadt + " (" + BESTES_GYM.name + ").");
      }
    }

    const gym = GYM[stadt];
    if (!gym) {
      // Kein Notruf mehr (02.09.2026): Die Reise scheitert nur am Geld
      // (< 1 Mio), und das kommt von bn4life (Verbrechen) und dem Netz von
      // selbst. Warten ist die Handlung.
      if (letzterGrund !== "stadt") {
        sag("Kein Studio fuer " + stadt + " und Reise nach " + BESTES_GYM.stadt
          + " misslang (Konto " + (p.money / 1e6).toFixed(2) + " Mio) - warte auf Reisegeld.");
        letzterGrund = "stadt";
      }
      await ns.sleep(60000);
      continue;
    }

    // ORT UND WERT MUESSEN BEIDE STIMMEN (25.08.2026).
    //
    // Vorher wurde nur der trainierte Wert verglichen. Damit galt eine
    // str-Arbeit im falschen Studio als "trainiert schon" - der Kern des
    // Fehlers oben. Ein Vergleich, der den Ort auslaesst, kann einen
    // Ortswechsel nicht bemerken.
    // KEIN GYM AUF PUMP (27.08.2026, 06:52).
    //
    // Das Powerhouse Gym kostet 2.400 Dollar je Sekunde, und weder die
    // Oberflaeche noch `applyWorkStats` pruefen den Kontostand
    // (`Work/ClassWork.tsx:22-73`, `PlayerObjectGeneralMethods.ts:216-224` -
    // `gainMoney` hat keinen Boden). Nach einem Einbau ist das Konto leer:
    // Gemessen am 27.08. um 04:45, knapp eine Stunde nach dem Einbau, stand
    // es bei **-3 Millionen**. Ein negatives Guthaben blockiert jeden Kauf -
    // Portprogramme, Server, Augmentierungen -, und genau die braucht der
    // Wiederaufbau.
    //
    // Der Ausweg kostet nichts: Findet `blade.js` keine Aktion ueber seinen
    // Schwellen - und mit Kampfwerten um 1 findet es keine -, faellt es von
    // selbst auf Bladeburner-Training durch. Das ist gratis
    // (`Bladeburner.ts:1091-1105`) und hebt dieselben Werte, nur ohne den
    // Ortsmultiplikator des Gyms.
    //
    // Also: unter der Schwelle gar nichts tun und blade.js machen lassen.
    // Die 5 Millionen sind rund 35 Minuten Gym - genug Abstand, dass ein
    // Kauf dazwischen nicht ins Minus fuehrt.
    const GYM_MIN_GELD = 5e6;
    if (ns.getPlayer().money < GYM_MIN_GELD) {
      // DIE LAUFENDE ARBEIT MUSS WEG (27.08.2026, 15:18).
      //
      // Bis eben stand hier nur `continue` - das unterlaesst den NEUSTART,
      // beendet aber die bereits laufende Gym-Arbeit nicht. Sie laeuft im
      // Spiel weiter, auf dem Wert, der beim letzten erfolgreichen Durchlauf
      // der niedrigste war, und zieht dabei weiter Geld.
      //
      // Gemessen nach dem Einbau um 14:40: Das Konto lag von der ersten
      // Sekunde an unter der Schwelle, also lief jede Runde ins `continue`.
      // Die dex-Arbeit aus der einen Runde davor blieb stehen. Um 15:10 stand
      // **dex bei 289, agi bei 88** - der Tiefstand hatte sich seit 14:52
      // nicht um einen Punkt bewegt, waehrend dex um 39 gestiegen war. Der
      // Kontostand fiel im selben Zeitraum von 6 auf 1,5 Millionen.
      //
      // Also kostete der Zustand doppelt: Er verlaengerte die
      // Wiederaufbauphase UND leerte die Kasse, die der Wiederaufbau braucht.
      // Gestoppt wird nur eine CLASS-Arbeit - eine laufende
      // Bladeburner-Aktion geht das hier nichts an.
      const laufendeArbeit = ns.singularity.getCurrentWork();
      if (laufendeArbeit && laufendeArbeit.type === "CLASS") {
        ns.singularity.stopAction();
      }
      if (letzterGrund !== "arm") {
        sag("Konto unter " + (GYM_MIN_GELD / 1e6) + " Mio - kein Gym."
          + " blade.js trainiert gratis weiter.");
        letzterGrund = "arm";
      }
      await ns.sleep(60000);
      continue;
    }
    const laeuft = ns.singularity.getCurrentWork();
    if (laeuft && laeuft.type === "GRAFTING") {
      if (letzterGrund !== "graft") {
        sag("Ein Graft laeuft - kein Gym, keine Reise, kein stopAction.");
        letzterGrund = "graft";
      }
      await ns.sleep(60000);
      continue;
    }
    // DAS ZURUECKSETZEN GEHOERT HINTER DEN GRAFT-ZWEIG (31.08.2026, 02:45,
    // Skeptiker-Restbefund 3). Es stand davor - damit war
    // `letzterGrund !== "graft"` in JEDER Runde wahr und die Drosselung tot.
    // `sag()` schreibt auch ins Terminal: bei einem Graft von 2 Stunden
    // rund 120 Zeilen statt einer, mal 38 Stuecke des Pakets. Der
    // "arm"-Zweig darueber funktionierte nur, weil er vor dieser Zeile
    // `continue`t.
    letzterGrund = "";
    const trainiertSchon = laeuft && laeuft.type === "CLASS"
      && laeuft.classType === schlechtester
      && (!laeuft.location || laeuft.location === gym);
    if (!trainiertSchon) {
      // DIE FIGUR-WACHE. `gymWorkout` beendet jede laufende Arbeit der Figur -
      // Faktionsarbeit, Verbrechen, und vor allem einen laufenden Graft.
      figBeantrage(ns, "bbtrain.js", FIG_PRIO.gym, "gym",
        schlechtester, "Kampfwerte auf 100 fuer den Bladeburner-Beitritt");
      const figW = figDarf(ns, "bbtrain.js", figSeq);
      if (figW.seq !== null) figSeq = figW.seq;
      if (!figW.darf) {
        if (figGrundLetzt !== figW.grund) {
          sag("Figur nicht frei: " + figW.grund + " - warte.");
          figGrundLetzt = figW.grund;
        }
        await ns.sleep(15000);
        continue;
      }
      figGrundLetzt = null;
      if (!ns.singularity.gymWorkout(gym, schlechtester, false)) {
        sag("gymWorkout abgelehnt (" + schlechtester + " in " + gym + ").");
        await ns.sleep(30000);
        continue;
      }
      sag(schlechtester + " bei " + tiefstand + " in " + gym + " - trainiere weiter.");
    }
    // Laenger schlafen als frueher: Der Wechsel lohnt erst, wenn ein anderer
    // Wert der niedrigste geworden ist. Bei zwanzig Sekunden wurde die Arbeit
    // staendig neu gestartet, ohne dass sich an der Rangfolge etwas aenderte.
    await ns.sleep(60000);
  }

  sag("Alle Kampfwerte >= " + ZIEL + " - trete bei.");
  // NICHT unbedingt: `stopAction` ist `finishWork(true)` (`Singularity.ts:562`)
  // und wuerde ein laufendes Graft toeten. Die Gym-Arbeit, die hier beendet
  // werden soll, kann gar nicht laufen, wenn stattdessen gegraftet wird.
  if (!graftLaeuft()) ns.singularity.stopAction();

  if (ns.bladeburner.joinBladeburnerDivision()) {
    sag("BLADEBURNER-DIVISION BEIGETRETEN.");
    ns.write("data/bbjoin.txt", String(Date.now()), "w");
    // ns.write schreibt LOKAL, und bbtrain laeuft auf der Werkbank, nicht auf
    // home. Ohne diese Zeile liegt der Beitrittszeitpunkt auf einem Rechner,
    // auf dem niemand nachsieht - am 25.08. hat genau das den Zeitstempel
    // gekostet, an dem der Zwei-Stunden-Kontrollpunkt aus nodes/ROUTE.md haengt.
    if (ns.getHostname() !== "home") ns.scp("data/bbjoin.txt", "home", ns.getHostname());
  } else {
    // Kein Notruf mehr (02.09.2026): Der Beitritt wird abgelehnt, wenn die
    // Werte doch unter 100 liegen (Entropie, Einbau) oder der Knoten keine
    // Division kennt (BitNode 8 - dort startet bn4net dieses Skript nicht).
    // Die naechste Runde misst neu; das ist die Handlung.
    sag("Beitritt abgelehnt - messe in einer Minute neu.");
  }
}
