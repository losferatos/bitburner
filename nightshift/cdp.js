/**
 * nightshift/cdp.js — Transportschicht zwischen Node und dem Bitburner-Tab.
 *
 * Zweck: Ein unbeaufsichtigter Nachtdienst muss die Spieloberflaeche bedienen
 * koennen. Diese Datei ist NUR das Fahrzeug — sie weiss nichts ueber Strategie,
 * Faktionen oder Kaufentscheidungen. Sie kann: den richtigen Tab finden, darin
 * JavaScript auswerten, echte (vertrauenswuerdige) Mausklicks abschicken und
 * Terminalbefehle absetzen.
 *
 * ---------------------------------------------------------------------------
 * GEMESSENE EIGENHEITEN DIESER OPERA-INSTALLATION (19.08.2026)
 * ---------------------------------------------------------------------------
 *
 * 1. `http://localhost:9222/json`, `/json/list` und `/json/version` antworten
 *    mit 404. Opera schaltet die HTTP-Erkundung ab. Die Standardwege von
 *    Puppeteer & Co. laufen deshalb hier ins Leere.
 * 2. Der direkte Seiten-Endpunkt `ws://localhost:9222/devtools/page/<id>`
 *    antwortet mit 403. Auch der ist gesperrt.
 * 3. Was funktioniert: der Browser-Endpunkt aus der Datei `DevToolsActivePort`
 *    im Opera-Profil. Darin stehen zwei Zeilen — Port und WebSocket-Pfad.
 *    Ueber diese eine Verbindung erreicht man jede Seite per
 *    `Target.attachToTarget` mit `flatten: true` und spricht sie danach ueber
 *    eine `sessionId` an.
 * 4. Mehrere gleichzeitige Verbindungen zum Browser-Endpunkt sind erlaubt.
 *    Der Opera-MCP des Users kann also parallel angeschlossen bleiben.
 * 5. WICHTIG, nachgemessen: Das Verbinden ist teuer und wird gedrosselt.
 *    Ein Verbindungsaufbau dauert 1 bis 10 Sekunden. Wer in kurzer Folge
 *    verbindet und wieder trennt, bekommt ab dem dritten Mal `403`, danach
 *    gar keine Antwort mehr; nach etwa einer Minute Ruhe geht es wieder.
 *
 * Aus 5. folgt die wichtigste Betriebsregel dieser Schicht:
 * EINE Verbindung aufmachen und stundenlang offen halten. Nicht je Aktion
 * verbinden und trennen. Deshalb gibt es einen Herzschlag, der die Leitung
 * warm haelt, grosszuegige Zeitgrenzen und ein Wiederverbinden, das lieber
 * lange wartet als zu haemmern — haemmern macht es nachweislich schlimmer.
 *
 * Die Erkundung ist dreistufig: erst HTTP (falls jemand das spaeter mit einem
 * normalen Chrome betreibt), dann `DevToolsActivePort`, dann eine
 * ausdrueckliche Vorgabe per Umgebungsvariable.
 *
 * ---------------------------------------------------------------------------
 * WARUM NICHT "DER AKTIVE TAB"
 * ---------------------------------------------------------------------------
 *
 * Im selben Browser laeuft ein zweites Projekt (NEONBREAK auf localhost:8785).
 * Der Fokus springt dorthin. Ein Automat, der "den aktiven Tab" bedient,
 * klickt frueher oder spaeter ins falsche Fenster. Diese Schicht sucht den Tab
 * ausschliesslich ueber die URL und prueft zusaetzlich vor JEDER Auswertung im
 * Seitenkontext, dass Titel und URL stimmen. Passt etwas nicht, wird einmal neu
 * gesucht; passt es dann immer noch nicht, verweigert sie den Dienst.
 *
 * Aus demselben Grund wird der Tab NICHT nach vorn geholt (`bringToFront`
 * ist standardmaessig aus). CDP-Eingabeereignisse gehen an das Ziel, nicht an
 * das Fenster — ein Hintergrundtab laesst sich bedienen, ohne dem anderen
 * Projekt den Fokus wegzunehmen. Wer es doch braucht: `{ bringToFront: true }`.
 *
 * ---------------------------------------------------------------------------
 * DAS isTrusted-PROBLEM
 * ---------------------------------------------------------------------------
 *
 * Sechs Stellen im Spiel pruefen `event.isTrusted` und verwerfen einen per
 * `element.click()` erzeugten Klick kommentarlos (Faktion beitreten, Verbrechen,
 * Job/Arbeit, Heilen, Programm schreiben, Casino/Infiltration — Fundstellen in
 * `doku/oberflaeche.md`, Abschnitt 0.2). Deshalb geht `clickTrusted()` den
 * Umweg ueber echte Eingabeereignisse:
 *
 *   1. Im Seitenkontext das Element suchen und seinen Mittelpunkt bestimmen.
 *   2. Pruefen, dass dort auch wirklich dieses Element liegt
 *      (`document.elementFromPoint`) — sonst Fehler statt Blindklick.
 *   3. `Input.dispatchMouseEvent` an diese Bildschirmkoordinaten.
 *
 * Nachgemessen mit `nightshift/trustcheck.js`: der so erzeugte Klick kommt mit
 * `isTrusted === true` an.
 *
 * ---------------------------------------------------------------------------
 * BENUTZUNG
 * ---------------------------------------------------------------------------
 *
 *   import { connect } from "./nightshift/cdp.js";
 *
 *   const tab = await connect();
 *   await tab.eval("document.title");
 *   await tab.eval("() => ns_gibt_es_hier_nicht");        // wirft
 *   const res = await tab.terminal("help");               // { lines, text, ... }
 *   await tab.clickTrusted({ text: "Terminal" });
 *   await tab.close();                                    // WICHTIG
 *
 * `close()` ist Pflicht: eine offene WebSocket-Verbindung haelt den
 * Node-Prozess am Leben.
 *
 * Kommandozeile (nur lesende bzw. unschaedliche Befehle):
 *   node nightshift/cdp.js info
 *   node nightshift/cdp.js eval "document.title"
 *   node nightshift/cdp.js find "Terminal"
 *   node nightshift/cdp.js terminal "help"
 */

import WebSocket from "ws";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { get as httpGet } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(HERE, "log");

// ---------------------------------------------------------------------------
// Vorgaben
// ---------------------------------------------------------------------------

export const DEFAULTS = {
  host: "127.0.0.1",
  port: 9222,
  /** Woran der Tab erkannt wird. Nicht verhandelbar. */
  urlMarker: "bitburner-official.github.io",
  /** Zusatzsicherung: der Titel muss so anfangen, sonst kein Dienst. */
  titlePrefix: "Bitburner",
  /** Zeitgrenze je Kommando. */
  commandTimeoutMs: 20000,
  /**
   * Zeitgrenze fuers Aufbauen der WebSocket-Verbindung. Grosszuegig, weil
   * Opera dafuer gemessene 1 bis 10 Sekunden braucht (siehe Kopfkommentar).
   */
  connectTimeoutMs: 30000,
  /**
   * Wiederverbinden: Wartezeit waechst von min bis max. Bewusst traege —
   * die Drosselung loest sich nur, wenn wirklich Ruhe ist. Jeder Versuch
   * scheint sie neu anzustossen.
   */
  reconnectMinMs: 5000,
  reconnectMaxMs: 300000,
  /**
   * Herzschlag, der die Leitung offen haelt und ein stilles Absterben
   * bemerkt. 0 schaltet ihn ab.
   */
  heartbeatMs: 30000,
  /**
   * Wie oft ein Verbindungsaufbau versucht wird, bevor aufgegeben wird.
   * Zwischen den Versuchen wird laenger gewartet — die Drosselung loest sich
   * gemessen nach etwa einer Minute Ruhe.
   */
  connectAttempts: 4,
  /** Tab beim Klicken nach vorn holen? Siehe Kopfkommentar — aus gutem Grund aus. */
  bringToFront: false,
  /** Protokollzeilen zusaetzlich auf stdout ausgeben. */
  echoLog: false,
};

/**
 * Welche Elemente bei einer Textsuche ueberhaupt in Frage kommen.
 * Die Oberflaeche ist MUI mit erzeugten Klassennamen — es gibt fast keine
 * stabilen Selektoren, geklickt wird ueber sichtbaren Text
 * (siehe doku/oberflaeche.md, Abschnitt 0.1).
 */
const CLICKABLE_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="switch"]',
  ".MuiListItemButton-root",
  ".MuiListItem-root",
  ".MuiMenuItem-root",
  ".MuiTab-root",
  'input[type="submit"]',
  'input[type="button"]',
  'input[type="checkbox"]',
  "[tabindex]",
].join(", ");

/** Kandidaten fuer die Datei, in der Chromium Port und Browser-Pfad ablegt. */
function portFileCandidates() {
  const home = os.homedir();
  return [
    path.join(home, "AppData", "Roaming", "Opera Software", "Opera Stable", "DevToolsActivePort"),
    path.join(home, "AppData", "Roaming", "Opera Software", "Opera GX Stable", "DevToolsActivePort"),
    path.join(home, "AppData", "Roaming", "Opera Software", "Opera Developer", "DevToolsActivePort"),
    path.join(home, "AppData", "Local", "Google", "Chrome", "User Data", "DevToolsActivePort"),
    path.join(home, "AppData", "Local", "Microsoft", "Edge", "User Data", "DevToolsActivePort"),
  ];
}

// ---------------------------------------------------------------------------
// Protokoll
// ---------------------------------------------------------------------------

/** Schreibvorgaenge nacheinander abarbeiten, damit sich Zeilen nicht mischen. */
let logChain = Promise.resolve();
let logDirReady = false;

function logFileFor(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  // Dateiname wird bei JEDEM Schreiben neu bestimmt, damit ein Lauf ueber
  // Mitternacht hinweg von selbst in die naechste Datei rutscht.
  return path.join(LOG_DIR, `${y}-${m}-${d}.log`);
}

/**
 * Eine Zeile ins Tagesprotokoll schreiben. Wirft nie — ein kaputtes Protokoll
 * darf den Nachtdienst nicht umbringen.
 */
export function writeLog(level, action, detail = "", options = {}) {
  const now = new Date();
  const line = `${now.toISOString()}\t${String(level).toUpperCase().padEnd(5)}\t${action}\t${detail}\n`;
  if (options.echoLog) process.stdout.write(line);
  logChain = logChain
    .then(async () => {
      if (!logDirReady) {
        await mkdir(LOG_DIR, { recursive: true });
        logDirReady = true;
      }
      await appendFile(logFileFor(now), line, "utf8");
    })
    .catch(() => {});
  return logChain;
}

// ---------------------------------------------------------------------------
// Fehlerarten — damit der Aufrufer unterscheiden kann, was los war
// ---------------------------------------------------------------------------

/** Der Tab ist nicht (mehr) Bitburner. Dienst verweigert. */
export class TabGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = "TabGuardError";
  }
}

/** Verbindung weg, Zeitgrenze gerissen, Ziel verschwunden. Erneut versuchbar. */
export class TransportError extends Error {
  constructor(message) {
    super(message);
    this.name = "TransportError";
  }
}

/** Der Seitenkontext hat eine Ausnahme geworfen. Nicht blind wiederholbar. */
export class PageError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "PageError";
    this.details = details;
  }
}

/** Element nicht gefunden, unsichtbar oder verdeckt. Es wurde NICHT geklickt. */
export class ElementError extends Error {
  constructor(message, info) {
    super(message);
    this.name = "ElementError";
    this.info = info;
  }
}

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = httpGet(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error("keine gueltige JSON-Antwort: " + e.message));
        }
      });
    });
    req.on("timeout", () => {
      req.destroy(new Error("Zeitgrenze"));
    });
    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Erkundung: wo ist der Browser-Endpunkt?
// ---------------------------------------------------------------------------

/**
 * Liefert die WebSocket-Adresse des BROWSER-Ziels.
 * Reihenfolge: Umgebungsvariable, HTTP-Erkundung, DevToolsActivePort-Datei.
 * @returns {Promise<{url: string, source: string}>}
 */
export async function discoverBrowserEndpoint(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const tried = [];

  // 1. Ausdrueckliche Vorgabe schlaegt alles.
  const fromEnv = process.env.NIGHTSHIFT_BROWSER_WS;
  if (fromEnv) return { url: fromEnv, source: "Umgebungsvariable NIGHTSHIFT_BROWSER_WS" };

  // 2. Der Normalweg jedes Chromium. Bei diesem Opera: 404.
  const versionUrl = `http://${opts.host}:${opts.port}/json/version`;
  try {
    const info = await httpGetJson(versionUrl, 3000);
    if (info && info.webSocketDebuggerUrl) {
      return { url: info.webSocketDebuggerUrl, source: versionUrl };
    }
    tried.push(`${versionUrl}: Antwort ohne webSocketDebuggerUrl`);
  } catch (e) {
    tried.push(`${versionUrl}: ${e.message}`);
  }

  // 3. Die Datei im Profilordner. Zwei Zeilen: Port, dann Pfad.
  const candidates = options.portFile ? [options.portFile] : portFileCandidates();
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf8");
      const [portLine, pathLine] = raw.trim().split(/\r?\n/);
      const port = Number(String(portLine).trim());
      const wsPath = String(pathLine || "").trim();
      if (!Number.isFinite(port) || !wsPath.startsWith("/devtools/")) {
        tried.push(`${file}: Inhalt unbrauchbar`);
        continue;
      }
      return { url: `ws://${opts.host}:${port}${wsPath}`, source: file };
    } catch (e) {
      tried.push(`${file}: ${e.code || e.message}`);
    }
  }

  throw new TransportError(
    "Kein Browser-Endpunkt gefunden. Laeuft Opera mit Remote-Debugging auf Port " +
      opts.port +
      "? Versucht:\n  - " +
      tried.join("\n  - "),
  );
}

// ---------------------------------------------------------------------------
// Der Tab
// ---------------------------------------------------------------------------

export class BitburnerTab {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    /** @type {WebSocket|null} */
    this.ws = null;
    this.sessionId = null;
    this.targetId = null;
    this.targetTitle = null;
    this.targetUrl = null;
    this.endpoint = null;

    this._nextId = 1;
    /** @type {Map<number, {resolve: Function, reject: Function, timer: any, method: string}>} */
    this._pending = new Map();
    this._connectPromise = null;
    this._closedOnPurpose = false;
    this._reconnectDelay = this.options.reconnectMinMs;
    this._reconnectTimer = null;
    this._heartbeatTimer = null;
  }

  get connected() {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN && this.sessionId);
  }

  _log(level, action, detail) {
    return writeLog(level, action, detail, this.options);
  }

  // -------------------------------------------------------------------------
  // Verbindung
  // -------------------------------------------------------------------------

  /** Baut die Verbindung auf und haengt sich an den Bitburner-Tab. */
  async connect() {
    return this._ensureSession();
  }

  /** Verbindung beenden. Muss aufgerufen werden, sonst endet der Prozess nie. */
  async close() {
    this._closedOnPurpose = true;
    this._stopHeartbeat();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    const ws = this.ws;
    this.ws = null;
    this.sessionId = null;
    this._rejectAllPending(new TransportError("Verbindung wurde absichtlich geschlossen"));
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      await new Promise((resolve) => {
        const done = () => resolve();
        ws.once("close", done);
        try {
          ws.close();
        } catch {
          resolve();
        }
        setTimeout(() => {
          try {
            ws.terminate();
          } catch {}
          resolve();
        }, 2000).unref?.();
      });
    }
    await this._log("info", "close", "Verbindung geschlossen");
  }

  _rejectAllPending(error) {
    for (const [, entry] of this._pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this._pending.clear();
  }

  /**
   * Sorgt dafuer, dass eine gueltige Sitzung existiert. Gleichzeitige Aufrufe
   * werden gebuendelt, damit nicht zwei Verbindungen zugleich aufgebaut werden.
   *
   * Zwei Stufen, weil sie sehr unterschiedlich teuer sind:
   *   - Steht die Leitung und fehlt nur die Sitzung (Tab neu geladen, Sitzung
   *     geloest), genuegt ein neues `Target.attachToTarget` — Bruchteile einer
   *     Sekunde.
   *   - Erst wenn die Leitung selbst weg ist, wird neu verbunden. Das kostet
   *     hier bis zu zehn Sekunden und wird darum vermieden, wo es geht.
   */
  async _ensureSession() {
    if (this.connected) return this.sessionId;
    if (!this._connectPromise) {
      this._connectPromise = (async () => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            return await this._attachToBitburner();
          } catch (e) {
            // Stimmt der Tab nicht, hilft kein Neuaufbau — durchreichen.
            if (e instanceof TabGuardError) throw e;
            await this._log("warn", "attach", `${e.message} — Leitung wird neu aufgebaut`);
          }
        }
        return this._doConnect();
      })().finally(() => {
        this._connectPromise = null;
      });
    }
    return this._connectPromise;
  }

  async _doConnect() {
    this._closedOnPurpose = false;

    // Alte Verbindung sauber wegraeumen, bevor eine neue aufgemacht wird.
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.terminate();
      } catch {}
      this.ws = null;
      this.sessionId = null;
    }

    // Mehrere Anlaeufe mit wachsender Pause. Opera antwortet auf zu schnell
    // aufeinanderfolgende Verbindungsversuche erst mit 403 und dann gar nicht
    // mehr; wer stur weiterprobiert, haelt die Drosselung nur aufrecht.
    //
    // Die Adresse wird bei JEDEM Versuch neu ermittelt und nicht einmal oben
    // gemerkt. Grund, in der Nacht vom 19.08. beobachtet: startet der
    // Debugging-Dienst von Opera neu, bekommt das Browser-Ziel eine neue
    // Kennung (`/devtools/browser/<uuid>`). Wer sich die alte Adresse merkt,
    // versucht danach stundenlang, eine Leiche anzurufen.
    const waits = [5000, 30000, 90000];
    let lastError = null;
    for (let attempt = 0; attempt < Math.max(1, this.options.connectAttempts); attempt++) {
      if (attempt > 0) {
        const wait = waits[Math.min(attempt - 1, waits.length - 1)];
        await this._log("info", "connect", `Versuch ${attempt + 1} in ${wait} ms`);
        await sleep(wait);
      }
      try {
        const found = await discoverBrowserEndpoint(this.options);
        if (found.url !== this.endpoint) {
          await this._log(
            "info",
            "discover",
            `${found.url} (Quelle: ${found.source})${this.endpoint ? " — Adresse hat sich geaendert" : ""}`,
          );
        }
        this.endpoint = found.url;
        this.ws = await this._openSocket(found.url);
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        await this._log("warn", "connect", `Versuch ${attempt + 1} fehlgeschlagen: ${e.message}`);
      }
    }
    if (lastError) throw lastError;

    await this._attachToBitburner();
    this._reconnectDelay = this.options.reconnectMinMs;
    this._startHeartbeat();
    return this.sessionId;
  }

  /**
   * Alle paar Sekunden ein billiges Kommando ans Browser-Ziel schicken.
   * Zweck ist weniger das Wachhalten als das FRUEHE Bemerken: eine tote
   * Leitung faellt so binnen einer halben Minute auf und nicht erst dann,
   * wenn die Ablaufschicht nachts um drei etwas erledigen will. Weil ein
   * neuer Verbindungsaufbau hier teuer ist, lohnt sich das doppelt.
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    const every = this.options.heartbeatMs;
    if (!every) return;
    this._heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this._send("Browser.getVersion", {}, { timeoutMs: 10000 }).catch((e) => {
        this._log("warn", "heartbeat", `keine Antwort: ${e.message}`);
        try {
          this.ws?.terminate();
        } catch {}
      });
    }, every);
    this._heartbeatTimer.unref?.();
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _openSocket(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        perMessageDeflate: false,
        maxPayload: 256 * 1024 * 1024,
        handshakeTimeout: this.options.connectTimeoutMs,
      });
      const timer = setTimeout(() => {
        try {
          ws.terminate();
        } catch {}
        reject(new TransportError(`Zeitgrenze beim Verbinden mit ${url}`));
      }, this.options.connectTimeoutMs);
      timer.unref?.();

      ws.once("open", () => {
        clearTimeout(timer);
        ws.on("message", (raw) => this._onMessage(raw));
        ws.on("close", (code) => this._onSocketClosed(`WebSocket geschlossen (Code ${code})`));
        ws.on("error", (err) => this._onSocketError(err));
        resolve(ws);
      });
      ws.once("error", (err) => {
        clearTimeout(timer);
        // 403 heisst hier nicht "verboten", sondern "zu schnell hintereinander".
        // Opera drosselt neue Debugging-Verbindungen; nach etwa einer Minute
        // Ruhe geht es wieder. Das gehoert in den Fehlertext, sonst sucht man
        // nachts an der falschen Stelle.
        const hint = /403/.test(err.message)
          ? " — Opera drosselt neue Debugging-Verbindungen. Kein Rechtefehler, sondern zu viele Verbindungsversuche kurz hintereinander. Laenger warten."
          : "";
        reject(new TransportError(`Verbindung zu ${url} fehlgeschlagen: ${err.message}${hint}`));
      });
    });
  }

  _onSocketError(err) {
    this._log("warn", "socket", `Fehler: ${err.message}`);
  }

  _onSocketClosed(reason) {
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
      } catch {}
    }
    this.ws = null;
    this.sessionId = null;
    this._rejectAllPending(new TransportError(reason));
    // Ein geplantes Schliessen ist keine Warnung. Sonst steht das Nachtprotokoll
    // voller WARN-Zeilen, und die echten gehen darin unter.
    this._log(this._closedOnPurpose ? "info" : "warn", "socket", reason);
    if (!this._closedOnPurpose) this._scheduleReconnect();
  }

  /**
   * Von selbst wieder anklopfen. Der Zeitgeber ist `unref`-t: er haelt den
   * Prozess nicht kuenstlich am Leben, hilft aber einem Dauerlauf ueber
   * Stoerungen hinweg, ohne auf den naechsten Befehl warten zu muessen.
   */
  _scheduleReconnect() {
    if (this._reconnectTimer || this._closedOnPurpose) return;
    // Laeuft schon ein Verbindungsaufbau, nicht noch einen danebenstellen.
    // Zwei parallele Versuche halten die Drosselung nur am Leben.
    if (this._connectPromise) return;
    const delay = this._reconnectDelay;
    this._reconnectDelay = Math.min(this._reconnectDelay * 2, this.options.reconnectMaxMs);
    this._log("info", "reconnect", `neuer Versuch in ${delay} ms`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._ensureSession().catch((e) => {
        this._log("warn", "reconnect", `fehlgeschlagen: ${e.message}`);
        this._scheduleReconnect();
      });
    }, delay);
    this._reconnectTimer.unref?.();
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.id && this._pending.has(msg.id)) {
      const entry = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error) entry.reject(new TransportError(`${entry.method}: ${msg.error.message}`));
      else entry.resolve(msg.result);
      return;
    }

    // Ereignisse: nur die, die unsere Sitzung betreffen.
    if (msg.method === "Target.detachedFromTarget" && msg.params?.sessionId === this.sessionId) {
      this.sessionId = null;
      this._log("warn", "session", "Sitzung vom Ziel geloest (Tab neu geladen oder geschlossen)");
    } else if (msg.method === "Target.targetCrashed") {
      this._log("warn", "session", `Ziel abgestuerzt: ${JSON.stringify(msg.params)}`);
      if (msg.params?.targetId === this.targetId) this.sessionId = null;
    }
  }

  /** Ein CDP-Kommando abschicken. */
  _send(method, params = {}, { sessionId, timeoutMs } = {}) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new TransportError(`${method}: keine offene Verbindung`));
    }
    const id = this._nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      const limit = timeoutMs ?? this.options.commandTimeoutMs;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new TransportError(`${method}: Zeitgrenze von ${limit} ms gerissen`));
      }, limit);
      timer.unref?.();
      this._pending.set(id, { resolve, reject, timer, method });
      try {
        ws.send(JSON.stringify(message));
      } catch (e) {
        clearTimeout(timer);
        this._pending.delete(id);
        reject(new TransportError(`${method}: Senden fehlgeschlagen: ${e.message}`));
      }
    });
  }

  // -------------------------------------------------------------------------
  // Ziel finden und pruefen
  // -------------------------------------------------------------------------

  /** Sucht den Bitburner-Tab, haengt sich an und prueft Titel und URL. */
  async _attachToBitburner() {
    const { targetInfos } = await this._send("Target.getTargets", {}, { timeoutMs: this.options.commandTimeoutMs });
    const pages = targetInfos.filter((t) => t.type === "page");
    const matches = pages.filter((t) => t.url.includes(this.options.urlMarker));

    if (matches.length === 0) {
      const list = pages.map((t) => `${t.title} <${t.url}>`).join("; ") || "(keine)";
      throw new TabGuardError(
        `Kein Tab mit "${this.options.urlMarker}" offen. Vorhandene Seiten: ${list}`,
      );
    }

    // Bei mehreren Treffern den nehmen, dessen Titel auch stimmt.
    let target = matches.find((t) => (t.title || "").startsWith(this.options.titlePrefix)) || matches[0];
    if (matches.length > 1) {
      await this._log(
        "warn",
        "attach",
        `${matches.length} Bitburner-Tabs offen, gewaehlt: ${target.targetId} "${target.title}"`,
      );
    }

    const { sessionId } = await this._send("Target.attachToTarget", {
      targetId: target.targetId,
      flatten: true,
    });

    this.sessionId = sessionId;
    this.targetId = target.targetId;
    this.targetTitle = target.title;
    this.targetUrl = target.url;

    // Titel aus Target.getTargets kann veraltet sein — deshalb live nachsehen.
    const live = await this._rawEval(
      "({ title: document.title, href: location.href, ready: document.readyState })",
      this.options.commandTimeoutMs,
    );
    this.targetTitle = live.title;
    this.targetUrl = live.href;

    // Stimmt etwas nicht, wird die eben aufgebaute Sitzung wieder geloest.
    // Sonst sammeln sich ueber eine lange Nacht tote Sitzungen im Browser an.
    const refuse = async (message) => {
      const stale = this.sessionId;
      this.sessionId = null;
      if (stale) await this._send("Target.detachFromTarget", { sessionId: stale }).catch(() => {});
      throw new TabGuardError(message);
    };

    if (!String(live.href).includes(this.options.urlMarker)) {
      await refuse(`Angehaengter Tab hat die falsche URL: ${live.href}`);
    }
    if (!String(live.title).startsWith(this.options.titlePrefix)) {
      await refuse(
        `Angehaengter Tab hat den falschen Titel: "${live.title}" (erwartet: beginnt mit "${this.options.titlePrefix}"). Dienst verweigert.`,
      );
    }

    await this._log("info", "attach", `Tab ${this.targetId} "${live.title}" <${live.href}>`);
    return sessionId;
  }

  /** Auswertung OHNE Waechter — nur fuer die Pruefung beim Anhaengen selbst. */
  async _rawEval(expression, timeoutMs) {
    const result = await this._send(
      "Runtime.evaluate",
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: Math.max(1000, timeoutMs - 1000),
      },
      { sessionId: this.sessionId, timeoutMs },
    );
    if (result.exceptionDetails) throw pageErrorFrom(result.exceptionDetails);
    return result.result?.value;
  }

  // -------------------------------------------------------------------------
  // Auswertung im Seitenkontext
  // -------------------------------------------------------------------------

  /** Der Waechter, der in JEDE Auswertung mit eingebaut wird. */
  _guardSource() {
    const title = JSON.stringify(this.options.titlePrefix);
    const marker = JSON.stringify(this.options.urlMarker);
    return (
      `if (!document.title.startsWith(${title})) throw new Error("NIGHTSHIFT-GUARD: falscher Titel: " + document.title);` +
      `if (!location.href.includes(${marker})) throw new Error("NIGHTSHIFT-GUARD: falsche URL: " + location.href);`
    );
  }

  /**
   * JavaScript im Tab auswerten.
   *
   * `source` darf sein:
   *   - ein Ausdruck:            "document.title"
   *   - eine Pfeilfunktion:      "() => { const a = 1; return a + 1; }"
   *   - eine async-Funktion:     "async () => (await fetch('/')).status"
   * Ergibt der Ausdruck eine Funktion, wird sie aufgerufen; ein Promise wird
   * abgewartet. Der Rueckgabewert muss JSON-tauglich sein.
   *
   * Wirft `PageError`, wenn im Seitenkontext etwas schiefgeht — Fehler werden
   * ausdruecklich NICHT verschluckt.
   *
   * @param {string} source
   * @param {{timeoutMs?: number, allowRetry?: boolean}} [opts]
   */
  async eval(source, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? this.options.commandTimeoutMs;
    const wrapped =
      `(async () => {${this._guardSource()}\n` +
      `  const __result = (${source});\n` +
      `  return await (typeof __result === "function" ? __result() : __result);\n` +
      `})()`;

    return this._withSession(
      async () => {
        const result = await this._send(
          "Runtime.evaluate",
          {
            expression: wrapped,
            awaitPromise: true,
            returnByValue: true,
            timeout: Math.max(1000, timeoutMs - 1000),
          },
          { sessionId: this.sessionId, timeoutMs },
        );
        if (result.exceptionDetails) throw pageErrorFrom(result.exceptionDetails);
        return result.result?.value;
      },
      "eval",
      String(source).replace(/\s+/g, " ").slice(0, 160),
      opts,
    );
  }

  /** Bequemer Zweitname. */
  evaluate(source, opts) {
    return this.eval(source, opts);
  }

  /**
   * Fuehrt eine Aktion aus und kuemmert sich um Sitzung, Waechter und einen
   * einzigen Wiederholungsversuch nach einem Transportfehler.
   *
   * WICHTIG: Wiederholt wird ausschliesslich bei `TransportError` und bei einem
   * Waechter-Fehlschlag VOR der eigentlichen Wirkung. Nichts, was im Spiel
   * schon etwas ausgeloest hat, wird je ein zweites Mal geschickt — sonst
   * kauft der Nachtdienst irgendwann zweimal.
   */
  async _withSession(work, action, detail, opts = {}) {
    const allowRetry = opts.allowRetry !== false;
    let lastError = null;

    for (let attempt = 0; attempt < (allowRetry ? 2 : 1); attempt++) {
      try {
        await this._ensureSession();
        const value = await work();
        // `quiet` gibt es fuer Schleifen, die im Sekundentakt nachsehen —
        // sonst ersaeuft das Tagesprotokoll in Wartezeilen.
        if (!opts.quiet) await this._log("info", action, detail);
        return value;
      } catch (e) {
        lastError = e;

        // Waechter hat angeschlagen: einmal neu suchen — vielleicht liegt
        // Bitburner inzwischen in einem anderen Tab.
        const guardTripped =
          e instanceof TabGuardError || (e instanceof PageError && /NIGHTSHIFT-GUARD/.test(e.message));
        if (guardTripped) {
          await this._log("warn", action, `Waechter: ${e.message}`);
          this.sessionId = null;
          if (attempt === 0 && allowRetry) continue;
          throw new TabGuardError(
            `Dienst verweigert — der angesprochene Tab ist nicht Bitburner. ${e.message}`,
          );
        }

        if (e instanceof TransportError && attempt === 0 && allowRetry) {
          await this._log("warn", action, `${e.message} — ein Versuch wird wiederholt`);
          this.sessionId = null;
          await sleep(500);
          continue;
        }

        await this._log("error", action, `${e.name}: ${e.message} | ${detail}`);
        throw e;
      }
    }
    throw lastError;
  }

  /**
   * Wartet, bis ein Ausdruck einen wahren Wert liefert.
   * @param {string} source  wie bei `eval`
   * @param {{timeoutMs?: number, intervalMs?: number, label?: string}} [opts]
   */
  async waitFor(source, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 30000;
    const intervalMs = opts.intervalMs ?? 250;
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
      last = await this.eval(source, { quiet: true });
      if (last) return last;
      await sleep(intervalMs);
    }
    throw new TransportError(
      `waitFor: ${opts.label || String(source).slice(0, 80)} wurde in ${timeoutMs} ms nicht wahr (zuletzt: ${JSON.stringify(last)})`,
    );
  }

  // -------------------------------------------------------------------------
  // Klicken
  // -------------------------------------------------------------------------

  /**
   * Sucht ein Element, ohne zu klicken. Gut fuer Trockenlaeufe und Diagnose.
   * @param {string|object} target  CSS-Selektor, Textmuster oder Beschreibung
   * @returns {Promise<object>} { found, x, y, rect, tag, text, hitOk, ... }
   */
  async find(target, opts = {}) {
    const spec = normalizeTarget(target, opts);
    return this.eval(locatorSource(spec), { timeoutMs: opts.timeoutMs });
  }

  /**
   * Echter, vertrauenswuerdiger Klick — der Kern dieser Datei.
   *
   * Ablauf: Element suchen, Mittelpunkt bestimmen, pruefen dass dort auch
   * wirklich dieses Element liegt, dann `Input.dispatchMouseEvent`. Solche
   * Ereignisse kommen mit `isTrusted === true` an; ein `element.click()` nicht.
   *
   * Wird das Element nicht gefunden, ist es unsichtbar oder verdeckt, gibt es
   * einen Fehler und KEINEN Klick. Lieber nichts tun als blind irgendwohin.
   *
   * @param {string|object} target
   *   - String: wird zuerst als CSS-Selektor versucht; findet der nichts (oder
   *     ist er kein gueltiger Selektor), gilt er als Textmuster.
   *   - Objekt: { selector?, text?, exact?, regex?, within?, index?, clickable? }
   * @param {{timeoutMs?: number, bringToFront?: boolean, scroll?: boolean,
   *          allowAncestorHit?: boolean, pressMs?: number}} [opts]
   */
  async clickTrusted(target, opts = {}) {
    const spec = normalizeTarget(target, opts);
    const label = describeSpec(spec);

    // Schritt 1 und 2 sind wiederholbar: bis hierher ist im Spiel nichts passiert.
    const hit = await this._withSession(
      async () => {
        const found = await this.eval(locatorSource(spec), {
          timeoutMs: opts.timeoutMs,
          allowRetry: false,
          quiet: true,
        });
        if (!found.found) {
          throw new ElementError(`Element nicht gefunden (${label}): ${found.reason}`, found);
        }
        if (!found.visible) {
          throw new ElementError(`Element ist unsichtbar (${label}): ${found.reason}`, found);
        }
        if (!found.hitOk) {
          throw new ElementError(
            `Element ist verdeckt (${label}). Am Mittelpunkt (${found.x}, ${found.y}) liegt ` +
              `<${found.hitTag}> "${String(found.hitText).slice(0, 60)}" statt des Ziels. Es wurde NICHT geklickt.`,
            found,
          );
        }
        return found;
      },
      "click.locate",
      label,
      opts,
    );

    // Schritt 3: ab hier NICHT mehr wiederholen.
    const bringToFront = opts.bringToFront ?? this.options.bringToFront;
    if (bringToFront) {
      await this._send("Page.bringToFront", {}, { sessionId: this.sessionId }).catch(() => {});
    }

    const point = { x: hit.x, y: hit.y };
    const session = { sessionId: this.sessionId, timeoutMs: opts.timeoutMs ?? this.options.commandTimeoutMs };

    try {
      await this._send(
        "Input.dispatchMouseEvent",
        { type: "mouseMoved", x: point.x, y: point.y, button: "none", buttons: 0, clickCount: 0 },
        session,
      );
      await this._send(
        "Input.dispatchMouseEvent",
        { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 },
        session,
      );
      await sleep(opts.pressMs ?? 40);
      await this._send(
        "Input.dispatchMouseEvent",
        { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 },
        session,
      );
    } catch (e) {
      // Halb abgeschickter Klick: das muss im Protokoll stehen, damit man
      // spaeter nicht raetselt, ob die Aktion gewirkt hat.
      await this._log("error", "click.dispatch", `${label} bei (${point.x}, ${point.y}) abgebrochen: ${e.message}`);
      throw e;
    }

    await this._log("info", "click", `${label} -> <${hit.tag}> "${String(hit.text).slice(0, 60)}" bei (${point.x}, ${point.y})`);
    return { ...hit, clicked: true };
  }

  /** Zweitname, weil "click" sich natuerlicher liest. */
  click(target, opts) {
    return this.clickTrusted(target, opts);
  }

  // -------------------------------------------------------------------------
  // Terminal
  // -------------------------------------------------------------------------

  /**
   * Text in ein Eingabefeld schreiben (standardmaessig das Terminal), ohne
   * abzuschicken.
   *
   * React haengt an `value` einen eigenen Setter; wer nur `el.value = x`
   * schreibt, den bemerkt React nicht. Deshalb der native Setter von
   * `HTMLInputElement` plus ein `input`-Ereignis.
   *
   * @param {string} text
   * @param {{selector?: string, submit?: boolean, timeoutMs?: number}} [opts]
   */
  async type(text, opts = {}) {
    const selector = opts.selector ?? "#terminal-input";
    const source = `() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("Eingabefeld nicht gefunden: " + ${JSON.stringify(selector)});
      if (el.disabled) throw new Error("Eingabefeld ist gesperrt (laeuft gerade eine Aktion?)");
      el.focus();
      ${NATIVE_SETTER_SNIPPET}
      setNativeValue(el, ${JSON.stringify(text)});
      ${opts.submit ? PRESS_ENTER_SNIPPET : ""}
      return { value: el.value, submitted: ${opts.submit ? "true" : "false"} };
    }`;
    return this._withSession(
      () => this.eval(source, { timeoutMs: opts.timeoutMs, allowRetry: false }),
      "type",
      `${selector} <- ${JSON.stringify(text).slice(0, 80)}${opts.submit ? " (+Enter)" : ""}`,
      // Ein reines Eintippen ohne Absenden ist folgenlos und darf wiederholt
      // werden. Mit `submit` waere es das nicht.
      { allowRetry: !opts.submit },
    );
  }

  /** Die letzten `count` Zeilen der Terminalausgabe lesen. Aendert nichts. */
  async terminalTail(count = 20) {
    return this.eval(`() => {
      const ul = document.getElementById("terminal");
      if (!ul) return null;
      const kids = Array.from(ul.children);
      return { total: kids.length, lines: kids.slice(-${Number(count) || 20}).map(li => li.innerText) };
    }`);
  }

  /** Zustand des Terminals: da? gesperrt? wie viele Zeilen? */
  async terminalState() {
    return this.eval(`() => {
      const input = document.getElementById("terminal-input");
      const ul = document.getElementById("terminal");
      return {
        present: !!input && !!ul,
        disabled: input ? !!input.disabled : null,
        lineCount: ul ? ul.children.length : -1,
      };
    }`);
  }

  /**
   * Einen Terminalbefehl absetzen und die NEUE Ausgabe zurueckgeben.
   *
   * Vorgehen: Zeilen zaehlen, Befehl absetzen, warten bis neue Zeilen da sind
   * und sich die Zahl beruhigt hat, dann die neuen Zeilen lesen. Gefunden wird
   * der Anfang der Antwort ueber die Echo-Zeile (`[home /]> help`) — das haelt
   * auch, wenn das Spiel oben alte Zeilen abschneidet.
   *
   * ACHTUNG: Ist der Befehl einmal abgeschickt, wird er NIE wiederholt. Reisst
   * die Verbindung danach ab, gibt es einen Fehler mit dem Hinweis, dass der
   * Befehl im Spiel unter Umstaenden trotzdem gelaufen ist.
   *
   * @param {string} command
   * @param {{timeoutMs?: number, settleMs?: number, maxWaitMs?: number,
   *          requireOutput?: boolean, waitForIdle?: boolean}} [opts]
   * @returns {Promise<{command: string, lines: string[], text: string,
   *                    echoFound: boolean, durationMs: number, timedOut: boolean}>}
   */
  async terminal(command, opts = {}) {
    const cmd = String(command);
    const settleMs = opts.settleMs ?? 300;
    const maxWaitMs = opts.maxWaitMs ?? 15000;
    const requireOutput = opts.requireOutput !== false;
    const started = Date.now();

    // --- Vorbereitung (wiederholbar, im Spiel passiert noch nichts) ---
    const before = await this._withSession(
      async () => {
        const state = await this.eval(
          `() => {
            const input = document.getElementById("terminal-input");
            const ul = document.getElementById("terminal");
            return {
              present: !!input && !!ul,
              disabled: input ? !!input.disabled : null,
              lineCount: ul ? ul.children.length : -1,
            };
          }`,
          { timeoutMs: opts.timeoutMs, allowRetry: false, quiet: true },
        );
        if (!state.present) {
          throw new ElementError(
            'Terminal ist nicht offen — "#terminal-input" bzw. "#terminal" fehlt im DOM. ' +
              "Das Spiel steht gerade auf einer anderen Seite. Diese Schicht wechselt die Seite " +
              "absichtlich nicht von selbst; das gehoert in die Ablaufschicht.",
            state,
          );
        }
        if (state.disabled) {
          throw new ElementError(
            "Terminal ist gesperrt — es laeuft gerade eine Aktion (z. B. backdoor). Spaeter erneut versuchen.",
            state,
          );
        }
        return state;
      },
      "terminal.prepare",
      cmd,
      opts,
    );

    // --- Absetzen (ab hier keine Wiederholung mehr) ---
    await this._log("info", "terminal.submit", cmd);
    try {
      await this.eval(
        `() => {
          const el = document.getElementById("terminal-input");
          if (!el) throw new Error("Eingabefeld verschwunden");
          if (el.disabled) throw new Error("Eingabefeld gesperrt");
          el.focus();
          ${NATIVE_SETTER_SNIPPET}
          setNativeValue(el, ${JSON.stringify(cmd)});
          ${PRESS_ENTER_SNIPPET}
          return true;
        }`,
        { timeoutMs: opts.timeoutMs, allowRetry: false, quiet: true },
      );
    } catch (e) {
      await this._log("error", "terminal.submit", `${cmd}: ${e.message}`);
      throw e;
    }

    // --- Auf die Antwort warten ---
    let lastCount = before.lineCount;
    let stableSince = null;
    let sawGrowth = false;
    let timedOut = false;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await sleep(100);
      let now;
      try {
        now = await this.eval(
          `() => { const ul = document.getElementById("terminal"); return ul ? ul.children.length : -1; }`,
          { timeoutMs: opts.timeoutMs, allowRetry: false, quiet: true },
        );
      } catch (e) {
        await this._log(
          "error",
          "terminal.wait",
          `${cmd}: ${e.message} — der Befehl ist bereits abgeschickt und kann im Spiel gelaufen sein`,
        );
        throw e;
      }

      if (now !== lastCount) {
        if (now > lastCount || sawGrowth) sawGrowth = true;
        lastCount = now;
        stableSince = null;
        continue;
      }
      if (sawGrowth) {
        if (stableSince === null) stableSince = Date.now();
        else if (Date.now() - stableSince >= settleMs) break;
      }
    }
    if (!sawGrowth) timedOut = true;

    // --- Optional: warten, bis eine laufende Aktion fertig ist ---
    if (opts.waitForIdle) {
      await this.waitFor(
        `() => { const el = document.getElementById("terminal-input"); return !!el && !el.disabled; }`,
        { timeoutMs: opts.idleTimeoutMs ?? 600000, intervalMs: 1000, label: "Terminal wieder frei" },
      );
    }

    // --- Neue Zeilen einsammeln ---
    const harvest = await this.eval(
      `() => {
        const ul = document.getElementById("terminal");
        if (!ul) return { lines: [], echoFound: false, total: -1 };
        const kids = Array.from(ul.children).map(li => li.innerText);
        const needle = "> " + ${JSON.stringify(cmd)};
        let idx = -1;
        for (let i = kids.length - 1; i >= 0; i--) {
          if (kids[i].endsWith(needle)) { idx = i; break; }
        }
        const fallback = ${before.lineCount};
        return {
          lines: idx >= 0 ? kids.slice(idx + 1) : kids.slice(Math.max(0, fallback)),
          echoFound: idx >= 0,
          total: kids.length,
        };
      }`,
      { timeoutMs: opts.timeoutMs, allowRetry: false, quiet: true },
    );

    const result = {
      command: cmd,
      lines: harvest.lines,
      text: harvest.lines.join("\n"),
      echoFound: harvest.echoFound,
      totalLines: harvest.total,
      durationMs: Date.now() - started,
      timedOut,
    };

    await this._log(
      timedOut ? "warn" : "info",
      "terminal.result",
      `${cmd}: ${result.lines.length} Zeile(n)${timedOut ? " — keine neue Ausgabe innerhalb der Wartezeit" : ""}`,
    );

    if (timedOut && requireOutput && !result.echoFound) {
      throw new TransportError(
        `Terminalbefehl "${cmd}" hat innerhalb von ${maxWaitMs} ms keine neue Ausgabe erzeugt. ` +
          "Moeglicherweise wurde er nicht angenommen.",
      );
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Auskunft
  // -------------------------------------------------------------------------

  /** Wer sind wir gerade? Nur lesend. */
  async info() {
    await this._ensureSession();
    const live = await this.eval(`() => ({
      title: document.title,
      href: location.href,
      readyState: document.readyState,
      visibility: document.visibilityState,
      hasFocus: document.hasFocus(),
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      terminalPresent: !!document.getElementById("terminal-input"),
      terminalLines: (document.getElementById("terminal") || { children: [] }).children.length,
    })`);
    return {
      endpoint: this.endpoint,
      targetId: this.targetId,
      sessionId: this.sessionId,
      ...live,
    };
  }
}

// ---------------------------------------------------------------------------
// Bausteine fuer den Seitenkontext
// ---------------------------------------------------------------------------

/**
 * React haengt an `value` einen eigenen Setter. Wer `el.value = x` schreibt,
 * aendert nur die Anzeige; React merkt nichts und macht den Wert beim naechsten
 * Rendern wieder platt. Der native Setter des Prototyps umgeht das, das
 * `input`-Ereignis meldet die Aenderung ordentlich an.
 */
const NATIVE_SETTER_SNIPPET = `
      const setNativeValue = (el, value) => {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value").set;
        setter.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };`;

/**
 * Enter direkt auf dem Eingabefeld. Das Terminal prueft `isTrusted` NICHT
 * (siehe doku/oberflaeche.md 0.2 — dort stehen die sechs Stellen, die es tun,
 * das Terminal ist nicht dabei), also genuegt ein erzeugtes Tastenereignis.
 * Vorteil gegenueber einem CDP-Tastendruck: es landet garantiert auf diesem
 * Element und nicht irgendwo, falls der Fokus woanders sitzt.
 */
const PRESS_ENTER_SNIPPET = `
      el.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true,
      }));`;

/** Kurze, lesbare Beschreibung einer Zielangabe fuers Protokoll. */
function describeSpec(spec) {
  if (spec.selector) return `selector=${spec.selector}`;
  if (spec.regex) return `regex=${spec.regex}`;
  if (spec.text != null) return `text=${JSON.stringify(spec.text)}`;
  return `ziel=${JSON.stringify(spec.selectorOrText)}`;
}

/** Zielangabe vereinheitlichen. */
function normalizeTarget(target, opts = {}) {
  const spec = {
    selector: null,
    text: null,
    regex: null,
    exact: false,
    within: null,
    index: 0,
    clickable: CLICKABLE_SELECTOR,
    scroll: opts.scroll !== false,
    allowAncestorHit: !!opts.allowAncestorHit,
  };
  if (typeof target === "string") {
    // Ein String wird erst als CSS-Selektor probiert, dann als Text. Das
    // entscheidet der Seitenkontext, weil nur dort feststeht, ob der Selektor
    // gueltig ist und etwas trifft.
    spec.selectorOrText = target;
  } else if (target && typeof target === "object") {
    Object.assign(spec, target);
  } else {
    throw new TypeError("clickTrusted braucht einen String oder ein Objekt als Ziel");
  }
  return spec;
}

/**
 * Baut den Sucher fuer den Seitenkontext. Liefert Mittelpunkt und das
 * Ergebnis der Verdeckungspruefung — geklickt wird hier nichts.
 */
function locatorSource(spec) {
  return `() => {
    const spec = ${JSON.stringify(spec)};
    const describe = (el) => ({
      tag: el.tagName,
      text: (el.innerText || el.value || "").trim().slice(0, 80),
      cls: String(el.className || "").slice(0, 60),
    });
    const isVisible = (el) => {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    let elements = [];
    let mode = "";

    // 1. Als CSS-Selektor versuchen.
    const asSelector = spec.selector || spec.selectorOrText;
    if (asSelector) {
      try {
        const hits = Array.from(document.querySelectorAll(asSelector));
        if (hits.length > 0) { elements = hits; mode = "selector"; }
      } catch (e) {
        // Kein gueltiger Selektor — dann eben Text.
        if (spec.selector) {
          return { found: false, reason: "ungueltiger CSS-Selektor: " + e.message };
        }
      }
      if (spec.selector && elements.length === 0) {
        return { found: false, reason: "CSS-Selektor trifft nichts: " + spec.selector };
      }
    }

    // 2. Sonst ueber sichtbaren Text.
    if (elements.length === 0) {
      const needle = spec.text != null ? spec.text : spec.selectorOrText;
      const rx = spec.regex ? new RegExp(spec.regex) : null;
      if (needle == null && !rx) return { found: false, reason: "weder Selektor noch Text angegeben" };
      mode = "text";

      const scope = spec.within ? document.querySelector(spec.within) : document;
      if (!scope) return { found: false, reason: "Bereich nicht gefunden: " + spec.within };

      const pool = Array.from(scope.querySelectorAll(spec.clickable));
      elements = pool.filter((el) => {
        const t = (el.innerText || el.value || "").trim();
        if (rx) return rx.test(t);
        return spec.exact ? t === needle : t.includes(needle);
      });

      if (elements.length === 0) {
        // Zur Diagnose: was gaebe es denn ueberhaupt in der Naehe?
        const near = pool
          .filter(isVisible)
          .map((el) => (el.innerText || "").trim().split("\\n")[0])
          .filter(Boolean)
          .slice(0, 25);
        return {
          found: false,
          reason: "kein anklickbares Element mit diesem Text",
          needle: String(needle == null ? spec.regex : needle),
          nearby: near,
        };
      }
    }

    const visible = elements.filter(isVisible);
    if (visible.length === 0) {
      return { found: true, visible: false, reason: "gefunden, aber unsichtbar", count: elements.length,
               candidates: elements.slice(0, 5).map(describe) };
    }

    // Bei Textsuche schlaegt der Treffer mit der kleinsten Flaeche zu — sonst
    // erwischt man den umschliessenden Container statt des Knopfes. Echte
    // Knoepfe haben Vorrang vor allem anderen.
    const rank = (el) => {
      const r = el.getBoundingClientRect();
      const buttonish = el.tagName === "BUTTON" || el.getAttribute("role") === "button" ? 0 : 1;
      return buttonish * 1e9 + r.width * r.height;
    };
    const sorted = mode === "text" ? visible.slice().sort((a, b) => rank(a) - rank(b)) : visible;

    const idx = spec.index || 0;
    if (idx >= sorted.length) {
      return { found: false, reason: "index " + idx + " ausserhalb von " + sorted.length + " Treffern",
               candidates: sorted.slice(0, 5).map(describe) };
    }
    const el = sorted[idx];

    // Bei Bedarf in den sichtbaren Bereich rollen.
    let rect = el.getBoundingClientRect();
    const outOfView = rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth;
    let scrolled = false;
    if (outOfView && spec.scroll) {
      el.scrollIntoView({ block: "center", inline: "center" });
      rect = el.getBoundingClientRect();
      scrolled = true;
    }

    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    const inViewport = x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
    if (!inViewport) {
      return { found: true, visible: true, hitOk: false, x, y, scrolled,
               reason: "Mittelpunkt liegt ausserhalb des sichtbaren Bereichs",
               rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height }, ...describe(el) };
    }

    // Verdeckungspruefung: liegt an diesem Punkt auch wirklich unser Element?
    const hit = document.elementFromPoint(x, y);
    let hitOk = !!hit && (hit === el || el.contains(hit));
    if (!hitOk && spec.allowAncestorHit && hit && hit.contains(el)) hitOk = true;

    return {
      found: true,
      visible: true,
      hitOk,
      x, y, scrolled, mode,
      matchCount: sorted.length,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      ...describe(el),
      hitTag: hit ? hit.tagName : null,
      hitText: hit ? (hit.innerText || "").trim().slice(0, 80) : null,
      candidates: sorted.slice(0, 5).map(describe),
      reason: hitOk ? "" : "am Mittelpunkt liegt ein anderes Element",
    };
  }`;
}

/** Aus den CDP-Ausnahmedetails einen brauchbaren Fehler bauen. */
function pageErrorFrom(details) {
  const desc =
    details.exception?.description ||
    details.exception?.value ||
    details.text ||
    "unbekannter Fehler im Seitenkontext";
  const where =
    details.lineNumber != null ? ` (Zeile ${details.lineNumber}, Spalte ${details.columnNumber})` : "";
  return new PageError(String(desc).split("\n")[0] + where, details);
}

// ---------------------------------------------------------------------------
// Bequemer Einstieg
// ---------------------------------------------------------------------------

/**
 * Verbindet sich und liefert den fertigen Tab.
 * @param {object} [options] siehe DEFAULTS
 * @returns {Promise<BitburnerTab>}
 */
export async function connect(options = {}) {
  const tab = new BitburnerTab(options);
  await tab.connect();
  return tab;
}

// ---------------------------------------------------------------------------
// Kommandozeile — absichtlich nur harmlose Unterbefehle
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  const argument = rest.join(" ");
  const tab = new BitburnerTab({ echoLog: true });
  try {
    switch (command) {
      case "info":
        console.log(JSON.stringify(await tab.info(), null, 2));
        break;
      case "eval":
        if (!argument) throw new Error('Aufruf: node nightshift/cdp.js eval "document.title"');
        console.log(JSON.stringify(await tab.eval(argument), null, 2));
        break;
      case "find":
        if (!argument) throw new Error('Aufruf: node nightshift/cdp.js find "Terminal"');
        console.log(JSON.stringify(await tab.find(argument), null, 2));
        break;
      case "terminal":
        if (!argument) throw new Error('Aufruf: node nightshift/cdp.js terminal "help"');
        console.log((await tab.terminal(argument)).text);
        break;
      case "tail":
        console.log(JSON.stringify(await tab.terminalTail(Number(argument) || 20), null, 2));
        break;
      default:
        console.log(
          [
            "nightshift/cdp.js — Transport zum Bitburner-Tab",
            "",
            "  node nightshift/cdp.js info",
            '  node nightshift/cdp.js eval "document.title"',
            '  node nightshift/cdp.js find "Terminal"',
            '  node nightshift/cdp.js terminal "help"',
            "  node nightshift/cdp.js tail 20",
            "",
            "Klicken gibt es hier absichtlich nicht — das laeuft ueber die Bibliothek,",
            "damit niemand aus Versehen auf der Kommandozeile etwas ausloest.",
          ].join("\n"),
        );
    }
    await tab.close();
  } catch (e) {
    console.error(`${e.name}: ${e.message}`);
    await tab.close().catch(() => {});
    process.exitCode = 1;
  }
}
