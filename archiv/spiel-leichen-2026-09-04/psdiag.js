export async function main(ns) {
  const gesehen = new Set(["home"]); const rand = ["home"];
  while (rand.length) { const h = rand.pop();
    for (const n of ns.scan(h)) if (!gesehen.has(n)) { gesehen.add(n); rand.push(n); } }
  const z = []; let ramGes = 0, ramFrei = 0;
  const werkzeuge = [];
  for (const h of gesehen) {
    const s = ns.getServer(h);
    if (!s.hasAdminRights) continue;
    ramGes += s.maxRam; ramFrei += s.maxRam - s.ramUsed;
    for (const p of ns.ps(h)) {
      if (p.filename.startsWith("worker/")) continue;
      werkzeuge.push(h + ":" + p.filename + " (pid " + p.pid + ")");
    }
  }
  z.push("Werkzeuge: " + werkzeuge.join(", "));
  z.push("Netz " + ramGes.toFixed(0) + " GB, frei " + ramFrei.toFixed(0));
  const gr = [...gesehen].map((h) => [h, ns.getServerMaxRam(h)]).filter((x) => x[1] >= 64)
    .sort((a, b) => b[1] - a[1]).slice(0, 6);
  z.push("Groesste: " + gr.map((x) => x[0] + "=" + x[1]).join(" "));
  for (const h of ["joesguns", "harakiri-sushi", "phantasy"]) {
    if (!gesehen.has(h)) continue;
    const s = ns.getServer(h);
    z.push(h + ": sec " + s.hackDifficulty.toFixed(1) + "/" + s.minDifficulty
      + "  geld " + (s.moneyAvailable / Math.max(1, s.moneyMax) * 100).toFixed(1) + "%");
  }
  ns.write("data/psdiag.txt", z.join("\n"), "w");
  if (ns.getHostname() !== "home") ns.scp("data/psdiag.txt", "home", ns.getHostname());
}
