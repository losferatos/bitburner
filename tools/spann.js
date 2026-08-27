/** Frische Erfolgsspannen aus dem Spiel holen - in einem Aufruf.
 *
 * `data/bbspann.json` ist eine MOMENTAUFNAHME, kein Dauerlauf: `src/bbspann.js`
 * hat keine Schleife, es schreibt einmal und endet (Zeile 11 ff.). Niemand
 * frischt die Datei von selbst auf. Am 27.08. um 16:12 hat der Reportloop
 * daraus geschlossen, der Messer sei abgestuerzt, und einen Sofort-Befund
 * eingetragen - die Datei war schlicht 21 Minuten alt, weil sie seit 15:51
 * niemand angefordert hatte.
 *
 * Das ist die eigentliche Luecke: Die Typhoon-Chance und die
 * Faehigkeitsstufen sind NUR hier ablesbar, und beide stehen in offenen
 * Nachmesspunkten. Wer sie braucht, musste bisher von Hand einen Auftrag in
 * `data/task.txt` schieben, pollen, und die Antwort aus der JSON-Maskierung
 * der Bruecke schaelen. Dieses Werkzeug macht daraus einen Befehl.
 *
 * Bewusst KEIN Selbstlaeufer: `data/task.txt` ist ein einzelner Platz mit
 * einem Leser, den sich drei Loops teilen. Ein Wecker, der ungefragt
 * Auftraege hineinschreibt, wuerde ihnen den Kanal wegnehmen.
 *
 *   node tools/spann.js            Chance, Faehigkeiten, Ausdauer
 *   node tools/spann.js --roh      dazu die volle JSON
 */
const BRIDGE = "http://localhost:8795/api/rpc";
const WARTE_MAX = 60000;  // harte Grenze - lieber ein Fehlschlag als ein Haenger

async function rpc(method, params) {
  const url = new URL(BRIDGE);
  url.searchParams.set("method", method);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const body = await res.json();
    if (body.error) throw new Error(String(body.error));
    return body.result;
  } finally { clearTimeout(t); }
}

async function lies() {
  // Die Bruecke liefert den Dateiinhalt als JSON-maskierte Zeichenkette.
  const roh = await rpc("getFile", { filename: "data/bbspann.json", server: "home" });
  return JSON.parse(roh);
}

(async () => {
  let vorher = 0;
  try { vorher = (await lies()).zeit || 0; } catch { /* Datei fehlt noch */ }

  await rpc("pushFile", {
    filename: "data/task.txt", server: "home", content: '["bbspann.js"]',
  });

  const bis = Date.now() + WARTE_MAX;
  let d = null;
  while (Date.now() < bis) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const neu = await lies();
      if (neu.zeit && neu.zeit !== vorher) { d = neu; break; }
    } catch { /* noch nicht geschrieben */ }
  }
  if (!d) {
    console.error("Keine frische Messung binnen " + (WARTE_MAX / 1000) + " s.");
    console.error("Liest ueberhaupt jemand data/task.txt? bn4life oder bn4net "
      + "muessen laufen (src/bn4net.js:424).");
    process.exit(1);
  }
  if (d.fehler) { console.log("bbspann: " + d.fehler); process.exit(1); }

  const uhr = new Date(d.zeit).toTimeString().slice(0, 8);
  console.log("Stand " + uhr + "  Division " + d.stadt + "  Rang "
    + Math.round(d.rang) + "  Punkte " + d.punkte);
  const b = d.naechsteBlackOp;
  if (b) {
    const c = b.chance;
    const spanne = (c.max - c.min) < 1e-9 ? "exakt" : "Spanne " + (c.max - c.min).toFixed(3);
    console.log("Naechste Black Op: " + b.name + " (Rang " + b.rang + ")  Chance "
      + c.min.toFixed(3) + " - " + c.max.toFixed(3) + "  [" + spanne + "]");
  }
  if (d.ausdauer) {
    console.log("Ausdauer " + d.ausdauer[0].toFixed(1) + "/" + d.ausdauer[1].toFixed(1)
      + "  Regeneration " + d.regeneration + "/min (" + d.regenerationQuelle + ")");
  }
  if (d.faehigkeiten) {
    const z = d.faehigkeiten.filter((f) => f.stufe > 0)
      .sort((a, b2) => b2.stufe - a.stufe)
      .map((f) => f.name + " " + f.stufe + " (" + f.preis + ")");
    console.log("Faehigkeiten: " + z.join(", "));
  }
  if (process.argv.includes("--roh")) console.log(JSON.stringify(d, null, 2));
})().catch((e) => { console.error(String(e.message || e)); process.exit(1); });
