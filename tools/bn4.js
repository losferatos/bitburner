/**
 * Zwischenstand BitNode 4 - liest, was die beiden Haelften nach draussen
 * schreiben.
 *
 * bn4net.js legt data/bn4net.json ab, bn4life.js data/bn4life.json. Beide
 * werden ueberschrieben, nicht angehaengt: Der Zustand von jetzt ist gefragt,
 * nicht die Geschichte. Die Ereignisse stehen daneben in den -log-Dateien.
 *
 * Aufruf:  node tools/bn4.js
 */

const BASE = "http://localhost:8795";

async function rpc(method, params = {}) {
  const r = await fetch(BASE + "/api/rpc?" + new URLSearchParams({ method, ...params }));
  const b = await r.json();
  if (b.error) throw new Error(b.error);
  return b.result;
}

async function lies(datei) {
  try {
    const roh = await rpc("getFile", { filename: datei, server: "home" });
    return JSON.parse(roh);
  } catch {
    return null;
  }
}

const geld = (n) => {
  if (!Number.isFinite(n)) return "?";
  const stufen = [[1e12, "t"], [1e9, "b"], [1e6, "m"], [1e3, "k"]];
  for (const [teiler, kuerzel] of stufen) {
    if (Math.abs(n) >= teiler) return "$" + (n / teiler).toFixed(2) + kuerzel;
  }
  return "$" + n.toFixed(0);
};

const alter = (t) => {
  if (!t) return "?";
  const s = Math.round((Date.now() - t) / 1000);
  return s < 90 ? s + "s" : Math.round(s / 60) + "min";
};

const netz = await lies("data/bn4net.json");
const leben = await lies("data/bn4life.json");

const z = [];
const zeile = (was, wert, ziel = "") =>
  z.push("  " + was.padEnd(22) + String(wert).padStart(16) + "  " + ziel);

z.push("");
z.push("  BITNODE 4  " + new Date().toLocaleTimeString());
z.push("  " + "-".repeat(62));

if (!leben) zeile("bn4life", "KEIN LEBENSZEICHEN", "laeuft es?");
else {
  zeile("Geld", geld(leben.geld), "");
  zeile("Verbrechen", leben.arbeit || "KEINS", leben.verbrechen || "");
  zeile("Kampfwert", (leben.kampfwert || 0).toFixed(1),
    leben.kampfwert < 40 ? "-> 40 = Mug" : leben.kampfwert < 117 ? "-> 117 = Homicide" : "Maximum erreicht");
  zeile("Faktionen", (leben.faktionen || []).length, (leben.faktionen || []).join(", "));
  zeile("TOR / Programme", (leben.tor ? "ja" : "nein") + " / " + (leben.programme || []).length,
    (leben.programme || []).join(" "));
  zeile("Meldung", alter(leben.zeit) + " alt", "");
}

z.push("  " + "-".repeat(62));

if (!netz) zeile("bn4net", "KEIN LEBENSZEICHEN", "laeuft es?");
else {
  zeile("Hacking", netz.hacking, "9000 fuer w0r1d_d43m0n");
  zeile("Netz gerootet", netz.gerootet + " / " + netz.netz, "Ziel: " + (netz.ziel || "keins"));
  zeile("home-Speicher", netz.homeRam + " GB",
    "frei " + (netz.homeFrei || 0).toFixed(1) + ", Reserve " + (netz.reserve || 0));
  zeile("naechster Ausbau", geld(netz.ausbauKosten), "braucht das Dreifache");
  if (netz.fehlstart) zeile("Fehlstarts", netz.fehlstart, "Arbeiter ohne Speicher");
  zeile("Meldung", alter(netz.zeit) + " alt", "Runde " + netz.runde);
}

z.push("  " + "-".repeat(62));
z.push("");
const wirt = netz && netz.werkbank ? netz.werkbank : "home";
const rep = (await liesVon("data/bn4rep.json", wirt)) || (await lies("data/bn4rep.json"));
const tuer = (await liesVon("data/bn4door.json", wirt)) || (await lies("data/bn4door.json"));

if (rep) {
  zeile("arbeitet an", rep.ziel || "-", rep.zielFaktion || "");
  zeile("Reputation", rep.rep + " / " + rep.repReq,
    rep.repReq > rep.rep ? "noch " + (rep.repReq - rep.rep) : "erreicht");
  zeile("Augs offen", rep.offen, rep.kaufbereit ? rep.kaufbereit + " kaufbereit" : "");
  zeile("Meldung", alter(rep.zeit) + " alt", "");
} else zeile("bn4rep", "KEIN LEBENSZEICHEN", "");
if (tuer) zeile("Backdoors", (tuer.erledigt || []).join(" ") || "keine", "");
z.push("  " + "-".repeat(62));
z.push("");
console.log(z.join(String.fromCharCode(10)));


async function liesVon(datei, server) {
  try { return JSON.parse(await rpc("getFile", { filename: datei, server })); }
  catch { return null; }
}
