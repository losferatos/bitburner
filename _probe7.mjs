import WebSocket from "ws";
import { readFileSync } from "node:fs";
import http from "node:http";
const [p, wsPath] = readFileSync("C:/Users/erche/AppData/Roaming/Opera Software/Opera Stable/DevToolsActivePort","utf8").trim().split("\n");
const PORT = Number(p.trim()), PATH = wsPath.trim();

function httpProbe(path) {
  const t0 = Date.now();
  return new Promise((res) => {
    const req = http.get({host:"127.0.0.1",port:PORT,path,timeout:8000}, (r) => { r.resume(); r.on("end",()=>res(`${path} -> ${r.statusCode} in ${Date.now()-t0}ms`)); });
    req.on("timeout",()=>{req.destroy();res(`${path} -> TIMEOUT in ${Date.now()-t0}ms`);});
    req.on("error",(e)=>res(`${path} -> ERR ${e.code} in ${Date.now()-t0}ms`));
  });
}
console.log(await httpProbe("/json/version"));
console.log(await httpProbe(PATH));       // GET auf den WS-Pfad ohne Upgrade
console.log(await httpProbe("/nonsense"));

const t0 = Date.now();
const ws = new WebSocket(`ws://127.0.0.1:${PORT}${PATH}`, { perMessageDeflate: false });
const done = await new Promise((res) => {
  const timer = setTimeout(()=>{res("TIMEOUT");}, 40000);
  ws.once("open", ()=>{clearTimeout(timer);res("OPEN");});
  ws.once("unexpected-response", (req, r)=>{clearTimeout(timer);res("HTTP "+r.statusCode);});
  ws.once("error", (e)=>{clearTimeout(timer);res("ERR "+e.message);});
});
console.log(`WS-Upgrade: ${done} nach ${Date.now()-t0} ms`);
try { ws.terminate(); } catch {}
process.exit(0);
