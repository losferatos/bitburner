// Wegwerf-Probe 3: Mehrfachverbindung und direkter Seiten-Endpunkt.
import WebSocket from "ws";
import { readFileSync } from "node:fs";

const file = "C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort";
const [portRaw, pathRaw] = readFileSync(file, "utf8").trim().split("\n");
const PORT = portRaw.trim();
const BROWSER_PATH = pathRaw.trim();

function connect(url, label) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    const t = setTimeout(() => { rej(new Error(label + ": connect timeout")); ws.terminate(); }, 6000);
    ws.on("open", () => { clearTimeout(t); res(ws); });
    ws.on("error", (e) => { clearTimeout(t); rej(new Error(label + ": " + e.message)); });
  });
}

function rpc(ws, method, params = {}, sessionId) {
  const id = Math.floor(Math.random() * 1e9);
  const msg = { id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("rpc timeout " + method)), 8000);
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id !== id) return;
      clearTimeout(t); ws.off("message", onMsg);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify(msg));
  });
}

const log = (...a) => console.log(...a);

try {
  // A) erste Verbindung zum Browser-Ziel
  const a = await connect(`ws://127.0.0.1:${PORT}${BROWSER_PATH}`, "A");
  log("A verbunden");
  const { targetInfos } = await rpc(a, "Target.getTargets");
  const t = targetInfos.find((x) => x.type === "page" && x.url.includes("bitburner-official.github.io"));
  log("Ziel:", t.targetId, "|", t.title);

  // B) zweite Verbindung zum Browser-Ziel WAEHREND A offen ist
  try {
    const b = await connect(`ws://127.0.0.1:${PORT}${BROWSER_PATH}`, "B");
    log("B verbunden -> Mehrfachverbindung MOEGLICH");
    const r = await rpc(b, "Browser.getVersion");
    log("B getVersion:", r.product);
    b.close();
  } catch (e) {
    log("B fehlgeschlagen -> Mehrfachverbindung NICHT moeglich:", e.message);
  }

  // C) direkter Seiten-Endpunkt, waehrend A noch offen ist
  try {
    const c = await connect(`ws://127.0.0.1:${PORT}/devtools/page/${t.targetId}`, "C");
    log("C (Seiten-Endpunkt) verbunden");
    const r = await rpc(c, "Runtime.evaluate", { expression: "document.title", returnByValue: true });
    log("C eval:", JSON.stringify(r.result.value));
    c.close();
  } catch (e) {
    log("C fehlgeschlagen:", e.message);
  }

  a.close();
  log("fertig");
  process.exit(0);
} catch (e) {
  log("ABBRUCH:", e.message);
  process.exit(1);
}
