/**
 * Der Ausgang - entscheidet allein, wann und wohin der Bot den BitNode verlaesst.
 *
 * WARUM ES DIESE DATEI GIBT (02.09.2026, Audit "volle Autonomie")
 *
 * Bis heute wohnte der Ausgang in bn4rep.js: Die Bedingung war allein
 * `The Red Pill` (bn4rep.js:891), das Ziel kam aus data/exit-ziel.txt, die
 * nur ein Mensch schrieb, und ein Riegel wies jeden Sprung in den eigenen
 * Knoten oder ueber 13 ab - 27 der 40 verbleibenden Spruenge der Route.
 * Dazu lief bn4rep ausserhalb von BitNode 4 mit 848 GB die halbe Zeit gar
 * nicht, und `exec("exit.js", "home")` scheiterte an 519 GB auf einem home
 * mit 512. Am 01.09. musste ein Mensch den fertigen Knoten abschliessen.
 *
 * Diese Datei ist singularityfrei (8,15 GB, im Spiel gemessen 02.09.) und
 * passt damit auf jedes frische home neben bn4net. Sie steht ganz oben in
 * der Werkzeugliste von bn4net.js.
 *
 * WAS SIE TUT, JEDE MINUTE
 *
 *   1. route.json auf home lesen (Reihenfolge aus nodes/AUDIT-ROADMAP-2026-08-24.md).
 *   2. ns.getResetInfo(): aktueller Knoten und Source-File-Stand.
 *   3. DIESER LAUF = erster Routeneintrag fuer den aktuellen Knoten, dessen
 *      Stufe noch fehlt. Sein Verfahren (V1/V2) landet in data/verfahren.txt,
 *      damit bn4rep, bn4net und Co. nicht mehr raten, welche Art Knoten das ist.
 *   4. ZIEL = erster Routeneintrag, dessen Stufe NACH diesem Lauf noch fehlt.
 *      Der Sprung in den eigenen Knoten ist damit kein Fehler mehr, sondern
 *      das Ergebnis einer Rechnung, die einen verschenkten Lauf konstruktiv
 *      ausschliesst: Ziel == eigener Knoten nur, wenn die Stufe danach < 3 ist.
 *   5. Ausgangsbedingung pruefen - beide Tueren, wie das Spiel selbst
 *      (Singularity.ts:1183, ODER): in der Division und keine Black Op mehr
 *      offen (getNextBlackOp() === null), ODER w0r1d_d43m0n am Netz, Hacking
 *      >= requiredHackingSkill und Root erreichbar (fuenf Portknacker; nuke
 *      gibt sonst false, exit.js liest das). Das Verfahren steuert nur die
 *      Werkzeuge, nicht die Tuer.
 *   6. Erfuellt: exit.js auf dem Wirt mit dem meisten freien Speicher starten,
 *      notfalls Arbeiter dort raeumen. exec 0 ist kein Notruf, sondern die
 *      naechste Runde.
 *
 * Es gibt hier keinen Menschenruf. Jeder Zustand, in dem frueher gerufen
 * wurde, ist eine Handlung oder eine Protokollzeile in data/ausgang.txt.
 * `braucht` in der Route (BN9: hashes.js, BN8: boerse.js) haelt den Bot nicht
 * an: Fehlt das Gewerk auf home, wird der Eintrag UEBERSPRUNGEN und beim
 * Eintritt in jeden Lauf gemeldet - der Knoten ist wieder dran, sobald die
 * Datei liegt. Ein fertiger Knoten, in dem der Bot auf ein Gewerk wartet,
 * waere derselbe Stillstand ohne Ruf, den dieser Umbau abschafft.
 *
 * `planeRoute` ist eine reine Funktion und wird von tools/test-route.js ueber
 * alle 40 Uebergaenge der Route getestet.
 *
 * @param {NS} ns
 */

const WD = "w0r1d_d43m0n";
const TAKT_MS = 60000;
// worker/expfarm.js steht direkt hinter share (Skeptiker B, Einwand 6): der
// Erfahrungsofen haelt seit dem 26.09.2026 den groessten Teil des freien
// Speichers, und ohne ihn in dieser Liste zaehlte die Wirtswahl ihn nicht als
// rueckgewinnbar, und `raeume(h, false)` - auch das Nachraeumen direkt vor dem
// exec - konnte ihn nicht beenden. Sein Verlust ist ein angefangener weaken-
// Aufruf ohne Folgekosten (kein Stapel, keine Kette), also der zweitbilligste.
const WORKER = ["worker/share.js", "worker/expfarm.js", "worker/weaken.js", "worker/grow.js", "worker/hack.js"];
// Was exit.js auf einem Fremdrechner braucht. lib/route.js ist ein IMPORT:
// fehlt die Datei auf dem Wirt, startet das Skript gar nicht erst. route.json
// ist die Datengrundlage der Zielpruefung - ohne sie lehnt exit.js jeden
// Sprung ab, und zwar zu Recht, aber aus dem falschen Grund.
const BIBLIOTHEKEN = ["lib/hackaugs.js", "lib/route.js", "route.json"];

/**
 * Die Routenlogik liegt seit Position C.3 in `lib/route.js`.
 *
 * WARUM SIE UMGEZOGEN IST: `exit.js` braucht sie fuer die Zielpruefung vor dem
 * Sprung. Ein Import aus DIESER Datei haette exit.js den gesamten ns-Verbrauch
 * von ausgang.js aufgeschlagen - der RAM-Rechner laeuft ueber den AST der
 * importierten Datei, nicht ueber den Aufrufgraphen. `lib/route.js` ruft
 * nichts auf `ns` auf und kostet damit nichts.
 *
 * Der Re-Export haelt `tools/test-route.js` am Laufen, das planeRoute ueber
 * alle 40 Uebergaenge der Route prueft.
 */
import { planeRoute, zielErlaubt, routeZustand } from "lib/route.js";
export { planeRoute, zielErlaubt, routeZustand };

// Position C.3: die Wirtreserve (E10) und die Restzeitschaetzung. Beide sind
// reine Module ohne ns-Aufruf ausser den Basisfunktionen und kosten damit
// nichts, was ausgang.js nicht ohnehin zahlt.
import { messe, etaMinuten } from "lib/eta.js";
import { laden as evLaden, anhaengen as evAnhaengen } from "lib/events.js";
import { handschlag } from "lib/handschlag.js";

/**
 * KEINE WIRTRESERVE MEHR (Skeptikerrunde 04.09.2026).
 *
 * Hier stand ein Block, der vor dem Sprung Geld fuer einen Mietrechner
 * zuruecklegte. Drei unabhaengige Pruefer haben ihn zerlegt, und die
 * Gegenpruefung im Quelltext gab ihnen recht:
 *
 *  - Der Deadlock, den er loesen sollte, entsteht nicht durchs Ausgeben,
 *    sondern durch `installAugmentations`: das loescht alle gekauften Rechner
 *    und setzt das Guthaben auf 1.262 Dollar, in EINEM Engine-Schritt. Gegen
 *    ein genulltes Konto hilft keine Reserve. Der Riegel dagegen sitzt jetzt
 *    in bn4rep.js (lib/endspurt.js, einbauErlaubt).
 *  - Die Reserve hatte keinen Leser. Die vier Ausgabestellen lesen
 *    data/geldbedarf.txt; wirtreserve.txt las niemand.
 *  - Sie haette in 30 der 40 Laeufe ohnehin nie gegriffen, weil eta_min dort
 *    immer null ist (w0r1d_d43m0n haengt erst nach The Red Pill am Netz).
 *  - Sie kostete `cloud.getRamLimit` + `cloud.getServerCost` = 0,30 GB in
 *    einer Datei, die im Kaltstart auf 32 GB noch 0,75 GB Luft hat.
 *
 * Falls der Kaltstart (Position C.7) eine Reserve braucht, wird sie dort mit
 * dem dann gemessenen Bedarf gebaut - nicht auf Vorrat.
 */

/** @param {NS} ns */
export async function main(ns) {
  ns.disableLog("ALL");

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 60) log.shift();
    ns.write("data/ausgang.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp("data/ausgang.txt", "home", ns.getHostname()); } catch { /* egal */ }
    }
  };
  const nachHome = (datei, inhalt) => {
    ns.write(datei, inhalt, "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp(datei, "home", ns.getHostname()); } catch { /* egal */ }
    }
  };
  const liesVonHome = (datei) => {
    try {
      if (!ns.fileExists(datei, "home")) return "";
      if (ns.getHostname() !== "home") ns.scp(datei, ns.getHostname(), "home");
      return ns.read(datei);
    } catch { return ""; }
  };
  const netz = () => {
    const gesehen = new Set(["home"]);
    const schlange = ["home"];
    while (schlange.length) {
      for (const n of ns.scan(schlange.shift())) {
        if (!gesehen.has(n)) { gesehen.add(n); schlange.push(n); }
      }
    }
    return [...gesehen];
  };
  const frei = (h) => ns.getServerMaxRam(h) - ns.getServerUsedRam(h) - (h === "home" ? 2 : 0);

  sag("ausgang.js laeuft auf " + ns.getHostname() + ".");
  let letzteMeldung = "";
  let letzterStart = 0;
  // Beginn der NOT_EXECUTABLE-Frist (Uhren-Audit 08.10.2026): bis dahin aus
  // data/ausgang.json gelesen - die schreibt aber jede Runde vorher ohne das
  // Feld neu, die Frist begann also jede Runde von vorn und lief nie ab. Jetzt
  // im Speicher gehalten; die Datei liefert nur den Wert nach einem Neustart.
  let notExecSince = null;
  try {
    const a0 = JSON.parse(liesVonHome("data/ausgang.json") || "null");
    if (a0 && Number.isFinite(a0.notExecutableSeit)) notExecSince = a0.notExecutableSeit;
  } catch { /* dann beginnt die Frist beim ersten Befund */ }
  // Wann zuletzt ein Handschlag vor dem Sprung gestellt wurde (22.09.2026,
  // Skeptiker Paket C, B3). Seit `letzterStart` nur noch bei erfolgreichem
  // exec gesetzt wird, laeuft ein klemmender Sprung jede Runde erneut hier
  // durch - und jeder Handschlag erzeugt eine pre-jump-Sicherung, die nie
  // rotiert wird (~662 KB, zwei Ablageorte, etwa alle 2 min). Eine
  // Sicherung je 15 min genuegt: der Stand vor der Tuer aendert sich in
  // der Zeit nicht wesentlich. Gesetzt nur nach einer gelungenen Sicherung.
  let letzterHandschlag = 0;

  // Messpunkte fuer die Restzeitschaetzung. Sie leben nur im Prozess: nach
  // einem Neustart beginnt die Messung neu, statt eine Rate aus Punkten zu
  // bilden, zwischen denen der Bot gar nicht lief.
  let hackPunkte = [];
  let rangPunkte = [];
  // Zaehlt, wie oft exit.js den Sprung ABGELEHNT hat (Zielpruefung seit C.3).
  let exitAbgelehnt = 0;
  let exitAblehnungGrund = "";
  let letzterKnoten = null;

  // Die Freischaltschwellen der 21 Black Operations. Erzeugt von
  // tools/blackops-tabelle.js aus dem Spielquelltext; einmal gelesen, weil sie
  // sich innerhalb einer Spielversion nicht aendern.
  let boZielRang = null;
  try {
    const roh = liesVonHome("lib/blackops.json");
    const t = roh ? JSON.parse(roh) : null;
    if (t && Number.isFinite(t.hoechsterRang)) boZielRang = t.hoechsterRang;
  } catch { /* dann bleibt der Rangweg ungeschaetzt */ }
  // Nach einem Neustart die 15-Minuten-Sperre nach einem Start ohne Sprung
  // nicht verlieren.
  try {
    const alt = JSON.parse(liesVonHome("data/ausgang.json"));
    if (Number.isFinite(alt.letzterStart) && Date.now() - alt.letzterStart < 15 * TAKT_MS) letzterStart = alt.letzterStart;
  } catch { /* keine alte Telemetrie */ }
  let overridesGemeldet = false;
  const uebersprungenGemeldet = new Set();
  const PROGRAMME = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];

  while (true) {
    try {
      // 1. Route
      let route = null;
      try { route = JSON.parse(liesVonHome("route.json")).route; } catch { route = null; }
      if (!Array.isArray(route) || !route.length) {
        if (letzteMeldung !== "route") { sag("route.json fehlt oder ist unlesbar - kein Ausgang moeglich."); letzteMeldung = "route"; }
        nachHome("data/ausgang.json", JSON.stringify({ zeit: Date.now(), fehler: "route.json fehlt oder unlesbar" }));
        await ns.sleep(TAKT_MS); continue;
      }

      // 2. Zustand
      const info = ns.getResetInfo();
      const cur = info.currentNode;
      const plan = planeRoute(route, cur, info.ownedSF, (d) => ns.fileExists(d, "home"));
      const verfahren = plan.verfahren;
      // ownedSF ist der Override-Stand (PlayerObject.ts:93-95). Der Bot
      // uebergibt beim Sprung keine Optionen, also sind Overrides danach weg;
      // bis dahin koennte eine Stufe tiefer erscheinen als besessen.
      try {
        const ov = info.bitNodeOptions && info.bitNodeOptions.sourceFileOverrides;
        const n = ov instanceof Map ? ov.size : Object.keys(ov || {}).length;
        if (n && !overridesGemeldet) { sag("Hinweis: " + n + " Source-File-Override(s) aktiv - Stufen koennen tiefer erscheinen als besessen."); overridesGemeldet = true; }
      } catch { /* egal */ }
      for (const e of plan.uebersprungen) {
        const k = e.node + "/" + e.level;
        if (!uebersprungenGemeldet.has(k)) {
          sag("BitNode " + e.node + " Stufe " + e.level + " uebersprungen: " + e.braucht + " fehlt auf home. Sobald die Datei liegt, ist der Eintrag wieder dran.");
          uebersprungenGemeldet.add(k);
        }
      }

      // 3. Verfahren fuer die anderen Werkzeuge ablegen (Knoten dazu, damit
      //    ein Leser eine Datei aus dem alten Knoten erkennen kann).
      const verfahrenZeile = verfahren + " " + cur + " " + (plan.lauf ? plan.lauf.level : "0");
      if (liesVonHome("data/verfahren.txt").trim() !== verfahrenZeile) {
        nachHome("data/verfahren.txt", verfahrenZeile);
        sag("Dieser Lauf: BitNode " + cur + (plan.lauf ? " Stufe " + plan.lauf.level + ", Verfahren " + verfahren : " - " + plan.grund) + ".");
      }

      // 4. Ziel
      if (plan.fertig) {
        if (letzteMeldung !== "fertig") { sag("Route abgearbeitet - kein weiterer Sprung."); letzteMeldung = "fertig"; }
        nachHome("data/fertig.txt", String(Date.now()));
        nachHome("data/ausgang.json", JSON.stringify({ zeit: Date.now(), knoten: cur, lauf: plan.lauf, ziel: null, verfahren, fertig: true,
          eta_min: null, route_state: routeZustand(plan) }));
        await ns.sleep(TAKT_MS); continue;
      }
      if (!plan.ziel) {
        if (letzteMeldung !== plan.grund) { sag(plan.grund); letzteMeldung = plan.grund; }
        nachHome("data/ausgang.json", JSON.stringify({ zeit: Date.now(), knoten: cur, lauf: plan.lauf, ziel: null, verfahren, grund: plan.grund,
          eta_min: null, route_state: routeZustand(plan),
          uebersprungen: plan.uebersprungen.map((e) => ({ node: e.node, level: e.level, braucht: e.braucht })) }));
        await ns.sleep(TAKT_MS); continue;
      }
      const ziel = plan.ziel;

      // 5. Bedingung
      let ueberBlackOps = false, ueberHacking = false, status = "";
      try {
        if (ns.bladeburner.inBladeburner()) {
          const n = ns.bladeburner.getNextBlackOp();
          ueberBlackOps = n === null;
          status += "BlackOps " + (ueberBlackOps ? "alle gefallen" : "offen: " + n.name) + "; ";
        } else status += "keine Division; ";
      } catch { status += "Bladeburner nicht lesbar; "; }
      try {
        if (ns.serverExists(WD)) {
          // destroyW0r1dD43m0n verlangt Hacking UND Root (Singularity.ts:1170-1175)
          // und kehrt sonst STILL zurueck. Root holt exit.js - aber nur mit
          // genug Portknackern (numOpenPortsRequired 5, servers.ts:1535).
          // Einzelabfragen statt getServer (2 GB): das Skript muss neben
          // bn4net auf ein frisches 32-GB-home passen (Skeptiker 02.09.).
          const noetig = ns.getServerRequiredHackingLevel(WD);
          const level = ns.getHackingLevel();
          const root = ns.hasRootAccess(WD);
          const ports = ns.getServerNumPortsRequired(WD);
          const programme = PROGRAMME.filter((p) => ns.fileExists(p, "home")).length;
          ueberHacking = level >= noetig && (root || programme >= ports);
          status += "Hacking " + level + "/" + noetig
            + (root ? ", Root" : ", Portknacker " + programme + "/" + ports);
        } else status += WD + " nicht am Netz";
      } catch { status += WD + " nicht lesbar"; }

      // Das Spiel prueft ODER (Singularity.ts:1183) - der Sprung ist derselbe,
      // egal durch welche Tuer. `verfahren` steuert nur die Werkzeuge.
      const offen = ueberBlackOps || ueberHacking;

      // ===================================================================
      // eta_min - wie lange noch bis zum Sprung (Position C.3)
      // ===================================================================
      //
      // Nur der Hackingweg ist ueberhaupt schaetzbar: das Level waechst
      // stetig und messbar. Der Black-Ops-Weg haengt an Aktionen mit
      // Erfolgswahrscheinlichkeit und endlichen Vorraeten - eine Zahl daraus
      // waere geraten, und geraten ist hier schlimmer als null, weil der Kern
      // die Reserve dann zum falschen Zeitpunkt haelt.
      //
      // WELCHE UHR: Wanduhr mit Deckel auf den Rundenabstand. Eine
      // Offline-Luecke wird verworfen, ein Nachholklumpen faellt aus dem
      // Median. Beides steht in lib/eta.js und ist dort geprueft.
      let etaMin = null;
      let etaSicher = false;
      let etaQuelle = "nicht schaetzbar";
      if (cur !== letzterKnoten) {
        // Knotenwechsel: die alten Punkte beschreiben eine Welt, die es nicht
        // mehr gibt.
        hackPunkte = [];
        letzterKnoten = cur;
      }
      if (offen) {
        etaMin = 0;
        etaSicher = true;
        etaQuelle = "Ausgang steht offen";
      } else {
        try {
          if (ns.serverExists(WD)) {
            const noetig = ns.getServerRequiredHackingLevel(WD);
            const level = ns.getHackingLevel();
            hackPunkte = messe(hackPunkte, Date.now(), level);
            if (level >= noetig) {
              // DAS LEVEL REICHT, DER SPRUNG GEHT TROTZDEM NICHT. Dann fehlt
              // Root oder es fehlen Portknacker (numOpenPortsRequired 5,
              // servers.ts:1534). etaMinuten() gaebe hier 0 zurueck und wuerde
              // das auch noch als "sicher" melden - stundenlang, waehrend der
              // Sprung an fuenf Programmen haengt, die niemand kauft. Eine
              // Restzeit, die den eigentlichen Engpass nicht kennt, ist keine.
              etaMin = null;
              etaQuelle = "Hacking-Level reicht, aber Root/Portknacker fehlen"
                + " - Restzeit haengt an einem anderen Engpass";
            } else {
              const e = etaMinuten(hackPunkte, level, noetig);
              if (e) {
                etaMin = e.min;
                etaSicher = e.sicher;
                etaQuelle = "Hacking-Level, Median ueber " + e.punkte + " Abschnitte"
                  + (e.grob ? " (grob: der Zaehler steht in den meisten Fenstern still)" : "");
              }
            }
          }
        } catch { /* Level nicht lesbar - dann bleibt etaMin null */ }

        // ================================================================
        // DER BLADEBURNER-WEG (30 der 40 Laeufe)
        // ================================================================
        //
        // Bis hierher blieb eta_min auf diesem Weg IMMER null: gemessen wurde
        // nur das Hacking-Level gegen w0r1d_d43m0n, und der haengt erst nach
        // dem Einbau von The Red Pill am Netz (Prestige.ts:174-182). In den
        // Bladeburner-Laeufen gibt es Red Pill nicht - die Zahl fehlte also
        // genau dort, wo die Route hauptsaechlich verlaeuft.
        //
        // Der Rang steht kostenlos in data/blade.json (blade.js schreibt ihn
        // in jeder Lagemeldung). Ihn selbst zu holen kostete 4 GB fuer
        // ns.bladeburner.getRank - in einer Datei mit 8,5 GB Budget.
        //
        // WARUM DAS EINE UNTERE SCHRANKE IST, UND WARUM DAS HIER STEHT:
        // reqdRank ist eine FREISCHALTSCHWELLE. Wer Rang 400.000 hat, darf die
        // letzte Black Op angehen - erledigt hat er sie damit nicht. Nach dem
        // Rang kommt noch die Ausfuehrung der verbleibenden Aktionen, jede mit
        // eigener Dauer und Erfolgswahrscheinlichkeit. Die Schaetzung ist
        // deshalb IMMER zu kurz und wird nie als sicher gemeldet. Ein Riegel,
        // der auf sie scharf reagiert, spraeche zu frueh an.
        if (etaMin === null && boZielRang !== null) {
          try {
            const roh = liesVonHome("data/blade.json");
            const bl = roh ? JSON.parse(roh) : null;
            if (bl && Number.isFinite(bl.rang) && bl.rang > 0) {
              rangPunkte = messe(rangPunkte, Date.now(), bl.rang);
              const e = etaMinuten(rangPunkte, bl.rang, boZielRang);
              if (e) {
                etaMin = e.min;
                etaSicher = false;   // untere Schranke, nie sicher
                etaQuelle = "Bladeburner-Rang " + Math.round(bl.rang) + " gegen "
                  + boZielRang + " (Median ueber " + e.punkte + " Abschnitte)"
                  + " - UNTERE Schranke, die Ausfuehrung der Black Ops kommt hinzu";
              }
            }
          } catch { /* blade.json nicht lesbar - dann bleibt etaMin null */ }
        }
      }


      nachHome("data/ausgang.json", JSON.stringify({
        zeit: Date.now(), knoten: cur, lauf: plan.lauf, ziel, verfahren, offen,
        ueberBlackOps, ueberHacking, status, letzterStart,
        eta_min: etaMin, eta_sicher: etaSicher, eta_quelle: etaQuelle,
        route_state: routeZustand(plan),
        exit_abgelehnt: exitAbgelehnt,
        exit_ablehnung_grund: exitAbgelehnt > 0 ? exitAblehnungGrund : null,
        uebersprungen: plan.uebersprungen.map((e) => ({ node: e.node, level: e.level, braucht: e.braucht })),
        notExecutableSeit: notExecSince,
      }));

      if (!offen) {
        notExecSince = null;
        // Im Hackingweg steigt das Level fast jede Minute - fuer den
        // Vergleich auf Zehntel des Bedarfs runden, sonst verdraengt die
        // Wartezeile den Ringpuffer (60 Zeilen) in einer Stunde.
        const schluessel = status.replace(/Hacking (\d+)\/(\d+)/, (_, l, n) =>
          "Hacking ~" + Math.floor(Number(l) / Math.max(1, Number(n)) * 10) * 10 + "% von " + n);
        if (letzteMeldung !== schluessel) { sag("Ziel BitNode " + ziel.node + " Stufe " + ziel.level + " - warte: " + status); letzteMeldung = schluessel; }
        await ns.sleep(TAKT_MS); continue;
      }

      // 6. Gewerk vorhanden?
      if (ziel.braucht && !ns.fileExists(ziel.braucht, "home")) {
        const m = "Ausgang offen, aber " + ziel.braucht + " fehlt auf home - in BitNode " + ziel.node + " stuende der Bot still. Kein Sprung.";
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }
        await ns.sleep(TAKT_MS); continue;
      }
      if (!ns.fileExists("boot.js", "home") || !ns.fileExists("exit.js", "home")) {
        const m = "Ausgang offen, aber boot.js oder exit.js fehlt auf home - warte.";
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }
        await ns.sleep(TAKT_MS); continue;
      }

      // 7. exit.js starten - auf dem Wirt mit dem meisten Platz, Arbeiter raeumen.
      const hosts = netz();
      const exitLaeuft = hosts.some((h) => { try { return ns.ps(h).some((p) => p.filename === "exit.js"); } catch { return false; } });
      if (exitLaeuft) {
        if (Date.now() - letzterStart > 5 * TAKT_MS) {
          const grund = liesVonHome("data/exit.txt").trim().split("\n").pop() || "";
          sag("exit.js laeuft" + (letzterStart ? " seit " + Math.round((Date.now() - letzterStart) / 60000) + " min" : " (nicht von hier gestartet)") + " - letzte Zeile: " + grund);
          letzterStart = Date.now();
        }
        await ns.sleep(TAKT_MS); continue;
      }
      // Ein Sprung beendet dieses Skript. Sind wir nach einem Start noch hier
      // und exit.js ist zu Ende, ist der Sprung ausgeblieben (destroy kehrt
      // still zurueck). Dann nicht jede Minute Arbeiter raeumen und neu
      // starten, sondern den Grund protokollieren und 15 Minuten warten.
      if (letzterStart > 0 && Date.now() - letzterStart < 15 * TAKT_MS) {
        const grund = liesVonHome("data/exit.txt").trim().split("\n").pop() || "(exit.txt leer)";

        // EINE ABLEHNUNG IST ETWAS ANDERES ALS EIN FEHLSCHLAG (Skeptiker 04.09.).
        //
        // Seit exit.js sein Ziel gegen die Route prueft, gibt es einen neuen
        // Ausgang: der Sprung wird ABGELEHNT. Das ist richtig so - aber ohne
        // eigenen Zaehler sieht es aus wie jeder andere Fehlversuch, und
        // checkin.js liest `offen && letzterStart > 0` als "der Sprung laeuft"
        // und meldet URTEIL: SPRINGT. Ein Bot, der seit Tagen alle 15 Minuten
        // ablehnt, saehe damit gesund aus.
        if (/ABGELEHNT/i.test(grund)) {
          exitAbgelehnt++;
          exitAblehnungGrund = grund;
        }

        const m = "exit.js endete ohne Sprung - letzte Zeile: " + grund
          + (exitAbgelehnt > 0 ? "  [" + exitAbgelehnt + ". Ablehnung]" : "")
          + " - naechster Versuch in 15 min.";
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }

        // Nach vier Ablehnungen (also einer Stunde) ist es kein Ausrutscher
        // mehr. Der Befund geht in die Telemetrie, damit ihn jemand findet -
        // ein Stillstand ohne Ruf ist die Fehlerklasse, die dieser Umbau
        // abschafft.
        if (exitAbgelehnt === 4) {
          sag("BEFUND: exit.js lehnt den Sprung seit einer Stunde ab. Grund: "
            + exitAblehnungGrund + " - route.json und der Spielstand passen"
            + " nicht zusammen, oder eine Datei fehlt auf dem Wirt.");
        }
        await ns.sleep(TAKT_MS); continue;
      }
      const braucht = ns.getScriptRam("exit.js", "home");
      // WER OHNE RAEUMEN PASST, GEWINNT (22.09.2026).
      //
      // Hier wurde ueber `frei(h) + arbeiter` maximiert, also ueber
      // RUECKGEWINNBAREN statt freien Speicher. Das waehlt zuverlaessig den
      // groessten Arbeitsrechner - und damit genau den, um den sich
      // ausgang.js mit bn4net streiten muss. Gerechnet mit den Zahlen vom
      // 22.09.2026:
      //     blade            6,25 frei + 505,75 Arbeiter = 512
      //     hacknet-server-0  256 frei +      0          = 256
      // blade gewann deterministisch, wurde geraeumt, und bn4net hatte den
      // Platz 90 Sekunden spaeter wieder belegt (10-s-Takt, bn4net.js:4726).
      // Der Sprung nach BN9 L3 klemmte daran ueber eine Stunde.
      //
      // Jetzt in zwei Stufen. Erste Stufe: ein Rechner, auf dem exit.js
      // JETZT schon passt. Dort ist nichts zu toeten, es gibt kein Fenster,
      // in dem der Platz zurueckfallen koennte, und kein Arbeiter verliert
      // seinen Vorlauf. Unter gleich geeigneten gewinnt der KNAPPESTE:
      // ein grosser Rechner ist fuer die Arbeiter mehr wert, und exit.js
      // braucht nur seine 40 GB.
      //
      // Zweite Stufe, nur wenn nirgends Platz ist: wie bisher der mit dem
      // meisten rueckgewinnbaren Speicher. Dann wird geraeumt - mit dem
      // Nachraeumen direkt vor dem exec als Absicherung.
      //
      // bn4net.js:817-823 haelt die Hacknet-Server ausdruecklich frei:
      //     "Nur ausgang.js legt dort im Sprungmoment exit.js ab."
      // Diese Absicht wird erst durch Stufe 1 wirksam - vorher stand sie
      // nur auf der Seite von bn4net, und ausgang.js hat sie nie genutzt.
      // Ob ein Hacknet-Server tatsaechlich reicht, entscheidet allein sein
      // Speicher: frisch hat er 1 GB (HacknetServer.ts:60), am 22.09. lagen
      // sie bei 16 GB - exit.js braucht 40,25. Deshalb ist das hier keine
      // Sonderregel fuer Hacknet, sondern schlicht die Frage, wo es passt.
      let wirt = null, meist = -Infinity;
      // HACKNET-SERVER ZUERST (Skeptiker, 22.09.2026).
      //
      // Die erste Fassung nahm unter den passenden schlicht den knappsten.
      // Das arbeitet gegen die eigene Begruendung: bn4net.js:817-823 haelt
      // die Hacknet-Server fuer genau diesen Augenblick frei, und ein
      // freigehaltener Rechner hat per Definition den MEISTEN freien
      // Speicher - "knappster" waehlt ihn also ab, sobald irgendein anderer
      // auch passt.
      //
      // Jetzt in dieser Reihenfolge:
      //   1. ein Hacknet-Server, auf dem exit.js passt (dafuer sind sie da;
      //      die paar Sekunden Hashverlust bis zum Prestige sind belanglos)
      //   2. sonst der knappste sonstige Rechner, auf dem es passt - ein
      //      grosser Rechner ist fuer die Arbeiter mehr wert
      //   3. sonst wie bisher der mit dem meisten rueckgewinnbaren Speicher,
      //      dann wird geraeumt
      let sofort = null, sofortFrei = Infinity, sofortHacknet = false;
      for (const h of hosts) {
        if (!ns.hasRootAccess(h)) continue;
        const freiJetzt = frei(h);
        if (freiJetzt >= braucht) {
          const istHacknet = h.startsWith("hacknet-server-");
          // Ein Hacknet-Server schlaegt jeden Nicht-Hacknet. Unter gleichen
          // entscheidet der knappste.
          const besser = sofort === null
            || (istHacknet && !sofortHacknet)
            || (istHacknet === sofortHacknet && freiJetzt < sofortFrei);
          if (besser) { sofortFrei = freiJetzt; sofort = h; sofortHacknet = istHacknet; }
        }
        let arbeiter = 0;
        for (const p of ns.ps(h)) if (WORKER.includes(p.filename)) arbeiter += ns.getScriptRam(p.filename, "home") * p.threads;
        const moeglich = freiJetzt + arbeiter;
        if (moeglich > meist) { meist = moeglich; wirt = h; }
      }
      if (sofort) {
        wirt = sofort;
        // Ueber letzteMeldung entdoppelt: nach einem exec == 0 bleibt
        // letzterStart auf 0, die Runde erreicht diese Stelle also jede
        // Minute erneut. Ohne die Entdopplung schriebe sie im Minutentakt
        // dieselbe Zeile in genau das Protokoll, in dem man den Fehlschlag
        // sucht.
        const m = "Wirt fuer exit.js: " + wirt + " (" + sofortFrei.toFixed(1)
          + " GB frei, noetig " + braucht.toFixed(1) + ")"
          + (sofortHacknet ? " - Hacknet-Server, dafuer freigehalten." : " - passt ohne Raeumen.");
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }
      }
      if (!wirt || !(braucht > 0)) {
        const m = "Ausgang offen, aber exit.js ist nicht lesbar (getScriptRam " + braucht + ") - naechste Runde.";
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }
        await ns.sleep(TAKT_MS); continue;
      }
      // Erst Arbeiter raeumen. Reicht das nirgends, ist der Knoten trotzdem
      // fertig - dann darf auf dem groessten Rechner alles weichen ausser
      // bn4net und diesem Skript. Es geht nichts verloren, was im naechsten
      // Knoten noch etwas wert waere.
      // RAEUMEN IN EINER REIHENFOLGE, NICHT IN DER, DIE ns.ps LIEFERT (L5).
      //
      // Bisher lief die Schleife in Prozessreihenfolge durch und toetete, was
      // ihr zuerst begegnete. Das ist eine Zufallsauswahl: mal faellt ein
      // share-Faden, mal ein hack-Faden mitten im Stapel. Ein abgebrochener
      // hack verliert den ganzen Vorlauf aus weaken und grow; ein share
      // verliert nichts als ein paar Prozent Reputation.
      //
      // Deshalb eine feste Rangfolge, billigster Verlust zuerst:
      //   share -> weaken -> grow -> hack -> alles Uebrige
      //
      // SCHONLISTE (L3): drei Prozesse werden nie geraeumt. Der Kern und
      // dieses Skript standen schon da; neu ist der Waechter, sobald es ihn
      // gibt (Position C.6) - er ist die Instanz, die einen missglueckten
      // Sprung ueberhaupt bemerken wuerde, und wer ihn wegraeumt, raeumt seine
      // eigene Aufsicht weg.
      const NIE_RAEUMEN = ["bn4net.js", "ausgang.js", "guard.js", "waechter.js"];
      const raeumRang = (datei) => {
        const i = WORKER.indexOf(datei);
        return i === -1 ? WORKER.length : i;   // Unbekanntes zuletzt
      };
      const raeume = (h, auchWerkzeuge) => {
        const liste = [...ns.ps(h)]
          .filter((p) => !NIE_RAEUMEN.includes(p.filename))
          .filter((p) => auchWerkzeuge || WORKER.includes(p.filename))
          .sort((a, b) => raeumRang(a.filename) - raeumRang(b.filename));
        let getoetet = 0;
        for (const p of liste) {
          if (frei(h) >= braucht) break;
          ns.kill(p.pid);
          getoetet++;
        }
        return getoetet;
      };
      if (frei(wirt) < braucht) {
        raeume(wirt, false);
        sag("Arbeiter auf " + wirt + " geraeumt, frei jetzt " + frei(wirt).toFixed(1) + " GB.");
      }
      if (frei(wirt) < braucht) {
        let groesster = wirt, maxRam = -1;
        for (const h of hosts) {
          if (!ns.hasRootAccess(h)) continue;
          const r = ns.getServerMaxRam(h) - (h === "home" ? 2 : 0);
          if (r > maxRam) { maxRam = r; groesster = h; }
        }
        if (maxRam >= braucht) {
          wirt = groesster;
          raeume(wirt, true);
          sag("Kein Platz fuer exit.js - auf " + wirt + " alles ausser bn4net/ausgang beendet, frei jetzt " + frei(wirt).toFixed(1) + " GB.");
        }
      }
      // ---- STUFE 2: DAS EIGENE HAUS AUSBAUEN --------------------------------
      //
      // Passt exit.js nirgends, ist der naechste Griff der eigene Speicher.
      // `homegrow.js` kauft ohnehin nach, aber es richtet sich nach der
      // Amortisation - in dieser Lage zaehlt sie nicht: ein offener Ausgang
      // kostet laufend, und der Ausbau ist danach fuer immer da.
      //
      // Der Auftrag verlangt an dieser Stelle keinen eigenen Kauf, sondern
      // dass die Lage BENANNT wird. `data/geldbedarf.txt` ist der Kanal, den
      // shop.js und homegrow.js lesen; er sagt ihnen, wofuer gespart wird.
      let hausAusbau = null;
      if (frei(wirt) < braucht) {
        try {
          const homeRam = ns.getServerMaxRam("home");
          hausAusbau = { homeRam, braucht };
          // NICHT MEHR IN data/geldbedarf.txt (22.09.2026).
          //
          // Hier stand ein nachHome(...JSON.stringify({...})) in genau den
          // Kanal, den fuenf Stellen als NACKTE ZAHL lesen:
          //     bn4net.js:1160   Number(ns.read(...)) || 0
          //     bn4life.js:284   Number(liesVonHome(...)) || 0
          //     graftauto.js:337, homegrow.js:78  ebenso
          // Aus JSON macht Number() NaN, und `|| 0` daraus eine Null. Der
          // Kanal traegt die Augmentierungs-RUECKLAGE in Dollar, die
          // bn4rep.js:1315 als String(Math.round(bedarf)) hineinschreibt.
          // Sobald diese Stufe griff, war die Ruecklage fuer alle Leser
          // geloescht - der Bot durfte Geld ausgeben, das fuer gekaufte
          // Augmentierungen zurueckgelegt war.
          //
          // Zwei Fehler in einer Zeile: das Format (JSON statt Zahl) und
          // die Einheit (GIGABYTE statt Dollar). Selbst als Zahl waere es
          // falsch gewesen - ein RAM-Bedarf in einem Geldkanal.
          //
          // Der Auftrag verlangt, dass die Lage BENANNT wird, nicht dass
          // sie in diesen Kanal geht. Sie steht jetzt im eigenen Log und
          // in data/ausgang.json (Feld hausAusbau, Zeile 677), wo sie
          // ohnehin schon landet und niemanden ueberschreibt.
          sag("BEFUND: exit.js braucht " + braucht.toFixed(0)
            + " GB und passt nirgends. home hat " + homeRam
            + " GB - ein Ausbau wuerde den Sprung freimachen."
            + " (Steht in data/ausgang.json unter hausAusbau.)");
        } catch { /* dann eben ohne Bedarfsmeldung */ }
      }

      // ---- STUFE 3: NOT_EXECUTABLE -----------------------------------------
      //
      // Der Zustand hat einen Namen (`lib/leiter.js`), und bis heute hat ihn
      // NIEMAND gesetzt - er war eine Zeichenkette ohne Schreiber (Skeptiker
      // Gesamtbild, W1). Ohne ihn kann die Strafleiter nicht wissen, dass hier
      // kein Neustart hilft, sondern Speicher fehlt.
      //
      // Die Frist ist bewusst lang: eine Runde ohne Wirt ist normal (ein
      // Mietrechner wird gerade gekauft), eine Stunde ohne Wirt ist ein
      // Befund. Gemessen wird in WANDUHR - dieses Gewerk laeuft selbst, seine
      // eigene Motorzeit gaebe es also immer.
      const NOT_EXEC_NACH_MS = 3600000;
      let notExecutable = false;
      let notExecutableSeit = null;
      if (frei(wirt) < braucht) {
        if (notExecSince === null) notExecSince = Date.now();
        notExecutableSeit = notExecSince;
        notExecutable = Date.now() - notExecutableSeit >= NOT_EXEC_NACH_MS;
        if (notExecutable) {
          try {
            const strom = evLaden(liesVonHome("data/events.json"));
            const schon = [...strom.eintraege].reverse().find((e) =>
              e.art === "blocked" && e.daten && e.daten.grund === "NOT_EXECUTABLE");
            // Einmal je Knoten, nicht je Runde.
            if (!schon || schon.daten.nodeReset !== info.lastNodeReset) {
              evAnhaengen(strom, "blocked",
                "NOT_EXECUTABLE: exit.js (" + braucht.toFixed(0) + " GB) passt "
                + "seit " + ((Date.now() - notExecutableSeit) / 60000).toFixed(0)
                + " min auf keinen Rechner",
                { wall: Date.now() },
                { grund: "NOT_EXECUTABLE", braucht,
                  moeglich: Number.isFinite(meist) ? meist : null,
                  nodeReset: info.lastNodeReset });
              nachHome("data/events.json", JSON.stringify(strom));
              nachHome("data/sofort.json", (() => {
                let liste = [];
                try { liste = JSON.parse(liesVonHome("data/sofort.json")) || []; }
                catch { liste = []; }
                if (!Array.isArray(liste)) liste = [];
                // Pflichtfelder nach doku/kontrakte.md 4.11 - `ts` und
                // `nodeReset` sind woertlich aus 4.6, `id` haelt die
                // Entdopplung ueber einen Brueckenneustart hinweg.
                liste.push({
                  ts: Date.now(),
                  nodeReset: (() => {
                    try { return ns.getResetInfo().lastNodeReset || 0; }
                    catch { return 0; }
                  })(),
                  id: "ausgang.js#exit-passt-nirgends",
                  zugestellt: null,
                  titel: "Ausgang blockiert - exit.js passt auf keinen Rechner",
                  text: "exit.js braucht " + braucht.toFixed(0) + " GB, der "
                    + "groesste Rechner hat "
                    + (Number.isFinite(meist) ? meist.toFixed(0) : "?")
                    + " GB. Der Knoten ist erledigt, die Tuer steht offen, und "
                    + "jede weitere Stunde darin ist verloren. Ein Neustart "
                    + "hilft hier nicht - es fehlt Speicher.",
                  quelle: "ausgang.js",
                });
                return JSON.stringify(liste.slice(-20));
              })());
            }
          } catch { /* Bericht, nie Steuerung */ }
        }
      }

      if (frei(wirt) < braucht) {
        const m = "Ausgang offen, aber exit.js (" + braucht.toFixed(1) + " GB) passt auf keinen Rechner (groesster hat " + (Number.isFinite(meist) ? meist.toFixed(1) : "?") + " GB) - naechste Runde.";
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }
        // In BitNode 9 gibt es keine Mietrechner; ob ein Fremdrechner 520 GB
        // hat, ist Wuerfelglueck (fulcrumtech 128-2048 GB). Das gehoert in die
        // Telemetrie, nicht nur in den Ringpuffer.
        nachHome("data/ausgang.json", JSON.stringify({
          zeit: Date.now(), knoten: cur, lauf: plan.lauf, ziel, verfahren, offen,
          ueberBlackOps, ueberHacking, status, letzterStart,
          uebersprungen: plan.uebersprungen.map((e) => ({ node: e.node, level: e.level, braucht: e.braucht })),
          // Die Pflichtfelder gehoeren AUCH hierhin. Das ist der Zweig, in dem
          // exit.js auf keinen Rechner passt - also der interessanteste
          // Zustand ueberhaupt. Ohne sie verschwinden route_state und eta_min
          // genau dann aus der Telemetrie, wenn man sie braucht; ein Leser
          // sieht ein Loch, nicht einen Wert.
          eta_min: etaMin, eta_sicher: etaSicher, eta_quelle: etaQuelle,
          route_state: routeZustand(plan),
          wirtFehlt: { braucht, besterWirt: wirt, moeglich: Number.isFinite(meist) ? meist : null },
          // DIE KETTE ENDETE HIER (Skeptiker Gesamtbild, W2, 04.09.2026).
          //
          // ARCHITEKTUR 9.1 L1 verlangt drei Stufen: groesster Fremdrechner ->
          // sonst home ausbauen -> sonst NOT_EXECUTABLE mit Befund. Gebaut war
          // nur die erste. Danach schrieb dieses Gewerk `wirtFehlt` und
          // meldete "naechste Runde" - endlos, ohne dass irgendetwas
          // eskaliert. `wirtFehlt` wurde nur GEZAEHLT.
          //
          // Der Zustand ist nicht harmlos: der Knoten ist erledigt, die Tuer
          // steht offen, und jede weitere Stunde darin ist verloren.
          notExecutable,
          notExecutableSeit,
          hausAusbau,
        }));
        await ns.sleep(TAKT_MS); continue;
      }
      notExecSince = null;
      // ns.scp WIRFT NICHT - es gibt `false` zurueck (NetscriptFunctions.ts:803-809).
      //
      // Fehlt eine Datei, loggt es intern, kopiert den Rest und meldet den
      // Teilausfall nur ueber den Rueckgabewert. Ausgewertet wurde der bisher
      // nicht, und die Folgen sind alle dauerhaft und alle still: ohne
      // lib/route.js startet exit.js gar nicht, ohne route.json lehnt es jeden
      // Sprung ab, ohne lib/hackaugs.js fehlt ihm die Augmentierungslogik.
      if (wirt !== "home") {
        const ok = ns.scp(["exit.js", ...BIBLIOTHEKEN], wirt, "home");
        if (!ok) {
          const fehlend = ["exit.js", ...BIBLIOTHEKEN].filter((d) => !ns.fileExists(d, wirt));
          sag("BEFUND: Dateien fehlen auf " + wirt + " - " +
            (fehlend.length ? fehlend.join(", ") : "scp meldete einen Teilausfall") +
            ". exit.js startet damit nicht oder lehnt jeden Sprung ab.");
        }
      }
      // DER SPRUNG GEHOERT IN DEN EREIGNISSTROM - UND ZWAR VORHER
      // (04.09.2026). `jump_latency_min` ist der Abstand zwischen diesem
      // Eintrag und dem naechsten `boot`; nach dem Sprung kann ihn niemand
      // mehr schreiben, weil beide Prestiges alle Skripte toeten
      // (Prestige.ts, prestigeWorkerScripts). Die Zeile MUSS also vor dem
      // exec stehen, auch wenn der Sprung danach scheitert - ein `jump` ohne
      // folgenden `boot` ist selbst der Befund.
      try {
        const strom = evLaden(liesVonHome("data/events.json"));
        evAnhaengen(strom, "jump", "exit.js gestartet: BitNode " + cur
          + " -> " + ziel.node + " Stufe " + ziel.level, {
            // NUR DIE WANDUHR. `jump_latency_min` steht ausdruecklich in
            // Wanduhr (ARCHITEKTUR 4.2) - sie misst, wie lange der Bot
            // brauchte, nicht wie lange er arbeitete. `ns.getPlayer` haette
            // 0,50 GB gekostet und dieses Gewerk im Kaltstart von 8,15 auf
            // 8,65 GB gehoben, fuer ein Feld, das niemand liest.
            wall: Date.now(), playtime: 0, motorTimeMs: 0,
          }, { von: cur, nach: ziel.node, level: ziel.level,
            verfahren: ziel.verfahren, wirt,
            // Gekaufte, nicht eingebaute Augmentierungen verfallen beim
            // Sprung ersatzlos. `queued_augs_at_jump` hat Soll 0 und hatte
            // keinen Schreiber (R11) - die Zahl steht in data/einbau.json und
            // ist NUR in diesem Augenblick zu haben.
            //
            // NUR EINE ZAHL VON NACH DEM LETZTEN EINBAU ZAEHLT (22.09.2026).
            // Um 10:51 stand hier `wartendeAugs: 2`, und /bb meldete seitdem
            // "2 gekaufte Augs beim Sprung verfallen". Die Sicherung
            // pre-jump von 10:51 zeigt eine LEERE Warteschlange - die beiden
            // waren um 10:19 eingebaut worden. Nach dem Einbau waren alle
            // Skripte tot, bn4rep.js lief beim Sprung noch nicht wieder, und
            // einbau.json war der Stand von davor. Eine Zahl, die vor dem
            // letzten Einbau geschrieben wurde, beschreibt eine Warteschlange,
            // die es nicht mehr gibt - dann lieber `null` (nicht gezaehlt).
            wartendeAugs: (() => {
              try {
                const e = JSON.parse(liesVonHome("data/einbau.json") || "null");
                if (!e || !Number.isFinite(e.wartend)) return null;
                if (!Number.isFinite(e.zeit) || e.zeit <= info.lastAugReset) return null;
                return e.wartend;
              } catch { return null; }
            })(),
            // Stempel: diese Zahl ist gegen den letzten Einbau geprueft. Der
            // Kern zaehlt nur gestempelte Spruenge (22.09.2026) - das
            // Sprung-Ereignis vom Vormittag des 22.09. traegt noch die ungepruefte 2 und stuende
            // sonst bis zum naechsten Sprung als Befund im /bb.
            wartendeGeprueft: true,
            // ZURUECKGEHALTEN WEGEN DER WIEDERAUFBAU-FRIST (09.10.2026, BN3.3
            // -> BN11): drei Blade-Augs standen beim Sprung in der
            // Warteschlange, weil bn4rep im Kampfknoten den Einbau innerhalb
            // der Frist nach dem letzten Wiederaufbau sperrt (kampfZuFrueh,
            // lib/endspurt.js). Der Kern fuehrt sie getrennt (queued_augs_held),
            // der Kennwert selbst bleibt ehrlich. NUR die Frist zaehlt -
            // kampfAufbau (Kampfwerte < 100) kann auch ein haengendes Training
            // sein und bleibt ein Befund (Skeptiker 09.10.).
            einbauFristGehalten: (() => {
              try {
                const e = JSON.parse(liesVonHome("data/einbau.json") || "null");
                if (!e || !Number.isFinite(e.zeit) || e.zeit <= info.lastAugReset) return null;
                return e.kampfZuFrueh === true;
              } catch { return null; }
            })() });
        nachHome("data/events.json", JSON.stringify(strom));
      } catch { /* Bericht, nie Steuerung - der Sprung geht trotzdem */ }

      // DER HANDSCHLAG VOR DEM SPRUNG (Auftrag 7.2, gebaut 04.09.2026).
      //
      // Ein Knotenwechsel ist unwiderruflich. Die Sicherungsklasse `pre-jump`
      // wird als einzige neben `pre-install` NIE rotiert - sie ist der letzte
      // Stand vor der Tuer. Bis heute entstand sie nie: die Brueckenseite war
      // gebaut, die Spielseite nicht (Skeptiker, Gesamtbild B1).
      //
      // Der Sprung geht auch OHNE Antwort - ein offener Ausgang kostet
      // laufend Zeit, und der Knoten ist erledigt. Die Wartezeit wird
      // protokolliert, damit sie aus `jump_latency_min` herausgerechnet
      // werden kann (Auftrag: `backup_wait_min` ist kein Fehler).
      let backupWartenMs = 0;
      if (Date.now() - letzterHandschlag < 15 * 60000) {
        sag("Handschlag vor " + Math.round((Date.now() - letzterHandschlag) / 60000)
          + " min schon gestellt - keine neue pre-jump-Sicherung.");
      } else try {
        const hs = await handschlag(ns, "jump",
          "BN" + ziel.node + " L" + ziel.level, info.lastNodeReset, sag);
        // Nur eine GELUNGENE Sicherung zaehlt (Skeptiker Runde 2): scheitert
        // der Handschlag, darf die naechste Runde es erneut versuchen - sonst
        // spraenge der Bot 15 min lang ohne pre-jump-Sicherung.
        if (hs.gesichert) letzterHandschlag = Date.now();
        backupWartenMs = hs.wartezeitMs;
        const strom = evLaden(liesVonHome("data/events.json"));
        evAnhaengen(strom, "note", "Handschlag vor dem Sprung: " + hs.grund,
          { wall: Date.now() },
          { reason: "jump", gesichert: hs.gesichert,
            wartezeitMs: hs.wartezeitMs, alterMs: hs.alterMs });
        nachHome("data/events.json", JSON.stringify(strom));
      } catch (e) {
        sag("Handschlag misslungen (" + String(e && e.message ? e.message : e)
          + ") - der Sprung geht trotzdem.");
      }
      // backup-wait.txt ENTFAELLT (22.09.2026, BAUSTELLEN "backup_wait_min:
      // Kennwert ohne Leser"). Die Datei landete per ns.write auf dem Wirt,
      // nicht auf home, und niemand las sie. Die Wartezeit steht ohnehin im
      // Ereignis "Handschlag vor dem Sprung" (daten.wartezeitMs); bn4net.js
      // traegt sie von dort als backup_wait_min in kpi.json ein.
      void backupWartenMs;

      // ================================================================
      // NACHRAEUMEN DIREKT VOR DEM exec (22.09.2026)
      // ================================================================
      //
      // Geraeumt wird oben, rund 250 Zeilen frueher. Dazwischen liegt der
      // Handschlag, und der wartet bis zu 90 Sekunden auf die Bruecke.
      // In diesem Fenster rollt bn4net seine Arbeiter wieder aus - es
      // sieht freien Speicher und fuellt ihn, das ist seine Aufgabe.
      //
      // Am 22.09.2026 lief das viermal hintereinander so ab, im Abstand
      // von genau 90 Sekunden zwischen Raeumen und Fehlschlag:
      //   09:45:20  Arbeiter auf blade geraeumt, frei jetzt 58.8 GB.
      //   09:45:20  Handschlag gestellt (jump -> BN9 L3) ...
      //   09:46:50  Bruecke antwortet nicht ...
      //   09:46:50  exit.js liess sich auf blade nicht starten (exec gab 0)
      //
      // exit.js braucht 40,25 GB; blade hat 512 und war nach dem Warten
      // wieder voll mit hack-Faeden. Der Knoten war erledigt, der Bot kam
      // trotzdem eine Stunde lang nicht durch die Tuer.
      //
      // Der Handschlag-Fehler selbst ist in lib/handschlag.js behoben (die
      // Anfrage lag auf dem Wirt, die Bruecke las auf home). Das VERKUERZT
      // das Fenster, es schliesst es nicht: die Bruecke sieht die Anfrage
      // erst beim naechsten Takt (SOFORT_MS = 60000, sync/bridge.js:232),
      // also nach 0 bis 60 Sekunden. bn4net verteilt alle 10 Sekunden
      // (bn4net.js:4726), und gemessen ging blade in 90 Sekunden von
      // 58,8 GB frei auf 0,85 GB - fuer 40,25 GB reichen also schon rund
      // 30 Sekunden Fenster. Diese Pruefung ist damit NICHT die billige
      // Absicherung, als die sie hier zuerst stand, sondern der Teil, der
      // den Start tatsaechlich rettet.
      if (frei(wirt) < braucht) {
        const vorher = frei(wirt);
        raeume(wirt, false);
        sag("Vor dem Start war " + wirt + " wieder belegt ("
          + vorher.toFixed(1) + " GB frei, noetig " + braucht.toFixed(1)
          + ") - nachgeraeumt, frei jetzt " + frei(wirt).toFixed(1) + " GB.");
      }
      // Reicht es immer noch nicht, ist das ein Befund und kein stilles
      // exec 0: die Meldung unten saehe sonst genauso aus wie eine fehlende
      // Datei oder ein doppelt laufendes Skript.
      if (frei(wirt) < braucht) {
        sag("BEFUND: " + wirt + " hat nur " + frei(wirt).toFixed(1)
          + " GB frei, exit.js braucht " + braucht.toFixed(1)
          + " GB - der Start wird gleich fehlschlagen.");
      }
      const pid = ns.exec("exit.js", wirt, 1, ziel.node);
      // NUR BEI ECHTEM START (22.09.2026, aus drei Skeptiker-Laeufen).
      //
      // Hier stand letzterStart = Date.now() unbedingt, also auch bei
      // pid === 0. Zwei Folgen, beide schlecht:
      //
      // (1) Die Wartezeit. Zeile 408 liest letzterStart > 0 als 'exit.js
      //     lief und ist zu Ende' und wartet dann 15 Minuten. Nach einem
      //     exec, der gar nicht gestartet ist, gehoert aber der naechste
      //     Takt, nicht eine Viertelstunde.
      //
      // (2) Die Luege im Protokoll. Dieselbe Zeile schreibt danach
      //     'exit.js endete ohne Sprung - letzte Zeile: (exit.txt leer)'.
      //     Es lief nie ein exit.js; data/exit.txt existiert nicht einmal.
      //     Und checkin.js:322 liest offen && letzterStart > 0 als 'der
      //     Sprung laeuft' und meldet URTEIL: SPRINGT mit Rueckgabewert 0.
      //
      // Genau das ist am 22.09.2026 passiert: der Bot stand ab 08:55 vor
      // einer Tuer, die er nicht aufbekam, und /bb meldete eine Stunde lang
      // 'der Sprung laeuft'. Der Kommentar 14 Zeilen ueber Zeile 408
      // beschreibt dieselbe Fehlerklasse - sie wurde am 04.09. fuer
      // Ablehnungen abgeraeumt und fuer exec == 0 uebersehen.
      if (pid) letzterStart = Date.now();
      sag(pid
        ? "AUSGANG: " + status + " - exit.js gestartet auf " + wirt + " (pid " + pid + "), Ziel BitNode " + ziel.node + " Stufe " + ziel.level + ", Verfahren dort " + ziel.verfahren + "."
        : "exit.js liess sich auf " + wirt + " nicht starten (exec gab 0) - naechste Runde.");
      letzteMeldung = "";
    } catch (e) {
      sag("Fehler in der Runde: " + String(e));
      // Telemetrie auch im Fehlerfall, sonst sieht bn4net nur "schreibt
      // nichts" und startet alle 10 Minuten neu, ohne dass der Grund
      // irgendwo steht.
      try { nachHome("data/ausgang.json", JSON.stringify({ zeit: Date.now(), fehler: String(e), letzterStart })); } catch { /* egal */ }
    }
    await ns.sleep(TAKT_MS);
  }
}
