/**
 * Ruestet die Werkbank auf, damit bn4rep.js wieder Platz findet.
 *
 * WARUM ES DIESES SKRIPT GIBT (26.08.2026, 18:20)
 *
 * Nach dem Augmentierungs-Einbau um 16:31 lief bn4rep.js nicht mehr. Der
 * Waechter meldete das als Ausfall; die Ursache war Speicher. Gemessen aus
 * dem Spielstand: Die Werkbank `werk-0` hat **512 GB**, bn4rep braucht
 * **768,3 GB**. Es passt dort nicht hin und kann es auch nie - der einzige
 * groessere Rechner ist home, und dessen freier Speicher liegt hinter der
 * Arbeiterreserve.
 *
 * Das Geld reichte dabei zwanzigfach: 1.284 Millionen gegen 84,5 Millionen
 * fuer den Ausbau auf 2048 GB (55.000 Dollar je GB,
 * `Server/data/Constants.ts:4`). Ein Motor, der Arbeiterserver kauft, aber
 * die Werkbank auf ihrer Startgroesse stehen laesst, laesst damit den
 * Reputationsmotor dauerhaft liegen.
 *
 * Das Skript ist eine EINMALIGE Reparatur von aussen, kein Dauerlaeufer. Die
 * Ursache gehoert in `src/bn4net.js`, und das braucht Erics Freigabe.
 *
 * Aufruf:  node tools/task.js wbgrow.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/wbgrow.txt", zeilen.join("\n") + "\n", "w");
  };

  // Die Werkbank ist der groesste gekaufte Rechner - dieselbe Wahl, die
  // bn4net trifft. Sie hier neu zu bestimmen statt sie zu uebergeben haelt
  // das Skript unabhaengig von der Telemetrie.
  const eigene = ns.getPurchasedServers();
  if (eigene.length === 0) return sag("Keine gekauften Rechner.");
  let bank = eigene[0];
  for (const h of eigene) if (ns.getServerMaxRam(h) > ns.getServerMaxRam(bank)) bank = h;

  const jetztGb = ns.getServerMaxRam(bank);
  const zielGb = Number(ns.args[0] ?? 2048);
  if (jetztGb >= zielGb) return sag(bank + " hat bereits " + jetztGb + " GB.");

  const kosten = ns.getPurchasedServerUpgradeCost(bank, zielGb);
  const geld = ns.getPlayer().money;
  // Ein Fuenftel des Guthabens ist die Grenze. Daruber waere es keine
  // Reparatur mehr, sondern eine Investitionsentscheidung.
  if (kosten > geld * 0.2) {
    return sag("Zu teuer: " + ns.formatNumber(kosten) + " gegen "
      + ns.formatNumber(geld) + " Guthaben (Grenze ein Fuenftel).");
  }
  if (!ns.upgradePurchasedServer(bank, zielGb)) {
    return sag("Aufruestung abgelehnt: " + bank + " auf " + zielGb + " GB.");
  }
  sag(bank + ": " + jetztGb + " -> " + ns.getServerMaxRam(bank)
    + " GB fuer " + ns.formatNumber(kosten) + ".");
}
