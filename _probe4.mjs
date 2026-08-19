// Wegwerf-Probe 4: Terminal-DOM lesen. Aendert nichts.
import WebSocket from "ws";
import { readFileSync } from "node:fs";

const [portRaw, pathRaw] = readFileSync(
  "C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort", "utf8").trim().split("\n");
const ws = new WebSocket(`ws://127.0.0.1:${portRaw.trim()}${pathRaw.trim()}`, { perMessageDeflate: false });
let id = 0; const pending = new Map();
function rpc(method, params = {}, sessionId) {
  const msgId = ++id; const msg = { id: msgId, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => { pending.set(msgId, { res, rej }); setTimeout(() => rej(new Error("timeout " + method)), 10000); });
}
ws.on("message", (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result); } });
ws.on("error", (e) => { console.log("WS ERROR", e.message); process.exit(1); });
ws.on("open", async () => {
  try {
    const { targetInfos } = await rpc("Target.getTargets");
    const t = targetInfos.find((x) => x.type === "page" && x.url.includes("bitburner-official.github.io"));
    const { sessionId } = await rpc("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    const expr = `(() => {
      const ul = document.getElementById('terminal');
      const inp = document.getElementById('terminal-input');
      const kids = ul ? Array.from(ul.children) : [];
      return {
        ulTag: ul && ul.tagName,
        childCount: kids.length,
        childTags: [...new Set(kids.map(k => k.tagName))],
        liCount: ul ? ul.querySelectorAll('li').length : -1,
        lastThree: kids.slice(-3).map(k => (k.innerText||'').slice(0,120)),
        inputTag: inp && inp.tagName,
        inputDisabled: inp ? inp.disabled : null,
        inputValue: inp ? inp.value : null,
        inputRect: inp ? (r => ({x:r.x,y:r.y,w:r.width,h:r.height}))(inp.getBoundingClientRect()) : null,
        docFocus: document.hasFocus(),
        vis: document.visibilityState
      };
    })()`;
    const r = await rpc("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
    console.log(JSON.stringify(r.result.value, null, 1));
    ws.close();
    process.exit(0);
  } catch (e) { console.log("FEHLER:", e.message); process.exit(1); }
});
