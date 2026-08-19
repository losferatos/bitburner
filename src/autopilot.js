import * as calc from "lib/calc";

/**
 * Der Autopilot.
 *
 * Laeuft dauerhaft, verschafft sich Zugriff auf das Netz, verteilt Arbeiter
 * und erntet Geld. Alles, was er entscheidet, schreibt er sichtbar in sein
 * eigenes Fenster im Spiel - das ist Absicht: man soll ihm beim Denken
 * zusehen koennen, nicht nur beim Verdienen.
 *
 * Aufbau einer Runde:
 *   1. Netz abgehen und alles knacken, was knackbar ist
 *   2. Arbeiter auf jeden Rechner mit Speicher kopieren
 *   3. Bestes Ziel bestimmen
 *   4. Eine Welle losschicken: erst vorbereiten, dann ernten
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  ns.ui.openTail();
  ns.ui.setTailTitle?.("Autopilot");
  ns.ui.resizeTail(760, 520);
  ns.ui.moveTail(20, 20);
  // Eingeklappt starten: Das Fenster soll da sein, wenn man hineinsehen will,
  // aber nicht bei jedem Neustart ungefragt den halben Bildschirm belegen.
  ns.ui.setTailMinimized?.(true);

  const WORKERS = ["worker/hack.js", "worker/grow.js", "worker/weaken.js"];
  // Kleiner Puffer auf home. Bewusst klein: Der Autopilot selbst steckt
  // bereits in getServerUsedRam - wer hier nochmal seine vollen 7 GB abzieht,
  // rechnet ihn doppelt und verschenkt den halben Heimrechner.
  const HOME_RESERVE = 2;
  // Bis zu dieser Sicherheitsstufe ueber dem Minimum gilt ein Ziel als bereit.
  const SEC_TOLERANCE = 3;
  // Ab diesem Anteil des Maximalgeldes lohnt das Ernten.
  const MONEY_READY = 0.9;
  // So viele erntereife Ziele gleichzeitig abschoepfen. Das ist billig:
  // ein vorbereitetes Ziel braucht nur wenige Threads je Welle.
  const MAX_TARGETS = 8;
  // So viele Ziele gleichzeitig VORBEREITEN. Ein einziges laesst den Speicher
  // brachliegen, sobald sein Bedarf gedeckt ist - denn Nachwachsen braucht
  // Zeit, nicht Threads. Zu viele verzetteln alles, weil dann keines fertig
  // wird. Vier ist der Mittelweg; die Reihenfolge nach Ertrag je Thread sorgt
  // dafuer, dass die vorderen zuerst satt werden und die hinteren nur
  // bekommen, was uebrig bleibt.
  const PREP_TARGETS = 4;
  // Anteil des Guthabens, den eine Erntewelle abschoepfen soll.
  //
  // Der Wert ist der wichtigste Hebel im ganzen Bot, und er gehoert niedrig:
  // hack() nimmt linear weg, grow() muss multiplikativ zurueckholen. Wer 50 %
  // abschoepft, braucht ln(2)/k Grow-Threads; wer 10 % nimmt, nur ln(1/0.9)/k
  // - also rund ein Sechstel bei einem Fuenftel Ertrag. Kleine Happen sind
  // damit deutlich speicherguenstiger, und der Server bleibt nahe am Maximum,
  // wo jeder einzelne Hack-Thread am meisten bringt.
  const HACK_FRACTION = 0.1;

  // Eigener Quelltext beim Start. Aendert er sich, ist eine neue Fassung
  // eingetroffen - dann beendet sich dieser Prozess, und der Verwalter auf
  // dem Nachbarrechner startet die neue Fassung. Das macht die Entwicklung
  // unabhaengig davon, ob eine Terminaleingabe im richtigen Fenster landet.
  const ownSource = ns.read("autopilot.js");

  const startedAt = Date.now();
  const events = [];
  const knownFiles = new Set();
  let round = 0;
  let lastTarget = null;
  let earned = 0;
  let moneyAtStart = ns.getServerMoneyAvailable("home");

  /** Merkt sich eine Entscheidung fuer die Anzeige. */
  const note = (text) => {
    events.push({ at: Date.now(), text });
    if (events.length > 12) events.shift();
  };

  note("Autopilot gestartet");

  while (true) {
    round++;
    try {

    const player = playerFacts(ns);
    const hosts = scanAll(ns);

    // Das Spiel schiebt Programme und Nachrichten unangekuendigt auf home -
    // Story-Meilensteine wie fl1ght.exe, aber auch Hinweise auf freigeschaltete
    // Moeglichkeiten. Als Popup gehen sie leicht unter, deshalb landen sie hier
    // im Verlauf, wo sie stehen bleiben.
    for (const f of ns.ls("home")) {
      if (knownFiles.has(f)) continue;
      knownFiles.add(f);
      if (round === 1) continue; // beim Start nur den Bestand merken
      if (/\.(exe|msg|lit|cct)$/.test(f)) note("Neu auf home: " + f);
    }

    // --- 1. Zugriff verschaffen -------------------------------------------
    const cracked = [];
    for (const host of hosts) {
      if (host === "home" || ns.hasRootAccess(host)) continue;
      if (tryCrack(ns, host)) {
        cracked.push(host);
        note("Zugriff auf " + host + " erlangt");
      }
    }

    // --- 2. Lage aufnehmen -------------------------------------------------
    const servers = [];
    for (const host of hosts) {
      const root = ns.hasRootAccess(host);
      const ram = ns.getServerMaxRam(host);
      const moneyMax = ns.getServerMaxMoney(host);
      servers.push({
        host,
        root,
        ram,
        ramFree: Math.max(0, ram - ns.getServerUsedRam(host) - (host === "home" ? HOME_RESERVE : 0)),
        moneyMax,
        moneyNow: moneyMax > 0 ? ns.getServerMoneyAvailable(host) : 0,
        sec: ns.getServerSecurityLevel(host),
        secMin: ns.getServerMinSecurityLevel(host),
        growth: moneyMax > 0 ? ns.getServerGrowth(host) : 0,
        reqSkill: ns.getServerRequiredHackingLevel(host),
      });
    }

    // --- 3. Arbeiter ausliefern -------------------------------------------
    // Die Arbeiter werden bei JEDEM Start neu ausgeliefert, nicht nur wenn sie
    // fehlen. Sonst erreicht geaenderter Arbeitercode die Flotte nie - die
    // alte Fassung ist ja "vorhanden". Eine Fassung auf einem fremden Rechner
    // laesst sich nicht pruefen (ns.read kennt keinen Host-Parameter), also
    // wird stumpf ueberschrieben. Da der Autopilot sich bei jeder Aenderung
    // seines Quelltexts selbst neu startet, sitzt danach ueberall der aktuelle
    // Stand. In den Folgerunden nur noch neu hinzugekommene Rechner bedienen.
    const workforce = servers.filter((s) => s.root && s.ram > 0);
    for (const s of workforce) {
      if (s.host === "home") continue;
      if (round === 1 || !ns.fileExists("worker/weaken.js", s.host)) {
        ns.scp(WORKERS, s.host, "home");
      }
    }

    // Bewusst KEIN Aufraeumen beim Start. Arbeiter aus dem vorigen Leben
    // arbeiten an denselben Zielen weiter und beenden sich ohnehin nach einer
    // Aktion. Sie wegzuraeumen wuerde bei jedem Neustart einen ganzen
    // Erntezyklus kosten - und da sich der Autopilot bei jeder neuen Fassung
    // selbst neu startet, waere das teuer erkauft.

    // Der Einkaeufer muss laufen - er besorgt den Speicher, von dem alles
    // andere abhaengt. Er lebt auf einem fremden Rechner, weil allein
    // ns.purchaseServer 2.25 GB kostet und home damit gesprengt waere.
    // Nach jedem killall ist er tot, also hier jede Runde nachsehen.
    const investRam = ns.getScriptRam("invest.js", "home");
    let investLives = false;
    for (const s of workforce) {
      const laeuft = ns.ps(s.host).find((p) => p.filename === "invest.js");
      if (!laeuft) continue;
      // Beim ersten Durchlauf abraeumen: Der Autopilot startet sich bei jeder
      // neuen Fassung selbst neu, also ist jetzt auch der Verwalter veraltet.
      // Er selbst kann das nicht merken - ns.read liest immer vom eigenen
      // Rechner, und dort liegt seine alte Kopie.
      if (round === 1) {
        ns.kill(laeuft.pid);
        // Den frei gewordenen Speicher sofort mitschreiben. Ohne das haelt der
        // Autopilot den Rechner weiter fuer belegt, findet nirgends Platz fuer
        // den Verwalter - und raeumt zur Strafe einen fremden 16-GB-Rechner
        // per killall leer. Bei jedem Neustart aufs Neue.
        s.ramFree += investRam;
        continue;
      }
      investLives = true;
      break;
    }
    if (!investLives && investRam > 0) {
      let wirt = workforce
        .filter((s) => s.host !== "home" && s.ramFree >= investRam)
        .sort((a, b) => b.ramFree - a.ramFree)[0];

      // Wenn die Arbeiter jeden Winkel belegen, kommt der Einkaeufer nie zum
      // Zug - und ohne ihn waechst der Speicher nie. Also hat er Vorrang:
      // ein Rechner wird notfalls freigeraeumt. Ein paar verlorene Threads
      // wiegen weniger als dauerhaft ausbleibendes Wachstum.
      if (!wirt) {
        wirt = workforce
          .filter((s) => s.host !== "home" && s.ram >= investRam)
          .sort((a, b) => a.ram - b.ram)[0];
        if (wirt) {
          ns.killall(wirt.host);
          wirt.ramFree = wirt.ram;
          note("Platz fuer den Einkaeufer geschaffen auf " + wirt.host);
        }
      }

      if (wirt) {
        ns.scp("invest.js", wirt.host, "home");
        if (ns.exec("invest.js", wirt.host)) {
          wirt.ramFree -= investRam;
          note("Einkaeufer laeuft jetzt auf " + wirt.host);
        }
      }
    }

    // --- 4. Ziel bestimmen -------------------------------------------------
    // Sortiert wird nach erwartetem Ertrag der naechsten Viertelstunde,
    // NICHT nach Dauerertrag. Sonst gewinnt immer der fetteste Server, auch
    // wenn er mit dem vorhandenen Speicher eine halbe Stunde Vorbereitung
    // braucht - und in der Zeit haette ein magerer laengst gezahlt.
    const ramNow = workforce.reduce((a, s) => a + s.ramFree, 0);
    // Fuer die Bewertung zaehlt der GESAMTE Arbeitsspeicher, nicht der gerade
    // freie: beim Zielwechsel werden die Arbeiter ohnehin abgezogen. Wer hier
    // mit dem freien Speicher rechnet, haelt jedes neue Ziel faelschlich fuer
    // unerreichbar, sobald das alte gut ausgelastet ist - und bleibt fuer
    // immer beim ersten Ziel haengen.
    const ramTotal = Math.max(2, workforce.reduce((a, s) => a + s.ram, 0) - HOME_RESERVE);
    const candidates = servers
      .filter((s) => s.root && s.moneyMax > 0 && s.reqSkill <= player.skill)
      .map((s) => ({
        ...s,
        score: calc.targetScore(s, player),
        yield: calc.expectedYield(s, player, ramTotal),
        prep: calc.prepSeconds(s, player, ramTotal),
      }))
      .sort((a, b) => b.yield - a.yield);

    const target = candidates[0] ?? null;

    if (target && target.host !== lastTarget) {
      note("Bestes Ziel ist jetzt " + target.host + " (" + geld(target.score) + "/s)");
      lastTarget = target.host;
    }

    // --- 5. Wellen losschicken --------------------------------------------
    // Mehrere Ziele gleichzeitig. Ein einzelnes Ziel laesst spaetestens dann
    // Speicher brachliegen, wenn es vorbereitet ist: gehackt werden kann nur,
    // was nachgewachsen ist, und Nachwachsen braucht Zeit, nicht Threads.
    // Reihenfolge: erntereife Ziele zuerst - die zahlen sofort. Was danach
    // an Speicher uebrig ist, geht in die Vorbereitung des naechstbesten.
    // Erst nachsehen, wer schon fuer wen arbeitet - VOR jeder neuen
    // Entscheidung. Wer das nicht tut, schickt jede Sekunde eine volle Welle
    // los, obwohl die vorige noch laeuft, verstopft damit den eigenen
    // Speicher und laesst alle anderen Ziele verhungern.
    const busy = { hack: 0, grow: 0, weaken: 0 };
    const busyPerTarget = new Map();
    const ART = {
      "worker/hack.js": "hack",
      "worker/grow.js": "grow",
      "worker/weaken.js": "weaken",
    };
    for (const s of workforce) {
      for (const proc of ns.ps(s.host)) {
        const art = ART[proc.filename];
        if (!art) continue;
        busy[art] += proc.threads;
        const ziel = String(proc.args[0] ?? "?");
        if (!busyPerTarget.has(ziel)) busyPerTarget.set(ziel, { hack: 0, grow: 0, weaken: 0 });
        busyPerTarget.get(ziel)[art] += proc.threads;
      }
    }
    for (const c of candidates) c.busy = busyPerTarget.get(c.host) ?? { hack: 0, grow: 0, weaken: 0 };

    const ready = (s) => s.sec <= s.secMin + SEC_TOLERANCE && s.moneyNow >= s.moneyMax * MONEY_READY;

    // Wie viele Threads fehlen diesem Ziel noch bis zur Erntereife?
    const restBedarf = (s) => {
      if (ready(s)) return 0;
      let n = calc.weakenThreads(Math.max(0, s.sec - s.secMin));
      if (s.moneyNow < s.moneyMax * MONEY_READY) {
        const g = calc.growThreads(s, s.moneyMax, Math.max(1, s.moneyNow), player, 1);
        if (Number.isFinite(g)) n += g;
      }
      return Math.max(1, n);
    };

    for (const c of candidates) c.rest = restBedarf(c);

    // Rangfolge nach Ertrag je investiertem Thread, nicht nach Ertrag allein.
    // Sonst frisst der fetteste Server allen Speicher fuer eine halbe Stunde
    // Vorbereitung, waehrend ein fast fertiges Ziel danebensteht, das mit
    // dreissig Threads sofort zahlen wuerde. Erntereife Ziele zuerst: die
    // kosten am wenigsten und bringen sofort.
    const sortiert = candidates
      .filter((c) => c.score > 0)
      .sort((a, b) => {
        if (ready(a) !== ready(b)) return ready(a) ? -1 : 1;
        if (ready(a)) return b.score - a.score;
        return b.score / b.rest - a.score / a.rest;
      });

    // Alle erntereifen Ziele bedienen - die kosten wenig und zahlen sofort.
    // Vorbereitet wird dagegen immer nur EINES. Sieben Ziele gleichzeitig
    // aufzupaeppeln heisst, dass keines fertig wird: jedes bekommt ein
    // Achtel des Speichers und braucht das Achtfache der Zeit, waehrend der
    // Ertrag die ganze Zeit ausbleibt. Konzentration schlaegt Breite.
    const erntereif = sortiert.filter(ready).slice(0, MAX_TARGETS);
    const naechstes = sortiert.filter((c) => !ready(c)).slice(0, PREP_TARGETS);
    const active = [...erntereif, ...naechstes];

    // Ziele, die aus der Rangfolge gefallen sind, aber noch Arbeiter haben,
    // muessen mitbetreut werden. Sonst laufen dort hack-Threads weiter,
    // waehrend niemand mehr nachwachsen laesst - der Server wird leergeraeumt
    // und ist beim naechsten Aufstieg in die Rangfolge wertlos.
    for (const c of candidates) {
      if (active.includes(c)) continue;
      if (c.busy.hack + c.busy.grow + c.busy.weaken > 0) active.push(c);
    }

    let phase = "warten";
    let reason = "Kein erreichbares Ziel - das eigene Hacking-Level ist noch zu niedrig.";
    const plan = [];
    let harvesting = 0;
    let preparing = 0;

    // Erst planen, dann verteilen - und zwar Sicherheit ZUERST.
    //
    // Wer weaken hinter grow/hack anstellt, laesst es systematisch verhungern:
    // grow und hack raeumen den Speicher leer, fuer den Ausgleich bleibt
    // nichts. Dann steigt die Sicherheit, und mit ihr sinken Ausbeute und
    // Tempo jeder weiteren Aktion - eine Abwaertsspirale, die sich selbst
    // antreibt. Sicherheit ist die Grundlage, nicht die Nachbereitung.
    const auftraege = [];
    for (const t of active) {
      const anteil = t.moneyMax > 0 ? t.moneyNow / t.moneyMax : 0;

      if (t.sec > t.secMin + SEC_TOLERANCE) {
        t.doing = "beruhigen";
        auftraege.push({
          t,
          weaken: Math.max(0, calc.weakenThreads(t.sec - t.secMin) - t.busy.weaken),
        });
      } else if (anteil < MONEY_READY) {
        const voll = calc.growThreads(t, t.moneyMax, t.moneyNow, player, 1);
        const grow = Number.isFinite(voll) ? Math.max(0, voll - t.busy.grow) : 0;
        t.doing = "aufpaeppeln";
        auftraege.push({
          t,
          grow,
          // Ausgleich fuer die GEPLANTEN grow-Threads, nicht fuer die spaeter
          // tatsaechlich gestarteten. Lieber ein weaken zu viel: ueberzaehlige
          // Threads richten keinen Schaden an, die Sicherheit ist nach unten
          // gedeckelt (Server.ts:91).
          weaken: Math.max(0, calc.weakenThreads((t.busy.grow + grow) * calc.GROW_FORTIFY_AMOUNT) - t.busy.weaken),
        });
      } else {
        const prepped = { ...t, sec: t.secMin, root: true };
        const perThread = calc.hackPercent(prepped, player);
        const voll = perThread > 0 ? Math.floor(HACK_FRACTION / perThread) : 0;
        const hack = Math.max(0, voll - t.busy.hack);
        t.doing = "ernten";
        auftraege.push({
          t,
          hack,
          weaken: Math.max(0, calc.weakenThreads((t.busy.hack + hack) * calc.SERVER_FORTIFY_AMOUNT) - t.busy.weaken),
        });
      }
    }

    // Durchgang 1: Sicherheit sichern.
    for (const a of auftraege) {
      if (!a.weaken) continue;
      const gestartet = deploy(ns, workforce, "worker/weaken.js", a.weaken, a.t.host);
      plan.push({ host: a.t.host, what: "weaken", threads: gestartet, need: a.weaken });
    }

    // Durchgang 2: Mit dem Rest ernten und aufpaeppeln.
    for (const a of auftraege) {
      if (a.grow) {
        const gestartet = deploy(ns, workforce, "worker/grow.js", a.grow, a.t.host);
        if (gestartet) preparing++;
        plan.push({ host: a.t.host, what: "grow", threads: gestartet, need: a.grow });
      }
      if (a.hack) {
        const gestartet = deploy(ns, workforce, "worker/hack.js", a.hack, a.t.host);
        if (gestartet) harvesting++;
        plan.push({ host: a.t.host, what: "hack", threads: gestartet, need: a.hack });
      }
    }

    // Nach Zustand zaehlen, nicht nach neu gestarteten Threads: ein voll
    // ausgelastetes Netz startet naemlich genauso wenig Neues wie ein
    // stehendes, und beides duerfte nicht gleich aussehen.
    harvesting = active.filter((t) => t.doing === "ernten").length;
    preparing = active.filter((t) => t.doing && t.doing !== "ernten").length;

    if (active.length) {
      phase = harvesting > 0 ? "ernten" : "vorbereiten";
      const wartend = plan.filter((p) => p.need > 0 && p.threads === 0).length;
      reason =
        harvesting + " Ziel(e) werden abgeschoepft, " + preparing + " vorbereitet. " +
        (ramNow < 4
          ? "Der Speicher ist voll ausgelastet."
          : fmt(ramNow, 0) + " GB frei, aber in zu kleinen Resten verteilt.") +
        (wartend ? " " + wartend + " Auftrag/Auftraege warten auf Platz." : "");
    }

    earned = ns.getServerMoneyAvailable("home") - moneyAtStart;


    // --- 6. Anzeigen -------------------------------------------------------
    const view = {
      round,
      uptime: (Date.now() - startedAt) / 1000,
      phase,
      reason,
      plan,
      busy,
      target,
      player,
      earned,
      // [0] misst nur LAUFENDE Skripte - unsere Ein-Weg-Arbeiter buchen ihr
      // Geld aber in der letzten Millisekunde ihres Lebens und sind dann weg.
      // Diese Anzeige stuende strukturell nahe null. [1] ist der Schnitt seit
      // dem letzten Reset und damit das, was wir wirklich wissen wollen.
      income: ns.getTotalScriptIncome()[1],
      exp: ns.getTotalScriptExpGain(),
      net: {
        total: servers.length,
        rooted: servers.filter((s) => s.root).length,
        ramFree: workforce.reduce((a, s) => a + s.ramFree, 0),
        ramTotal: workforce.reduce((a, s) => a + s.ram, 0),
      },
      candidates: candidates.slice(0, 5),
      active,
      events,
    };

    draw(ns, view);
    writeBrain(ns, view);

    // Neue Fassung eingetroffen? Dann Platz machen. Das eigene Fenster noch
    // selbst schliessen - nach dem Beenden geht das nicht mehr, und tote
    // Fenster bleiben sonst als Muell auf dem Bildschirm liegen.
    if (ns.read("autopilot.js") !== ownSource) {
      note("Neue Fassung erkannt - beende mich, der Verwalter startet sie");
      writeBrain(ns, { ...view, phase: "neustart", reason: "Neue Fassung wird uebernommen." });
      ns.ui.closeTail(ns.pid);
      ns.exit();
    }
    } catch (err) {
      // Ein einzelner Rechner, der sich unerwartet verhaelt, darf nicht den
      // ganzen Autopiloten toeten - sonst startet ihn der Verwalter alle fuenf
      // Sekunden neu, und aus einem Schluckauf wird eine Dauerschleife.
      note("Fehler in Runde " + round + ": " + (err?.message ?? String(err)));
    }

    await ns.sleep(1000);
  }
}

// ---------------------------------------------------------------------------
// Anzeige im Spiel
// ---------------------------------------------------------------------------

const C = {
  off: "[0m",
  dim: "[38;5;65m",
  gruen: "[38;5;83m",
  hell: "[38;5;158m",
  gold: "[38;5;220m",
  rot: "[38;5;203m",
  blau: "[38;5;117m",
};

/**
 * Zeichnet den Zustand ins Skriptfenster. Wird jede Sekunde neu gemalt.
 * @param {NS} ns
 */
function draw(ns, v) {
  ns.clearLog();
  const line = (s = "") => ns.print(s);
  const pad = (s, n) => String(s).padEnd(n);

  const phaseFarbe =
    v.phase === "ernten" ? C.gold : v.phase === "warten" ? C.rot : C.blau;

  line(C.dim + "  Runde " + v.round + "   ·   Laufzeit " + dauer(v.uptime) + C.off);
  line("");
  line(
    "  " + phaseFarbe + pad(v.phase.toUpperCase(), 14) + C.off +
    C.dim + "Verdient  " + C.off + C.gold + geld(v.earned) + C.off +
    C.dim + "   (" + geld(v.income) + "/s)" + C.off,
  );
  line("");

  line("  " + C.dim + "Netz    " + C.off + v.net.rooted + " von " + v.net.total + " Rechnern offen" +
    C.dim + "   ·   Speicher " + C.off + fmt(v.net.ramTotal - v.net.ramFree, 0) + C.dim + " / " + fmt(v.net.ramTotal, 0) + " GB" +
    "   ·   Hacking " + C.off + C.hell + v.player.skill + C.off + C.dim + "   ·   " + fmt(v.exp, 1) + " exp/s" + C.off);
  line("  " + C.dim + "Lage    " + C.off + umbruch(v.reason, 62, 10));

  line("");
  if (v.active?.length) {
    line(
      C.dim + "  Ziel              Guthaben            Sicherheit    Wert/s     Im Einsatz" + C.off,
    );
    for (const t of v.active) {
      const anteil = t.moneyMax > 0 ? t.moneyNow / t.moneyMax : 0;
      const b = t.busy ?? { hack: 0, grow: 0, weaken: 0 };
      const arbeit = [];
      if (b.hack) arbeit.push(C.gold + b.hack + "h" + C.off);
      if (b.grow) arbeit.push(C.gruen + b.grow + "g" + C.off);
      if (b.weaken) arbeit.push(C.blau + b.weaken + "w" + C.off);

      const secOk = t.sec <= t.secMin + 3;
      const farbe = t.doing === "ernten" ? C.gold : t.doing === "aufpaeppeln" ? C.gruen : C.blau;

      line(
        "  " + farbe + pad(t.host, 18) + C.off +
        pad(geld(t.moneyNow), 9) + balken(anteil, 8) + pad(" " + pct(anteil), 8) +
        (secOk ? C.gruen : C.rot) + pad(fmt(t.sec, 1) + "/" + fmt(t.secMin, 1), 14) + C.off +
        pad(geld(t.score), 11) +
        (arbeit.length ? arbeit.join(C.dim + "·" + C.off) : C.dim + "-" + C.off),
      );
    }
  } else {
    line("  " + C.rot + "Noch kein erreichbares Ziel" + C.off);
  }

  // Was gerade nicht losgeschickt werden konnte, ist die wichtigste
  // Engpassmeldung - sie sagt, wofuer der naechste Speicher gebraucht wird.
  const wartend = v.plan.filter((p) => p.need > 0 && p.threads === 0);
  if (wartend.length) {
    const kurz = wartend.slice(0, 3).map((p) => p.what + " " + p.need + " auf " + p.host);
    line("");
    line("  " + C.dim + "Wartet auf Speicher: " + kurz.join(", ") +
      (wartend.length > 3 ? " (+" + (wartend.length - 3) + " weitere)" : "") + C.off);
  }

  line("");
  line("  " + C.dim + "Verlauf" + C.off);
  for (const e of [...v.events].reverse().slice(0, 6)) {
    line("    " + C.dim + uhr(e.at) + "  " + C.off + e.text);
  }
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** @param {NS} ns */
function playerFacts(ns) {
  const p = ns.getPlayer();
  return {
    skill: p.skills.hacking,
    int: p.skills.intelligence ?? 0,
    money: p.money,
    multMoney: p.mults.hacking_money,
    multChance: p.mults.hacking_chance,
    multSpeed: p.mults.hacking_speed,
    multGrow: p.mults.hacking_grow,
  };
}

/** @param {NS} ns */
function scanAll(ns) {
  const seen = new Set(["home"]);
  const queue = ["home"];
  while (queue.length) {
    for (const next of ns.scan(queue.pop())) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...seen];
}

/**
 * Versucht, einen Rechner zu knacken. Oeffnet so viele Anschluesse wie
 * moeglich und nukt, sobald es reicht.
 * @param {NS} ns
 */
function tryCrack(ns, host) {
  let open = 0;
  const tools = [
    ["BruteSSH.exe", ns.brutessh],
    ["FTPCrack.exe", ns.ftpcrack],
    ["relaySMTP.exe", ns.relaysmtp],
    ["HTTPWorm.exe", ns.httpworm],
    ["SQLInject.exe", ns.sqlinject],
  ];
  for (const [file, fn] of tools) {
    if (ns.fileExists(file, "home")) {
      try {
        fn(host);
        open++;
      } catch {
        // Anschluss war schon offen
        open++;
      }
    }
  }
  // Bewusst OHNE Pruefung des Hacking-Levels: ns.nuke verlangt nur NUKE.exe
  // und genug offene Anschluesse (src/NetscriptFunctions.ts:531). Auch grow
  // und weaken brauchen kein Level, nur Root. Das Level entscheidet allein
  // darueber, ob man einen Rechner HACKEN kann - als Arbeitspferd taugt er
  // vorher schon, und genau davon haben wir zu wenig.
  if (open < ns.getServerNumPortsRequired(host)) return false;
  try {
    return ns.nuke(host) !== false;
  } catch {
    return false;
  }
}

/**
 * Verteilt Arbeiter ueber alle Rechner mit freiem Speicher.
 * Liefert die tatsaechlich gestartete Threadzahl zurueck - die kann kleiner
 * sein als gewuenscht, wenn der Speicher nicht reicht. Genau das will man
 * in der Anzeige sehen.
 *
 * @param {NS} ns
 * @returns {number}
 */
function deploy(ns, workforce, script, threads, target) {
  if (!threads || threads < 1 || !Number.isFinite(threads)) return 0;
  const cost = ns.getScriptRam(script, "home");
  let left = Math.floor(threads);
  let started = 0;

  // Grosse Rechner zuerst, das haelt die Zahl der Prozesse klein.
  const order = [...workforce].sort((a, b) => b.ramFree - a.ramFree);
  for (const s of order) {
    if (left <= 0) break;
    const fits = Math.floor(s.ramFree / cost);
    if (fits < 1) continue;
    const n = Math.min(fits, left);
    const pid = ns.exec(script, s.host, n, target, 0, Date.now() + "-" + started);
    if (pid) {
      s.ramFree -= n * cost;
      left -= n;
      started += n;
    }
  }
  return started;
}

/**
 * Legt den Zustand fuer die Bruecke nach draussen ab.
 *
 * Der Autopilot schreibt die Telemetrie selbst, statt sie einem zweiten
 * Skript zu ueberlassen: auf home sind nur 8 GB, und ein eigener
 * Telemetrie-Prozess haette 2.75 GB davon gefressen - mehr als ein
 * ganzer Arbeiter.
 *
 * @param {NS} ns
 */
function writeBrain(ns, v) {
  const data = {
    t: Date.now(),
    uptime: v.uptime,
    cycle: v.round,
    phase: v.phase,
    action: v.plan.map((p) => p.what + " x" + p.threads).join(", "),
    reason: v.reason,
    player: {
      money: v.player.money,
      hackLevel: v.player.skill,
      karma: ns.heart.break(),
    },
    income: { scriptIncome: v.income, scriptExpGain: v.exp },
    ram: { used: v.net.ramTotal - v.net.ramFree, max: v.net.ramTotal },
    network: { total: v.net.total, rooted: v.net.rooted, backdoored: 0 },
    busy: v.busy,
    events: v.events,
    targets: v.candidates.map((c) => ({
      host: c.host,
      action: c.host === v.target?.host ? v.phase : "",
      threads: 0,
      money: c.moneyNow,
      moneyPct: c.moneyMax > 0 ? c.moneyNow / c.moneyMax : 0,
      sec: c.sec,
      minSec: c.secMin,
      valuePerSec: c.score,
    })),
  };
  ns.write("data/telemetry.txt", JSON.stringify(data), "w");
}

// --- Formatierung ----------------------------------------------------------

function geld(n) {
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
}

function fmt(n, d = 0) {
  return Number.isFinite(n) ? n.toFixed(d) : "--";
}

function pct(x) {
  return Number.isFinite(x) ? (x * 100).toFixed(1) + "%" : "--";
}

function dauer(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return h + "h " + m + "m";
  if (m) return m + "m " + Math.floor(s % 60) + "s";
  return Math.floor(s) + "s";
}

function uhr(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" +
    String(d.getSeconds()).padStart(2, "0");
}

function balken(anteil, breite) {
  const voll = Math.max(0, Math.min(breite, Math.round(anteil * breite)));
  return C.gruen + "█".repeat(voll) + C.dim + "░".repeat(breite - voll) + C.off;
}

/** Bricht langen Text um und rueckt Folgezeilen ein. */
function umbruch(text, breite, einzug) {
  const worte = String(text).split(" ");
  const zeilen = [];
  let z = "";
  for (const w of worte) {
    if ((z + " " + w).trim().length > breite) {
      zeilen.push(z.trim());
      z = w;
    } else {
      z += " " + w;
    }
  }
  if (z.trim()) zeilen.push(z.trim());
  return zeilen.join("\n  " + " ".repeat(einzug));
}
