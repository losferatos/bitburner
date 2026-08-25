/**
 * Misst, WELCHE Drosselung den Bitburner-Tab gerade trifft.
 *
 * WARUM ES DAS BRAUCHT
 *
 * Bis zum 25.08.2026 war die einzige Anzeige fuer eine Drosselung die
 * Rundenrate des Motors - eine Zahl, die aus einem Dutzend Gruenden fallen
 * kann. Zweimal ist daraus eine falsche Diagnose geworden: erst "der Kauflauf
 * haengt", dann "der Ton ist ausgefallen" (er lief).
 *
 * Der Abstand zwischen zwei Aufwachvorgaengen eines Haupt-Thread-Timers ist
 * dagegen ein Fingerabdruck. Chromium kennt genau drei Zustaende:
 *
 *   ~4 ms      ungedrosselt - die Seite gilt als sichtbar oder als hoerbar
 *   ~1.000 ms  Basisstufe - versteckt und still (kDefaultThrottledWakeUpInterval)
 *   ~60.000 ms intensive Stufe - dazu Timerketten mit Verschachtelung >= 5
 *              (kIntensiveThrottledWakeUpInterval)
 *
 * Die eigenen Messungen vom 21.08. und 25.08. landeten beide bei rund EINER
 * Motorrunde je Minute, bei voellig verschiedenen Vordergrundraten. Ein
 * proportionaler Mechanismus kann das nicht erzeugen, ein Deckel von einem
 * Aufwachen je Minute erzeugt es exakt - jede Runde enthaelt mindestens ein
 * await. Die Sonde weist das nach, statt es zu erschliessen.
 *
 * DER WORKER IST NICHT NUR KONTROLLE
 *
 * Timer in einem Dedicated Worker werden nicht gedrosselt: Der Codepfad dafuer
 * haengt an "BlinkSchedulerWorkerThrottling", und das Merkmal ist
 * standardmaessig aus. Misst die Sonde grosse Abstaende im Haupt-Thread und
 * kleine im Worker, ist damit zugleich bewiesen, dass ein Worker-Timer-Ersatz
 * (HackTimer-Prinzip) hier wirken wuerde - der Ausweg, der ohne Neustart des
 * Browsers und ohne Tonkniff auskommt.
 *
 * Aufruf:  node tools/task.js sonde.js          einwerfen und messen
 *          node tools/task.js sonde.js --stop   abraeumen
 *
 * Ergebnis: data/sonde.json, jede Minute neu.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const stop = ns.args.map(String).includes("--stop");
  const w = globalThis["window"];
  if (!w) {
    ns.write("data/sonde.json", JSON.stringify({ fehler: "kein Fensterobjekt" }), "w");
    return;
  }

  // Alte Sonde immer abraeumen. Zwei Messschleifen verfaelschen einander:
  // Jede haelt den Timer wach, den die andere messen will.
  const alt = w.__sonde;
  if (alt) {
    alt.aus = true;
    try { alt.worker.terminate(); } catch (e) { /* schon weg */ }
    w.__sonde = null;
  }
  if (stop) {
    ns.write("data/sonde.json", JSON.stringify({ zeit: Date.now(), zustand: "abgeraeumt" }), "w");
    return;
  }

  const S = { aus: false, main: [], worker: [], raf: 0, vis: [], seit: Date.now() };
  w.__sonde = S;

  // Haupt-Thread. setTimeout(..., 0) in einer Kette erreicht nach fuenf
  // Durchlaeufen die Verschachtelungstiefe, ab der die intensive Stufe greift -
  // die Sonde misst also genau den Fall, in dem auch ns.sleep haengt.
  let t = w.performance.now();
  (function schleife() {
    if (S.aus) return;
    const n = w.performance.now();
    S.main.push(Math.round(n - t));
    t = n;
    if (S.main.length > 400) S.main.shift();
    w.setTimeout(schleife, 0);
  })();

  // Bilder je Sekunde. Bei versteckter Seite steht das Rendern immer still,
  // unabhaengig vom Ton - deshalb ist es KEIN Drosselungsmass, sondern der
  // Beleg dafuer, ob die Seite ueberhaupt als sichtbar gilt.
  (function bild() {
    if (S.aus) return;
    S.raf++;
    w.requestAnimationFrame(bild);
  })();

  const aufVis = () => S.vis.push([Date.now(), w.document.visibilityState]);
  w.document.addEventListener("visibilitychange", aufVis);

  try {
    const quelle = "let t=performance.now();(function l(){const n=performance.now();"
      + "postMessage(Math.round(n-t));t=n;setTimeout(l,0)})()";
    const url = w.URL.createObjectURL(new w.Blob([quelle]));
    S.worker = [];
    const wk = new w.Worker(url);
    wk.onmessage = (e) => {
      S.worker.push(e.data);
      if (S.worker.length > 400) S.worker.shift();
    };
    S.workerObj = wk;
  } catch (e) {
    S.workerFehler = e.message;
  }

  const kennzahl = (a) => {
    if (!a || !a.length) return null;
    const s = [...a].sort((x, y) => x - y);
    return { median: s[(s.length / 2) | 0], max: s[s.length - 1], n: s.length };
  };

  // Die Einstufung steht in der Datei, nicht im Kopf des Lesers. Ein Wert wie
  // "median 58.000" ist nur dann eine Antwort, wenn danebensteht, was er heisst.
  const stufe = (m) => {
    if (m == null) return "unbekannt";
    if (m < 100) return "keine";
    if (m < 5000) return "basis (1-s-Raster)";
    return "intensiv (1-min-Raster)";
  };

  let rafVorher = S.raf;
  let zeitVorher = Date.now();
  for (;;) {
    await ns.sleep(60000);
    if (w.__sonde !== S) return;  // eine neue Sonde hat uebernommen

    const jetzt = Date.now();
    const sek = (jetzt - zeitVorher) / 1000;
    const rafRate = sek > 0 ? +((S.raf - rafVorher) / sek).toFixed(1) : null;
    rafVorher = S.raf;
    zeitVorher = jetzt;

    const mHaupt = kennzahl(S.main);
    const bericht = {
      zeit: jetzt,
      sichtbarkeit: w.document.visibilityState,
      haupt: mHaupt,
      worker: kennzahl(S.worker),
      workerFehler: S.workerFehler || null,
      bilderJeSekunde: rafRate,
      stufe: stufe(mHaupt && mHaupt.median),
      wechsel: S.vis.slice(-6),
    };
    ns.write("data/sonde.json", JSON.stringify(bericht), "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp("data/sonde.json", "home", ns.getHostname()); } catch (e) { /* egal */ }
    }
    // Der Messpuffer wird nicht geleert: Er ist ein gleitendes Fenster ueber
    // die letzten 400 Aufwachvorgaenge. Gedrosselt sind das Stunden, wach
    // Sekunden - genau richtig herum, denn im gedrosselten Fall will man den
    // laengeren Verlauf sehen.
  }
}
