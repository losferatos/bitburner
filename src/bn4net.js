/**
 * BitNode 4 - die Netzhaelfte.
 *
 * ARBEITSTEILUNG
 *
 * Dieses Skript fasst NUR Rechner an: rooten, Arbeiter ausbringen, home
 * ausbauen. Es ruehrt die Spielfigur nicht an - kein Verbrechen, keine
 * Arbeit, kein Faktionsbeitritt. Das macht bn4life.js, und zwar als einzige
 * Instanz.
 *
 * Der Grund steht in den Truemmern von BitNode 1: Dort griffen autopilot.js,
 * work.js und buyaugs.js gleichzeitig auf dieselbe Arbeitsseite zu. Eines
 * beendete die Arbeit des anderen, gemeldet wurde trotzdem Erfolg. Wenn genau
 * ein Skript die Figur steuert, kann das nicht passieren.
 *
 * WOZU HACKING HIER UEBERHAUPT NOCH GUT IST
 *
 * Nicht fuers Geld. In BitNode 4 ist ServerMaxMoney 0.1125 und ScriptHackMoney
 * 0.2 - zusammen 2,25 % des Ertrags aus BitNode 1. Verbrechen bringt bei
 * CrimeMoney 0.2 rund das Neunfache. Die Arbeiter laufen trotzdem, weil das
 * Hacking-LEVEL gebraucht wird: fuer Serverzugang, fuer Faktionen wie
 * BitRunners, und am Ende fuer w0r1d_d43m0n - der hier wegen
 * WorldDaemonDifficulty 3 nicht 3000 verlangt, sondern 9000.
 *
 * Erschwerend: HackExpGain ist 0.4. Das Level waechst zweieinhalb Mal
 * langsamer als gewohnt. Umso frueher muss es anfangen.
 *
 * @param {NS} ns
 */
import { hackPercent as calcHackPercent, hackChance as calcHackChance,
  growthLogPerThread as calcGrowthLog } from "lib/calc.js";
import { laden as ladeRegistry, auswahl as regAuswahl, gilt as regGilt,
  telemetrieTabelle as regTelemetrie, zaehlwerk as regZaehlwerk,
  leseRolle, pruefeRolle, merkmaleAusReset } from "lib/reg.js";
import {
  runde as mzRunde, motorStunden as mzStunden,
  zuruecksetzen as mzZuruecksetzen, laden as mzLaden,
} from "lib/motorzeit.js";
import { leer as kpiLeer, laden as kpiLaden, neuerLauf as kpiNeuerLauf,
  KPI_VERSION } from "lib/kpi.js";
import { vergib as figVergib, antragGilt as figAntragGilt,
  vergabeGilt as figVergabeGilt } from "lib/figur.js";
import { laden as evLaden, anhaengen as evAnhaengen } from "lib/events.js";

export async function main(ns) {
  ns.disableLog("ALL");

  // Reserve auf home. ACHTUNG, hier lag der erste Fehler dieses BitNode: 12 GB
  // reichen nicht. bn4net.js belegt selbst 19,65 GB (gemessen am 22.08.2026,
  // davon 3 GB fuer hackAnalyze/hackAnalyzeChance/growthAnalyze aus der
  // Aktionsmischung), bn4life.js braucht 22,8 - zusammen 42,45. Auf einem
  // 32-GB-home passen beide NICHT MEHR nebeneinander; das trifft nach einem
  // BitNode-Wechsel zu (Prestige.ts:243-249 setzt home auf 32 GB zurueck),
  // nicht nach einem Augmentierungs-Einbau. Wer dorthin geht, muss die
  // Mischung vorher wieder auf die nachgebauten Formeln umstellen oder
  // bn4net.js aufteilen. Wer nur 12 reserviert, laesst die Arbeiter die
  // restlichen 9 GB fressen, und bn4life.js startet nie. Genau die Falle, die
  // der Skeptiker vorhergesagt hatte: RAM-Aushungern von home durch die
  // eigenen Worker. Bei 20 bleibt auf einem 32-GB-home gar kein Arbeiter -
  // richtig so, denn die Steuerung ist mehr wert als drei Faeden. Sobald home
  // verdoppelt ist, ist wieder Platz.
  // Waechst mit home mit. Eine feste Reserve entwertet jeden Ausbau: Die
  // Arbeiter belegen binnen zehn Sekunden alles Neue, und der naechste
  // Baustein - Contract-Loeser, Autopilot - passt nie hinein. Untergrenze ist
  // bn4life.js selbst (19,85 GB), sonst kann es nach einem Absturz nicht mehr
  // starten.
  let werkbankMerker = null;
  // Groesstes Werkzeug, das in der letzten Runde nirgends Platz fand (GB).
  // Der Ausbau (Abschnitt 1a2) liest es und zieht den GROESSTEN Rechner
  // hoch - siehe dort.
  let werkzeugWartetGb = 0;
  const auftragVersuche = new Map();   // data/task.txt-Inhalt -> Fehlversuche
  // Stillstandserkennung: Werkzeug -> Telemetriedatei auf home -> hoechstes
  // erlaubtes Alter. Takte: blade/sleeve/ausgang/bbtrain 30-60 s, bn4life
  // 15 s. Grosszuegig, weil ein gedrosselter Tab die Schreibtakte streckt.
  // =========================================================================
  // DIE REGISTRY LOEST DIESE BEIDEN LISTEN AB (Position C.5, 04.09.2026)
  // =========================================================================
  //
  // Bis heute standen dieselben Angaben an zwei Stellen: hier, was ueberwacht
  // wird, und weiter unten in WERKZEUGE, was gestartet wird. Beide von Hand
  // gepflegt, beide muessen zusammenpassen - und niemand merkt es, wenn sie es
  // nicht tun. Ein Werkzeug ohne Telemetrieeintrag laeuft unbeaufsichtigt, ein
  // Telemetrieeintrag ohne Werkzeug meldet ewig "veraltet".
  //
  // Beide werden jetzt aus registry.json ABGELEITET. Die Form bleibt exakt
  // dieselbe, damit die acht Nutzungsstellen unveraendert bleiben - ein Umbau
  // an acht Stellen waere die riskantere Aenderung.
  //
  // DER RUECKFALL IST DIE ENTSCHEIDENDE SICHERUNG: fehlt registry.json oder
  // ist sie unlesbar, gelten die eingebauten Listen weiter. Ohne ihn wuerde
  // eine fehlende Datei den Bot vollstaendig stilllegen - und genau das
  // passiert nach einem Knotenwechsel, bevor die Bruecke die Dateien
  // nachgeschoben hat.
  let regGeladen = null;
  let regGrund = "registry.json nicht gelesen";
  try {
    const roh = ns.fileExists("registry.json", "home") ? ns.read("registry.json") : null;
    const r = ladeRegistry(roh);
    if (r && Array.isArray(r.eintraege) && r.eintraege.length && !r.fehler) {
      regGeladen = r;
      regGrund = r.eintraege.length + " Eintraege";
    } else {
      regGrund = (r && r.fehler) || "registry.json leer";
    }
  } catch (e) {
    regGrund = "registry.json warf: " + String(e && e.message ? e.message : e);
  }

  // Die BitNode-Multiplikatoren, einmal gelesen. Sie aendern sich innerhalb
  // eines Laufs nicht - und ein Feld, das hier fehlt, ist 1, NICHT 0. Wer
  // fehlende Felder als 0 liest, setzt jede Beute auf null.
  let bnScriptHackMoney = 1;
  let bnServerGrowthRate = 1;
  try {
    const roh = ns.fileExists("lib/bitnodes.json", "home") ? ns.read("lib/bitnodes.json") : null;
    const t = roh ? JSON.parse(roh) : null;
    const n = ns.getResetInfo().currentNode;
    const k = t && t.knoten ? t.knoten[String(n)] : null;
    if (k) {
      if (Number.isFinite(k.ScriptHackMoney)) bnScriptHackMoney = k.ScriptHackMoney;
      if (Number.isFinite(k.ServerGrowthRate)) bnServerGrowthRate = k.ServerGrowthRate;
    }
  } catch { /* dann gelten die Standardwerte 1 */ }

  // =========================================================================
  // DER RECHNERPARK LAEUFT UEBER shop.js (Position C.7)
  // =========================================================================
  //
  // Die ns.cloud-Familie kostet 4,00 GB (nachgerechnet gegen
  // RamCostGenerator.ts:222-229; hier stand zunaechst 3,85, weil zwei
  // Funktionen in der Aufzaehlung fehlten) - mehr als ein Zehntel des
  // Kaltstart-Budgets, fuer eine Handlung, die vielleicht einmal je Stunde
  // vorkommt. Der Kern behaelt die ENTSCHEIDUNG (er weiss als einziger, was
  // wartet und was das Geld sonst soll) und gibt die AUSFUEHRUNG ab.
  //
  // Die Preise kommen aus data/preise.json, das shop.js alle 30 s schreibt -
  // gefragt, nicht gerechnet: in BitNode 4 verteuert CloudServerSoftcap 1,2
  // die grossen Rechner ueberproportional, und eine nachgebaute Formel waere
  // genau die Falle vom 30.08.
  //
  // OHNE preise.json GIBT ES KEINEN PARK. Das ist Absicht: lieber gar nicht
  // kaufen als auf geratenen Preisen. Der Bot laeuft dann mit dem, was er hat,
  // und meldet es - er steht nicht.
  const parkLage = () => {
    const leer = { da: false, kaufbar: false, limitAnzahl: 0, limitRam: 0,
      park: [], preise: {}, alterMs: null };
    try {
      if (!ns.fileExists("data/preise.json", "home")) return leer;
      const t = JSON.parse(ns.read("data/preise.json"));
      if (!t || !Number.isFinite(t.ts)) return leer;
      const alterMs = Date.now() - t.ts;
      // Aelter als fuenf Minuten heisst: shop.js laeuft nicht. Dann sind auch
      // die PREISE nicht mehr verlaesslich - die Auskunft, OB es in diesem
      // Knoten ueberhaupt Mietrechner gibt, sehr wohl. `CloudServerLimit`
      // aendert sich innerhalb eines Laufs nie (es ist ein
      // BitNode-Multiplikator), und in BitNode 9 steht es auf 0.
      //
      // Die Unterscheidung ist noetig, weil sonst ein Zirkel entsteht: der
      // Kern hielte shop.js in BN9 fuer unnoetig, sobald er weiss, dass dort
      // nichts zu kaufen ist - und wuesste es nach fuenf Minuten nicht mehr.
      if (alterMs > 300000) return { ...leer, alterMs, kaufbarBekannt: t.kaufbar !== false };
      // AUS DEM ALTEN KNOTEN IST NICHT "ALT GENUG" (04.09.2026).
      //
      // installAugmentations und der BitNode-Sprung loeschen JEDEN gekauften
      // Rechner (Prestige.ts:73). Eine Preistabelle von vor einer Minute ist
      // danach nicht etwa leicht veraltet, sondern vollstaendig falsch: der
      // Park existiert nicht mehr, und im neuen Knoten gelten andere Preise
      // (CloudServerSoftcap 1,2 in BitNode 4, CloudServerLimit 0 in BN9).
      //
      // Fuenf Minuten Frist haetten hier nicht getragen - der Sprung dauert
      // Sekunden. Deshalb der harte Schnitt am Reset, nicht an der Uhr.
      //
      // BEIDE PRESTIGES, NICHT NUR DER SPRUNG (Skeptiker Runde 3, K3,
      // 04.09.2026). Hier stand allein `lastNodeReset`. `prestigeAugmentation`
      // ruft aber `prestigeAllServers()` und setzt `purchasedServers = []`
      // (Prestige.ts:55-75, PlayerObjectGeneralMethods.ts:109) - nach jedem
      // Augmentierungs-Einbau ist der Park also genauso weg wie nach einem
      // Sprung. Bis die Fuenf-Minuten-Frist griff, rechnete der Kern vier bis
      // fuenf Minuten lang mit einem Geisterpark: er hielt Werkbaenke fuer
      // vorhanden, die es nicht gab, und uebersprang deshalb die
      // Kaltstart-Leiter - genau in den Minuten nach einem Einbau, in denen
      // sie gebraucht wird.
      try {
        const ri = ns.getResetInfo();
        const reset = Math.max(ri.lastNodeReset || 0, ri.lastAugReset || 0);
        if (reset > 0 && t.ts < reset) {
          return { ...leer, alterMs, ausAltemKnoten: true };
        }
      } catch { /* kein getResetInfo - dann traegt die Fuenf-Minuten-Frist */ }
      return {
        da: true,
        kaufbar: t.kaufbar !== false,
        limitAnzahl: Number(t.limitAnzahl) || 0,
        limitRam: Number(t.limitRam) || 0,
        park: Array.isArray(t.park) ? t.park : [],
        preise: t.preise || {},
        alterMs,
      };
    } catch { return leer; }
  };

  /**
   * Einen Kaufauftrag stellen. Er wird von shop.js genau einmal ausgefuehrt.
   *
   * Der Kern erfaehrt das Ergebnis erst in der naechsten Runde ueber
   * data/kaufergebnis.json - und das ist besser als der alte Weg: ein Kauf,
   * der scheitert, weil das Geld gerade nicht reicht, bleibt als Auftrag
   * stehen und wird nachgeholt, statt in jeder Runde neu entschieden zu
   * werden.
   */
  let offenerAuftrag = null;
  const beauftrage = (art, gb, grund, host = null) => {
    const id = "a" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const auftrag = { id, art, gb, grund, host, ts: Date.now() };
    try {
      ns.write("data/kaufauftrag.json", JSON.stringify(auftrag), "w");
      offenerAuftrag = auftrag;
      return true;
    } catch { return false; }
  };

  /** Steht noch ein Auftrag offen? Dann wird in dieser Runde nichts Neues bestellt. */
  const auftragOffen = () => {
    if (!offenerAuftrag) return false;
    try {
      if (!ns.fileExists("data/kaufergebnis.json", "home")) {
        // Ein Auftrag ohne Ergebnis gilt zehn Minuten als offen. Danach ist
        // shop.js vermutlich tot, und der Kern darf es erneut versuchen -
        // sonst wartet er ewig auf eine Antwort, die nie kommt.
        return Date.now() - offenerAuftrag.ts < 600000;
      }
      const e = JSON.parse(ns.read("data/kaufergebnis.json"));
      if (e && e.id === offenerAuftrag.id) {
        sag("Auftrag " + e.id + ": " + (e.erfolg ? "erledigt (" + e.ergebnis + ")"
          : "nicht ausgefuehrt (" + e.ergebnis + ")"));
        offenerAuftrag = null;
        return false;
      }
      return Date.now() - offenerAuftrag.ts < 600000;
    } catch { return false; }
  };

  const TELEMETRIE_FEST = [
    ["blade.js", "data/blade.json", 10 * 60000],
    ["sleeve.js", "data/sleeve.json", 10 * 60000],
    ["bn4life.js", "data/bn4life.json", 10 * 60000],
    ["ausgang.js", "data/ausgang.json", 10 * 60000],
    ["bbtrain.js", "data/bbtrain.json", 10 * 60000],
  ];
  const werkzeugSeit = new Map();   // Werkzeug -> erstmals laufend gesehen (ms)
  // Seit wann ein Werkzeug Platz auf home reserviert. Ueber Rundengrenzen
  // hinweg, weil die Frist sonst in jeder Runde neu begaenne und die
  // Reservierung nie verfiele.
  const reservierungSeit = new Map();
  // Wann ein Einmallaeufer zuletzt gestartet wurde - gegen den Neustart im
  // Rundentakt. Ueber Rundengrenzen hinweg.
  const einmalGestartet = new Map();
  // Zeitpunkt des letzten darkweb.js-Anlaufs (Abschnitt 2b1).
  let nachholMerker = 0;
  // Gedaechtnis ueber Rundengrenzen hinweg. Ein Ziel, das seit zwanzig
  // Minuten anlaeuft, ohne fertig zu werden, ist nur zu erkennen, wenn sich
  // irgendwer merkt, wann es angefangen hat - eine Runde allein sieht immer
  // nur den Augenblick. Genau deshalb konnte the-hub stundenlang 30 % des
  // Netzes binden, ohne dass es irgendwo auffiel.
  const anlaufSeit = new Map();     // Ziel -> Zeitstempel des Anlaufbeginns
  const gesperrtBis = new Map();    // Ziel -> Zeitstempel, ab dem es wieder darf
  // --- Stapelbetrieb (HWGW), Zustand ueber Rundengrenzen hinweg ------------
  // batchStand: Ziel -> { phase, proben[], fraction, stapel, seitLeer }
  //   phase "prep"  vorbereiten: Sicherheit auf das Minimum, Guthaben auf 100 %
  //   phase "batch" Stapel takten
  //   phase "drain" auslaufen lassen, weil die Kette aus der Reihe lief
  // batchKalender: Ziel -> Zeitpunkt der ZULETZT eingeplanten Landung.
  //   Das ist der Kern des ganzen Verfahrens. Er wird nur nach vorn gesetzt,
  //   nie zurueck - deshalb kann ein neuer Stapel einen alten NIE ueberholen,
  //   egal wie sehr das Hacking-Level zwischendurch steigt und die Laufzeiten
  //   verkuerzt. Landezeiten sind absolute Wanduhrzeiten, keine relativen
  //   Fristen; ein kuerzer gewordener Stapel startet einfach spaeter.
  const batchStand = new Map();
  const batchKalender = new Map();
  // GRENZERTRAG von zusaetzlichem Arbeitsspeicher, aus der VORIGEN Runde.
  // Die Serveraufruestung braucht ihn (Abschnitt 1a2), er entsteht aber erst
  // in Abschnitt 2 - eine Runde Verzoegerung ist unschaedlich, weil sich der
  // Wert nur mit Level und Zielauswahl aendert, also langsam.
  //
  // WARUM NICHT MEHR DER MITTELWERT (22.08.2026). Bis hierher stand hier der
  // Durchschnitt der laufenden Geldziele. Zwei Fehler auf einmal:
  //   (1) Seit die drei besten Ziele im Stapelbetrieb laufen, sind sie aus
  //       moneyTargets heraus - der Durchschnitt mittelte nur noch ueber die
  //       verbliebenen, schlechteren. Gemessen am 22.08.2026: 202 $/GB*s
  //       gemeldet, tatsaechlicher Grenzertrag fuer den anstehenden Schritt
  //       (4096 GB) 250 $/GB*s. Kaeufe wurden also 24 % unrentabler
  //       gerechnet, als sie sind.
  //   (2) Ein Durchschnitt ist ohnehin die falsche Groesse. Bezahlt wird der
  //       NAECHSTE Speicher, und der landet nicht beim Durchschnittsziel: Er
  //       geht der Reihe nach dorthin, wo noch Aufnahme frei ist. Und das
  //       haengt an der MENGE - gemessen im selben Zustand 301 $/GB*s fuer
  //       1024 GB, 250 fuer 4096, 154 fuer 16384, 112 fuer 65536. Eine
  //       einzelne Zahl kann das gar nicht abbilden, deshalb steht hier eine
  //       Kurve und eine Funktion, die sie fuer eine Menge auswertet.
  //
  // Zwei Listen, weil die beiden Verfahren zusaetzlichen Speicher voellig
  // verschieden aufnehmen - Begruendung bei grenzErtrag().
  // Leere Listen heissen "noch nichts gerechnet" und lassen keinen Ausbau zu.
  let grenzStapelMerker = [];   // [{eff, frei}] je Stapelziel
  let grenzOffenMerker = [];    // [{eff, frei}] je offenem Ziel, absteigend
  let grenzAnteilMerker = 0;    // F_NETZANTEIL der letzten Runde

  /**
   * Was bringen `gb` zusaetzliche Gigabyte Arbeitsspeicher, in $/GB*s?
   *
   * Die beiden Verfahren nehmen ihn verschieden auf:
   *
   *   STAPELZIELE nehmen einen ANTEIL des Netzes, keinen festen Betrag. Ihre
   *   Aufnahme ist ram(f) * kalenderPlaetze, und f waehlt der Stapelbetrieb
   *   selbst als das kleinste, dessen voller Kalender ramTotal*F_NETZANTEIL
   *   fasst. Waechst das Netz, waechst f mit - jedes Stapelziel schluckt also
   *   F_NETZANTEIL jedes zusaetzlichen Gigabytes, und zwar zur GRENZ-Guete
   *   der naechsten Leitersprosse (nicht zur Durchschnittsguete: die Sprosse
   *   bringt zusaetzliches Geld fuer zusaetzlichen Speicher, das Verhaeltnis
   *   der beiden Zuwaechse ist der Grenzertrag). Erst am oberen Ende der
   *   Leiter ist ein Ziel wirklich gesaettigt; dann steht in "frei" die
   *   restliche Aufnahme statt Infinity.
   *
   *   OFFENE ZIELE haben eine feste Kapazitaet (KAP_ABZUG, siehe kennzahlen).
   *   Was dort noch frei ist, wird der Guete nach aufgefuellt - das beste
   *   Ziel zuerst, genau wie die Zuteilung es tut.
   *
   * Was danach noch uebrig ist, bringt NICHTS. Das ist der Fall, den die
   * alte Zahl nicht kannte und der die Amortisationsrechnung wertlos macht,
   * sobald das Netz die Ziele ueberholt.
   */
  const grenzErtrag = (gb) => {
    if (!(gb > 0)) return 0;
    let ertrag = 0, rest = gb;
    for (const s of grenzStapelMerker) {
      const nimm = Math.min(grenzAnteilMerker * gb, s.frei);
      if (!(nimm > 0)) continue;
      ertrag += nimm * s.eff;
      rest -= nimm;
    }
    for (const o of grenzOffenMerker) {
      if (rest <= 0) break;
      const nimm = Math.min(o.frei, rest);
      if (!(nimm > 0)) continue;
      ertrag += nimm * o.eff;
      rest -= nimm;
    }
    return ertrag / gb;
  };
  // Ungenutzter Speicher der letzten Runde. Die Serveraufruestung braucht ihn
  // als Bremse: Wer Speicher kauft, obwohl der vorhandene brachliegt,
  // verbrennt Geld.
  let ueberschussMerker = 0;
  // ABSOLUT STATT ANTEILIG (23.08.2026). Der Viertelanteil stammt aus der
  // Zeit, in der home 32 GB hatte - acht Gigabyte freizuhalten war da
  // vernuenftig. Bei einem Petabyte sperrt dieselbe Formel 262.144 GB, um
  // Werkzeuge zu schuetzen, die zusammen rund 126 GB brauchen. Gemessen am
  // 23.08. waren das 24,9 Prozent des GESAMTEN Netzes ohne jeden Zweck,
  // waehrend 71,7 Prozent des Speichers ohnehin schon brachlagen.
  //
  // Jetzt wird der tatsaechliche Bedarf gerechnet und verdreifacht. Der
  // Puffer faengt ab, dass ein Werkzeug neu startet, waehrend Arbeiter den
  // Platz schon belegt haben - das ist der Fehler, wegen dem bn4rep.js
  // einmal stundenlang gar nicht lief. Die Untergrenze von 64 GB gilt fuer
  // den Zustand direkt nach einem Knotenwechsel, wenn home wieder bei 32 GB
  // steht und getScriptRam fuer noch nicht kopierte Dateien 0 liefert.
  const reserveHome = () => {
    const homeMax = ns.getServerMaxRam("home");
    const eigenRam = ns.getScriptRam("bn4net.js", "home");
    const passtAufHome = Math.max(0, homeMax - (eigenRam > 0 ? eigenRam : 0));
    let bedarf = 0;
    for (const [datei] of WERKZEUGE) {
      const r = ns.getScriptRam(datei, "home");
      if (r > 0 && r <= passtAufHome) bedarf += r;
    }
    // REIHENFOLGE BEACHTEN. Erst deckeln, dann die Untergrenze - andersherum
    // deckelt das Viertel die Untergrenze weg: bei einem frischen 32-GB-home
    // gab Math.min(8, Math.max(64, ...)) genau 8 GB, also WENIGER als die
    // alte Formel mit ihren 24. Genau dort, wo es am meisten weh tut, weil
    // dann kein Werkzeug mehr Platz zum Neustart findet und der Bot ohne
    // Logzeile stehenbleibt - das Muster des Stillstands vom 20.08.
    // bn4life.js steht NICHT in WERKZEUGE (es laeuft immer auf home und wird
    // von bn4net gestartet, nicht auf die Werkbank verteilt) - es muss hier
    // aber mitgezaehlt werden, sonst schuetzt die Reserve genau die Haelfte
    // der Steuerung nicht.
    const rLife = ns.getScriptRam("bn4life.js", "home");
    if (rLife > 0 && rLife <= passtAufHome) bedarf += rLife;

    // Erst die Untergrenze, dann der Deckel - und die Untergrenze gewinnt.
    // Die vorige Fassung schrieb Math.max(24, Math.min(max/4, Math.max(64,
    // ...))): auf einem frischen 32-GB-home kuerzte das innere Math.min die
    // 64 auf 8 weg, und uebrig blieben 24. Der Kommentar versprach 64.
    //
    // Auf einem kleinen home ist der Viertel-Deckel das falsche Werkzeug:
    // Lieber vier Werkzeuge weniger gleichzeitig als eine Steuerung, die
    // nicht mehr startet. Deshalb gilt der Deckel nur oberhalb der
    // Untergrenze.
    const max = ns.getServerMaxRam("home");

    // DIE RESERVE DARF NICHT GROESSER SEIN ALS DAS, WAS SIE SCHUETZEN SOLL
    // (23.08.2026, im neuen Knoten gemessen).
    //
    // Diese Zeile ist zweimal repariert worden, beide Male nach oben - und
    // beide Male ist der Fall uebersehen worden, in dem die Untergrenze
    // groesser ist als der Platz, der nach bn4net selbst uebrig bleibt.
    // Gemessen 25 Minuten nach dem Eintritt in BitNode 5: home 32 GB,
    // bn4net.js belegt 16,25 davon, frei 15,75 - und die Untergrenze
    // min(64, 32/2) = 16 lag DARUEBER. home hat also null Faeden getragen,
    // waehrend das Guthaben eine halbe Stunde lang auf 1.262 Dollar stand.
    //
    // Zwei Grenzen, beide aus derselben Ueberlegung: Eine Reserve ist nur
    // sinnvoll, wenn ein Werkzeug sie auch benutzen kann.
    //   - `bedarf` zaehlt nur noch Werkzeuge, die auf home ueberhaupt Platz
    //     faenden. Ausserhalb von BitNode 4 kostet jeder Singularity-Aufruf
    //     das Sechzehnfache; bn4life.js misst dort 293,8 GB und bn4rep.js
    //     noch mehr. Fuer die auf einem 32-GB-home Platz freizuhalten, ist
    //     nicht vorsichtig, sondern sinnlos - sie starten dort nie.
    //   - Nichts zu schuetzen heisst nichts zu reservieren, und mehr als die
    //     Haelfte des Verteilbaren nimmt die Reserve nie.
    const eigen = ns.getScriptRam("bn4net.js", "home");
    const verteilbar = Math.max(0, max - (eigen > 0 ? eigen : 0));
    if (bedarf <= 0) return 0;
    const untergrenze = Math.min(64, max / 2);
    const wunsch = Math.max(untergrenze, Math.min(max / 4, bedarf * 3));
    return Math.min(wunsch, bedarf, verteilbar / 2);
  };
  const WORKER = ["worker/weaken.js", "worker/grow.js", "worker/hack.js", "worker/share.js"];

  // Die Werkzeugliste steht hier oben statt unten bei ihrer Verwendung, weil
  // seit dem 22.08.2026 schon die RAM-Verteilung sie braucht: Die Werkbank
  // wird nur noch um den TATSAECHLICHEN Werkzeugbedarf freigehalten, und den
  // kann man erst ausrechnen, wenn man die Liste kennt. Zugleich ist sie der
  // Wiederaufbauplan nach einem Reset (Prestige.ts:73 loescht alle gekauften
  // Rechner) - wer die Werkzeuge von Hand starten muesste, haette nach jedem
  // Einbau einen toten Bot.
  // REIHENFOLGE = DRINGLICHKEIT (23.08.2026). Der Werkzeugstarter geht die
  // Liste der Reihe nach durch und ueberspringt, was gerade nicht in die
  // Werkbank passt. In einem frischen Knoten ist der Platz knapp, und dann
  // entscheidet diese Reihenfolge, was zuerst laeuft.
  //
  // Vorn stehen die beiden, ohne die der Bot nicht aus der Startlage
  // herauskommt: bn4life kauft TOR und die Portprogramme - ohne sie bleibt
  // das Netz bei den sechs Servern ohne Portbedarf stehen. homegrow baut
  // home aus, und erst ein grosses home traegt den Rest. Vertragsloeser,
  // Reputationsarbeit und die Bequemlichkeiten kommen danach.
  const WERKZEUGE_FEST = [
    // DER KNOTENSPEZIFISCHE MOTOR (25.08.2026).
    //
    // In BitNode 6 und 7 fuehrt der Weg nicht ueber das Hackniveau, sondern
    // ueber 21 Black Operations. blade.js steht deshalb GANZ oben: Es ist in
    // diesen Knoten nicht ein Werkzeug neben anderen, sondern der Motor, der
    // den Knoten ueberhaupt abschliesst. In anderen Knoten wartet es nur und
    // kostet ausser dem Speicher nichts.
    //
    // bbtrain.js steht bewusst NICHT hier: Es raeumt einmalig das
    // Beitrittstor weg (alle Kampfwerte auf 100) und beendet sich danach -
    // diese Liste wuerde es ewig neu starten.
    // DER AUSGANG STEHT GANZ OBEN (02.09.2026).
    //
    // ausgang.js entscheidet allein, wann und wohin der Knoten verlassen
    // wird (route.json + ns.getResetInfo, beide Wege). Es ist
    // singularityfrei und rund 9 GB gross - passt neben bn4net auf ein
    // frisches 32-GB-home und ist damit das einzige Werkzeug, das in JEDEM
    // Zustand laeuft. Vorher wohnte der Ausgang in bn4rep.js (848 GB
    // ausserhalb BitNode 4) und lief die halbe Laufzeit gar nicht.
    ["ausgang.js", []],
    // Das BitNode-9-Gewerk (02.09.2026): verkauft Hashes (ohne Hacknet-Server
    // wartet es nur) und baut den Hacknet-Server als Wirt fuer exit.js aus,
    // wenn ausgang.js keinen findet. Steht frueh, weil es im BN9-Kaltstart
    // die einzige Geldquelle ist.
    ["hashes.js", []],
    // Kaltstart-Verbrechen der Sleeves (5,7 GB): passt neben bn4net und
    // ausgang auf ein frisches home, beendet sich, sobald sleeve.js laeuft.
    ["sleevecrime.js", []],
    ["blade.js", []],
    // bbtrain gehoert HIERHER, nicht danebenn (25.08.2026).
    //
    // Es stand bewusst nicht in dieser Liste: "raeumt einmalig das
    // Beitrittstor weg und beendet sich danach - die Liste wuerde es ewig neu
    // starten." Der erste Satz war falsch. Ein Augmentierungs-Einbau setzt
    // alle Kampfwerte auf 1 zurueck; die Aufgabe faellt also nach JEDEM Reset
    // erneut an. Am 25.08. um 05:50 hat bn4rep sechs Stueck eingebaut, das
    // Training war weg, und niemand hat es wieder angestossen - der Knoten
    // stand. Seitdem wartet bbtrain, statt sich zu beenden, und gehoert damit
    // in die Liste wie jedes andere Werkzeug.
    ["bbtrain.js", []],
    // DER SLEEVE GEHOERT IN DIE LISTE, NICHT AN DIE HAND (29.08.2026, 05:50).
    //
    // `sleeve.js` wurde am 28.08. um 17:50 gebaut und von Hand gestartet. Nach
    // dem Augmentierungs-Einbau um 04:15 war es weg: In der Prozessliste von
    // 04:20 fehlte es, und der Sleeve stand seither still (`currentWork:
    // keine`, gemessen 05:38). Das kostet rund ein Fuenftel der Traegerrate -
    // vor dem Einbau trug er 2,77 von 13,25 Erfahrungspunkten je Sekunde
    // (`nodes/HEBEL.md`, 22:05).
    //
    // Alles, was einen Reset ueberleben soll, gehoert in diese Liste. Genau
    // dieselbe Lehre steht acht Zeilen weiter oben fuer `bbtrain.js`, gezogen
    // am 25.08. nach demselben Vorfall.
    ["sleeve.js", []],
    // Hacknet-Ausbau und Wirt fuer exit.js (BitNode 9); ohne Hacknet-Server
    // wartet es nur.
    ["hacknet.js", []],
    // bn4life kauft TOR und die Portprogramme. Es steht in dieser Liste und
    // nicht in boot.js, weil es voller Singularity ist und ausserhalb von
    // BitNode 4 mehrere hundert GB gross - in ein frisches home mit 32 GB
    // passt es nie. Auf der Werkbank stoert der Preis nicht; Singularity
    // wirkt spielerweit, nicht rechnergebunden.
    ["bn4life.js", []],
    // home-Ausbau, aus demselben Grund ausgelagert (vier Singularity-Aufrufe,
    // 9 GB im Knoten 4 und 144 GB draussen) - siehe Kopf von homegrow.js.
    ["homegrow.js", []],
    ["contracts.js", ["--loop", "300"]],
    // Der Tonanker gehoert dazu, nicht daneben: Ein verborgener Browsertab
    // bekommt statt sechzehn Zeitgebern je Sekunde nur einen je Minute, und
    // ohne ihn laeuft der ganze Bot dreifach langsamer. Er lag bisher auf
    // einem gekauften Rechner - und die verschwinden bei jedem Einbau.
    ["wakelock.js", []],
    // Popup-Waechter. Das Spiel sammelt Dialoge in einer Warteschlange
    // (AlertManager.tsx); wer stundenlang nicht hinsieht, findet dutzende
    // vor und muss jeden einzeln wegklicken. Gehoert aus demselben Grund
    // hierher wie der Tonanker: er soll den Einbau ueberleben.
    ["popups.js", []],
    // bn4rep und bn4door stehen ANS ENDE, seit die Werkbank immer nur EIN
    // Rechner ist (der groesste). In BitNode 5 hat der 128 GB, und bn4door
    // allein belegt 99,85 davon - zusammen mit dem Vertragsloeser war die
    // Werkbank voll, und wakelock.js (34,25 GB) fand keinen Platz mehr.
    //
    // Das ist die falsche Reihenfolge: Der Tonanker schuetzt die
    // Geschwindigkeit des GANZEN Laufs (ein verborgener Browsertab bekommt
    // statt sechzehn Zeitgebern je Sekunde nur einen je Minute), waehrend
    // Backdoors eine Verbilligung der FIRMENreputation sind - ein Posten der
    // Spaetphase, der in den ersten Stunden eines Knotens nichts beitraegt.
    // bn4rep braucht ohnehin 768,3 GB und wartet, bis der Park so weit ist.
    ["bn4rep.js", []],
    ["bn4door.js", []],
  ];

  // --- Die Ableitung aus der Registry ---------------------------------------
  //
  // Die Rolle kommt aus data/verfahren.txt, und der Rollen-Riegel aus
  // ARCHITEKTUR 3.2 haelt sie gegen getResetInfo().currentNode: boot.js
  // loescht die Datei beim Neuanlauf absichtlich nicht, dort steht nach einem
  // Sprung also sekundenlang die Rolle des ALTEN Knotens. Passt sie nicht,
  // gilt die Rolle als unbekannt, und es starten nur Eintraege mit
  // verfahren "alle".
  //
  // SIE WIRD IN JEDER RUNDE NEU BESTIMMT (04.09.2026, Skeptiker Fehlermodi).
  //
  // Vorher stand sie EINMAL beim Start des Prozesses fest. Zwei Fehler auf
  // einmal:
  //
  //   (1) Der Kern ueberlebt den Knotenwechsel nicht als Prozess, aber er
  //       ueberlebt den Rollenwechsel INNERHALB eines Knotens sehr wohl:
  //       ausgang.js schreibt data/verfahren.txt in seiner ersten Runde,
  //       Sekunden nachdem der Kern schon lief. Wer die Rolle nur beim Start
  //       liest, sieht dort "unbekannt" - und startet fuer die ganze
  //       Prozesslebensdauer nur Eintraege mit verfahren "alle". blade.js und
  //       bbtrain.js, also der ganze Bladeburner-Weg, fehlten damit still.
  //
  //   (2) `phase: "normal"` war schlicht falsch. Der Kern ist das ERSTE, was
  //       boot.js startet - er laeuft mitten im Kaltstart. Mit der festen
  //       Angabe hat kein einziger Eintrag mit `phase: "kaltstart"` je
  //       gegolten: cdump, csolve, darkweb, sleevecrime. Das ist die
  //       komplette Geldkette der Startlage (Position C.8).
  //
  // Die Phase wird jetzt GEMESSEN, nicht behauptet: Startlage heisst "es gibt
  // noch keinen Park, und home ist noch klein". Beide Teile sind noetig - in
  // BitNode 9 ist CloudServerLimit 0, dort gibt es NIE einen Park, und ohne
  // die home-Bedingung bliebe der Knoten ewig im Kaltstart.
  const HOME_KALTSTART_GB = 64;
  const phaseJetzt = () => {
    try {
      const pl = parkLage();
      if (pl.da && pl.park.length > 0) return "normal";
      return ns.getServerMaxRam("home") <= HOME_KALTSTART_GB ? "kaltstart" : "normal";
    } catch { return "kaltstart"; }
  };

  const baueLage = () => {
    let verfahren = "unbekannt";
    let node = 0;
    // FEATURE 9 = HACKNET-SERVER VERFUEGBAR (19.09.2026, Befund vom 10.09.).
    //
    // `gilt()` in lib/reg.js prueft `requiresFeature: 9` gegen
    // `lage.features[9]` - und diese Lage lieferte nie ein `features`. Der
    // Ausdruck war immer undefined, hashes.js fiel in JEDEM Knoten aus der
    // Auswahl, auch in BitNode 9 selbst (zwei Laeufe lang, der Hash-Speicher
    // stand am Deckel). Semantik nach ARCHITEKTUR E7 =
    // `canAccessBitNodeFeature(9)` (`BitNodeUtils.ts:17-19`):
    // `bitNodeN === 9 || activeSourceFileLvl(9) > 0`, dazu die BitNode-Option
    // disableHacknetServer (HacknetHelpers.tsx:34-36). Die Ableitung steht in
    // lib/reg.js `merkmaleAusReset`, damit Waechter und strategie-check
    // dieselbe benutzen. Kostet nichts: getResetInfo hat der Kern ohnehin.
    let features = { 9: false };
    try {
      const ri = ns.getResetInfo();
      node = ri.currentNode;
      features = merkmaleAusReset(ri);
      const rolle = pruefeRolle(
        leseRolle(ns.fileExists("data/verfahren.txt", "home")
          ? ns.read("data/verfahren.txt") : ""), node);
      verfahren = rolle.verfahren;
    } catch { /* dann bleibt es bei unbekannt */ }
    return {
      node, verfahren,
      phase: phaseJetzt(),
      features,
      dateiDa: (d) => {
        try {
          if (!ns.fileExists(d, "home")) return false;
          return !markeVeraltet(d);
        } catch { return false; }
      },
    };
  };

  /**
   * Gilt diese Marke noch, oder stammt sie aus einem Zustand, den es nicht
   * mehr gibt?
   *
   * DER FALL, DER DAS NOETIG MACHT (Skeptiker Fehlermodi, 04.09.2026).
   *
   * `data/portknacker-komplett.txt` laesst `darkweb.js` ruhen, sobald alle
   * fuenf Portknacker da sind. Die Marke ist eine TEXTDATEI und ueberlebt
   * jedes Prestige - die Programme nicht: `prestigeHomeComputer` leert die
   * Liste und legt nur NUKE zurueck (`Server/ServerHelpers.ts:224-234`),
   * gerufen sowohl vom Augmentierungs-Einbau als auch vom Knotenwechsel
   * (`Prestige.ts:55,74` und `:203,225`).
   *
   * Ohne diese Pruefung liefe `darkweb.js` nach dem ersten vollstaendigen Satz
   * in ALLEN rund vierzig Restlaeufen nie wieder - und es ist die einzige
   * kaltstartfaehige Knackerquelle. Der Zirkel dahinter hat am 25.08.
   * dreizehneinhalb Stunden gekostet.
   *
   * WARUM HIER UND NICHT IN darkweb.js: die Marke SPERRT das Gewerk. Eine
   * Pruefung im Gewerk selbst liefe nie - es startet ja nicht. Nur wer die
   * Sperre auswertet, kann sie auch verwerfen.
   *
   * WARUM HIER UND NICHT NUR IN boot.js: boot.js raeumt sie ebenfalls, und das
   * ist die erste Sicherung. Diese hier haengt nicht daran, DASS boot.js
   * gelaufen ist - nach einem Einbau ueber die Spieloberflaeche laeuft es
   * nicht.
   *
   * Kostet nichts: `ns.read` ist gratis, und `getResetInfo` hat der Kern
   * ohnehin.
   */
  const MARKEN_MIT_ZEITSTEMPEL = new Set([
    "data/portknacker-komplett.txt",
    "data/simulacrum.txt",
  ]);
  const markeVeraltet = (d) => {
    if (!MARKEN_MIT_ZEITSTEMPEL.has(d)) return false;
    try {
      const roh = String(ns.read(d) || "").trim();
      // Zwei Schreibweisen im Bestand: ISO-Zeitstempel (darkweb.js) und blanke
      // Millisekunden (graft.js). Beide muessen erkannt werden.
      const erstes = roh.split(/\s+/)[0];
      const t = /^\d+$/.test(erstes) ? Number(erstes) : Date.parse(erstes);
      if (!Number.isFinite(t)) return false;    // unlesbar: lieber gelten lassen
      const ri = ns.getResetInfo();
      const juengster = Math.max(ri.lastNodeReset || 0, ri.lastAugReset || 0);
      return t < juengster;
    } catch { return false; }
  };

  let regLage = baueLage();

  // Merker fuer den Ereignisstrom: was dieser PROZESS schon gemeldet hat.
  // Nicht in der Runde deklarieren - der `boot`-Eintrag darf genau einmal je
  // Prozessleben entstehen, sonst steht in jeder Minute ein Bootvorgang und
  // boot_latency_min ist immer null.
  const evMerker = { nodeReset: null, augReset: null,
    bootWall: null,
    // Beide Zahlen werden EINMAL gemessen und danach nur noch weitergereicht
    // (R13, R14). Eine je Runde neu gerechnete Kennzahl misst mit jedem
    // Kernneustart etwas anderes.
    jumpLatencyMin: null, bootLatencyMin: null,
    // R27: ob die stumme Vertragskette schon gemeldet ist. Ohne den Merker
    // stuende der Befund in jeder Kernrunde neu im Strom - der Ringpuffer
    // waere in einer Stunde nur noch dieser eine Satz.
    stummGemeldet: false };

  // Welche Waechterauftraege dieser Prozess schon ausgefuehrt hat. Der
  // Schluessel ist der Stellzeitpunkt - ein Auftrag darf nicht zweimal laufen,
  // und `installAugmentations` zweimal waere zwei Laeufe weggeworfen.
  const auftraegeGetan = new Set();

  const baueWerkzeuge = (lage) => regGeladen
    ? regAuswahl(regGeladen, lage)
        // Der Kern startet sich nicht selbst. Der WAECHTER dagegen gehoert
        // sehr wohl in diese Liste (04.09.2026): hier stand "wird von boot.js
        // gestartet" - boot.js nennt guard.js aber nur in seiner Schonliste
        // und ruft es nirgends auf. Ergebnis: der ganze C.6-Bau lief nie.
        //
        // Jetzt startet boot.js ihn EINMAL frueh (fuer den Fall, dass der
        // Kern gar nicht hochkommt - genau den soll der Waechter melden),
        // und der Kern haelt ihn danach am Leben wie jedes andere Werkzeug.
        // Doppelstarts faengt der Starter ueber `laufend` ab.
        .filter((e) => e.name !== "bn4net.js")
        .filter((e) => !e.name.startsWith("worker/"))
        .map((e) => [e.name, e.args || [], e.restartPolicy || "always",
          e.hostRule || "any", Array.isArray(e.needsLibs) ? e.needsLibs : []])
    : WERKZEUGE_FEST.map(([n, a]) => [n, a, "always", "any", []]);

  const baueTelemetrie = (lage) => regGeladen
    ? regTelemetrie(regGeladen, lage).filter(([n]) => n !== "bn4net.js")
    : TELEMETRIE_FEST;

  // `let`, nicht `const`: beide Listen werden neu gebaut, sobald sich Rolle,
  // Knoten oder Phase aendern (siehe Rundenkopf). Der Schluessel merkt sich,
  // wofuer die aktuelle Fassung gilt - ohne ihn stuende in jeder Runde
  // dieselbe Meldung im Log.
  let WERKZEUGE = baueWerkzeuge(regLage);
  let TELEMETRIE = baueTelemetrie(regLage);
  let regSchluessel = regLage.node + "|" + regLage.verfahren + "|" + regLage.phase;

  // Die Meldung wird hier nur GEBAUT - `sag` gibt es an dieser Stelle noch
  // nicht (es steht rund fuenfzig Zeilen weiter unten). Ein Aufruf hier warf
  // "Cannot access 'sag' before initialization", und zwar in der allerersten
  // Runde: der Kern waere gar nicht angelaufen. Gefunden hat das der
  // Ebene-2-Test, nicht das Spiel.
  const regMeldung = "Werkzeugliste: "
    + (regGeladen ? "aus registry.json (" + regGrund + ")" : "EINGEBAUT - " + regGrund)
    + ", " + WERKZEUGE.length + " Werkzeuge, " + TELEMETRIE.length + " ueberwacht"
    + ", Rolle " + regLage.verfahren + " in Knoten " + regLage.node + ".";

  const BIBLIOTHEKEN = ["lib/hackaugs.js"];

  const knacker = [
    ["BruteSSH.exe", ns.brutessh],
    ["FTPCrack.exe", ns.ftpcrack],
    ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm],
    ["SQLInject.exe", ns.sqlinject],
  ];

  const scanAll = () => {
    const gesehen = new Set(["home"]);
    const schlange = ["home"];
    while (schlange.length) {
      for (const nachbar of ns.scan(schlange.shift())) {
        if (gesehen.has(nachbar)) continue;
        gesehen.add(nachbar);
        schlange.push(nachbar);
      }
    }
    return [...gesehen];
  };

  // Melden, und zwar nach DRAUSSEN. ns.print landet im Spiel-Log, das von
  // aussen niemand liest - und ein Bot, dessen Zustand man nicht sehen kann,
  // steht irgendwann still, ohne dass es auffaellt. In BitNode 1 ist genau das
  // achtmal passiert: ausgeloest, gemeldet, nie geprueft.
  const LOG_ZEILEN = 200;
  let log = [];
  const sag = (t) => {
    const zeile = new Date().toLocaleTimeString() + "  " + t;
    ns.print(zeile);
    log.push(zeile);
    if (log.length > LOG_ZEILEN) log = log.slice(-LOG_ZEILEN);
    ns.write("data/bn4net-log.txt", log.join("\n") + "\n", "w");
  };
  sag("bn4net gestartet.");
  sag(regMeldung);

  // Der ganze Rundeninhalt liegt in einem try. Ohne das beendet eine einzige
  // unerwartete Ausnahme - ein Server, der zwischen scan und getServer
  // verschwindet, eine Zahl, die das Spiel nicht mag - die Schleife und damit
  // die Netzhaelfte fuer den Rest des Monats. Ein Bot, der monatelang
  // unbeaufsichtigt laeuft, muss Fehler ueberleben statt an ihnen zu sterben.
  // =========================================================================
  // MOTORZEIT UND HERZSCHLAG v2 (Position C.1, 04.09.2026)
  // =========================================================================
  //
  // Drei Zaehler, die es bisher nicht gab, und ohne die der Waechter nichts
  // entscheiden kann:
  //
  //   okRunden   vollstaendig durchlaufene Runden. `runde` allein zaehlt nur
  //              die VERSUCHE - der ganze Rundeninhalt liegt in einem try,
  //              also zaehlt ein Motor, der jede Runde wirft, munter weiter
  //              und sieht nach jeder Frischepruefung gesund aus.
  //   errStreak  aufeinanderfolgende Ausnahmen. Gibt der Sache eine Richtung:
  //              drei Fehler in drei Tagen sind etwas anderes als drei in
  //              drei Runden.
  //   mz         die Motorzeit - wie lange der Bot WIRKLICH gearbeitet hat.
  //              Weder Date.now() (laeuft bei ausgeschaltetem Rechner weiter)
  //              noch totalPlaytime (zaehlt Offline-Zeit voll mit) taugen
  //              dafuer. Die Regeln stehen in lib/motorzeit.js.
  //
  // Der Zustand liegt in data/motorzeit.json auf home und ueberlebt damit
  // einen Neustart des Skripts. Beim Knotenwechsel wird er zurueckgesetzt -
  // Fristen und Raten beziehen sich immer auf den laufenden Lauf.
  let mz = mzLaden(
    ns.fileExists("data/motorzeit.json", "home") ? ns.read("data/motorzeit.json") : null,
    10000);
  let okRunden = 0;
  let errStreak = 0;
  let lastError = null;
  let mzNodeReset = null;
  try { mzNodeReset = ns.getResetInfo().lastNodeReset; } catch { /* egal */ }
  if (Number.isFinite(mz.nodeReset) && mz.nodeReset !== mzNodeReset) {
    mzZuruecksetzen(mz, "Knotenwechsel");
  }
  mz.nodeReset = mzNodeReset;

  for (let runde = 1; ; runde++) {
   try {
    // Die Uhr zuerst: sie muss auch dann laufen, wenn die Runde spaeter wirft.
    // Ein Rundenabstand ueber dem Deckel oder ein Nachholklumpen zaehlen NICHT
    // als Arbeitszeit - genau das unterscheidet sie von totalPlaytime.
    let mzPlaytime = 0;
    try { mzPlaytime = ns.getPlayer().totalPlaytime; } catch { /* egal */ }
    // Das Ergebnis wird gebraucht: der gezaehlte Abstand ist die Grundlage
    // fuer throttle_rounds_per_min in der Kennzahlentafel.
    const mzErgebnis = mzRunde(mz, Date.now(), mzPlaytime);
    // HACKNET-SERVER SIND KEINE ARBEITER-WIRTE (02.09.2026, Skeptiker C/D).
    // Sie haengen mit Root an home (PlayerObjectServerMethods.ts:46-66), aber
    // jedes Byte, das dort laeuft, drueckt die Hash-Rate ueber ramRatio
    // (HacknetServers.ts:14) - bei 1000 von 1024 GB belegt auf 2 Prozent.
    // In BitNode 9 ist das die einzige Einnahme. Nur ausgang.js legt dort
    // im Sprungmoment exit.js ab.
    const hosts = scanAll().filter((h) => !h.startsWith("hacknet-server-"));

    // --- Die Lage neu bestimmen, wenn sie sich geaendert hat ------------------
    // Rolle, Knoten und Phase koennen sich waehrend der Prozesslebensdauer
    // aendern - die Rolle schon Sekunden nach dem Start, wenn ausgang.js
    // data/verfahren.txt schreibt. Nur bei ECHTER Aenderung neu bauen, sonst
    // stuende die Meldung in jeder Runde im Log.
    // BEIDE LISTEN WERDEN JE RUNDE NEU GEBAUT (10.09.2026).
    //
    // Vorher wurden sie nur beim Wechsel von Knoten, Rolle oder Phase gebaut.
    // `gilt()` prueft aber auch Datei-Vorbedingungen (`requiresFile`,
    // `forbidsFile`) und die Existenz der Werkzeugdatei selbst - lauter
    // Dinge, die sich im Minutentakt aendern. Damit backte der Zustand EINES
    // Augenblicks fuer Stunden fest, welche Gewerke ueberhaupt vorkommen.
    //
    // Beide Richtungen sind belegt, beide am selben Paar:
    //   06.09., 12:39  cantwort.json lag beim Bau -> csolve.js in der Liste,
    //                  cdump.js nicht. csolve raeumte die Datei weg und wurde
    //                  danach jede Runde neu gestartet (Churn).
    //   06.09., 13:00  cantwort.json lag NICHT beim Bau -> cdump.js drin,
    //                  csolve.js nicht. cdump schrieb Antworten, war danach
    //                  korrekt blockiert - und csolve.js stand in keiner
    //                  einzigen Runde zur Wahl. Der Contract-Zyklus war tot.
    //   10.09., 15:21  im frischen BitNode 4 woertlich derselbe Stillstand.
    //
    // Der erste Versuch (10.09., verworfen) liess die Datei-Vorbedingungen
    // beim Listenbau einfach weg und ueberliess sie `vorbedingungGilt`. Drei
    // Skeptiker haben das zerlegt, und sie hatten recht:
    //   - `gilt()` prueft ueber dieselbe Funktion auch, ob das Skript
    //     ueberhaupt auf home liegt (`lib/reg.js:107`) - das waere mit
    //     weggefallen.
    //   - Die TELEMETRIE-Liste haette weiter die alte Regel gebraucht. Ein
    //     Gewerk, das startet, aber in keiner Telemetrieliste steht, laeuft
    //     unbeaufsichtigt: der Stillstands-Killer unten fasst nur an, was in
    //     TELEMETRIE steht. csolve.js waere genau in diesen Zustand geraten.
    //   - `reserveHome` und `werkbankReserve` summieren ueber WERKZEUGE. Eine
    //     Liste mit dauerhaft blockierten Gewerken haelt Speicher zurueck,
    //     den niemand braucht.
    //
    // Je Runde neu bauen loest alle drei auf einmal und ist die Bauform, die
    // der Waechter seit dem 04.09. benutzt (`guard.js:275`, `dateiDa` gegen
    // `ns.fileExists`). Die Kosten sind ein Set-Lookup und rund 30
    // `ns.fileExists` je Runde - `regAuswahl` rechnet, es ruft nichts Teures.
    //
    // Gemeldet wird weiterhin NUR beim Schluesselwechsel: die Laengen
    // schwanken jetzt absichtlich von Runde zu Runde, und eine Zeile je
    // Aenderung waere genau der Logspam, den der Schluessel verhindern soll.
    {
      const jetztLage = baueLage();
      const jetztSchluessel = jetztLage.node + "|" + jetztLage.verfahren + "|" + jetztLage.phase;
      regLage = jetztLage;
      WERKZEUGE = baueWerkzeuge(regLage);
      TELEMETRIE = baueTelemetrie(regLage);
      if (jetztSchluessel !== regSchluessel) {
        const vorher = regSchluessel;
        regSchluessel = jetztSchluessel;
        sag("Lage gewechselt (" + vorher + " -> " + jetztSchluessel + "): "
          + WERKZEUGE.length + " Werkzeuge, " + TELEMETRIE.length + " ueberwacht.");
      }
    }


    // --- 0. Gegenseitige Wache ------------------------------------------------
    // Die Remote-Schnittstelle des Spiels kennt zehn Methoden, und alle zehn
    // betreffen nur Dateien (RemoteFileAPI/MessageHandlers.ts) - kein run, kein
    // exec, kein kill. Von aussen laesst sich also nichts starten. Der einzige
    // Weg ist ein Skript, das schon laeuft.
    //
    // Statt eines dritten Waechters, fuer den auf einem 32-GB-home kein Platz
    // ist, passen die beiden Haelften aufeinander auf. Faellt eine aus, ist ihr
    // Speicher frei - und die andere startet sie nach. Nur wenn beide zugleich
    // sterben, braucht es wieder einen Menschen.
    //
    // Die Bremse ist data/bn4-stop.txt: Solange die Datei da ist, wird nicht
    // wiederbelebt. Ohne sie waere ein gewolltes killall nicht durchfuehrbar.
    if (!ns.fileExists("data/bn4-stop.txt", "home")
        && !ns.isRunning("bn4life.js", "home")) {
      const pid = ns.exec("bn4life.js", "home");
      if (pid) sag("bn4life.js lag still und wurde neu gestartet (pid " + pid + ").");
    }

    // --- 0b. Selbstbeender ----------------------------------------------------
    // Die Fernschnittstelle kann Dateien schreiben, mehr nicht: pushFile ruft
    // writeToContentFile und sonst gar nichts (MessageHandlers.ts:92-101). Ein
    // laufendes Skript behaelt sein bereits geladenes Modul - neuer Code
    // erreicht es also NIE, solange es nicht endet. Ohne diesen Block braucht
    // jede Codeaenderung einen Menschen, der "kill" tippt; nachts heisst das
    // gar nicht.
    //
    // ns.exit() kostet nichts. Wer sich auf Zuruf beendet, wird Sekunden
    // spaeter von der anderen Haelfte neu gestartet - dann mit dem neuen Code.
    // Zielgenau. Beide Haelften lesen dieselbe Datei, aber bn4life.js taktet
    // im Sekundentakt und bn4net.js im Zehnsekundentakt - ein blosses
    // Stichwort erwischt deshalb fast immer die falsche. Steht ein Name
    // dabei, ist nur die gemeinte gemeint.
    const befehl = ns.fileExists("data/reload.txt", "home")
      ? ns.read("data/reload.txt") : "";
    if (befehl.includes("SELBST")
        && (befehl.trim() === "SELBST" || befehl.includes("bn4net.js"))) {
      ns.write("data/reload.txt", "", "w");
      sag("Neuladen angefordert - beende mich, die Wache holt mich zurueck.");
      ns.exit();
    }
    // --- 0b2. Auftragslaeufer, ersatzweise ------------------------------------
    // data/task.txt ist der einzige Weg, von aussen ein Skript im Spiel zu
    // starten - die Bruecke kann Dateien schieben, aber nichts ausfuehren.
    // Gelesen hat ihn bisher nur bn4life.js. Das faellt genau dann aus, wenn
    // man ihn am dringendsten braucht: bn4life ist ausserhalb von BitNode 4
    // 293,8 GB gross und laeuft nach einem Knotenwechsel stundenlang nicht.
    // Am 23.08. um 17:30 stand der Bot in BitNode 5 fest, und es gab keinen
    // Weg mehr, ihm etwas zu sagen - ausser einem Menschen an der Tastatur.
    //
    // bn4net.js ist die Haelfte, die IMMER laeuft (16,25 GB, singularityfrei).
    // Deshalb liest es den Auftrag ersatzweise mit - aber nur, wenn bn4life
    // nirgends laeuft. Damit gibt es nie zwei Leser und nie ein Wettrennen um
    // dieselbe Zeile.
    // EIN LEBENDER LESER, KEIN VORHANDENER (25.08.2026).
    //
    // Hier stand nur "laeuft bn4life irgendwo?". Der Gedanke war richtig - es
    // soll nie zwei Leser derselben Zeile geben. Die Pruefung war es nicht:
    // Sie fragt nach der EXISTENZ eines Prozesses, nicht nach seiner Arbeit.
    //
    // Am 25.08. um 05:25 stand bn4life seit 484 Minuten (letzte Telemetrie
    // vom Vortag um 21:21), lief aber noch als Prozess. Damit trat der
    // Auftragslaeufer zurueck, bn4life selbst las nichts mehr - und der
    // einzige Fernkanal ins Spiel war zu. Ein Auftrag lag minutenlang
    // unangetastet in data/task.txt. Ausgerechnet die Schutzbedingung gegen
    // zwei Leser hat dafuer gesorgt, dass es KEINEN gab.
    //
    // Massgeblich ist deshalb das Lebenszeichen, nicht der Prozess.
    const lifeZeit = (() => {
      try { return JSON.parse(ns.read("data/bn4life.json")).zeit || 0; }
      catch { return 0; }
    })();
    const lifeFrisch = lifeZeit > 0 && Date.now() - lifeZeit < 300000;
    const lifeLaeuft = lifeFrisch && hosts.some((h) => {
      try { return ns.ps(h).some((pr) => pr.filename === "bn4life.js"); }
      catch { return false; }
    });
    if (!lifeLaeuft && ns.fileExists("data/task.txt", "home")) {
      const roh = ns.read("data/task.txt").trim();
      ns.write("data/task.txt", "", "w");     // sofort leeren, sonst Endlosstart
      if (roh) {
        try {
          const teile = JSON.parse(roh);
          const braucht = ns.getScriptRam(teile[0], "home");
          // Wirt mit dem meisten freien Speicher. Auf home bleibt ein Sockel
          // stehen, damit ein Auftrag nicht die Steuerung selbst verdraengt.
          let wirt = "home", meistFrei = -1;
          for (const host of hosts) {
            if (!ns.hasRootAccess(host)) continue;
            const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
              - (host === "home" ? 2 : 0);
            if (frei > meistFrei) { meistFrei = frei; wirt = host; }
          }
          // PLATZ SCHAFFEN, STATT ZU SCHEITERN (23.08.2026).
          //
          // Im frischen Knoten ist jedes Byte mit Arbeitern belegt: gemessen
          // 11 GB frei im ganzen Netz, verteilt auf acht Rechner mit je 1,6 -
          // ein Auftrag von 12 GB passt nirgends, obwohl das Netz 132 GB hat.
          // Ohne diesen Block waere der Fernkanal genau dann tot, wenn man ihn
          // braucht.
          //
          // Arbeiter sind der richtige Posten zum Raeumen: sie sind
          // Einwegskripte, bn4net legt sie in der naechsten Runde von selbst
          // wieder nach, und der Verlust ist die angefangene Aktion - Sekunden.
          // Ein Werkzeug dagegen verliert beim Abbruch seinen Arbeitsstand.
          // Geraeumt wird nur auf dem gewaehlten Wirt und nur so viel, wie der
          // Auftrag braucht.
          // Passt der Auftrag auf den besten Rechner grundsaetzlich nicht
          // (848 GB auf 512), wird nicht geraeumt - das haette 30 Runden lang
          // alle Arbeiter des groessten Rechners gekostet. Stattdessen den
          // Ausbau (1a2) anstossen und den Auftrag verwerfen.
          const passtNie = braucht > 0
            && ns.getServerMaxRam(wirt) - (wirt === "home" ? 2 : 0) < braucht;
          if (passtNie) {
            werkzeugWartetGb = Math.max(werkzeugWartetGb, braucht);
            sag("Auftrag " + teile[0] + " (" + braucht.toFixed(1) + " GB) passt auf keinen Rechner"
              + " (groesster " + wirt + ") - Ausbau angestossen, Auftrag verworfen.");
            auftragVersuche.delete(roh);
          }
          if (!passtNie && braucht > 0 && meistFrei < braucht) {
            const vorher = meistFrei;
            for (const w of WORKER) {
              if (!ns.ps(wirt).some((pr) => pr.filename === w)) continue;
              ns.scriptKill(w, wirt);
              const frei = ns.getServerMaxRam(wirt) - ns.getServerUsedRam(wirt)
                - (wirt === "home" ? 2 : 0);
              if (frei >= braucht) break;
            }
            const nachher = ns.getServerMaxRam(wirt) - ns.getServerUsedRam(wirt);
            sag("Fuer den Auftrag Arbeiter auf " + wirt + " geraeumt: "
              + vorher.toFixed(1) + " -> " + nachher.toFixed(1) + " GB frei.");
            meistFrei = nachher;
          }
          if (!passtNie && wirt !== "home") ns.scp([teile[0], ...BIBLIOTHEKEN], wirt, "home");
          const pid = passtNie ? 0 : ns.exec(teile[0], wirt, 1, ...teile.slice(1));
          // ns.exec gibt bei Speichermangel still 0 zurueck - der Rueckgabewert
          // gehoert ins Log, sonst verschwindet der Auftrag spurlos.
          sag(pid ? "Auftrag gestartet: " + teile.join(" ") + " auf " + wirt
              + " (pid " + pid + ")."
            : "Auftrag FEHLGESCHLAGEN: " + teile[0] + " braucht "
              + braucht.toFixed(2) + " GB, bester Wirt " + wirt + " hat "
              + meistFrei.toFixed(2) + " GB frei.");
          // NICHT VERFALLEN LASSEN (02.09.2026): Ein Auftrag, der gerade
          // keinen Platz findet, wird bis zu 30 Runden (5 min) zurueckgelegt
          // statt still zu verschwinden - heute ging so wakelock.js verloren.
          if (!pid && !passtNie) {
            const versuche = (auftragVersuche.get(roh) || 0) + 1;
            auftragVersuche.set(roh, versuche);
            if (versuche <= 30) ns.write("data/task.txt", roh, "w");
            else { auftragVersuche.delete(roh); sag("Auftrag nach " + versuche + " Versuchen verworfen: " + roh); }
          } else auftragVersuche.delete(roh);
        } catch (e) {
          sag("Auftrag unlesbar: " + String(e));
        }
      }
    }

    // --- 1. Aufschliessen -----------------------------------------------------
    const offen = knacker.filter(([datei]) => ns.fileExists(datei, "home"));
    let neu = 0;
    for (const host of hosts) {
      if (host === "home" || ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      if (s.numOpenPortsRequired > offen.length) continue;
      // Kein Level-Filter. nuke prueft ausschliesslich die Ports und den
      // Besitz von NUKE.exe (NetscriptFunctions.ts:504-521) - das Hacking-
      // Level interessiert es nicht. Wer hier filtert, laesst fremden
      // Arbeitsspeicher brachliegen, und bei HackExpGain 0.4 dauert es sehr
      // lange, bis der Filter von selbst faellt.
      for (const [, fn] of offen) { try { fn(host); } catch { /* schon offen */ } }
      try { ns.nuke(host); neu++; } catch { /* Ports fehlen doch */ }
    }
    if (neu) sag(neu + " Rechner gerootet.");

    // Gerooteter Netzspeicher. Steht hier oben, weil ihn schon die
    // Serveraufruestung (1a2) und spaeter das Erfahrungsbudget brauchen -
    // und weil er erst NACH dem Rooten stimmt.
    const ramTotal = hosts.reduce((a, h) => a + (ns.hasRootAccess(h) ? ns.getServerMaxRam(h) : 0), 0);

    // --- 0c. Werkzeug auf der Werkbank neu laden -------------------------------
    // Die Werkzeuge (Vertragsloeser, Reputationssteuerung, Backdoors) laufen
    // auf einem gekauften Rechner und koennen sich nicht selbst beenden - sie
    // lesen data/ auf ihrem Wirt, nicht auf home. bn4net.js sitzt auf home,
    // sieht den Befehl und beendet sie stellvertretend; die Werkzeugliste
    // weiter unten startet sie in derselben Runde mit neuem Code wieder.
    {
      const b = ns.fileExists("data/reload.txt", "home") ? ns.read("data/reload.txt") : "";
      if (b.startsWith("WERKZEUG ")) {
        // DIE ENDUNG WIRD ERGAENZT, NICHT VERLANGT (27.08.2026, 19:46).
        //
        // Verglichen wird unten gegen `pr.filename`, und das ist "blade.js",
        // nicht "blade". Ein Befehl ohne Endung traf deshalb ins Leere - die
        // Datei wurde geleert, eine Meldung geschrieben ("0 Instanz(en)
        // beendet"), und niemand sah nach.
        //
        // Am 27.08. hat das einen ganzen Nachmittag gekostet: Drei Aenderungen
        // an `blade.js` - die gerechnete Black-Op-Chance um 18:26, der
        // Digital-Observer-Hebel um 18:55 und dessen Nachbesserung - wurden
        // eingebaut, committet, "neu gestartet" und blieben wirkungslos. Der
        // Prozess lief die ganze Zeit unter derselben PID mit altem Code. Erst
        // ein PID-Vergleich zeigte es. Nach "WERKZEUG blade.js" stieg Digital
        // Observer binnen zwei Minuten von Stufe 1 auf 4.
        let name = b.slice(9).trim();
        if (name && !name.endsWith(".js")) name += ".js";
        // NICHT UEBER DIESEN KANAL SELBSTMORD (25.08.2026).
        //
        // "WERKZEUG bn4net.js" laesst diese Schleife sich selbst beenden - und
        // dann haengt es an der Wache in popups.js, ob jemand zurueckkommt.
        // Steht die auch nicht (etwa direkt nach einem Einbau, wo ALLE
        // Skripte tot sind und boot.js gerade erst bn4net gestartet hat), ist
        // der Bot weg. Genau so ist am 25.08. um 05:59 der Wiederanlauf
        // gescheitert - das Protokoll meldete "gestartet" und "laeuft".
        //
        // Fuer den eigenen Neustart gibt es den SELBST-Kanal eine Ebene
        // hoeher; der beendet sich an definierter Stelle, statt auf eine
        // Wache zu hoffen.
        if (name === "bn4net.js") {
          ns.write("data/reload.txt", "", "w");
          sag("WERKZEUG bn4net.js abgelehnt - fuer den Selbstneustart"
            + " 'SELBST bn4net.js' benutzen.");
        } else {
        ns.write("data/reload.txt", "", "w");
        // Ueberall killen, nicht nur auf der aktuellen Werkbank. Die Werkbank
        // ist der GROESSTE Rechner und wechselt, sobald ein groesserer gekauft
        // wird - ein Werkzeug laeuft dann noch auf dem alten, waehrend hier
        // schon der neue gemeint ist. Genau daran sind drei Neustarts
        // wirkungslos verpufft: Der Befehl kam an, traf aber ins Leere.
        let getroffen = 0;
        for (const host of scanAll()) {
          if (!ns.hasRootAccess(host)) continue;
          if (!ns.ps(host).some((pr) => pr.filename === name)) continue;
          ns.scriptKill(name, host);
          getroffen++;
        }
        // DIE MELDUNG SAGT JETZT, WORAN DER NEUSTART HAENGT (28.08.2026, 06:15).
        //
        // Hier stand "startet gleich neu" - eine Zusage, die nur mit Werkbank
        // gilt. Der Nachstart in Abschnitt 2c haengt an `if (werkbank)`, und
        // die Werkbank ist der groesste GEKAUFTE Rechner. Nach einem
        // Augmentierungs-Einbau sind die weg, also startet dort nichts nach.
        //
        // Genau das ist am 28.08. um 05:54 passiert: Nach dem zweiten Einbau
        // der Nacht liefen zwei `bbtrain.js`, ein `WERKZEUG bbtrain.js`
        // beendete beide, und zwei Minuten lang trainierte niemand - bei
        // Kampfwerten auf 1. Behoben mit `node tools/task.js bbtrain.js`.
        //
        // Kein Nachstart auf home an dieser Stelle: Die Werkzeuge liegen auf
        // der Werkbank, WEIL sie in ein frisches home mit 32 GB nicht passen
        // (`blade.js` allein ist groesser als der Rest), und bn4net wuerde
        // sich den eigenen Speicher wegnehmen. Die Meldung soll den Anwender
        // warnen, nicht der Motor sich selbst gefaehrden.
        const hatWerkbank = parkLage().park.length > 0;
        sag(getroffen > 0
          ? name + ": " + getroffen + " Instanz(en) beendet"
            + (hatWerkbank
              ? ", startet gleich neu."
              : " - ACHTUNG: keine Werkbank, es startet NICHTS nach."
                + " Mit 'node tools/task.js " + name + "' selbst starten.")
          : "WERKZEUG " + name + " traf NICHTS - laeuft es ueberhaupt?");
        }
      }
    }

    // --- 1a. Rechenzeit kaufen -----------------------------------------------
    // Der Bot hat ein Geldproblem nicht mehr, sondern ein Platzproblem: home
    // fasst 64 GB, davon gehen zwei Steuerhaelften ab, und die Werkzeuge
    // (Vertragsloeser 17,65 GB, Reputationssteuerung 28,4 GB) passen nirgends
    // hin. Ein gekaufter Rechner loest das fuer wenige Millionen - Geld, das
    // ein einziger Coding Contract in einer Sekunde einbringt.
    //
    // Der Faktor 4 auf den Preis ist Absicht: Wer sein Guthaben leerkauft,
    // kann danach keine Augmentierung mehr bezahlen, und die sind der
    // eigentliche Fortschritt.
    // Was bn4rep.js fuer verdiente Augmentierungen braucht, ist tabu.
    const reserviert = ns.fileExists("data/geldbedarf.txt", "home")
      ? Number(ns.read("data/geldbedarf.txt")) || 0 : 0;
    const pl = parkLage();
    const eigene = pl.park.map((x) => x.host);
    const parkRam = new Map(pl.park.map((x) => [x.host, x.ram]));
    // Ohne Preistabelle wird nicht gekauft - lieber gar nicht als auf
    // geratenen Preisen. Ein offener Auftrag blockiert ebenso: sonst
    // bestellte der Kern in jeder Runde einen weiteren Rechner.
    const kaufMoeglich = pl.da && pl.kaufbar && !auftragOffen();
    let a1Gekauft = !kaufMoeglich;
    // WARTENDES WERKZEUG BEI NICHT VOLLEM PARK (02.09.2026, Substanz-
    // Skeptiker): Die Leiter unten verlangt das Vierfache des Preises und
    // sieht das wartende Werkzeug nicht - bbtrain (95 GB) braeuchte 140 Mio
    // ueber die Leiter statt 53 Mio fuer einen passenden 128-GB-Rechner.
    // Hier: die kleinste Stufe, die das Werkzeug fasst, zum Preis x2.
    if (kaufMoeglich && werkzeugWartetGb > 0 && eigene.length < pl.limitAnzahl
        && !eigene.some((h) => (parkRam.get(h) || 0) >= werkzeugWartetGb + 4)) {
      let gb = 32;
      while (gb < werkzeugWartetGb + 4 && gb * 2 <= pl.limitRam) gb *= 2;
      const preis = Number(pl.preise[gb]) || 0;
      const geldFrei = ns.getServerMoneyAvailable("home") - reserviert;
      if (preis > 0 && preis * 2 <= geldFrei) {
        if (beauftrage("kauf", gb, "Werkzeug mit " + werkzeugWartetGb.toFixed(1) + " GB wartet")) {
          sag("Rechner bestellt: " + gb + " GB fuer " + (preis / 1e6).toFixed(2)
            + "m - ein Werkzeug mit " + werkzeugWartetGb.toFixed(1) + " GB wartet auf Platz.");
          werkzeugWartetGb = 0;
          a1Gekauft = true;
        }
      } else if (runde % 60 === 0) {
        sag("Rechner fuer wartendes Werkzeug (" + werkzeugWartetGb.toFixed(1) + " GB): " + gb
          + " GB kosten " + (preis / 1e6).toFixed(1) + "m, frei " + (geldFrei / 1e6).toFixed(0) + "m - warte auf Geld.");
      }
    }
    if (a1Gekauft) {
      // In dieser Runde nichts weiter kaufen.
    } else if (eigene.length < pl.limitAnzahl) {
      // Groesste bezahlbare Stufe. In BitNode 4 verteuert CloudServerSoftcap
      // 1.2 die grossen Rechner ueberproportional, deshalb wird gefragt statt
      // gerechnet.
      // DER KALTSTART BRAUCHT ANDERE REGELN (24.08.2026).
      //
      // Die Leiter begann bei 64 GB und verlangte das VIERFACHE des Preises.
      // Fuer einen eingespielten Bot ist beides richtig; nach einem
      // Knotenwechsel ist es eine Sackgasse. Gemessen in BitNode 6 um 21:40:
      // home faellt auf 32 GB zurueck, bn4net belegt davon 16,25, es bleiben
      // 3,4 GB. Der groesste sonstige Rechner im Netz hat 16 GB. Damit passt
      // KEIN einziges Werkzeug mehr irgendwohin - nicht contracts.js (17,65),
      // nicht darkweb.js (27,65), erst recht nicht der Rest. Ohne darkweb
      // keine Portknacker, ohne Portknacker bleibt es bei 8 von 70 Rechnern,
      // und die naechsten Ziele brauchen genau den einen Port.
      //
      // Der einzige Ausweg ist ein gekaufter Rechner. 64 GB kosten dort
      // 3,52m, mal vier also 14,1m Guthaben - bei gemessenen 260 $/s sind das
      // fuenfzehn Stunden Leerlauf.
      //
      // Deshalb: Solange KEIN eigener Rechner existiert, geht die Leiter bis
      // 32 GB hinunter (das genuegt fuer darkweb.js oder contracts.js) und der
      // Sicherheitsfaktor faellt auf 1,25. Der Faktor soll Geld fuer
      // Augmentierungen schonen - bei Hacking-Level 11 gibt es keine zu
      // kaufen. Sobald der erste Rechner steht, gelten wieder die alten Werte.
      const kaltstart = eigene.length === 0;
      const leiter = kaltstart ? [1024, 512, 256, 128, 64, 32] : [1024, 512, 256, 128, 64];
      // Faktor 1,0 im Kaltstart (02.09.2026): Mit 1,25 stand der Bot in
      // BitNode 10 (CloudServerCost 5, 32 GB = 8,8 Mio) 13,5 Stunden bei
      // 8 von 70 Rechnern, weil 11 Mio verlangt wurden. Bei null eigenen
      // Rechnern gibt es nichts, wofuer Geld geschont werden muesste - jede
      // Stunde ohne Werkbank ist eine Stunde ohne Werkzeuge.
      const faktor = kaltstart ? 1.0 : 4;
      for (const gb of leiter) {
        const preis = Number(pl.preise[gb]) || 0;
        if (!(preis > 0)) continue;
        if (ns.getServerMoneyAvailable("home") - reserviert < preis * faktor) continue;
        if (beauftrage("kauf", gb, kaltstart ? "Kaltstart-Leiter" : "Amortisationsleiter")) {
          sag("Rechner bestellt: " + gb + " GB fuer " + (preis / 1e6).toFixed(2)
            + "m" + (kaltstart ? " (Kaltstart, Faktor 1,0)" : "") + ".");
        }
        break;
      }
    } else {
      // --- 1a2. Serveraufruestung (HEBEL 2, 22.08.2026) ---------------------
      // ns.cloud.upgradeServer wurde von dieser Kette NIE aufgerufen. Alle 25
      // Plaetze sind seit langem belegt, gekauft wurde hoechstens bis 1024 GB
      // und aufgeruestet gar nicht - der Park stand bei 2x128 und 23x64 GB,
      // zusammen 1728 GB, waehrend das Guthaben ein Vielfaches hergab.
      //
      // WELCHER RECHNER. getCloudServerCost (Server/ServerPurchases.ts:22-40):
      //   preis(r) = r * 55000 * CloudServerCost * CloudServerSoftcap^max(0, log2(r)-6)
      // CloudServerCost ist in BitNode 4 nicht gesetzt und damit 1, der
      // Softcap ist 1.2 (BitNode.tsx:632). Eine Verdopplung von r auf 2r
      // kostet damit preis(r) * 1.4 und bringt r zusaetzliche GB; der Preis
      // JE GB ist 1.4 * 55000 * 1.2^(log2 r - 6) und waechst mit der Groesse
      // des Rechners. Der KLEINSTE Rechner liefert deshalb immer das
      // billigste GB - darum wird der verdoppelt und nicht der groesste.
      // Konkret: 64 -> 128 GB kostet 4.93 Mio fuer 64 GB, also 77 k$ je GB;
      // 512 -> 1024 GB kostet 68.1 Mio fuer 512 GB, also 133 k$ je GB.
      //
      // WIEVIEL DARF DAS KOSTEN. Die Vermutung war, ein Rechnerpark kurz vor
      // einem Augmentierungs-Einbau sei verbranntes Geld, weil der Einbau
      // alle gekauften Rechner loescht (Prestige.ts:73). Das stimmt fuer die
      // Rechner - aber das GUTHABEN faellt beim selben Einbau ebenfalls auf
      // 1000 Dollar (PlayerObjectGeneralMethods.ts:102,
      // this.money = 1000 + CONSTANTS.Donations, gerufen aus
      // Prestige.ts:69). Nicht ausgegebenes Geld ist also genauso verloren
      // wie ein aufgeruesteter Rechner. Fuer die Zeit nach dem Einbau laesst
      // sich gar nicht sparen; das Einzige, was hinueberkommt, sind
      // Augmentierungen. Daraus folgen genau zwei Grenzen:
      //
      //  (1) Was bn4rep.js fuer bereits verdiente Augmentierungen braucht,
      //      ist tabu (reserviert, aus data/geldbedarf.txt). Augmentierungen
      //      sind dauerhafter Fortschritt, Rechenzeit ist es nicht. Zusaetz-
      //      lich wird nie mehr als die Haelfte des freien Guthabens auf
      //      einmal ausgegeben, damit ein Preissprung nicht ins Leere faellt.
      //  (2) Der Ausbau muss sich VOR dem naechsten Einbau bezahlt machen,
      //      sonst waere das Geld in der naechsten Augmentierung besser
      //      aufgehoben. Wie nah der Einbau ist, weiss bn4rep.js: Es baut ab
      //      drei gekauften, noch nicht eingebauten Augmentierungen ein
      //      (MINDEST_WARTESCHLANGE, bn4rep.js) und meldet diese Zahl als
      //      "wartend" in data/bn4rep.json.
      // Mehrere Schritte je Runde, nicht einer. Ein Schritt kostete anfangs
      // 4.9 Millionen, waehrend in denselben zehn Sekunden 18 Millionen
      // hereinkamen - bei einem Schritt je Runde waere das Guthaben schneller
      // gewachsen als der Park, und der Ausbau haette Stunden gebraucht, fuer
      // die es keinen Grund gibt. Die Schleife bricht von selbst ab, sobald
      // eines der Kriterien nicht mehr traegt; die Obergrenze von 25 ist nur
      // die Notbremse, damit eine Runde nicht beliebig lange laeuft.
      const maxGb = pl.limitRam;

      // EIN WARTENDES WERKZEUG SCHLAEGT DEN AMORTISATIONSDECKEL (02.09.2026).
      //
      // In BitNode 10 Lauf 2 lief bn4rep.js 26 Stunden lang nicht: Der Park
      // war voll (15 von 15, CloudServerLimit 0,6), der groesste Rechner hatte
      // 512 GB, bn4rep braucht 847. Die Schleife unten ruestet immer den
      // KLEINSTEN Rechner auf - und sie war in einem Kreis gefangen: ohne
      // laufendes bn4rep ist bn4rep.json alt, `wartend` steht auf 99, der
      // Deckel auf 600 s, und schon die billigste Stufe (627 s) fiel durch;
      // bn4rep passte nirgends, also blieb die Datei alt. Ohne bn4rep gibt es
      // keine Augmentierungen, und das ist mehr wert als jede Amortisation.
      //
      // Deshalb: Meldet der Starter (2c) ein Werkzeug, das nirgends passt,
      // wird der GROESSTE Rechner verdoppelt, bis das Werkzeug neben dem, was
      // dort ohne Arbeiter schon liegt, Platz hat - ohne Deckel, nur mit der
      // Regel "halbes Guthaben bleibt".
      if (kaufMoeglich && werkzeugWartetGb > 0 && eigene.length) {
        const groesster = eigene
          .map((h) => ({ host: h, gb: parkRam.get(h) || 0 }))
          .sort((a, b) => b.gb - a.gb)[0];
        let belegtOhneArbeiter = 0;
        for (const pr of ns.ps(groesster.host)) {
          if (WORKER.includes(pr.filename)) continue;
          belegtOhneArbeiter += ns.getScriptRam(pr.filename, "home") * pr.threads;
        }
        const noetig = werkzeugWartetGb + belegtOhneArbeiter + 4;
        let zielGb = groesster.gb;
        while (zielGb < noetig && zielGb * 2 <= maxGb) zielGb *= 2;
        if (zielGb > groesster.gb) {
          // Der Ausbaupreis ist die DIFFERENZ zweier Rechnerpreise
          // (ServerPurchases.ts): was der Zielausbau kostet, minus was der
          // vorhandene wert ist. Damit laesst er sich aus der Preistabelle
          // rechnen, ohne getServerUpgradeCost (0,25 GB) zu bezahlen.
          const kosten = Math.max(0,
            (Number(pl.preise[zielGb]) || 0) - (Number(pl.preise[groesster.gb]) || 0));
          const geldFrei = ns.getServerMoneyAvailable("home") - reserviert;
          if (kosten > 0 && kosten * 2 <= geldFrei) {
            if (beauftrage("upgrade", zielGb,
                "Werkzeug mit " + werkzeugWartetGb.toFixed(1) + " GB wartet", groesster.host)) {
              sag(groesster.host + ": " + groesster.gb + " -> " + zielGb + " GB bestellt fuer rund "
                + (kosten / 1e6).toFixed(1) + "m - ein Werkzeug mit "
                + werkzeugWartetGb.toFixed(1) + " GB wartet auf Platz.");
              werkzeugWartetGb = 0;
              a1Gekauft = true;   // die Amortisationsschleife dieser Runde entfaellt
            }
          } else if (runde % 60 === 0) {
            sag("Ausbau fuer wartendes Werkzeug (" + werkzeugWartetGb.toFixed(1) + " GB): "
              + groesster.host + " -> " + zielGb + " GB kostet " + (kosten / 1e6).toFixed(1)
              + "m, frei " + (geldFrei / 1e6).toFixed(0) + "m - warte auf Geld.");
          }
        }
      }

      for (let schritt = 0; schritt < 25 && !a1Gekauft; schritt++) {
        const smallest = eigene
          .map((h) => ({ host: h, gb: parkRam.get(h) || 0 }))
          .sort((a, b) => a.gb - b.gb)[0];
        // Nichts mehr aufzuruesten: kein gekaufter Rechner da, oder der
        // kleinste ist schon am Maximum von 2^20 GB.
        if (!smallest || !(smallest.gb > 0) || smallest.gb >= maxGb) break;
        const zielGb = smallest.gb * 2;
        const zusatzGb = zielGb - smallest.gb;
        // Preisdifferenz statt getServerUpgradeCost (0,25 GB): der Ausbau
        // kostet, was der Zielausbau kostet, minus was der vorhandene wert
        // ist (ServerPurchases.ts). Beide Werte stehen in der Preistabelle.
        const kosten = Math.max(0,
          (Number(pl.preise[zielGb]) || 0) - (Number(pl.preise[smallest.gb]) || 0));

        // Ertrag je GB und Sekunde aus der letzten Runde. Massgeblich ist der
        // GRENZERTRAG genau dieses Schrittes: was die zusatzGb bringen, die
        // hier bezahlt werden - nicht, was der bereits laufende Speicher
        // bringt. Herleitung und Messung stehen bei grenzErtrag() oben.
        // Das Modell dahinter ist gegen die Telemetrie geprueft und stimmt
        // auf 2 % (stapelGb/kalenderPlaetze/erwartetProS, 22.08.2026); es
        // waechst und faellt automatisch mit Level, Zielen und BitNode,
        // anders als eine eingetragene Zahl.
        //
        // ABER: Der Ertrag gilt nur fuer Speicher, den die Geldziele auch
        // AUFNEHMEN. Seit der Kapazitaetsgrenze (siehe kennzahlen) ist das
        // nicht mehr selbstverstaendlich - nach dem Ausbau auf 63.612 GB
        // blieben in einer Runde 39.030 GB uebrig, weil die Summe der
        // Kapazitaeten aller erreichbaren Ziele endlich ist. Weiteren
        // Speicher zu kaufen, waehrend der vorhandene brachliegt, ist
        // verbranntes Geld: Der Grenzertrag ist dort null, nicht effFlotte.
        //
        // Der Ueberschuss geht zwar an die Erfahrung und liegt damit nicht
        // buchstaeblich brach - aber Erfahrung ist keine Rechtfertigung fuer
        // eine Ausgabe, die sich in Dollar amortisieren soll. Deshalb: Sobald
        // die Geldziele mehr als ein Zwanzigstel des Netzes nicht abnehmen,
        // wird nicht mehr gekauft. grenzErtrag() faengt denselben Fall
        // inzwischen selbst ab (kein Abnehmer - kein Ertrag); die Bremse
        // bleibt trotzdem stehen, weil sie einen zweiten Fall deckt: eine
        // Zuteilung, die die vorhandene Aufnahme nicht FINDET. Das ist kein
        // Modellfall, das ist ein Fehler - und dann ist neuer Speicher erst
        // recht keine Loesung.
        const ertrag = ueberschussMerker > ramTotal * 0.05 ? 0 : grenzErtrag(zusatzGb);
        const amortSek = (ertrag > 0 && zusatzGb > 0)
          ? kosten / (zusatzGb * ertrag) : Infinity;

        // wartend aus bn4rep.js. Fehlt die Meldung oder ist sie alt, wird der
        // Einbau als NAH angenommen - vorsichtig, nicht grosszuegig. Ein
        // abgestuerztes bn4rep.js darf nicht dazu fuehren, dass eine veraltete
        // Null teure Ausbauten freigibt, waehrend laengst drei Augmentierungen
        // auf den Einbau warten.
        let wartend = 99;
        try {
          if (ns.fileExists("data/bn4rep.json", "home")) {
            const r = JSON.parse(ns.read("data/bn4rep.json"));
            if (Number.isFinite(r.zeit) && Date.now() - r.zeit < 300000) {
              wartend = r.wartend || 0;
            }
          }
        } catch { /* kaputtes JSON - dann bleibt es bei "nah" */ }
        // Zwei Stufen genuegen. Zehn Minuten sind auch dann noch reichlich:
        // Die billigen Stufen amortisieren sich in drei bis fuenf Minuten,
        // erst weit oben auf der Kostenkurve wird es eng - und genau dort
        // soll die Bremse ja greifen.
        const amortDeckel = wartend >= 2 ? 600 : 1800;
        const geldFrei = ns.getServerMoneyAvailable("home") - reserviert;

        if (kosten > 0 && amortSek <= amortDeckel && kosten * 2 <= geldFrei) {
          // EIN AUFTRAG JE RUNDE. Die Schleife lief bisher bis zu 25 Schritte
          // und kaufte in einer Runde mehrfach; ueber Auftraege geht das
          // nicht, weil das Ergebnis erst in der naechsten Runde vorliegt.
          // Der Park waechst dadurch langsamer - aber ein Auftrag je 10 s ist
          // immer noch schneller, als das Guthaben nachwaechst.
          if (!beauftrage("upgrade", zielGb, "Amortisation in "
              + Math.round(amortSek) + " s", smallest.host)) break;
          sag(smallest.host + ": " + smallest.gb + " -> " + zielGb + " GB bestellt fuer rund "
            + (kosten / 1e6).toFixed(1) + "m, amortisiert in "
            + Math.round(amortSek) + " s.");
          break;
        }
        // Nicht stillschweigend nichts tun. Ein Ausbau, der seit einer Stunde
        // nicht stattfindet, muss von aussen erklaerbar sein. Nur beim ersten
        // Schritt melden - die spaeteren brechen normal ab, das ist kein
        // Zustand, ueber den berichtet werden muesste.
        if (schritt === 0 && runde % 60 === 0 && kosten > 0) {
          sag("Ausbau wartet: " + smallest.host + " -> " + zielGb + " GB kostet "
            + (kosten / 1e6).toFixed(1) + "m, amortisiert in "
            + (Number.isFinite(amortSek) ? Math.round(amortSek) : "?") + " s (Deckel "
            + amortDeckel + "), frei " + (geldFrei / 1e6).toFixed(0) + "m.");
        }
        break;
      }
    }

    // --- 1b. Werkbank waehlen -------------------------------------------------
    // Ein gerooteter Rechner, der NICHT mit Arbeitern vollgestopft wird,
    // sondern Platz fuer Werkzeuge laesst. contracts.js braucht 17,65 GB und
    // passt damit nirgends hin, solange jeder freie Block sofort mit
    // hack-Faeden belegt wird.
    //
    // Warum das den home-Ausbau schlaegt: Coding Contracts sind in BitNode 4
    // NICHT gedaempft. Weder CodingContractMoney noch die Reputationsprämie
    // stehen in den Multiplikatoren dieses Knotens (BitNode.tsx:627-655), also
    // gelten beide mit 1.0 - waehrend Verbrechen bei 0.2 und Hacking bei
    // 0.0225 liegen. Ein einziger Geld-Vertrag bringt bis zu 75 Millionen,
    // mehr als eine Stunde Homicide. Und die Reputation wird direkt auf das
    // Faktionskonto gebucht, am 0,75-Daempfer der Faktionsarbeit vorbei.
    const WERKBANK_GB = 20;
    let werkbank = null, werkbankGb = 0;
    for (const host of hosts) {
      if (host === "home" || !ns.hasRootAccess(host)) continue;
      const gb = ns.getServerMaxRam(host);
      if (gb >= WERKBANK_GB && gb > werkbankGb) { werkbank = host; werkbankGb = gb; }
    }
    // Notfalls home. Nach einem Augmentierungs-Einbau sind alle gekauften
    // Rechner weg, TOR und die Portprogramme ebenfalls - es dauert eine
    // Stunde Shoplift, bis wieder ein 20-GB-Rechner offensteht. Solange liegt
    // der Vertragsloeser brach, obwohl er auf home passt: 64 GB bleiben beim
    // Einbau erhalten (nur der BitNode-Wechsel setzt sie zurueck). Das ist der
    // Unterschied zwischen einer Stunde Anlauf und fuenf Minuten.
    // Die Schwelle 18 war auf contracts.js gemuenzt (17,65 GB) und hat
    // deshalb im frischen Knoten alles blockiert: home hatte 15,75 GB frei,
    // also fiel die Werkbank ganz aus - und mit ihr der Werkzeugstarter, der
    // nur innerhalb von `if (werkbank)` laeuft. popups.js braucht 1,6 GB und
    // haette dort muehelos Platz gefunden; stattdessen sammelten sich die
    // Dialoge im Spiel, weil eine Schwelle fuer ein ganz anderes Werkzeug im
    // Weg stand. Jetzt entscheidet das KLEINSTE noch nicht laufende Werkzeug:
    // passt eines, ist home Werkbank; passt keines, aendert die Werkbank
    // ohnehin nichts.
    if (!werkbank) {
      const freiHome = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
      let kleinstes = Infinity;
      for (const [datei] of WERKZEUGE) {
        const r = ns.getScriptRam(datei, "home");
        if (r > 0 && r < kleinstes) kleinstes = r;
      }
      if (Number.isFinite(kleinstes) && freiHome >= kleinstes) werkbank = "home";
    }
    werkbankMerker = werkbank;

    // --- 1c. Wieviel die Werkbank wirklich freihalten muss ---------------------
    // HEBEL 1 (22.08.2026). Bis hierher war die Werkbank PAUSCHAL von der
    // Arbeiterverteilung ausgenommen ("if (host === werkbank) continue"). Das
    // war gedacht fuer einen gekauften 20-GB-Rechner, auf dem gerade
    // contracts.js Platz finden sollte. Inzwischen ist die Werkbank
    // fulcrumtech mit 2048 GB - rund 28 % des gesamten Netzspeichers - und die
    // Werkzeuge laufen alle auf home, weil sie dort schon liefen, als das Netz
    // noch klein war. Die netzweite Laufpruefung weiter unten startet sie
    // deshalb nie neu, und die Werkbank stand mit NULL Prozessen da: 2048 GB
    // vollstaendig ungenutzt. Gemessen am 22.08.2026 im Spielstand.
    //
    // Jetzt wird nur noch der tatsaechliche Bedarf freigehalten:
    //   - Werkzeuge, die HIER laufen (ihr Platz darf nicht wegverteilt werden;
    //     genau genommen belegen sie ihn schon, aber getServerUsedRam zaehlt
    //     sie mit - der Posten steht hier trotzdem, weil ein Werkzeug zwischen
    //     zwei Runden abstuerzen kann und der Platz dann sofort wieder da sein
    //     muss, statt erst von einer Raeumung zurueckgeholt zu werden).
    //   - Werkzeuge, die NIRGENDS laufen und also hier gestartet werden.
    //   - Ein Werkzeug, das auf einem ANDEREN Rechner laeuft, braucht hier
    //     nichts. Genau das ist der Unterschied zu vorher.
    // Dazu ein Puffer in Groesse des groessten Werkzeugs, damit ein Absturz
    // sofort aufgefangen wird, ohne dass fliegende Arbeit weggeworfen werden
    // muss.
    //
    // ACHTUNG, das darf NICHT dazu fuehren, dass ein Werkzeug doppelt laeuft:
    // die Entscheidung, ob gestartet wird, faellt weiterhin allein in 2c ueber
    // die netzweite Prozessliste. Hier wird nur Platz reserviert, nie gestartet.
    // toolHosts und die Liste in 2c stammen aus demselben Rundenzustand -
    // zwischen beiden Stellen wird kein Werkzeug gestartet oder beendet.
    const toolHosts = new Map();
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      for (const pr of ns.ps(host)) {
        if (WORKER.includes(pr.filename)) continue;
        if (!toolHosts.has(pr.filename)) toolHosts.set(pr.filename, []);
        toolHosts.get(pr.filename).push(host);
      }
    }
    let werkbankReserve = 0;
    // Auf home greift schon reserveHome(); zwei Reserven uebereinander wuerden
    // dem Netz denselben Platz zweimal abziehen.
    if (werkbank && werkbank !== "home") {
      let groesstes = 0;
      for (const [datei] of WERKZEUGE) {
        // getScriptRam gibt bei fehlender Datei still 0 zurueck. Ein solches
        // Werkzeug bekommt keine Reserve - es liesse sich ohnehin nicht
        // starten, und 2c meldet den Fall.
        const braucht = ns.getScriptRam(datei, "home");
        if (!(braucht > 0)) continue;
        if (braucht > groesstes) groesstes = braucht;
        const wo = toolHosts.get(datei);
        if (wo && wo.length && !wo.includes(werkbank)) continue;
        werkbankReserve += braucht;
      }
      werkbankReserve += groesstes;
    }

    // --- 2. Ziele waehlen (Erfahrung und mehrere Geldziele) --------------------
    // STUFE 2 (22.08.2026): frueher genau EIN Geldziel fuer das ganze Netz -
    // jeder Faden, der nicht auf ihm oder dem Erfahrungsziel landete, blieb
    // liegen, obwohl das Netz laengst mehr als ein Ziel gleichzeitig bedienen
    // kann. autopilot.js macht das seit jeher so (MAX_TARGETS/maxTargets,
    // autopilot.js:103 und :1173) und skaliert die Zielzahl am Netzspeicher
    // statt an einer festen Zahl - aus demselben Grund wie dort: eine feste
    // Zahl passt nur zu einer einzigen Ausbaustufe.
    // HEBEL 3 (22.08.2026), zweite Fassung. Erste Fassung war eine feste,
    // logarithmisch am Netzspeicher haengende Zahl (vier Ziele bei 7276 GB)
    // und hat gemessen +41 % gebracht. Sie ist trotzdem falsch, und der
    // Serverausbau hat es sofort gezeigt: Bei 63.612 GB waren daraus sechs
    // Ziele, jedes mit rund 7000 GB - das Fuenffache dessen, was ein Ziel
    // aufnehmen kann. Die Server standen leergehackt bei 0 bis 11 % Guthaben
    // und der Ertrag FIEL.
    //
    // Eine Zielanzahl ist die falsche Stellschraube. Richtig ist die
    // KAPAZITAET je Ziel (siehe kennzahlen oben) und eine Zuteilung, die der
    // Reihe nach auffuellt statt gleich zu verteilen. Die Zielanzahl ist
    // damit nur noch eine Obergrenze gegen zu viele exec-Aufrufe und
    // ns-Abfragen je Runde: Jedes zusaetzliche Ziel kostet drei Abfragen in
    // planMix und bis zu drei Wuensche im Verteiler.
    //
    // 25 als Deckel, sonst alle Kandidaten. Ein schwaches Ziel schadet
    // nicht mehr: Der Wasserfall gibt ihm nur, was die besseren nicht
    // aufnehmen konnten - und dieser Speicher laege sonst brach.
    const MONEY_TARGET_COUNT = 25;

    // War bisher EIN Ziel nach Erfahrung je Sekunde fuer ALLE Arbeiter - das
    // liess das Geldeinkommen um Faktor 70 einbrechen (545.000 auf 8.000 je
    // Minute), weil joesguns zwar der beste Erfahrungsserver ist, aber wenig
    // Geld haelt. Gemessen: Erfahrung und Geld skalieren beide linear mit der
    // Fadenzahl (keine Saettigung unter ~1300 Faeden je Ziel), aber schon
    // ~180 Faeden auf dem Erfahrungsziel holen die volle Erfahrungsrate -
    // joesguns liefert 0,262 Erfahrung je Faden und Sekunde (Bestwert im
    // Netz), silver-helix nur 0,062, dafuer deutlich mehr Geld. Jeder Faden
    // ueber 180 ist im Geld besser angelegt. Deshalb zwei Ziele mit festem
    // Erfahrungsbudget, der Rest netzweit ans Geldziel.
    //
    // Ohne den beruehmten Halbierungsfilter. "Nur Ziele bis zum halben Level"
    // ist eine Spaetspielregel; beim Neustart mit Hacking 1 ergibt sie die
    // Schwelle 0,5, an der selbst n00dles scheitert. Dann gibt es kein Ziel,
    // keinen Arbeiter, keine Erfahrung - und weil das Level nicht steigt, wird
    // die Schranke nie milder. Genau daran stand der Bot heute zwanzig Minuten.
    //
    //   expGain   = 3 + 0.3 * baseDifficulty          (Hacking.ts:30-38)
    //   hackTime  ~ (2.5 * requiredHackingSkill * minDifficulty + 500)
    //               / (hackingLevel + 50)
    //   expValue  = expGain / hackTime
    //   moneyValue = moneyMax / hackTime
    //
    // minDifficulty statt hackDifficulty in der Dauer: Die Arbeiter schwaechen
    // jeden Server ohnehin auf sein Minimum herunter (weiter unten waehlt der
    // Skriptwaehler weaken.js, solange hackDifficulty > minDifficulty + 5) -
    // im Dauerbetrieb naehert sich die tatsaechliche Dauer also minDifficulty
    // an, nicht dem Startwert. baseDifficulty dagegen bleibt fuer die
    // Erfahrung massgeblich: Es wird bei der Servererzeugung einmalig gesetzt
    // und aendert sich durch weaken NICHT (Server.ts:82 this.baseDifficulty =
    // this.hackDifficulty, danach ruehrt nur noch capDifficulty an
    // hackDifficulty) - waehrend hackDifficulty sinkt und mit ihm die Dauer.
    //
    // Geldziel bewusst NICHT nach moneyMax/minDifficulty: Ein hoeheres
    // moneyMax bedeutet NICHT automatisch mehr Geld je Sekunde, weil die
    // Zykluszeit mitwaechst. Gemessen: omega-net haelt mehr Maximalgeld als
    // silver-helix, liefert aber weniger, weil seine Zykluszeit schneller
    // waechst als seine Beute - moneyMax/minDifficulty wuerde omega-net
    // trotzdem bevorzugen, moneyMax/hackTime nicht.
    // getScriptRam gibt bei fehlender Datei still 0 zurueck
    // (NetscriptFunctions.ts:1179-1191). Ungeprueft ergaebe das
    // Math.floor(frei/0) = Infinity, und das Spiel wirft daraufhin eine
    // Ausnahme. Die Pruefung steht weiter unten bei den Arbeitern; hier oben
    // werden die Werte gebraucht, weil die Kennzahlen je Ziel sie brauchen.
    const ramHack = ns.getScriptRam("worker/hack.js", "home");
    const ramGrow = ns.getScriptRam("worker/grow.js", "home");
    const ramWeaken = ns.getScriptRam("worker/weaken.js", "home");

    // --- Kennzahlen je Ziel ---------------------------------------------------
    // Zwei Zahlen je Server, beide fuer den SAUBEREN Dauerbetrieb gerechnet
    // (Sicherheit am Minimum), beide aus dem Spiel selbst statt aus
    // nachgebauten Formeln:
    //
    //   steadyEff   Ertrag in Dollar je GB und Sekunde. Sagt, WIE GUT das Ziel
    //               ist - danach wird sortiert und danach entscheidet das
    //               Nutzen-Gate der Anlaufphase.
    //   kapazitaet  Wieviel Arbeitsspeicher das Ziel ueberhaupt aufnehmen
    //               kann, in GB. Sagt, WIEVIEL davon man haben kann.
    //
    // Die Kapazitaet ist der Befund vom 22.08.2026, der die Serveraufruestung
    // zunaechst zu einem Rueckschritt gemacht hat. Der Gleichgewichtsertrag
    // ist zwar skalenfrei - die Mischung aus hack, grow und weaken haelt jedes
    // Verhaeltnis - aber der BETRIEB ist es nicht: Zugeteilt wird alle zehn
    // Sekunden, eine Welle fliegt zwanzig Sekunden bis Minuten. Landen in
    // einem hackTime-Fenster zu viele hack-Faeden, raeumen sie den Server
    // vollstaendig leer, statt ihn bei 95 % zu halten. Genau das war messbar:
    // Nach dem Ausbau von 7.276 auf 63.612 GB stand phantasy bei 0 %
    // Guthaben, silver-helix bei 1 %, der grow-Anteil bei 77 % und der
    // hack-Anteil bei 11 % - und der Ertrag FIEL von 1.83 auf 1.54 Mio/s.
    //
    // Herleitung der Grenze. Ein hack-Faden zieht den Anteil p*chance vom
    // AKTUELLEN Guthaben ab. Werden je Sekunde n Faeden gestartet, landen in
    // einem hackTime-Fenster n*hackTime davon, der Abzug ist also rund
    // n*hackTime*p*chance. Damit die Rueckkopplung im linearen Bereich bleibt
    // - MIX_MONEY_LOW 0.75 bis MIX_MONEY_HIGH 0.95, also 20 Prozentpunkte -
    // darf dieser Abzug KAP_ABZUG nicht ueberschreiten:
    //     n = KAP_ABZUG / (hackTime * p * chance)
    // Der Speicher, den diese n Faeden je Sekunde belegen, ist n mal dem
    // GB-Sekunden-Preis einer Mischeinheit. Daraus:
    //     kapazitaet = KAP_ABZUG * gbSekProEinheit / (hackTime * p * chance)
    // Fuer phantasy ergibt das rund 1400 GB - und genau in dieser
    // Groessenordnung lief es vor dem Ausbau sauber (934 GB, 313 $/GB*s).
    const KAP_ABZUG = 0.2;
    const SERVER_MAX_GROWTH_LOG = 0.00349388925425578;
    const wachstumsLog = (hd) => Math.min(Math.log1p(0.03 / hd), SERVER_MAX_GROWTH_LOG);
    const FORTIFY_HACK = 0.002;
    const FORTIFY_GROW = 0.004;
    const WEAKEN_POWER = 0.05;
    const MIX_MONEY_HIGH = 0.95;
    // Die Spielerwerte fuer die eigenen Formeln, einmal je Runde. getPlayer
    // zahlt der Kern ohnehin (Motorzeit liest totalPlaytime daraus).
    const spielerFuerCalc = (() => {
      try {
        const pl = ns.getPlayer();
        return {
          skill: pl.skills.hacking,
          int: pl.skills.intelligence || 0,
          multMoney: (pl.mults && pl.mults.hacking_money) || 1,
          multChance: (pl.mults && pl.mults.hacking_chance) || 1,
          multGrow: (pl.mults && pl.mults.hacking_grow) || 1,
          multSpeed: (pl.mults && pl.mults.hacking_speed) || 1,
        };
      } catch {
        return { skill: 1, int: 0, multMoney: 1, multChance: 1, multGrow: 1, multSpeed: 1 };
      }
    })();

    const kennzahlen = (host, s) => {
      // ===================================================================
      // DIE ANALYSE-FAMILIE WIRD GERECHNET, NICHT GEFRAGT (Position C.7)
      // ===================================================================
      //
      // ns.hackAnalyze, ns.hackAnalyzeChance und ns.growthAnalyze kosten je
      // 1 GB - drei Gigabyte in einer Datei, die im Kaltstart auf ein home mit
      // 32 GB passen muss, neben boot.js und den Arbeitern.
      //
      // Die Formeln stehen in lib/calc.js und sind dieselben wie im Spiel
      // (Hacking.ts:44 fuer den Beuteanteil, :15 fuer die Chance,
      // ServerHelpers.ts fuer das Wachstum). Alles, was sie brauchen, liegt
      // schon vor: `s` kommt aus ns.getServer, der Spieler aus ns.getPlayer -
      // beide zahlt der Kern ohnehin.
      //
      // DER BITNODE-MULTIPLIKATOR IST DER PUNKT, AN DEM DAS SCHIEFGEHT.
      // bn4net.js:3404-3410 warnt ausdruecklich: calc.js rechnet ohne ihn, und
      // ein naiver Import haette in BitNode 4 eine stille Verfuenffachung der
      // Beute je Faden bedeutet (ScriptHackMoney 0,2). Er kommt deshalb aus
      // lib/bitnodes.json, erzeugt aus dem Spielquelltext.
      const p = calcHackPercent(
        { sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill },
        { skill: spielerFuerCalc.skill, multMoney: spielerFuerCalc.multMoney },
        bnScriptHackMoney);
      const chance = calcHackChance(
        { sec: s.hackDifficulty, reqSkill: s.requiredHackingSkill, root: s.hasAdminRights },
        spielerFuerCalc);
      // growthAnalyze(host, 2) liefert die Fadenzahl fuer eine Verdopplung;
      // k ist LN2 geteilt durch sie. calc.js liefert k direkt - fuer diesen
      // Zweck ist das gleichwertig, weil sich der additive Ein-Dollar-Anteil
      // bei einer Verdopplung heraushebt (siehe die Begruendung bei
      // wachstumsFaeden weiter unten).
      const k = calcGrowthLog(
        { sec: s.hackDifficulty, growth: s.serverGrowth },
        spielerFuerCalc.multGrow, 1, bnServerGrowthRate);
      // Alles auf minDifficulty hochrechnen. hackAnalyze & Co. liefern immer
      // den IST-Wert; ein verschmutzter Server saehe sonst dauerhaft
      // schlechter aus, als er nach dem Saeubern waere - und wuerde vom
      // Nutzen-Gate aus dem falschen Grund verworfen. Jeder Faktor haengt
      // bekannt von der Sicherheit ab:
      //   p, chance  ~ (100 - hackDifficulty)      (Hacking.ts:50, :15)
      //   hackTime   ~ 2.5*req*hackDifficulty+500  (Hacking.ts:64-70)
      //   k          ~ min(log1p(0.03/hd), ServerMaxGrowthLog)
      //                (grow.ts:16-19, Constants.ts:8)
      // Der Deckel ServerMaxGrowthLog greift ab hackDifficulty <= 8.571;
      // ohne ihn waere die Umrechnung fuer omega-net (min 9), silver-helix
      // (10) und iron-gym (10) falsch.
      const hdIst = s.hackDifficulty, hdMin = s.minDifficulty;
      const sauber = (100 - hdIst) > 0 ? (100 - hdMin) / (100 - hdIst) : 1;
      const pMin = Math.min(1, p * sauber);
      const chanceMin = Math.min(1, chance * sauber);
      const zeitIst = 2.5 * s.requiredHackingSkill * hdIst + 500;
      const zeitMin = 2.5 * s.requiredHackingSkill * hdMin + 500;
      const hackTimeMin = ns.getHackTime(host) * (zeitIst > 0 ? zeitMin / zeitIst : 1) / 1000;
      const kMin = k * (wachstumsLog(hdIst) > 0 ? wachstumsLog(hdMin) / wachstumsLog(hdIst) : 1);
      // grow dauert das 3,2-fache, weaken das 4-fache eines hack
      // (Hacking.ts:81-95).
      const gphMin = kMin > 0 ? (pMin * chanceMin) / kMin : 0;
      const wphMin = (FORTIFY_HACK * chanceMin + FORTIFY_GROW * gphMin) / WEAKEN_POWER;
      const gbSekProEinheit = hackTimeMin
        * (ramHack + 3.2 * gphMin * ramGrow + 4 * wphMin * ramWeaken);
      const beute = pMin * chanceMin;
      // null statt 0, wenn sich nichts bestimmen laesst: Bei hackDifficulty
      // >= 100 gibt hackAnalyze 0 zurueck (Hacking.ts:46). Ein Gate, das
      // darauf mit "unrentabel" antwortet, wuerde genau diesen Server fuer
      // immer ungesaeubert liegen lassen. Unbekannt heisst: durchlassen.
      const brauchbar = p > 0 && gbSekProEinheit > 0 && beute > 0 && hackTimeMin > 0;
      return {
        p, chance, k,
        // Dieselben Groessen im VORBEREITETEN Zustand. Der Stapelbetrieb
        // braucht genau sie: seine Auftraege landen auf einem Server, der auf
        // Mindestsicherheit steht, also gelten dort pMin/chanceMin/kMin - und
        // zwar fuer jeden Stapel dieselben, sonst verschiebt sich die Kette
        // mit jeder Ablesung der Momentansicherheit selbst.
        pMin, chanceMin, kMin, hackTimeMin,
        steadyEff: brauchbar ? (s.moneyMax * MIX_MONEY_HIGH * beute) / gbSekProEinheit : null,
        kapazitaet: brauchbar ? (KAP_ABZUG * gbSekProEinheit) / (hackTimeMin * beute) : 0,
      };
    };

    let expTarget = null, expBestValue = 0;
    const moneyCandidates = [];
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      const s = ns.getServer(host);
      if (!s.moneyMax || s.requiredHackingSkill > ns.getHackingLevel()) continue;
      const hackTime = (2.5 * s.requiredHackingSkill * s.minDifficulty + 500)
        / (ns.getHackingLevel() + 50);

      const expGain = 3 + 0.3 * s.baseDifficulty;
      const expValue = expGain / hackTime;
      if (expValue > expBestValue) { expBestValue = expValue; expTarget = host; }

      // Sortiert wird seit dem 22.08.2026 nach steadyEff statt nach der alten
      // Naeherung moneyMax*skillMult*difficultyMult/hackTime. Die Naeherung
      // liess den Wachstumsaufwand weg und hat deshalb Server bevorzugt, die
      // viel Geld halten, es aber nur langsam nachwachsen lassen. Belegt:
      // iron-gym stand darin auf Rang 5 und bekam nach dem Serverausbau
      // 11.609 GB, obwohl es im Gleichgewicht nur 154 $/GB*s bringt - halb
      // so viel wie phantasy.
      let kz = null;
      try { kz = kennzahlen(host, s); } catch { kz = null; }
      if (kz && kz.steadyEff > 0) {
        moneyCandidates.push({ host, moneyValue: kz.steadyEff, kapazitaet: kz.kapazitaet });
      }
    }
    moneyCandidates.sort((a, b) => b.moneyValue - a.moneyValue);

    // Erfahrungsziel ausschliessen: es hat sein eigenes festes Fadenbudget
    // (EXP_THREAD_BUDGET weiter unten) und soll nicht zusaetzlich als Geldziel
    // zaehlen - sonst bekaeme derselbe Host zwei getrennte exec-Auftraege mit
    // je eigener Fadenzaehlung, ohne jeden Nutzen.
    // Gesperrte Ziele fallen VOR dem Zuschnitt heraus, nicht danach: Sonst
    // belegte ein gesperrtes Ziel weiter seinen Platz in der Liste, und die
    // Sperre haette nur den Platz stillgelegt statt ihn weiterzugeben.
    // Abgelaufene Sperren werden im selben Durchgang aufgeraeumt, damit die
    // Karte nicht ueber Tage waechst.
    for (const [host, bis] of gesperrtBis) if (Date.now() >= bis) gesperrtBis.delete(host);
    let moneyTargets = moneyCandidates
      .filter((c) => c.host !== expTarget && !gesperrtBis.has(c.host))
      .slice(0, MONEY_TARGET_COUNT)
      .map((c) => c.host);

    // Randbedingung: kein eigenstaendiges Geldziel gefunden (z. B. ganz am
    // Anfang, wenn ausser dem Erfahrungsziel noch nichts erreichbar ist) -
    // dann alles aufs Erfahrungsziel, wie zuvor. sameTarget loest den
    // Ein-Ziel-Fall unten aus.
    if (moneyTargets.length === 0 && expTarget) moneyTargets = [expTarget];
    const sameTarget = moneyTargets.length === 1 && moneyTargets[0] === expTarget;

    // --- Stapelziele aussondern (Stufe 4, 22.08.2026) ---------------------
    // Ein Stapelziel wird NICHT mehr von der offenen Steuerung bedient. Beide
    // Verfahren auf demselben Server gleichzeitig waere das Schlechteste aus
    // zwei Welten: die offenen hack-Wellen landen ungetaktet zwischen den
    // Stapeln, heben die Sicherheit und verschieben deren Laufzeiten.
    //
    // Warum ueberhaupt zwei Verfahren nebeneinander bleiben: Der Stapel ist
    // pro Gigabyte SCHLECHTER als die ideale Mischung - in ihm wartet jeder
    // Faden bis zu einer weaken-Zeit auf seinen Landeplatz, statt nur seine
    // eigene Aktionsdauer zu belegen. Gerechnet fuer omega-net: 4*tHack*(1.7
    // + gph*1.75 + wph*1.75) statt tHack*(1.7 + 3.2*gph*1.75 + 4*wph*1.75),
    // also gut das Doppelte an GB-Sekunden fuer dieselbe Beute. Sein Vorteil
    // liegt woanders und ist groesser: er ist GESCHLOSSEN. Die offene
    // Steuerung erreicht ihr Modell nachweislich nicht (gemessen 110 gegen
    // 208 $/GB*s) und kann pro Ziel nur KAP_ABZUG aufnehmen, weil ungetaktete
    // Wellen den Server sonst leerraeumen. Der Stapel nimmt statt 1.779 GB
    // (omega-net, KAP_ABZUG 0.2) rund 8.100 GB auf und liefert dabei
    // rechnerisch 237 $/GB*s - also mehr als das Doppelte des gemessenen
    // Ist-Werts, auf ein Mehrfaches des Speichers.
    //
    // Deshalb: die besten Ziele in den Stapelbetrieb, der Rest bleibt bei der
    // offenen Steuerung, die den uebrigen Speicher weiter aufnimmt.
    // Der Vorgabewert steht im CODE, nicht in der Datei. Die Datei ist nur der
    // Uebersteuerungsschalter fuer Messungen ("0" schaltet ganz ab). Stuende
    // die Vorgabe in der Datei, waere der groesste Hebel dieses Bots von einer
    // Textdatei abhaengig, die niemand vermisst - genau das Muster, an dem
    // dieser Bot schon mehrfach stundenlang stillstand. Drei Ziele sind
    // gemessen: 1 Ziel gab $9.12m/s, 3 Ziele $18.06m/s.
    const batchRoh = ns.read("data/batch-ziele.txt").trim();
    const BATCH_ZIELE = batchRoh === "" ? 3 : (Number(batchRoh) || 0);
    // --- Die Sicherung fuer die Zeit direkt nach einem Einbau -------------
    //
    // WAS HIER FRUEHER STAND UND WARUM ES NICHTS TAT (22.08.2026). Hier stand
    // BATCH_MIN_NETZ_GB = 3000 mit der Begruendung, nach einem
    // Augmentierungs-Einbau falle das Netz "auf wenige hundert GB". Das ist
    // falsch: home-RAM ueberlebt den Einbau (src/install.js:8-9), im
    // laufenden Stand sind das 4096 GB. ramTotal zaehlt home mit, liegt also
    // NIE unter 4096 - die Schwelle konnte gar nicht ausloesen. Eine
    // Sicherung, die auf einer nicht erreichbaren Groesse steht, ist keine.
    //
    // WAS NACH EINEM EINBAU WIRKLICH KNAPP IST, IST NICHT DER SPEICHER,
    // SONDERN DIE ZAHL DER ZIELE. Das Hacking-Level faellt auf 1, und alle
    // Portprogramme sind weg ausser NUKE.exe - erreichbar sind dann nur die
    // Server ohne Portanforderung und unter dem eigenen Level. Aus dem
    // Spielstand gezaehlt (22.08.2026):
    //     Level 1   -> 2 Geldziele    Level 30  -> 6
    //     Level 10  -> 4 Geldziele    ab hier deckelt die Portgrenze bei 7
    // Ein Stapelziel wird der offenen Steuerung ENTZOGEN und verdient
    // waehrend seiner Vorbereitung nichts. Mit BATCH_ZIELE = 3 und zwei
    // erreichbaren Zielen - eines davon meist das Erfahrungsziel - bliebe
    // moneyTargets LEER, und dann faellt Durchgang 2 komplett aus
    // ("if (!sameTarget && moneyTargets.length)"): Der Bot verdiente gar
    // nichts, bis die Vorbereitung durch ist.
    //
    // Deshalb die Sicherung auf der Groesse, die wirklich knapp ist: Es
    // muessen immer Ziele fuer die offene Steuerung uebrig bleiben. Zwei,
    // nicht eines - ein einzelnes Ziel taeuscht sonst nur Betrieb vor,
    // waehrend ein Anlauf oder eine Sperre es sofort wieder leert.
    // Ab Level 50 ist die Sicherung von selbst inaktiv (8 Ziele, davon 3 im
    // Stapel, 5 offen), sie bremst also nur den Wiederanlauf.
    const BATCH_MIN_OFFENE_ZIELE = 2;
    // Das Erfahrungsziel bleibt aussen vor: Es hat sein eigenes Fadenbudget
    // und bekommt zusaetzlich den Ueberschuss - beides wuerde ungetaktet
    // zwischen den Stapeln landen. Der Fall tritt nur ueber den Notnagel
    // "moneyTargets = [expTarget]" weiter oben ueberhaupt ein.
    const batchKandidaten = moneyTargets.filter((h) => h !== expTarget);
    const batchPlaetze = Math.max(0,
      Math.min(BATCH_ZIELE, batchKandidaten.length - BATCH_MIN_OFFENE_ZIELE));
    const batchTargets = BATCH_ZIELE > 0 ? batchKandidaten.slice(0, batchPlaetze) : [];
    if (batchTargets.length) {
      moneyTargets = moneyTargets.filter((h) => !batchTargets.includes(h));
    }
    // Zustaende von Zielen aufraeumen, die nicht mehr Stapelziel sind - sonst
    // kaeme ein Ziel nach Stunden mit einem uralten Kalender zurueck und
    // wuerde Stapel in die Vergangenheit legen.
    for (const h of [...batchStand.keys()]) {
      if (!batchTargets.includes(h)) { batchStand.delete(h); batchKalender.delete(h); }
    }

    let fehlstart = 0;
    let mixStat = null;
    let batchStat = null;
    // Zugeteilte share-Faeden dieser Runde, nur zur Beobachtung.
    let shareStand = 0;
    // Grenzertragskurve dieser Runde. Wird JEDE Runde neu aufgebaut, auch
    // wenn ein Zweig gar nicht laeuft - sonst rechnete die Serveraufruestung
    // mit den Abnehmern eines Zustands, den es nicht mehr gibt (Stapelbetrieb
    // abgeschaltet, Ziel gesperrt, Netz geschrumpft).
    const grenzStapel = [];
    const grenzOffen = [];
    // Speicher, den die Geldziele in dieser Runde nicht aufnehmen konnten und
    // der deshalb an die Erfahrung ging. Gehoert nach draussen: Er ist das
    // Mass dafuer, ob sich weiterer Serverausbau ueberhaupt noch lohnt.
    let ueberschussGb = 0;
    if (expTarget || moneyTargets.length || batchTargets.length) {
      // Aktionswahl fuer das ERFAHRUNGSziel: hier bleibt es beim Dreifach-
      // Ternaer. Erfahrung haengt allein am Server und an der Fadenzahl -
      // calculateHackingExpGain (Hacking.ts:29-38) unterscheidet die drei
      // Aktionen ueberhaupt nicht. Es gibt dort also nichts zu mischen; der
      // Ternaer haelt den Server nebenbei entschaerft, damit die Aktionsdauer
      // nicht davonlaeuft.
      const pickScript = (host) => {
        const s = ns.getServer(host);
        return s.hackDifficulty > s.minDifficulty + 5 ? "worker/weaken.js"
          : s.moneyAvailable < s.moneyMax * 0.9 ? "worker/grow.js"
            : "worker/hack.js";
      };
      const expScript = expTarget ? pickScript(expTarget) : null;
      const expRam = expScript ? ns.getScriptRam(expScript, "home") : 0;

      // STUFE 1 (22.08.2026): Landezeit und Aktionsdauer statt 0, 0, 0 an die
      // Arbeiter uebergeben, genau wie autopilot.js es tut (autopilot.js:1346-
      // 1355). Ohne echte Werte bleiben args[2]/args[3] leer und die
      // Terminlogik in worker/hack.js:38-42 (identisch in grow.js/weaken.js)
      // greift nie. Kostet 0,05 GB je Funktion (reference/bitburner-src/src/
      // Netscript/RamCostGenerator.ts:48,649-651), zusammen 0,15 GB fuer alle
      // drei - das ist die gesamte Mehrkosten dieses Umbaus.
      const actionTime = (host, script) => {
        if (script === "worker/hack.js") return ns.getHackTime(host);
        if (script === "worker/grow.js") return ns.getGrowTime(host);
        return ns.getWeakenTime(host);
      };

      // getScriptRam gibt bei fehlender Datei still 0 zurueck
      // (NetscriptFunctions.ts:1179-1191). Ungeprueft ergaebe das
      // Math.floor(frei/0) = Infinity, und das Spiel wirft daraufhin eine
      // Ausnahme - die diese Schleife und damit den halben Bot beenden wuerde.
      // weiter unten), also werden auch alle drei geprueft. Die Werte selbst
      // stehen oben bei den Kennzahlen je Ziel, die sie ebenfalls brauchen.
      if ((expScript && !(expRam > 0))
          || !(ramHack > 0) || !(ramGrow > 0) || !(ramWeaken > 0)) {
        sag("worker-Skript nicht lesbar, Runde uebersprungen.");
        await ns.sleep(10000); continue;
      }

      // Reputationsmodus: laeuft Faktions- oder Firmenarbeit, lohnt es sich,
      // einen Teil der Arbeiter statt zu hacken teilen zu lassen. ns.share()
      // wirkt einzig ueber calculateCurrentShareBonus() in
      // getHackingWorkRepGain()/getFactionFieldWorkRepGain()
      // (PersonObjects/formulas/reputation.ts:16-23) - ohne eine solche
      // Arbeit gerade laeuft, gibt es nichts, worauf der Bonus wirken
      // koennte, und die Faeden waeren verschenkte Hacking-Erfahrung. Genau
      // deshalb komplett aus, sobald keine Faktionsarbeit laeuft, statt einen
      // festen Anteil zu reservieren.
      // bn4rep.js schreibt data/rep-modus.txt bei jedem Arbeitsschritt neu
      // (bn4rep.js:168, Rundentakt 15 Sekunden) und loescht sie, sobald keine
      // offene Augmentierung mehr wartet (bn4rep.js:83-84). 120 Sekunden
      // Toleranz ueberstehen mehrere Runden, ohne dass ein abgestuerztes
      // bn4rep.js unbemerkt Faeden auf share bindet.
      let repModus = false;
      if (ns.fileExists("data/rep-modus.txt", "home")) {
        const stempel = Number(ns.read("data/rep-modus.txt").split("|")[1]);
        repModus = Number.isFinite(stempel) && Date.now() - stempel < 120000;
      }
      const shareBraucht = repModus ? ns.getScriptRam("worker/share.js", "home") : 0;
      // Netzweite Obergrenze. Jenseits davon kostet ein share-Faden mehr
      // Hacking-Erfahrung, als sein Reputationsbeitrag wert ist.
      // Gemessen, nicht geschaetzt: Mit 600 Faeden fiel die Hacking-Rate von
      // 1,07 auf 0,91 je Minute und die Reputationsrate von 100 auf 85. Der
      // Grund ist die Groessenordnung - worker/share.js kostet 4 GB je Faden,
      // 600 Faeden sind 2400 GB und damit mehr, als das ganze Netz hat. Share
      // hatte die hack-Faeden schlicht verdraengt.
      //
      // Der Bonus ist logarithmisch (1 + ln(n)/25): 100 Faeden bringen +18,4 %,
      // 600 nur +25,6 %. Die 500 Faeden dazwischen kosten 2000 GB fuer sieben
      // Prozentpunkte. Bei 100 Faeden sind es 400 GB - ein Fuenftel des Netzes
      // fuer knapp ein Fuenftel mehr Reputation, also etwa ein Nullsummen-
      // geschaeft, das nur wegen der sofortigen Wirkung ueberhaupt lohnt.
      //
      // NEU AM 22.08.2026 - DIE ALTE MESSUNG GALT FUER EIN 50-MAL KLEINERES
      // NETZ. Der Absatz darueber begruendet die 100 damit, dass 600 Faeden
      // (2400 GB) "mehr sind, als das ganze Netz hat". Das Netz hat inzwischen
      // rund 130.000 GB; 600 Faeden sind davon 1,8 %. Die Verdraengung, die
      // damals gemessen wurde, gibt es in dieser Groessenordnung nicht mehr.
      //
      // Und der Engpass hat sich gedreht: Gemessen am laufenden Spiel liegen
      // ueber 70 Milliarden ungenutzt herum, waehrend acht Augmentierungen auf
      // Reputation warten. Geld hat gerade wenig Grenznutzen, Reputation ist
      // der Fortschritt. RAM von Geld auf Reputation umzuschichten ist damit
      // ein guter Handel - genau der umgekehrte Befund von damals.
      //
      // Die Rechnung (calculateShareBonus, NetworkShare/Share.ts:43-49:
      // 1 + ln(n)/25, wobei n die EFFEKTIVEN Faeden sind, also inklusive
      // Intelligenz- und Kernbonus):
      //     n=100 -> 1,184    n=2000 -> 1,304
      //     n=600 -> 1,256    n=3900 -> 1,331
      // Von 100 auf rund 3900 Faeden sind das +12,4 % Reputationsrate fuer
      // 15.600 GB.
      //
      // ANTEIL STATT FESTER ZAHL, gleiches Muster wie EXP_THREAD_BUDGET
      // gleich darunter und aus demselben Grund: Direkt nach einem
      // Augmentierungs-Einbau sind alle gekauften Rechner weg
      // (Prestige.ts:73), und ein fester Deckel von ein paar tausend Faeden
      // frisst dann das ganze Netz - dieselbe Falle, in die das
      // Erfahrungsbudget schon einmal gelaufen ist.
      //
      // Die absolute Obergrenze bleibt trotzdem noetig, weil der Bonus
      // logarithmisch ist: Von 4.000 auf 10.000 Faeden sind es noch +3,7 %
      // fuer weitere 24.000 GB. Jenseits davon ist der Speicher im Geldziel
      // mehr wert, auch bei niedrigem Grenznutzen des Geldes.
      // DECKEL GELOEST (23.08.2026). Der Absatz darueber begruendet die 4.000
      // damit, dass "jenseits davon der Speicher im Geldziel mehr wert" sei.
      // Diese Begruendung traegt nicht mehr, aus zwei unabhaengigen Gruenden:
      //
      // 1. Der Speicher hat im Geldziel gar keinen Abnehmer. Gemessen am
      //    23.08.: kapGesamtGb 8.951 - so viel nehmen ALLE offenen Ziele
      //    zusammen auf - bei einem Netz von 1.072.988 GB. 71,7 Prozent
      //    liegen brach. Wer share deckelt, verschenkt nichts an das
      //    Geldziel, sondern an niemanden.
      // 2. Geld ist nicht der Engpass des Knotens. Reputation ist es, und der
      //    share-Bonus wirkt auf die aktive UND die passive Reputation
      //    zugleich (reputation.ts:16-24, FactionHelpers.tsx:132-170).
      //
      // Gerechnet: 4.000 Faeden geben 1,3318, die vom SHARE_ANTEIL erlaubten
      // 32.189 geben 1,4152 - also +6,3 Prozent auf jede Reputationsquelle,
      // ohne ein Byte mehr als ohnehin vorgesehen.
      //
      // Der Deckel bleibt als Sicherheitsnetz stehen, nur weit oben: Der
      // Bonus ist logarithmisch, jenseits von etwa 200.000 Faeden bringt
      // eine Verdopplung noch 2,8 Prozent. Die eigentliche Bremse ist und
      // bleibt SHARE_ANTEIL.
      const SHARE_ANTEIL = 0.12;
      const SHARE_MAX = 200000;
      const SHARE_DECKEL = shareBraucht > 0
        ? Math.max(1, Math.min(SHARE_MAX, Math.floor((ramTotal * SHARE_ANTEIL) / shareBraucht)))
        : 0;
      let shareGesamt = 0;

      // Erfahrungsbudget netzweit, gleiches Muster wie SHARE_DECKEL/shareGesamt
      // oben: ein Deckel, ein mitlaufender Zaehler ueber die Host-Schleife.
      // Anders als worker/share.js sind die Hack-Arbeiter Einwegskripte (siehe
      // Kopfkommentar worker/hack.js: "hackt einmal und beendet sich") - es
      // gibt also keine dauerhaft laufenden Faeden, die per ns.ps() gegenzu-
      // rechnen waeren. Der Zaehler summiert deshalb die in dieser Runde neu
      // zugeteilten Faeden. 180 genuegen laut Messung fuer die volle
      // Erfahrungsrate (joesguns: 0,262 Erfahrung je Faden und Sekunde), jeder
      // Faden darueber ist im Geldziel mehr wert.
      //
      // ABER: 180 Faeden sind 315 GB, und das ist nur dann ein kleiner Posten,
      // wenn das Netz gross ist. Direkt nach einem Augmentierungs-Einbau sind
      // alle gekauften Rechner weg (Prestige.ts:73), home faellt auf seine
      // Reserve zurueck, und vom Netz bleiben wenige hundert GB - das
      // Erfahrungsbudget allein frass dann ALLES, und fuer die Geldziele blieb
      // nichts. Belegt im Verlauf: nach dem Einbau um 21:55 stieg das
      // Hacking-Level ueber vierzig Minuten von 36 auf 186, das Geld aber nur
      // von 12,5 auf 13,9 Millionen - also praktisch kein Einkommen, genau in
      // der Phase, in der es fuer den Wiederaufbau am noetigsten waere.
      //
      // Deshalb zusaetzlich am Netz gedeckelt: hoechstens ein Fuenftel des
      // gerooteten Speichers geht an die Erfahrung. Ein Fuenftel, weil die
      // Erfahrung in diesem BitNode zwar der eigentliche Zweck der Arbeiter
      // ist (HackExpGain 0.4, Level 9000 fuer w0r1d_d43m0n), das Einkommen
      // aber die Rechner bezahlt, auf denen die Erfahrung entsteht. Bei
      // 7276 GB Netz greift der Deckel nicht (1455 GB Spielraum gegen 315 GB
      // Bedarf); er greift genau dann, wenn das Netz klein ist.
      const EXP_THREAD_BUDGET = Math.max(1, Math.min(180,
        Math.floor((ramTotal * 0.2) / Math.max(expRam, 1))));
      // Laufende Faeden mitzaehlen, nicht nur neu vergebene. hack, grow und
      // weaken dauern deutlich laenger als eine Runde von zehn Sekunden - bei
      // niedrigem Level sind es Minuten. Ein Zaehler, der jede Runde bei null
      // beginnt, legt also Welle um Welle nach, bis Tausende Faeden auf dem
      // Erfahrungsziel liegen und dem Geldziel den Speicher wegfressen.
      // Genau dieser Fehler ist bei worker/share.js schon einmal passiert;
      // dort loest ihn ns.ps, und hier tut es dasselbe. Das erste Argument der
      // Arbeiter ist ihr Ziel, daran sind sie zu erkennen.
      //
      // Derselbe Durchgang zaehlt zusaetzlich, was je GELDZIEL und Aktion
      // gerade unterwegs ist (flight). Das braucht die Anlaufphase weiter
      // unten: Ohne diese Gegenrechnung legt jede Runde eine weitere volle
      // Korrekturwelle obendrauf, obwohl die erste noch fliegt - genau der
      // Fehler, der beim Erfahrungsziel schon einmal Tausende Faeden
      // gestapelt hat. ns.isRunning mit Argumenten findet diese Prozesse
      // uebrigens NICHT, deshalb ns.ps.
      let expThreadsAssigned = 0;
      // Nur zur Beobachtung: der Speicher, der gerade auf dem Erfahrungsziel
      // liegt, JE SKRIPT gezaehlt. Faeden mal expRam waere falsch - expRam ist
      // der Bedarf der Aktion, die das Erfahrungsziel in DIESER Runde
      // bekaeme, waehrend dort Wellen aus frueheren Runden mit anderen
      // Aktionen liegen. Ueber Faeden mal expRam kam die Bezugsgroesse auf
      // 106.766 GB, obwohl das Netz nur 85.618 GB Arbeiterspeicher hatte.
      const ramJeSkript = {
        "worker/hack.js": ramHack, "worker/grow.js": ramGrow,
        "worker/weaken.js": ramWeaken,
      };
      let expRamAssigned = 0;
      const flight = new Map();
      for (const h of moneyTargets) flight.set(h, { hack: 0, grow: 0, weaken: 0 });
      // Stapelziele gehoeren mit in die Zaehlung. Die Vorbereitungsphase
      // rechnet gegen, was schon fliegt (sonst legt sie jede Runde eine
      // weitere volle Korrekturwelle obendrauf), und das Auslaufen erkennt
      // ueber dieselbe Zahl, wann der letzte Stapel gelandet ist.
      for (const h of batchTargets) flight.set(h, { hack: 0, grow: 0, weaken: 0 });
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        for (const pr of ns.ps(host)) {
          if (!WORKER.includes(pr.filename)) continue;
          if (pr.args[0] === expTarget) {
            expThreadsAssigned += pr.threads;
            expRamAssigned += pr.threads * (ramJeSkript[pr.filename] || 0);
            continue;
          }
          const f = flight.get(pr.args[0]);
          if (!f) continue;
          if (pr.filename === "worker/hack.js") f.hack += pr.threads;
          else if (pr.filename === "worker/grow.js") f.grow += pr.threads;
          else if (pr.filename === "worker/weaken.js") f.weaken += pr.threads;
        }
      }

      // --- Aktionsmischung je Geldziel (Stufe 3, 22.08.2026) ----------------
      // Bis hierher machten ALLE Faeden eines Ziels DIESELBE Aktion (der
      // Dreifach-Ternaer von pickScript). Gemessen ueber die Arbeiter-RAM-
      // Sekunden ergab das rund 7-20 % hack, 47-57 % grow, 33-39 % weaken:
      // Nach jeder Hackwelle faellt das Ziel unter die 90-Prozent-Schwelle
      // und wird minutenlang nur noch gewachsen, waehrend gar nichts
      // verdient wird. Und jede Welle schiesst weit ueber ihr Ziel hinaus -
      // 2000 weaken-Faeden nehmen 100 Sicherheit weg, wo 5 zuviel sind.
      //
      // Jetzt bekommt jedes Ziel gleichzeitig hack-, grow- und weaken-Faeden
      // im Gleichgewichtsverhaeltnis. Herleitung, alle Fundstellen in
      // reference/bitburner-src/src:
      //
      //   GELD  Ein hack-Faden zieht den Anteil p ab - aber nur bei Erfolg.
      //         Der Fehlschlagzweig (NetscriptHelpers.tsx:678-690) zieht kein
      //         Geld ab UND erhoeht die Sicherheit nicht; beides steht im
      //         Erfolgszweig (:629-643 bzw. :667). Also zaehlt p * chance.
      //         Ein grow-Faden multipliziert das Guthaben mit e^k
      //         (Server/formulas/grow.ts:8-29).
      //         Gleichgewicht:  k * grow = p * chance * hack
      //
      //   SICHERHEIT  hack +0.002 je Faden (Server/data/Constants.ts:9,
      //         angewandt NetscriptHelpers.tsx:667), grow +2*0.002 = 0.004
      //         (Server/ServerHelpers.ts:213), weaken -0.05 (Constants.ts:10).
      //         Gleichgewicht:  0.05 * weaken = 0.002*chance*hack + 0.004*grow
      //
      //   DAUER  grow = 3.2 * hack, weaken = 4 * hack (Hacking.ts:81-95).
      //         Geht hier nicht in die Rechnung ein, weil das Verhaeltnis in
      //         FADENSTARTS je Sekunde gilt - die Belegungsdauer kuerzt sich
      //         heraus. Aus dem Fadenverhaeltnis wird der RAM-Sekunden-Anteil
      //         erst durch Multiplikation mit RAM * Dauer.
      //
      // ENTSCHEIDEND FUER BITNODE 4: ScriptHackMoney 0.2 steckt bereits IN p
      // (Hacking.ts:54 multipliziert es in calculatePercentMoneyHacked hinein).
      // ScriptHackMoneyGain ist in diesem BitNode NICHT gesetzt
      // (BitNode.tsx:628-655) und bleibt damit 1 (BitNodeMultipliers.ts:153).
      // moneyGained = moneyDrained * 1 (NetscriptHelpers.tsx:648) - der Server
      // verliert also GENAU das, was der Spieler bekommt. Der Wachstumsbedarf
      // ist folglich nicht um den Faktor 5 hoeher, sondern genau umgekehrt:
      // weil p durch die 0.2 gefuenftelt wurde und ServerGrowthRate in diesem
      // BitNode bei 1.0 bleibt, braucht ein hack-Faden hier nur rund 0,42
      // grow-Faden statt gut 2 wie in BitNode 1. Gerechnet fuer phantasy
      // (Level 339): p = 6.4e-4, chance = 0.94, k = 1.42e-3
      //   -> hack : grow : weaken = 1 : 0.42 : 0.072  (Faeden)
      //   -> 37 % : 52 % : 11 %                       (RAM-Sekunden)
      // FORTIFY_HACK, FORTIFY_GROW, WEAKEN_POWER und MIX_MONEY_HIGH stehen
      // oben bei den Kennzahlen je Ziel - dieselben Konstanten, eine Quelle.
      // Zielband. MIX_MONEY_HIGH ist der Fixpunkt der Regelung, nicht die
      // Obergrenze: darueber waere jeder grow-Faden verschenkt, weil
      // calculateGrowMoney (grow.ts:44-52) bei moneyMax abschneidet. Etwas
      // Luft nach oben zu lassen kostet 5 % Beute je Faden und spart mehr
      // als das an weggeworfenen grow-Faeden.
      const MIX_MONEY_LOW = 0.75;   // darunter: Anlaufphase
      const MIX_SEC_OK = 1.0;       // bis hierher gilt die Sicherheit als am Minimum
      const MIX_SEC_BAD = 5.0;      // darueber: Anlaufphase
      const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

      // p, chance und k kommen aus dem Spiel selbst statt aus nachgebauten
      // Formeln. Das kostet 3 GB (hackAnalyze, hackAnalyzeChance,
      // growthAnalyze je 1 GB, RamCostGenerator.ts:569-579) und ist dafuer
      // gegen jeden Abschreibfehler immun und gegen jede Balance-Aenderung
      // des Spiels.
      //
      // ns.growthAnalyze gilt in diesem Projekt als unbrauchbar - zu Recht,
      // aber nur fuer die Frage "wieviele Faeden von HIER bis moneyMax".
      // numCycleForGrowth (Server/ServerHelpers.ts:69-80) laesst den additiven
      // +1-je-Faden-Term weg und liefert bei moneyAvailable 0 eine Division
      // durch null. Hier wird es anders benutzt: growthAnalyze(host, 2) ist
      // schlicht ln(2)/k und haengt weder am Guthaben noch am additiven Term.
      // k faellt daraus exakt heraus. Der dritte Parameter (cores) bleibt 1.
      //
      // Das war frueher damit begruendet, dass die Arbeiter fast alle auf
      // Fremdrechnern mit einem Kern laufen. Diese Begruendung ist seit dem
      // home-Ausbau falsch: home traegt 98 Prozent des Netzes. Die 1 bleibt
      // trotzdem, jetzt aber aus einem anderen Grund - sie ist die SICHERE
      // Annahme. Wer mit acht Kernen plant und einen Faden auf einem
      // Mietrechner landen laesst, weakent zu wenig; die Sicherheit steigt
      // und der Ertrag faellt. Umgekehrt kostet die Untertreibung nichts, was
      // knapp waere: 71,7 Prozent des Netzes liegen ohnehin brach, Faeden sind
      // nicht der Engpass. Der Kernbonus kommt als ungeplanter Ueberschuss
      // an - sauberere Server, vollere Guthaben - statt als eingesparte
      // Faeden. Erst wenn das Netz wirklich ausgelastet ist, lohnt es, die
      // Kerne je Ausfuehrungsort einzurechnen (Befund N8).
      const planMix = (host) => {
        const s = ns.getServer(host);
        const secOver = Math.max(0, s.hackDifficulty - s.minDifficulty);
        const moneyFrac = s.moneyMax > 0 ? clamp01(s.moneyAvailable / s.moneyMax) : 0;
        // Dieselbe Rechnung wie bei der Zielauswahl - eine Quelle, kein
        // zweiter Satz Formeln, der auseinanderlaufen kann. p, chance und k
        // sind die IST-Werte (fuer die Mischung), steadyEff und kapazitaet
        // sind auf minDifficulty hochgerechnet (fuer Gate und Deckel).
        const kz = kennzahlen(host, s);
        const p = kz.p, chance = kz.chance, k = kz.k;
        const f = flight.get(host) || { hack: 0, grow: 0, weaken: 0 };

        // ANLAUFPHASE, ausdruecklich und als eigener Zweig. Aus einem
        // beliebigen Ausgangszustand (Sicherheit hoch, Guthaben leer) fuehrt
        // die Gleichgewichtsmischung allein nicht heraus - sie HAELT einen
        // Zustand, sie stellt ihn nicht her. Hier stehen deshalb keine
        // Verhaeltnisse, sondern der noch OFFENE BEDARF: soviele Faeden
        // fehlen bis zum Gleichgewicht, abzueglich dessen, was schon fliegt.
        // Der Verteiler unten arbeitet diesen Bedarf der Reihe nach ab -
        // erst weaken, dann grow, kein hack.
        //
        // Warum weaken VORRANG hat und nicht parallel laeuft: k haengt ueber
        // log1p(0.03/hackDifficulty) (grow.ts:17) am Kehrwert der Sicherheit.
        // Fuer the-hub (minDifficulty 14, aktuell 41) heisst das k = 4.6e-4
        // statt 1.35e-3 - Wachstum ist bei hoher Sicherheit fast dreimal so
        // teuer. Nachgerechnet fuer diesen Server, von 27 % auf 95 %:
        //   sofort wachsen  2737 grow + 758 weaken = 3495 Faeden
        //   erst saeubern    540 weaken + 935 grow + 75 weaken = 1550 Faeden
        // Die zusaetzliche Wartezeit einer weaken-Runde ist billig, weil der
        // Speicher in der Zwischenzeit den anderen Zielen zufaellt.
        const anlauf = secOver > MIX_SEC_BAD || moneyFrac < MIX_MONEY_LOW || !(p > 0);
        if (anlauf) {
          const growNeed = k > 0
            ? Math.max(0, Math.log(MIX_MONEY_HIGH / Math.max(moneyFrac, 1e-9)) / k)
            : 0;
          // Nur die Sicherheit gegenrechnen, die WIRKLICH da ist, plus die,
          // welche der schon fliegende grow noch erzeugen wird. Die Sicherheit
          // eines erst geplanten grow gehoert nicht dazu - sonst schwaecht
          // diese Runde auf Vorrat, und der Deckel waere wieder wirkungslos.
          const weakenNeed = (secOver + FORTIFY_GROW * f.grow) / WEAKEN_POWER;
          // SEQUENZIELL, nicht gleichzeitig (Korrektur 22.08.2026). Der
          // Kommentar oben rechnet seit jeher vor, warum erst gesaeubert und
          // dann gewachsen wird - der Code hat weaken und grow aber in
          // DERSELBEN Runde aus demselben Anteil vergeben. Damit lief grow
          // genau in dem Zustand, den die Rechnung als dreimal zu teuer
          // ausweist: the-hub wuchs bei Sicherheit 41 mit k = 4.6e-4 statt
          // bei 14 mit 1.35e-3. Gemessen lagen dort 369 GB grow, von denen
          // rund zwei Drittel verschenkt waren.
          //
          // Solange also nennenswert Sicherheit ueber dem Minimum liegt, gibt
          // es NUR weaken. Das kostet eine weaken-Runde Wartezeit; die ist
          // billig, weil der nicht abgerufene Anteil unten an die anderen
          // Ziele weiterkaskadiert, statt liegenzubleiben.
          const nurSaeubern = secOver > MIX_SEC_OK;
          return {
            anlauf: true,
            steadyEff: kz.steadyEff, kapazitaet: kz.kapazitaet,
            bedarf: {
              hack: 0,
              grow: nurSaeubern ? 0 : Math.max(0, growNeed - f.grow),
              weaken: Math.max(0, weakenNeed - f.weaken),
            },
          };
        }

        // DAUERBETRIEB. Gleichgewichtsverhaeltnis plus proportionale
        // Rueckkopplung. Die Rueckkopplung ist der Grund, warum hier keine
        // harte Schwelle mehr steht: Ein Ternaer hat denselben Mittelwert,
        // aber er pendelt - erst nur hacken, bis das Guthaben faellt, dann
        // nur wachsen, bis es voll ist. Genau dieses Pendeln hat den
        // hack-Anteil auf unter 20 % gedrueckt. Die lineare Drosselung hat
        // ihren Fixpunkt bei MIX_MONEY_HIGH und regelt in beide Richtungen:
        // zuviel Geld -> voller hack-Anteil, zuwenig -> hack faellt, grow
        // steigt.
        const growPerHack = k > 0 ? (p * chance) / k : 0;
        const weakenPerHack = (FORTIFY_HACK * chance + FORTIFY_GROW * growPerHack) / WEAKEN_POWER;
        // Die Verstaerkung der Korrektur wird an der Groesse einer
        // Mischeinheit gemessen statt an einer geratenen Zahl - so bleibt sie
        // richtig, wenn sich p, k oder chance mit dem Level aendern.
        const einheit = 1 + growPerHack + weakenPerHack;
        const moneyErr = clamp01((MIX_MONEY_HIGH - moneyFrac) / (MIX_MONEY_HIGH - MIX_MONEY_LOW));
        const secErr = clamp01((secOver - MIX_SEC_OK) / (MIX_SEC_BAD - MIX_SEC_OK));
        return {
          anlauf: false,
          steadyEff: kz.steadyEff, kapazitaet: kz.kapazitaet,
          ratio: {
            hack: (1 - moneyErr) * (1 - secErr),
            grow: growPerHack + moneyErr * einheit,
            weaken: weakenPerHack + secErr * einheit,
          },
        };
      };

      // Durchgang 1: share und Erfahrungsziel je Rechner, wie bisher. Was
      // danach frei bleibt, wird nur GEMERKT statt sofort vergeben - die
      // Geldziele brauchen im Durchgang 2 den Gesamtbetrag, um ihre
      // Fadenzahlen ueberhaupt ausrechnen zu koennen.
      const restFrei = new Map();
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        // Die Werkbank ist nicht mehr pauschal ausgenommen, sondern nur noch
        // um ihren gemessenen Werkzeugbedarf gekuerzt (siehe 1c).
        const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
          - (host === "home" ? reserveHome() : 0)
          - (host === werkbank ? werkbankReserve : 0);
        if (host !== "home") ns.scp(WORKER, host, "home");

        // Home bleibt verschont, genau wie die Werkbank oben: Es ist die
        // Steuerung selbst und die Reserve dort ist schon knapp genug
        // bemessen (siehe reserveHome oben). Auf jedem anderen Rechner geht
        // ungefaehr die Haelfte der freien RAM an share, der Rest wie bisher
        // an den Ziel-Arbeiter.
        let freiFuerSkript = frei;
        // Gedeckelt, nicht anteilig - und aufgeraeumt. Der Bonus ist
        // 1 + ln(threads)/25 (NetworkShare/Share.ts:43), also logarithmisch:
        // 400 Faeden bringen +24 %, 800 nur +26,7 %. Die zweiten 400 Faeden
        // waeren als hack-Faeden das Doppelte an Hacking-Erfahrung wert, und
        // die ist in diesem BitNode der einzige Zweck der Arbeiter. Ein halbes
        // Netz an share zu haengen waere teuer bezahlte Bequemlichkeit.
        //
        // Zwei Fallen, die ohne ns.ps zuschlagen: worker/share.js laeuft
        // endlos, ein neues exec je Runde stapelt also alle zehn Sekunden
        // Faeden obendrauf - und wenn die Faktionsarbeit endet, laufen die
        // alten fuer immer weiter und blockieren Speicher ohne jeden Nutzen.
        const shareLaeuft = ns.ps(host)
          .filter((pr) => pr.filename === "worker/share.js")
          .reduce((n, pr) => n + pr.threads, 0);

        // ZWEI FEHLER BIS 22.08.2026, beide im Deckel:
        //
        // (1) shareGesamt zaehlte nur die schon LAUFENDEN Faeden, nicht die
        //     in derselben Runde neu gestarteten. In der ersten Runde des
        //     repModus stand der Zaehler deshalb auf jedem Rechner bei null,
        //     und jeder durfte den vollen Deckel ausschoepfen - der netzweite
        //     Deckel wirkte faktisch pro Rechner.
        // (2) Ein einmal entstandener Ueberhang wurde nie wieder abgebaut.
        //     worker/share.js laeuft endlos und wurde nur beendet, wenn der
        //     repModus ganz endete. Ohne (2) haette (1) allein nichts
        //     geholfen: Die zuviel gestarteten Faeden waeren stehengeblieben.
        //
        // Gemessene Folge: 250 Faeden statt 100, also 1000 statt 400 GB - ein
        // Fuenftel des Netzes.
        //
        // Der Handel dahinter, weil er nicht offensichtlich ist: Der Bonus
        // ist 1 + ln(n)/25 (NetworkShare/Share.ts:44). 100 Faeden geben
        // +18.4 %, 250 geben +22.1 %. Die 150 Faeden dazwischen kosten 600 GB
        // - bei gemessenen 320 $/GB*s rund 192 k$/s - und bringen 3.1
        // Prozentpunkte Reputation. Das ist der schlechteste Teil einer
        // ohnehin logarithmischen Kurve.
        // Die Frage nach der richtigen Zahl ist am 22.08.2026 beantwortet
        // worden: Der Deckel ist jetzt ein Anteil des Netzes, siehe
        // SHARE_ANTEIL oben. Der Mechanismus hier - Ueberhang raeumen, dann
        // gedeckelt neu aufbauen - bleibt unveraendert richtig und traegt den
        // groesseren Deckel unverandert.
        let shareHier = shareLaeuft;
        if (!repModus) {
          if (shareLaeuft) ns.scriptKill("worker/share.js", host);
          shareHier = 0;
        } else if (shareBraucht > 0) {
          // home ist hier NICHT mehr ausgenommen (23.08.2026). Der Ausschluss
          // machte den ganzen SHARE_ANTEIL zur Luege: Der Deckel wird aus
          // ramTotal gerechnet - und home stellt 97,7 Prozent davon -,
          // verteilt werden durfte aber nur auf den Rest. Von den
          // beabsichtigten 32.189 Faeden waren dadurch rund 6.000 erreichbar,
          // also 19 Prozent der Wirkung; gemessen wurde genau das.
          //
          // Der Platz auf home ist geschuetzt, ohne dass es diesen Ausschluss
          // braucht: `frei` zieht reserveHome() bereits ab, und `passt` nimmt
          // ohnehin nur die Haelfte des Verbleibenden.
          const nochOffen = Math.max(0, SHARE_DECKEL - shareGesamt);
          if (shareHier > nochOffen) {
            // Ueberhang. Ganz raeumen und im naechsten Durchgang gedeckelt
            // neu aufbauen, statt einzelne Prozesse zu suchen: share-Faeden
            // sind gleichwertig und ihr Nutzen faengt beim Neustart ohne
            // Verlust wieder an - anders als bei hack, grow und weaken, wo
            // ein Abbruch die ganze Laufzeit wegwirft.
            ns.scriptKill("worker/share.js", host);
            shareHier = 0;
          } else if (shareHier < nochOffen) {
            const passt = Math.floor((frei * 0.5) / shareBraucht);
            const shareFaeden = Math.min(nochOffen - shareHier, passt);
            if (shareFaeden >= 1) {
              if (ns.exec("worker/share.js", host, shareFaeden) === 0) fehlstart++;
              freiFuerSkript = frei - shareFaeden * shareBraucht;
              shareHier += shareFaeden;
            }
          }
        }
        shareGesamt += shareHier;

        // Die Argumente muessen zum Protokoll der Arbeiter passen: args[1] ist
        // dort die Verzoegerung in Millisekunden (worker/hack.js:38-40) und
        // bleibt 0 - seit Stufe 1 tragen stattdessen args[2]/args[3] die
        // echte Landezeit und Aktionsdauer (siehe actionTime oben). Die
        // Rundennummer gehoert ans Ende (args[4]) - stuende sie an Position 1,
        // waere jede Aktion um sie verzoegert gestartet, nach einem Tag um
        // 8,6 Sekunden, nach drei Monaten um dreizehn Minuten. Dort dient sie
        // nur noch dazu, den Aufruf von seinem Vorgaenger zu unterscheiden.
        if (sameTarget) {
          // Beide Ziele sind derselbe Server - ein Aufruf genuegt, alle
          // freien Faeden gehen an ihn.
          const faeden = Math.floor(freiFuerSkript / expRam);
          if (faeden < 1) continue;
          const dauer = actionTime(expTarget, expScript);
          const landAt = Date.now() + dauer;
          if (ns.exec(expScript, host, faeden, expTarget, 0, Math.round(landAt), Math.round(dauer), runde) === 0) {
            fehlstart++;
          }
          continue;
        }

        // Erfahrungsziel zuerst bis zum Netzbudget, der Rest auf die
        // Geldziele verteilt.
        if (expScript) {
          const nochOffenExp = Math.max(0, EXP_THREAD_BUDGET - expThreadsAssigned);
          if (nochOffenExp > 0) {
            const passtExp = Math.floor(freiFuerSkript / expRam);
            const expFaeden = Math.min(nochOffenExp, passtExp);
            if (expFaeden >= 1) {
              const dauer = actionTime(expTarget, expScript);
              const landAt = Date.now() + dauer;
              if (ns.exec(expScript, host, expFaeden, expTarget, 0, Math.round(landAt), Math.round(dauer), runde) === 0) {
                fehlstart++;
              }
              freiFuerSkript -= expFaeden * expRam;
              expThreadsAssigned += expFaeden;
            }
          }
        }

        if (freiFuerSkript > 0) restFrei.set(host, freiFuerSkript);
      }
      shareStand = shareGesamt;

      // --- Durchgang 1b: Stapelbetrieb HWGW (Stufe 4, 22.08.2026) ----------
      //
      // Der strukturelle Unterschied zu allem darueber: Hier wird nicht mehr
      // "der gerade freie Speicher" verteilt, sondern ein VOLLSTAENDIGER
      // Stapel reserviert und nur gestartet, wenn er ganz passt. Vier
      // Auftraege, feste Reihenfolge, feste Landeabstaende:
      //
      //   hack     nimmt den Anteil f vom vollen Guthaben
      //   weaken   hebt die Sicherheit des hack wieder auf
      //   grow     holt das Guthaben zurueck auf das Maximum
      //   weaken   hebt die Sicherheit des grow wieder auf
      //
      // Das Verfahren beruht auf einer Asymmetrie im Spielcode: Die DAUER
      // einer Aktion wird einmalig beim Aufruf festgelegt (NetscriptHelpers
      // .tsx:598, netscriptDelay :469-482 ist ein einziges setTimeout, keine
      // Neubewertung), die WIRKUNG dagegen erst beim Landen aus dem dann
      // aktuellen Serverzustand (:616-629 fuer hack, ServerHelpers.ts:204-224
      // fuer grow). Wer die Landezeitpunkte in der Hand hat, kann jeden hack
      // auf ein Ziel treffen lassen, das genau auf Hoechstguthaben und
      // Mindestsicherheit steht - dort ist Beuteanteil und Erfolgschance am
      // groessten und die Laufzeit am kuerzesten.
      //
      // DAS UEBERHOL-PROBLEM bei steigendem Level: Bei jedem Levelaufstieg
      // wird hackTime um 1/(Level+50) kuerzer, bei Level 501 also um 0,2 % je
      // Punkt - auf eine weaken-Zeit von 134 s sind das 270 ms je Level, und
      // das Level steigt hier mehrmals je Minute. Wer Stapel mit RELATIVEN
      // Fristen plant ("dieser Stapel startet 1,6 s nach dem letzten"), laesst
      // den neuen den alten einholen. Deshalb ist der Kalender (batchKalender)
      // eine absolute Wanduhrzeit: Ein neuer Stapel bekommt seine Landung
      // frueheste GAP_MS nach der letzten schon vergebenen Landung, und der
      // Kalender wird nur nach vorn gesetzt. Wird ein Stapel durch ein
      // hoeheres Level kuerzer, startet er einfach spaeter - seine Landung
      // bleibt, wo sie im Kalender steht. Ueberholen ist damit nicht moeglich,
      // ohne dass irgendwo eine Fallunterscheidung noetig waere.
      // Die zweite Haelfte derselben Sache steckt in den Arbeitern: Sie messen
      // ihre Dauer seit dem 22.08.2026 SELBST, unmittelbar vor dem Aufruf
      // (worker/hack.js). Sonst ginge jede Sicherheitsaenderung zwischen
      // Planung und Start ungefiltert in die Landezeit ein - fuer omega-net
      // waeren das 4,5 s bei 400 ms Landeabstand.
      if (batchTargets.length) {
        // Abstand zwischen zwei Landungen desselben Stapels und zwischen den
        // Stapeln. Der einzige wirklich heikle Wert: zu klein, und eine
        // verrutschte Landung dreht die Reihenfolge um - dann faellt das
        // Guthaben nicht sanft, sondern binnen Minuten auf null. Zu gross, und
        // der Kalender wird zum Engpass, weil jeder Stapel 4*gap Kalenderzeit
        // belegt und in eine weaken-Zeit nur tWeaken/(4*gap) Stapel passen.
        // 400 ms stammen aus der Simulation des BitNode-1-Autopiloten (dort
        // 300 ms Streuung unbeschadet ueberstanden) und sind hier zum ersten
        // Mal am laufenden Spiel. Der Wert bestimmt NICHT den Ertrag je
        // Gigabyte - nur, wieviel Speicher ein Ziel aufnehmen kann.
        const GAP_MS = 400;
        // Vorlauf, damit der zuletzt landende Ausgleich beim Start nicht schon
        // ueberfaellig ist. Grosszuegig, weil zwischen dem exec und dem
        // ersten Befehl des Arbeiters der REST DIESER RUNDE liegt - bei 95
        // Rechnern sind das Sekunden, nicht Millisekunden.
        const SLACK_MS = 5000;
        // Wie weit vor seinem Starttermin ein Stapel losgeschickt werden darf.
        // Muss ueber der Rundenlaenge von 10 s liegen, sonst faellt in jeder
        // Runde ein Teil des Kalenders ersatzlos aus. Der Preis ist, dass die
        // Faeden bis zu 14 s laenger Speicher binden als noetig - das steckt
        // in additionalMsec und kostet nur Speicher, keine Genauigkeit.
        const LEAD_MS = 14000;
        // Aufschlag auf die Ausgleichsauftraege. Ueberzaehlige weaken-Faeden
        // sind wirkungslos (die Sicherheit ist nach unten auf minDifficulty
        // gedeckelt, Server.ts:91-104), zu wenige dagegen lassen nach jedem
        // Stapel einen Rest stehen, der sich ueber hunderte Stapel aufschaukelt.
        const WEAKEN_MARGIN = 1.5;
        // Aufschlag auf das Nachwachsen. Er faengt genau den Fehler ab, den
        // ein steigendes Level erzeugt: Die Fadenzahl eines Stapels wird beim
        // Einplanen gerechnet, gelandet wird bis zu einer weaken-Zeit spaeter
        // - und bis dahin ist p (Beute je Faden) mit dem Level gewachsen. Der
        // hack nimmt dann etwas mehr, als sein grow zurueckholen sollte, und
        // ueber hunderte Stapel sackt das Guthaben ab. Zuviel grow ist
        // dagegen gratis: calculateGrowMoney schneidet bei moneyMax ab, und
        // die verpuffenden Faeden erhoehen nicht einmal die Sicherheit
        // (ServerHelpers.ts:210-213 deckelt usedCycles auf die genutzten).
        // Derselbe Aufschlag deckt den Aufteilungsverlust, wenn die
        // hack-Faeden auf mehrere Rechner mussten.
        const GROW_MARGIN = 1.15;
        const MAX_STAPEL_PRO_RUNDE = 80;
        // Drifterkennung. In einem gesunden Stapelbetrieb faellt die
        // Sicherheit nach jedem Stapel exakt auf das Minimum zurueck und das
        // Guthaben auf hoechstens (1-f) unter das Maximum. Beobachtet wird
        // deshalb nicht der Mittelwert, sondern das MINIMUM ueber ein Fenster:
        // Wenn selbst der beste Moment der letzten zwei Minuten daneben liegt,
        // stimmt die Kette nicht mehr - und dann muss der Betrieb ANHALTEN,
        // nicht stillschweigend weiterrechnen.
        const DRIFT_PROBEN = 12;
        const DRIFT_SEC = 1.0;
        // Anteil des noch freien Speichers, den ein Stapelziel je Runde
        // hoechstens an sich ziehen darf. Ohne die Bremse fuellt ein einzelnes
        // Ziel beim kalten Start seinen ganzen Kalender auf einen Schlag und
        // laesst der offenen Steuerung eine Runde lang gar nichts.
        const BATCH_ANTEIL = 0.6;
        // Erntanteile, aufsteigend. Kleines f ist speichereffizienter (hack
        // nimmt linear weg, grow muss multiplikativ zurueckholen), grosses f
        // laesst ein Ziel mehr Speicher aufnehmen. Gerechnet fuer omega-net:
        // f=0.02 gibt 237 $/GB*s bei 8.100 GB Aufnahme, f=0.5 nur noch
        // 192 $/GB*s, dafuer 200.000 GB. Gesucht wird das KLEINSTE f, dessen
        // voller Kalender ungefaehr den Anteil des Netzes fasst, der diesem
        // Ziel zusteht.
        const F_LEITER = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5];
        const F_NETZANTEIL = 0.15;

        const freiGesamt = () => {
          let s = 0;
          for (const gb of restFrei.values()) s += gb;
          return s;
        };
        const batchInfo = [];

        for (const ziel of batchTargets) {
         // Je Ziel abgesichert. Wirft die Kennzahlenrechnung fuer EINEN
         // Server, soll nicht die ganze Runde ausfallen - dann stuende auch
         // die offene Steuerung fuer alle uebrigen Ziele still.
         try {
          const s = ns.getServer(ziel);
          let st = batchStand.get(ziel);
          if (!st) {
            st = { phase: "prep", proben: [], fraction: F_LEITER[0], stapel: 0 };
            batchStand.set(ziel, st);
          }
          const fl = flight.get(ziel) || { hack: 0, grow: 0, weaken: 0 };
          const laeuft = fl.hack + fl.grow + fl.weaken;
          const secOver = Math.max(0, s.hackDifficulty - s.minDifficulty);
          const moneyFrac = s.moneyMax > 0 ? s.moneyAvailable / s.moneyMax : 0;
          let neueStapel = 0, secBoden = null, geldBoden = null;

          // --- Drifterkennung, bevor irgendetwas Neues gestartet wird ------
          //
          // ACHTUNG BEIM LESEN VON geldBoden: Diese Runde taktet mit 10 s, ein
          // Stapel mit 4*gap = 1,6 s. Die Probe ist also mit dem Vorgang
          // verschraenkt (Aliasing) und trifft haeufig genau das Fenster, in
          // dem das Guthaben wieder voll ist - gemessen am 22.08.2026 stand
          // geldBoden fuer phantasy auf 1,00, waehrend eine Messung im
          // 0,7-s-Takt sauber zwischen 85,00 % und 100,00 % pendeln sah.
          // geldBoden ist deshalb KEINE Anzeige des echten Guthabenbodens.
          // Als BREMSE taugt es trotzdem, und nur darum geht es hier: eine
          // wirklich gerissene Kette laesst das Guthaben dauerhaft unten, dann
          // ist auch die beste Probe schlecht. Der Sicherheitsboden ist der
          // verlaesslichere der beiden Zeugen - in einer gesunden Kette steht
          // die Sicherheit die meiste Zeit exakt auf minDifficulty.
          if (st.phase === "batch") {
            st.proben.push({ sec: secOver, geld: moneyFrac });
            if (st.proben.length > DRIFT_PROBEN) st.proben.shift();
            if (st.proben.length >= DRIFT_PROBEN) {
              secBoden = Infinity; geldBoden = Infinity;
              for (const pr of st.proben) {
                if (pr.sec < secBoden) secBoden = pr.sec;
                if (pr.geld < geldBoden) geldBoden = pr.geld;
              }
              // Untergrenze fuers Guthaben: im gesunden Betrieb faellt es nie
              // unter (1-f), denn genau so viel nimmt ein Stapel weg. Der
              // Faktor 0.5 laesst Platz dafuer, dass sich zwei Stapel einmal
              // ueberholen, ohne dass gleich alles angehalten wird.
              const grenze = Math.max(0.05, (1 - st.fraction) * 0.5);
              if (secBoden > DRIFT_SEC || geldBoden < grenze) {
                st.phase = "drain";
                st.proben = [];
                sag(ziel + ": Stapel laufen aus der Reihe (Sicherheitsboden +"
                  + secBoden.toFixed(2) + ", Guthabenboden "
                  + Math.round(geldBoden * 100) + " %, Grenze "
                  + Math.round(grenze * 100) + " %) - Kette wird angehalten.");
              }
            }
          }
          // Auslaufen: keine neuen Stapel, bis der letzte gelandet ist. Erst
          // dann darf neu vorbereitet werden - wer schon waehrend des
          // Auslaufens wieder Faeden schickt, kommt nie aus dem Zustand heraus.
          if (st.phase === "drain" && laeuft === 0) {
            st.phase = "prep";
            batchKalender.delete(ziel);
            st.stapel = 0;
          }

          // --- Vorbereiten -------------------------------------------------
          // Erst die Sicherheit auf das Minimum, DANN das Guthaben auf 100 %.
          // Die Reihenfolge ist nicht Geschmack: k haengt ueber log1p(0.03/hd)
          // am Kehrwert der Sicherheit (grow.ts:17), Wachstum bei hoher
          // Sicherheit ist also ein Vielfaches teurer.
          // Diese Auftraege bekommen ausdruecklich KEINE Landezeit (0, 0) -
          // sie sollen so schnell wie moeglich wirken, nicht getaktet.
          if (st.phase === "prep") {
            let budget = freiGesamt() * BATCH_ANTEIL;
            const weakenNoetig = Math.ceil(
              (secOver + FORTIFY_GROW * fl.grow) / WEAKEN_POWER) - fl.weaken;
            if (weakenNoetig > 0) {
              const n = Math.min(weakenNoetig, Math.floor(budget / ramWeaken));
              if (n >= 1) {
                const ops = [{ script: "worker/weaken.js", threads: n, cost: ramWeaken }];
                const b = platziere(restFrei, ops);
                if (b) {
                  for (const stueck of b.belegung) {
                    if (ns.exec("worker/weaken.js", stueck.host, stueck.threads,
                      ziel, 0, 0, 0, "p" + runde) === 0) fehlstart++;
                  }
                  for (const [h, gb] of b.frei) restFrei.set(h, gb);
                }
              }
            } else if (moneyFrac < 0.9999) {
              const kz0 = kennzahlen(ziel, s);
              const growNoetig = growFaeden(kz0.kMin, s.moneyMax,
                s.moneyAvailable, s.moneyMax) - fl.grow;
              const n = Math.min(Math.ceil(growNoetig), Math.floor(budget / ramGrow));
              if (n >= 1) {
                const ops = [{ script: "worker/grow.js", threads: n, cost: ramGrow }];
                const b = platziere(restFrei, ops);
                if (b) {
                  for (const stueck of b.belegung) {
                    if (ns.exec("worker/grow.js", stueck.host, stueck.threads,
                      ziel, 0, 0, 0, "p" + runde) === 0) fehlstart++;
                  }
                  for (const [h, gb] of b.frei) restFrei.set(h, gb);
                }
              }
            } else if (laeuft === 0) {
              // Fertig - und zwar wirklich: kein Faden mehr unterwegs, der
              // die Sicherheit noch heben oder das Guthaben noch bewegen
              // koennte. Ein landender grow waehrend der ersten Stapel wuerde
              // deren Laufzeiten verschieben.
              st.phase = "batch";
              st.proben = [];
              st.stapel = 0;
              batchKalender.set(ziel, 0);
              sag(ziel + " ist vorbereitet - Stapelbetrieb beginnt.");
            }
          }

          // --- Stapel takten -----------------------------------------------
          if (st.phase === "batch") {
            const kz = kennzahlen(ziel, s);
            // Fadenzahlen im VORBEREITETEN Zustand rechnen (Sicherheit am
            // Minimum), nicht im gerade abgelesenen. Genau dort landen die
            // Auftraege, dort wirken sie - und nur so bekommt jeder Stapel
            // dieselben Zahlen, statt dass sich die Kette selbst verschiebt.
            const pMin = kz.pMin, chanceMin = kz.chanceMin, kMin = kz.kMin;
            // Die LAUFZEIT dagegen bei der jetzigen Sicherheit - das Spiel
            // bestimmt sie beim Aufruf. Sie geht nur in den fruehesten
            // moeglichen Landetermin ein; die Feinkorrektur macht der Arbeiter
            // selbst.
            const tHack = ns.getHackTime(ziel);
            const tWeaken = tHack * 4;
            if (pMin > 0 && kMin > 0 && tHack > 0 && s.moneyMax > 0) {
              const kalenderPlaetze = Math.max(1, Math.floor(tWeaken / (4 * GAP_MS)));
              // f waehlen: das kleinste, dessen voller Kalender den Anteil des
              // Netzes fasst, der diesem Ziel zusteht.
              const wunschGb = ramTotal * F_NETZANTEIL;
              let fraction = F_LEITER[F_LEITER.length - 1];
              const stapelPlan = (f) => {
                const hackT = Math.max(1, Math.floor(f / pMin));
                // Ein Block mit n Faeden nimmt p*n vom AKTUELLEN Guthaben -
                // linear, nicht multiplikativ (NetscriptHelpers.tsx:629).
                const echt = Math.min(0.99, pMin * hackT);
                const growT = Math.max(1, Math.ceil(
                  growFaeden(kMin, s.moneyMax, s.moneyMax * (1 - echt), s.moneyMax)
                  * GROW_MARGIN));
                const w1 = Math.max(1, Math.ceil(hackT * FORTIFY_HACK * WEAKEN_MARGIN / WEAKEN_POWER));
                const w2 = Math.max(1, Math.ceil(growT * FORTIFY_GROW * WEAKEN_MARGIN / WEAKEN_POWER));
                return {
                  hackT, growT, w1, w2, echt,
                  ram: hackT * ramHack + growT * ramGrow + (w1 + w2) * ramWeaken,
                  geld: echt * s.moneyMax * chanceMin,
                };
              };
              let fIndex = F_LEITER.length - 1;
              for (let i = 0; i < F_LEITER.length; i++) {
                const pl = stapelPlan(F_LEITER[i]);
                fIndex = i;
                if (pl.ram * kalenderPlaetze >= wunschGb) break;
              }
              fraction = F_LEITER[fIndex];
              st.fraction = fraction;
              const plan = stapelPlan(fraction);

              // --- Beitrag dieses Ziels zur Grenzertragskurve (22.08.2026) --
              // Ein Stapelziel nimmt keinen festen Betrag auf, sondern einen
              // ANTEIL des Netzes: wunschGb waechst mit ramTotal, also rutscht
              // f eine Sprosse hoeher, sobald genug Speicher da ist. Der
              // Ertrag DIESER Sprosse ist der Grenzertrag - zusaetzliches Geld
              // geteilt durch zusaetzlichen Speicher, nicht der Durchschnitt.
              // Gemessen am 22.08.2026 liegen beide dicht beieinander
              // (omega-net 249 Schnitt gegen 242 Grenz), das ist kein
              // Rechenfehler: Die Guete ist ueber f fast flach, weil hack und
              // grow beide ungefaehr linear mitwachsen.
              //
              // Oben auf der Leiter (f = 0.5) waechst die Aufnahme nicht mehr
              // mit. Dann - und nur dann - ist ein Stapelziel wirklich
              // gesaettigt, und mehr Speicher bringt dort NICHTS mehr; "frei"
              // ist dann die restliche Aufnahme statt Infinity.
              const uNun = plan.ram * kalenderPlaetze;
              const rNun = plan.geld / (4 * GAP_MS / 1000);
              const naechst = fIndex + 1 < F_LEITER.length ? stapelPlan(F_LEITER[fIndex + 1]) : null;
              const uNext = naechst ? naechst.ram * kalenderPlaetze : 0;
              if (naechst && uNext > uNun) {
                const rNext = naechst.geld / (4 * GAP_MS / 1000);
                grenzStapel.push({ eff: (rNext - rNun) / (uNext - uNun), frei: Infinity });
              } else if (uNun > 0) {
                grenzStapel.push({
                  eff: rNun / uNun,
                  frei: Math.max(0, uNun - (fl.hack * ramHack + fl.grow * ramGrow + fl.weaken * ramWeaken)),
                });
              }

              let kalender = batchKalender.get(ziel) || 0;
              let budget = freiGesamt() * BATCH_ANTEIL;
              while (neueStapel < MAX_STAPEL_PRO_RUNDE && budget >= plan.ram) {
                const jetzt = Date.now();
                // Der zuletzt landende Ausgleich hat die laengste Laufzeit.
                // Frueher als (jetzt + tWeaken) kann er nicht landen, also darf
                // der hack - der 3*gap vor ihm liegt - nicht frueher stehen.
                const frueheste = jetzt + tWeaken - 3 * GAP_MS + SLACK_MS;
                const landHack = Math.max(kalender + GAP_MS, frueheste);
                // Gehoert dieser Stapel schon in diese Runde? Massgeblich ist,
                // ob sein zuletzt landender Ausgleich jetzt startbar waere.
                if (landHack + 3 * GAP_MS - tWeaken > jetzt + LEAD_MS) break;

                const ops = [
                  { art: "hack", script: "worker/hack.js", threads: plan.hackT, cost: ramHack, landAt: landHack, dauer: tHack },
                  { art: "weaken1", script: "worker/weaken.js", threads: plan.w1, cost: ramWeaken, landAt: landHack + GAP_MS, dauer: tWeaken },
                  { art: "grow", script: "worker/grow.js", threads: plan.growT, cost: ramGrow, landAt: landHack + 2 * GAP_MS, dauer: tHack * 3.2 },
                  { art: "weaken2", script: "worker/weaken.js", threads: plan.w2, cost: ramWeaken, landAt: landHack + 3 * GAP_MS, dauer: tWeaken },
                ];
                const b = platziere(restFrei, ops);
                if (!b) break;

                // Festschreiben - und die Ernte ZULETZT. Sollte ein exec
                // scheitern, fehlt dann hoechstens die Beute. Waere sie zuerst
                // gestartet, koennte ihr das Nachwachsen fehlen, und genau
                // daraus wird ein Ziel, das langsam ausblutet.
                let abbruch = false;
                for (const op of [ops[1], ops[2], ops[3], ops[0]]) {
                  for (const stueck of b.belegung) {
                    if (stueck.op !== op) continue;
                    const pid = ns.exec(op.script, stueck.host, stueck.threads,
                      ziel, 0, Math.round(op.landAt), Math.round(op.dauer),
                      "b" + runde + "-" + neueStapel);
                    if (!pid) { abbruch = true; fehlstart++; break; }
                  }
                  if (abbruch) break;
                }
                for (const [h, gb] of b.frei) restFrei.set(h, gb);
                budget -= plan.ram;
                kalender = landHack + 3 * GAP_MS;
                neueStapel++;
                st.stapel++;
                if (abbruch) break;
              }
              batchKalender.set(ziel, kalender);

              // STILLSTANDSWACHE. Ein Ziel im Stapelbetrieb, das keinen
              // einzigen Stapel mehr unterbringt und auch nichts mehr fliegen
              // hat, verdient nichts und blockiert zugleich seinen Platz - die
              // offene Steuerung fasst es ja nicht mehr an. Das kann jederzeit
              // eintreten, wenn das Netz schrumpft: ein Augmentierungs-Einbau
              // loescht alle gekauften Rechner (Prestige.ts:73). Fuer den
              // grossen Fall greift BATCH_MIN_OFFENE_ZIELE (dann wird das Ziel
              // gar nicht erst zum Stapelziel), fuer den schleichenden diese
              // Wache.
              //
              // Behandelt wird er ueber die schon vorhandene Sperrliste: Das
              // Ziel faellt fuer eine Weile aus den Kandidaten, damit wird der
              // naechstbeste Server zum Stapelziel, und nach Ablauf wird es
              // mit dem dann gueltigen Netz neu versucht.
              st.leer = neueStapel > 0 ? 0 : (st.leer || 0) + 1;
              if (st.leer >= 30 && laeuft === 0) {
                gesperrtBis.set(ziel, Date.now() + 10 * 60000);
                batchStand.delete(ziel);
                batchKalender.delete(ziel);
                sag(ziel + ": Stapelbetrieb steht seit fuenf Minuten still (kein"
                  + " Stapel passt, nichts unterwegs) - 10 min gesperrt, das"
                  + " naechstbeste Ziel rueckt nach.");
              }
              batchInfo.push({
                ziel, phase: st.phase, fraction, neueStapel,
                gesamt: st.stapel,
                stapelGb: Math.round(plan.ram),
                kalenderPlaetze,
                belegtGb: Math.round(fl.hack * ramHack + fl.grow * ramGrow + fl.weaken * ramWeaken),
                erwartetProS: Math.round(plan.geld / (4 * GAP_MS / 1000)),
                secBoden: secBoden === null ? null : Number(secBoden.toFixed(2)),
                geldBoden: geldBoden === null ? null : Number(geldBoden.toFixed(3)),
              });
            }
          }

          if (st.phase !== "batch") {
            batchInfo.push({
              ziel, phase: st.phase, fraction: st.fraction, neueStapel: 0,
              gesamt: st.stapel,
              moneyFrac: Number(moneyFrac.toFixed(3)),
              secOver: Number(secOver.toFixed(2)),
              laeuft,
            });
          }
         } catch (e) {
          if (runde % 10 === 0) sag("Stapelbetrieb " + ziel + " warf: " + String(e));
         }
        }
        batchStat = { gap: GAP_MS, ziele: batchInfo };
        grenzAnteilMerker = F_NETZANTEIL;
      }

      // --- Durchgang 2: Geldziele mit gemischten Aktionen -------------------
      // Frueher lief die Verteilung IM Host-Durchgang: jeder Rechner teilte
      // seinen Rest zu gleichen Teilen auf die Ziele auf. Mit drei Aktionen je
      // Ziel waeren daraus bei 43 nennenswerten Rechnern und 10 Zielen bis zu
      // 1290 exec-Aufrufe je Runde geworden, und auf einem 64-GB-Rechner
      // haette ein Zieldrittel nicht einmal fuer einen weaken-Faden gereicht.
      // Deshalb umgedreht: erst netzweit ausrechnen, WIEVIELE Faeden welcher
      // Art gebraucht werden, dann diese Wuensche auf die groessten Rechner
      // packen. Das sind rund 30 Wuensche und damit hoechstens etwa 70
      // exec-Aufrufe - weniger als vorher, bei feinerer Aufteilung.
      if (!sameTarget && moneyTargets.length) {
        let budget = 0;
        for (const gb of restFrei.values()) budget += gb;
        // Melden, wenn fuer die Geldziele nichts uebrigbleibt. Das passiert
        // nicht theoretisch: Direkt nach einem Augmentierungs-Einbau sind alle
        // gekauften Rechner weg (Prestige.ts:73) und das Netz faellt auf
        // wenige hundert GB - das Erfahrungsbudget allein belegt dann schon
        // 180 * 1.75 = 315 GB, und Durchgang 2 bekommt gar nichts mehr. Ohne
        // diese Zeile sieht das von aussen aus wie normaler Betrieb.
        if (budget < 2 && runde % 10 === 0) {
          sag("Geldziele bekommen nichts: nach share und Erfahrungsziel sind "
            + budget.toFixed(1) + " GB frei.");
        }

        const wuensche = [];
        const summeFaeden = { hack: 0, grow: 0, weaken: 0 };
        let anlaufZiele = 0;

        // --- Anlaufphase eindaemmen (22.08.2026) ---------------------------
        // Gemessener Anlass: the-hub lag ueber Stunden bei Sicherheit 41
        // (Minimum 14) und 27 % Guthaben und band dabei 1376 von 4608 GB
        // Arbeiterspeicher - 30 % des Netzes fuer null Ertrag. Der Grund ist
        // nicht ein einzelner Rechenfehler, sondern dass die Anlaufphase gar
        // keine Grenze kannte: kein Nutzen-Gate, keine Obergrenze, keine
        // Frist. Ein Ziel, das aus eigener Kraft nicht herausfindet, konnte
        // beliebig lange beliebig viel binden.
        //
        // Drei Bremsen, absichtlich getrennt, weil sie verschiedene Fehler
        // abfangen:
        //   Gate   - Ziele, die den Anlauf sachlich nicht wert sind.
        //   Deckel - Ziele, die ihn wert waeren, aber nicht auf einmal.
        //   Frist  - Ziele, bei denen die Rechnung stimmt und es trotzdem
        //            nicht vorangeht (Ursache unbekannt und egal).
        const ANLAUF_ANTEIL_ZIEL = 0.15;    // je Ziel und Runde
        const ANLAUF_ANTEIL_GESAMT = 0.30;  // alle Anlaufziele zusammen
        const ANLAUF_FRIST_MS = 20 * 60000;
        const ANLAUF_SPERRE_MS = 30 * 60000;

        // Erst planen, dann verteilen. Der Grund fuer die getrennten
        // Durchgaenge ist das Nutzen-Gate: Es vergleicht ein Anlaufziel mit
        // dem Durchschnitt der Ziele, die schon im Dauerbetrieb laufen - und
        // den kennt man erst, wenn alle Plaene vorliegen.
        const plaene = [];
        for (const ziel of moneyTargets) {
          try {
            plaene.push({ ziel, plan: planMix(ziel) });
          } catch (e) {
            // Nicht stillschweigend ueberspringen. Wirft hackAnalyze oder
            // growthAnalyze fuer ein Ziel dauerhaft, faellt dieses Ziel sonst
            // fuer immer aus, ohne dass irgendwo etwas davon steht - genau
            // das Muster, das diesen Bot schon mehrfach stundenlang hat
            // stillstehen lassen. Gedrosselt, damit das Log lesbar bleibt.
            if (runde % 10 === 0) sag("planMix(" + ziel + ") warf: " + String(e));
          }
        }

        // Vergleichsmassstab: der mittlere Gleichgewichtsertrag der Ziele, die
        // gerade LAUFEN. Ist keines im Dauerbetrieb - direkt nach einem
        // Einbau, oder wenn wirklich alles schmutzig ist -, bleibt das Gate
        // aus. Sonst blockierte es sich selbst: Kein Ziel duerfte anlaufen,
        // weil keines laeuft, und keines liefe, weil keines anlaufen darf.
        const laufende = plaene.filter((e) => !e.plan.anlauf && e.plan.steadyEff > 0);
        const massstab = laufende.length
          ? laufende.reduce((n, e) => n + e.plan.steadyEff, 0) / laufende.length : 0;

        // --- Modellobergrenze, NUR ZUR BEOBACHTUNG (22.08.2026) ------------
        // Die einzige ehrliche Bezugsgroesse fuer einen Umbau an der
        // Zuteilung. "Besser als vorher" sagt nichts, solange Level und
        // gekaufter Speicher gleichzeitig wachsen; "so viel Prozent des mit
        // diesem Netz Moeglichen" schon. Diese Rechnung greift NICHT in die
        // Zuteilung ein - sie zaehlt nur mit.
        //
        //   kapGesamt  Summe der Aufnahme aller Geldziele. Beantwortet die
        //              Frage, an der die Ueberschuss-Praemisse haengt: Hat
        //              das Netz die Ziele wirklich ueberholt (dann waere
        //              kapGesamt kleiner als das Netz), oder findet die
        //              Zuteilung die Aufnahme nur nicht? Gemessen am
        //              22.08.2026: 137.860 GB Aufnahme gegen 77.803 GB
        //              Arbeiterspeicher - die Praemisse war falsch.
        //   deckeNetz  Was herauskaeme, wenn dieser Speicher gierig auf die
        //              besten Ziele verteilt waere. Bezugsgroesse fuer den
        //              Prozentsatz.
        let deckeGesamt = 0, kapGesamt = 0, kapFrei = 0, moneyStandGb = 0;
        for (const e of plaene) {
          const kap = e.plan.kapazitaet || 0;
          kapGesamt += kap;
          deckeGesamt += (e.plan.steadyEff || 0) * kap;
          const f0 = flight.get(e.ziel) || { hack: 0, grow: 0, weaken: 0 };
          const b0 = f0.hack * ramHack + f0.grow * ramGrow + f0.weaken * ramWeaken;
          moneyStandGb += b0;
          kapFrei += Math.max(0, kap - b0);
          // Beitrag zur Grenzertragskurve. Nur Ziele im DAUERBETRIEB: Ein
          // Anlaufziel nimmt Speicher erst auf, nachdem es gesaeubert wurde,
          // und ob es ueberhaupt anlaufen darf, entscheidet das Nutzen-Gate
          // weiter unten. Wer solche Aufnahme in eine Amortisationsrechnung
          // schreibt, bezahlt Speicher fuer Abnehmer, die es noch gar nicht
          // gibt - genau der Fehler, den kapFrei oben schon einmal gemacht
          // hat (137.860 GB gemeldete Aufnahme, 3.400 GB tatsaechlich
          // zugeteilt).
          if (!e.plan.anlauf && e.plan.steadyEff > 0 && kap - b0 > 0) {
            grenzOffen.push({ eff: e.plan.steadyEff, frei: kap - b0 });
          }
        }
        // Der in DIESER Runde freie Speicher taugt nicht als Bezugsgroesse -
        // er ist selbst das Ergebnis der Zuteilung: Was einmal ans
        // Erfahrungsziel ging, liegt dort eine weaken-Dauer fest und taucht
        // als "frei" nie wieder auf. Gezaehlt wird deshalb, was im
        // Dauerbetrieb auf Geldzielen liegen KOENNTE.
        const budgetStart = budget;
        const verfuegbarGb = budgetStart + moneyStandGb
          + Math.max(0, expRamAssigned - EXP_THREAD_BUDGET * expRam);
        let deckeNetz = 0, restNetz = verfuegbarGb;
        for (const e of plaene) {
          const nimm = Math.min(e.plan.kapazitaet || 0, restNetz);
          deckeNetz += (e.plan.steadyEff || 0) * nimm;
          restNetz -= nimm;
        }

        const anlaufDeckelZiel = budget * ANLAUF_ANTEIL_ZIEL;
        let anlaufDeckelRest = budget * ANLAUF_ANTEIL_GESAMT;
        let restZiele = plaene.length;
        for (const eintrag of plaene) {
          const ziel = eintrag.ziel;
          const plan = eintrag.plan;
          if (restZiele <= 0) break;
          restZiele--;

          // WASSERFALL STATT GLEICHVERTEILUNG (22.08.2026). Bisher bekam jedes
          // Ziel budget/restZiele, also gleich viel, und was ein Ziel liegen
          // liess, kaskadierte nach unten. Das war richtig, solange alle Ziele
          // ungefaehr gleich gut waren und keines gesaettigt werden konnte.
          // Beides gilt nicht: Die Spanne betraegt 3:1, und jedes Ziel hat
          // eine berechenbare Kapazitaet (siehe kennzahlen oben).
          //
          // Jetzt nimmt sich jedes Ziel der Reihe nach - und die Reihe ist
          // nach steadyEff sortiert, also das beste zuerst - hoechstens so
          // viel, wie es noch aufnehmen kann. Der Rest faellt an das naechste.
          // Das ist die richtige Zuteilung fuer ungleiche Ziele mit endlicher
          // Aufnahme: Die besten werden voll, die schlechten bekommen nur, was
          // uebrig bleibt, und ist gar nichts uebrig, bekommen sie nichts.
          //
          // Was schon fliegt, wird gegengerechnet. Sonst legte jede Runde eine
          // volle Kapazitaet obendrauf, obwohl die vorige noch unterwegs ist -
          // derselbe Stapelfehler, der beim Erfahrungsziel und bei share schon
          // zweimal zugeschlagen hat.
          const fl = flight.get(ziel) || { hack: 0, grow: 0, weaken: 0 };
          const belegt = fl.hack * ramHack + fl.grow * ramGrow + fl.weaken * ramWeaken;
          let anteil = Math.min(budget, Math.max(0, (plan.kapazitaet || 0) - belegt));

          if (plan.anlauf) {
            // Die Anlaufphase kennt keine Kapazitaetsgrenze: Ihr Bedarf ist
            // endlich und in planMix ausgerechnet, und sie hackt nicht, kann
            // den Server also gar nicht leerraeumen. Sie bekommt deshalb den
            // vollen Rest angeboten - gebremst wird sie von ihren eigenen
            // Deckeln weiter unten.
            anteil = budget;
            // GATE. Ein Anlauf kostet Speicher, der sonst SOFORT Geld
            // brachte. Er lohnt nur, wenn das Ziel hinterher mindestens so
            // gut zahlt wie das, was man dafuer stehenlaesst. steadyEff ist
            // dafuer schon auf minDifficulty hochgerechnet, das Ziel wird
            // also nach seinem Zustand NACH dem Saeubern beurteilt, nicht
            // nach dem davor. null heisst "nicht bestimmbar" und laesst
            // durch (Begruendung bei steadyEff).
            if (plan.steadyEff != null && massstab > 0 && plan.steadyEff < massstab) {
              if (runde % 30 === 0) {
                sag("Anlauf fuer " + ziel + " uebersprungen: " + Math.round(plan.steadyEff)
                  + " $/GB*s im Gleichgewicht, Flotte laeuft mit " + Math.round(massstab) + ".");
              }
              anlaufSeit.delete(ziel);
              continue;
            }
            // FRIST. Auch ein rentables Ziel darf nicht ewig anlaufen. Kommt
            // es binnen ANLAUF_FRIST_MS nicht in den Dauerbetrieb, wird es
            // fuer ANLAUF_SPERRE_MS beiseitegelegt. Die Sperre ist kein
            // Urteil ueber den Server, sondern ueber die Lage: Sie laeuft ab,
            // und dann wird es mit dem dann gueltigen Netz neu versucht.
            const seit = anlaufSeit.get(ziel);
            if (seit == null) {
              anlaufSeit.set(ziel, Date.now());
            } else if (Date.now() - seit > ANLAUF_FRIST_MS) {
              gesperrtBis.set(ziel, Date.now() + ANLAUF_SPERRE_MS);
              anlaufSeit.delete(ziel);
              sag(ziel + ": Anlauf nach " + Math.round((Date.now() - seit) / 60000)
                + " min ohne Erfolg abgebrochen, " + Math.round(ANLAUF_SPERRE_MS / 60000)
                + " min gesperrt.");
              continue;
            }
            // DECKEL. Auch mit Gate und Frist darf ein einzelnes Anlaufziel
            // nicht das halbe Netz binden, und alle zusammen erst recht
            // nicht. Was hier gekuerzt wird, faellt ueber die Kaskade an die
            // Ziele, die schon Geld verdienen.
            anteil = Math.min(anteil, anlaufDeckelZiel, anlaufDeckelRest);
          } else {
            anlaufSeit.delete(ziel);
          }

          const faeden = { hack: 0, grow: 0, weaken: 0 };
          if (plan.anlauf) {
            // Anlaufphase: der offene Bedarf wird der Reihe nach abgearbeitet,
            // weaken vor grow (Begruendung in planMix). Der Deckel auf den
            // Bedarf ist der eigentliche Gewinn dieser Fassung - bisher ging
            // der GANZE freie Netzspeicher in eine Aktion, also nahm eine
            // weaken-Welle hundert Sicherheitspunkte weg, wo fuenf zuviel
            // waren. Alles darueber war ersatzlos verschenkt.
            anlaufZiele++;
            let rest = anteil;
            faeden.weaken = Math.min(Math.ceil(plan.bedarf.weaken), Math.floor(rest / ramWeaken));
            rest -= faeden.weaken * ramWeaken;
            faeden.grow = Math.min(Math.ceil(plan.bedarf.grow), Math.floor(rest / ramGrow));
          } else {
            // Dauerbetrieb: GB je Mischeinheit. Eine Einheit besteht aus
            // r.hack hack-Faeden, r.grow grow-Faeden und r.weaken
            // weaken-Faeden; daraus faellt die Fadenzahl je Aktion direkt
            // heraus, ohne Zwischenrundung.
            const r = plan.ratio;
            const gbProEinheit = r.hack * ramHack + r.grow * ramGrow + r.weaken * ramWeaken;
            if (!(gbProEinheit > 0)) continue;
            const einheiten = anteil / gbProEinheit;
            faeden.hack = Math.floor(einheiten * r.hack);
            faeden.grow = Math.floor(einheiten * r.grow);
            faeden.weaken = Math.floor(einheiten * r.weaken);
            // Der kleinste Anteil geht beim Abrunden systematisch unter:
            // weaken hat im Gleichgewicht nur rund 7 % der Faeden, es braucht
            // also 14 volle Mischeinheiten fuer den ERSTEN Faden. Bei knappem
            // Budget - kleines Netz, viele Ziele, frisch nach einem Einbau -
            // faellt weaken damit Runde um Runde aus, die Sicherheit steigt
            // schleichend, und am Ende steht wieder das Pendeln, das dieser
            // Umbau gerade abschafft. Deshalb: wer im Verhaeltnis ueberhaupt
            // vorkommt, bekommt mindestens einen Faden, solange der Anteil
            // dafuer reicht. Kostet hoechstens zwei Faeden je Ziel und Runde.
            let uebrig = anteil - faeden.hack * ramHack - faeden.grow * ramGrow
              - faeden.weaken * ramWeaken;
            for (const [art, ram] of [["weaken", ramWeaken], ["grow", ramGrow], ["hack", ramHack]]) {
              if (faeden[art] === 0 && r[art] > 0 && uebrig >= ram) {
                faeden[art] = 1;
                uebrig -= ram;
              }
            }
          }
          let verbraucht = 0;
          for (const [art, skript, ram] of [
            ["weaken", "worker/weaken.js", ramWeaken],
            ["grow", "worker/grow.js", ramGrow],
            ["hack", "worker/hack.js", ramHack],
          ]) {
            const n = faeden[art];
            if (n < 1) continue;
            verbraucht += n * ram;
            summeFaeden[art] += n;
            // Dauer und Landezeit einmal je Wunsch, nicht je Rechner: alle
            // Teilwellen desselben Wunsches sollen gemeinsam landen.
            const dauer = actionTime(ziel, skript);
            wuensche.push({
              ziel, skript, ram, offen: n,
              dauer: Math.round(dauer), landAt: Math.round(Date.now() + dauer),
            });
          }
          budget = Math.max(0, budget - verbraucht);
          // Der Gesamtdeckel wird nur von Anlaufzielen abgetragen, sonst
          // waere er nach dem ersten Dauerbetriebsziel aufgebraucht und
          // wirkte gar nicht.
          if (plan.anlauf) anlaufDeckelRest = Math.max(0, anlaufDeckelRest - verbraucht);
        }

        // --- Ueberschuss an die Erfahrung (22.08.2026) ---------------------
        // Seit die Geldziele eine Kapazitaetsgrenze haben, kann Speicher
        // uebrigbleiben - und nach dem Serverausbau bleibt sehr viel uebrig:
        // gemessen 39.030 von 63.612 GB in einer Runde. Der Grund ist keine
        // Panne, sondern eine Tatsache ueber dieses BitNode: Die Summe der
        // Kapazitaeten aller erreichbaren Geldziele ist endlich, und das Netz
        // hat sie ueberholt.
        //
        // Brachliegen ist die schlechteste aller Verwendungen. Die zweitbeste
        // ist die Erfahrung, und in BitNode 4 ist sie sogar der eigentliche
        // Zweck der Arbeiter: w0r1d_d43m0n verlangt hier Hacking 9000 statt
        // 3000 (WorldDaemonDifficulty 3), und HackExpGain 0.4 macht jeden
        // Punkt zweieinhalbmal so teuer wie sonst.
        //
        // Erfahrung saettigt nicht: calculateHackingExpGain (Hacking.ts:29-38)
        // haengt allein an baseDifficulty und wird von hack, grow UND weaken
        // gleichermassen vergeben - der Zustand des Servers ist ihr egal, ein
        // leergehacktes Ziel liefert genauso viel wie ein volles. Deshalb
        // braucht dieser Zweig keinen Deckel; er nimmt, was sonst niemand
        // will.
        if (budget >= expRam && expTarget && expScript && expRam > 0) {
          const dauer = actionTime(expTarget, expScript);
          wuensche.push({
            ziel: expTarget, skript: expScript, ram: expRam,
            offen: Math.floor(budget / expRam),
            dauer: Math.round(dauer), landAt: Math.round(Date.now() + dauer),
          });
          ueberschussGb = Math.round(budget);
          budget = 0;
        }

        // Wuensche auf Rechner legen, groesster Rechner zuerst. So braucht ein
        // grosser Wunsch wenige exec-Aufrufe, und die kleinen Rechner bleiben
        // fuer die Reste uebrig.
        const platz = [...restFrei.entries()].sort((a, b) => b[1] - a[1]);
        for (const w of wuensche) {
          for (const eintrag of platz) {
            if (w.offen < 1) break;
            const passt = Math.floor(eintrag[1] / w.ram);
            if (passt < 1) continue;
            const n = Math.min(w.offen, passt);
            // Argumentreihenfolge unveraendert: (ziel, verzoegerung, landezeit,
            // dauer, runde) - siehe worker/hack.js:38-42.
            if (ns.exec(w.skript, eintrag[0], n, w.ziel, 0, w.landAt, w.dauer, runde) === 0) {
              fehlstart++;
              continue;
            }
            eintrag[1] -= n * w.ram;
            w.offen -= n;
          }
        }

        // Nur fuer die Beobachtung von aussen - die Verteilung ist die Zahl,
        // an der dieser Umbau gemessen wird.
        ueberschussMerker = ueberschussGb;
        mixStat = {
          ...summeFaeden, anlaufZiele, restGb: Math.round(budget),
          // Der Massstab des Nutzen-Gates gehoert nach draussen: Er ist die
          // einzige Zahl, an der von aussen zu sehen ist, wie gut die Flotte
          // gerade laeuft - und wie streng das Gate deshalb ist.
          effFlotte: Math.round(massstab),
          ueberschussGb,
          // Bezugsgroessen (siehe Modellobergrenze oben). Nur Beobachtung.
          deckeDollarProS: Math.round(deckeGesamt),
          deckeNetzDollarProS: Math.round(deckeNetz),
          kapGesamtGb: Math.round(kapGesamt),
          kapFreiGb: Math.round(kapFrei),
          budgetGb: Math.round(budgetStart),
          verfuegbarGb: Math.round(verfuegbarGb),
          expStandGb: Math.round(expRamAssigned),
          gesperrt: [...gesperrtBis.keys()],
        };
      }
    }

    // --- Grenzertragskurve festschreiben (22.08.2026) ---------------------
    // Ausserhalb aller if-Zweige, damit sie auch dann stimmt, wenn ein Zweig
    // in dieser Runde nicht gelaufen ist. Gelesen wird sie eine Runde spaeter
    // von der Serveraufruestung (Abschnitt 1a2).
    grenzStapelMerker = grenzStapel;
    grenzOffen.sort((a, b) => b.eff - a.eff);
    grenzOffenMerker = grenzOffen;
    // Nach draussen, sonst ist die Zahl, an der jeder Serverkauf haengt, von
    // aussen unsichtbar. Drei Stuetzstellen, weil der Grenzertrag von der
    // MENGE abhaengt - eine einzelne Zahl waere wieder derselbe Fehler.
    if (mixStat) mixStat.grenz = [1024, 4096, 16384].map((g) => Math.round(grenzErtrag(g)));

    if (fehlstart) sag(fehlstart + " Arbeiter liessen sich nicht starten (Speicher?).");

    // --- 2c. Werkzeuge betreiben ----------------------------------------------
    // Alles, was nicht Netz und nicht Spielfigur ist, laeuft auf der Werkbank -
    // oder bleibt, wo es schon laeuft. Die Liste WERKZEUGE steht oben am
    // Skriptanfang, weil die RAM-Verteilung sie frueher braucht als diese
    // Stelle.
    let vertraege = 0;
    for (const host of hosts) vertraege += ns.ls(host, ".cct").length;

    // Sammeln und Entdoppeln stehen VOR der Werkbank-Pruefung (23.08.2026).
    // Vorher hing der ganze Block an `if (werkbank)` - gab es keine
    // Werkbank, unterblieb auch die Entdopplung. Genau dieser Zustand
    // herrscht direkt nach einem Knotenwechsel, wenn home wieder 32 GB hat
    // und noch nichts gekauft ist: also dort, wo ein Mensch am ehesten von
    // Hand nachhilft und dabei eine zweite Instanz erzeugt.
    // Netzweit pruefen. Nur auf der Werkbank nachzusehen hiesse: Sobald ein
    // groesserer Rechner gekauft wird und die Werkbank wechselt, gilt jedes
    // Werkzeug als fehlend und wird ein zweites Mal gestartet - waehrend die
    // alte Instanz weiterlaeuft. Bei bn4rep.js waeren das zwei Steuerungen
    // fuer dieselbe Spielfigur, also genau der Fehler, den die
    // Aufgabenteilung verhindern soll.
    const laufend = [];
    const orte = new Map();          // Datei -> [{host, pid}, ...]
    for (const host of hosts) {
      if (!ns.hasRootAccess(host)) continue;
      for (const pr of ns.ps(host)) {
        laufend.push(pr.filename);
        // Die beiden Steuerhaelften gehoeren mit in die Entdopplung, obwohl
        // sie nicht in WERKZEUGE stehen: Der Auftragslaeufer in bn4life.js
        // startet ein Skript auf dem Rechner mit dem MEISTEN freien
        // Speicher, und das ist praktisch nie home. Wer bn4life.js von Hand
        // neu startet, bekommt eine Instanz auf einem Mietrechner - und
        // weil die Wiederbelebung mit ns.isRunning(..., "home") prueft,
        // startet die andere Haelfte prompt eine zweite auf home. Zwei
        // bn4life begehen dann gleichzeitig Verbrechen, treten Faktionen
        // bei und reisen.
        const istSteuerung = pr.filename === "bn4life.js" || pr.filename === "bn4net.js";
        if (!istSteuerung && !WERKZEUGE.some(([d]) => d === pr.filename)) continue;
        if (!orte.has(pr.filename)) orte.set(pr.filename, []);
        orte.get(pr.filename).push({ host, pid: pr.pid });
      }
    }

    // Doppelte Werkzeuge einsammeln. Die Pruefung oben verhindert nur, dass
    // DIESES Skript ein zweites Mal startet - sie raeumt nichts weg, was
    // auf anderem Weg dazugekommen ist. Am 23.08.2026 lief bn4rep.js
    // gleichzeitig auf home und auf fulcrumtech, weil ein Neustart von Hand
    // (tools/task.js) auf home landete, waehrend die Werkbank ihre Instanz
    // behielt. Zwei Steuerungen fuer dieselbe Spielfigur heben sich
    // gegenseitig die Arbeit ab: workForCompany und workForFaction ersetzen
    // die jeweils laufende Taetigkeit, das Ergebnis ist eine Figur, die im
    // Sekundentakt zwischen zwei Auftraegen springt und an keinem
    // Fortschritt macht. Genau so stand der Bot am 22.08. eine Stunde.
    //
    // Die aelteste Instanz bleibt: Sie hat den laengsten ununterbrochenen
    // Arbeitsfortschritt hinter sich, und bei bn4rep.js haengt daran die
    // laufende Faktions- oder Firmenarbeit. Kleinere pid heisst frueher
    // gestartet - die Vergabe ist im Spiel streng aufsteigend
    // (Netscript/killWorkerScript.ts, generatePid).
    // STILLSTAND GEHOERT IN DEN MOTOR (02.09.2026, Audit "volle Autonomie").
    //
    // Ein Werkzeug, das lebt, aber seit Minuten nichts mehr schreibt, sah
    // bisher nur die Wache draussen - und ihr Neustart erzeugte eine zweite
    // Instanz, die die Entdopplung unten binnen 10 s als "doppelt" erschlug,
    // weil die haengende die kleinere PID hatte (17 wirkungslose Neustarts
    // von wakelock.js in 4 h am 02.09.). Jetzt prueft bn4net das Alter der
    // Telemetrie selbst: aelter als erlaubt, und das Werkzeug lief lange
    // genug, um geschrieben zu haben -> alle Instanzen beenden; der Starter
    // unten holt es in derselben Runde zurueck. Werkzeuge ohne Telemetrie
    // auf home (contracts, popups, bn4door, homegrow, wakelock) sind nicht
    // abgedeckt.
    for (const [datei, telemetrie, maxAlterMs] of TELEMETRIE) {
      const wo = orte.get(datei);
      if (!wo || !wo.length) continue;
      const seit = werkzeugSeit.get(datei);
      if (!seit) { werkzeugSeit.set(datei, Date.now()); continue; }
      if (Date.now() - seit < maxAlterMs) continue;
      let alter = null;
      try {
        if (ns.fileExists(telemetrie, "home")) {
          const d = JSON.parse(ns.read(telemetrie));
          // DREI FELDNAMEN, WEIL ES DREI GENERATIONEN GIBT (04.09.2026).
          //
          // Die alten Werkzeuge schreiben `zeit`, die neuen `ts` und `wall`
          // (ARCHITEKTUR 4.1, Herzschlag v2). Solange hier nur `zeit` stand,
          // galt jeder Herzschlag der neuen Form als "nie geschrieben" - und
          // das Alter wurde auf "seit dem Start" gesetzt. Der Kern haette
          // seine eigenen Werkzeuge im Takt der Frischefrist erschlagen,
          // dauerhaft, ohne dass etwas kaputt gewesen waere.
          //
          // Gefunden vom Skeptiker, nicht im Betrieb: live steht in
          // TELEMETRIE_FEST nur, was `zeit` schreibt.
          for (const feld of ["zeit", "ts", "wall"]) {
            if (Number.isFinite(d[feld])) { alter = Date.now() - d[feld]; break; }
          }
        }
      } catch { alter = null; }
      if (alter === null) alter = Date.now() - seit;   // nie geschrieben: seit dem Start
      if (alter <= maxAlterMs) continue;
      for (const w of wo) ns.kill(w.pid);
      werkzeugSeit.delete(datei);
      orte.delete(datei);
      // Aus `laufend` streichen, sonst haelt der Starter unten das Werkzeug
      // fuer vorhanden und der Neustart kaeme erst in der Folgerunde.
      for (let i = laufend.length - 1; i >= 0; i--) if (laufend[i] === datei) laufend.splice(i, 1);
      sag(datei + " lebt, schreibt aber seit " + Math.round(alter / 60000)
        + " min nichts (" + telemetrie + ") - beendet, Neustart in dieser Runde.");
    }
    for (const datei of [...werkzeugSeit.keys()]) {
      if (!orte.has(datei)) werkzeugSeit.delete(datei);
    }

    for (const [datei, wo] of orte) {
      if (wo.length < 2) continue;
      // Bei den Steuerhaelften gewinnt IMMER die auf home - dort sucht die
      // jeweils andere Haelfte sie. Sonst die JUENGSTE (02.09.2026): Eine
      // zweite Instanz entsteht praktisch nur durch einen Neustartversuch,
      // und der gilt der haengenden alten. Vorher blieb die aelteste - und
      // damit genau die, die nichts mehr tat.
      const istSteuerung = datei === "bn4life.js" || datei === "bn4net.js";
      if (istSteuerung && wo.some((w) => w.host === "home")) {
        wo.sort((a, b) => (a.host === "home" ? -1 : 0) - (b.host === "home" ? -1 : 0));
      } else {
        wo.sort((a, b) => b.pid - a.pid);
      }
      for (const ueberzaehlig of wo.slice(1)) {
        ns.kill(ueberzaehlig.pid);
        sag("Doppelte Instanz von " + datei + " auf " + ueberzaehlig.host
          + " beendet (pid " + ueberzaehlig.pid + "); " + wo[0].host
          + " behaelt sie.");
      }
    }

    // --- 2b1. Nachholer: TOR und Portknacker ----------------------------------
    //
    // Der Reset nimmt alle Programme ausser NUKE.exe mit, und der TOR-Router
    // ueberlebt ihn ebenfalls nicht. Ohne Portknacker sind von 87 Rechnern
    // acht erreichbar - ohne Einkommen keine Server, ohne Server keine
    // Rechenzeit. src/darkweb.js nennt das im Kopf "der Engpass nach jedem
    // Reset", und genau so war es: In BitNode 5 stand der Bot bei acht
    // Rechnern, bis der Kauf von Hand angestossen wurde.
    //
    // WARUM DER OBERFLAECHENWEG UND NICHT bn4life. bn4life kauft dasselbe
    // ueber Singularity und ist damit ausserhalb von BitNode 4 293,8 GB gross
    // - es laeuft im frischen Knoten stundenlang nicht. darkweb.js liest die
    // Oberflaeche ueber globalThis["document"]; der Zugriff kostet pauschal
    // 25 GB und ist vom BitNode voellig unabhaengig. Gemessen 27,65 GB, also
    // auf jedem 64-GB-Mietrechner startbar. Dieselbe Ueberlegung gilt fuer
    // homeram.js (30,4 GB statt 148,5 GB fuer homegrow.js).
    //
    // ABSTAND VON FUENF MINUTEN. darkweb.js wechselt die Seite im Spiel. Alle
    // zehn Sekunden gestartet, wuerde es die Oberflaeche unter den Haenden
    // wegziehen, waehrend jemand zusieht. Es beendet sich von selbst, sobald
    // das Geld fuer das naechste Programm nicht reicht - der Wiederanlauf
    // holt dann das nach, was inzwischen bezahlbar geworden ist.
    const PORTPROGRAMME = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe",
                           "HTTPWorm.exe", "SQLInject.exe"];
    const NACHHOL_ABSTAND_MS = 300000;
    if (PORTPROGRAMME.some((d) => !ns.fileExists(d, "home"))
        && Date.now() - nachholMerker > NACHHOL_ABSTAND_MS
        && !hosts.some((h) => {
          try { return ns.ps(h).some((pr) => pr.filename === "darkweb.js"); }
          catch { return false; }
        })) {
      const braucht = ns.getScriptRam("darkweb.js", "home");
      let wirt = null, meistFrei = 0;
      for (const host of hosts) {
        if (!ns.hasRootAccess(host)) continue;
        const frei = ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
          - (host === "home" ? reserveHome() : 0);
        if (frei > meistFrei) { meistFrei = frei; wirt = host; }
      }
      if (braucht > 0 && wirt && meistFrei >= braucht) {
        nachholMerker = Date.now();
        if (wirt !== "home") ns.scp("darkweb.js", wirt, "home");
        const pid = ns.exec("darkweb.js", wirt, 1);
        sag(pid ? "Portknacker nachkaufen: darkweb.js auf " + wirt
            + " (pid " + pid + ")."
          : "darkweb.js liess sich auf " + wirt + " nicht starten (exec gab 0).");
      } else if (runde % 30 === 0) {
        sag("Portknacker fehlen, aber darkweb.js (" + braucht.toFixed(1)
          + " GB) findet nirgends Platz.");
      }
    }

    if (werkbank) {
      werkzeugWartetGb = 0;   // wird unten neu gesetzt, wenn noch etwas wartet
      // IN HACKINGKNOTEN KEIN BLADEBURNER-GERUEST (02.09.2026).
      //
      // ausgang.js legt das Verfahren dieses Laufs in data/verfahren.txt ab
      // ("V1 5 2" = Hackingweg, Knoten 5, Stufe 2). In V1-Knoten (1, 5, 12,
      // 8) tragen Black Ops nichts; bbtrain wuerde trotzdem die Figur ins
      // Gym stellen und blade.js Speicher belegen - in BitNode 8 wird der
      // Beitritt abgelehnt und bbtrain rief alle 30 s stopAction(). Fehlt
      // die Datei oder gehoert sie zu einem anderen Knoten, gilt V2 (der
      // haeufigere Fall auf der Route).
      const verfahrenV1 = (() => {
        try {
          const teile = ns.read("data/verfahren.txt").trim().split(/\s+/);
          return Number(teile[1]) === ns.getResetInfo().currentNode
            && (teile[0] === "V1" || teile[0] === "V1b");
        } catch { return false; }
      })();
      // Marker der Kaltstart-Werkzeuge: hashes.js legt data/keine-hacknet.txt
      // ab, wenn der Knoten keine Hacknet-Server kennt; sleevecrime.js legt
      // data/keine-sleeves.txt ab, wenn es keine Sleeves gibt. Beide tragen
      // die Knotennummer, boot.js raeumt sie beim Wechsel.
      const markerGilt = (datei) => {
        try {
          return ns.fileExists(datei, "home")
            && Number(ns.read(datei).trim()) === ns.getResetInfo().currentNode;
        } catch { return false; }
      };
      const keineHacknet = markerGilt("data/keine-hacknet.txt");
      const keineSleeves = markerGilt("data/keine-sleeves.txt");
      // DER HAENDLER LAEUFT AUF ABRUF (04.09.2026).
      //
      // shop.js kostet 7,00 GB - im Kaltstart ein Fuenftel des Budgets, fuer
      // ein Gewerk, das die meiste Zeit dieselbe Preistabelle neu schreibt.
      // Gerechnet: Kern 10,80 + Waechter 6,10 + Wachhalter 2,25 + Haendler
      // 7,00 = 26,15 von 32. Mit boot.js daneben bliebe fuer Arbeiter nichts.
      //
      // Es beendet sich deshalb selbst, sobald die Preise geschrieben und kein
      // Auftrag offen ist. Hier steht die Gegenseite: WANN es zurueckgeholt
      // wird. Zwei Gruende, und nur diese beiden.
      //
      //   1. Die Preistabelle ist aelter als vier Minuten. Der Kern verwirft
      //      sie ab fuenf (parkLage), also muss der Nachschub vorher da sein -
      //      sonst entstuende genau die Luecke, in der er nicht kaufen kann,
      //      weil er keine Preise hat.
      //   2. Ein Auftrag ist offen. Dann wird er gebraucht, egal wie alt die
      //      Preise sind.
      //
      // OHNE DIESE REGEL WAERE ES EIN DEADLOCK, und zwar ein lautloser: der
      // Kern schreibt einen Auftrag erst, wenn er Preise hat, und Preise
      // schreibt nur shop.js. Genau diese Verklemmung stand vor der zweiten
      // Skeptikerrunde in der Registry (als Vorbedingung auf eine Datei, die
      // ohnehin niemand schrieb) und hatte den Rechnerkauf vollstaendig
      // ausfallen lassen.
      const shopNoetig = (() => {
        if (offenerAuftrag && auftragOffen()) return true;
        const pl = parkLage();
        // Keine Preise heisst dringend - AUSSER wir wissen schon, dass es in
        // diesem Knoten nichts zu kaufen gibt. Sonst stuende die Regel unten
        // nie zur Debatte: `pl.da` ist ab fuenf Minuten immer false.
        if (!pl.da && pl.kaufbarBekannt !== false) return true;
        // BITNODE 9: ES GIBT KEINE MIETRECHNER, NIE (Position C.13).
        //
        // `CloudServerLimit` steht dort auf 0 (BitNode.tsx:816, verifiziert),
        // und drei der vierzig Restlaeufe spielen in diesem Knoten. Ein
        // Haendler, der alle fuenf Minuten 7 GB belegt, um dieselbe Null neu
        // aufzuschreiben, ist dort reine Verschwendung - und 7 GB sind auf
        // einem home, das den ganzen Lauf lang der wichtigste Rechner bleibt,
        // viel Geld.
        //
        // Ganz abschalten waere falsch: `kaufbar` ist eine Auskunft des
        // Spiels, keine Konstante, und eine halbe Stunde alte Auskunft ist in
        // einem Knoten ohne Mietrechner immer noch aktuell genug.
        // `kaufbar` gilt nur bei frischer Tabelle; `kaufbarBekannt` ueberlebt
        // ihr Veralten, weil CloudServerLimit sich innerhalb eines Laufs nie
        // aendert.
        const gibtEsMietrechner = pl.da ? pl.kaufbar : pl.kaufbarBekannt;
        if (gibtEsMietrechner === false) {
          return !Number.isFinite(pl.alterMs) || pl.alterMs > 1800000;
        }
        return !Number.isFinite(pl.alterMs) || pl.alterMs > 240000;
      })();

      // EINMALLAEUFER NICHT IM SEKUNDENTAKT WIEDERHOLEN (Skeptiker Fehlermodi,
      // 04.09.2026).
      //
      // `restartPolicy: "until-done"` stand in der Registry und hatte keinen
      // Leser. Gemessen wurden 41 Starts in 41 Runden fuer `cdump.js` und
      // `darkweb.js` - beide sind Einmallaeufer, beide beenden sich nach
      // Sekunden, und der Starter holte sie sofort zurueck. Jeder
      // cdump-Neustart zwingt den Kern ausserdem, auf home eine Arbeiterart
      // zu erschlagen, um die 12 GB freizubekommen. Alle zehn Sekunden.
      //
      // Ein Einmallaeufer wird deshalb nur alle drei Minuten neu angesetzt.
      // Das ist kein Kompromiss, sondern die richtige Zahl: `cdump.js` findet
      // in drei Minuten Netzzeit keine nennenswert anderen Vertraege, und
      // `darkweb.js` kann in drei Minuten kein Geld gesammelt haben, das
      // vorher fehlte.
      //
      // Die Ausnahme ist ein OFFENER AUFTRAG: `csolve.js` laeuft, sobald
      // Antworten da sind, und `shop.js` regelt seinen Bedarf ueber
      // `shopNoetig` weiter oben - beide werden hier nicht gebremst.
      const EINMAL_PAUSE_MS = 180000;
      // Name -> hostRule, damit die Schleife unten sie ohne zweite Suche hat.
      const eintragRegel = new Map(WERKZEUGE.map(([n, , , h]) => [n, h]));

      const einmalBremse = (d, policy) => {
        if (policy === "always") return false;
        if (d === "shop.js") return false;              // eigene Bedarfsregel
        if (d === "csolve.js") return false;            // Vorbedingung regelt es
        const zuletzt = einmalGestartet.get(d);
        return !!zuletzt && Date.now() - zuletzt < EINMAL_PAUSE_MS;
      };

      // DIE VORBEDINGUNG GILT JE RUNDE, NICHT JE LISTENBAU (06.09.2026, Kaltstart
      // BN10 L3). WERKZEUGE wird nur neu gebaut, wenn Knoten, Rolle oder Phase
      // wechseln - `requiresFile`/`forbidsFile` aus der Registry wurden also
      // EINMAL geprueft und danach nie wieder. Folge um 12:31: csolve.js
      // (requiresFile data/cantwort.json, Datei fehlt) stand in der Liste,
      // "Vorbedingung regelt es" oben liess es durch, der Kern startete es
      // alle 10 s, raeumte dafuer jedes Mal Arbeiter auf home und liess
      // ausgang.js keinen Platz. Jetzt fragt der Filter die Registry je
      // Runde - dieselbe Funktion, die auch die Liste baut.
      const vorbedingungGilt = (d) => {
        if (!regGeladen) return true;
        const e = (regGeladen.eintraege || []).find((x) => x.name === d);
        if (!e) return true;
        const g = regGilt(e, regLage);
        if (!g.gilt && runde % 30 === 0) sag(d + " wartet: " + g.grund + ".");
        return g.gilt;
      };

      const fehlend = WERKZEUGE.filter(([d, , policy]) => !laufend.includes(d)
        && vorbedingungGilt(d)
        && !einmalBremse(d, policy)
        && !(verfahrenV1 && (d === "blade.js" || d === "bbtrain.js"))
        && !((d === "hashes.js" || d === "hacknet.js") && keineHacknet)
        && !(d === "shop.js" && !shopNoetig)
        && !(d === "sleevecrime.js" && (keineSleeves || laufend.includes("sleeve.js"))));
      // Laufende Instanzen im Hackingknoten beenden - der Filter oben wirkt
      // nur auf den Start. Ohne das haelt ein Handstart oder eine Runde, in
      // der die Datei kurz fehlte, das Bladeburner-Geruest den ganzen Lauf am
      // Leben (Skeptiker 02.09.).
      if (verfahrenV1) {
        for (const d of ["blade.js", "bbtrain.js"]) {
          for (const w of orte.get(d) || []) {
            ns.kill(w.pid);
            sag(d + " im Hackingknoten beendet (" + w.host + ", pid " + w.pid + ").");
          }
        }
      }
      // WAS GILT GERADE ALS FEHLEND? (29.08.2026, 15:20)
      //
      // Am 29.08. lief sleeve.js von 12:53 bis 14:17 nicht. Im Log steht der
      // Kill ("1 Instanz(en) beendet, startet gleich neu") - und danach 87
      // Minuten lang NICHTS. Kein "laeuft auf", kein "wartet", kein
      // "nicht lesbar", kein "exec gab 0". Jeder Pfad unten meldet etwas,
      // also wurde die Datei nie in `fehlend` aufgenommen - `laufend` muss
      // sie gefuehrt haben, obwohl `ns.ps` sie netzweit nicht zeigte.
      // Ohne diese Zeile ist das nicht zu unterscheiden.
      if (fehlend.length && runde % 10 === 0) {
        sag("fehlend: " + fehlend.map(([d]) => d).join(", ")
          + " | laufend: " + [...new Set(laufend)].filter(
            (d) => WERKZEUGE.some(([w]) => w === d)).join(", "));
      }

      // Nur raeumen, wenn wirklich nichts von uns dort laeuft. Ein killall auf
      // eine belegte Werkbank wuerde den Vertragsloeser mitten im Durchlauf
      // erschlagen - und das alle zehn Sekunden erneut.
      const frei = () => ns.getServerMaxRam(werkbank) - ns.getServerUsedRam(werkbank);

      // Gezielt die Arbeiter raeumen, nicht pauschal alles. Ein killall haette
      // die laufenden Werkzeuge miterschlagen, ein Verzicht auf jede Raeumung
      // dagegen laesst ein fehlendes Werkzeug ewig draussen stehen: Genau so
      // lief bn4rep.js eine Zeitlang gar nicht mehr - gekillt, aber der Platz
      // fuer den Neustart war von Arbeitern belegt, und weil daneben
      // contracts.js lief, galt die Werkbank als "in Benutzung".
      //
      // Seit Hebel 1 (22.08.2026) liegen auf der Werkbank Hunderte GB
      // fliegende Arbeit statt gar nichts. Deshalb wird nicht mehr in einem
      // Rutsch alles erschlagen, sondern eine Arbeiterart nach der anderen,
      // und nur so lange, bis der Platz reicht. Die Reihenfolge ist nach
      // Verlustwert sortiert: share bringt seinen Nutzen laufend und faengt
      // beim Neustart ohne Verlust wieder an; ein abgebrochener weaken, grow
      // oder hack dagegen wirft seine gesamte bisherige Laufzeit weg, und
      // hack ist der einzige, der Geld bringt - er stirbt zuletzt.
      // AUCH AUF HOME RAEUMEN (27.08.2026, 06:20) - hier stand
      // `werkbank !== "home"`, und genau daran ist der Wiederanlauf seit dem
      // 25.08. immer wieder gescheitert.
      //
      // Die Kette: Nach einem Einbau sind alle gekauften Rechner weg, also
      // wird home zur Werkbank (:770-778). Der Startcode unten prueft dann
      // `werkbankMoeglich = frei + raeumbare Arbeiter` und WARTET, wenn das
      // Werkzeug dort theoretisch passen wuerde - in der Annahme, dieser
      // Block habe inzwischen geraeumt. Auf home hat er das nie getan.
      // Ergebnis: Ein Werkzeug, das auf home passen wuerde, wartet endlos auf
      // Platz, den niemand schafft.
      //
      // Gemessen am 27.08.: `bbtrain.js` (94,75 GB) lief von 03:48 bis 04:18
      // nicht, waehrend home 2048 GB hatte - belegt mit Arbeitern. Dasselbe
      // Muster am 26.08. um 16:36 mit `blade.js`.
      //
      // Geraeumt werden ausschliesslich `WORKER`-Skripte; die beiden
      // Steuerhaelften stehen nicht in der Liste und bleiben unberuehrt.
      if (fehlend.length) {
        for (const [datei] of fehlend) {
          const braucht = ns.getScriptRam(datei, "home");
          if (!(braucht > 0) || frei() >= braucht) continue;
          let geraeumt = 0;
          for (const w of ["worker/share.js", "worker/weaken.js", "worker/grow.js", "worker/hack.js"]) {
            if (frei() >= braucht) break;
            if (!ns.ps(werkbank).some((pr) => pr.filename === w)) continue;
            ns.scriptKill(w, werkbank);
            geraeumt++;
          }
          if (geraeumt) {
            sag(geraeumt + " Arbeiterart(en) auf " + werkbank + " geraeumt, "
              + datei + " braucht " + braucht.toFixed(1) + " GB.");
          }
          break;
        }
      }

      // EINE WERKBANK REICHT NICHT MEHR (25.08.2026, gemessen in BitNode 6).
      //
      // Alle Werkzeuge auf EINEN Rechner zu legen war richtig, solange ihre
      // Summe unter den groessten Rechner passte. Das gilt nicht mehr:
      //   blade 41,25 + bbtrain 94,75 + bn4life 293,8 + homegrow 148,5
      //   + wakelock 34,25 + bn4door 99,85 = 712,4 GB auf werk-0 (1024 GB)
      // Fuer bn4rep.js mit 768,25 GB blieben 312,25 GB - und es gab keinen
      // zweiten Wirt, denn gestartet wurde ausschliesslich auf der Werkbank.
      // bn4rep lief deshalb vom Einbau um 05:50 bis 16:50 gar nicht, ohne
      // dass die Zeile "wartet" jemals ausserhalb des Spiel-Logs sichtbar
      // geworden waere.
      //
      // Es gab durchaus Platz: fulcrumtech haette nach dem Raeumen seiner
      // Arbeiter 1.021 GB gehabt. Nur hat niemand dort nachgesehen.
      //
      // Deshalb sucht jedes fehlende Werkzeug jetzt selbst einen Wirt: erst
      // die Werkbank (dort gehoert es hin, dort steht die Reserve), und wenn
      // es dort auch nach dem Raeumen nie passen kann, den Rechner mit dem
      // meisten Platz nach Raeumung. Arbeiter sind Einwegskripte - bn4net legt
      // sie in der naechsten Runde von selbst wieder nach.
      const freiAuf = (h) => ns.getServerMaxRam(h) - ns.getServerUsedRam(h);
      const arbeiterGbAuf = (h) => {
        let gb = 0;
        for (const pr of ns.ps(h)) {
          if (!WORKER.includes(pr.filename)) continue;
          gb += ns.getScriptRam(pr.filename, "home") * pr.threads;
        }
        return gb;
      };
      const ausweichwirt = (braucht) => {
        let bester = null, meist = -1;
        for (const h of hosts) {
          if (!ns.hasRootAccess(h)) continue;
          if (h === werkbank) continue;
          // HOME IST KEIN TABU MEHR, SONDERN EINE RECHNUNG (27.08.2026, 06:10).
          //
          // Hier stand `if (h === "home") continue` mit der Begruendung, ein
          // 768-GB-Werkzeug haette dort "ohnehin nie Platz". Das stimmte, als
          // home 64 GB hatte. Heute hat es **2048**, und der Ausschluss ist
          // der Grund, warum `bn4rep.js` in BitNode 6 nirgends unterkommt:
          // Die Werkbank ist `millenium-fitness` mit 256 GB, der Ausbau auf
          // 1024 GB kostet **897,6 Milliarden** (CloudServerSoftcap 2,
          // `BitNode.tsx:702`) gegen 1,9 Milliarden Guthaben - ueber Server
          // ist der Platz in diesem Knoten nicht zu bekommen.
          //
          // Statt des Tabus jetzt die Rechnung: Was auf home moeglich ist,
          // ist der freie Platz plus die raeumbaren Arbeiter, MINUS der
          // Reserve, die die beiden Steuerhaelften schuetzt. Fehlt danach
          // Platz, faellt home wie jeder andere Rechner durch die Pruefung
          // darunter - nur eben aus Mangel, nicht aus Prinzip.
          const abzug = h === "home" ? reserveHome() : 0;
          const moeglich = freiAuf(h) + arbeiterGbAuf(h) - abzug;
          if (moeglich >= braucht && moeglich > meist) { meist = moeglich; bester = h; }
        }
        return bester;
      };

      // WIRTSPERREN DES WAECHTERS (Position C.9, 04.09.2026).
      //
      // Sprosse 2 der Strafleiter verschiebt ein Werkzeug auf einen anderen
      // Wirt. Der Waechter kann den neuen Wirt nicht selbst waehlen - die
      // Wirtwahl mit Speicherpruefung und Raeumkette steht hier -, aber er
      // kann den bisherigen sperren. Ohne diese Zeilen liefe die Sprosse ins
      // Leere: der Kern setzte das Werkzeug in derselben Runde auf denselben
      // Rechner zurueck, sechsmal je sechs Stunden.
      //
      // Ein Eintrag verfaellt nach einer Stunde; das steht in der Datei, nicht
      // hier - der Waechter raeumt sie selbst auf.
      const wirtGesperrt = (() => {
        const leer = () => false;
        try {
          if (!ns.fileExists("data/blocked-hosts.json", "home")) return leer;
          const d = JSON.parse(ns.read("data/blocked-hosts.json"));
          if (!d || !Array.isArray(d.eintraege)) return leer;
          const jetzt = Date.now();
          const gilt = d.eintraege.filter((e) => Number.isFinite(e.bis) && e.bis > jetzt);
          if (!gilt.length) return leer;
          return (werkzeug, host) => gilt.some(
            (e) => e.werkzeug === werkzeug && e.host === host);
        } catch { return leer; }
      })();

      // DIE PLATZRESERVIERUNG (Position C.7, 04.09.2026).
      //
      // Ohne sie gibt es eine klassische Prioritaetsinversion, und der
      // Kaltstart-Budgettest hat sie schwarz auf weiss gezeigt: auf einem
      // frischen home (32 GB) liegen Kern 10,80 + Waechter 6,10 +
      // Wachhalter 2,25 + popups 3,30 = 22,45 GB. Es bleiben 9,55 - und
      // `cdump.js` braucht 12,00. Es passt also nicht, wird uebersprungen, und
      // die naechsten Eintraege der Liste belegen den Rest.
      //
      // Ergebnis: KEINE der drei Geldquellen des Kaltstarts (cdump, csolve,
      // sleevecrime) findet je Platz. Der Bot steht mit vollem Speicher da und
      // verdient nichts - in genau der Phase, in der Geld alles ist.
      //
      // Deshalb: passt ein Eintrag nicht auf home, wird der Platz fuer ihn
      // FREIGEHALTEN. Alles, was in der Liste hinter ihm steht, wartet - aber
      // nur auf home, und nur begrenzt.
      //
      // DIE ZEITGRENZE IST DER WICHTIGE TEIL. Eine Reservierung ohne Verfall
      // ist eine Blockade: braeuchte ein Eintrag mehr, als home je hergibt,
      // stuende der ganze Rest fuer immer. Nach fuenf Minuten Wanduhr faellt
      // sie deshalb, das Gewerk wird uebersprungen, und die naechsten duerfen.
      // Beim naechsten Anlauf beginnt die Frist von vorn - so bekommt der
      // teure Eintrag regelmaessig eine Chance, ohne dauerhaft zu blockieren.
      const RESERVIERUNG_MS = 300000;
      let reserviertFuer = null;      // Dateiname oder null

      for (const [datei, args, , , libs] of fehlend) {
        const braucht = ns.getScriptRam(datei, "home");
        // Nicht stillschweigend ueberspringen. Ein Werkzeug, das seit einer
        // halben Stunde fehlt, ohne dass irgendwo steht warum, ist genau das
        // Muster, das diesen Bot schon mehrfach stundenlang hat stillstehen
        // lassen. Die Drosselung auf alle zehn Runden haelt das Log lesbar.
        if (!(braucht > 0)) {
          if (runde % 10 === 0) sag(datei + " nicht lesbar (getScriptRam gibt 0).");
          continue;
        }

        // DIE WIRTREGEL DURCHSETZEN (Skeptiker Fehlermodi, 04.09.2026).
        //
        // `hostRule` stand in der Registry und hatte keinen Leser - gemessen
        // lief `darkweb.js` (hostRule "home") auf `joesguns` und `foodnstuff`.
        // Das ist nicht nur unordentlich: mehrere Gewerke schreiben Dateien,
        // die andere auf HOME erwarten, und `dateiDa` schaut nirgends sonst
        // hin. Ein Gewerk am falschen Ort arbeitet ins Leere, ohne dass etwas
        // auffaellt.
        //
        //   "home"        muss auf home laufen
        //   "werkbank"    gehoert auf die Werkbank (das ist der Normalfall)
        //   "not-hacknet" ueberall ausser auf Hacknet-Servern
        //   "any"         egal
        const regel = eintragRegel.get(datei) || "any";
        let wirt = regel === "home" ? "home" : werkbank;

        // Ein "home"-Gewerk weicht nicht aus. Passt es dort nicht, wartet es -
        // und die Platzreservierung oben haelt ihm den Platz frei.
        if (regel === "home" && freiAuf("home") < braucht) {
          if (runde % 10 === 0) {
            sag(datei + " gehoert auf home und findet dort nur "
              + freiAuf("home").toFixed(1) + " von " + braucht.toFixed(1) + " GB.");
          }
          if (!reserviertFuer) {
            const seit = reservierungSeit.get(datei);
            if (!seit) { reservierungSeit.set(datei, Date.now()); reserviertFuer = datei; }
            else if (Date.now() - seit < RESERVIERUNG_MS) reserviertFuer = datei;
            else reservierungSeit.delete(datei);
          }
          continue;
        }

        // Ist die Werkbank fuer dieses Werkzeug gesperrt, gilt sofort der
        // Ausweichweg - unabhaengig davon, wieviel Platz dort waere.
        if (regel !== "home" && wirtGesperrt(datei, werkbank)) {
          const weg = ausweichwirt(braucht);
          if (!weg || wirtGesperrt(datei, weg)) {
            if (runde % 10 === 0) {
              sag(datei + ": " + werkbank + " ist vom Waechter gesperrt, und es"
                + " findet sich kein anderer Wirt - es bleibt aus.");
            }
            continue;
          }
          sag(datei + ": " + werkbank + " ist vom Waechter gesperrt - weiche auf "
            + weg + " aus.");
          wirt = weg;
          // Auf dem Ausweichwirt raeumen - dieselbe Reihenfolge nach
          // Verlustwert wie unten: share faengt ohne Verlust wieder an, ein
          // abgebrochener hack wirft seine ganze Laufzeit weg.
          if (freiAuf(wirt) < braucht) {
            for (const w of ["worker/share.js", "worker/weaken.js",
                             "worker/grow.js", "worker/hack.js"]) {
              if (freiAuf(wirt) >= braucht) break;
              if (!ns.ps(wirt).some((pr) => pr.filename === w)) continue;
              ns.scriptKill(w, wirt);
            }
          }
          if (freiAuf(wirt) < braucht) {
            if (runde % 10 === 0) {
              sag(datei + ": Raeumen auf dem Ausweichwirt " + wirt + " brachte nur "
                + freiAuf(wirt).toFixed(1) + " von " + braucht.toFixed(1) + " GB.");
            }
            continue;
          }
        } else if (regel === "home") {
          // Schon oben behandelt: es passt, und der Wirt steht fest.
        } else if (reserviertFuer && werkbank === "home") {
          // Ein Eintrag hoeherer Prioritaet haelt gerade Platz auf home frei.
          // Auf einem ANDEREN Wirt darf dieser hier trotzdem starten - die
          // Reservierung gilt nur fuer home, und ein Ausweichwirt nimmt dem
          // Wartenden nichts weg.
          const weg = ausweichwirt(braucht);
          if (!weg || wirtGesperrt(datei, weg)) {
            if (runde % 30 === 0) {
              sag(datei + " wartet: " + reserviertFuer + " haelt Platz auf home"
                + " frei, und es gibt keinen Ausweichwirt.");
            }
            continue;
          }
          wirt = weg;
        } else if (frei() < braucht) {
          // Kann es auf der Werkbank ueberhaupt je passen, wenn man alle
          // Arbeiter dort raeumte? Wenn nein, ist Warten sinnlos - dann fehlt
          // nicht Geduld, sondern ein anderer Rechner.
          const werkbankMoeglich = freiAuf(werkbank) + arbeiterGbAuf(werkbank);
          if (werkbankMoeglich >= braucht) {
            if (runde % 10 === 0) sag(datei + " wartet: " + werkbank + " hat "
              + frei().toFixed(1) + " von " + braucht.toFixed(1) + " GB frei.");
            // Platz freihalten - siehe die Begruendung oben. Nur auf home und
            // nur fuer den ERSTEN Wartenden: eine zweite Reservierung wuerde
            // nichts hinzufuegen, weil ohnehin schon alles dahinter wartet.
            if (werkbank === "home" && !reserviertFuer) {
              const seit = reservierungSeit.get(datei);
              if (!seit) {
                reservierungSeit.set(datei, Date.now());
                reserviertFuer = datei;
              } else if (Date.now() - seit < RESERVIERUNG_MS) {
                reserviertFuer = datei;
              } else {
                // Die Frist ist um. Uebersprungen, und der naechste Anlauf
                // faengt von vorn an.
                reservierungSeit.delete(datei);
                if (runde % 30 === 0) {
                  sag(datei + ": Reservierung nach fuenf Minuten aufgegeben -"
                    + " die anderen duerfen wieder.");
                }
              }
            }
            continue;
          }
          const weg = ausweichwirt(braucht);
          if (!weg) {
            werkzeugWartetGb = Math.max(werkzeugWartetGb, braucht);
            if (runde % 10 === 0) sag(datei + " (" + braucht.toFixed(1)
              + " GB) passt auf " + werkbank + " nie und findet auch sonst"
              + " nirgends Platz.");
            continue;
          }
          wirt = weg;
          // Auf dem Ausweichwirt selbst raeumen - der Block oben raeumt nur
          // die Werkbank.
          if (freiAuf(wirt) < braucht) {
            for (const w of ["worker/share.js", "worker/weaken.js", "worker/grow.js", "worker/hack.js"]) {
              if (freiAuf(wirt) >= braucht) break;
              if (!ns.ps(wirt).some((pr) => pr.filename === w)) continue;
              ns.scriptKill(w, wirt);
            }
          }
          if (freiAuf(wirt) < braucht) {
            if (runde % 10 === 0) sag(datei + ": Raeumen auf " + wirt
              + " brachte nur " + freiAuf(wirt).toFixed(1) + " von "
              + braucht.toFixed(1) + " GB.");
            continue;
          }
          sag(datei + " passt nicht auf " + werkbank + " (" + braucht.toFixed(1)
            + " GB) - weiche auf " + wirt + " aus.");
        }
        // Abhaengigkeiten mitkopieren. ns.scp nimmt nur, was man ihm nennt -
        // fehlt eine importierte Datei auf dem Zielrechner, laesst sich das
        // Skript dort nicht uebersetzen und ns.exec gibt still 0 zurueck. Kein
        // Absturz, keine Meldung, das Werkzeug fehlt einfach.
        //
        // `needsLibs` AUS DER REGISTRY (Skeptiker Runde 3, W4, 04.09.2026).
        //
        // Hier stand nur die feste Liste `BIBLIOTHEKEN` - eine einzige Datei,
        // lib/hackaugs.js. Jedes Gewerk auf der Werkbank, das etwas anderes
        // importiert, war damit auf gut Glueck unterwegs: graftauto.js braucht
        // lib/graftwahl.js und lib/figurns.js, figwatch.js braucht lib/figur.js,
        // blade.js seine blackops.json. Auf einem frisch gekauften Rechner
        // liegt nichts davon.
        //
        // Das Feld stand seit dem ersten Entwurf in der Registry und hatte
        // keinen Leser. Jetzt hat es einen - und es ist der Ort, an dem die
        // Angabe hingehoert: neben dem einzigen scp, das ein Gewerk je auf
        // einen Fremdrechner bringt.
        //
        // Transitiv wird NICHT aufgeloest: ein lib-Modul, das selbst
        // importiert, muss seine Abhaengigkeit im needsLibs des Gewerks stehen
        // haben. `tools/registry-bauen.js` prueft genau das gegen den
        // Quelltext, damit die Liste nicht auseinanderlaeuft.
        ns.scp([datei, ...BIBLIOTHEKEN, ...libs], wirt, "home");
        const pid = ns.exec(datei, wirt, 1, ...args);
        // Gestartet heisst: die Reservierung hat ihren Zweck erfuellt.
        if (pid) {
          reservierungSeit.delete(datei);
          einmalGestartet.set(datei, Date.now());
        }
        sag(pid ? datei + " laeuft auf " + wirt + " (pid " + pid + ")."
          : datei + " liess sich auf " + wirt + " nicht starten (exec gab 0).");
      }
    }

    // --- 3. home ausbauen -----------------------------------------------------
    // Der wichtigste Posten des Laufs. Anders als beim Augmentierungs-Einbau
    // wird home beim BitNode-Wechsel auf 32 GB und einen Kern zurueckgesetzt
    // (Prestige.ts:243-249) - der Ausbau aus BitNode 1 ist ersatzlos weg.
    // Solange home klein ist, passt kein richtiger Autopilot hinein.
    //
    // AMORTISATION (23.08.2026). Bis hierher war die einzige Bedingung
    // "Geld > Kosten mal drei" - der home-Ausbau war die einzige Ausgabe der
    // ganzen Kette ohne Pruefung, ob der Speicher ueberhaupt gebraucht wird.
    // Der Mietrechner-Ausbau vierzig Zeilen weiter oben hat all das.
    //
    // Was das gekostet hat: die letzten beiden Verdopplungen schlugen mit
    // rund 131 Bio zu Buche, das sind 167 Mio je GB. Ein Mietrechner kostet
    // auf derselben Sprosse 409.000 je GB - Faktor 409. Fuer dasselbe Geld
    // waere der 25er-Park siebenmal komplett zu maximieren gewesen.
    //
    // Zwei Bremsen, beide aus dem Bestand:
    //   - was bn4rep fuer verdiente Augmentierungen zurueckgelegt hat, ist
    //     tabu (data/geldbedarf.txt, dieselbe Quelle wie beim Serverkauf)
    //   - liegt mehr als ein Drittel des Netzes brach, wird nicht gekauft.
    //     Speicher, fuer den es keinen Abnehmer gibt, ist kein Engpass.
    // AUSGELAGERT nach src/homegrow.js (23.08.2026). Der Ausbau stand hier,
    // mit vier Singularity-Aufrufen - und genau die haben den Bot am
    // Knotenuebergang unbrauchbar gemacht: SF4Cost (RamCostGenerator.ts:82-96)
    // gibt den Rabatt NUR in BitNode 4, ausserhalb kostet jeder Aufruf das
    // Sechzehnfache. Die 9 GB Grundpreis dieser vier Aufrufe waeren draussen
    // 144 GB gewesen; bn4net.js waere von 16 auf 160 GB gesprungen und haette
    // in das frische home mit 32 GB (Prestige.ts:241-247) nicht mehr
    // hineingepasst. boot.js haette zwanzig Minuten gewartet und aufgegeben.
    //
    // Ohne Singularity bleibt diese Datei portabel. Der Ausbau laeuft als
    // Werkzeug auf der Werkbank weiter (WERKZEUGE, homegrow.js) - dort stoert
    // sein Preis nicht, und Singularity wirkt spielerweit, nicht
    // rechnergebunden. Der brachAnteil geht unten mit hinaus, weil homegrow
    // ihn fuer die Amortisationsbremse braucht und ihn selbst nicht kennt.
    const brachAnteil = ramTotal > 0 ? ueberschussMerker / ramTotal : 0;

    // --- 4. Zustand nach draussen ---------------------------------------------
    const gerootet = hosts.filter((h) => ns.hasRootAccess(h));
    ns.write("data/bn4net.json", JSON.stringify({
      zeit: Date.now(),
      runde,
      // --- Herzschlag v2 (Position C.1) ------------------------------------
      // Ein Block ohne errStreak und lastError gilt ab jetzt als UNGUELTIG und
      // damit als veraltet. Das ist zugleich die Migration: ein alter
      // Schreiber faellt auf, statt still weiterzulaufen.
      schema: 2,
      wall: Date.now(),
      playtime: mzPlaytime,
      motorTimeMs: mz.motorTimeMs,
      motorStunden: Number(mzStunden(mz).toFixed(4)),
      okRound: okRunden,
      errStreak,
      lastError,
      verworfeneRunden: mz.verworfeneRunden,
      letzterMzGrund: mz.letzterGrund,
      host: ns.getHostname(),
      // DIE PHASE GEHT MIT HINAUS (Skeptiker Runde 3, W6, 04.09.2026).
      //
      // Kern und Waechter hatten je eine eigene Phasendefinition: der Kern
      // zaehlt einen gekauften Rechner als "normal", der Waechter kennt den
      // Park nicht und sah bei home = 32 GB weiter "kaltstart". Mit gekauftem
      // Rechner UND kleinem home ueberwachte er damit genau die Gewerke, die
      // der Kern absichtlich nicht mehr startet - eine Fehlstrafe je Runde,
      // und false_penalty_count = 0 ist Abnahmebedingung.
      //
      // Zwei Definitionen fuer denselben Begriff sind nie zu synchronisieren.
      // Also gibt es nur noch eine: der Kern misst, der Waechter liest mit.
      phase: regLage.phase,
      state: "work",
      blockedReason: null,
      netz: hosts.length,
      gerootet: gerootet.length,
      // Feld "ziel" bedeutet weiterhin das BESTE Geldziel (bisheriger Name
      // bleibt, damit tools/bn4.js unveraendert lesbar ist). Seit Stufe 2
      // (22.08.2026) laufen mehrere Geldziele gleichzeitig - siehe zieleAnzahl.
      ziel: moneyTargets[0] ?? null,
      expZiel: expTarget,
      zieleAnzahl: moneyTargets.length,
      // Seit Stufe 4 (22.08.2026) gibt es echtes HWGW-Batching: versetzte,
      // absolut terminierte Landungen mit reserviertem Speicher. Wieviele
      // Ziele so gefahren werden, steht in data/batch-ziele.txt und kann ohne
      // Neustart geaendert werden - das ist die Voraussetzung dafuer, den
      // Umbau ueberhaupt gegen den einfachen Betrieb messen zu koennen.
      batchModus: batchTargets.length > 0,
      batchZiele: batchTargets,
      stapel: batchStat,
      // Was in dieser Runde je Aktion neu vergeben wurde, plus die Zahl der
      // Ziele in der Anlaufphase und der nicht vergebene Netzspeicher.
      mischung: mixStat,
      homeRam: ns.getServerMaxRam("home"),
      homeFrei: ns.getServerMaxRam("home") - ns.getServerUsedRam("home"),
      brachAnteil,
      reserve: reserveHome(),
      fehlstart,
      werkbank,
      // Seit Hebel 1 kein pauschaler Ausschluss mehr, sondern eine Zahl - und
      // eine Zahl gehoert nach draussen, sonst merkt niemand, wenn sie
      // davonlaeuft.
      werkbankReserve: Math.round(werkbankReserve),
      // Der Deckel ist seit dem 22.08.2026 kein fester Wert mehr, sondern
      // haengt am Netz. Eine Groesse, die sich von selbst bewegt, gehoert
      // nach draussen - sonst merkt niemand, wenn sie irgendwohin laeuft.
      shareFaeden: shareStand,
      vertraege,
      geld: ns.getServerMoneyAvailable("home"),
      hacking: ns.getHackingLevel(),
      // DIE KNOTENNUMMER GEHOERT HIERHER (28.08.2026, 17:18).
      //
      // Bisher stand sie nur in `data/knoten.json`, geschrieben von
      // `bn4rep.js`. Das ist voller Singularity-Aufrufe und deshalb
      // ausserhalb von BitNode 4 mehrere hundert Gigabyte gross
      // (`RamCostGenerator.ts:82-96` gibt den SF4-Rabatt nur dort) - auf
      // einem frischen home mit 32 GB laeuft es nicht. Genau deshalb war
      // `tools/strategie-check.js` nach dem Wechsel um 17:05 blind und
      // meldete elf Minuten lang "BitNode 6", obwohl der Knoten schon
      // gewechselt war.
      //
      // `getResetInfo` kostet 1 GB (`RamCostGenerator.ts:664`) und
      // ist in jedem Knoten ab der ersten Sekunde verfuegbar. bn4net.js ist
      // das einzige Skript, das `boot.js` sofort startet - damit ist das die
      // frueheste und verlaesslichste Quelle, die es gibt.
      knoten: ns.getResetInfo().currentNode,
      nodeReset: ns.getResetInfo().lastNodeReset,
      // Feature 9 fuer strategie-check, das die Registry ausserhalb des
      // Spiels auswertet und ownedSF nicht sieht (19.09.2026).
      feature9: !!(regLage.features && regLage.features[9]),
      // DIE KAMPFWERTE GEHOEREN AUCH HIERHER (28.08.2026, 19:10).
      //
      // In BitNode 10 traegt der Knoten ueber Bladeburner
      // (`nodes/KURS.md`, Eintrag 18:55), und das erste Tor ist der Beitritt:
      // alle vier Kampfwerte >= 100. Die Zahl stand bisher nur in
      // `data/bblage.json`, geschrieben von `bblage.js` - einem
      // Bladeburner-Werkzeug, das ohne Division nichts liefert. Genau in der
      // Phase VOR dem Beitritt war der Traeger des Knotens also unsichtbar,
      // und `tools/strategie-check.js` meldete ersatzweise "Hacking-Weg".
      //
      // `getPlayer` kostet 0,5 GB (`RamCostGenerator.ts`) und ist in jedem
      // Knoten verfuegbar. Dieselbe Ueberlegung wie bei der Knotennummer:
      // Die Quelle muss das Skript sein, das nach jedem Wechsel als erstes
      // laeuft.
      kampf: (() => {
        try {
          const sk = ns.getPlayer().skills;
          return { str: sk.strength, def: sk.defense,
            dex: sk.dexterity, agi: sk.agility };
        } catch { return null; }
      })(),
    }), "w");

    // --- 9a. Der Figur-Vergabepunkt (Position C.11) ---------------------------
    //
    // WARUM DIE ENTSCHEIDUNG IM KERN LIEGT.
    //
    // Es gibt genau EINE Spielfigur, und sechs Gewerke wollen sie: bn4rep
    // (Faktion und Firma), blade (Bladeburner), bbtrain (Gym), bn4life
    // (Verbrechen, Programme), graft und kampfaugs. Ohne Schiedsrichter
    // gewinnt, wer zuletzt schreibt - und `singularity.commitCrime` bricht
    // einen laufenden Graft wortlos ab. Ein Graft kostet bis zu 14,63 Mrd und
    // ist erst mit dem letzten Prozent etwas wert; ein abgebrochener ist
    // vollstaendig verloren.
    //
    // Der Kern ist der Schiedsrichter, weil er als einziger alles sieht. Er
    // fuehrt die Handlung NICHT aus - er schreibt nur, wer darf. Jedes Gewerk
    // legt seinen Antrag in einer eigenen Datei ab (kein gemeinsamer
    // Schreibzugriff, kein Rennen), und der Kern legt das Ergebnis in
    // data/figure.txt.
    //
    // Kostet nichts: nur Dateien lesen und schreiben.
    {
      const jetztF = Date.now();
      let nodeResetF = 0;
      try { nodeResetF = ns.getResetInfo().lastNodeReset; } catch { /* egal */ }

      // Die Antraege einsammeln. Ein Gewerk, das nicht laeuft, hat keinen -
      // seine alte Datei laeuft ueber die TTL von einer Minute ab.
      //
      // GESUCHT WIRD UEBER DAS DATEIMUSTER, NICHT UEBER DIE WERKZEUGLISTE.
      // Zwei der sechs figurfaehigen Gewerke stehen gar nicht in der Registry
      // (graft.js und kampfaugs.js werden von bn4life.js bzw. von Hand
      // gestartet). Wer nur die Werkzeugliste abfragt, uebersieht ausgerechnet
      // das Gewerk mit dem groessten Einzelrisiko - ein abgebrochener Graft
      // kostet bis zu 14,63 Mrd. `ns.ls` kostet 0,2 GB und ist im Kern
      // ohnehin bezahlt.
      const antraege = [];
      for (const d of ns.ls("home", "figure-request-")) {
        try {
          const a = JSON.parse(ns.read(d));
          if (figAntragGilt(a, jetztF, nodeResetF)) antraege.push(a);
        } catch { /* unlesbarer Antrag zaehlt nicht */ }
      }

      let bisher = null;
      try {
        if (ns.fileExists("data/figure.txt", "home")) {
          bisher = JSON.parse(ns.read("data/figure.txt"));
        }
      } catch { bisher = null; }

      // WER NICHT MEHR LAEUFT, HAELT AUCH NICHTS (Skeptiker Runde 3, W9).
      //
      // Der Kern kennt die laufenden Prozesse ohnehin - er verwaltet sie. Die
      // Auskunft wird hier hereingereicht, damit eine Lease nach einem Absturz
      // oder einem Speicherverdraengen sofort frei wird statt erst nach 15
      // Minuten (bei einem Graft: nach zwei Stunden).
      //
      // Gesucht wird ueber ALLE Wirte, nicht nur home: die figurberuehrenden
      // Gewerke laufen ueberwiegend auf der Werkbank.
      const lebendig = new Set();
      try {
        for (const h of hosts) for (const p of ns.ps(h)) lebendig.add(p.filename);
      } catch { /* dann ohne Lebendpruefung - alte Regel gilt weiter */ }
      const lebt = lebendig.size ? (t) => lebendig.has(t) : undefined;

      const e = figVergib(antraege, bisher, jetztF, nodeResetF, lebt);
      if (e.wechsel || !figVergabeGilt(bisher, jetztF, nodeResetF)) {
        sag("Figur: " + (e.vergabe ? e.vergabe.owner + " -> " + e.vergabe.action : "frei")
          + " (" + e.grund + ", " + antraege.length + " Antrag/Antraege)");
      }
      // AUCH DIE LEERE VERGABE WIRD GESCHRIEBEN. Sonst bliebe die letzte
      // gueltige Datei stehen, und ein Gewerk, das seinen Antrag laengst
      // zurueckgezogen hat, haelt sich weiter fuer berechtigt.
      ns.write("data/figure.txt",
        JSON.stringify(e.vergabe || { owner: null, action: null, seq:
          (bisher && Number.isFinite(bisher.seq) ? bisher.seq : 0) + 1,
          wall: jetztF, nodeReset: nodeResetF, leaseBis: 0 }), "w");
    }

    // --- 9c. Auftraege des Waechters ausfuehren (Sprosse 5, Position C.12) ----
    //
    // WARUM DER KERN DAS TUT UND NICHT DER WAECHTER.
    //
    // `installAugmentations` ist `SingularityFn3` und kostet bei SF4.1 achtzig
    // Gigabyte. Der Waechter hat sechs - er KANN Sprosse 5 nicht ausfuehren.
    // Also beauftragt er, und der Kern startet `punish.js` auf einem Wirt, der
    // gross genug ist.
    //
    // WAS DER KERN PRUEFT UND WAS NICHT. Er prueft NICHT die acht
    // Vorbedingungen - das tut `punish.js` selbst, und zwar am Zustand des
    // Augenblicks, in dem es laeuft. Zwischen Auftrag und Ausfuehrung koennen
    // Minuten liegen, in denen `ausgang.json.offen` umschlaegt oder ein Graft
    // beginnt; eine Kopie der Bedingungen hier waere eine zweite Wahrheit, die
    // irgendwann auseinanderlaeuft.
    //
    // Er prueft dagegen sehr wohl, ob der AUFTRAG gilt: frisch (der Waechter
    // laesst ihn nach 15 min verfallen, der Kern nimmt nur, was juenger ist),
    // aus DIESEM Knoten, und noch nicht ausgefuehrt.
    //
    // UND ER LAEUFT TROCKEN, solange `data/punish-scharf.txt` fehlt. Das ist
    // der Beleg, den der Auftrag verlangt: erst ein protokollierter
    // Trockenlauf, dann die Schaerfe. Die Datei legt ein Mensch an.
    {
      try {
        const w = ns.fileExists("data/watchdog.json", "home")
          ? JSON.parse(ns.read("data/watchdog.json")) : null;
        const orders = w && Array.isArray(w.orders) ? w.orders : [];
        for (const o of orders) {
          if (!o || o.sprosse !== 5 || o.skript !== "punish.js") continue;
          if (!Number.isFinite(o.gestellt) || Date.now() - o.gestellt > 15 * 60000) continue;
          // AUS DIESEM KNOTEN (Skeptiker Runde 4, R18, 04.09.2026).
          //
          // Der Kommentar oben behauptete diese Pruefung, den Code gab es
          // nicht - und der Auftrag trug kein `nodeReset`, mit dem eine
          // moeglich gewesen waere. `data/watchdog.json` ueberlebt beide
          // Prestiges (Textdateien auf home tun das), boot.js raeumt sie
          // nicht, und `auftraegeGetan` ist nach dem Sprung leer. Ein zwei
          // Minuten alter Auftrag haette also im FRISCHEN Knoten einen
          // Augmentierungs-Einbau ausgeloest, mitten im Kaltstart.
          if (Number.isFinite(o.nodeReset)
              && o.nodeReset !== ns.getResetInfo().lastNodeReset) continue;
          const schluessel = "s5-" + o.gestellt;
          if (auftraegeGetan.has(schluessel)) continue;
          // AUF ALLEN WIRTEN SUCHEN (R26): gestartet wird punish.js auf dem
          // Rechner mit dem meisten Platz, nicht auf home. Eine Sperre, die
          // nur home ansieht, laesst einen zweiten Einbau zu - und der waere
          // ein weggeworfener Lauf.
          if (hosts.some((h) => {
            try { return ns.ps(h).some((p) => p.filename === "punish.js"); }
            catch { return false; }
          })) break;

          if (!ns.fileExists("punish.js", "home")) {
            sag("Waechterauftrag Sprosse 5, aber punish.js liegt nicht auf home.");
            auftraegeGetan.add(schluessel);
            break;
          }
          const scharf = ns.fileExists("data/punish-scharf.txt", "home");
          const braucht = ns.getScriptRam("punish.js", "home");
          // Eigene Platzrechnung. `freiAuf` aus dem Werkzeugstarter ist hier
          // NICHT sichtbar - es steht in dessen Block, und der ReferenceError
          // waere von dem try/catch drumherum stillschweigend geschluckt
          // worden. Gefunden von tools/test-sprosse5-kette.js, das genau
          // deshalb existiert.
          const freiHier = (h) => ns.getServerMaxRam(h) - ns.getServerUsedRam(h);
          // Den groessten Wirt suchen. punish.js kostet bei SF4.1 83,35 GB
          // (in BitNode 4 nur 8,35) - das passt auf home erst nach dem Ausbau
          // und auf die Werkbank fast immer.
          let wirt = null;
          let meist = -Infinity;
          for (const h of hosts) {
            if (!ns.hasRootAccess(h)) continue;
            const f = freiHier(h);
            if (f > meist) { meist = f; wirt = h; }
          }
          if (!wirt || !(braucht > 0) || meist < braucht) {
            // Gedrosselt wie jede andere wiederkehrende Meldung im Kern
            // (R26): im Kaltstart passt punish.js mit 83 GB fuenfzehn Minuten
            // lang nicht, und diese Zeile stand in JEDER Runde im Log.
            if (runde % 10 === 0) {
              sag("Waechterauftrag Sprosse 5: punish.js (" + braucht.toFixed(1)
                + " GB) passt auf keinen Wirt (bester: "
                + (Number.isFinite(meist) ? meist.toFixed(1) : "?") + " GB).");
            }
            break;   // NICHT abhaken - beim naechsten Mal kann Platz sein
          }
          // `lib/handschlag.js` MUSS MIT (04.09.2026). punish.js steht nicht
          // in der Registry - der Kern startet es unmittelbar -, also greift
          // die needsLibs-Pruefung des Generators hier nicht. Fehlt die
          // Bibliothek auf dem Wirt, gibt `ns.exec` still 0 zurueck, und
          // Sprosse 5 waere gebaut, verdrahtet, getestet und trotzdem tot.
          if (wirt !== "home") {
            ns.scp(["punish.js", "lib/handschlag.js", ...BIBLIOTHEKEN], wirt, "home");
          }
          const pid = scharf
            ? ns.exec("punish.js", wirt, 1, "scharf")
            : ns.exec("punish.js", wirt, 1);
          auftraegeGetan.add(schluessel);
          sag("Waechterauftrag Sprosse 5 ausgefuehrt: punish.js auf " + wirt
            + (scharf ? " SCHARF" : " im Trockenlauf")
            + (pid ? " (pid " + pid + ")." : " - exec gab 0."));
          break;   // hoechstens ein Auftrag je Runde
        }
      } catch (e) {
        // NICHT STILL SCHLUCKEN. Dieses catch hat beim ersten Anlauf einen
        // ReferenceError verborgen (`freiAuf` war ausserhalb seines Blocks
        // benutzt), und der Zweig lief wochenlang nicht - ohne eine Zeile
        // irgendwo. Genau die Fehlerklasse, gegen die der ganze Umbau steht.
        //
        // Ein fehlender Waechter ist trotzdem kein Fehler: dann gibt es
        // watchdog.json nicht, `fileExists` sagt nein, und wir kommen hier gar
        // nicht an. Was hier ankommt, ist echt.
        if (runde % 10 === 0) {
          sag("Waechterauftrag nicht auswertbar: "
            + String(e && e.message ? e.message : e));
        }
      }
    }

    // --- 9b. Die Kennzahlentafel ----------------------------------------------
    //
    // WARUM DER KERN SIE SCHREIBT (Position C.1, 04.09.2026).
    //
    // `data/kpi.json` ist die einzige Datei, die S2 (kein Fortschritt) und
    // `tools/checkin.js` lesen. Bis hierher schrieb sie NIEMAND: `lib/kpi.js`
    // definierte den Kontrakt, und kein Skript importierte ihn. S2 war damit
    // strukturell tot - der Waechter konnte einen stehenden Bot nicht von
    // einem laufenden unterscheiden (Skeptiker Fehlermodi, Befund 14).
    //
    // Der Kern ist der richtige Ort, weil er die Zahlen ohnehin hat: er
    // rechnet den Brachanteil, fuehrt die Motorzeit, liest die Telemetrie
    // aller Werkzeuge und kennt Knoten und Rolle. Kein einziger zusaetzlicher
    // ns-Aufruf.
    //
    // WAS ER NICHT FUELLT, BLEIBT null. Das ist ausdruecklich erlaubt
    // (ARCHITEKTUR 5.1) und besser als eine geratene Zahl: `checkin.js`
    // meldet ein fehlendes Feld, eine erfundene Zahl meldet niemand.
    // DER EREIGNISSTROM BEKOMMT ENDLICH SCHREIBER (04.09.2026).
    //
    // `lib/events.js` war importiert und wurde nie benutzt - eine tote
    // Einfuhrzeile. Geschrieben haben in `data/events.json` nur boerse.js,
    // figwatch.js und graftauto.js, und die alle mit der Art "note".
    //
    // Die Arten `jump`, `install`, `boot` und `penalty` schrieb NIEMAND. Genau
    // aus ihnen rechnen sich aber drei Abnahmekennzahlen, und alle drei sind
    // Abstaende zwischen Ereignissen, also aus der Telemetrie prinzipiell
    // nicht rekonstruierbar:
    //   jump_latency_min          (jump -> boot, Soll <= 2)
    //   boot_latency_min          (boot -> erste volle Runde, Soll <= 5)
    //   ladder_rungs_ge3_per_week (penalty ab Sprosse 3, Soll 0)
    //
    // Ohne Schreiber waren sie nicht "noch nicht gemessen", sondern
    // unmessbar - und Stufe C verlangt einen beobachteten Sprung.
    //
    // Kein zusaetzlicher ns-Aufruf: read, write und fileExists stehen ohnehin
    // im Budget des Kerns. Die Datei bleibt durch den Ringpuffer in
    // `lib/events.js` gedeckelt.
    const ereignis = (art, text, daten = null) => {
      try {
        const strom = evLaden(ns.fileExists("data/events.json", "home")
          ? ns.read("data/events.json") : null);
        evAnhaengen(strom, art, text, {
          wall: Date.now(),
          playtime: mzPlaytime,
          motorTimeMs: mz.motorTimeMs,
        }, daten);
        ns.write("data/events.json", JSON.stringify(strom), "w");
      } catch { /* der Strom ist Bericht, nie Steuerung - nie die Runde kippen */ }
    };

    // Die Ereignisse, die nur der Kern sieht. Alle drei feuern hoechstens
    // einmal je Lauf beziehungsweise Prozessleben - deshalb die Merker.
    {
      const ri0 = ns.getResetInfo();
      const knotenJetzt = ri0.currentNode;
      const nrJetzt = ri0.lastNodeReset || 0;
      const arJetzt = ri0.lastAugReset || 0;
      if (evMerker.nodeReset === null) {
        // Der erste Durchlauf dieses Prozesses. Er ist der Bootvorgang - und
        // der Abstand zum letzten `jump` ist jump_latency_min.
        evMerker.nodeReset = nrJetzt;
        evMerker.augReset = arJetzt;
        evMerker.bootWall = Date.now();
        ereignis("boot", "Kern gestartet in BitNode " + knotenJetzt,
          { node: knotenJetzt, verfahren: regLage.verfahren });

        // DIE SPRUNGDAUER WIRD HIER EINGEFROREN (Skeptiker Runde 4, R13).
        //
        // `abstandMin(strom, "jump", "boot")` nimmt das JUENGSTE `boot`, und
        // `boot` entsteht einmal je PROZESSLEBEN, nicht einmal je Sprung.
        // Jeder Kernneustart im Knoten - Sprosse 1, Sprosse 3, boot.js nach
        // einer Wartezeit - setzte die Kennzahl damit auf "Zeit seit dem
        // Sprung". Gerechnet: 1,50 min direkt nach dem Sprung, 540 min nach
        // einem Neustart neun Stunden spaeter. Soll ist <= 2.
        //
        // Der Wert gehoert also genau EINMAL gemessen: beim ersten Bootvorgang
        // nach einem Sprung, gegen den letzten `jump`. Danach steht er fest.
        try {
          const strom = evLaden(ns.fileExists("data/events.json", "home")
            ? ns.read("data/events.json") : null);
          const letzterSprung = [...strom.eintraege].reverse()
            .find((e) => e.art === "jump");
          // Nur, wenn der Sprung NACH dem letzten Knotenreset liegt bzw. kurz
          // davor - ein `jump` aus einem frueheren Knoten misst nichts.
          if (letzterSprung && Number.isFinite(letzterSprung.wall)
              && evMerker.bootWall - letzterSprung.wall >= 0
              && evMerker.bootWall - letzterSprung.wall < 6 * 3600000) {
            evMerker.jumpLatencyMin =
              Number(((evMerker.bootWall - letzterSprung.wall) / 60000).toFixed(2));
          }
        } catch { /* kein Strom - dann bleibt die Zahl ungemessen */ }
      } else {
        // Ein Reset MITTEN im Prozessleben kann es nicht geben - beide
        // Prestiges toeten alle Skripte (prestigeWorkerScripts). Wenn die
        // Zahlen sich trotzdem aendern, ist das ein Befund und gehoert in den
        // Strom.
        if (nrJetzt !== evMerker.nodeReset) {
          ereignis("jump", "Knotenreset ohne Prozessende - in BitNode " + knotenJetzt,
            { node: knotenJetzt, vorher: evMerker.nodeReset });
          evMerker.nodeReset = nrJetzt;
        }
        if (arJetzt !== evMerker.augReset) {
          ereignis("install", "Augmentierungs-Reset ohne Prozessende",
            { node: knotenJetzt });
          evMerker.augReset = arJetzt;
        }
      }
    }

    const schreibeKpi = () => {
      const jetzt = Date.now();
      const ri = ns.getResetInfo();

      // Vorhandene Tafel laden und, wenn der Knoten gewechselt hat, auf einen
      // neuen Lauf setzen. `neuerLauf` behaelt die Felder der Klasse "lauf"
      // und nullt den Rest - Kennzahlen des alten Knotens im neuen zu fuehren
      // waere schlimmer als gar keine.
      let k;
      const geladen = kpiLaden(
        ns.fileExists("data/kpi.json", "home") ? ns.read("data/kpi.json") : null,
        ri.lastNodeReset);
      if (geladen.schreibsperre) {
        // Die Datei stammt von einer NEUEREN Fassung als dieser Code. Dann
        // wird nicht geschrieben: ein Rueckschritt im Schema zerstoert Felder,
        // die der neuere Schreiber fuehrt.
        if (runde % 60 === 0) sag("kpi.json: " + geladen.befund + " - nicht geschrieben.");
        return;
      }
      k = geladen.kpi || kpiLeer(jetzt);
      if (k.nodeReset !== ri.lastNodeReset) k = kpiNeuerLauf(k, ri.lastNodeReset);

      // --- Zuordnung zum Lauf ------------------------------------------------
      k.version = KPI_VERSION;
      k.nodeReset = ri.lastNodeReset;
      k.augReset = ri.lastAugReset;
      k.node = ri.currentNode;
      k.verfahren = regLage.verfahren;
      k.motorTimeSinceNodeMs = mz.motorTimeMs;

      // --- `negative_balance_min` (R11) ---------------------------------------
      //
      // Soll 0, und der Zaehler hatte keinen Schreiber. Der Kern kennt den
      // Kontostand ohnehin (er entscheidet ueber jeden Kauf damit), also
      // zaehlt er die Minuten unter null selbst.
      //
      // Dass die Zahl in diesem Spiel meist 0 bleibt, ist kein Grund, sie
      // nicht zu fuehren: ein negativer Stand entsteht sehr wohl - `hacknet`
      // und `cloud`-Kaeufe pruefen vorher, `singularity`-Kaeufe nicht immer -,
      // und eine gemessene 0 ist etwas anderes als eine behauptete.
      {
        const geldJetzt = ns.getServerMoneyAvailable("home");
        const vorher = Number.isFinite(k.negative_balance_min) ? k.negative_balance_min : 0;
        const dMin = Number.isFinite(mzErgebnis.deltaMs)
          ? Math.min(mzErgebnis.deltaMs, 120000) / 60000 : 0;
        k.negative_balance_min = Number((vorher + (geldJetzt < 0 ? dMin : 0)).toFixed(2));
      }

      // --- Effizienz ---------------------------------------------------------
      // Brachanteil ist das Gegenstueck zu idle_ram_pct: der Kern rechnet ihn
      // ohnehin fuer die Zielauswahl.
      if (Number.isFinite(brachAnteil)) {
        k.idle_ram_pct = Number((brachAnteil * 100).toFixed(1));
      }
      // Rundenrate: die einzige Zahl, die verraet, wie stark der Tab gedrosselt
      // ist. Ohne Patch ist sie 1 (belegt: ein verdeckter Tab bekommt genau
      // einen Zeitgeber je Minute, und das ist ein Deckel, keine Quote).
      //
      // Die Quelle ist der ZULETZT GEZAEHLTE Abstand aus dem Motorzeitzaehler,
      // nicht der Sollwert TAKT_MS: gerade wenn gedrosselt wird, laufen die
      // beiden auseinander - und genau diese Differenz ist die Aussage.
      if (Number.isFinite(mzErgebnis.deltaMs) && mzErgebnis.deltaMs > 0) {
        k.throttle_rounds_per_min = Number((60000 / mzErgebnis.deltaMs).toFixed(2));
      }

      // --- Der Traeger --------------------------------------------------------
      //
      // Die Leitgroesse haengt am Verfahren: auf dem Hackingweg das Level, auf
      // dem Bladeburner-Weg der Rang. Den Rang rechnet der Kern NICHT - er
      // liest ihn aus data/blade.json. `ns.bladeburner.getRank` kostet 4 GB
      // und spraengte das Kaltstart-Budget fuer eine Zahl, die ein anderes
      // Gewerk ohnehin schreibt.
      let traeger = null;
      if (regLage.verfahren === "V2") {
        try {
          const b = JSON.parse(ns.read("data/blade.json"));
          if (b && Number.isFinite(b.rang)) {
            // Der Traeger ist der Augenblicksrang - und dazu die BUCHUNG des
            // letzten gewollten Black-Op-Fehlversuchs (06.09.2026). Eine erste
            // Fassung nahm den Hochstand als Traeger; drei Skeptiker fanden,
            // dass das S2 blind fuer echten Rueckschritt macht. Jetzt reicht
            // der Kern `fehlversuch` durch, und der Waechter rechnet den
            // Verlust auf seinen Vergleichspunkt an. Nur uebernehmen, wenn
            // blade.json frisch ist (10 min wie TELEMETRIE_FEST) - ein alter
            // Wert aus dem vorigen Lauf ist kein Traeger.
            const frisch = Number.isFinite(b.zeit) && Date.now() - b.zeit < 10 * 60000;
            // UND AUS DIESEM KNOTEN (11.09.2026). Zehn Minuten nach dem Sprung
            // BN10 -> BN4 war blade.json aus BN10 noch "frisch" und lieferte
            // Rang 444.908 als Traeger; der Waechter setzte darauf seinen
            // Vergleichspunkt und meldete danach den ganzen Knoten lang S2.
            // Eine Datei ohne Stempel (Altbestand) gilt als fremd - lieber
            // zehn Minuten ohne Traeger als ein Knoten mit dem falschen.
            const ausDiesemKnoten = Number.isFinite(b.nodeReset)
              && b.nodeReset === mzNodeReset;
            if (frisch && ausDiesemKnoten) {
              traeger = { name: "rang", wert: b.rang, motorTimeMs: mz.motorTimeMs,
                fehlversuch: b.fehlversuch && Number.isFinite(b.fehlversuch.verlust)
                  ? { wall: b.fehlversuch.wall, verlust: b.fehlversuch.verlust } : null,
                // Und ob blade.js gerade Chaos abbaut (11.09.2026): Diplomacy
                // gibt null Rang, und der Waechter darf das nicht fuer
                // Stillstand halten. Nur durchreichen - entscheiden tut leiter.js.
                aufraeumen: b.aufraeumen === true };
            }
          }
          // NEXT_BLACKOP_CHANCE (04.09.2026) - der letzte Kennwert mit einem
          // Soll, der keinen Schreiber hatte.
          //
          // Gerechnet wird er nicht hier: `blade.js` fuehrt in `boChancen`
          // eine Tabelle Name -> Chance, aus den Gewichten gerechnet statt
          // aus `getActionEstimatedSuccessChance` (die liefert fuer Black Ops
          // einen Bereich, dessen eine Grenze verzerrt ist). Hier wird nur
          // der Eintrag der NAECHSTEN Operation herausgegriffen.
          //
          // Bleibt `null`, solange keine Operation freigeschaltet ist - und
          // das ist richtig so: der Auftrag laesst die Bedingung ausdruecklich
          // erst gelten, wenn `getNextBlackOp()` etwas liefert (erste Op bei
          // 2.500 Rang). Bis dahin treten rank_rate und chaos_city an ihre
          // Stelle. `null` heisst "nicht gezaehlt", nicht "null Prozent".
          if (b && b.naechsteBlackOp && b.boChancen
              && Number.isFinite(b.boChancen[b.naechsteBlackOp])) {
            k.next_blackop_chance = +b.boChancen[b.naechsteBlackOp].toFixed(3);
          }
        } catch { /* kein blade.json - dann kein Traeger */ }
      }
      if (!traeger) {
        traeger = { name: "hacking", wert: ns.getHackingLevel(),
          motorTimeMs: mz.motorTimeMs };
      }
      k.traeger = traeger;

      // --- Was andere Gewerke schon geschrieben haben --------------------------
      //
      // GELESEN, NICHT GERECHNET. Route und Restzeit stehen in ausgang.json;
      // sie hier zweitzurechnen hiesse, zwei Wahrheiten zu fuehren.
      try {
        const a = JSON.parse(ns.read("data/ausgang.json"));
        if (a) {
          // `wirt_fehlt_count` (R11): ausgang.js rechnet den Fall ohnehin -
          // exit.js passt auf keinen Rechner. Der Zaehler stand auf 0 und
          // hatte keinen Schreiber; jetzt zaehlt der Kern die Runden, in denen
          // der Befund steht.
          if (a.wirtFehlt) {
            k.wirt_fehlt_count = (Number.isFinite(k.wirt_fehlt_count)
              ? k.wirt_fehlt_count : 0) + 1;
          } else if (!Number.isFinite(k.wirt_fehlt_count) && a.offen === false) {
            // Ein geschlossener Ausgang ohne Wirtproblem ist eine echte
            // Messung: null Mal aufgetreten.
            k.wirt_fehlt_count = 0;
          }
          // `skipped_route_entries` (R11): ausgang.js fuehrt die Liste der
          // uebersprungenen Routeneintraege ohnehin mit. Soll ist 0 - ein
          // uebersprungener Eintrag heisst, dass ein Knoten nicht in der
          // geplanten Stufe gespielt wurde.
          if (Array.isArray(a.uebersprungen)) {
            k.skipped_route_entries = a.uebersprungen.length;
          }
          if (typeof a.route_state === "string") k.route_state = a.route_state;
          if (a.eta_min === null || Number.isFinite(a.eta_min)) k.eta_min = a.eta_min;
          if (typeof a.eta_sicher === "boolean") k.eta_sicher = a.eta_sicher;
          if (Number.isFinite(a.lauf)) k.level = a.lauf;
        }
      } catch { /* noch kein ausgang.json */ }

      // Der Zustand der Strafleiter - erste Zeile jedes Berichts.
      try {
        const w = JSON.parse(ns.read("data/watchdog.json"));
        // FEHLSTRAFEN (Skeptiker Runde 4, R11). Der Waechter zaehlt sie, der
        // Kern schreibt die Tafel - so bleibt kpi.json bei einem Schreiber.
        // `null` bleibt `null`: ein Waechter, der nicht laeuft, hat nicht
        // "null Fehlstrafen", sondern gar nicht gezaehlt.
        if (w && Number.isFinite(w.false_kill_count)) {
          k.false_kill_count = w.false_kill_count;
        }
        if (w && Number.isFinite(w.false_penalty_count)) {
          k.false_penalty_count = w.false_penalty_count;
        }
        if (w && w.ziele) {
          const ersch = Object.entries(w.ziele)
            .find(([, z]) => z && z.zustand === "EXHAUSTED");
          k.exhausted = ersch
            ? { since: ersch[1].seit, lastRung: ersch[1].sprosse, signal: ersch[0] }
            : null;
        }
      } catch { /* kein Waechter - dann bleibt der letzte Stand stehen */ }

      // Alter der letzten Sicherung, damit der Bericht es nennen kann.
      //
      // DAS FELD HIESS NIE SO (04.09.2026, 20:35 - Skeptiker). Hier stand
      // `br.letzteSicherungTs` - die Bruecke schreibt das nirgends. Sie
      // schreibt `lastVerifiedBackup: {file, ts, ageMin, anlass}` mit `ts`
      // als ISO-String. `Number.isFinite` darauf ist falsch, also wurde
      // `backup_age_h` NIE gesetzt: der Kennwert stand seit jeher auf null,
      // und der catch hat es verschluckt.
      //
      // Das ist die dritte Fundstelle desselben Irrtums an einem Tag -
      // `export.js` und `lib/handschlag.js` lasen dieselbe Datei ebenfalls
      // ueber ein Feld, das es nicht gibt. Wenn ein Vertrag dreimal falsch
      // gelesen wird, ist nicht der Leser das Problem.
      try {
        const br = JSON.parse(ns.read("data/bridge.json"));
        const lv = br && br.lastVerifiedBackup;
        const ts = lv && (Number.isFinite(lv.ts) ? lv.ts : Date.parse(lv.ts));
        if (Number.isFinite(ts) && jetzt - ts >= 0) {
          k.backup_age_h = Number(((jetzt - ts) / 3600000).toFixed(2));
        }
      } catch { /* keine Brueckenmeldung */ }

      // --- Das Zaehlwerk der Registry -----------------------------------------
      if (regGeladen) {
        try {
          k.registry = regZaehlwerk(regGeladen, regLage,
            (e) => laufend.includes(e.name),
            // Frisch heisst: die Telemetriedatei ist juenger als die Frist des
            // Eintrags. Ohne Telemetriedatei gibt es nichts zu pruefen - das
            // gilt als frisch, nicht als degradiert (sonst zaehlte jedes
            // gewachsene Werkzeug ohne Herzschlag als angeschlagen).
            (e) => {
              if (!e.telemetryFile) return true;
              try {
                if (!ns.fileExists(e.telemetryFile, "home")) return false;
                const d = JSON.parse(ns.read(e.telemetryFile));
                const w = [d.zeit, d.ts, d.wall].find((x) => Number.isFinite(x));
                return Number.isFinite(w) && jetzt - w <= (e.freshnessMs || 600000);
              } catch { return false; }
            });
        } catch { /* dann bleibt das alte Zaehlwerk stehen */ }
      }

      // --- Die drei Kennzahlen aus dem Ereignisstrom ---------------------------
      //
      // Sie sind Abstaende zwischen Ereignissen und lassen sich aus keiner
      // Telemetrie rekonstruieren - der naechste Schreibvorgang ueberschreibt
      // sie. Bis zum 04.09.2026 hatte der Strom fuer diese drei Arten keinen
      // Schreiber, die Felder blieben also dauerhaft null. Jetzt hat er einen
      // (Abschnitt oben und guard.js), und hier werden sie ausgewertet.
      //
      // ALLE DREI IN WANDUHR (ARCHITEKTUR 4.2): sie messen, wie lange der Bot
      // brauchte, nicht wie lange er arbeitete. Eine Offline-Nacht mitten im
      // Sprung ist genau das - drei Stunden ohne Bot.
      try {
        const strom = evLaden(ns.fileExists("data/events.json", "home")
          ? ns.read("data/events.json") : null);

        // Beide Zahlen sind beim Bootvorgang eingefroren worden und werden
        // hier nur uebernommen (R13, R14). Sie einmal je Runde neu zu rechnen
        // hiesse, sie mit jedem Kernneustart zu verfaelschen.
        if (Number.isFinite(evMerker.jumpLatencyMin)) {
          k.jump_latency_min = evMerker.jumpLatencyMin;
        }
        if (Number.isFinite(evMerker.bootLatencyMin)) {
          k.boot_latency_min = evMerker.bootLatencyMin;
        }

        // Sprossen ab 3 in den letzten sieben Tagen. Der Deckel des
        // Ringpuffers (60 bleibende Eintraege) kann die Zahl nur nach UNTEN
        // verfaelschen - bei Soll 0 ist das die harmlose Richtung, und ein
        // Ueberlauf faellt an den 60 selbst auf.
        const woche = jetzt - 7 * 24 * 3600000;
        k.ladder_rungs_ge3_per_week = strom.eintraege.filter((e) =>
          e.art === "penalty" && Number.isFinite(e.wall) && e.wall >= woche).length;

        // `queued_augs_at_jump` (R11): wie viele gekaufte, nicht eingebaute
        // Augmentierungen beim letzten Sprung offen waren. Sie verfallen dabei
        // ersatzlos - Soll ist 0. `bn4rep.js` fuehrt die Zahl in
        // data/einbau.json, und der `jump`-Eintrag traegt sie seit heute mit.
        const letzterSprung = [...strom.eintraege].reverse()
          .find((e) => e.art === "jump");
        if (letzterSprung && letzterSprung.daten
            && Number.isFinite(letzterSprung.daten.wartendeAugs)) {
          k.queued_augs_at_jump = letzterSprung.daten.wartendeAugs;
        }
      } catch { /* kein Strom - dann bleiben die Felder, wie sie waren */ }

      // --- Die stumme Vertragskette (R27) -------------------------------------
      //
      // Beide Vertragsgewerke fuehren `stummeRunden`: Durchlaeufe in Folge, in
      // denen Vertraege gefunden und keiner geloest wurde. Genommen wird das
      // MAXIMUM beider - es geht um die Frage "klemmt irgendwo eine Gegenprobe",
      // und dafuer genuegt eines von beiden.
      //
      // Die Zahl bleibt null, wenn keines der beiden laeuft. Das ist richtig so:
      // `null` heisst in dieser Datei seit R11 "nicht gezaehlt", und ein Gewerk,
      // das gar nicht laeuft, kann nicht stumm sein - dafuer ist S1 zustaendig.
      try {
        let stumm = null;
        for (const datei of ["data/cdump-stand.json", "data/contracts.json"]) {
          if (!ns.fileExists(datei, "home")) continue;
          const d = JSON.parse(ns.read(datei));
          // ALTERSPRUEFUNG (Skeptiker Runde 5, B2). Ohne sie friert ein
          // einziger Klemmzustand die Zahl fuer immer ein: `cdump.js` laeuft
          // nur im Kaltstart, und nach dem ersten gekauften Rechner kann
          // niemand mehr null hineinschreiben. `contracts_silent_rounds`
          // meldete dann bis zum Ende der Route einen laengst behobenen
          // Fehler - in JEDEM weiteren BitNode.
          //
          // Sechs Stunden Wanduhr. Die Gewerke takten alle fuenf Minuten; was
          // aelter ist, gehoert zu einer anderen Lage.
          if (!Number.isFinite(d.ts) || jetzt - d.ts > 6 * 3600000) continue;
          if (Number.isFinite(d.stummeRunden)) {
            stumm = stumm === null ? d.stummeRunden : Math.max(stumm, d.stummeRunden);
          }
        }
        if (stumm !== null) {
          k.contracts_silent_rounds = stumm;
          // Drei Durchlaeufe in Folge sind kein Zufall mehr. Einmal melden,
          // nicht in jeder Runde - `evMerker` haelt fest, ob es schon heraus ist.
          // EIN EREIGNIS JE KERNPROZESS, und das ist Absicht (Skeptiker
          // Runde 5, K2). Der Ruecksetzer unten greift nur bei exakt 0; faellt
          // `stumm` von 5 auf 2 (cdump loest wieder, contracts faengt an),
          // bleibt der Merker stehen. Das ist die richtige Richtung: der
          // Befund lautet "eine Gegenprobe klemmt", und den zweimal in einer
          // Stunde zu melden hilft niemandem. Sobald wirklich alles wieder
          // durchlaeuft, faellt die Zahl auf 0 und der Merker mit ihr.
          if (stumm >= 3 && !evMerker.stummGemeldet) {
            evMerker.stummGemeldet = true;
            ereignis("contract_stumm",
              "Vertragskette: " + stumm + " Durchlaeufe mit Fund, ohne Loesung",
              { runden: stumm });
          }
          if (stumm === 0) evMerker.stummGemeldet = false;
        }
      } catch { /* kein Stand - dann bleibt das Feld, wie es war */ }

      k.erzeugtAm = jetzt;
      ns.write("data/kpi.json", JSON.stringify(k), "w");
    };

    if (runde % 6 === 0) {
      try { schreibeKpi(); } catch (e) {
        // Die Tafel darf die Runde nie zu Fall bringen - sie ist Bericht,
        // nicht Steuerung.
        if (runde % 60 === 0) sag("kpi.json nicht schreibbar: " + e.message);
      }
    }

    // ERST HIER gilt die Runde als vollstaendig. Alles davor kann geworfen
    // haben; `runde` waere trotzdem gewachsen. Genau diese Luecke schliesst
    // okRunden - und nur mit ihr ist die Wirkungspruefung der Strafleiter
    // ("round waechst UND errStreak == 0") ueberhaupt pruefbar statt nur
    // gefordert.
    okRunden++;
    errStreak = 0;

    // DIE ANLAUFDAUER, AN DER RICHTIGEN STELLE (Skeptiker Runde 4, R14).
    //
    // Sie stand im KPI-Block, und der laeuft nur bei `runde % 6 === 0`.
    // Gemessen wurde damit Runde 1 bis Runde 6 - das Abtastraster, nicht der
    // Anlauf. Bei sichtbarem Tab ergab das ~0,8 min; im verdeckten Tab, wo das
    // Spiel belegt einen Zeitgeber je Minute liefert, waeren es 5 bis 6 min
    // gegen ein Soll von <= 5. Die Kennzahl waere in genau dem Betriebszustand
    // durchgefallen, den Abnahmestufe B ausdruecklich verlangt - ohne dass
    // irgendetwas kaputt ist.
    //
    // Hier ist der Ort: `okRunden++` heisst "eine Runde vollstaendig
    // durchgelaufen". Genau das ist "der Motor laeuft".
    if (!Number.isFinite(evMerker.bootLatencyMin)
        && Number.isFinite(evMerker.bootWall)) {
      evMerker.bootLatencyMin =
        Number(((Date.now() - evMerker.bootWall) / 60000).toFixed(2));
    }

    // Die Uhr alle 30 Runden (rund 5 Minuten) wegschreiben. Jede Runde waere
    // unnoetig, nie waere sie nach einem Neustart verloren.
    if (runde % 30 === 0) {
      try {
        ns.write("data/motorzeit.json", JSON.stringify(mz), "w");
      } catch { /* egal - die Uhr laeuft im Speicher weiter */ }
    }

   } catch (e) {
    // errStreak zaehlt AUFEINANDERFOLGENDE Fehler. Er wird am Ende einer
    // erfolgreichen Runde auf null gesetzt (siehe okRunden weiter oben im
    // try), nicht hier - sonst zaehlte er nur den letzten Fehler.
    errStreak++;
    const msg = String(e && e.message ? e.message : e);
    lastError = { cls: (e && e.name) || "Error",
      msg: msg.length > 200 ? msg.slice(0, 197) + "..." : msg, at: Date.now() };
    sag("RUNDENFEHLER (" + errStreak + " in Folge): " + String(e));
   }
    await ns.sleep(10000);
  }
}

/**
 * Wieviele grow-Faeden bringen ein Guthaben von start auf ziel?
 *
 * Loest n = (o + x) * exp(k*x) nach x auf - dieselbe Gleichung wie das Spiel
 * (Server/ServerHelpers.ts:90), Newton-Raphson in Log-Form, mit demselben
 * Startwert. Der additive Anteil von $1 je Faden ist mit drin.
 *
 * ns.growthAnalyze taugt dafuer NICHT: numCycleForGrowth laesst genau diesen
 * additiven Term weg. Fuer growthAnalyze(host, 2) = ln2/k ist es dagegen
 * zulaessig, denn dort faellt der Term heraus - so kommt k unten in den
 * Stapelplan.
 *
 * Steht ausserhalb von main, weil es keine einzige ns-Funktion braucht und
 * damit 0 GB kostet.
 *
 * @param {number} k Wachstumsexponent EINES Fadens
 * @param {number} moneyMax Deckel
 * @param {number} start Guthaben jetzt
 * @param {number} ziel Wunschguthaben
 * @returns {number} ganze Faeden, 0 wenn nichts noetig ist
 */
function growFaeden(k, moneyMax, start, ziel) {
  if (!(k > 0)) return 0;
  const o = Math.max(0, start);
  const n = Math.min(ziel, moneyMax);
  if (!(n > o)) return 0;
  let x = (n - o) / (1 + (n / 16 + (15 * o) / 16) * k);
  let diff = Infinity, wache = 0;
  while (Math.abs(diff) > 1 && wache++ < 60) {
    const ox = o + x;
    const neu = (x - ox * Math.log(ox / n)) / (1 + ox * k);
    diff = neu - x;
    x = neu;
  }
  if (!Number.isFinite(x) || x < 0) return 0;
  let faeden = Math.ceil(x);
  if (faeden > 0) {
    const probe = (t) => (o + t) * Math.exp(k * t);
    if (probe(faeden - 1) >= n) faeden--;
    else if (probe(faeden) < n) faeden++;
  }
  return Math.max(0, faeden);
}

/**
 * Sucht Platz fuer eine Reihe von Auftraegen - oder liefert null, wenn auch
 * nur EINER nicht vollstaendig unterkommt.
 *
 * Alles-oder-nichts ist hier keine Feinheit, sondern die zentrale Sicherung
 * des ganzen Stapelbetriebs. Ein halber Stapel ist schlimmer als gar keiner:
 * der hack landet, das Guthaben faellt, und der grow, der es zurueckholen
 * sollte, wurde nie gestartet. Genau daraus entsteht ein Ziel, das langsam
 * ausblutet - und genau das ist beim Anheben von KAP_ABZUG passiert.
 *
 * Herkunft: inhaltsgleich mit placeOps aus src/lib/batch.js. Bewusst kopiert
 * statt importiert - lib/batch.js zieht lib/calc.js mit, und dessen Formeln
 * rechnen ohne die BitNode-4-Multiplikatoren (ScriptHackMoney 0.2). Ein
 * Import haette entweder eine stille Verfuenffachung der Beute je Faden
 * bedeutet oder einen Umbau an der Datei, an der der BitNode-1-Autopilot
 * haengt. Diese Funktion hier ist reine Behaelterpackerei und kennt weder
 * Spielformeln noch BitNode.
 *
 * @param {Map<string, number>} frei Rechner -> freie GB. Wird NICHT veraendert.
 * @param {{threads: number, cost: number}[]} ops
 * @returns {null | {belegung: {host: string, op: object, threads: number}[], frei: Map<string, number>}}
 */
function platziere(frei, ops) {
  const rest = new Map(frei);
  const belegung = [];
  for (const op of ops) {
    let offen = op.threads;
    if (offen < 1) continue;
    // Erst versuchen, den ganzen Auftrag auf EINEN Rechner zu legen, und zwar
    // auf den kleinsten, der ihn fasst. Das haelt die grossen Rechner fuer die
    // grossen Auftraege frei und vermeidet beim hack den Aufteilungsverlust:
    // zwei Bloecke a 10 % nehmen zusammen 19 %, nicht 20 %.
    let bester = null;
    for (const [host, platz] of rest) {
      if (Math.floor(platz / op.cost) < offen) continue;
      if (bester === null || platz < rest.get(bester)) bester = host;
    }
    if (bester !== null) {
      rest.set(bester, rest.get(bester) - offen * op.cost);
      belegung.push({ host: bester, op, threads: offen });
      continue;
    }
    // Passt nirgends am Stueck: aufteilen, groesste Rechner zuerst.
    for (const [host, platz] of [...rest.entries()].sort((a, b) => b[1] - a[1])) {
      if (offen <= 0) break;
      const passt = Math.floor(platz / op.cost);
      if (passt < 1) continue;
      const n = Math.min(passt, offen);
      rest.set(host, platz - n * op.cost);
      belegung.push({ host, op, threads: n });
      offen -= n;
    }
    if (offen > 0) return null;
  }
  return { belegung, frei: rest };
}
