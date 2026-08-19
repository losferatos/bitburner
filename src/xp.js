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
 * Es nimmt bewusst nur die HAELFTE des freien Speichers. Der Autopilot soll
 * weiterarbeiten koennen - sein Ertrag zahlt die NeuroFlux-Stufen, die kurz
 * vor dem Reset gekauft werden.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  ns.ui.setTailMinimized?.(true);

  const WORKER = "worker/weaken.js";
  const ANTEIL = 0.7; // Anteil der Gesamtgroesse je Rechner fuer die Muehle
  const HOME_FREI = 2; // home gehoert dem Autopiloten

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

    let gestartet = 0;
    for (const host of netz) {
      if (!ns.hasRootAccess(host)) continue;
      const max = ns.getServerMaxRam(host);
      if (max <= 0) continue;
      const belegt = ns.getServerUsedRam(host) + (host === "home" ? HOME_FREI : 0);
      // Obergrenze auf die GESAMTGROESSE beziehen, nicht auf den freien Rest:
      // sonst nimmt die Muehle bei jedem Durchgang die Haelfte des Restes und
      // laeuft gegen volle Belegung - der Autopilot wuerde verhungern.
      const budget = max * ANTEIL - belegt;
      const threads = Math.floor(budget / kosten);
      if (threads < 1) continue;
      if (!ns.fileExists(WORKER, host)) ns.scp(WORKER, host, "home");
      if (ns.exec(WORKER, host, threads, ziel.host, 0, "xp-" + Date.now())) gestartet += threads;
    }

    ns.print("Muehle: " + gestartet + " weaken-Faeden auf " + ziel.host
      + " (" + (ziel.wert).toFixed(2) + " Erfahrung je Sekunde und Faden, "
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
