// Gegenpruefung G03: gemeinsame Ladefunktion. Liest alle BN2-Spielstaende aus backups/,
// fuehrt die Ringpuffer-Logs (bn4net-log, shop-log) zusammen, baut Ereignisse und
// Fenster (Schnitt bei pre-install / pre-jump) und liefert Geld, Ruecklage
// (data/geldbedarf.txt), Park, Ertrag je Intervall.
import fs from "node:fs";
import { readSave, infraFacts } from "./infra-save.mjs";

// BN2: CloudServerSoftcap 1,3 (BitNode.tsx:577), eigene Eichung gegen preise.json in verify-g03-cf.mjs
export const CSS = 1.3;
export const cloudCost = (ram) => ram * 55000 * Math.pow(CSS, Math.max(0, Math.log2(ram) - 6));

export function loadAll(dir = "backups") {
  const files = fs.readdirSync(dir).filter((f) => /_BN2L[12]_/.test(f) && f.endsWith(".json.gz")).sort();
  const saves = [];
  const lineMap = new Map();
  for (const f of files) {
    const m = f.match(/_BN2L(\d)_(\d{4})-(\d\d)-(\d\d)T(\d\d)-(\d\d)_/);
    const d = new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4]), Number(m[5]), Number(m[6]), 0);
    let facts, servers;
    try { facts = infraFacts(dir + "/" + f); ({ servers } = readSave(dir + "/" + f)); } catch { continue; }
    const txt = (name) => {
      const tf = servers.home.data.textFiles.data.find(([n]) => n === name);
      return tf ? ((tf[1].data || tf[1]).text || "") : null;
    };
    const gb = txt("data/geldbedarf.txt");
    let tel = null;
    try { tel = JSON.parse(txt("data/bn4net.json")); } catch { /* egal */ }
    saves.push({
      f, lauf: Number(m[1]), t: d.getTime(), money: facts.money, reserved: gb === null ? 0 : (Number(gb) || 0),
      park: facts.purchasedRamTotal, parkList: facts.purchased.map((p) => p.maxRam), tBN: facts.sinceBitnodeH,
      hackInc: facts.moneySourceB.hacking || 0, ramHome: facts.homeRam, foreign: facts.foreignRam, lvl: facts.hacking, tel,
      kind: f.match(/_(hourly|pre-\w+|connect)/)[1],
    });
    for (const name of ["data/bn4net-log.txt", "data/shop-log.txt"]) {
      const text = txt(name);
      if (!text) continue;
      for (const l of text.split("\n")) {
        const mm = l.match(/^(\d\d):(\d\d):(\d\d)\s+(.*)$/);
        if (!mm) continue;
        const t = new Date(d.getTime());
        t.setHours(Number(mm[1]), Number(mm[2]), Number(mm[3]), 0);
        if (t.getTime() > d.getTime() + 120000) t.setDate(t.getDate() - 1);
        const src = name.includes("shop") ? "shop" : "kern";
        const key = src + "|" + t.getTime() + "|" + mm[4];
        if (!lineMap.has(key)) lineMap.set(key, { t: t.getTime(), src, text: mm[4] });
      }
    }
  }
  const lines = [...lineMap.values()].sort((a, b) => a.t - b.t);
  const ev = [];
  for (const l of lines) {
    if (l.src !== "kern") continue;
    let m;
    if ((m = l.text.match(/^(werk-\d+): (\d+) -> (\d+) GB bestellt fuer rund ([\d.]+)m(?:, amortisiert in (\d+) s| - ein Werkzeug)/)))
      ev.push({ t: l.t, k: "up", host: m[1], from: Number(m[2]), to: Number(m[3]), costLog: Number(m[4]) * 1e6, amort: m[5] ? Number(m[5]) : null });
    else if ((m = l.text.match(/^Rechner bestellt: (\d+) GB/))) ev.push({ t: l.t, k: "kauf", gb: Number(m[1]) });
    else if ((m = l.text.match(/^Auftrag (\S+): erledigt \((\S+)\)/))) ev.push({ t: l.t, k: "ok", host: m[2] });
    else if ((m = l.text.match(/^Auftrag (\S+): nicht ausgefuehrt \((\S+)\)/))) ev.push({ t: l.t, k: "nok", why: m[2] });
  }
  // Ausgefuehrte Ausbauten: Bestellung "up", gefolgt von "ok" bevor die naechste Bestellung kommt
  const executed = [];
  let pend = null;
  for (const e of ev) {
    if (e.k === "up" || e.k === "kauf") pend = e;
    else if (e.k === "ok" && pend && pend.k === "up") { executed.push({ ...pend, order: pend.t, done: e.t, okHost: e.host }); pend = null; }
    else if (e.k === "ok") pend = null;
  }
  const cuts = saves.filter((s) => /pre-install|pre-jump/.test(s.f)).map((s) => s.t).sort((a, b) => a - b);
  return { saves, lines, ev, executed, cuts };
}

export const fmt = (t) => new Date(t).toLocaleString("sv-SE").slice(5, 19);

// lineare Interpolation einer Spielstand-Reihe (Feld) im Fenster
export function interp(points, t) {
  if (!points.length) return NaN;
  if (t <= points[0].t) return points[0].v;
  for (let i = 1; i < points.length; i++) if (t <= points[i].t) {
    const a = points[i - 1], b = points[i];
    return a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t);
  }
  return points[points.length - 1].v;
}
