/**
 * Genau EINE benannte Augmentierung kaufen.
 *
 * buyaugs.js ist der Planer - er waehlt selbst aus und ist damit genau dann
 * unbrauchbar, wenn man etwas Bestimmtes will. Am 20.08. hat er den
 * Neuroreceptor Management Implant liegen lassen, fuer den zwei Stunden
 * Faktionsarbeit gelaufen waren, weil seine Zielfunktion nur Multiplikatoren
 * kennt und diese Aug keine hat. Und in der Runde darauf blieb er beim Lesen
 * der Faktionsseiten haengen.
 *
 * Dieses Skript plant nichts. Es geht zur genannten Faktion, sucht die Zeile
 * und klickt Buy.
 *
 * Aufruf:  node tools/task.js buyone.js "Tian Di Hui" "Neuroreceptor Management Implant"
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const [faktion, augName] = ns.args.map(String);
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/buyone.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/buyone.txt", "home", ns.getHostname());
  };
  if (!faktion || !augName) return sag("Aufruf: buyone.js <Faktion> <Augmentierung>");

  // NUR echte Knoepfe. Ein weiter gefasster Sucher trifft die Tooltip-Huelle,
  // die denselben Text traegt und keinen onClick hat - daran ist der
  // Boersenkauf am 20.08. drei Anlaeufe lang gescheitert.
  const btn = () => [...doc.querySelectorAll("button")];
  const text = (b) => (b.innerText || "").replace(/\s+/g, " ").trim();

  const raus = btn().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(1200); sag("Arbeit entfokussiert."); }

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "f", altKey: true, bubbles: true }));
  await ns.sleep(1800);

  const details = btn().filter((b) => text(b) === "Details")
    .find((b) => (((b.parentElement || {}).parentElement || {}).innerText || "").includes(faktion));
  if (!details) return sag("Faktion \"" + faktion + "\" nicht auf der Seite gefunden.");
  details.click();
  await ns.sleep(1800);

  // "Purchase Augmentations", nicht "Augmentations" - Faction/ui/FactionRoot.tsx:147.
  const augKnopf = btn().find((b) => /^Purchase Augmentations$/i.test(text(b)))
    || btn().find((b) => /Augmentations/i.test(text(b)) && !b.disabled);
  if (!augKnopf) {
    return sag("Kein Knopf \"Purchase Augmentations\". Sichtbare Knoepfe: "
      + btn().map((b) => text(b)).filter((t) => t && t.length < 40).slice(0, 12).join(" | "));
  }
  augKnopf.click();
  await ns.sleep(2200);

  // Vom NAMEN ausgehen, nicht vom Knopf.
  //
  // Zwei Anlaeufe sind daran gescheitert, vom Buy-Knopf aus nach oben nach dem
  // Namen zu suchen: Der Container, der alle Zeilen enthaelt, enthaelt eben
  // auch den gesuchten Namen - und dann passt jeder Buy-Knopf. Beide Male
  // wurde der erste geklickt, und das war NeuroFlux.
  //
  // Andersherum ist es eindeutig: Erst das BLATT-Element finden, dessen
  // eigener Text genau der Aug-Name ist. Von dort so lange aufsteigen, bis ein
  // Vorfahre einen offenen Buy-Knopf enthaelt - der erste, den man so findet,
  // gehoert zu dieser Zeile und zu keiner anderen.
  const blatt = [...doc.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && (e.textContent || "").trim() === augName);
  if (!blatt) {
    const namen = [...doc.querySelectorAll("*")]
      .filter((e) => e.children.length === 0 && /Implant|Governor|Weave|Processor/i.test(e.textContent || ""))
      .map((e) => (e.textContent || "").trim()).slice(0, 10);
    return sag("Zeile \"" + augName + "\" nicht gefunden. Sichtbare Namen: " + namen.join(" | "));
  }

  let kauf = null;
  for (let e = blatt.parentElement, i = 0; e && i < 8; e = e.parentElement, i++) {
    const treffer = [...e.querySelectorAll("button")].filter((x) => /^Buy$/i.test(text(x)) && !x.disabled);
    if (treffer.length === 1) { kauf = treffer[0]; break; }
    // Mehr als einer heisst: wir sind eine Ebene zu hoch und sehen schon
    // Nachbarzeilen. Dann lieber abbrechen als raten.
    if (treffer.length > 1) break;
  }
  if (!kauf) return sag("Zeile gefunden, aber kein eindeutiger offener Buy-Knopf darin.");

  kauf.click();
  await ns.sleep(1800);

  // Bestaetigungsfenster, falls die Einstellung es verlangt.
  const ok = btn().find((b) => /^(Buy it!|Confirm|Yes)$/i.test(text(b)));
  if (ok) { ok.click(); await ns.sleep(1500); sag("Bestaetigt."); }

  // Zeuge ist die Oberflaeche, NICHT das Guthaben: bei 330 Mio $/s verdient
  // der Bot waehrend des Kaufs mehr, als die Aug kostet.
  await ns.sleep(1000);
  // Zeuge: Steht in der Zeile dieser Aug noch ein offener Buy-Knopf?
  const blatt2 = [...doc.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && (e.textContent || "").trim() === augName);
  let nochKaufbar = false;
  if (blatt2) {
    for (let e = blatt2.parentElement, i = 0; e && i < 8; e = e.parentElement, i++) {
      const treffer = [...e.querySelectorAll("button")].filter((x) => /^Buy$/i.test(text(x)) && !x.disabled);
      if (treffer.length === 1) { nochKaufbar = true; break; }
      if (treffer.length > 1) break;
    }
  }
  sag(nochKaufbar
    ? "Buy-Knopf steht noch - der Kauf hat nicht gegriffen."
    : "\"" + augName + "\" gekauft (der Knopf ist verschwunden).");
}
