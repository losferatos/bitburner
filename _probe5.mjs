// Wegwerf-Probe 5: Wie schnell laesst sich nach dem Schliessen neu verbinden?
import WebSocket from "ws";
import { readFileSync } from "node:fs";

const [portRaw, pathRaw] = readFileSync(
  "C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort", "utf8").trim().split("\n");
const URL = `ws://127.0.0.1:${portRaw.trim()}${pathRaw.trim()}`;

function tryConnect(timeoutMs) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const ws = new WebSocket(URL, { perMessageDeflate: false });
    const timer = setTimeout(() => { try { ws.terminate(); } catch {} resolve({ ok: false, ms: Date.now() - t0, why: "timeout" }); }, timeoutMs);
    ws.once("open", () => { clearTimeout(timer); resolve({ ok: true, ms: Date.now() - t0, ws }); });
    ws.once("error", (e) => { clearTimeout(timer); resolve({ ok: false, ms: Date.now() - t0, why: e.message }); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A) Zyklus: verbinden, sauber schliessen, sofort neu verbinden
for (let i = 1; i <= 4; i++) {
  const r = await tryConnect(15000);
  console.log(`Runde ${i}: verbinden ${r.ok ? "OK" : "FEHL (" + r.why + ")"} nach ${r.ms} ms`);
  if (r.ok) {
    await new Promise((res) => { r.ws.once("close", res); r.ws.close(); });
    console.log(`  sauber geschlossen`);
  }
  await sleep(i === 1 ? 0 : 1000);
}

console.log("--- jetzt mit terminate() statt close() ---");
for (let i = 1; i <= 3; i++) {
  const r = await tryConnect(15000);
  console.log(`Runde ${i}: verbinden ${r.ok ? "OK" : "FEHL (" + r.why + ")"} nach ${r.ms} ms`);
  if (r.ok) { r.ws.terminate(); console.log("  hart gekappt"); }
  await sleep(500);
}

console.log("--- wie viele gleichzeitig? ---");
const open = [];
for (let i = 1; i <= 8; i++) {
  const r = await tryConnect(6000);
  console.log(`gleichzeitig #${i}: ${r.ok ? "OK" : "FEHL (" + r.why + ")"} nach ${r.ms} ms`);
  if (!r.ok) break;
  open.push(r.ws);
}
console.log(`offen: ${open.length}`);
for (const w of open) w.close();
await sleep(500);
process.exit(0);
