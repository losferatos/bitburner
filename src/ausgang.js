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
const WORKER = ["worker/share.js", "worker/weaken.js", "worker/grow.js", "worker/hack.js"];
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

  // Messpunkte fuer die Restzeitschaetzung. Sie leben nur im Prozess: nach
  // einem Neustart beginnt die Messung neu, statt eine Rate aus Punkten zu
  // bilden, zwischen denen der Bot gar nicht lief.
  let hackPunkte = [];
  let rangPunkte = [];
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
        uebersprungen: plan.uebersprungen.map((e) => ({ node: e.node, level: e.level, braucht: e.braucht })),
      }));

      if (!offen) {
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
        const m = "exit.js endete ohne Sprung - letzte Zeile: " + grund + " - naechster Versuch in 15 min.";
        if (letzteMeldung !== m) { sag(m); letzteMeldung = m; }
        await ns.sleep(TAKT_MS); continue;
      }
      const braucht = ns.getScriptRam("exit.js", "home");
      let wirt = null, meist = -Infinity;
      for (const h of hosts) {
        if (!ns.hasRootAccess(h)) continue;
        let arbeiter = 0;
        for (const p of ns.ps(h)) if (WORKER.includes(p.filename)) arbeiter += ns.getScriptRam(p.filename, "home") * p.threads;
        const moeglich = frei(h) + arbeiter;
        if (moeglich > meist) { meist = moeglich; wirt = h; }
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
      const raeume = (h, auchWerkzeuge) => {
        for (const p of ns.ps(h)) {
          if (frei(h) >= braucht) break;
          const arbeiter = WORKER.includes(p.filename);
          if (!arbeiter && !auchWerkzeuge) continue;
          if (p.filename === "bn4net.js" || p.filename === "ausgang.js") continue;
          ns.kill(p.pid);
        }
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
        }));
        await ns.sleep(TAKT_MS); continue;
      }
      if (wirt !== "home") ns.scp(["exit.js", ...BIBLIOTHEKEN], wirt, "home");
      const pid = ns.exec("exit.js", wirt, 1, ziel.node);
      letzterStart = Date.now();
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
