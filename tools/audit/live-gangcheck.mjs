// Nur lesen: Live-Telemetrie fuer die Gang-Einfuehrung (03./04.10.2026).
// Zeigt data/bn4rep.json (v1Positiv, gateBuy, torRunde), data/gang.json und
// das Ende des Kern-Logs aus dem laufenden Spiel ueber die Bruecke.
// Aufruf: node tools/audit/live-gangcheck.mjs
const rpc = async (m, p = {}) =>
  (await (await fetch("http://localhost:8795/api/rpc?" + new URLSearchParams({ method: m, instance: "LIVE", ...p }))).json());
const lies = async (f) => {
  try { const x = await rpc("getFile", { filename: f, server: "home" }); return x.result ?? null; } catch { return null; }
};
const rep = await lies("data/bn4rep.json");
if (rep) {
  const j = JSON.parse(rep);
  console.log("bn4rep.json", new Date(j.zeit || j.wall || 0).toISOString(), "| v1Positiv", j.v1Positiv,
    "| gateBuy", j.gateBuy, "| knoten", j.knoten, "| torRunde", JSON.stringify(j.torRunde)?.slice(0, 300));
} else console.log("bn4rep.json fehlt");
const gang = await lies("data/gang.json");
console.log("gang.json", gang ? gang.slice(0, 600) : "fehlt");
for (const f of ["data/bn4net-log.txt", "data/gang-log.txt"]) {
  const t = await lies(f);
  if (t) console.log("--- " + f + " (Ende)\n" + t.trim().split("\n").slice(-8).join("\n"));
}
