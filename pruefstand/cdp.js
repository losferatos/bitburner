/**
 * CDP-Client fuer den Pruefstand - und nur fuer ihn.
 *
 * ===========================================================================
 * WARUM DIESE DATEI NEU GESCHRIEBEN IST UND nightshift/cdp.js TOT BLEIBT
 * ===========================================================================
 *
 * Das Verbindungswissen aus nightshift/cdp.js war brauchbar, die Bauform nicht:
 * jener Client konnte auf jeden Debug-Port sprechen und jedes Ziel steuern.
 * Solange er existiert, ist ein Tippfehler im Port der Weg zu Erics
 * Spielstand - und Erics Bedingung dazu lautet woertlich: "mein savegame darf
 * nicht zerstoert werden. Das ist extrem wichtig - das ist die live file!"
 *
 * Dieser Client kann den Live-Tab strukturell nicht erreichen. Drei Riegel,
 * alle im Code und keiner als Abmachung:
 *
 *  (a) PORT UND PROFIL. Der Debug-Endpunkt muss auf 127.0.0.1 liegen und darf
 *      NICHT 9222 sein - das ist der Port, auf dem Erics Opera lauscht. Das
 *      Browserprofil muss unterhalb von pruefstand/ liegen.
 *  (b) ZIELPRUEFUNG VOR JEDEM ZUGRIFF. Vor jedem Runtime.evaluate, jedem Klick
 *      und jedem Reload wird die vollstaendige Zielliste geholt. Enthaelt auch
 *      nur EIN Ziel die Zeichenfolge bitburner-official.github.io, wird die
 *      Verbindung geschlossen und der Prozess endet mit Code 2. Nicht "das
 *      Ziel wird uebersprungen" - der ganze Lauf endet.
 *  (c) HERKUNFT. Der IndexedDB-Weg laeuft nur gegen localhost:8799 oder :8798.
 *
 * Riegel (b) ist der wichtigste, weil er nicht davon abhaengt, dass man den
 * richtigen Port erwischt hat. Selbst wenn (a) durch einen kuenftigen Umbau
 * fiele, faende (b) den Live-Tab und braeche ab.
 */

import { WebSocket } from "ws";

/** Erics Opera lauscht hier. Dieser Client fasst den Port nie an. */
const VERBOTENER_PORT = 9222;
/** Die einzige Herkunft, die der Pruefstand kennt. */
const ERLAUBTE_HERKUENFTE = ["http://localhost:8799", "http://localhost:8798"];
/** Taucht das irgendwo in der Zielliste auf, endet der Lauf. */
const LIVE_KENNUNG = "bitburner-official.github.io";

export class PruefstandCdp {
  /**
   * @param {{port: number, profil?: string}} opt
   */
  constructor(opt) {
    const port = Number(opt.port);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error("cdp: kein gueltiger Port");
    }
    if (port === VERBOTENER_PORT) {
      throw new Error(
        "cdp: Port 9222 ist der Debug-Port von Erics Opera. Dieser Client " +
          "spricht ausschliesslich mit dem Pruefstand-Browser.",
      );
    }
    if (opt.profil && !/[\\/]pruefstand[\\/]/i.test(opt.profil)) {
      throw new Error(
        "cdp: --user-data-dir muss unterhalb von pruefstand/ liegen, ist aber " +
          opt.profil,
      );
    }
    this.port = port;
    this.profil = opt.profil || null;
    this.ws = null;
    this.id = 0;
    this.offen = new Map();
    this.zielId = null;
    this.sessionId = null;
  }

  async holeZiele() {
    const res = await fetch("http://127.0.0.1:" + this.port + "/json/list");
    if (!res.ok) throw new Error("cdp: /json/list gab HTTP " + res.status);
    return res.json();
  }

  /**
   * Riegel (b). Wird vor JEDEM Zugriff aufgerufen - nicht einmal beim Verbinden.
   * Ein Tab kann jederzeit dazukommen; eine Pruefung, die nur beim Start laeuft,
   * prueft den Zustand von vorhin.
   */
  async pruefeKeineLiveZiele() {
    const ziele = await this.holeZiele();
    const treffer = ziele.filter(
      (z) =>
        (z.url && z.url.includes(LIVE_KENNUNG)) ||
        (z.title && z.title.includes(LIVE_KENNUNG)),
    );
    if (treffer.length) {
      // Erst schliessen, dann melden. Die Reihenfolge ist wichtig: solange die
      // Verbindung offen ist, koennte ein bereits abgeschickter Befehl noch
      // laufen.
      this.schliesse();
      console.error("");
      console.error("  ABBRUCH: Der Debug-Browser auf Port " + this.port + " hat ein Ziel");
      console.error("  auf " + LIVE_KENNUNG + " geoeffnet:");
      for (const t of treffer) console.error("    " + (t.url || t.title));
      console.error("");
      console.error("  Das ist Erics Live-Spielstand. Es wird nichts ausgefuehrt.");
      console.error("");
      process.exit(2);
    }
    return ziele;
  }

  async verbinde(zielFilter) {
    const ziele = await this.pruefeKeineLiveZiele();
    const seiten = ziele.filter((z) => z.type === "page");
    const ziel = zielFilter ? seiten.find((z) => z.url.includes(zielFilter)) : seiten[0];
    if (!ziel) {
      throw new Error(
        "cdp: kein passendes Ziel" + (zielFilter ? " fuer " + zielFilter : "") +
          " (" + seiten.length + " Seite(n) offen)",
      );
    }
    this.zielUrl = ziel.url;
    await new Promise((fertig, schief) => {
      this.ws = new WebSocket(ziel.webSocketDebuggerUrl);
      this.ws.on("open", fertig);
      this.ws.on("error", schief);
      this.ws.on("message", (roh) => {
        let m;
        try {
          m = JSON.parse(roh.toString());
        } catch {
          return;
        }
        const wartend = this.offen.get(m.id);
        if (!wartend) return;
        this.offen.delete(m.id);
        if (m.error) wartend.schief(new Error(JSON.stringify(m.error)));
        else wartend.fertig(m.result);
      });
    });
    return ziel;
  }

  befehl(method, params = {}) {
    return new Promise((fertig, schief) => {
      const id = ++this.id;
      this.offen.set(id, { fertig, schief });
      const t = setTimeout(() => {
        this.offen.delete(id);
        schief(new Error("cdp: Zeitueberschreitung bei " + method));
      }, 30000);
      const urspruenglich = fertig;
      this.offen.set(id, {
        fertig: (r) => {
          clearTimeout(t);
          urspruenglich(r);
        },
        schief: (e) => {
          clearTimeout(t);
          schief(e);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Jeder Zugriff auf die Seite geht hier durch - und damit durch Riegel (b). */
  async auswerten(ausdruck, opt = {}) {
    await this.pruefeKeineLiveZiele();
    const r = await this.befehl("Runtime.evaluate", {
      expression: ausdruck,
      awaitPromise: opt.awaitPromise !== false,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        "cdp: Ausnahme in der Seite: " +
          (r.exceptionDetails.exception?.description || r.exceptionDetails.text),
      );
    }
    return r.result?.value;
  }

  async neuLaden() {
    await this.pruefeKeineLiveZiele();
    return this.befehl("Page.reload", { ignoreCache: false });
  }

  /**
   * Riegel (c). Der Weg in die IndexedDB laeuft nur gegen den Pruefstand.
   * Er ist die einzige Stelle, die einen Spielstand SCHREIBT.
   */
  async spielstandSchreiben(gzBytes) {
    await this.pruefeKeineLiveZiele();
    if (!ERLAUBTE_HERKUENFTE.some((h) => this.zielUrl.startsWith(h))) {
      throw new Error(
        "cdp: Spielstand schreiben nur gegen " + ERLAUBTE_HERKUENFTE.join(" oder ") +
          ", das Ziel ist aber " + this.zielUrl,
      );
    }
    /**
     * Base64 statt Zahlenliste. Ein Spielstand hat rund 660.000 Bytes; als
     * JSON-Zahlenarray waeren das ueber 2 MB Ausdruckstext, die als eine
     * WebSocket-Nachricht durch die Debug-Verbindung muessten. Base64 kostet
     * ein Drittel davon und wird in der Seite dekodiert.
     */
    const b64 = Buffer.from(gzBytes).toString("base64");
    const ausdruck = `
      (async () => {
        const roh = atob(${JSON.stringify(b64)});
        const bytes = new Uint8Array(roh.length);
        for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
        const db = await new Promise((ok, nein) => {
          const a = indexedDB.open("bitburnerSave", 2);
          a.onsuccess = () => ok(a.result);
          a.onerror = () => nein(a.error);
          a.onupgradeneeded = () => a.result.createObjectStore("savestring");
        });
        await new Promise((ok, nein) => {
          const t = db.transaction("savestring", "readwrite");
          const r = t.objectStore("savestring").put(bytes, "save");
          r.onsuccess = () => ok();
          r.onerror = () => nein(r.error);
        });
        return bytes.length;
      })()
    `;
    return this.auswerten(ausdruck);
  }

  schliesse() {
    try {
      if (this.ws) this.ws.close();
    } catch {
      // egal
    }
    this.ws = null;
  }
}

// ---------------------------------------------------------------------------
// Aufruf von der Kommandozeile: Selbsttest der drei Riegel
// ---------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith("cdp.js")) {
  console.log("");
  console.log("=== Selbsttest der drei Riegel ===");
  console.log("");

  let rot = 0;
  const pruefe = (name, fn, erwarteFehler) => {
    try {
      fn();
      if (erwarteFehler) {
        rot++;
        console.log("  ROT   " + name + " - kein Fehler geworfen");
      } else {
        console.log("  ok    " + name);
      }
    } catch (e) {
      if (erwarteFehler) {
        console.log("  ok    " + name);
        console.log("        " + e.message.split("\n")[0].slice(0, 90));
      } else {
        rot++;
        console.log("  ROT   " + name + " - unerwarteter Fehler: " + e.message);
      }
    }
  };

  pruefe("(a) Port 9222 wird abgelehnt", () => new PruefstandCdp({ port: 9222 }), true);
  pruefe(
    "(a) Profil ausserhalb pruefstand/ wird abgelehnt",
    () => new PruefstandCdp({ port: 9333, profil: "C:\\Users\\erche\\AppData\\Roaming\\Opera" }),
    true,
  );
  pruefe(
    "(a) Profil unter pruefstand/ ist erlaubt",
    () =>
      new PruefstandCdp({
        port: 9333,
        profil: "C:\\Users\\erche\\Desktop\\claude_projecto\\bitburner\\pruefstand\\browser",
      }),
    false,
  );
  pruefe("(a) ungueltiger Port wird abgelehnt", () => new PruefstandCdp({ port: 0 }), true);

  // (c) ohne laufenden Browser pruefbar: die Herkunftspruefung sitzt vor dem
  // Netzzugriff nur, wenn zielUrl gesetzt ist - deshalb hier direkt gesetzt.
  const c = new PruefstandCdp({ port: 9333 });
  c.zielUrl = "https://bitburner-official.github.io/";
  c.pruefeKeineLiveZiele = async () => {};
  await c
    .spielstandSchreiben(new Uint8Array([1, 2, 3]))
    .then(() => {
      rot++;
      console.log("  ROT   (c) Schreiben gegen die Live-Herkunft wurde NICHT abgelehnt");
    })
    .catch((e) => {
      console.log("  ok    (c) Schreiben gegen die Live-Herkunft wird abgelehnt");
      console.log("        " + e.message.slice(0, 90));
    });

  console.log("");
  console.log(
    rot
      ? "  " + rot + " Riegel greift nicht - NICHT verwenden."
      : "  Alle pruefbaren Riegel greifen. (b) braucht einen laufenden Browser.",
  );
  console.log("");
  process.exit(rot ? 1 : 0);
}
