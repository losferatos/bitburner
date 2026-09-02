/**
 * Kaltstart-Verbrechen fuer die Sleeves - 5,6 GB, damit es neben bn4net und
 * ausgang.js auf ein frisches 32-GB-home passt.
 *
 * WARUM (02.09.2026, Substanz-Skeptiker zum Kaltstart)
 *
 * Nach einem Knotenwechsel passt sleeve.js (~28 GB) nirgends, und die
 * Sleeves stehen auf Shock Recovery - Leerlauf. Zwei Sleeves auf Shoplift
 * bringen im Kaltstart (Skill 1, CrimeMoney 0,5) rund 3,6 Mio je Stunde und
 * Sleeve; die 8,8 Mio fuer den ersten Mietrechner in BitNode 10 kommen so in
 * ~1,3 h statt in ~11 h aus dem Hacking allein. Shoplift, nicht Mug: bei
 * Skill 1 ist die Mug-Chance 0,021 gegen 0,042 - der Kreuzungspunkt liegt
 * bei Skill ~40, und dann laeuft laengst sleeve.js.
 *
 * Genau EINE Sleeve-Funktion (setToCommitCrime, 4 GB) - jede weitere kostet
 * 4 GB und spraengt den Rahmen. Beendet sich, sobald sleeve.js irgendwo
 * laeuft; gibt es keine Sleeves (Index 0 wirft), legt es data/keine-sleeves.txt
 * mit der Knotennummer ab, damit bn4net es in diesem Knoten nicht mehr startet.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const TAKT_MS = 60000;
  const VERBRECHEN = "Shoplift";

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
  const sleeveJsLaeuft = () => netz().some((h) => {
    try { return ns.ps(h).some((p) => p.filename === "sleeve.js"); } catch { return false; }
  });

  while (true) {
    if (sleeveJsLaeuft()) {
      ns.print("sleeve.js laeuft - sleevecrime.js beendet sich.");
      return;
    }
    let gesetzt = 0;
    for (let i = 0; i < 8; i++) {
      try { if (ns.sleeve.setToCommitCrime(i, VERBRECHEN)) gesetzt++; }
      catch {
        if (i === 0) {
          // Keine Sleeves in diesem Knoten: Marker fuer bn4net, sonst wuerde es
          // dieses Skript jede Runde neu starten.
          let knoten = 0;
          try { knoten = ns.getResetInfo().currentNode; } catch { knoten = 0; }
          ns.write("data/keine-sleeves.txt", String(knoten), "w");
          if (ns.getHostname() !== "home") { try { ns.scp("data/keine-sleeves.txt", "home", ns.getHostname()); } catch { /* egal */ } }
          ns.print("Keine Sleeves - Marker gesetzt, beende mich.");
          return;
        }
        break;
      }
    }
    ns.print(gesetzt + " Sleeve(s) auf " + VERBRECHEN + ".");
    await ns.sleep(TAKT_MS);
  }
}
