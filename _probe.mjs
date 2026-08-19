// Wegwerf-Probe: geht der Weg ueber das Browser-Ziel?
import WebSocket from "ws";
import { readFileSync } from "node:fs";

const file = "C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort";
const [port, path] = readFileSync(file, "utf8").trim().split("\n");
const url = `ws://127.0.0.1:${port.trim()}${path.trim()}`;
console.log("browser endpoint:", url);

const ws = new WebSocket(url, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
let id = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const msgId = ++id;
  const msg = { id: msgId, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => {
    pending.set(msgId, { res, rej });
    setTimeout(() => rej(new Error("timeout " + method)), 10000);
  });
}

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.rej(new Error(msg.error.message));
    else p.res(msg.result);
  }
});

ws.on("error", (e) => { console.log("WS ERROR", e.message); process.exit(1); });

ws.on("open", async () => {
  try {
    const { targetInfos } = await send("Target.getTargets");
    const pages = targetInfos.filter((t) => t.type === "page");
    console.log("pages:", pages.map((t) => `${t.targetId.slice(0, 8)} | ${t.title} | ${t.url}`).join("\n       "));

    const target = pages.find((t) => t.url.includes("bitburner-official.github.io"));
    if (!target) throw new Error("kein Bitburner-Ziel");
    console.log("gewaehlt:", target.title, target.url);

    const { sessionId } = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
    console.log("sessionId:", sessionId);

    const r = await send("Runtime.evaluate", {
      expression: `(async () => ({ title: document.title, terminalInput: !!document.getElementById('terminal-input'), lines: document.querySelectorAll('#terminal li').length, w: innerWidth, h: innerHeight, dpr: devicePixelRatio, focus: document.hasFocus(), vis: document.visibilityState }))()`,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    console.log("eval:", JSON.stringify(r, null, 2));

    // Fehlerfall pruefen
    const bad = await send("Runtime.evaluate", {
      expression: `(() => { throw new Error("absichtlicher Testfehler"); })()`,
      awaitPromise: true, returnByValue: true,
    }, sessionId);
    console.log("bad eval:", JSON.stringify(bad).slice(0, 400));

    process.exit(0);
  } catch (e) {
    console.log("FEHLER:", e.message);
    process.exit(1);
  }
});
