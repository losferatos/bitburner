/**
 * Sperrkasse setzen.
 *
 * Der Verwalter im Spiel setzt jeden freien Dollar sofort in Speicher um.
 * Das ist richtig, solange Speicher der Engpass ist - aber es macht uns
 * zahlungsunfaehig fuer alles, was KEIN Skript kaufen kann: Portknacker im
 * Darkweb, Augmentations, Reisen. Dieses Werkzeug legt einen Betrag fest, den
 * er nicht anruehrt.
 *
 * Aufruf:
 *   node tools/reserve.js 30000000     Sperrkasse auf 30 Mio setzen
 *   node tools/reserve.js 30e6         geht auch
 *   node tools/reserve.js 0            Sperre aufheben
 *   node tools/reserve.js              nur anzeigen
 */

const BASE = "http://localhost:8795";
const DATEI = "data/reserve.txt";

const geld = (n) => {
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) {
    n /= 1000;
    i++;
  }
  return "$" + (n < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
};

async function rpc(method, params = {}) {
  const q = new URLSearchParams({ method, ...params });
  const res = await fetch(BASE + "/api/rpc?" + q);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function main() {
  const arg = process.argv[2];

  if (arg === undefined) {
    try {
      const wert = Number(await rpc("getFile", { filename: DATEI, server: "home" }));
      console.log("Sperrkasse: " + geld(wert) + "  (" + wert + ")");
    } catch {
      console.log("Sperrkasse: nicht gesetzt - der Verwalter gibt alles aus.");
    }
    return;
  }

  const betrag = Number(arg);
  if (!Number.isFinite(betrag) || betrag < 0) {
    console.log("Ungueltiger Betrag: " + arg);
    process.exit(1);
  }

  await rpc("pushFile", { filename: DATEI, content: String(betrag), server: "home" });
  console.log(
    betrag > 0
      ? "Sperrkasse auf " + geld(betrag) + " gesetzt. Der Verwalter kauft erst oberhalb davon."
      : "Sperre aufgehoben - der Verwalter investiert wieder alles.",
  );
}

main().catch((e) => console.log("Fehler:", e.message));
