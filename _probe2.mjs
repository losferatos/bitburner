// Wegwerf-Probe 2: was zeigt das Spiel gerade? Nur lesen.
import WebSocket from "ws";
import { readFileSync } from "node:fs";

const file = "C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort";
const [port, wsPath] = readFileSync(file, "utf8").trim().split("\n");
const ws = new WebSocket(`ws://127.0.0.1:${port.trim()}${wsPath.trim()}`, { perMessageDeflate: false });
let id = 0;
const pending = new Map();
function send(method, params = {}, sessionId) {
  const msgId = ++id;
  const msg = { id: msgId, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => {
    pending.set(msgId, { res, rej });
    setTimeout(() => rej(new Error("timeout " + method)), 15000);
  });
}
ws.on("message", (raw) => {
  const m = JSON.parse(raw.toString());
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
  }
});
ws.on("error", (e) => { console.log("WS ERROR", e.message); process.exit(1); });
ws.on("open", async () => {
  try {
    const { targetInfos } = await send("Target.getTargets");
    const t = targetInfos.find((x) => x.type === "page" && x.url.includes("bitburner-official.github.io"));
    const { sessionId } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    const expr = `(() => {
      const out = {};
      out.title = document.title;
      out.hasTerminalInput = !!document.getElementById('terminal-input');
      out.hasTerminalList = !!document.getElementById('terminal');
      // Seitenleisten-Eintraege
      out.sidebar = Array.from(document.querySelectorAll('[role="button"], .MuiListItemButton-root'))
        .map(e => (e.innerText||'').trim()).filter(Boolean).slice(0, 40);
      // Ueberschriften im Hauptbereich
      out.headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
        .map(e => (e.innerText||'').trim()).filter(Boolean).slice(0, 20);
      out.buttons = Array.from(document.querySelectorAll('button'))
        .map(e => (e.innerText||'').trim()).filter(Boolean).slice(0, 40);
      out.bodyStart = (document.body.innerText||'').slice(0, 900);
      return out;
    })()`;
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
    console.log(JSON.stringify(r.result.value, null, 1));
    process.exit(0);
  } catch (e) { console.log("FEHLER:", e.message); process.exit(1); }
});
