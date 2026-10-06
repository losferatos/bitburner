// Hebel-Vorlage 06.10.2026: Live-Spielstand ueber die Bruecke holen (nur lesen, getSaveFile) und Kernwerte zeigen.
// Aufruf: node nodes/corp-2026-10-05/hebel/live.mjs [--save=pfad.json.gz] [--files=muster]
import zlib from "node:zlib"; import fs from "node:fs";
const arg = (k) => { const a = process.argv.find((x) => x.startsWith("--" + k + "=")); return a ? a.split("=").slice(1).join("=") : null; };
let raw;
if (arg("save")) raw = fs.readFileSync(arg("save"));
else {
  const r = await (await fetch("http://localhost:8795/api/rpc?method=getSaveFile")).json();
  if (r.error) throw new Error(r.error);
  raw = Buffer.from(r.result.save, "latin1");
  if (arg("out")) fs.writeFileSync(arg("out"), raw);
}
const s = JSON.parse(zlib.gunzipSync(raw).toString("utf8"));
const p = JSON.parse(s.data.PlayerSave).data;
const g = (o) => (o && o.data) || o || {};
const bb = g(p.bladeburner);
console.log("Spielzeit seit Einbau h", (p.playtimeSinceLastAug / 3.6e6).toFixed(2), "seit Knoten h", (p.playtimeSinceLastBitnode / 3.6e6).toFixed(2));
console.log("Geld", p.money.toExponential(3), "Stadt", p.city, "Karma", p.karma.toFixed(0), "Kills", p.numPeopleKilled, "Entropie", p.entropy, "focus", p.focus);
console.log("Skills", JSON.stringify(p.skills));
console.log("Mults str/def/dex/agi", ["strength", "defense", "dexterity", "agility"].map((k) => p.mults[k].toFixed(3)).join("/"), "faction_rep", p.mults.faction_rep.toFixed(3));
console.log("Arbeit", p.currentWork ? JSON.stringify({ c: p.currentWork.ctor, ...g(p.currentWork) }).slice(0, 300) : "keine");
console.log("BB Rang", Math.round(bb.rank), "BO", bb.numBlackOpsComplete, "Stadt", bb.city, "Stamina", bb.stamina?.toFixed(1), "/", bb.maxStamina?.toFixed(1), "SP", bb.skillPoints);
const sk = g(bb.skills); console.log("BB Skills", JSON.stringify(sk.data ? Object.fromEntries(sk.data) : sk));
console.log("BB Aktion", JSON.stringify(bb.action));
const bo = g(bb.blackOps); console.log("BB blackOps keys", Object.keys(bo).length);
console.log("installiert", p.augmentations.map((a) => a.name).join("; "));
console.log("Warteschlange", p.queuedAugmentations.map((a) => a.name).join("; "));
for (const sl of p.sleeves || []) { const d = g(sl); const w = d.currentWork ? g(d.currentWork) : {}; console.log("Sleeve", d.city, "shock", d.shock?.toFixed(1), "sync", d.sync?.toFixed(1), JSON.stringify({ t: d.currentWork?.ctor, ...w }).slice(0, 200), "skills", JSON.stringify(d.skills)); }
const homes = Object.values(JSON.parse(s.data.AllServersSave)).map((x) => x.data).filter((x) => x.hostname === "home");
const tf = homes[0].textFiles; const files = (tf.data || tf); const list = Array.isArray(files) ? files : Object.entries(files);
const pat = arg("files");
for (const e of list) { const [n, f] = Array.isArray(e) ? e : [e.filename, e]; const name = n.filename || n; const txt = g(f).text ?? f.text ?? ""; if (pat && new RegExp(pat).test(name)) console.log("== " + name + "\n" + String(txt).slice(0, 3000)); }
if (process.argv.includes("--names")) console.log(list.map((e) => (Array.isArray(e) ? e[0] : e.filename)).join(" "));
