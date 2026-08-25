/** Wer laeuft wo? Ergebnis nach data/ps.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  // Keine feste Liste mehr: Sie verschweigt genau die Skripte, die neu sind
  // und ueber die man deshalb etwas wissen will. Gezeigt wird alles ausser
  // den Arbeitern - von denen laufen Zehntausende und sie sagen nichts aus.
  const ARBEITER = new Set(["worker/hack.js", "worker/grow.js",
    "worker/weaken.js", "worker/share.js", "worker/expfarm.js"]);
  const gesehen = [];
  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }
  for (const h of bekannt) {
    for (const pr of ns.ps(h)) {
      if (ARBEITER.has(pr.filename)) continue;
      gesehen.push({ host: h, datei: pr.filename, pid: pr.pid, args: pr.args });
    }
  }
  ns.write("data/ps.json", JSON.stringify({ zeit: Date.now(), gesehen }), "w");
  // ns.write ist LOKAL - ohne diese Zeile liegt das Ergebnis auf dem Wirt,
  // den der Auftragslaeufer gewaehlt hat, und das ist selten home.
  if (ns.getHostname() !== "home") ns.scp("data/ps.json", "home", ns.getHostname());
}
