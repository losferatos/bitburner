/**
 * Lagebericht auf der Kommandozeile.
 *
 * Fragt die Bridge nach dem aktuellen Spielzustand und gibt ihn kompakt aus.
 * Gedacht fuer den schnellen Blick zwischendurch, ohne ins Spiel zu wechseln.
 *
 * Aufruf:  node tools/status.js [--netz] [--kauf]
 */

const BASE = "http://localhost:8795";

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const neg = n < 0;
  n = Math.abs(n);
  const u = ["", "k", "m", "b", "t", "q"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) {
    n /= 1000;
    i++;
  }
  return (neg ? "-$" : "$") + (n < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
};

const dauer = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return h + "h " + m + "m";
  if (m) return m + "m " + Math.floor(s % 60) + "s";
  return Math.floor(s) + "s";
};

async function rpc(method, params = {}) {
  const q = new URLSearchParams({ method, ...params });
  const res = await fetch(BASE + "/api/rpc?" + q);
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  return body.result;
}

async function main() {
  const zeigeNetz = process.argv.includes("--netz");
  const zeigeKauf = process.argv.includes("--kauf");

  let state;
  try {
    state = await (await fetch(BASE + "/api/state")).json();
  } catch {
    console.log("Bridge nicht erreichbar - laeuft sync/bridge.js?");
    return;
  }

  if (!state.connected) {
    console.log("Spiel nicht verbunden. Im Spiel: Options -> Remote API -> Connect");
    return;
  }

  const t = state.telemetry;
  if (!t) {
    console.log("Verbunden, aber noch keine Telemetrie - laeuft autopilot.js?");
    return;
  }

  const alter = (Date.now() - t.t) / 1000;
  console.log("");
  console.log("  " + t.phase.toUpperCase() + "   " + (t.action || "") + "   (Runde " + t.cycle + ", Daten " + alter.toFixed(0) + "s alt)");
  console.log("  " + t.reason);
  console.log("");
  console.log("  Geld      " + geld(t.player.money).padEnd(12) + geld(t.income.scriptIncome) + "/s");
  console.log("  Hacking   " + String(t.player.hackLevel).padEnd(12) + t.income.scriptExpGain.toFixed(1) + " exp/s");
  console.log("  Karma     " + t.player.karma.toFixed(1));
  console.log("  Speicher  " + t.ram.used.toFixed(0) + " / " + t.ram.max.toFixed(0) + " GB");
  console.log("  Netz      " + t.network.rooted + " von " + t.network.total + " Rechnern offen");
  console.log("  Laufzeit  " + dauer(t.uptime));

  if (t.targets?.length) {
    console.log("");
    console.log("  Ziele");
    for (const x of t.targets.slice(0, 6)) {
      console.log(
        "    " + x.host.padEnd(20) +
        (geld(x.money) + " (" + (x.moneyPct * 100).toFixed(0) + "%)").padEnd(20) +
        ("sec " + x.sec.toFixed(1) + "/" + x.minSec.toFixed(1)).padEnd(16) +
        geld(x.valuePerSec) + "/s",
      );
    }
  }

  if (t.events?.length) {
    console.log("");
    console.log("  Verlauf");
    for (const e of t.events.slice(-10)) {
      console.log("    " + new Date(e.at).toTimeString().slice(0, 8) + "  " + e.text);
    }
  }

  if (zeigeKauf) {
    try {
      const raw = await rpc("getFile", { filename: "data/invest.txt", server: "home" });
      const eintraege = JSON.parse(raw);
      console.log("");
      console.log("  Einkaeufe");
      for (const e of eintraege.slice(-8)) {
        console.log("    " + new Date(e.at).toTimeString().slice(0, 8) + "  " + e.text);
      }
    } catch {
      console.log("");
      console.log("  Einkaeufe: noch keine");
    }
  }

  if (zeigeNetz) {
    const servers = state.servers ?? [];
    const eigene = servers.filter((s) => s.purchasedByPlayer);
    console.log("");
    console.log("  Eigene Rechner: " + eigene.length + "   " + eigene.map((s) => s.hostname).join(" "));
    console.log("  Ohne Root: " + servers.filter((s) => !s.hasAdminRights).length);
  }
  console.log("");
}

main().catch((e) => console.log("Fehler:", e.message));
