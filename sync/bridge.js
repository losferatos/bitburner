/**
 * Bridge zwischen Bitburner (Browser) und diesem Rechner.
 *
 * Zwei Aufgaben in einem Prozess:
 *  1. RFA-Server (Remote File API) auf Port 12525. Das SPIEL verbindet sich
 *     hierher als WebSocket-Client. Wir stellen Anfragen, das Spiel antwortet.
 *     Darueber schieben wir unsere Skripte ins Spiel und lesen Zustand zurueck.
 *  2. Dashboard-Server auf Port 8795. Liefert die Oberflaeche und schickt
 *     Aktualisierungen per Server-Sent-Events an den Browser.
 *
 * Der Prozess muss lange laufen, ohne dass ihn irgendetwas umbringt.
 * Deshalb faengt praktisch jede Stelle ihre Fehler selbst ab.
 */

import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SCRIPT_DIR = path.join(ROOT, "src");
const DASHBOARD_DIR = path.join(ROOT, "dashboard");

const RFA_PORT = 12525;
const DASHBOARD_PORT = 8795;

// Datei, in die der Autopilot im Spiel seinen Zustand schreibt.
const TELEMETRY_PATH = "data/telemetry.txt";
const POLL_INTERVAL_MS = 2000;
// Anfragen ohne Antwort nicht ewig haengen lassen.
const REQUEST_TIMEOUT_MS = 15000;

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------

/** @type {import("ws").WebSocket | null} */
let gameSocket = null;
let nextRequestId = 1;
/** @type {Map<number, {resolve: Function, reject: Function, timer: NodeJS.Timeout}>} */
const pendingRequests = new Map();

/** Letzter bekannter Gesamtzustand, den das Dashboard anzeigt. */
const state = {
  connected: false,
  connectedSince: null,
  lastTelemetryAt: null,
  telemetry: null,
  servers: [],
  syncedFiles: [],
  log: [],
};

/** @type {Set<import("node:http").ServerResponse>} */
const dashboardClients = new Set();

// ---------------------------------------------------------------------------
// Protokollierung: geht auf die Konsole UND ins Dashboard
// ---------------------------------------------------------------------------

function log(level, message) {
  const entry = { at: new Date().toISOString(), level, message };
  state.log.push(entry);
  // Nicht unbegrenzt wachsen lassen, der Prozess laeuft moeglicherweise tagelang.
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  const stamp = entry.at.slice(11, 19);
  const mark = level === "error" ? "XX" : level === "warn" ? " !" : "  ";
  console.log(stamp + " " + mark + " " + message);
  broadcast({ type: "log", entry });
}

// ---------------------------------------------------------------------------
// RFA: Anfragen an das Spiel
// ---------------------------------------------------------------------------

/**
 * Schickt eine JSON-RPC-Anfrage ans Spiel und wartet auf die Antwort.
 * @param {string} method
 * @param {object} [params]
 * @returns {Promise<any>}
 */
function request(method, params) {
  return new Promise((resolve, reject) => {
    if (!gameSocket || gameSocket.readyState !== 1) {
      reject(new Error("Spiel ist nicht verbunden"));
      return;
    }
    const id = nextRequestId++;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Zeitueberschreitung bei " + method));
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timer });

    const payload = { jsonrpc: "2.0", id, method };
    if (params !== undefined) payload.params = params;
    try {
      gameSocket.send(JSON.stringify(payload));
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(err);
    }
  });
}

function handleGameMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    log("warn", "Unlesbare Nachricht vom Spiel erhalten");
    return;
  }
  const waiting = pendingRequests.get(msg.id);
  if (!waiting) return; // Antwort auf eine bereits abgelaufene Anfrage
  pendingRequests.delete(msg.id);
  clearTimeout(waiting.timer);
  if (msg.error !== undefined) reject_(waiting, msg.error);
  else waiting.resolve(msg.result);
}

function reject_(waiting, error) {
  waiting.reject(new Error(typeof error === "string" ? error : JSON.stringify(error)));
}

// ---------------------------------------------------------------------------
// Dateien ins Spiel schieben
// ---------------------------------------------------------------------------

const SYNCABLE = /\.(js|jsx|ts|tsx|txt|json|script)$/;

/** Sammelt alle spielbaren Dateien unter src/ rekursiv ein. */
async function collectScripts(dir = SCRIPT_DIR, prefix = "") {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const gameName = prefix ? prefix + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await collectScripts(full, gameName)));
    } else if (SYNCABLE.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      // Die Typdefinitionen sind nur fuer den Editor hier, nicht fuers Spiel.
      out.push({ localPath: full, gameName });
    }
  }
  return out;
}

async function pushFile(localPath, gameName) {
  const content = await readFile(localPath, "utf8");
  await request("pushFile", { filename: gameName, content, server: "home" });
  return gameName;
}

async function pushAll() {
  const files = await collectScripts();
  const done = [];
  for (const file of files) {
    try {
      await pushFile(file.localPath, file.gameName);
      done.push(file.gameName);
    } catch (err) {
      log("error", "Konnte " + file.gameName + " nicht uebertragen: " + err.message);
    }
  }
  state.syncedFiles = done;
  log("info", done.length + " Datei(en) ins Spiel uebertragen");
  broadcast({ type: "state", state: publicState() });
}

/**
 * Beobachtet src/ und schiebt geaenderte Dateien nach.
 * fs.watch feuert auf Windows mehrfach pro Speichervorgang, daher entprellt.
 */
function watchScripts() {
  /** @type {Map<string, NodeJS.Timeout>} */
  const pending = new Map();
  try {
    watch(SCRIPT_DIR, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const name = filename.toString().split(path.sep).join("/");
      if (name.endsWith(".d.ts") || !SYNCABLE.test(name)) return;

      clearTimeout(pending.get(name));
      pending.set(
        name,
        setTimeout(async () => {
          pending.delete(name);
          if (!gameSocket) return;
          try {
            await pushFile(path.join(SCRIPT_DIR, name), name);
            log("info", "Nachgeschoben: " + name);
          } catch (err) {
            // Geloeschte Dateien landen auch hier, das ist kein echter Fehler.
            log("warn", name + ": " + err.message);
          }
        }, 150),
      );
    });
    log("info", "Beobachte src/ auf Aenderungen");
  } catch (err) {
    log("error", "Dateibeobachtung nicht moeglich: " + err.message);
  }
}

// ---------------------------------------------------------------------------
// Telemetrie aus dem Spiel ziehen
// ---------------------------------------------------------------------------

async function pollTelemetry() {
  if (!gameSocket || gameSocket.readyState !== 1) return;

  try {
    const raw = await request("getFile", { filename: TELEMETRY_PATH, server: "home" });
    if (typeof raw === "string" && raw.trim()) {
      state.telemetry = JSON.parse(raw);
      state.lastTelemetryAt = new Date().toISOString();
    }
  } catch {
    // Solange der Autopilot im Spiel noch nichts geschrieben hat, ist das normal.
  }

  try {
    const servers = await request("getAllServers");
    if (Array.isArray(servers)) state.servers = servers;
  } catch {
    // nicht schlimm, naechster Durchlauf
  }

  broadcast({ type: "state", state: publicState() });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function publicState() {
  return {
    connected: state.connected,
    connectedSince: state.connectedSince,
    lastTelemetryAt: state.lastTelemetryAt,
    telemetry: state.telemetry,
    serverCount: state.servers.length,
    rootedCount: state.servers.filter((s) => s.hasAdminRights).length,
    purchasedCount: state.servers.filter((s) => s.purchasedByPlayer).length,
    syncedFiles: state.syncedFiles,
  };
}

function broadcast(payload) {
  const line = "data: " + JSON.stringify(payload) + "\n\n";
  for (const client of dashboardClients) {
    try {
      client.write(line);
    } catch {
      dashboardClients.delete(client);
    }
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function startDashboard() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("data: " + JSON.stringify({ type: "state", state: publicState() }) + "\n\n");
      for (const entry of state.log.slice(-60)) {
        res.write("data: " + JSON.stringify({ type: "log", entry }) + "\n\n");
      }
      dashboardClients.add(res);
      req.on("close", () => dashboardClients.delete(res));
      return;
    }

    if (url.pathname === "/api/state") {
      res.writeHead(200, { "Content-Type": MIME[".json"] });
      res.end(JSON.stringify({ ...publicState(), servers: state.servers, log: state.log.slice(-100) }));
      return;
    }

    // Direkter Draht zur Remote API, damit man das Spiel von aussen befragen
    // kann: /api/rpc?method=getFile&filename=x.txt&server=home
    // Reine Diagnose - der Autopilot selbst laeuft im Spiel.
    if (url.pathname === "/api/rpc") {
      const method = url.searchParams.get("method");
      if (!method) {
        res.writeHead(400, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: "Parameter 'method' fehlt" }));
        return;
      }
      const params = {};
      for (const [key, value] of url.searchParams) {
        if (key !== "method") params[key] = value;
      }
      try {
        const result = await request(method, Object.keys(params).length ? params : undefined);
        res.writeHead(200, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ result }, null, 1));
      } catch (err) {
        res.writeHead(502, { "Content-Type": MIME[".json"] });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    const wanted = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = path.join(DASHBOARD_DIR, path.normalize(wanted).replace(/^[\\/]+/, ""));
    if (!file.startsWith(DASHBOARD_DIR)) {
      res.writeHead(403).end("verboten");
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end("nicht gefunden");
    }
  });

  server.listen(DASHBOARD_PORT, () => {
    console.log("\n  Dashboard:  http://localhost:" + DASHBOARD_PORT + "/");
  });
  server.on("error", (err) => log("error", "Dashboard-Server: " + err.message));
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

function startRfaServer() {
  const wss = new WebSocketServer({ port: RFA_PORT });

  wss.on("connection", (socket) => {
    if (gameSocket) {
      // Bei einem Neuladen der Seite kommt eine zweite Verbindung. Die neue gilt.
      log("warn", "Zweite Spielverbindung - die alte wird ersetzt");
      try {
        gameSocket.close();
      } catch {
        // egal
      }
    }
    gameSocket = socket;
    state.connected = true;
    state.connectedSince = new Date().toISOString();
    log("info", "Spiel verbunden");

    socket.on("message", handleGameMessage);

    socket.on("close", () => {
      if (gameSocket === socket) {
        gameSocket = null;
        state.connected = false;
        log("warn", "Spielverbindung getrennt - warte auf neue Verbindung");
        broadcast({ type: "state", state: publicState() });
      }
    });

    socket.on("error", (err) => log("error", "Spielverbindung: " + err.message));

    // Beim Verbinden erst einmal alles hochladen.
    pushAll().catch((err) => log("error", "Erstuebertragung: " + err.message));
  });

  wss.on("error", (err) => log("error", "RFA-Server: " + err.message));

  console.log("  RFA-Port:   " + RFA_PORT + "  (im Spiel unter Options -> Remote API eintragen)");
}

console.log("\n=== Bitburner Autopilot: Bridge ===");
startRfaServer();
startDashboard();
watchScripts();
setInterval(() => {
  pollTelemetry().catch(() => {
    // Fehler sind hier nie fatal
  });
}, POLL_INTERVAL_MS);
