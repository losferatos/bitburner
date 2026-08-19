import WebSocket from "ws";
import { readFileSync } from "node:fs";
const read = () => readFileSync("C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort","utf8").trim().split("\n");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function tryConnect(timeoutMs) {
  const [p, path] = read();
  const url = `ws://127.0.0.1:${p.trim()}${path.trim()}`;
  const t0 = Date.now();
  return new Promise((resolve) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    const timer = setTimeout(() => { try { ws.terminate(); } catch {} resolve({ ok:false, ms:Date.now()-t0, why:"timeout" }); }, timeoutMs);
    ws.once("open", () => { clearTimeout(timer); resolve({ ok:true, ms:Date.now()-t0, ws }); });
    ws.once("error", (e) => { clearTimeout(timer); resolve({ ok:false, ms:Date.now()-t0, why:e.message }); });
  });
}
for (const wait of [0, 5000, 10000, 20000, 30000]) {
  if (wait) { console.log(`... ${wait/1000}s warten`); await sleep(wait); }
  const r = await tryConnect(20000);
  console.log(`nach Pause ${wait/1000}s: ${r.ok ? "OK" : "FEHL ("+r.why+")"} in ${r.ms} ms`);
  if (r.ok) { await new Promise(res => { r.ws.once("close", res); r.ws.close(); }); console.log("  geschlossen, Ende"); break; }
}
process.exit(0);
