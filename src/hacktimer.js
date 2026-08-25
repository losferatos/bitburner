/**
 * Haengt die Timer des Spiels an einen Web Worker, solange der Tab versteckt ist.
 *
 * WARUM
 *
 * Chromium drosselt Timer im Haupt-Thread eines versteckten Tabs auf ein
 * Aufwachen je Minute (die intensive Stufe, siehe doku/drosselung.md). Timer in
 * einem Dedicated Worker sind davon ausgenommen: Der Codepfad dafuer haengt an
 * `BlinkSchedulerWorkerThrottling`, und das Merkmal ist standardmaessig aus.
 *
 * Bitburner ist fuer diesen Eingriff wie gemacht - sowohl der Engine-Loop als
 * auch ALLE Netscript-Wartezeiten (`netscriptDelay`) greifen `window.setTimeout`
 * bei jedem Aufruf neu ab. Ein nachtraeglich eingehaengter Ersatz wirkt deshalb
 * sofort auf die Engine und auf jedes laufende Skript, ohne Neustart.
 *
 * DER PATCH IST NUR IM VERSTECKTEN ZUSTAND AKTIV
 *
 * Sichtbar ist er schaedlich und nutzlos: Jeder Aufruf kostet dann einen
 * postMessage-Umweg, ohne dass es etwas zu umgehen gaebe. Deshalb haengt er
 * sich an `visibilitychange` ein und aus. Nebeneffekt: Im Normalbetrieb, wenn
 * jemand zusieht, laeuft das Spiel unveraendert - ein Fehler im Patch faellt
 * dann gar nicht erst an.
 *
 * DREI SICHERUNGEN, WEIL setTimeout DAS HERZ DER SEITE IST
 *
 * 1. Selbsttest vor dem ersten Einhaengen: Antwortet der Worker nicht binnen
 *    zwei Sekunden auf drei Testtimer, wird gar nicht erst gepatcht.
 * 2. Ein Waechter laeuft ueber den ORIGINAL-Timer, nicht ueber den gepatchten -
 *    er ist damit immun gegen den eigenen Eingriff. Bleiben Antworten aus,
 *    schaltet er zurueck.
 * 3. Beim Zurueckschalten werden alle noch offenen Rueckrufe ueber den
 *    Originalpfad nachgefeuert, statt sie im toten Worker verfallen zu lassen.
 *
 * WARUM ES OHNE `--scharf` NUR MISST (25.08.2026, 21:17)
 *
 * Die erste Fassung haengte sich selbsttaetig ein, sobald der Tab versteckt
 * war. Am 25.08. um 20:20 ist genau das passiert - und kurz darauf starb das
 * Skript, ohne `window.setTimeout` zurueckzugeben. Ein sterbendes
 * Netscript-Skript raeumt seine Patches nicht von allein auf, und der
 * Engine-Loop plant sich per setTimeout neu: Dieser eine Rueckruf ging
 * verloren, und die gesamte Spielengine stand ab 20:27 still. Netscript lief
 * weiter, bn4net zaehlte sechs Runden je Minute - deshalb hat es 46 Minuten
 * lang niemand gemerkt.
 *
 * Zwei Konsequenzen, beide hier eingebaut:
 *
 * 1. `ns.atExit` gibt die Timer beim Skriptende zurueck. Das ist die
 *    eigentliche Reparatur - ohne sie ist jeder Patch am Haupt-Thread eine
 *    Zeitbombe, die beim naechsten Neustart des Werkzeugs hochgeht.
 * 2. Eingehaengt wird nur noch mit `--scharf`. Ohne das Argument misst das
 *    Skript, meldet seinen Modus und laesst window in Ruhe. Ein Werkzeug, das
 *    die Engine anhalten kann, faehrt nicht ungefragt im Nachtlauf mit.
 *
 * Aufruf:  node tools/task.js hacktimer.js            nur messen
 *          node tools/task.js hacktimer.js --scharf   wirklich einhaengen
 *          node tools/task.js hacktimer.js --stop     abraeumen
 *
 * Zustand: data/hacktimer.json, jede Minute neu.
 *
 * @param {NS} ns
 */
export async function main(ns) {
  const argumente = ns.args.map(String);
  const stop = argumente.includes("--stop");
  const scharf = argumente.includes("--scharf");
  const schreib = (o) => {
    ns.write("data/hacktimer.json", JSON.stringify(o), "w");
    if (ns.getHostname() !== "home") {
      try { ns.scp("data/hacktimer.json", "home", ns.getHostname()); } catch (e) { /* egal */ }
    }
  };

  const w = globalThis["window"];
  if (!w) return schreib({ fehler: "kein Fensterobjekt" });

  // Eine alte Fassung immer zuerst abraeumen - zwei Patches uebereinander
  // waeren nicht mehr zurueckzunehmen, weil der zweite den ersten als
  // "Original" sichern wuerde.
  const alt = w.__hacktimer;
  if (alt) {
    try { alt.abraeumen(); } catch (e) { /* egal */ }
    w.__hacktimer = null;
  }
  if (stop) return schreib({ zeit: Date.now(), zustand: "abgeraeumt" });

  // Der Originalpfad, einmal gesichert. Ab hier ist er die einzige Instanz,
  // die noch garantiert funktioniert - der Waechter haengt daran.
  const echt = {
    setTimeout: w.setTimeout.bind(w),
    clearTimeout: w.clearTimeout.bind(w),
    setInterval: w.setInterval.bind(w),
    clearInterval: w.clearInterval.bind(w),
  };

  // Eigene Kennungen ab einer Milliarde. Der Browser vergibt seine Handles
  // fortlaufend ab 1; ohne diesen Abstand koennte ein clearTimeout mit einer
  // echten Kennung versehentlich einen Worker-Timer treffen und umgekehrt.
  const KENNUNG_AB = 1_000_000_000;

  const WORKER_CODE =
    "const h=new Map();" +
    "onmessage=(e)=>{const d=e.data;" +
    "if(d.art==='t'){h.set(d.id,setTimeout(()=>{h.delete(d.id);postMessage({id:d.id})},d.ms))}" +
    "else if(d.art==='i'){h.set(d.id,setInterval(()=>postMessage({id:d.id}),d.ms))}" +
    "else if(d.art==='c'){const x=h.get(d.id);if(x!==undefined){clearTimeout(x);clearInterval(x);h.delete(d.id)}}" +
    "else if(d.art==='p'){postMessage({pong:d.n})}};";

  let wk = null;
  try {
    const url = w.URL.createObjectURL(new w.Blob([WORKER_CODE], { type: "text/javascript" }));
    wk = new w.Worker(url);
  } catch (e) {
    return schreib({ zeit: Date.now(), zustand: "kein Worker moeglich", fehler: e.message });
  }

  const rueckrufe = new Map();
  let naechste = KENNUNG_AB;
  let letzteAntwort = Date.now();
  let pongs = 0;
  let aktiv = false;
  let abgeschaltet = false;   // nach einem Waechterabbruch nie wieder einhaengen
  let grund = "";

  wk.onmessage = (e) => {
    const d = e.data;
    if (d.pong !== undefined) { pongs++; letzteAntwort = Date.now(); return; }
    const eintrag = rueckrufe.get(d.id);
    if (!eintrag) return;
    letzteAntwort = Date.now();
    if (!eintrag.wiederholt) rueckrufe.delete(d.id);
    try {
      eintrag.fn.apply(null, eintrag.args);
    } catch (err) {
      // Ein Fehler im Rueckruf ist Sache des Aufrufers, nicht des Patches -
      // aber er darf diese Schleife nicht mitreissen.
    }
  };

  const einhaengen = () => {
    if (aktiv || abgeschaltet) return;
    w.setTimeout = function (fn, ms, ...args) {
      // Die String-Form von setTimeout kann der Worker nicht bedienen (sie
      // wird im Aufrufkontext ausgewertet). Sie geht unveraendert ans Original.
      if (typeof fn !== "function") return echt.setTimeout(fn, ms, ...args);
      const id = ++naechste;
      rueckrufe.set(id, { fn, args, wiederholt: false });
      wk.postMessage({ art: "t", id, ms: ms || 0 });
      return id;
    };
    w.setInterval = function (fn, ms, ...args) {
      if (typeof fn !== "function") return echt.setInterval(fn, ms, ...args);
      const id = ++naechste;
      rueckrufe.set(id, { fn, args, wiederholt: true });
      wk.postMessage({ art: "i", id, ms: ms || 0 });
      return id;
    };
    w.clearTimeout = function (id) {
      if (typeof id === "number" && id > KENNUNG_AB) {
        rueckrufe.delete(id);
        wk.postMessage({ art: "c", id });
        return;
      }
      return echt.clearTimeout(id);
    };
    w.clearInterval = function (id) {
      if (typeof id === "number" && id > KENNUNG_AB) {
        rueckrufe.delete(id);
        wk.postMessage({ art: "c", id });
        return;
      }
      return echt.clearInterval(id);
    };
    aktiv = true;
  };

  const aushaengen = (warum) => {
    if (!aktiv) return;
    w.setTimeout = echt.setTimeout;
    w.setInterval = echt.setInterval;
    w.clearTimeout = echt.clearTimeout;
    w.clearInterval = echt.clearInterval;
    aktiv = false;
    grund = warum || "";
    // Offene Rueckrufe retten. Sie haengen im Worker und wuerden sonst
    // verfallen - bei einer Engine, die ihren naechsten Tick per setTimeout
    // plant, waere genau das der Stillstand, den der Patch verhindern soll.
    const offen = [...rueckrufe.values()];
    rueckrufe.clear();
    for (const r of offen) {
      try { echt.setTimeout(() => r.fn.apply(null, r.args), 0); } catch (e) { /* egal */ }
    }
  };

  // --- Selbsttest, bevor irgendetwas angefasst wird -------------------------
  const test = await new Promise((fertig) => {
    let n = 0;
    const bisher = wk.onmessage;
    wk.onmessage = (e) => {
      if (e.data && e.data.pong !== undefined) {
        if (++n >= 3) { wk.onmessage = bisher; fertig(true); }
      }
    };
    for (let i = 0; i < 3; i++) wk.postMessage({ art: "p", n: i });
    echt.setTimeout(() => { wk.onmessage = bisher; fertig(n >= 3); }, 2000);
  });

  if (!test) {
    try { wk.terminate(); } catch (e) { /* egal */ }
    return schreib({ zeit: Date.now(), zustand: "Selbsttest fehlgeschlagen - nicht eingehaengt" });
  }

  const aufWechsel = () => {
    if (!scharf) return;   // ohne --scharf wird nur gemessen, nichts gepatcht
    if (w.document.visibilityState === "hidden") einhaengen();
    else aushaengen("wieder sichtbar");
  };
  w.document.addEventListener("visibilitychange", aufWechsel);
  aufWechsel();

  // --- Der Waechter, ueber den ORIGINALTIMER -------------------------------
  //
  // Er ist die einzige Sicherung, die auch dann noch laeuft, wenn der Patch
  // alle Timer verschluckt. Gedrosselt feuert er nur einmal je Minute - das
  // reicht: Er ist die Notbremse, nicht die Regelung.
  const waechter = echt.setInterval(() => {
    if (!aktiv) return;
    const still = Date.now() - letzteAntwort;
    if (still > 90_000 && rueckrufe.size > 0) {
      aushaengen("Worker antwortet seit " + Math.round(still / 1000) + " s nicht");
      abgeschaltet = true;
    }
  }, 20_000);

  const abraeumen = () => {
    try { echt.clearInterval(waechter); } catch (e) { /* egal */ }
    try { w.document.removeEventListener("visibilitychange", aufWechsel); } catch (e) { /* egal */ }
    aushaengen("abgeraeumt");
    try { wk.terminate(); } catch (e) { /* egal */ }
  };
  // Von aussen bedienbar, damit sich der Patch PRUEFEN laesst, ohne auf einen
  // verdeckten Tab zu warten. Ein Eingriff am Herzen der Seite, der zum ersten
  // Mal nachts und unbeaufsichtigt aktiv wird, ist genau der Fehlertyp, an dem
  // dieses Projekt schon zweimal Stunden verloren hat.
  // DIE WICHTIGSTE ZEILE DIESER DATEI.
  //
  // Stirbt das Skript - durch den Reload-Kanal, durch bn4net beim Raeumen,
  // durch einen Fehler -, gibt es window.setTimeout zurueck, bevor es geht.
  // Ohne sie bleibt ein Patch zurueck, dessen Besitzer nicht mehr existiert,
  // und der Engine-Loop verliert seinen naechsten Rueckruf. Genau so stand am
  // 25.08. die gesamte Spielengine 46 Minuten still.
  ns.atExit(() => { try { abraeumen(); } catch (e) { /* egal */ } });

  w.__hacktimer = {
    abraeumen,
    istAktiv: () => aktiv,
    einhaengen: () => { abgeschaltet = false; einhaengen(); return aktiv; },
    aushaengen: (warum) => { aushaengen(warum || "von Hand"); return aktiv; },
  };

  for (;;) {
    schreib({
      zeit: Date.now(),
      sichtbarkeit: w.document.visibilityState,
      modus: scharf ? "scharf" : "nur messen",
      aktiv,
      abgeschaltet,
      grund: grund || null,
      offeneRueckrufe: rueckrufe.size,
      pongs,
      letzteAntwortVorMs: Date.now() - letzteAntwort,
    });
    await ns.sleep(60000);
    if (w.__hacktimer && w.__hacktimer.abraeumen !== abraeumen) return;  // abgeloest
  }
}
