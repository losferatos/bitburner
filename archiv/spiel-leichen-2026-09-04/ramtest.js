/** Einmaliger Diagnoselauf: Was sagt getScriptRam zu den Werkzeugen? */
export async function main(ns) {
  const dateien = ["sleeve.js", "blade.js", "bbtrain.js", "bn4rep.js", "contracts.js"];
  const zeilen = [];
  for (const d of dateien) {
    let r = null, da = false;
    try { da = ns.fileExists(d, "home"); } catch { /* egal */ }
    try { r = ns.getScriptRam(d, "home"); } catch (e) { r = "FEHLER " + e; }
    zeilen.push(d + " exists=" + da + " ram=" + r);
  }
  ns.write("data/ramtest.txt", zeilen.join("\n"), "w");
  if (ns.getHostname() !== "home") ns.scp("data/ramtest.txt", "home", ns.getHostname());
}
