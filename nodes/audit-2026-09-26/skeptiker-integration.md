# Skeptiker Integration (Pakete A + B + C zusammen) - Pruefung des Integrationsstands

Stand 27.09.2026, Cloud-Sitzung ohne Spiel. Geprueft: `claude/new-session-zf9ris`, Kopf
cd79c08 (Merge A ff8649b, B a606311, C cd79c08) gegen master 5e4c51c. Spielquelle
`reference/v301` (package.json 3.0.1, acorn fuer tools/ram.js) und `reference/bitburner-src`
(dev 3.0.2). Spielstaende aus `audit-input/backups` (BN1L3 00:23/00:39, BN5L2 15:12 bis 19:04).
Alle RAM-Zahlen mit `tools/ram.js` (SF4.3, nicht BN4) gerechnet, Startlagen mit einem
Wegwerfmodell auf `lib/reg.js auswahl` + Reservierungsregel des Kerns (dieselbe Regel wie
`tools/test-kaltstart-budget.js`), ergaenzt um das, was jener Test nicht kennt: boot.js startet
bn4life.js, bn4life.js startet joinrun.js und netburn.js auf home.

Gesucht wurde gezielt das, was keiner der drei Einzelpruefer sehen konnte: Wechselwirkungen
ueber Paketgrenzen.

---

## Befunde

### 1 SHOULD-FIX - joinrun haelt die Figur nur 15 Minuten, dann Ping-Pong mit bn4rep (A x C)

**Mechanik.** `joinrun.js` beantragt die Figur (C2, `PRIO.beitritt` 25) nur im Zweig
`if (!trainiertSchon)` (joinrun.js, Trainingsschleife). Laeuft das eigene Gym, wird der Antrag
nicht mehr erneuert: er verfaellt nach `ANTRAG_TTL_MS` 150 s (lib/figur.js), die Lease nach
`LEASE_MS` 15 min ab der letzten Erneuerung. `vergib()` gibt die Figur dann dem einzigen
geltenden Antrag - bn4rep (`faktion`, 30, jede Runde erneuert). bn4rep sieht `arbeitetSchon`
falsch (die Arbeit ist CLASS), `figFrei` wahr und ruft `workForFaction` - das beendet das Gym.
15 s spaeter beantragt joinrun wieder mit 25 und gewinnt. Genau das Ping-Pong, das
lib/figur.js verhindern soll, im 15-Minuten-Takt ueber die ganze 45-Minuten-Frist, je Wechsel
ein Kursneustart.

**Warum es keiner sah.** `tools/test-joinrun-ebene2.js` Abschnitt 3 lief 10 Ticks = 150 s, weit
unter der Lease. Der Schiedsrichter im Test liess bn4rep ausserdem nie HANDELN.

**Beleg.** Neuer Abschnitt 5 (90 Ticks = 22,5 min, bn4rep startet Faktionsarbeit, sobald es die
Figur hat): vorher 1 Uebernahme durch bn4rep, 2 Gym-Starts; danach 0 und 1.

**Fix 6fa8b61.** joinrun erneuert den Antrag, solange SEIN Kurs laeuft (`eigenesTraining`,
gesetzt nach erfolgreichem `gymWorkout`). Einen fremden Kurs (bbtrain, gym 40) beantragt es
weiterhin nicht (Abschnitt 6). RAM unveraendert 31,45 GB.

### 2 SHOULD-FIX - nach dem Sprung verdraengen joinrun+netburn den Rechnerkauf von home (C, vorbestehend, durch C vergroessert)

**Rechnung (home 128 GB mit SF9.3, SF4.3, 1.262 $ nach dem Sprung):**

| Schritt | GB | frei danach |
|---|---:|---:|
| guard.js | 6,10 | 121,90 |
| bn4net.js | 10,80 | 111,10 |
| bn4life.js (boot.js) | 23,85 | 87,25 |
| joinrun.js (bn4life, sofort) | 31,45 (master 26,35) | 55,80 |
| netburn.js (bn4life, sofort) | 26,75 | 29,05 |
| wakelock / cdump / sleevecrime / hashes | 2,25 / 12,65 / 7,65 / 5,95 | 0,55 (master 5,65) |
| **shop.js** (hostRule home, Prio 7) | 7,00 | **passt nicht**, reserviert; ausgang/sleeve/hacknet/homegrow warten |

`joinrun.js` trainiert aber erst ab 5 Mio (`Konto unter 5 Mio - kein Gym, warte`) - nach dem
Sprung also bis zu 45 min untaetig, mit netburn zusammen 58,2 GB auf home. shop.js ist der
einzige Preislieferant; ohne Preise schreibt der Kern keinen Kaufauftrag (bn4net.js, Kommentar
"OHNE DIESE REGEL WAERE ES EIN DEADLOCK"). Der Fall-off widerspricht der Absicht: ein
Geldquellen-Nachschub (Rechnerkauf) faellt hinter zwei Einmallaeufer, die nichts tun. Auf master
derselbe Ausgang (5,65 < 7), C2 hat die Luecke um 5,10 GB vergroessert (getBitNodeMultipliers 4 GB
+ getResetInfo 1 GB + ...), nicht erzeugt.

**Fix bcd8c0a.** bn4life startet joinrun/netburn erst ab demselben Geldboden (5e6). Die
Beitrittsmarke wird erst beim Start gesetzt - der Lauf entfaellt nicht, und seine 45-Minuten-Frist
geht nicht mehr mit Warten verloren. Nach dem Sprung laufen danach wakelock, cdump, sleevecrime,
hashes, shop, ausgang, sleeve, hacknet (5,30 GB Rest; homegrow 13,5 wartet). bn4life-RAM
unveraendert 5,85/18 (`geld` war schon gelesen). Neuer Test `tools/test-bn4life-beitritt.js`:
vorher 3/6 rot, danach 6/6.

Offen (nicht behoben): ab 5 Mio kommen die 58,2 GB trotzdem, und shop.js kann fuer die Dauer des
Trainings (<= 45 min) wieder draussen stehen, wenn home dann noch 128 GB hat. Das ist ein
Entwurfsfrage (joinrun auf einen anderen Wirt? netburn nur in BN9?), kein Merge-Befund.

### 3 SHOULD-FIX - der Werkzeugstarter des Kerns kann den Erfahrungsofen nicht raeumen (B gegen den Kern)

**Mechanik.** Bis Paket B lief der Ofen als Einwegwelle mit `expScript` (worker/weaken.js /
grow.js, beide in `WORKER`). Der Werkzeugstarter zaehlt raeumbaren Speicher mit
`arbeiterGbAuf` (nur `WORKER`) und raeumt mit drei festen Listen
(`["worker/share.js","worker/weaken.js","worker/grow.js","worker/hack.js"]`: Werkbank-Raeumung,
Ausweichweg gesperrter Wirt, Ausweichweg "passt nicht"). B hat den Ofen auf
`worker/expfarm.js` umgestellt - bewusst nicht in `WORKER` - und ausgang.js nachgezogen
(Einwand 6), den Kern selbst nicht. Haelt der Ofen die Werkbank (lange Aktion: nach einem Sprung
laut Bericht B bis Level ~612-654), galt jedes fehlende Werkzeug als
"passt auf werk-0 nie und findet auch sonst nirgends Platz".

**Beleg.** Neuer Test `tools/test-ofen-raeumung.js` gegen den echten bn4net.js im Mock
(werk-0 1024 GB, 580 Ofenfaeden = 1015 GB mit gueltiger Frist, home voll): vorher kein Ofenfaden
geraeumt, contracts.js nie gestartet, Kernprotokoll "contracts.js (17.6 GB) passt auf werk-0 nie";
danach geraeumt und gestartet.

**Fix b97595e.** Eine Reihenfolge `RAEUM_REIHENFOLGE` (share, Ofen, weaken, grow, hack) wie in
ausgang.js, in allen drei Raeumstellen und in `arbeiterGbAuf`. RAM bn4net.js 10,80 unveraendert.

### 4 MINOR - test-bruecke.js rot im Integrationsstand: Schnappschuss entstand nie, Quelle war master

**Rot:** "die Sicherung steht VOR der Uebertragung - Sicherung@10, Uebertragung@-1". Master: gruen.

**Ursache (belegt am Brueckenprotokoll):** "NICHT IN MASTER: lib/einbau.js steht weder im
Git-Index noch in hotswap-freigabe.txt" - Paket A hat die Datei neu angelegt. Gegenprobe:
einbau.js beiseite -> 96/96. Dahinter zwei Fehler im Testgeschirr: (1) der als "hermetisch"
beschriebene Schnappschuss (`MASTER_SNAPSHOT`) entstand nie - `tempDateien` war ~140 Zeilen
spaeter deklariert, der Zugriff warf in der temporalen Totzone ("Cannot access 'tempDateien'
before initialization"), der catch gab nur einen HINWEIS aus, jede Bruecke fragte doch
`git ls-tree master`, und je Lauf blieb eine `pruefstand/master-<pid>.txt` liegen; (2) die Quelle
war master statt des geprueften Baums.

**Fix 241a861.** Deklaration vor den Schnappschuss, Liste aus `src/` auf Platte. 96/96.

### 5 MINOR - zwei Kommentare zur Einbausperre widersprachen sich nach dem Merge (A x C4)

bn4rep.js behauptete, `handschlag` schreibe die Sperre LOKAL (Stand vor C4); lib/handschlag.js
behauptete, bn4rep ende bei `!hs.darf` per `return` (Stand vor A). Beide schreiben jetzt dieselbe
Datei nach home, im selben JSON (`{ts, reason, bis}`, 1 h) - doppelt, aber harmlos, und bn4rep
liest JSON mit `bis` korrekt (bn4rep.js Sperrblock). **Fix 3c076ad** (nur Kommentare).

### 6 MINOR - joinrun zahlt 4 GB fuer einen Blick in getBitNodeMultipliers (C)

joinrun.js 31,45 GB statt 26,35 (master): getBitNodeMultipliers 4,00 + getResetInfo 1,00 (+0,10
Kleinkram). `lib/bitnodes.json` traegt `DaedalusAugsRequirement` je Knoten und Stufe (BN12: 31)
und liesse sich fuer 0 GB lesen. **Nicht behoben:** nach Fix 2 laeuft joinrun erst ab 5 Mio, und
die 4 GB aendern an keiner der gerechneten Startlagen, wer Platz findet (nachgerechnet: shop.js
fehlen ohne Fix 2 so oder so 2,45 GB). Live-Wert statt Tabelle war eine bewusste Entscheidung aus
A3; ein Umbau hier waere Risiko ohne messbaren Nutzen.

### 7 MINOR (vorbestehend, Umgebung) - test-ram.js rot: Eichung traegt 76 statt >= 100 Zeilen

Master: ebenso rot, mit 79 Zeilen und zusaetzlich "Zeile veraltet unbemerkt" (34 Dateien). Der
Integrationsstand hat die Liste `VERALTET_ERLAUBT` nachgezogen (C, f0f4b88), die Zahl der
gueltigen Eichzeilen sank durch A/B/C um 3 (expfarm.js, ausgang.js, ...). Heilbar nur durch eine
Live-Nachmessung (`calculateRam` im Spiel) nach dem Einspielen - aus der Cloud nicht moeglich.
Die gerechneten Werte stimmen: `tools/ram.js --registry` "alle Werte stimmen" (25 Eintraege).

---

## Gehalten (gezielt gesucht, nichts gefunden)

- **A1 setFocus gegen joinrun/Figur.** setFocus steht nur im Zweig `arbeitetSchon` (laufende
  Faktionsarbeit FUER das eigene Ziel). Haelt joinrun die Figur, laeuft CLASS - kein setFocus.
  setFocus wechselt keine Handlung (`Singularity.ts:564-580`: startFocusing + Router), braucht
  also keinen eigenen Antrag. Graft/Bladeburner: `arbeit.factionName` fehlt -> kein setFocus.
- **A1 setFocus gegen DOM-Skripte.** Die Karenz zaehlt ab der ersten BEOBACHTUNG des
  Fokusverlusts; der Verlust liegt davor, also mindestens 30 s ab Verlust (`fokusEntscheidung`,
  lib/einbau.js). darkweb.js startet nach B3 nur ohne lebendes bn4life (2 min Schonfrist) und
  braucht laut Sleep-Summe deutlich unter 30 s. BitVerse-Seite: der Ausgang geht ueber
  `destroyW0r1dD43m0n` (exit.js), backdoor.js/bn4door.js meiden w0r1d_d43m0n - die Seite, die
  setFocus wegnavigieren koennte, entsteht im Bot nicht.
- **Share gegen Ofen.** share wird in Durchgang 1 VOR dem Ofen gelegt (bn4net.js, Durchgang 1;
  Ofen erst im Ueberschuss nach den Geldzielen) und laeuft endlos; der Ofen bekommt nur, was
  danach frei ist. Kurze Aktion: Ofen endet vor der naechsten Zaehlung, share sieht den Speicher
  sofort. Lange Aktion (nach Einbau ~41 s bei Level 10, Bericht B): share wartet hoechstens eine
  Ofenaktion. In allen 7 Spielstaenden mit Repmodus stand share auf exakt 12,00 % des Netzes
  (Deckel `SHARE_ANTEIL` 0,12; 00:23 8.647/8.647, 18:04 2.817/2.817, 19:03 4.661/4.662); 19:04
  (59 s nach Einbau) 0, weil noch kein Repmodus. Der 64-GB-Freiraum sitzt auf dem groessten
  Restplatz NACH share - kein Wettbewerb. ausgang.js raeumt share vor Ofen vor weaken/grow/hack
  (Verlustwert) - richtig, und nach Fix 3 raeumt der Kern in derselben Reihenfolge.
- **Guard-Frische gegen neue Wartezustaende.** bn4rep `freshnessMs` 1.800.000; Handschlag max
  90 s + 15 s Schlaf, `amTorWarten` schreibt frisch mit `state: "wait"`, das der Waechter als
  gesund zaehlt (guard.js, `state === "wait"`). hashes/hacknet, die sich per keine-hacknet.txt
  beenden, laufen nirgends und werden fuer S1 nicht ausgewertet (guard.js "WAS NIRGENDS LAEUFT").
- **C3 gegen den Kern.** bn4net filtert hashes.js UND hacknet.js ueber `keineHacknet`
  (bn4net.js, `fehlend`), trotz leerer Registry-Vorbedingung bei hacknet.js - kein Neustart-Takt.
- **Registry/ARCHITEKTUR 3.3.** `tools/ram.js --registry`: alle 25 Eintraege stimmen (bn4rep
  10,85+52,70 = 63,55 bei SF4.3, +0,30 gegen master; bn4life 5,85/18). Keine RAM-Aenderung durch
  die Fixes hier - Registry und 3.3 bleiben.
- **test-alles-Liste.** Jede tools/test-*.js steht genau einmal drin (Abgleich Datei gegen Liste),
  keine Dublette aus den drei Merges.
- **bn4rep auf einem 64-GB-Mietrechner.** 63,55 GB passt noch (0,45 GB Rest).

## RAM-Tabelle (SF4.3, nicht BN4; tools/ram.js)

home nach einem Einbau behaelt seinen Speicher (Prestige.ts prestigeAugmentation ruft kein
setMaxRam): in den Spielstaenden 16.384 bis 262.144 GB - dort passt alles. Kritisch ist nur der
Sprung: `Prestige.ts:245-251` setzt 128 GB (SF9 >= 2), 1 Kern, keine Mietrechner. Die Spalte
"nach Einbau" rechnet den schlechtesten Fall, einen Einbau, bevor home ausgebaut ist (128 GB,
Phase normal, Werkbank = home).

| Skript | Wirt | GB | nach Sprung 128 GB (mit Fixes) | nach Einbau, home 128 GB | nach Einbau, home >= 16 TB |
|---|---|---:|---|---|---|
| boot.js | home | 5,50 | ja (endet) | - | - |
| guard.js | home | 6,10 | ja | ja | ja |
| bn4net.js | home | 10,80 | ja | ja | ja |
| bn4life.js | home | 23,85 | ja | ja | ja |
| wakelock.js | home | 2,25 | ja | ja | ja |
| cdump.js | home | 12,65 | ja (kaltstart) | - | - |
| darkweb.js | home | 2,65 | nein, B3 (bn4life lebt) | nein, B3 | nein, B3 |
| sleevecrime.js | any | 7,65 | ja | - | - |
| hashes.js | not-hacknet | 5,95 | ja (SF9.3-Server lebt) | endet (C3, ausser BN9) | endet (C3) |
| shop.js | home | 7,00 | **ja (vorher nein)** | ja | ja |
| ausgang.js | any | 8,15 | ja | ja | ja |
| popups.js | home | 3,95 | - (normal) | ja | ja |
| sleeve.js | any | 27,85 | ja | ja | ja |
| hacknet.js | not-hacknet | 10,45 | ja | endet (C3, ausser BN9) | endet |
| homegrow.js | werkbank | 13,50 | nein (5,30 frei) | ja, sobald C3 hashes/hacknet frei gibt | ja |
| contracts.js | werkbank | 17,65 | - (normal) | ja (nach C3-Freigabe, 6,9 Rest) | ja |
| bn4rep.js | werkbank | 63,55 | nein | nein, bis Mietrechner >= 64 GB | ja |
| joinrun.js | home | 31,45 | erst ab 5 Mio (Fix 2) | erst ab 5 Mio | ja |
| netburn.js | home | 26,75 | erst ab 5 Mio (Fix 2) | erst ab 5 Mio | ja |
| worker/expfarm.js | not-hacknet | 1,75/Faden | Rest | Rest | Rest |
| worker/share.js | not-hacknet | 4,00/Faden | nur im Repmodus | 12 % Netz | 12 % Netz |
| keepalive.js | home | 54,25 | nicht automatisch (nur install.js/restart.js) | - | - |

Fall-off-Reihenfolge nach dem Sprung (mit Fix 2): Registry-Prioritaet 3..13, erster Ausfall
homegrow.js (Prio 13) - passt zur Absicht (Geldquellen und Aufsicht vor Komfort). Ohne Fix 2 war
es shop.js (Prio 7).

## Testzahlen (voller Lauf `node tools/test-alles.js`, nicht --schnell)

| Stand | Dateien | gruen | rot | rote Dateien |
|---|---:|---:|---:|---|
| master 5e4c51c (Kopie ohne .git, tools/ram.js mit C-Einstiegsfix) | 40 | 39 | 1 | test-ram.js (79 Eichzeilen + 34 "veraltet unbemerkt") |
| Integrationsstand cd79c08 vor diesen Fixes | 50 | 48 | 2 | test-ram.js (76 Eichzeilen, Befund 7), test-bruecke.js (95/96, Befund 4) |
| Endstand nach diesen Fixes | 52 | 51 | 1 | test-ram.js (76 Eichzeilen, Befund 7 - vorbestehend, braucht Live-Messung) |

Syntax (`tools/test-syntax.js`, von test-alles aufgerufen, acorn aus reference/v301):
140 von 140 gruen, vorher wie nachher. `tools/ram.js --registry`: alle Werte stimmen.
9 offene Messluecken wie auf master (brauchen das Spiel).

Commits: 6fa8b61 (Befund 1), bcd8c0a (2), b97595e (3), 3c076ad (5), 241a861 (4), dieser Bericht.
