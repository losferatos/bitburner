/**
 * Haelt die Sleeves beschaeftigt. Sonst stehen sie herum.
 *
 * WARUM (28.08.2026, 17:50)
 *
 * BitNode 10 gibt ab der ersten Sekunde einen Sleeve
 * (`SleeveCovenantPurchases.tsx:62-63`: `min(3, SF10-Level + (bitNodeN === 10
 * ? 1 : 0))`), und er startet dort brauchbar statt bei null -
 * `prestigeSourceFile` setzt in BitNode 10 `shock <= 25` und `sync >= 25`
 * (`PlayerObjectGeneralMethods.ts:150-155`). Bis heute gab es im ganzen Repo
 * kein einziges Sleeve-Skript; der Sleeve stand seit 17:05 still.
 *
 * WAS DER SPIELER DAVON HAT (`Sleeve/Work/Work.ts:17-25`)
 *
 *     Player.gainMoney(shockedStats.money)          Geld, voll
 *     applyWorkStatsExp(Player, stats, sync)        Erfahrung, mal sync/100
 *     Player.karma -= crime.karma * syncBonus       Karma, mal sync/100
 *
 * Der Sleeve ist also kein zweiter Rechner, sondern ein zweiter Koerper: Er
 * kann keine Skripte laufen lassen (das Netz hackt ohnehin ohne ihn), aber er
 * verdient Geld und Erfahrung parallel zum Spieler.
 *
 * WARUM SHOPLIFT UND NICHT MUG (`Crime/Crimes.ts:6-62`)
 *
 *     Verbrechen    Dauer     Geld    Schwierigkeit   Geld je Sekunde
 *     Shoplift      2,0 s   15.000        0,05             7.500
 *     Mug           4,0 s   36.000        0,20             9.000
 *     Rob Store    60,0 s  400.000        0,20             6.667
 *
 * Mug sieht besser aus, ist aber VIERMAL so schwer, und ein frischer Sleeve
 * hat Kampfwerte um 1. Der Bruttoertrag zaehlt nur, wenn die Aktion gelingt -
 * dieselbe Lehre wie bei den Black Ops am 25.08. Shoplift ist deshalb der
 * Einstieg; die stufenweise Auswahl nach Kampfwerten braucht
 * `ns.sleeve.getSleeve` und damit 4 GB mehr, als hier gerade frei sind.
 *
 * SPEICHER: Jede Sleeve-Funktion kostet 4 GB (`RamCostGenerator.ts:51,
 * 398-421`), und Bitburner summiert je VERSCHIEDENER Funktion. Die erste
 * Fassung benutzte drei (getNumSleeves, getTask, setToCommitCrime) und kam
 * damit auf rund 13,6 GB - **sie ist um 17:52 nicht gestartet**, weil auf home
 * nur 9,2 GB frei waren und die gerooteten Server in dieser Phase noch
 * kleiner sind.
 *
 * Deshalb bleibt genau EINE Sleeve-Funktion uebrig: `setToCommitCrime`. Das
 * kostet den Verzicht auf `getTask`, also wird das Verbrechen bei jedem Takt
 * neu gesetzt - und `setToCommitCrime` legt eine neue SleeveCrimeWork an,
 * bricht das laufende Verbrechen also ab. Bei Shoplift sind das hoechstens
 * zwei Sekunden je Takt; bei 60 s Takt sind das unter vier Prozent. Sobald
 * ein Rechner mit mehr Speicher da ist, kommt getTask zurueck.
 *
 * Aufruf:  node tools/task.js sleeve.js
 *
 * @param {NS} ns
 */
export async function main(ns) {
  ns.disableLog("ALL");

  const VERBRECHEN = "Shoplift";
  const TAKT = 60000;
  // Ohne getNumSleeves (4 GB) blind bis zur Obergrenze durchzaehlen. Mehr als
  // drei kann es ohne Covenant-Kaeufe nicht geben
  // (`SleeveCovenantPurchases.tsx:62-63`), und ein Index, den es nicht gibt,
  // wirft nur.
  const MAX = 3;

  for (;;) {
    const stand = [];
    for (let i = 0; i < MAX; i++) {
      let ok = false;
      try { ok = ns.sleeve.setToCommitCrime(i, VERBRECHEN); }
      catch { break; }   // ab hier gibt es keinen Sleeve mehr
      stand.push({ nr: i, gesetzt: ok });
    }
    ns.write("data/sleeve.json", JSON.stringify({
      zeit: Date.now(), verbrechen: VERBRECHEN, anzahl: stand.length,
      sleeves: stand,
    }), "w");
    // Der Auftragslaeufer sucht den Wirt mit dem meisten freien Speicher -
    // das ist selten home. Ohne scp findet die Datei niemand.
    if (ns.getHostname() !== "home") {
      ns.scp("data/sleeve.json", "home", ns.getHostname());
    }
    await ns.sleep(TAKT);
  }
}
