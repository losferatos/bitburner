/** Wer laeuft wo? Ergebnis nach data/ps.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  const WERKZEUG = ["bn4net.js", "bn4rep.js", "bn4life.js", "homegrow.js",
    "contracts.js", "wakelock.js", "popups.js", "bn4door.js", "exit.js"];
  const gesehen = [];
  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }
  for (const h of bekannt) {
    for (const pr of ns.ps(h)) {
      if (WERKZEUG.includes(pr.filename)) {
        gesehen.push({ host: h, datei: pr.filename, pid: pr.pid, args: pr.args });
      }
    }
  }
  ns.write("data/ps.json", JSON.stringify({ zeit: Date.now(), gesehen }), "w");
}
