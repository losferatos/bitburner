/**
 * Diagnose: Was steht auf der Boersenseite wirklich?
 *
 * stockaccess.js hat den Kauf nicht ausloesen koennen, obwohl der Weg zur
 * Boerse offenbar funktionierte. Statt weiter zu raten, wird hier
 * aufgeschrieben, was tatsaechlich im Baum steht - Beschriftung, Tagname und
 * ob der Knopf gesperrt ist.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const doc = document;
  const zeilen = [];
  const sag = (t) => {
    zeilen.push(t);
    ns.write("data/probe2.txt", zeilen.join("\n") + "\n", "w");
    if (ns.getHostname() !== "home") ns.scp("data/probe2.txt", "home", ns.getHostname());
  };

  const raus = [...doc.querySelectorAll("button")].find(
    (b) => (b.innerText || "").trim() === "Do something else simultaneously");
  if (raus) { raus.click(); await ns.sleep(900); }

  doc.dispatchEvent(new KeyboardEvent("keydown", { key: "w", altKey: true, bubbles: true }));
  await ns.sleep(1600);

  // Die Stadtkarte laeuft hier in der LISTENANSICHT: normale Knoepfe mit
  // vollem Namen, kein aria-label und keine ASCII-Kunst. Erst der Text, dann
  // das aria-label als Rueckfall fuer den Fall, dass jemand die Ansicht
  // umstellt.
  const ziel = [...doc.querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "World Stock Exchange")
    || doc.querySelector('[aria-label="World Stock Exchange"]');
  sag("Boersen-Element: " + (ziel ? ziel.tagName + " " + JSON.stringify((ziel.innerText || "").slice(0, 30)) : "NICHT GEFUNDEN"));
  if (ziel) {
    ziel.click();
    await ns.sleep(2500);
  }

  sag("");
  sag("ALLE klickbaren Elemente (nicht nur <button>):");
  // Die Seitenleiste rendert ihre Eintraege als div[role=button], nicht als
  // <button>. Die erste Fassung dieser Diagnose sah deshalb eine "leere Seite",
  // wo in Wahrheit die ganze Navigation stand.
  const alle = doc.querySelectorAll("button,[role='button'],a[href],li");
  let n = 0;
  for (const b of alle) {
    const t = (b.innerText || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 60) continue;
    if (++n > 40) { sag("  ... (mehr als 40, gekuerzt)"); break; }
    sag("  <" + b.tagName.toLowerCase() + (b.getAttribute("role") ? " role=" + b.getAttribute("role") : "")
      + (b.disabled ? " GESPERRT" : "") + "> " + JSON.stringify(t));
  }
}
