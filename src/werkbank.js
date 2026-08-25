/** Warum startet ein Werkzeug nicht? Speicherlage der Werkbank.
 *
 * bn4net meldet nur "wartet: <wirt> hat X von Y GB frei" ins Spiel-Log, und das
 * Log ist von aussen nicht lesbar. Dieses Skript beantwortet dieselbe Frage in
 * einer Datei: Wieviel ist wo frei, was fehlt, und was braeuchte es.
 *
 * Ergebnis nach data/werkbank.json. Start ueber data/task.txt.
 * @param {NS} ns */
export async function main(ns) {
  // Dieselbe Liste wie in bn4net.js. Sie steht hier bewusst als Kopie: Das
  // Diagnoseskript soll auch dann etwas sagen koennen, wenn bn4net gar nicht
  // laeuft - und ein Import wuerde die 16 GB des Motors mitziehen.
  const WERKZEUGE = ["blade.js", "bbtrain.js", "bn4life.js", "homegrow.js",
    "contracts.js", "wakelock.js", "popups.js", "bn4rep.js", "bn4door.js"];
  const ARBEITER = new Set(["worker/hack.js", "worker/grow.js",
    "worker/weaken.js", "worker/share.js", "worker/expfarm.js"]);

  const offen = ["home"], bekannt = new Set(["home"]);
  while (offen.length) {
    const h = offen.pop();
    for (const n of ns.scan(h)) if (!bekannt.has(n)) { bekannt.add(n); offen.push(n); }
  }

  const laeuft = new Map();
  const hosts = [];
  for (const h of bekannt) {
    if (!ns.hasRootAccess(h)) continue;
    const max = ns.getServerMaxRam(h);
    if (!(max > 0)) continue;
    const benutzt = ns.getServerUsedRam(h);
    let arbeiterGb = 0;
    for (const pr of ns.ps(h)) {
      if (ARBEITER.has(pr.filename)) {
        arbeiterGb += ns.getScriptRam(pr.filename, "home") * pr.threads;
      } else if (!laeuft.has(pr.filename)) {
        laeuft.set(pr.filename, h);
      }
    }
    hosts.push({ host: h, max, frei: +(max - benutzt).toFixed(2),
      arbeiterGb: +arbeiterGb.toFixed(2),
      // Was waere frei, wenn man alle Arbeiter raeumte? Das ist die Zahl, die
      // zaehlt - Arbeiter sind Einwegskripte, die bn4net von selbst nachlegt.
      freiNachRaeumung: +(max - benutzt + arbeiterGb).toFixed(2) });
  }
  hosts.sort((a, b) => b.max - a.max);

  const werkzeuge = WERKZEUGE.map((w) => ({
    datei: w,
    braucht: +ns.getScriptRam(w, "home").toFixed(2),
    laeuftAuf: laeuft.get(w) || null,
  }));

  ns.write("data/werkbank.json", JSON.stringify({
    zeit: Date.now(),
    hosts: hosts.slice(0, 12),
    werkzeuge,
    fehlend: werkzeuge.filter((w) => !w.laeuftAuf),
  }), "w");
  if (ns.getHostname() !== "home") ns.scp("data/werkbank.json", "home", ns.getHostname());
}
