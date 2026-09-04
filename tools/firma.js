/**
 * Firmenphase schalten (Meilenstein M4).
 *
 * Legt data/company-order.txt auf home ab. bn4rep.js liest die Datei in jeder
 * Runde und entscheidet daraus, ob die Spielfigur fuer eine Firma statt fuer
 * eine Faktion arbeitet.
 *
 * WARUM EIN VERFALLSDATUM
 *
 * Ein erzwungener Modus ohne Frist ist die Falle vom 20.08.2026: Der Bot tat
 * genau das, was in einer Datei stand, fuenf Stunden lang, ohne dass es
 * jemandem auffiel. Ein erzwungener Auftrag laeuft deshalb ab; danach faellt
 * bn4rep von selbst auf seine eigene Entscheidung zurueck.
 *
 * Aufruf:
 *   node tools/firma.js                          Stand anzeigen
 *   node tools/firma.js clarke 45                 45 Minuten Clarke erzwingen
 *   node tools/firma.js omnitek 60                60 Minuten OmniTek erzwingen
 *   node tools/firma.js auto                      bn4rep entscheidet selbst
 *   node tools/firma.js off                       nie Firmenarbeit
 */

const BASE = "http://localhost:8795";
const FILE = "data/company-order.txt";
const COMPANIES = {
  clarke: "Clarke Incorporated",
  omnitek: "OmniTek Incorporated",
};

async function rpc(method, params = {}) {
  const body = await (await fetch(BASE + "/api/rpc?" + new URLSearchParams({ method, instance: "LIVE", ...params }))).json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

const args = process.argv.slice(2);

if (!args.length) {
  let order = "";
  try { order = await rpc("getFile", { filename: FILE, server: "home" }); } catch { order = "(keine Datei)"; }
  let job = null;
  try { job = JSON.parse(await rpc("getFile", { filename: "data/bn4job.json", server: "home" })); } catch { /* laeuft noch nicht */ }
  console.log("Auftrag:  " + (order || "(leer)"));

  // bn4job.json wird NUR waehrend einer laufenden Firmenphase geschrieben und
  // nie geloescht. Eine alte Datei ist deshalb kein Zustand, sondern eine
  // Erinnerung - und sie so anzuzeigen, als liefe die Phase noch ("erzwungen,
  // noch 44 min", waehrend der Auftrag laengst auf auto steht), ist genau die
  // Sorte Anzeige, wegen der man einem Bot nicht mehr glaubt. Ueber 90
  // Sekunden alt heisst: Es laeuft gerade keine Firmenphase.
  const FRISCH_MS = 90000;
  const alter = job ? Date.now() - job.zeit : Infinity;
  if (!job) {
    console.log("Firma:    noch nie eine Phase gelaufen.");
  } else if (alter > FRISCH_MS) {
    console.log("Firma:    KEINE Phase aktiv. Letzter Stand von vor "
      + Math.round(alter / 60000) + " min:");
    console.log("          " + job.company + " als " + job.job + ", "
      + Math.round(job.companyRep) + " / " + job.goal + " Firmenreputation.");
  } else {
    const restMin = job.forcedUntil ? Math.round((job.forcedUntil - Date.now()) / 60000) : 0;
    console.log("Firma:    " + job.company + " als " + job.job);
    console.log("Rep:      " + Math.round(job.companyRep) + " / " + job.goal
      + "   Favor " + job.companyFavor.toFixed(2));
    console.log("Werte:    Hacking " + job.hacking + ", Charisma " + job.charisma);
    console.log("Meldung:  " + Math.round(alter / 1000) + "s alt"
      + (job.forced ? "   erzwungen, noch " + restMin + " min" : "   selbst gewaehlt"));
  }
  process.exit(0);
}

const wahl = String(args[0]).toLowerCase();
let inhalt;
if (wahl === "off" || wahl === "auto") {
  inhalt = wahl;
} else if (COMPANIES[wahl]) {
  const minuten = Number(args[1]) || 45;
  inhalt = COMPANIES[wahl] + "|" + (Date.now() + minuten * 60000);
  console.log("Erzwinge " + COMPANIES[wahl] + " fuer " + minuten + " Minuten.");
} else {
  console.log("Unbekannt: " + wahl + "   (clarke | omnitek | auto | off)");
  process.exit(1);
}

await rpc("pushFile", { filename: FILE, content: inhalt, server: "home" });
console.log("Geschrieben: " + FILE + " = " + inhalt);
