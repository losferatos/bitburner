/**
 * Backdoors setzen - der Weg in die Hacking-Faktionen.
 *
 * WARUM DAS DER ENGPASS IST
 *
 * Der Bot hat Geld und ein Netz, aber null Faktionen - und ohne Faktion gibt
 * es keine Augmentierungen, ohne Augmentierungen keinen Fortschritt. Die vier
 * Hacking-Faktionen laden nicht auf Zuruf ein, sondern verlangen je einen
 * Backdoor (Documentation/advanced/faction_list.md:27-30):
 *
 *     CyberSec         CSEC            ab Hacking  51
 *     NiteSec          avmnite-02h     ab Hacking 202
 *     The Black Hand   I.I.I.I         ab Hacking 340
 *     BitRunners       run4theh111z    ab Hacking 505
 *
 * Anders als in BitNode 1 braucht es dafuer keine Terminal-Bedienung ueber das
 * Dokument: ns.singularity.connect und installBackdoor tun dasselbe ueber die
 * Schnittstelle, und in BitNode 4 zum vollen Rabatt.
 *
 * WARUM EIN PFAD NOETIG IST
 *
 * connect springt nicht irgendwohin - es verbindet nur zu einem Nachbarn des
 * aktuellen Rechners oder zu home. Der Weg muss also Schritt fuer Schritt
 * gegangen werden, und dafuer braucht es erst einmal einen: Breitensuche von
 * home aus, dann die Kette entlang.
 *
 * Laeuft als Dauerauftrag: Was heute noch zu hoch ist, wird es spaeter nicht
 * mehr sein - das Hacking-Level waechst ja weiter.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // clarkinc und omnitek stehen hier nicht wegen einer Faktionseinladung,
  // sondern wegen eines Preisnachlasses. haveCompanyRep rechnet die verlangte
  // FIRMENreputation durch calculateEffectiveRequiredReputation
  // (FactionJoinCondition.ts:82-86, Company/utils.ts:15-19), und die
  // multipliziert mit CONSTANTS.CompanyRequiredReputationMultiplier = 0,75
  // (Constants.ts:110), sobald auf dem Firmenserver ein Backdoor steht -
  // erkannt ueber specialName (ServerHelpers.ts:306-313, servers.ts:192/220).
  //
  // Das gilt fuer BEIDES: die 400.000 fuer die Faktionseinladung werden zu
  // 300.000, und die 7.000 fuer die Befoerderung zum IT Analyst zu 5.250.
  // Ein Viertel des zeitlich groessten Postens des ganzen BitNode fuer einen
  // Backdoor, den der Bot ohnehin setzen kann - er verlangt nur Hacking
  // 950-1250 und fuenf Ports (servers.ts:182-187, :211ff), beides ist auf dem
  // Weg zu Daedalus (Hacking 2.500) ohnehin faellig.
  //
  // installBackdoor ist KEINE Spielerarbeit, sondern eine Wartezeit
  // (Singularity.ts:491-498 ruft netscriptDelay und fasst Player.currentWork
  // nicht an) - es reisst die laufende Firmenarbeit also nicht ab.
  //
  // ecorp, nwo und blade sind am 23.08.2026 dazugekommen, als die
  // Firmenphase auf diese drei ausgeweitet wurde. Der Grund ist derselbe wie
  // bei clarkinc und omnitek: calculateEffectiveRequiredReputation
  // (Company/utils.ts) senkt die verlangte Firmenreputation auf 75 Prozent,
  // sobald auf dem Firmenserver eine Backdoor liegt. Das sind je Firma
  // 100.000 Reputation weniger, bei gemessenen 110 je Sekunde also rund eine
  // Viertelstunde - dreimal, und der Rabatt gilt fuer jeden weiteren Durchlauf
  // dieses BitNodes mit.
  const ZIELE = ["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z", "fulcrumassets",
    "clarkinc", "omnitek", "ecorp", "nwo", "blade",
    "The-Cave", "w0r1d_d43m0n"];

  const NL = String.fromCharCode(10);
  let log = [];
  const sag = (t) => {
    const zeile = new Date().toLocaleTimeString() + "  " + t;
    ns.print(zeile);
    log.push(zeile);
    if (log.length > 100) log = log.slice(-100);
    ns.write("data/bn4door-log.txt", log.join(NL) + NL, "w");
  };
  sag("bn4door gestartet.");

  /** Weg von home zum Ziel, als Kette von Rechnernamen. */
  const pfad = (ziel) => {
    const vorgaenger = new Map([["home", null]]);
    const schlange = ["home"];
    while (schlange.length) {
      const hier = schlange.shift();
      if (hier === ziel) {
        const kette = [];
        for (let k = ziel; k !== null; k = vorgaenger.get(k)) kette.unshift(k);
        return kette;
      }
      for (const nachbar of ns.scan(hier)) {
        if (vorgaenger.has(nachbar)) continue;
        vorgaenger.set(nachbar, hier);
        schlange.push(nachbar);
      }
    }
    return null;
  };

  const erledigt = new Set();

  for (;;) {
   try {
    for (const ziel of ZIELE) {
      if (erledigt.has(ziel)) continue;

      let s;
      try { s = ns.getServer(ziel); } catch { continue; }   // noch nicht im Netz
      if (s.backdoorInstalled) { erledigt.add(ziel); continue; }

      // Beide Huerden nennen, statt still zu ueberspringen - sonst sieht
      // niemand, woran es haengt.
      if (!s.hasAdminRights) continue;
      if (s.requiredHackingSkill > ns.getHackingLevel()) continue;

      const weg = pfad(ziel);
      if (!weg) { sag("Kein Weg zu " + ziel + "."); continue; }

      for (const schritt of weg) {
        if (schritt === "home") { ns.singularity.connect("home"); continue; }
        if (!ns.singularity.connect(schritt)) {
          sag("connect auf " + schritt + " scheiterte.");
          break;
        }
      }
      if (ns.singularity.getCurrentServer() !== ziel) {
        ns.singularity.connect("home");
        continue;
      }

      sag("Setze Backdoor auf " + ziel + " (Hacking " + ns.getHackingLevel()
        + "/" + s.requiredHackingSkill + ")...");
      await ns.singularity.installBackdoor();
      ns.singularity.connect("home");

      // Der Zustand ist der Zeuge, nicht die Tatsache, dass wir es versucht
      // haben. Genau dieses Muster - ausgeloest, gemeldet, nie geprueft - hat
      // in BitNode 1 achtmal zugeschlagen.
      if (ns.getServer(ziel).backdoorInstalled) {
        erledigt.add(ziel);
        sag("BACKDOOR STEHT auf " + ziel + ".");
      } else {
        sag("Backdoor auf " + ziel + " hat NICHT gegriffen.");
      }
    }

    ns.write("data/bn4door.json", JSON.stringify({
      zeit: Date.now(),
      hacking: ns.getHackingLevel(),
      erledigt: [...erledigt],
      offen: ZIELE.filter((z) => !erledigt.has(z)),
    }), "w");
   } catch (e) {
    sag("RUNDENFEHLER: " + String(e));
    try { ns.singularity.connect("home"); } catch { /* egal */ }
   }
   await ns.sleep(30000);
  }
}
