/**
 * Erfahrungsmuehle.
 *
 * Warum das noetig ist: Nach dem Reset ist alles Geld und jeder Server weg -
 * was bleibt, sind die installierten Augmentations. Der Engpass davor ist
 * also nicht Geld, sondern **Reputation**, und die Reputationsrate der
 * Faktionsarbeit haengt fast linear am Hacking-Level. Ein hoeheres Level
 * bringt uns schneller an die 12.500 Reputation und damit frueher in den
 * naechsten Zyklus.
 *
 * Gleichzeitig lag der Speicher brach: 153 von 168 TB frei, weil bei
 * Hacking ~270 schlicht nicht genug Server hackbar sind, um so viel
 * Kapazitaet in Ertrag umzusetzen. Dieses Skript macht aus dem Ueberschuss
 * Erfahrung.
 *
 * `weaken` ist dafuer das richtige Werkzeug: es gibt Erfahrung unabhaengig
 * davon, ob es etwas bewirkt, es kann nichts kaputtmachen (Sicherheit sinkt
 * nur) und es braucht kein vorbereitetes Ziel.
 *
 * Sie ist ein VERWERTER VON LEERLAUF, kein Mitbewerber. Frueher stand hier ein
 * fester Anteil von 0.7 der Gesamtgroesse je Rechner - eine Zahl, die zu den
 * damals 153 freien von 168 TB passte und sonst zu nichts. Nach einem Reset
 * hat dieselbe Zahl 70 Prozent eines 116-GB-Netzes an sich gerissen, das der
 * Autopilot dringend fuer die Ernte gebraucht haette, und auf foodnstuff
 * (16 GB) blieben 4.8 GB uebrig - der Verwalter mit seinen rund 11 GB hat
 * dort NIE mehr hineingepasst.
 *
 * Deshalb zwei Regeln:
 *  1. Der Anteil leitet sich aus dem Leerlauf des Netzes ab. Ist alles
 *     ausgelastet, nimmt die Muehle nichts. Erst was ueber einem Zehntel
 *     Leerlauf liegt, gilt als Ueberschuss.
 *  2. Auf jedem Rechner bleibt ein Mindestfreiraum stehen, gross genug fuer
 *     den groessten Einzelprozess des Autopiloten. Sonst findet der Verwalter
 *     nirgends mehr Platz und der Autopilot raeumt zur Strafe Rechner leer.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.setTailMinimized?.(true);

  const WORKER = "worker/weaken.js";
  // Obergrenze des Anteils - erreicht wird sie nur bei fast leerem Netz.
  const SHARE_MAX = 0.7;
  // Leerlauf, der dem Autopiloten gehoert. Erst darueber beginnt der Ueberschuss.
  const IDLE_KEEP = 0.1;
  // Mindestfreiraum je Rechner in GB. Bemessen am Verwalter (rund 11 GB) -
  // er muss immer irgendwo unterkommen koennen.
  const MIN_FREE = 12;
  // home ist enger: dort laeuft der Autopilot selbst und braucht Luft.
  const MIN_FREE_HOME = 16;

  while (true) {
    const netz = erfasse(ns);
    const kosten = ns.getScriptRam(WORKER, "home");

    // Ziel ist NICHT der schwerste Rechner - das war ein teurer Denkfehler.
    // Die Erfahrung je Aufruf ist `3 + Grundschwierigkeit * 0.3`
    // (Hacking.ts:30-38), zwischen leichtestem und schwerstem Server also
    // hoechstens Faktor zehn. Die DAUER dagegen waechst mit
    // `benoetigtes Level * Schwierigkeit` - beim schwersten Rechner um das
    // Zehntausendfache. Entscheidend ist der Quotient: Erfahrung je Sekunde.
    let ziel = null;
    for (const host of netz) {
      // HACKNET-SERVER UEBERSPRINGEN (22.09.2026).
      // Sie haengen an home und kommen aus ns.scan mit heraus. Gut zwei Dutzend
      // ns-Funktionen werfen auf ihnen (getNormalServer,
      // NetscriptHelpers.tsx:575-589); hasRootAccess gehoert NICHT dazu und
      // gibt true (PlayerObjectServerMethods.ts:50) - eine Root-Pruefung
      // allein schuetzt also nicht.
      // Hier faellt es sofort aus: getServerRequiredHackingLevel in der
      // naechsten Zeile wirft. Als Erfahrungsziel taugen sie auch nicht,
      // sie haben keine Sicherheitsstufe, gegen die weaken liefe.
      if (host.startsWith("hacknet-server-")) continue;
      if (!ns.hasRootAccess(host)) continue;
      if (ns.getServerRequiredHackingLevel(host) > ns.getHackingLevel()) continue;
      const schwer = ns.getServerBaseSecurityLevel(host);
      if (!schwer) continue;
      const dauer = ns.getWeakenTime(host);
      if (!dauer || !Number.isFinite(dauer)) continue;
      const wert = (3 + schwer * 0.3) / (dauer / 1000);
      if (!ziel || wert > ziel.wert) ziel = { host, schwer, dauer, wert };
    }
    if (!ziel) { await ns.sleep(10000); continue; }

    // Leerlauf des ganzen Netzes messen. Das ist der einzige ehrliche Massstab
    // dafuer, ob hier ueberhaupt etwas zu holen ist: nach einem Reset ist alles
    // belegt, und dann hat die Muehle nichts verloren.
    let ramTotal = 0;
    let ramIdle = 0;
    for (const host of netz) {
      // Hacknet-Server raus (22.09.2026). Hier wirft nichts - aber ihr
      // Speicher zaehlte in ramTotal und ramIdle mit, und aus dem
      // Verhaeltnis wird der Anteil der Muehle berechnet. Da sie
      // dauerhaft leer sind, hob das den gemessenen Leerlauf und liess
      // die Muehle mehr Faeden starten, als das Netz wirklich frei hat.
      if (host.startsWith("hacknet-server-")) continue;
      if (!ns.hasRootAccess(host)) continue;
      const max = ns.getServerMaxRam(host);
      if (max <= 0) continue;
      ramTotal += max;
      ramIdle += Math.max(0, max - ns.getServerUsedRam(host));
    }
    const anteil = ramTotal > 0
      ? Math.max(0, Math.min(SHARE_MAX, ramIdle / ramTotal - IDLE_KEEP))
      : 0;

    if (anteil <= 0) {
      ns.print("Muehle pausiert: nur " + (100 * ramIdle / Math.max(1, ramTotal)).toFixed(1)
        + "% Leerlauf im Netz - der Autopilot braucht den Speicher selbst.");
      await ns.sleep(15000);
      continue;
    }

    let gestartet = 0;
    for (const host of netz) {
      // Hacknet-Server raus (22.09.2026). Auch hier wirft nichts, und
      // genau deshalb ist es teuer: die Muehle wuerde dort Faeden von
      // worker/weaken.js starten (WORKER, Zeile 42 - NICHT share, das stand
      // hier zuerst falsch). Belegter Speicher drueckt die Hash-Rate linear
      // (ramRatio = 1 - ramUsed/maxRam, HacknetServers.ts:14); bei einem
      // frischen 1-GB-Server (HacknetServer.ts:61) auf null.
      if (host.startsWith("hacknet-server-")) continue;
      if (!ns.hasRootAccess(host)) continue;
      const max = ns.getServerMaxRam(host);
      if (max <= 0) continue;
      const belegt = ns.getServerUsedRam(host);
      const frei = Math.max(0, max - belegt);
      const mindest = host === "home" ? MIN_FREE_HOME : MIN_FREE;
      // Zwei Schranken, die kleinere gilt:
      //  - der Anteil, bezogen auf die GESAMTGROESSE (nicht auf den freien
      //    Rest, sonst nimmt die Muehle bei jedem Durchgang wieder einen
      //    Anteil des Restes und laeuft gegen volle Belegung),
      //  - der Mindestfreiraum, damit auf dem Rechner noch etwas anderes
      //    starten kann.
      const budget = Math.min(max * anteil - belegt, frei - mindest);
      const threads = Math.floor(budget / kosten);
      if (threads < 1) continue;
      if (!ns.fileExists(WORKER, host)) ns.scp(WORKER, host, "home");
      if (ns.exec(WORKER, host, threads, ziel.host, 0, "xp-" + Date.now())) gestartet += threads;
    }

    ns.print("Muehle: " + gestartet + " weaken-Faeden auf " + ziel.host
      + " (Anteil " + (100 * anteil).toFixed(0) + "% bei "
      + (100 * ramIdle / Math.max(1, ramTotal)).toFixed(0) + "% Leerlauf, "
      + (ziel.wert).toFixed(2) + " Erfahrung je Sekunde und Faden, "
      + Math.round(ziel.dauer / 1000) + "s Laufzeit)");
    await ns.sleep(15000);
  }
}

/** Das ganze Netz per Breitensuche ab home. */
function erfasse(ns) {
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
}
