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
import { hackNutzen } from "lib/hackaugs.js";

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
    const geld = ns.getServerMoneyAvailable("home");

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

    if (wartend >= MINDEST_WARTESCHLANGE
        && (kleinsteLuecke > LUECKE_ZU_GROSS || geldWegZu)
        && ns.fileExists("data/install-frei.txt", "home")) {
      sag("EINBAU: " + wartend + " Augmentierungen. Grund: "
        + (geldWegZu ? "naechstes Stueck kostet "
            + Math.round(teuerstesVerdiente / 1e6) + "m bei "
            + Math.round(geld / 1e6) + "m Guthaben"
          : "naechste Huerde erst in " + Math.round(kleinsteLuecke) + " Reputation") + ". "
        + "bn4life.js startet danach von selbst.");
      await ns.sleep(1500);
      ns.singularity.installAugmentations("bn4life.js");
      return;   // ab hier laeuft dieses Skript ohnehin nicht mehr
    }

    // --- 2. Kaufen, was bezahlt und verdient ist ------------------------------
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
    const alleOffenen = kandidaten.filter((k) => k.rep < k.repReq);
    const nachNaehe = (a, b) => (a.repReq - a.rep) - (b.repReq - b.rep);
    const nuetzlich = alleOffenen.filter((k) => hackNutzen(k.aug) > 0).sort(nachNaehe);
    const offen = nuetzlich.length ? nuetzlich : alleOffenen.sort(nachNaehe);

    if (!offen.length) { await ns.sleep(20000); continue; }

    const ziel = offen[0];

    // --- Spendenweg, sobald eine Faktion Favor 150 hat ------------------------
    // Ab dieser Marke bringt Geld direkt Reputation:
    //     rep = betrag / 1e6 * mults.faction_rep     (Faction/formulas/donation.ts)
    // Fuer einen Bot, der Hunderttausende je Minute aus Coding Contracts zieht
    // und dessen Engpass die Reputation ist, kehrt das die Wirtschaft um:
    // Zeit wird durch Geld ersetzbar. Solange keine Faktion so weit ist, bleibt
    // es bei der Arbeit - der Aufruf waere sonst nur ein teurer Fehlschlag.
    if (favor[ziel.faktion] >= ns.getFavorToDonate()) {
      const uebrig = ns.getServerMoneyAvailable("home") - teuerstesVerdiente;
      if (uebrig > 1e9) {
        if (ns.singularity.donateToFaction(ziel.faktion, uebrig)) {
          sag("GESPENDET: " + Math.round(uebrig / 1e6) + "m an " + ziel.faktion
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
      const typen = ns.singularity.getFactionWorkTypes(ziel.faktion);
      const art = typen.includes("hacking") ? "hacking"
        : typen.includes("field") ? "field" : typen[0];
      if (ns.singularity.workForFaction(ziel.faktion, art, true)) {
        sag("Arbeite fuer " + ziel.faktion + " (" + art + ") auf "
          + "[Nutzen " + hackNutzen(ziel.aug).toFixed(2) + "] "
          + ziel.aug + ": " + Math.round(ziel.rep) + " von "
          + Math.round(ziel.repReq) + " Reputation.");
      } else {
        sag("workForFaction(" + ziel.faktion + ", " + art + ") abgelehnt.");
        try { ns.rm("data/rep-modus.txt", "home"); } catch { /* lag nie dort */ }
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

    // Summe ueber alle Faktionen. Die Reputation des aktuellen Ziels taugt
    // nicht zur Fortschrittsmessung: Sie springt bei jedem Zielwechsel zurueck,
    // und die Ueberwachung meldete deshalb negative Raten, obwohl der Bot
    // fleissig war. Die Summe faellt nur beim Einbau, und der ist ein
    // Fortschritt, kein Stillstand.
    const repGesamt = spieler.factions
      .reduce((n, f) => n + ns.singularity.getFactionRep(f), 0);

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

    ns.write("data/bn4rep.json", JSON.stringify({
      zeit: Date.now(),
      repGesamt,
      favor,
      favorBeste,
      favorBesteFaktion,
      spendenSchwelle: ns.getFavorToDonate(),
      faktionen: spieler.factions,
      ziel: ziel.aug,
      zielFaktion: ziel.faktion,
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
