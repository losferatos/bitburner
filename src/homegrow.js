/**
 * home ausbauen - Speicher und Kerne.
 *
 * WARUM DAS EIN EIGENES SKRIPT IST (23.08.2026)
 *
 * Der Ausbau stand bis heute mitten in bn4net.js. Das hat den Bot am
 * Knotenuebergang unbrauchbar gemacht, und zwar unbemerkt:
 *
 *   `SF4Cost` (RamCostGenerator.ts:82-96) gibt den Singularity-Rabatt NUR in
 *   BitNode 4. Mit SF4 Stufe 1 kostet jeder Singularity-Aufruf ausserhalb das
 *   SECHZEHNFACHE. Die vier Aufrufe des Ausbaus (upgradeHomeRam und
 *   upgradeHomeCores je SingularityFn2 = 3 GB, die beiden Kostenabfragen je
 *   1,5 GB) sind zusammen 9 GB Grundpreis - ausserhalb von BitNode 4 also
 *   144 GB. bn4net.js waere damit von 16 auf 160 GB gesprungen.
 *
 *   home startet im neuen Knoten aber bei 32 GB (Prestige.ts:241-247, mit
 *   SF1; ohne SF1 sogar 8). boot.js haette bn4net.js zwanzig Minuten lang
 *   nicht starten koennen und dann aufgegeben - der Bot haette im neuen
 *   Knoten tot gestanden. Bei 45 geplanten Uebergaengen ist das kein
 *   Randfall, das ist der Regelfall.
 *
 * Getrennt ist die Rechnung sauber: bn4net.js kommt ohne Singularity aus und
 * bleibt bei 16 GB, passt also in jedes frische home. Dieses Skript hier ist
 * gross, wird aber erst gestartet, wenn es Platz gibt - bn4net legt es wie
 * jedes andere Werkzeug auf die Werkbank, also auf einen Mietrechner. Der
 * kostet 55.000 je GB und ist lange vor dem ersten home-Ausbau da.
 *
 * Singularity-Funktionen sind spielerweit, nicht rechnergebunden - dass das
 * Skript auf einem Mietrechner laeuft, aendert an der Wirkung nichts.
 *
 * Aufruf: laeuft dauerhaft, eine Runde alle zehn Sekunden.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  // WIEVIELE KERNE, UND WARUM NICHT ACHT. Die Kosten sind 1e9 * 7,5^Kerne
  // (CoresButton.tsx:31), verachtfachen sich also praktisch je Stufe.
  // Gemessen an einem Einkommen von rund 85 Mrd/s kostet:
  //   Kern 2-4  zusammen   0,49 Bio  ~6 Sekunden Einkommen  -> +18,8 %
  //   Kern 5-6  zusammen     27 Bio  ~5 Minuten             -> +31,3 %
  //   Kern 7                180 Bio  ~35 Minuten
  //   Kern 8               1340 Bio  ~4,4 Stunden
  // Dieselbe Summe als Spende gibt Betrag/1e6 * faction_rep * 0,75
  // Reputation - Kern 8 entspraeche rund 4,4 Mrd Reputation. Das ist kein
  // Wettbewerb. Bei sechs Kernen ist Schluss.
  const KERN_PREIS_DECKEL = 3e13;

  // Nur 1,2-facher Puffer statt des dreifachen wie beim Speicher: bn4rep
  // raeumt das Konto laufend fuer Augmentierungen leer - gemessen fiel es
  // binnen Minuten von 39,5 Bio auf 0,99 Mrd. Eine Bedingung, die das
  // Dreifache verlangt, trifft ein solches Konto nie. Der Kauf ist einmalig
  // und dauerhaft, die Wartezeit auf ein volles Konto nicht.
  const KERN_PUFFER = 1.2;

  const log = [];
  const sag = (t) => {
    log.push(new Date().toLocaleTimeString() + "  " + t);
    while (log.length > 40) log.shift();
    ns.write("data/homegrow.txt", log.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/homegrow.txt", "home", ns.getHostname());
  };

  sag("Ausbauwaechter laeuft auf " + ns.getHostname() + ".");

  for (let runde = 1; ; runde++) {
    try {
      // Was bn4rep fuer bereits VERDIENTE Augmentierungen zurueckgelegt hat,
      // ist tabu. Derselbe Kanal, den auch der Serverkauf und der
      // Programmkauf lesen.
      const ruecklage = ns.fileExists("data/geldbedarf.txt", "home")
        ? Number(ns.read("data/geldbedarf.txt")) || 0 : 0;
      const geld = ns.getServerMoneyAvailable("home") - ruecklage;

      // --- Kerne zuerst -----------------------------------------------------
      // grow() und weaken() lesen die Kerne des AUSFUEHRENDEN Rechners
      // (NetscriptFunctions.ts:288), nicht die des Ziels. home traegt nach dem
      // Ausbau rund 98 Prozent aller Faeden - der Kernbonus (1 + (Kerne-1)/16)
      // wirkt damit praktisch auf das ganze Netz. Und er ist um Groessen
      // billiger als die naechste Speicherverdopplung, solange Speicher
      // brachliegt.
      const kerne = ns.getServer("home").cpuCores;
      if (kerne < 8) {
        const kernKosten = ns.singularity.getUpgradeHomeCoresCost();
        if (kernKosten <= KERN_PREIS_DECKEL && geld > kernKosten * KERN_PUFFER) {
          if (ns.singularity.upgradeHomeCores()) {
            const neu = ns.getServer("home").cpuCores;
            sag("home-Kerne auf " + neu + " (grow/weaken jetzt x"
              + (1 + (neu - 1) / 16).toFixed(3) + ").");
          }
        }
      }

      // --- dann Speicher ----------------------------------------------------
      // AMORTISATION. Die letzten beiden Verdopplungen schlugen mit rund
      // 131 Bio zu Buche, das sind 167 Mio je GB. Ein Mietrechner kostet auf
      // derselben Sprosse 409.000 je GB - Faktor 409. Deshalb wird nur
      // gekauft, wenn der Speicher auch einen Abnehmer hat: liegt mehr als
      // ein Drittel des Netzes brach, wird nicht gekauft.
      let brachAnteil = 0;
      try {
        const j = JSON.parse(ns.read("data/bn4net.json") || "{}");
        // Nur frische Zahlen. Eine alte Datei wuerde den Kauf entweder
        // dauerhaft sperren oder dauerhaft freigeben - beides falsch.
        if (typeof j.brachAnteil === "number" && Date.now() - (j.zeit || 0) < 120000) {
          brachAnteil = j.brachAnteil;
        }
      } catch { /* keine oder kaputte Datei: wie unbekannt behandeln */ }

      const kosten = ns.singularity.getUpgradeHomeRamCost();
      if (geld > kosten * 3 && brachAnteil < 0.34) {
        if (ns.singularity.upgradeHomeRam()) {
          sag("home-Speicher verdoppelt auf " + ns.getServerMaxRam("home") + " GB.");
        }
      } else if (brachAnteil >= 0.34 && runde % 60 === 0) {
        sag("Speicherausbau ausgesetzt: " + Math.round(brachAnteil * 100)
          + " Prozent des Netzes liegen brach, mehr Speicher braucht niemand.");
      }
    } catch (e) {
      // Wie in bn4net.js: eine Ausnahme darf den Waechter nicht beenden.
      sag("RUNDENFEHLER: " + String(e));
    }
    await ns.sleep(10000);
  }
}
