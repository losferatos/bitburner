// Live-Karma, Arbeit und Sleeve-Aufgaben aus dem Spielstand (nur lesen, RPC getSaveFile).
// Zweck: Rate bis zur Slum-Snakes-Schwelle (-9) messen (Audit P2c, 04.10.2026).
import zlib from "node:zlib";
const body = await (await fetch("http://localhost:8795/api/rpc?method=getSaveFile&instance=LIVE")).json();
if (body.error) throw new Error(body.error);
const s = JSON.parse(zlib.gunzipSync(Buffer.from(body.result.save, "latin1")).toString("utf8"));
const p = JSON.parse(s.data.PlayerSave).data;
const work = (w) => (w && w.data ? w.data.type + ":" + (w.data.crimeType || w.data.classType || w.data.factionName || "") : "idle");
const sl = (p.sleeves || []).map((x) => { const d = x.data || x; return work(d.currentWork) + " sync " + Math.round(d.sync) + " shock " + Math.round(d.shock); });
console.log(new Date().toTimeString().slice(0, 8), "karma", p.karma.toFixed(3), "playtime", p.totalPlaytime,
  "work", p.currentWork ? work({ data: p.currentWork.data || p.currentWork }) : "none", "| sleeves", JSON.stringify(sl),
  "| factions", (p.factions || []).length, "invites", JSON.stringify(p.factionInvitations));
