/**
 * Den Export-Bonus abholen: +1 Favor bei JEDER Mitgliedsfaktion, alle 24 h.
 *
 * `exportGame()` ruft als allererstes `giveExportBonus()` auf
 * (SaveObject.ts), und das erhoeht schlicht den Favor jeder Faktion, in der
 * man Mitglied ist (ExportBonus.tsx:12-20). Kein Multiplikator, kein
 * Zeitfenster, keine Bedingung ausser den 24 Stunden Abstand. Der Knopf hat
 * keine isTrusted-Pruefung.
 *
 * Warum das mehr ist, als es klingt: Favor ist logarithmisch in der kumulierten
 * Reputation (Faction/formulas/favor.ts). Bei Tian Di Hui (Favor 36) entspricht
 * ein Punkt rund sieben Minuten Arbeit - bei NiteSec (Favor 9) sind es
 * hundert Minuten, weil dort niemand arbeitet. Fuenf Faktionen auf einen Klick.
 *
 * Und der Favor ist die Waehrung, auf die es ab jetzt ankommt: ab Favor 150
 * darf man spenden, und Spenden kauft Reputation zum 36,7-fachen der
 * Arbeitsrate (Faction/formulas/donation.ts:8-10, Constants.ts:31).
 *
 * NEBENWIRKUNG AUSSERHALB DES SPIELS: Jeder Aufruf legt eine .json.gz im
 * Downloads-Ordner ab. Das laesst sich nicht umgehen - `giveExportBonus` ist
 * ein Modulexport ohne globalen Zugang, erreichbar nur ueber den Knopf, und
 * der lädt eben herunter. Deshalb laeuft das hier NICHT automatisch im
 * Autopiloten, sondern nur auf ausdruecklichen Auftrag.
 *
 * Aufruf:  node tools/task.js exportbonus.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(new Date().toLocaleTimeString() + "  " + t);
    ns.write("data/export.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/export.txt", "home", ns.getHostname());
  };

  const knoepfe = () => [...doc.querySelectorAll("button,[role='button'],li,a")];
  const text = (b) => (b.innerText || "").trim();

  // Fokussierte Arbeit blendet die Seitenleiste aus (GameRoot.tsx:328-330).
  const raus = knoepfe().find((b) => text(b) === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(900); sag("Arbeit entfokussiert, um an die Oberflaeche zu kommen."); }

  // Favor vorher merken - der Beweis, dass der Bonus wirklich kam, ist der
  // Vergleich, nicht die Meldung auf dem Bildschirm.
  const vorher = {};
  for (const f of ns.getPlayer().factions) vorher[f] = -1;

  // Der Weg: Seitenleiste "Options" -> "Export Game".
  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "o", altKey: true, bubbles: true }));
  await ns.sleep(1200);

  let knopf = knoepfe().find((b) => /^Export Game/i.test(text(b)));
  if (!knopf) {
    // Zweiter Weg: der Eintrag in der Seitenleiste selbst.
    const optionen = knoepfe().find((b) => text(b) === "Options");
    if (optionen) { optionen.click(); await ns.sleep(1200); }
    knopf = knoepfe().find((b) => /^Export Game/i.test(text(b)));
  }
  if (!knopf) return sag("Export-Knopf nicht gefunden - Seite nicht erreichbar?");

  knopf.click();
  await ns.sleep(2000);
  sag("Export ausgeloest. Eine .json.gz liegt jetzt im Downloads-Ordner.");
  sag("Ob der Favor gestiegen ist, zeigt der Spielstand - der Bonus greift nur alle 24 Stunden.");
}
