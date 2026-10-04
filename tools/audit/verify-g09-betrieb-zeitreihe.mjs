// G09-Betrieb: Zeitreihe der Sleeves + Bladeburner aus den Spielstaenden (nur lesen).
// Aufruf: node tools/audit/verify-g09-betrieb-zeitreihe.mjs [muster]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, homeTextFile } from "./sleeve-save.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = path.join(root, "backups");
const pat = process.argv[2] || "BN2L";
let files = fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz") && f.includes(pat));
files.sort((a, b) => a.slice(-35).localeCompare(b.slice(-35)));
const unwrap = (x) => (x && x.data !== undefined && x.ctor ? x.data : x);
const r = (x, n = 1) => (Number.isFinite(x) ? +x.toFixed(n) : x);
for (const f of files) {
  try {
    const { save, player: p } = loadSave(path.join(dir, f));
    const bb = p.bladeburner && (p.bladeburner.data || p.bladeburner);
    const inNode = r(p.playtimeSinceLastBitnode / 3.6e6, 2);
    const sl = (p.sleeves || []).map((s) => {
      const d = s.data || s;
      const w = d.currentWork ? (d.currentWork.data || d.currentWork) : null;
      const t = d.currentWork ? d.currentWork.ctor.replace("Sleeve", "").replace("Work", "") : "-";
      const nm = w && w.actionId ? w.actionId.name : (w && w.classType) || (w && w.crimeType) || (w && w.factionName) || "";
      const k = d.skills ? Math.min(d.skills.strength, d.skills.defense, d.skills.dexterity, d.skills.agility) : 0;
      return `${t}:${nm} k${k} sh${r(d.shock, 1)} cha${d.skills.charisma}`;
    });
    // Operationen/Vertraege Vorrat
    let cnt = "";
    if (bb) {
      const ops = bb.operations && (bb.operations.data || bb.operations);
      const con = bb.contracts && (bb.contracts.data || bb.contracts);
      const g = (o, n) => { try { const e = o[n]; const v = e && (e.data || e); return v ? r(v.count, 1) : "?"; } catch { return "?"; } };
      cnt = `Raid ${g(ops, "Raid")} Assn ${g(ops, "Assassination")} Stealth ${g(ops, "Stealth Retirement Operation")} | Trk ${g(con, "Tracking")} BH ${g(con, "Bounty Hunter")} Ret ${g(con, "Retirement")}`;
    }
    const cityChaos = bb && bb.cities ? (() => { try { const c = bb.cities.data || bb.cities; const e = c[bb.city]; const v = e && (e.data || e); return r(v.chaos, 1); } catch { return "?"; } })() : "?";
    console.log(f.slice(22, 60), "| node", inNode, "h | money", r(p.money / 1e9, 2), "Mrd | hack", p.skills.hacking, "kampf", Math.min(p.skills.strength, p.skills.defense, p.skills.dexterity, p.skills.agility),
      "| rank", bb ? r(bb.rank, 0) : "-", "act", bb && bb.action ? JSON.stringify(unwrap(bb.action)).slice(0, 60) : "-", "chaos", cityChaos);
    console.log("    sleeves:", sl.join(" || "));
    if (cnt) console.log("    ", cnt);
    const sj = homeTextFile(save, "data/sleeve.json");
    const bj = homeTextFile(save, "data/blade.json");
    if (process.argv.includes("--json")) {
      if (sj) console.log("    sleeve.json", sj.slice(0, 900));
      if (bj) { try { const j = JSON.parse(bj); console.log("    blade.json", JSON.stringify({ istAktion: j.istAktion, aktion: j.aktion, aufraeumen: j.aufraeumen, truppAnfrage: j.truppAnfrage, grund: j.grund, chance: j.chance })); } catch { console.log("    blade.json kaputt"); } }
    }
  } catch (e) { console.log(f, "ERR", String(e).slice(0, 120)); }
}
