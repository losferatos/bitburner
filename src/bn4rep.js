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

  const geldText = (n) => {
    for (const [t, k] of [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]]) {
      if (Math.abs(n) >= t) return "$" + (n / t).toFixed(2) + k;
    }
    return "$" + n.toFixed(0);
  };

  for (;;) {
   try {
    const spieler = ns.getPlayer();
    const besitz = new Set(ns.singularity.getOwnedAugmentations(true));

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

    if (!kandidaten.length) {
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
    const MINDEST_WARTESCHLANGE = 3;
    const LUECKE_ZU_GROSS = 15000;   // Reputation; bei ~40/min ueber sechs Stunden
    const wartend = ns.singularity.getOwnedAugmentations(true).length
      - ns.singularity.getOwnedAugmentations(false).length;
    const kleinsteLuecke = Math.min(Infinity, ...kandidaten
      .filter((k) => k.rep < k.repReq).map((k) => k.repReq - k.rep));
    if (wartend >= MINDEST_WARTESCHLANGE
        && kleinsteLuecke > LUECKE_ZU_GROSS
        && ns.fileExists("data/install-frei.txt", "home")) {
      sag("EINBAU: " + wartend + " Augmentierungen, naechste Huerde erst in "
        + Math.round(kleinsteLuecke) + " Reputation. "
        + "bn4life.js startet danach von selbst.");
      await ns.sleep(1500);
      ns.singularity.installAugmentations("bn4life.js");
      return;   // ab hier laeuft dieses Skript ohnehin nicht mehr
    }

    // --- 2. Kaufen, was bezahlt und verdient ist ------------------------------
    const geld = ns.getServerMoneyAvailable("home");
    let gekauft = 0;
    for (const k of kandidaten.slice().sort((a, b) => a.preis - b.preis)) {
      if (k.rep < k.repReq) continue;
      if (ns.getServerMoneyAvailable("home") < k.preis) continue;
      if (ns.singularity.purchaseAugmentation(k.faktion, k.aug)) {
        sag("GEKAUFT: " + k.aug + " von " + k.faktion + " fuer " + geldText(k.preis) + ".");
        gekauft++;
      }
    }
    if (gekauft) { await ns.sleep(2000); continue; }   // Preise haben sich verschoben

    // --- 3. Sonst: an der naechsterreichbaren Huerde arbeiten -----------------
    // Die kleinste Luecke zuerst. Wer am teuersten Ziel arbeitet, hat lange
    // gar nichts; wer am naechsten arbeitet, kauft frueh und oft.
    const offen = kandidaten
      .filter((k) => k.rep < k.repReq)
      .sort((a, b) => (a.repReq - a.rep) - (b.repReq - b.rep));

    if (!offen.length) { await ns.sleep(20000); continue; }

    const ziel = offen[0];
    const arbeit = ns.singularity.getCurrentWork();
    const arbeitetSchon = arbeit && arbeit.factionName === ziel.faktion;

    if (!arbeitetSchon) {
      // Bremse VOR dem Arbeitsbeginn setzen, nicht danach: Zwischen Start und
      // Datei liegt sonst ein Fenster, in dem bn4life ein Verbrechen
      // dazwischenschiebt.
      ns.write("data/rep-modus.txt", ziel.faktion, "w");
      await ns.sleep(1200);
      const typen = ns.singularity.getFactionWorkTypes(ziel.faktion);
      const art = typen.includes("hacking") ? "hacking"
        : typen.includes("field") ? "field" : typen[0];
      if (ns.singularity.workForFaction(ziel.faktion, art, true)) {
        sag("Arbeite fuer " + ziel.faktion + " (" + art + ") auf "
          + ziel.aug + ": " + Math.round(ziel.rep) + " von "
          + Math.round(ziel.repReq) + " Reputation.");
      } else {
        sag("workForFaction(" + ziel.faktion + ", " + art + ") abgelehnt.");
        ns.rm("data/rep-modus.txt", "home");
      }
    }

    // Geldbedarf nach home melden. bn4net.js kauft sonst Rechner von dem Geld,
    // das hier fuer eine bereits verdiente Augmentierung gebraucht wird - und
    // Augmentierungen sind dauerhafter Fortschritt, Rechenzeit ist es nicht.
    // Der Umweg ueber scp ist noetig, weil dieses Skript auf der Werkbank
    // laeuft und ns.write nur lokal schreibt.
    const bedarf = kandidaten
      .filter((k) => k.rep >= k.repReq)
      .reduce((n, k) => n + k.preis, 0);
    ns.write("data/geldbedarf.txt", String(Math.round(bedarf)), "w");
    if (ns.getHostname() !== "home") ns.scp("data/geldbedarf.txt", "home", ns.getHostname());

    ns.write("data/bn4rep.json", JSON.stringify({
      zeit: Date.now(),
      faktionen: spieler.factions,
      ziel: ziel.aug,
      zielFaktion: ziel.faktion,
      rep: Math.round(ziel.rep),
      repReq: Math.round(ziel.repReq),
      preis: ziel.preis,
      offen: offen.length,
      kaufbereit: kandidaten.filter((k) => k.rep >= k.repReq).length,
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
