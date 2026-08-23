/**
 * Kern-Inventur: wo laufen unsere Faeden, und wie viele Kerne haben die Wirte?
 *
 * getCoreBonus(cores) = 1 + (cores-1)/16 (ServerHelpers.ts:315-318) wirkt auf
 * drei Dinge, die wir alle benutzen: ns.share (ueber
 * calculateEffectiveSharedThreads, Share.ts:22-25), grow (grow.ts:25) und
 * weaken (ServerHelpers.ts:320-323). Gekaufte Server haben immer einen Kern,
 * home dagegen mehr - dieselben Faeden sind auf home also mehr wert.
 *
 * Aufruf: node tools/task.js kerne.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");
  const z = [];
  const gesehen = new Set(["home"]);
  const rand = ["home"];
  while (rand.length) {
    const h = rand.pop();
    for (const n of ns.scan(h)) if (!gesehen.has(n)) { gesehen.add(n); rand.push(n); }
  }
  const zeilen = [];
  for (const h of gesehen) {
    const s = ns.getServer(h);
    const procs = ns.ps(h);
    if (!procs.length && !s.purchasedByPlayer) continue;
    const share = procs.filter((p) => p.filename.includes("share")).reduce((a, p) => a + p.threads, 0);
    const alle = procs.reduce((a, p) => a + p.threads, 0);
    if (!alle && h !== "home") continue;
    zeilen.push({ h, cores: s.cpuCores, ram: s.maxRam, share, alle, bonus: 1 + (s.cpuCores - 1) / 16 });
  }
  zeilen.sort((a, b) => b.cores - a.cores || b.ram - a.ram);
  z.push("Wirt | Kerne | Bonus | RAM | share-Faeden | Faeden gesamt");
  for (const r of zeilen.slice(0, 12)) {
    z.push(`${r.h} | ${r.cores} | x${r.bonus.toFixed(3)} | ${ns.format.number(r.ram * 1e9)} | ${r.share} | ${r.alle}`);
  }
  const shareGesamt = zeilen.reduce((a, r) => a + r.share, 0);
  const shareAufHome = zeilen.filter((r) => r.h === "home").reduce((a, r) => a + r.share, 0);
  z.push("");
  z.push(`share-Faeden gesamt ${shareGesamt}, davon auf home ${shareAufHome}`);
  const p = ns.getPlayer();
  z.push(`Intelligence ${p.skills.intelligence} -> share-Bonusfaktor x${(1 + 2 * Math.pow(p.skills.intelligence, 0.8) / 600).toFixed(4)}`);
  z.push(`home hat ${ns.getServer("home").cpuCores} Kerne -> share dort x${(1 + (ns.getServer("home").cpuCores - 1) / 16).toFixed(3)} wirksamer als auf einem Mietrechner`);
  const t = z.join("\n");
  ns.write("data/kerne.txt", t, "w");
  if (ns.getHostname() !== "home") ns.scp("data/kerne.txt", "home", ns.getHostname());
  ns.tprint("\n" + t);
}
