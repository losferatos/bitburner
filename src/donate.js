/**
 * An eine Faktion spenden - Geld in Reputation verwandeln.
 *
 * WARUM DAS DER WICHTIGSTE HEBEL DES LAUFS IST
 *
 * Reputation ist der Engpass, Geld nicht. Der Bot verdient mehr, als er
 * ausgeben kann, sobald der Serverausbau steht - und Reputation liess sich
 * bisher ausschliesslich mit Zeit kaufen. Ab Favor 150 (Constants.ts:31
 * BaseFavorToDonate) faellt diese Trennung: Spenden bringt
 *
 *     rep = betrag / 1e6 * mults.faction_rep
 *
 * (Faction/formulas/donation.ts:8-10). Bei einem faction_rep von 1,78 sind das
 * 1.780 Reputation je Milliarde - das 36,7-fache dessen, was eine Sekunde
 * Arbeit einbringt.
 *
 * Seit dem vierten Reset am 21.08.2026 stehen Tian Di Hui (Favor 154) und
 * BitRunners (157) darueber. Bei BitRunners liegen ausserdem noch
 * Augmentierungen, deren Reputationsschwellen damit schlicht Geldbetraege
 * werden.
 *
 * WIE ES BEDIENT WIRD
 *
 * Das Eingabefeld ist ein MUI-NumberInput mit `onChange={setDonateAmt}`
 * (Faction/ui/DonateOption.tsx:66-77). React haengt seinen eigenen Setter vor
 * den nativen, deshalb reicht `el.value = "..."` nicht - der Zustand im
 * Bauteil bliebe leer und der Knopf gesperrt. Man muss den nativen Setter aus
 * dem Prototyp holen und danach ein input-Ereignis ausloesen; erst das laesst
 * React den neuen Wert sehen. Derselbe Kniff wie beim Terminal in darkweb.js.
 *
 * Der Knopf traegt keine isTrusted-Pruefung (DonateOption.tsx:72), ein
 * gewoehnlicher Klick genuegt also - anders als beim Beitritt.
 *
 * Aufruf:  node tools/task.js donate.js "BitRunners" 500e9
 *          node tools/task.js donate.js "BitRunners" --alles
 *          node tools/task.js donate.js "BitRunners" --alles --reserve 50e9
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const args = ns.args.map(String);
  const alles = args.includes("--alles");
  const rIdx = args.indexOf("--reserve");
  const reserve = rIdx >= 0 ? Number(args[rIdx + 1]) || 0 : 0;
  const teile = args.filter((a, i) => !a.startsWith("--") && !(rIdx >= 0 && i === rIdx + 1));
  // Der Betrag ist das letzte rein numerische Argument, der Rest ist der Name.
  let betrag = NaN;
  const namensteile = [];
  for (const t of teile) {
    const z = Number(t);
    if (Number.isFinite(z) && z > 0 && /^[0-9.e+]+$/i.test(t)) betrag = z;
    else namensteile.push(t);
  }
  const faktion = namensteile.join(" ").trim();

  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/donate.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/donate.txt", "home", ns.getHostname());
  };
  if (!faktion) return sag("Kein Faktionsname angegeben.");

  const knoepfe = () => [...doc.querySelectorAll("button")];
  const text = (b) => (b.innerText || b.textContent || "").trim();

  const bar = ns.getServerMoneyAvailable("home");
  if (alles) betrag = Math.max(0, bar - reserve);
  if (!Number.isFinite(betrag) || betrag <= 0) return sag("Kein gueltiger Betrag.");
  if (betrag > bar) return sag("Betrag " + ns.formatNumber(betrag) + " uebersteigt das Guthaben "
    + ns.formatNumber(bar) + ".");

  // --- Zur Faktionsseite ----------------------------------------------------
  // Steht die Arbeitsseite offen, fehlt die Seitenleiste (GameRoot.tsx:325-330)
  // und damit jede Navigation. Erst herunter davon.
  for (let i = 0; i < 4; i++) {
    const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
    if (!raus) break;
    raus.click();
    await ns.sleep(700);
  }
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
  await ns.sleep(1400);

  const details = knoepfe()
    .filter((b) => text(b) === "Details")
    .find((b) => (((b.parentElement || {}).parentElement || {}).innerText || "").includes(faktion));
  if (!details) return sag("Faktion \"" + faktion + "\" nicht auf der Seite gefunden.");
  details.click();
  await ns.sleep(1400);

  // --- Eingabefeld fuellen --------------------------------------------------
  const feld = [...doc.querySelectorAll("input")]
    .find((e) => /donation amount/i.test(e.placeholder || ""));
  if (!feld) {
    // Bei zu wenig Favor rendert das Bauteil statt des Feldes nur einen
    // Hinweistext (DonateOption.tsx:61-63). Das ist kein Fehler im Skript.
    const hinweis = (doc.body.innerText || "").match(/Unlock donations at [^\n]*/);
    return sag(hinweis ? "Spenden noch gesperrt: " + hinweis[0]
      : "Kein Spendenfeld auf der Seite - falsche Faktion oder Favor zu niedrig.");
  }

  const setter = Object.getOwnPropertyDescriptor(feld.constructor.prototype, "value").set;
  setter.call(feld, String(Math.floor(betrag)));
  feld.dispatchEvent(new Event("input", { bubbles: true }));
  await ns.sleep(600);

  const knopf = knoepfe().find((b) => /^donate$/i.test(text(b)));
  if (!knopf) return sag("Kein donate-Knopf gefunden.");
  if (knopf.disabled) {
    return sag("donate-Knopf bleibt gesperrt - der Betrag kam im Bauteil nicht an"
      + " (Feldwert jetzt: \"" + feld.value + "\").");
  }

  // Der Zustand ist der Zeuge, nicht der Bildschirmtext: Wir merken uns das
  // Guthaben und pruefen hinterher, ob es tatsaechlich gefallen ist. Anders als
  // beim Augmentierungskauf taugt es hier: Eine Spende von hunderten Milliarden
  // uebersteigt jeden Zufluss waehrend der zwei Sekunden Wartezeit um
  // Groessenordnungen.
  const vorher = ns.getServerMoneyAvailable("home");
  knopf.click();
  await ns.sleep(1500);
  const nachher = ns.getServerMoneyAvailable("home");
  const weg = vorher - nachher;

  // Das Bestaetigungsfenster wegraeumen, sonst liegt es ueber der Seite und
  // blockiert den naechsten Lauf (dialogBoxCreate, DonateOption.tsx:32-39).
  for (let i = 0; i < 3; i++) {
    const ok = knoepfe().find((b) => /^(ok|close)$/i.test(text(b)));
    if (!ok) break;
    ok.click();
    await ns.sleep(400);
  }

  if (weg < betrag * 0.9) {
    return sag("FEHLSCHLAG: Guthaben fiel nur um " + ns.formatNumber(weg)
      + " statt " + ns.formatNumber(betrag) + ".");
  }
  sag("Gespendet: " + ns.formatNumber(betrag) + " an " + faktion
    + ". Guthaben jetzt " + ns.formatNumber(nachher) + ".");
}
