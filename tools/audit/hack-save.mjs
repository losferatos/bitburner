// Audit 03.10.2026, Bereich HACK: Spielstand dekodieren und die Groessen
// ausgeben, gegen die die Rechner geeicht werden.
// Aufruf: node tools/audit/hack-save.mjs <backup.json.gz> [--servers] [--scripts] [--files=name1,name2]
// Liest nur. Schreibt nichts.
import zlib from "node:zlib";
import fs from "node:fs";

export function loadSave(file) {
  const save = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
  const p = JSON.parse(save.data.PlayerSave).data;
  const all = JSON.parse(save.data.AllServersSave);
  const servers = {};
  for (const [name, v] of Object.entries(all)) servers[name] = v.data || v;
  return { save, p, servers };
}

// Textdateien auf einem Server: Map-Format {"ctor":"JSONMap","data":[[pfad,{ctor,data:{text}}]]}
export function textFile(server, name) {
  const tf = server.textFiles;
  const arr = tf && tf.data ? tf.data : Array.isArray(tf) ? tf : [];
  for (const e of arr) {
    const [path, obj] = Array.isArray(e) ? e : [e.filename, e];
    const d = obj && obj.data ? obj.data : obj;
    if (path === name || (d && d.filename === name)) return d.text ?? d.content ?? null;
  }
  return null;
}

export function runningScripts(server) {
  const rs = server.runningScripts || [];
  return rs.map((r) => (r.data ? r.data : r));
}

if (process.argv[1] && process.argv[1].endsWith("hack-save.mjs")) {
  const file = process.argv[2];
  const flags = process.argv.slice(3);
  const { p, servers } = loadSave(file);
  const sf = Object.fromEntries((p.sourceFiles?.data) || []);
  console.log(JSON.stringify({
    bitNodeN: p.bitNodeN, sf, money: p.money,
    skills: p.skills, exp: p.exp,
    mults: Object.fromEntries(Object.entries(p.mults).filter(([k]) => /hack|faction_rep|bladeburner/.test(k))),
    playtimeSinceLastAug: p.playtimeSinceLastAug, playtimeSinceLastBitnode: p.playtimeSinceLastBitnode,
    totalPlaytime: p.totalPlaytime,
    moneySourceA: p.moneySourceA, moneySourceB: p.moneySourceB,
    purchasedServers: p.purchasedServers, augs: p.augmentations.length,
    queued: p.queuedAugmentations.length, currentWork: p.currentWork ? p.currentWork.ctor || Object.keys(p.currentWork) : null,
  }, null, 1));
  if (flags.includes("--servers")) {
    const rows = [];
    for (const [n, s] of Object.entries(servers)) {
      const used = runningScripts(s).reduce((a, r) => a + (r.ramUsage || 0) * (r.threads || 1), 0);
      rows.push([n, s.hasAdminRights ? "R" : "-", s.purchasedByPlayer ? "P" : "-", s.backdoorInstalled ? "B" : "-",
        s.cpuCores, s.maxRam, used.toFixed(1), s.requiredHackingSkill, s.baseDifficulty?.toFixed?.(2),
        s.minDifficulty, s.hackDifficulty?.toFixed?.(3), s.serverGrowth, (s.moneyMax || 0).toExponential(3),
        ((s.moneyAvailable || 0) / (s.moneyMax || 1)).toFixed(3)].join("\t"));
    }
    console.log("host\troot\tpurch\tbd\tcores\tmaxRam\tusedRam\treqHack\tbaseDiff\tminDiff\thackDiff\tgrowth\tmoneyMax\tfill");
    console.log(rows.join("\n"));
  }
  if (flags.includes("--scripts")) {
    const agg = {};
    for (const [n, s] of Object.entries(servers)) {
      for (const r of runningScripts(s)) {
        const k = r.filename;
        agg[k] = agg[k] || { procs: 0, threads: 0, gb: 0, hosts: new Set() };
        agg[k].procs++; agg[k].threads += r.threads || 1; agg[k].gb += (r.ramUsage || 0) * (r.threads || 1);
        agg[k].hosts.add(n);
      }
    }
    for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].gb - a[1].gb))
      console.log(k.padEnd(28), "procs", v.procs, "threads", v.threads, "GB", v.gb.toFixed(1), "hosts", v.hosts.size);
  }
  const ff = flags.find((f) => f.startsWith("--files="));
  if (ff) {
    for (const name of ff.slice(8).split(",")) {
      console.log("=== " + name);
      console.log(textFile(servers.home, name));
    }
  }
}
