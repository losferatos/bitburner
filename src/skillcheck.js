/** Warum kauft der Motor die Faehigkeit, die er kauft?
 *
 * Am 27.08.2026 um 18:55 wurde Digital Observer in die dynamische Sortierung
 * von `blade.js` aufgenommen und im Plan vor Blade's Intuition gesetzt. Sein
 * Nutzen je Punkt liegt bei 0,423 gegen 0,031 - Faktor 13,8. Trotzdem stand
 * er um 19:10 noch auf Stufe 1, waehrend Blade's Intuition mit 56
 * verfuegbaren Punkten von 26 auf 29 stieg.
 *
 * Dieses Skript rechnet dieselben Werte im Spiel nach und gibt sie aus. Es
 * beantwortet in einem Lauf, was Codelesen nicht kann: Greift die Sortierung
 * ueberhaupt, und wenn ja, mit welchen Zahlen?
 *
 * Ergebnis nach data/skillcheck.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  if (!ns.bladeburner.inBladeburner()) return;

  // Wortgleich aus blade.js - wenn sich dort etwas aendert, gehoert es hier
  // nachgezogen. Bewusst kopiert statt importiert: Ein Importfehler wuerde
  // den Motor mitreissen, und dieses Skript soll ihn pruefen, nicht gefaehrden.
  const CHANCE_SKILLS = {
    "Blade's Intuition": { proz: 3, abdeckung: 1.0 },
    "Short-Circuit": { proz: 5.5, abdeckung: 0.55 },
    "Digital Observer": { proz: 4, abdeckung: 0.44 },
  };
  const DYNAMISCH = ["Hyperdrive", "Short-Circuit", "Blade's Intuition",
    "Reaper", "Evasive System", "Digital Observer"];
  const DECKEL = {
    "Hyperdrive": 7, "Cyber's Edge": 5, "Tracer": 14, "Short-Circuit": 30,
    "Evasive System": 17, "Reaper": 16, "Digital Observer": Infinity,
    "Blade's Intuition": Infinity, "Cloak": Infinity, "Overclock": 90,
  };

  const relNutzen = (name) => {
    const stufe = ns.bladeburner.getSkillLevel(name);
    if (name === "Hyperdrive") {
      const a = 1 + stufe * 0.1;
      const lvlPlus = 32 * Math.log((a + 0.1) / a);
      let basis = 1;
      try { basis = Math.max(1, ns.getPlayer().skills.defense); } catch { /* egal */ }
      return 100 * (Math.pow((basis + lvlPlus) / basis, 0.9) - 1);
    }
    if (name === "Reaper" || name === "Evasive System") {
      const sk = ns.getPlayer().skills;
      const r = ns.bladeburner.getSkillLevel("Reaper");
      const e = ns.bladeburner.getSkillLevel("Evasive System");
      const comp = (rr, ee) => {
        const a = 1 + rr * 0.02, b = 1 + rr * 0.02 + ee * 0.04;
        return Math.pow(sk.strength * a, 0.8) + Math.pow(sk.defense * a, 0.8)
          + Math.pow(sk.dexterity * b, 0.8) + Math.pow(sk.agility * b, 0.8);
      };
      const jetzt = comp(r, e);
      if (!(jetzt > 0)) return 0;
      const danach = name === "Reaper" ? comp(r + 1, e) : comp(r, e + 1);
      return 100 * (danach / jetzt - 1);
    }
    const c = CHANCE_SKILLS[name];
    if (!c) return 0;
    const a = 1 + stufe * c.proz / 100;
    return 100 * ((a + c.proz / 100) / a - 1) * c.abdeckung;
  };

  const zeilen = [];
  for (const name of DYNAMISCH) {
    let stufe = 0, preis = 0;
    try { stufe = ns.bladeburner.getSkillLevel(name); } catch { /* unbekannt */ }
    try { preis = ns.bladeburner.getSkillUpgradeCost(name, 1); } catch { /* unbekannt */ }
    const deckel = DECKEL[name] ?? Infinity;
    const amDeckel = stufe >= deckel;
    const nutzen = relNutzen(name);
    zeilen.push({
      name, stufe, preis, deckel: deckel === Infinity ? null : deckel, amDeckel,
      relNutzen: nutzen,
      wert: amDeckel ? -1 : (preis > 0 ? nutzen / preis : -1),
    });
  }
  zeilen.sort((a, b) => b.wert - a.wert);

  ns.write("data/skillcheck.json", JSON.stringify({
    zeit: Date.now(),
    punkte: ns.bladeburner.getSkillPoints(),
    rangfolge: zeilen,
  }), "w");
}
