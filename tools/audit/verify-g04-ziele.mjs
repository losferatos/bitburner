// Audit 03.10.2026, Gegenpruefung G04 (share): welche Ziele bekommen im Stand
// wirklich Arbeiterspeicher? Gruppiert laufende Worker nach Ziel (args[0]).
// Aufruf: node tools/audit/verify-g04-ziele.mjs <backup.json.gz>
// Liest nur.
import { loadSave, runningScripts } from "./hack-save.mjs";
const { servers } = loadSave(process.argv[2]);
const agg = {};
let shareGb = 0, netz = 0;
for (const [n, s] of Object.entries(servers)) {
  if (!s.hasAdminRights || n.startsWith("hacknet-")) continue;
  netz += s.maxRam || 0;
  for (const r of runningScripts(s)) {
    const f = String(r.filename);
    if (!f.startsWith("worker/")) continue;
    const gb = (r.ramUsage || 0) * (r.threads || 1);
    if (f === "worker/share.js") { shareGb += gb; continue; }
    const t = String((r.args || [])[0] ?? "?");
    const k = t;
    agg[k] = agg[k] || { hack: 0, grow: 0, weaken: 0, expfarm: 0, other: 0 };
    const kind = f.replace("worker/", "").replace(".js", "");
    agg[k][kind in agg[k] ? kind : "other"] += gb;
  }
}
const rows = Object.entries(agg).map(([t, v]) => ({ t, ...v, sum: v.hack + v.grow + v.weaken + v.expfarm + v.other }))
  .sort((a, b) => b.sum - a.sum);
console.log("netz", netz.toFixed(0), "GB, share", shareGb.toFixed(0), "GB");
console.log("ziel\tsumGB\thack\tgrow\tweaken\texpfarm");
for (const r of rows) console.log([r.t, r.sum.toFixed(0), r.hack.toFixed(0), r.grow.toFixed(0), r.weaken.toFixed(0), r.expfarm.toFixed(0)].join("\t"));
