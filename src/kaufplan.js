/**
 * Kaufplan: was ist bei der aktuellen Warteschlange noch bezahlbar?
 *
 * Jeder Kauf verteuert JEDEN weiteren um Faktor 1,9
 * (AugmentationHelpers.ts, getGenericAugmentationPriceMultiplier). Bei acht
 * bereits wartenden Stuecken steht ein Neukauf auf Position 9, der Grundpreis
 * also mal 1,9^8 = 169. Das entscheidet, ob vor dem naechsten Kauf eingebaut
 * werden muss - der Einbau setzt den Zaehler zurueck, kostet aber das ganze
 * gekaufte Servernetz (Prestige.ts:74).
 *
 * Rechnet beide Wege durch und nennt die Zahl, statt sie zu schaetzen.
 *
 * Aufruf: node tools/task.js kaufplan.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const s = ns.singularity;
  const z = [];
  try {
    const p = ns.getPlayer();
    const eingebaut = new Set(s.getOwnedAugmentations(false));
    const gekauft = s.getOwnedAugmentations(true);
    const wartend = gekauft.filter((a) => !eingebaut.has(a)).length;
    const geld = p.money;

    z.push(`Eingebaut ${eingebaut.size} | wartend ${wartend} | zusammen ${gekauft.length} | bis 30 fehlen ${Math.max(0, 30 - gekauft.length)}`);
    z.push(`Geld ${ns.format.number(geld)}`);
    z.push("");

    // Alle offenen Kandidaten aus den eigenen Faktionen, mit Grundpreis.
    const besitz = new Set(gekauft);
    const kand = [];
    for (const f of p.factions) {
      const rep = s.getFactionRep(f);
      for (const a of s.getAugmentationsFromFaction(f)) {
        if (besitz.has(a) || a === "NeuroFlux Governor") continue;
        const rr = s.getAugmentationRepReq(a);
        if (kand.some((k) => k.a === a)) continue;
        kand.push({ a, f, rr, luecke: Math.max(0, rr - rep), roh: s.getAugmentationPrice(a) });
      }
    }

    // getAugmentationPrice liefert den Preis MIT dem aktuellen Aufschlag.
    // Der Grundpreis ergibt sich durch Herausrechnen von 1,9^wartend.
    const aufschlag = Math.pow(1.9, wartend);
    for (const k of kand) k.basis = k.roh / aufschlag;

    // Reihenfolge: erst die mit der kleinsten Reputationsluecke, denn die
    // sind zuerst verdient. Innerhalb dessen die teuersten zuerst - jedes
    // gekaufte Stueck verteuert die folgenden, also das Teure frueh.
    const erreichbar = kand.filter((k) => k.luecke === 0).sort((a, b) => b.basis - a.basis);
    const bald = kand.filter((k) => k.luecke > 0 && k.luecke <= 25000).sort((a, b) => a.luecke - b.luecke);

    function durchrechnen(liste, startPos, budget, titel) {
      z.push(titel);
      let pos = startPos, rest = budget, n = 0;
      for (const k of liste) {
        const preis = k.basis * Math.pow(1.9, pos);
        if (preis > rest) {
          z.push(`  STOP bei ${k.a}: kostet ${ns.format.number(preis)}, uebrig ${ns.format.number(rest)}`);
          break;
        }
        rest -= preis; pos++; n++;
        z.push(`  ${n}. ${k.a} (${k.f}) | ${ns.format.number(preis)} | Rest ${ns.format.number(rest)}`);
      }
      z.push(`  => ${n} Stueck kaufbar.`);
      return n;
    }

    z.push(`Aufschlag jetzt: 1,9^${wartend} = ${aufschlag.toFixed(1)}x`);
    z.push("");
    const jetztKaufbar = durchrechnen(erreichbar, wartend, geld, "A) OHNE Einbau, nur schon verdiente:");
    z.push("");
    durchrechnen(erreichbar, 0, geld, "B) NACH Einbau (Zaehler auf 0, aber Netz weg):");
    z.push("");
    z.push("Naechste Reputationsziele (Luecke <= 25.000):");
    for (const k of bald.slice(0, 12)) {
      z.push(`  ${ns.format.number(k.luecke)} | ${k.a} (${k.f}) | Grundpreis ${ns.format.number(k.basis)}`);
    }
    z.push("");
    z.push(`Sofort verdient und kaufbar ohne Einbau: ${jetztKaufbar}`);
  } catch (e) {
    z.push("FEHLER: " + String(e && e.message ? e.message : e));
  }
  const t = z.join("\n");
  ns.write("data/kaufplan.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/kaufplan.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
