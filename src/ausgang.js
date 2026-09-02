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
const BIBLIOTHEKEN = ["lib/hackaugs.js"];

/**
 * Reine Routenlogik. `sf` ist eine Map oder ein Objekt Knoten -> Stufe;
 * `vorhanden(datei)` sagt, ob ein in `braucht` genanntes Gewerk auf home liegt.
 * Liefert { lauf, ziel, verfahren, fertig, grund, uebersprungen }.
 *
 * `braucht` haelt den Bot NICHT an (Skeptiker 02.09.: ein Stillstand ohne
 * Ruf ist genau die Fehlerklasse, die dieser Umbau abschafft). Ein Eintrag,
 * dessen Gewerk fehlt, wird uebersprungen und steht in `uebersprungen`;
 * sobald die Datei liegt, ist er wieder der erste offene Eintrag.
 */
export function planeRoute(route, cur, sf, vorhanden = () => true) {
  const stufe = (n) => {
    const v = sf instanceof Map ? sf.get(n) : sf[n];
    return Number.isFinite(Number(v)) ? Number(v) : 0;
  };
  const nachDiesemLauf = (n) => stufe(n) + (n === cur ? 1 : 0);
  const eintraege = Array.isArray(route) ? route : [];
  const leer = { lauf: null, ziel: null, verfahren: "V2", fertig: false, uebersprungen: [] };

  for (const e of eintraege) {
    const ok = e && Number.isInteger(e.node) && e.node >= 1 && e.node <= 15
      && [1, 2, 3].includes(e.level) && ["V1", "V2", "V1b"].includes(e.verfahren);
    if (!ok) return { ...leer, grund: "Routeneintrag ungueltig: " + JSON.stringify(e) };
  }

  const lauf = eintraege.find((e) => e.node === cur && stufe(cur) < e.level) || null;
  const letzterFuerCur = [...eintraege].reverse().find((e) => e.node === cur);
  const verfahren = lauf ? lauf.verfahren : (letzterFuerCur ? letzterFuerCur.verfahren : "V2");

  const uebersprungen = [];
  let ziel = null;
  for (const e of eintraege) {
    if (!(nachDiesemLauf(e.node) < e.level)) continue;
    if (e.braucht && !vorhanden(e.braucht)) { uebersprungen.push(e); continue; }
    ziel = e; break;
  }

  if (!ziel) {
    return { lauf, ziel: null, verfahren, fertig: uebersprungen.length === 0, uebersprungen,
      grund: uebersprungen.length ? "nur noch Eintraege mit fehlendem Gewerk offen" : "Route abgearbeitet" };
  }
  return { lauf, ziel, verfahren, fertig: false, uebersprungen,
    grund: lauf ? "" : "aktueller Knoten " + cur + " steht nicht offen in der Route" };
}

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
        await ns.sleep(TAKT_MS); continue;
      }
      if (!plan.ziel) {
        if (letzteMeldung !== plan.grund) { sag(plan.grund); letzteMeldung = plan.grund; }
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

      nachHome("data/ausgang.json", JSON.stringify({
        zeit: Date.now(), knoten: cur, lauf: plan.lauf, ziel, verfahren, offen,
        ueberBlackOps, ueberHacking, status, letzterStart,
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
    }
    await ns.sleep(TAKT_MS);
  }
}
