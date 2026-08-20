/**
 * Was hat uns die Faustformel gekostet? Eine Messung, kein Umbau.
 *
 * Seit dem Kauf von Formulas.exe steht die exakte Rechnung zur Verfuegung.
 * Bevor der Verwalter darauf umgestellt wird, gehoert gemessen, WIE falsch er
 * bisher lag - sonst baut man auf Verdacht um und weiss hinterher nicht, ob es
 * etwas gebracht hat.
 *
 * Verglichen wird fuer die lohnendsten Ziele:
 *
 *  - growthAnalyze gegen formulas.hacking.growThreads. Der Unterschied ist
 *    grundsaetzlich: growthAnalyze rechnet mit dem HEUTIGEN Sicherheitswert
 *    des Servers, growThreads mit dem Zustand, den der Server zum Zeitpunkt
 *    des Wachstums haben WIRD. In einem Stapel wird zuerst gehackt - der
 *    Server steht beim Wachsen also auf einem anderen Geldstand als beim
 *    Planen.
 *
 *  - hackChance und hackPercent gegen den vorbereiteten Zustand (minSecurity),
 *    denn genau dort landet der Hack-Faden im Stapel.
 *
 * Schreibt den Vergleich nach data/formcheck.txt.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/formcheck.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/formcheck.txt", "home", ns.getHostname());
  };

  if (!ns.fileExists("Formulas.exe", "home")) return sag("Formulas.exe fehlt - nichts zu messen.");

  // Alle Rechner einsammeln.
  const gesehen = new Set(["home"]);
  const schlange = ["home"];
  while (schlange.length) {
    const hier = schlange.shift();
    for (const nachbar of ns.scan(hier)) {
      if (gesehen.has(nachbar)) continue;
      gesehen.add(nachbar);
      schlange.push(nachbar);
    }
  }

  const spieler = ns.getPlayer();
  const ziele = [...gesehen]
    .filter((h) => h !== "home" && !h.startsWith("bot-"))
    .map((h) => ns.getServer(h))
    .filter((s) => s.hasAdminRights && (s.moneyMax || 0) > 0
      && s.requiredHackingSkill <= spieler.skills.hacking)
    .sort((a, b) => b.moneyMax - a.moneyMax)
    .slice(0, 8);

  sag("Ziel                 heute(grow)   exakt(grow)   Abweichung   hackChance   hackPct");
  sag("-".repeat(84));

  let summeHeute = 0;
  let summeExakt = 0;
  for (const s of ziele) {
    // So plant der Verwalter heute: growthAnalyze auf dem Server, wie er
    // gerade dasteht, fuer den Faktor "von halb auf voll".
    const faktor = 2;
    let heute = Infinity;
    try { heute = ns.growthAnalyze(s.hostname, faktor, 1); } catch (e) { /* nicht rootbar */ }

    // So waere es richtig: der Server, wie er im Stapel vorliegt - auf
    // Mindestsicherheit vorbereitet, das Geld nach dem Hack auf der Haelfte.
    const kopie = ns.getServer(s.hostname);
    kopie.hackDifficulty = kopie.minDifficulty;
    kopie.moneyAvailable = kopie.moneyMax / faktor;
    const exakt = ns.formulas.hacking.growThreads(kopie, spieler, kopie.moneyMax, 1);

    const chance = ns.formulas.hacking.hackChance(kopie, spieler);
    const pct = ns.formulas.hacking.hackPercent(kopie, spieler);

    summeHeute += Number.isFinite(heute) ? Math.ceil(heute) : 0;
    summeExakt += exakt;

    const abw = Number.isFinite(heute) && heute > 0
      ? ((exakt / Math.ceil(heute) - 1) * 100).toFixed(1) + " %" : "--";
    sag(s.hostname.padEnd(20)
      + String(Number.isFinite(heute) ? Math.ceil(heute) : "--").padStart(11)
      + String(exakt).padStart(14)
      + abw.padStart(13)
      + (chance * 100).toFixed(1).padStart(12) + " %"
      + (pct * 100).toFixed(2).padStart(9) + " %");
  }

  sag("-".repeat(84));
  sag("Summe Grow-Faeden heute " + summeHeute + ", exakt " + summeExakt
    + " (" + ((summeExakt / Math.max(1, summeHeute) - 1) * 100).toFixed(1) + " %)");

  // Und die zweite Frage: Was traegt die Faktionsarbeit wirklich ein?
  //
  // factionGains(person, workType, favor) - der Favor gehoert als DRITTES
  // Argument hinein, weil er als (1 + favor/100) direkt in die Rate eingeht
  // (Formulas.ts:403-411 reicht ihn an calculateFactionRep durch). Wer ihn
  // weglaesst, vergleicht Faktionen ohne den Vorteil, den man sich bei ihnen
  // erarbeitet hat - und das ist genau der Unterschied, um den es geht.
  const favorVon = {};
  try {
    for (const f of ns.getPlayer().factions) favorVon[f] = ns.getFactionFavor?.(f) ?? 0;
  } catch (e) { /* getFactionFavor braucht Singularity - dann eben ohne */ }

  sag("");
  sag("Reputation je Sekunde, je Arbeitsart (Fokus 1,0, ohne Share-Bonus):");
  sag("Faktion            favor   hacking      field    security");
  for (const f of ns.getPlayer().factions) {
    const favor = favorVon[f] || 0;
    const raten = [];
    for (const art of ["hacking", "field", "security"]) {
      try {
        const g = ns.formulas.work.factionGains(spieler, art, favor);
        // factionGains liefert den Gewinn je Spielzyklus; fuenf davon
        // ergeben eine Sekunde.
        raten.push((g.reputation * 5).toFixed(3));
      } catch (e) { raten.push("--"); }
    }
    sag("  " + f.padEnd(18) + String(favor.toFixed ? favor.toFixed(1) : favor).padStart(5)
      + raten[0].padStart(10) + raten[1].padStart(11) + raten[2].padStart(12));
  }

  // Und der Nebenfund aus der Tabelle oben: die Trefferquote. Faellt sie
  // deutlich unter 100 %, geht jeder zweite Hack-Faden ins Leere - das waere
  // ein groesserer Hebel als jede Faedenersparnis.
  const chancen = ziele.map((s) => {
    const k = ns.getServer(s.hostname);
    k.hackDifficulty = k.minDifficulty;
    return ns.formulas.hacking.hackChance(k, spieler);
  });
  const mittel = chancen.reduce((a, b) => a + b, 0) / Math.max(1, chancen.length);
  sag("");
  sag("Mittlere Trefferquote der Ziele: " + (mittel * 100).toFixed(1) + " %"
    + (mittel < 0.9 ? "  <-- jeder Fehlschlag holt NICHTS, kostet aber die volle Laufzeit" : ""));
}
