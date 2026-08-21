# BitNode 4 — Singularity

Stand 21.08.2026. Die Skripte hier sind der Stand, mit dem BN4 gespielt wurde.
Wer sie in einem anderen BitNode wiederverwendet, muss die Multiplikatoren neu
nachschlagen — die Strategie folgt aus ihnen, nicht umgekehrt.

## Die Multiplikatoren dieses Knotens

Aus `BitNode.tsx:627-655`. Was nicht dasteht, ist 1.0.

| Größe | Wert | Folge |
|---|---|---|
| ServerMaxMoney × ScriptHackMoney | 0.1125 × 0.2 = **0.0225** | Hacking bringt 2,25 % des Normalertrags |
| CrimeMoney | 0.2 | Verbrechen ist 9× besser als Hacking |
| CompanyWorkMoney | 0.1 | Firmenarbeit als Geldquelle tot |
| HacknetNodeMoney | 0.05 | Hacknet tot |
| HackExpGain | 0.4 | Das Hacking-Level wächst 2,5× langsamer |
| FactionWorkRepGain | 0.75 | Reputation ist der Engpass |
| **CodingContract (Geld + Rep)** | **nicht gesetzt = 1.0** | **die einzige ungedämpfte Quelle** |
| **Infiltration** | **nicht gesetzt = 1.0** | ebenfalls ungedämpft, aber DOM-Aufwand |
| WorldDaemonDifficulty | 3 | `w0r1d_d43m0n` verlangt **9000**, nicht 3000 |

## Was in diesem Knoten NICHT gilt, obwohl es naheliegt

- **Favor überlebt den BitNode-Wechsel nicht.** `prestigeSourceFile()` ruft
  `setFavor(0)`. Der Spendenweg (ab Favor 150) ist zu Beginn gesperrt und muss
  über Aug-Installationen neu erarbeitet werden.
- **home-RAM und Kerne werden auf 32 GB / 1 Kern zurückgesetzt**
  (`Prestige.ts:243-249`) — anders als beim Augmentierungs-Einbau, den sie
  überleben.
- **`CompanyWorkRepGain` ist Firmen-Reputation, nicht Faktions-Reputation.**
  Augmentierungen kosten Faktions-Rep. Die 1.0 hilft nur für Einladungen.
- **Der Kampfstat-Zweig zu Daedalus ist wertlos.** `someCondition` ist zwar ein
  ODER, aber Hacking 9000 ist für den Endgegner ohnehin Pflicht — 4×1500
  Kampfwert wäre reine Zusatzarbeit.
- **`b1tflum3` vergibt kein Source-File** (`RedPill.tsx:64-67`, `isFlume`
  überspringt `giveSourceFile`). Als Abkürzung taugt es nicht.
- **Grafting, Sleeves und Stanek brauchen SF10 bzw. SF13** und sind ohne sie
  nicht verfügbar.

## Fallen, die Zeit gekostet haben

1. **Zielfilter `requiredHackingSkill > level/2`** ergibt bei Hacking 1 die
   Schwelle 0,5 — kein Ziel, keine Arbeiter, keine Erfahrung, das Level steigt
   nie. Perfekte Selbstblockade.
2. **`isBusy()` bleibt bei Verbrechen für immer `true`.** `CrimeWork.process()`
   gibt immer `false` zurück und wiederholt sich selbst, `Player.currentWork`
   bleibt gesetzt. Wer „wenn nicht beschäftigt, dann Verbrechen" schreibt,
   betritt den Block nach dem ersten Mal nie wieder.
3. **`ns.isRunning(datei, host)` vergleicht die Argumente mit.** Ein mit
   `--loop 300` gestartetes Skript wird nie gefunden. `ns.ps()` nehmen.
4. **`ns.exec(skript, host, threads, ziel, runde)`** — die Rundennummer landet
   im Argument, das die Arbeiter als Verzögerung lesen. Nach drei Monaten
   dreizehn Minuten Verzug pro Aktion.
5. **`nuke` verlangt kein Hacking-Level**, nur Ports. Ein Level-Filter beim
   Rooten lässt fremdes RAM brachliegen.
6. **`getScriptRam` gibt bei fehlender Datei still 0 zurück** →
   `Math.floor(frei/0) = Infinity` → Ausnahme → Skript tot. Immer `> 0` prüfen.
7. **Shoplift trainiert nur dex/agi.** Kraft und Verteidigung bleiben auf 1,
   damit ist Mug und Homicide dauerhaft schlechter. Der Bot steckt bei
   $1.500/s fest — ohne Gym kommt er nie höher.
8. **Verborgene Browser-Tabs laufen ~3–16× langsamer.** `wakelock.js` (19,5 kHz
   bei Verstärkung 0,0005) hebt das auf. Der Pegel ist entscheidend, nicht der
   Ton — 0,00002 wirkt nicht.

## Die Architektur, die sich bewährt hat

    bn4net.js    Netz: rooten, Arbeiter, Server kaufen, Werkzeuge betreiben
    bn4life.js   Spielfigur: Verbrechen, Faktionsbeitritte, Darkweb, Aufträge
    bn4rep.js    Reputation erarbeiten und Augmentierungen kaufen
    bn4door.js   Backdoors auf den Faktionsservern

Drei Regeln, die den Unterschied machen:

- **Genau eine Instanz steuert die Spielfigur.** `commitCrime` ersetzt laufende
  Arbeit kommentarlos; zwei Steuerungen vernichten sich gegenseitig. Wenn eine
  zweite nötig ist (hier `bn4rep.js`), regelt eine Datei den Vorrang
  (`data/rep-modus.txt`).
- **Die Hälften bewachen sich gegenseitig.** Fällt eine aus, ist ihr Speicher
  frei und die andere startet sie nach. Ein dritter Wächter bräuchte Platz, den
  ein 32-GB-home nicht hat.
- **Selbstbeender auf Zuruf** (`data/reload.txt` mit dem Skriptnamen). Die
  Fernschnittstelle kann nur Dateien schreiben — `pushFile` ruft
  `writeToContentFile` und sonst nichts, ein laufendes Skript behält sein
  geladenes Modul. Ohne diesen Griff braucht jede Codeänderung einen Menschen.

## Reihenfolge, die funktioniert hat

1. Verbrechen (Shoplift) finanziert TOR + BruteSSH
2. Erste Server rooten → Werkbank mit ≥20 GB
3. **`contracts.js` im Dauerbetrieb** — der eigentliche Hebel, $25–75m je Vertrag
4. Davon home ausbauen und Rechner kaufen
5. Backdoor auf CSEC (ab Hacking 51) → CyberSec
6. Ab hier zählt Reputation, nicht Geld: Faktionsarbeit statt Verbrechen

## Was die Rechnung über den ganzen Lauf sagt

Aus einer Skeptiker-Prüfung am 21.08.2026, am Quelltext belegt:

- **Der Deckel für den Hacking-Multiplikator liegt bei rund 25,2** — das
  Produkt aller 26 Augmentierungen im Spiel, die überhaupt ein `hacking:`-Feld
  haben. Damit braucht Level 9000 etwa **37 Millionen Hacking-Erfahrung**.
- **Der Weg ist zirkulär:** Die stärksten davon (QLink 1,75×, SPTN-97,
  nextSENS) kommen von Illuminati und Covenant — Faktionen, die erst *nach*
  Daedalus erreichbar sind. Daedalus wiederum verlangt 30 verschiedene
  Augmentierungen, $100 Mrd und Hacking 2500.
- **Nur 26 Augmentierungen haben einen `hacking`-Multiplikator, Daedalus will
  30 verschiedene.** Eine strikte „nur Hacking-Augs"-Regel läuft rechnerisch in
  eine Sackgasse — der Fallback auf die übrigen ist keine Nachlässigkeit,
  sondern notwendig.
- **NeuroFlux-Stapeln ist eine Falle.** Um +30 % Hacking nachzubilden, bräuchte
  es 26 Stufen am Stück, deren Preisfaktor 1,9²⁶ ≈ 2×10⁷ jede Einzel-Aug
  übersteigt.
- **Der Spendenweg ist der einzige, der die Preisspirale dauerhaft bricht.**
  Ab Favor 150 wird Geld direkt zu Reputation. Favor 150 verlangt 462.500
  kumulierte Reputation bei einer Faktion — nach dem ersten Einbau standen 18,6.
  Das sind grob 30 Einbau-Zyklen, aber jeder Zyklus wird schneller.
