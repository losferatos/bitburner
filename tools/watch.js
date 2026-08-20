/**
 * Der Wecker.
 *
 * In der Nacht zum 20.08.2026 stand der Bot fuenf Stunden still, und niemand
 * hat es gemerkt - ich war nicht aktiv, und meine Sitzung ruht, wenn niemand
 * schreibt. Ein Kontrollagent haette mitgeschlafen. Dieses Skript loest das
 * Problem von der anderen Seite: es laeuft als Hintergrundprozess, prueft die
 * Telemetrie im Minutentakt und BEENDET SICH, sobald etwas nicht stimmt oder
 * die Wachzeit um ist. Ein beendeter Hintergrundprozess weckt mich.
 *
 * Es greift selbst nicht ins Spiel ein - es beobachtet nur und schlaegt Alarm.
 * Reparieren ist meine Sache, das Sicherheitsnetz im Spiel selbst ist die des
 * Nachtdiensts.
 *
 * Aufruf:  node tools/watch.js [Wachminuten]
 */

const BASE = "http://localhost:8795";
const WACHMINUTEN = Number(process.argv[2]) || 30;

// Ab wann gilt ein stehendes Guthaben als Stillstand? Waehrend einer echten
// Vorbereitung darf es durchaus Minuten stehen - deshalb nicht zu knapp.
const STILL_MINUTEN = 12;
// Ab wann gilt die Telemetrie als eingefroren? Der Autopilot schreibt sie in
// jeder Runde; bleibt sie stehen, haengt er oder ist tot.
const TELEMETRIE_MAX_ALTER = 180;

const geld = (n) => {
  if (!Number.isFinite(n)) return "--";
  const u = ["", "k", "m", "b", "t"];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return "$" + (n < 10 ? n.toFixed(2) : n.toFixed(1)) + u[i];
};

const jetzt = () => new Date().toTimeString().slice(0, 8);

async function lies() {
  const s = await (await fetch(BASE + "/api/state")).json();
  const t = s.telemetry;
  if (!t) throw new Error("keine Telemetrie im Zustand");
  const m = (t.reason || "").match(/(\d+) Ziel\(e\) werden abgeschoepft, (\d+) vorbereitet/);
  return {
    at: t.t,
    round: t.cycle,
    money: (t.player || {}).money,
    skill: (t.player || {}).hackLevel,
    income: (t.income || {}).scriptIncome,
    harvesting: m ? Number(m[1]) : null,
    preparing: m ? Number(m[2]) : null,
    ramUsed: (t.ram || {}).used,
    ramTotal: (t.ram || {}).max,
    rooted: s.rootedCount,
    servers: s.serverCount,
    phase: t.phase,
    reason: t.reason,
  };
}

async function main() {
  const start = Date.now();
  let geldZuletzt = null;
  let geldSeit = Date.now();
  let rundeZuletzt = null;
  let rundeSeit = Date.now();

  console.log(jetzt() + "  Wecker gestellt auf " + WACHMINUTEN + " Minuten.");

  while (true) {
    await new Promise((ok) => setTimeout(ok, 60000));

    let b;
    try {
      b = await lies();
    } catch (e) {
      console.log(jetzt() + "  ALARM: Telemetrie nicht lesbar (" + e.message + ")");
      console.log("Die Bruecke oder der Autopilot ist weg. Nachsehen!");
      return;
    }

    const alter = Math.round((Date.now() - (b.at || 0)) / 1000);
    if (alter > TELEMETRIE_MAX_ALTER) {
      console.log(jetzt() + "  ALARM: Telemetrie ist " + alter + " Sekunden alt.");
      console.log("Der Autopilot schreibt nicht mehr - er haengt oder ist tot.");
      return;
    }

    if (b.round !== rundeZuletzt) { rundeZuletzt = b.round; rundeSeit = Date.now(); }
    else if (Date.now() - rundeSeit > TELEMETRIE_MAX_ALTER * 1000) {
      console.log(jetzt() + "  ALARM: Rundenzaehler steht seit " + Math.round((Date.now() - rundeSeit) / 60000) + " Minuten auf " + b.round + ".");
      return;
    }

    const m = b.money;
    if (geldZuletzt === null || m > geldZuletzt * 1.02 + 1000) {
      geldZuletzt = m;
      geldSeit = Date.now();
    } else {
      const still = Math.round((Date.now() - geldSeit) / 60000);
      // Ein stehendes Guthaben ist KEIN Stillstand, solange die Skripte
      // verdienen. Am 20.08. um 14:11 schlug dieser Wecker Alarm, waehrend der
      // Bot 123 Mio $/s einspielte - der Verwalter hatte den Ueberschuss nur
      // sofort wieder in Server-RAM gesteckt, das Guthaben pendelte deshalb um
      // dieselbe Zahl. Je erfolgreicher der Bot wird, desto blinder wird das
      // Guthaben als Indikator: bei Billionen muessten 2 % Zuwachs erst
      // zusammenkommen, damit sich die Anzeige ueberhaupt regt.
      //
      // Der ehrliche Beweis von Arbeit ist der Skriptertrag. Faellt der auf
      // nahezu null, stehen die Arbeiter wirklich - und nur dann ist das das
      // Muster der Ungluecksnacht.
      const verdientNoch = Number.isFinite(b.income) && b.income > 1e5;
      if (verdientNoch) {
        geldSeit = Date.now();
      } else if (still >= STILL_MINUTEN) {
        console.log(jetzt() + "  ALARM: Guthaben steht seit " + still + " Minuten bei " + geld(m)
          + " UND der Skriptertrag liegt bei " + geld(b.income) + "/s.");
        console.log("  Ziele geerntet: " + (b.harvesting ?? "?") + ", vorbereitet: " + (b.preparing ?? "?"));
        console.log("  Speicher: " + Math.round(b.ramUsed || 0) + " / " + Math.round(b.ramTotal || 0) + " GB");
        console.log("Das ist das Muster der Ungluecksnacht. Sofort nachsehen!");
        return;
      }
    }

    const gelaufen = Math.round((Date.now() - start) / 60000);
    if (gelaufen >= WACHMINUTEN) {
      console.log(jetzt() + "  Planmaessige Kontrolle nach " + gelaufen + " Minuten.");
      console.log("  Guthaben " + geld(m) + ", Hacking " + b.skill + ", Runde " + b.round);
      console.log("  Ziele geerntet: " + (b.harvesting ?? "?") + ", vorbereitet: " + (b.preparing ?? "?"));
      console.log("  Netz: " + (b.rooted ?? "?") + " von " + (b.servers ?? "?") + ", Speicher "
        + Math.round(b.ramUsed || 0) + " / " + Math.round(b.ramTotal || 0) + " GB");
      return;
    }
  }
}

main().catch((e) => console.log("Wecker abgestuerzt: " + e.message));
