// G09-Gegenpruefung (Winkel Substanz): eigener Spielstand-Dekoder, unabhaengig von
// sleeve-save.mjs / blade-lage.mjs. Nur lesen.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const ROOT = "C:/Users/erche/Desktop/claude_projecto/bitburner";
export const BACKUPS = path.join(ROOT, "backups");

export function listRun(run) {
  return fs.readdirSync(BACKUPS)
    .filter((f) => f.includes("_" + run + "_") && f.endsWith(".json.gz"))
    .sort((a, b) => a.slice(a.indexOf(run)).localeCompare(b.slice(b.indexOf(run))));
}

export function readSave(file) {
  const full = path.isAbsolute(file) ? file : path.join(BACKUPS, file);
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(full)).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  return { save, p };
}

// Textdatei von home (data/blade.json, data/sleeve.json, ...)
export function homeText(save, name) {
  const all = JSON.parse(save.data.AllServersSave);
  const home = all.home && (all.home.data || all.home);
  if (!home) return null;
  const tf = home.textFiles;
  const entries = tf && tf.data ? tf.data : Array.isArray(tf) ? tf : [];
  for (const e of entries) {
    if (Array.isArray(e)) {
      const [k, v] = e;
      if (k === name) return (v.data || v).text;
    }
  }
  return null;
}

export function homeJson(save, name) {
  const t = homeText(save, name);
  if (t == null) return null;
  try { return JSON.parse(t); } catch { return null; }
}

export function bbOf(p) {
  return p.bladeburner ? (p.bladeburner.data || p.bladeburner) : null;
}

// JSONMap-Eintraege -> Objekt
export function mapEntries(m) {
  if (!m) return {};
  const arr = m.data ? m.data : Array.isArray(m) ? m : Object.entries(m);
  const o = {};
  for (const e of arr) o[e[0]] = e[1] && e[1].data ? e[1].data : e[1];
  return o;
}

export function sleeveOf(s) {
  const d = s.data || s;
  const w = d.currentWork ? (d.currentWork.data || d.currentWork) : null;
  return {
    shock: d.shock, sync: d.sync, storedCycles: d.storedCycles, skills: d.skills, exp: d.exp, hp: d.hp,
    mults: d.mults, city: d.city,
    work: d.currentWork ? { ctor: d.currentWork.ctor, ...w } : null,
  };
}

export const fmt = (x, d = 2) => (x == null || Number.isNaN(x) ? "-" : Number(x).toFixed(d));
