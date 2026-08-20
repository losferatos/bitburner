# Auffaellige Werte im Spielstand — was wir liegen lassen

Gelesen am 20.08.2026 zwischen 07:35 und 08:20 UTC ueber `getSaveFile` auf der
Bruecke (Port 8795) plus `/api/state` und mehrere eigene Zeitmessungen am
laufenden Spiel. Kein Browser. Zeilenangaben beziehen sich auf
`reference/bitburner-src/src/`. Zwei Skeptiker-Durchlaeufe haben jede Zahl und
jede Rangfolge angegriffen; was hier steht, hat das ueberstanden oder ist
entsprechend korrigiert.

> **Der Stand bewegt sich waehrend des Lesens.** In den 45 Minuten dieser
> Untersuchung stieg das Hacking-Level von 444 auf 470, das Guthaben von 76,7
> auf 148,7 Mrd, der Bot-Speicher von 6,55 auf 15,73 PB, der home-Speicher von
> 16 auf 8192 GB, und die Augmentation-Warteschlange von 6 auf 13 (Punkt 2).
> Parallel hat eine andere Sitzung `src/stopnight.js` und `src/travel.js`
> geschrieben und Tian Di Hui beigetreten. Was sich **nicht** bewegt hat:
> Backdoors 3, ungeloeste Contracts 45 → 48, Sector-12 und Netburners immer
> noch nicht angenommen, Faktionsarbeit immer noch auf CyberSec.

---

## 0. Das Ziel ist weiter weg, als die Planung annimmt — und der Engpass ist Reputation

Drei Rechnungen, die zusammen die ganze Rangfolge bestimmen.

**Erstens: der Zielwert ist 3000, nicht 2500.** Hacking 2500 ist nur die
*Beitritts*bedingung fuer Daedalus (`Faction/FactionInfo.tsx:138-149`). Der
Server, der BitNode 1 beendet, verlangt mehr:
`w0r1d_d43m0n.requiredHackingSkill = 3000`, 5 offene Ports
(`Server/data/servers.ts:1549-1556`). Und er haengt ueberhaupt erst dann im
Netz, wenn **The Red Pill** installiert ist (`Prestige.ts:174-181`) — eine
Augmentation, die nichts kostet ausser **2.500.000 Daedalus-Reputation**
(`Augmentation/Augmentations.ts:1953-1960`, `repCost: 2.5e6`, `moneyCost: 0`).

Einen billigeren Ausgang gibt es nicht: `fl1ght.exe` (liegt auf home) ist eine
reine Checkliste ohne Seiteneffekt (`Programs/Programs.ts:339-368`, `create: null`),
`b1t_flum3` vergibt kein Source File (`RedPill.tsx:66-68`),
`ns.singularity.destroyW0r1dD43m0n` braucht SF4, Bladeburner ist in BN1
gesperrt. Es bleibt `backdoor w0r1d_d43m0n`.

**Zweitens: dorthin kommt man nur ueber Multiplikatoren.** Die Umrechnung ist
`level = floor(mult * (32 * ln(exp + 534,6) - 200))`
(`PersonObjects/formulas/skill.ts:13`). Der Erfahrungsbedarf waechst
exponentiell im Level; bei 20.000 exp/s braucht Level 600 rund 29 h, Level 700
rund 387 h, Level 1000 rund 800.000 h. (Die Rate schwankt stark: vier eigene
Messungen ergaben 3.400, 4.900, 16.200 und 45.200 exp/s. An der Aussage aendert
das nichts.)

Unser Multiplikator ist fast leer. Die 31 Eintraege in `mults` verteilen sich
auf ganze sieben verschiedene Werte:

| Wert | Anzahl | woher |
|---|---|---|
| 1,228784 | 1 | `hacking` |
| 1,203082 | 6 | alle `*_exp` — Neurotrainer I ×1,10 mal NeuroFlux |
| 1,160543 | 1 | `hacking_speed` |
| 1,148396 | 1 | `hacking_chance` |
| **1,093711** | **13** | **ausschliesslich NeuroFlux** |
| 1,000000 | 5 | `dnet_money`, vier `bladeburner_*` — unberuehrt |
| 0,914318 | 4 | `hacknet_node_*_cost` |

Die 1,093711 sind `(1,01 + 262/1e8)^9` — der NeuroFlux-Bonus je Level ist
`1,01 + Donations/1e6/100` (`Augmentations.ts:8`, `Constants.ts:107`), nicht
glatt 1,01. **13 von 31 Multiplikatoren haben wir also nie angefasst; sie
stehen genau dort, wo neun NeuroFlux-Stufen sie hingestellt haben.**

Was die erreichbaren Augmentations liefern:

| Aug-Quelle | Hacking-Mult | exp fuer Level 2500 | Zeit bei 20k exp/s |
|---|---|---|---|
| CyberSec + NiteSec + The Black Hand | 1,91 | 3,2e20 | unmoeglich |
| dieselben + NeuroFlux Lv 60 | 3,46 | 3,2e12 | 45.000 h |
| **plus BitRunners** | 4,50 | 1,8e10 | 255 h |
| plus BitRunners + NeuroFlux Lv 25 | 5,76 | 4,0e8 | **5,5 h** |

**Ohne die fuenf Hacking-Augmentations von BitRunners** (Neural Accelerator
1,10, Artificial Bio-neural Network 1,12, Neurolink 1,15, Cranial Signal
Processors Gen V 1,30, ENM Core V2 1,28) ist selbst 2500 unerreichbar. Fuer
3000 braucht es entsprechend mehr — also mehrere Reset-Runden mit
NeuroFlux-Aufbau obendrauf.

**Drittens, und das ist die eigentliche Zahl: Reputation.** Um das Angebot
jeder Faktion freizuschalten, braucht es so viel Rep wie ihre teuerste
Augmentation verlangt:

| Faktion | noetige Rep | Arbeitszeit bei 3,93 Rep/s |
|---|---|---|
| Netburners | 12.500 | 0,9 h |
| Sector-12 | 50.000 | 3,5 h |
| Tian Di Hui | 75.000 | 5,3 h |
| NiteSec | 112.500 | 8,0 h |
| The Black Hand | 175.000 | 12,4 h |
| BitRunners | 1.000.000 | 71 h |
| **Daedalus (The Red Pill)** | **2.500.000** | **177 h** |
| **Summe** | **3.925.000** | **278 h** |

Man kann nur fuer **eine** Faktion gleichzeitig arbeiten. 278 Stunden ist die
Zahl, an der sich jeder Vorschlag messen lassen muss — und The Red Pill allein
ist mehr als die Haelfte davon.

**Viertens, der Ausweg: Geld kauft Reputation.** `repFromDonation` ist
`Betrag / 1e6 * mults.faction_rep` (`Faction/formulas/donation.ts:8-10`,
`Constants.ts:33`). Bei `faction_rep` 1,0937 sind das **1.094 Rep je
Milliarde**. Die kompletten 3.925.000 Rep kosten damit **3,59 Bio $**.

Und jetzt der Vergleich, der den Rest des Berichts ordnet: der Bot verdient
gemessen **164,8 Mio $/s** und gibt davon **164,2 Mio $/s** fuer Speicher aus
(300-Sekunden-Fenster, 08:03:30 bis 08:08:30). **Die gesamte Reputation des
ganzen BitNode-Durchlaufs — 278 Stunden Arbeit — kostet 6 Stunden des Geldes,
das gerade in ungenutzten Speicher fliesst.**

Der Haken: Spenden sind erst ab Favor 150 frei (`Constants.ts:31`,
`donation.ts:16-18`), und Favor 150 entspricht 462.490 kumulierten Rep je
Faktion (`Faction/formulas/favor.ts:12-15`) — allerdings ueber Resets hinweg
kumulierend (`Faction/Faction.ts:74-82`).

**Daraus folgt die Rangfolge:** Solange Favor unter 150 liegt, ist
Reputationsrate alles und Geld fast nichts. Sobald Favor 150 steht, kippt es
vollstaendig um. Alles, was heute Geld in Dinge steckt, die weder Rep noch
Augmentations sind, ist doppelt verloren.

---

## 1. 99 Prozent des Einkommens gehen in Speicher, der zu 60 Prozent leersteht

**Beobachtung.** `moneySourceA` seit dem letzten Reset (10,1 h):

| Posten | Betrag |
|---|---|
| hacking | **+1.116,27 Mrd $** |
| servers | **−918,99 Mrd $** (82 %) |
| augmentations | −48,31 Mrd $ (Punkt 2) |
| hacknet | +0,01 Mrd $ |
| other | −0,31 Mrd $ |
| **Bestand** | **148,66 Mrd $** |

Ueber 300 s gemessen: Einnahmen 164,8 Mio $/s, Serverausgaben 164,2 Mio $/s,
**netto 0,6 Mio $/s**.

Wofuer? Telemetrie: **40,5 % des Netzspeichers belegt**, 9,36 PB frei bei
16 PB Gesamtausbau. Diese Quote ist stabil — eine Dreiviertelstunde vorher, bei
7,08 PB, waren es 41,3 %. Der Bot kauft Speicher genau so schnell, wie er ihn
liegen laesst, und meldet es in seinem eigenen Protokoll: "9362307 GB frei -
entweder passt kein weiterer Auftrag hinein, oder der Rest liegt in zu kleinen
Stuecken."

**Ursache, exakt lokalisiert.** `src/invest.js:110` rechnet
`money = max(0, cash − reserve − hold)` und setzt alles davon in Speicher um
(`:116-145`). Ob der Speicher gebraucht wird, kommt darin nicht vor. Der
Rueckhalt ist `max(10 % des Guthabens, 60 s Einkommen)` (`:109`) — bei
164,8 Mio $/s sind das 9,9 Mrd, also nichts. Die Sperrkasse steht bei 60 Mrd
(`data/reserve.txt`) und wird bei 148,7 Mrd muehelos uebersprungen. Der
Kommentar in `src/autopilot.js:139-141` benennt ihren Zweck woertlich: "das
Sparbuch fuer alles, was kein Skript kaufen kann (Augmentierungen, Portknacker,
Reisen)". Es wird nur nie benutzt.

**Hebel.** Speicher ist nicht der Engpass — die Zahl der Ziele ist es. Bei
Hacking 470 sind 23 der 63 Server mit Geld hackbar (zusammen 57,4 Mrd
`moneyMax`); 40 Server mit 6,89 Bio $ liegen ueber unserem Level. Mehr RAM
kauft davon nichts. Dieselben 919 Mrd $ haetten dagegen — sobald Favor 150
steht — **die komplette Reputation aller Faktionen ausser Daedalus und
BitRunners gekauft, mit Rest** (Punkt 0).

**Aufwand: ein Kommandozeilenaufruf.** `node tools/reserve.js <Betrag>`; das
Werkzeug existiert und ist genau dafuer dokumentiert (`tools/reserve.js:1-15`).
Fallstrick: `RESERVE_FLOOR = 200e3` (`src/autopilot.js:151`) — unter 200.000 $
Guthaben wird die Sperre ignoriert, was nach einem Reset richtig ist. Besser
als eine Zahl von aussen waere eine Auslastungsschwelle in `invest.js`: kein
Speicherkauf, solange die Belegung unter etwa 70 % liegt.

**Urteil: sofort machen. Billigste Massnahme im ganzen Bericht.**

**Nachtrag, gleiche Ursache: home-Kerne.** `data/homeram.txt` zeigt
`homeram.js` mit `Ziel 8192 GB / 4 Kerne` und 95,3 Mrd Ausgabedeckel; der
zweite Kern ist inzwischen gekauft. RAM ist richtig — 8192 GB kosten kumuliert
46,4 Mrd und ueberleben den Reset (`prestigeHomeComputer` in
`Server/ServerHelpers.ts` ruehrt `maxRam` nicht an). **Die Kerne sind es
nicht.** `1e9 * 7,5^cores` (`PersonObjects/Player/PlayerObjectServerMethods.ts:42-44`):
Kern 2 7,5 Mrd, Kern 3 56,25 Mrd, Kern 4 421,9 Mrd — zusammen **485,6 Mrd $**.
Der Nutzen ist `1 + (cores−1)/16` (`Server/ServerHelpers.ts`, `getCoreBonus`)
und gilt nur fuer Skripte, die auf **diesem** Rechner laufen:
`NetscriptFunctions.ts:288,359,388` uebergeben durchweg `scripthost.cpuCores`.
Unsere Arbeiter laufen auf 25 Bots mit je einem Kern. **Kerne-Ziel auf 0.**

---

## 2. 13 NeuroFlux in der Warteschlange verteuern jede echte Augmentation um Faktor 4.205

**Beobachtung.** `queuedAugmentations` enthaelt NeuroFlux Governor Level 10 bis
22 — **dreizehn** Kaeufe fuer zusammen 48,31 Mrd $. Um 07:35 waren es sechs fuer
214 Mio $.

Der Preis jeder Augmentation ist
`baseCost * getGenericAugmentationPriceMultiplier() * currentNodeMults.AugmentationMoneyCost`
(`Augmentation/AugmentationHelpers.ts:157-158`), und der Multiplikator ist
`1,9 ^ (Anzahl Eintraege in der Warteschlange)` (`:29-37`, `Constants.ts:41`;
ohne SF11 exakt 1,9, in BitNode 1 kommt nichts hinzu —
`BitNode/BitNode.tsx:564-567`, `BitNodeMultipliers.ts:13,16`). NeuroFlux zaehlt
mit; ausgenommen sind nur SoA-Augmentations (`:33-35`). Die Rep-Anforderung
steigt **nicht** mit, nur der Geldpreis.

| Zeitpunkt | Warteschlange | Faktor 1,9^q | kaufbare verschiedene Augs bei 148,7 Mrd |
|---|---|---|---|
| 07:35 | 6 | 47 | 9 |
| **08:20** | **13** | **4.205** | **3** |
| nach einem Install | 0 | 1 | **15** |

Einzelpreise beim jetzigen Faktor: Wired Reflexes (Basis 2,5 Mio) 10,5 Mrd;
**BitWire (Basis 10 Mio, +5 % Hacking) 42,1 Mrd**; S.N.A. (Basis 30 Mio,
+15 % `faction_rep`) 126,2 Mrd; CashRoot 525,7 Mrd; Neuralstimulator 12,6 Bio.

Und die Pointe: **der naechste NeuroFlux kostet 56,3 Mrd $ fuer +1 % auf
alles** (`AugmentationHelpers.ts:132-137`: `1,14^level` mal `1,9^13`,
`Constants.ts:37`). BitWire kostet 42,1 Mrd fuer +5 % Hacking **und** einen der
30 Daedalus-Plaetze. Der Automat hat das Teurere mit der schlechteren Wirkung
gekauft, dreizehn Mal.

**Ursache — und sie ist bereits gefunden.** Nicht der Autopilot war es:
`grep purchaseAugmentation|installAugmentations src/*.js` findet nichts. Es war
der Seitenagent `nightshift/agent.js`, und die Rueckkopplung steht seit heute
09:50 im Kopf von `src/stopnight.js`: BitWire ist zu teuer → der Knopf steht auf
`disabled` → `offeneAugs()` meldet "nichts offen" → der Agent weicht auf
NeuroFlux aus → jeder Kauf verteuert BitWire um 90 % → und so weiter.
`data/stopnight.txt` bestaetigt, dass der Nachtdienst stillgelegt ist; die
Warteschlange steht seit 08:02 stabil bei 13. **Die Blutung ist gestoppt, der
Schaden bleibt.**

**Was NeuroFlux wirklich wert ist.** Nicht nichts: +1 % auf `hacking` **und**
`faction_rep` je Stufe, unbegrenzt stapelbar (`Augmentations.ts:1170-1196`), und
Punkt 0 zeigt, dass NeuroFlux Lv 25 zusammen mit den BitRunners-Augs den
Unterschied zwischen 255 h und 5,5 h ausmacht. Falsch war nicht der Kauf,
falsch war die **Reihenfolge**. NeuroFlux hat bei Level 22 einen Basispreis von
750e3 · 1,14^22 = 13,4 Mio $ und sortiert sich damit von selbst ans Ende jeder
absteigend nach Basispreis sortierten Kaufliste.

**Urteil: die Kaufregel gehoert in den Automaten, nicht in einen Seitenagenten.**
"Echte Augmentations absteigend nach Basispreis, NeuroFlux zuletzt, dann sofort
installieren." Und siehe Punkt 3: bei Faktor 4.205 ist diese Runde als
Kaufrunde vorbei.

---

## 3. Die Reset-Kadenz fehlt vollstaendig — und sie ist der groesste Geldhebel im Spiel

**Beobachtung.** Der Automat hat keine Reset-Logik: kein `purchaseAugmentation`,
kein `installAugmentations`, keine Regel, wann eine Runde endet.
`tools/plan.js` empfiehlt "N Augmentations warten - ein Reset lohnt sich" und
zaehlt dabei die **Warteschlangenlaenge**, nicht die Zahl **verschiedener**
Augmentations. Bei 13 NeuroFlux meldet es 13, obwohl es fuer Daedalus ein
einziger Eintrag ist: `haveAugmentations(n)` prueft
`p.augmentations.length >= n` (`Faction/FactionJoinCondition.ts:121-131`), und
NeuroFlux steht dort als ein Eintrag mit Level-Feld
(`Augmentation/Augmentation.ts:238-246`).

**Hebel.** Weil der Preisfaktor `1,9^i` **innerhalb** einer Runde waechst und
beim Install auf 1 zurueckfaellt, ist die Rundenzahl der eigentliche
Kostenhebel. Dieselben 30 erreichbaren Augmentations, aufgeteilt:

| Runden | Augs je Runde | Geldkosten gesamt | + Wiederaufbau (5,58 h je Runde) |
|---|---|---|---|
| 1 | 30 | 1.223.027 Mrd $ | 5,6 h |
| 2 | 15 | 2.168 Mrd $ | 11,2 h |
| **3** | **10** | **265 Mrd $** | **16,7 h** |
| 4 | 8 | 77 Mrd $ | 22,3 h |
| 6 | 5 | 40 Mrd $ | 33,5 h |

Die 5,58 h sind gemessen, nicht geschaetzt: `lastNodeReset` 19.08. 16:35 UTC,
`lastAugReset` 22:10 UTC — so lange dauerte die erste Runde von absolut null
(Hacking 1, nur NUKE, kein TOR) bis zur Installation. Bei 164,8 Mio $/s sind
265 Mrd $ **27 Minuten Einkommen**; 2.168 Mrd sind 3,7 Stunden. Der Sweet Spot
liegt bei **zwei bis drei Runden zu je 10 bis 15 verschiedenen
Augmentations** — Geld faellt superlinear, Wiederaufbauzeit steigt linear.

Wichtig fuer die Ehrlichkeit dieser Rechnung: **Reputation muss in jeder Runde
neu erarbeitet werden** (`playerReputation = 0` beim Reset), nur Favor bleibt.
Mehr Runden heissen also mehr Rep-Arbeit — genau der Posten, der laut Punkt 0
ohnehin der Engpass ist. Deshalb nicht sechs Runden, sondern zwei bis drei.

**Konkret fuer jetzt.** Bei Faktor 4.205 sind noch drei Augmentations
bezahlbar, und bei Tian Di Hui (heute beigetreten, Rep 0) faengt die guenstigste
erst bei 2.500 Rep an. Diese Runde ist als Kaufrunde vorbei. **Sinnvoll ist,
den Rest der Runde nur noch als Rep- und Favor-Runde zu fahren und dann zu
installieren** — mit der Kaufregel aus Punkt 2 im Automaten, damit sich der
Vorfall nicht wiederholt.

**Was der Reset kostet** (`Prestige.ts`,
`PersonObjects/Player/PlayerObjectGeneralMethods.ts`, `prestigeAugmentation`):
25 Rechner mit 15,73 PB (Wiederbeschaffung 919 Mrd $ — die aber ohnehin zu
60 % leerstehen, Punkt 1); alle Programme ausser NUKE
(`Server/ServerHelpers.ts`, `prestigeHomeComputer`; Nachkauf 314 Mio $ laut
`DarkWeb/DarkWebItems.ts:6-14`, deckt sich exakt mit `moneySourceA.other` =
−314,2 Mio); Hacking zurueck auf 1; Geld auf 1.262 $ (1000 + `Donations` 262);
`hacknetNodes`, `factions` und `factionInvitations` geleert; `Go.nodePower`
geloescht; das Netz neu gebaut, also die 48 Contracts weg (Punkt 6).
**Behalten:** `home.maxRam` (8192 GB), Favor, die installierten Augmentations.

**Urteil: Reset-Regel bauen — "installieren, sobald 10 bis 15 verschiedene
Augmentations im Korb sind" — und diese Runde bald beenden.**

---

## 4. Vier Faktionen liegen ungenutzt herum

**Beobachtung.** `PlayerSave.factions = ["Tian Di Hui", "CyberSec"]`. Aus
CyberSecs Angebot besitzen wir alles bis auf BitWire; Tian Di Hui ist seit einer
Viertelstunde dabei und hat Rep 0. Gleichzeitig stehen in
`factionInvitations` seit Stunden `["Sector-12", "Netburners", "Chongqing"]` —
erhaltene, nie angenommene Einladungen. Zwei weitere Faktionen haengen an je
einem Backdoor:

| Faktion | Bedingung | Beleg | Ist-Zustand |
|---|---|---|---|
| Sector-12 | in Sector-12, 15 Mio $ | `FactionInfo.tsx:537-546` | **Einladung liegt vor** |
| Netburners | Hacking 80, Hacknet 8 RAM / 4 Kerne / 100 Level | `FactionInfo.tsx:672-678` | **Einladung liegt vor** (ist: 8 / 4 / 201) |
| NiteSec | Backdoor auf `avmnite-02h` | `FactionInfo.tsx:464-466` | gerootet, req 211, `hackDifficulty` 1, **kein Backdoor** |
| The Black Hand | Backdoor auf `I.I.I.I` | `FactionInfo.tsx:419` | gerootet, req 362, `hackDifficulty` 1, **kein Backdoor** |

Ein Backdoor kostet `calculateHackingTime(server, player) / 4`
(`Terminal/commands/backdoor.ts:55`), eingesetzt in `Hacking.ts:60-80`:
**`avmnite-02h` 2,1 s, `I.I.I.I` 2,9 s.** Beide Server stehen laut Spielstand
tatsaechlich auf `hackDifficulty` 1, die Rechnung ist also nicht geschoent.
Danach ruft der Befehl selbst
`Engine.Counters.checkFactionInvitations = 0; Engine.checkCounters()`
(`backdoor.ts:65-66`) — die Einladung kommt sofort. Von 95 gerooteten Servern
haben genau **drei** einen Backdoor: `CSEC`, `nectar-net`, `harakiri-sushi`.

**Hebel.** Kumulativ verschiedene Aug-Eintraege, ausgehend von den 5 besessenen:

| nach Beitritt zu | bietet | davon neu | kumuliert |
|---|---|---|---|
| CyberSec (Ist) | 5 | 1 | 6 |
| Tian Di Hui (Ist) | 8 | 6 | 12 |
| Sector-12 | 6 | 6 | 18 |
| Netburners | 5 | 5 | 23 |
| NiteSec | 10 | 6 | 29 |
| The Black Hand | 10 | 5 | **34** |
| BitRunners | 13 | 6 | **40** |

Ohne die vier offenen Faktionen kommen wir auf 12 — die Daedalus-Schwelle von
30 ist dann arithmetisch unerreichbar.

**Die technische Frage ist beantwortet.** `Faction/ui/FactionsRoot.tsx:88-94`
prueft `event.isTrusted`, aber der in `doku/join-problem.md` hergeleitete Weg
ueber die React-Props des Knopfes **traegt in der Praxis** — Tian Di Hui wurde
heute genau so beigetreten, und `src/travel.js` hat dafuer sogar die Reise nach
Chongqing erledigt. Damit entfaellt der Vorbehalt aus der ersten Fassung dieses
Berichts. (Falls es doch einmal klemmt: vier Klicks von Eric je Runde, zehn
Sekunden Menschenzeit, null Entwicklungsrisiko.)

**Reihenfolge.** Sector-12 sperrt Chongqing, New Tokyo, Ishima und Volhaven als
Feinde (`FactionInfo.tsx:540`, Sperrlogik `FactionHelpers.tsx:44-47`). Die
offene Chongqing-Einladung und Sector-12 schliessen sich also aus — Sector-12
ist die bessere Wahl (6 neue Augs gegen wenige). Tian Di Hui und Aevum bleiben
in beiden Faellen erlaubt.

**Urteil: machen, sobald Punkt 1 und 2 stehen — aber nur, wenn in dieser Runde
noch gekauft wird.** Beim Install werden `factions` und `factionInvitations`
ohnehin geleert; ein Beitritt kurz vor dem Reset ist verschenkte Zeit. Was
bleibt, ist Favor — und der entsteht nur aus Rep, die man auch erarbeitet hat.

---

## 5. Die Faktionsarbeit laeuft ohne Fokus in eine Faktion, in der Rep wertlos ist

Zwei Fehler auf einmal, beide in `currentWork`.

**Erstens: falsches Ziel.** `currentWork` ist `FactionWork` auf CyberSec,
`cyclesWorked: 43.060` — bei 200 ms je Zyklus (`Constants.ts:19`) **2 h 24 min
am Stueck**. CyberSec-Rep steht bei 31.334. Die teuerste CyberSec-Augmentation
kostet 18.750 Rep (`Augmentations.ts:430-443`) und die besitzen wir; offen ist
nur BitWire mit 3.750 (`:181-189`). Der Bedarf ist um Faktor 8,4
uebererfuellt.

Wertlos ist es nicht ganz: Rep wird beim Reset in Favor umgerechnet
(`Faction/Faction.ts:74-82`, `Faction/formulas/favor.ts:12-24`), und Favor 150
schaltet die Spenden aus Punkt 0 frei. CyberSec-Favor 28,3647 entspricht 18.841
Rep; plus 31.334 aktuelle Rep ergibt **Favor 53,6** nach dem Reset. Aber
CyberSec ist die Faktion, bei der wir Favor am **wenigsten** brauchen — ihr
Angebot ist erschoepft. Dieselbe Zeit bei Tian Di Hui (Rep 0, sechs offene
Augmentations, darunter beide Rep-Multiplikatoren) waere unmittelbar
produktiv.

**Zweitens: kein Fokus.** `PlayerSave.focus` steht auf `false`. Damit greift
`focusPenalty()` (`PersonObjects/Player/PlayerObjectGeneralMethods.ts:622-628`)
und multipliziert die Rep-Rate mit `CONSTANTS.BaseFocusBonus = 0,8`
(`Constants.ts:87`); `FactionWork.getReputationRate()` nimmt den Faktor
woertlich mit (`Work/FactionWork.tsx:38-39`). **Wir verschenken dauerhaft
20 Prozent Reputation** — auf 278 Stunden gerechnet sind das 56 Stunden.

Nachgerechnet und zweifach gemessen. `getHackingWorkRepGain`
(`PersonObjects/formulas/reputation.ts:16-24`) ist
`(hacking + int/3) / 975 * mults.faction_rep * intBonus * (1 + favor/100) * shareBonus`
mit `MaxSkillLevel = 975` (`Constants.ts:16`). Ohne Strafe ergibt das 1,056 je
Zyklus; gemessen wurden **0,8445 je Zyklus** (300 Zyklen in 60 s) — Verhaeltnis
0,7995. Ein zweites, unabhaengiges 300-Sekunden-Fenster ergab **4,24 Rep/s**
gegen rechnerisch 4,11. Die Formel traegt, und die Fokus-Strafe ist real.

Rep-Rate nach den verfuegbaren Multiplikatoren (Hacking 470, Share-Bonus 1,54):

| Zustand | Rep/s | 1 Mio Rep (BitRunners) | 2,5 Mio Rep (Red Pill) |
|---|---|---|---|
| frisch beigetretene Faktion, ohne Fokus | 3,06 | 91 h | 227 h |
| heute bei CyberSec (Favor 28, ohne Fokus) | 3,93 | 71 h | 177 h |
| mit Fokus | 4,91 | 57 h | 141 h |
| Fokus + S.N.A. + ADR-V1 (Punkt 4) | 6,22 | 45 h | 112 h |
| dazu Favor 150 | 12,10 | 23 h | 57 h — **und ab hier sind Spenden frei** |

**Aufwand.** Das Arbeitsziel umzustellen ist eine Zeile. Der Fokus ist ein
Zielkonflikt, keine reine Verbesserung: mit `focus = true` steht die
Oberflaeche auf `Page.Work`, und diese Seite hat keine Seitenleiste
(`ui/GameRoot.tsx:309-334`), also auch keine Alt-Tasten — der Fallstrick aus
`doku/join-problem.md` Abschnitt 8. Der Ausweg ist Terminplanung: fokussiert
arbeiten, kurz entfokussieren, wenn geklickt werden muss. Dauerhaft geloest
wird es vom **Neuroreceptor Management Program** (Tian Di Hui, 75.000 Rep,
Basispreis 550 Mio), das die Strafe aufhebt
(`Augmentations.ts:1230-1241`, `PlayerObjectGeneralMethods.ts:624`).

**Urteil: Arbeitsziel sofort auf Tian Di Hui umstellen. Fokus einschalten,
sobald der Klickbedarf planbar ist.**

---

## 6. Tian Di Hui ist die einzige Quelle fuer Reputationsmultiplikatoren — und sie ist gerade erreichbar geworden

**Beobachtung.** Tian Di Hui ist seit 08:16 beigetreten, Rep 0. Von allen
Augmentations mit `faction_rep` liegen die uebrigen bei Faktionen, die wir in
BitNode 1 nicht erreichen (ADR-V2 bei Silhouette / Four Sigma / B&A / Clarke,
SmartJaw bei B&A, Shadow's Simulacrum bei The Syndicate). Bei Tian Di Hui
dagegen:

| Aug | Wirkung | Rep | Basispreis | Beleg |
|---|---|---|---|---|
| ADR-V1 Pheromone Gene | `faction_rep` ×1,10 | 3.750 | 17,5 Mio | `Augmentations.ts:13-29` |
| S.N.A. | `faction_rep` ×1,15 | 6.250 | 30 Mio | `Augmentations.ts:1484-1494` |
| Neuroreceptor Management Program | hebt die Fokus-Strafe auf (Punkt 5) | 75.000 | 550 Mio | `Augmentations.ts:1230-1241` |

Die ersten beiden zusammen sind ×1,265 auf die Rep-Rate. Bei 278 Stunden
Rep-Bedarf (Punkt 0) sind das **59 gesparte Stunden** — fuer 3.750 und 6.250
Rep und Basispreise, die in jeder Runde mit leerer Warteschlange lachhaft
guenstig sind. Mit dem Neuroreceptor-Programm zusammen sind es ×1,58 gegenueber
heute.

Rep-Bedarf bis S.N.A.: 6.250 bei 3,06 Rep/s (Favor 0, ohne Fokus) = **34
Minuten**.

**Urteil: das erste Rep-Ziel jeder Runde, vor allen anderen Faktionen.** Es
verbilligt alle nachfolgenden Faktionen um ein Viertel.

---

## 7. 48 ungeloeste Coding Contracts liegen im Netz und gehen beim Reset verloren

**Beobachtung.** Auf 33 Servern liegen **48 Contracts**, alle mit `tries: 0`.
Alle haben Schwierigkeit 1 — kein Zufall, sondern die Obergrenze
`maxDif = 2 * Summe der Source-File-Level + 1` bei der Erzeugung
(`CodingContract/ContractGenerator.ts:82-83`). Es sind nur **fuenf Typen**:
Total Ways to Sum 13x, Subarray with Maximum Sum 12x, Find Largest Prime Factor
9x, Algorithmic Stock Trader I 8x, Encryption I: Caesar Cipher 6x.

**Hebel — kleiner als er aussieht.** Der Belohnungstyp wird gleichverteilt aus
vier Typen gezogen (`ContractGenerator.ts:179-190`). Entscheidend ist ein
Detail, das man leicht ueberliest: faellt `CompanyReputation` mangels Job
zurueck, wird `adjustedScaling` als neues `rewardScaling` weitergereicht und
damit **ein zweites Mal durch 3 geteilt**
(`PersonObjects/Player/PlayerObjectGeneralMethods.ts:541-551`) — 277,8 Rep statt
833. Und `FactionReputationAll` **teilt** denselben Gesamtbetrag auf alle
Faktionen auf, statt ihn zu vervielfachen (`:530-534`).

Erwartungswert je Contract: **486 Rep** (nicht 625). Fuer 48 Contracts also
**23.300 Rep** und 300 Mio $. Bei sechs Faktionen, von denen fuenf Rep
brauchen, sind davon rund **19.400 nutzbar** — das entspricht **82 Minuten**
Faktionsarbeit. Der Geldanteil ist bei 164,8 Mio $/s zwei Sekunden Einkommen,
also irrelevant.

**Und die Rep laesst sich nicht lenken.** `FactionReputation` trifft eine
**zufaellige** beigetretene Hacking-Faktion (`:515-521`),
`FactionReputationAll` giesst gleichmaessig ueber alle. Gezielt auf Tian Di Hui
oder BitRunners zu sammeln geht nicht.

**Aufwand.** `ns.codingcontract.*` haengt ohne SF-Pruefung im ns-Objekt
(`NetscriptFunctions.ts:156`), RAM 20 GB
(`Netscript/RamCostGenerator.ts:387-396`), 10 Versuche je Contract (Algorithmic
Stock Trader I nur 5, `contracts/AlgorithmicStockTrader.ts:35`), Formatfehler
kosten keinen Versuch (`NetscriptFunctions/CodingContract.ts:33-36`). Fuenf
Loeser zu schreiben und zu testen sind zwei bis vier Entwicklerstunden — mit
drei bekannten Fallen: Subarray with Maximum Sum verlangt mindestens ein
Element (bei lauter negativen Zahlen ist 0 falsch), Total Ways to Sum hat eine
Off-by-one, und Encryption I ist als einziger ein **String**, waehrend die
anderen vier Zahlen erwarten.

Nachschub ist mager: drei Erzeugungsversuche je 10 Minuten mit ~25 %
Trefferchance (`engine.tsx:151,204-207`, `ContractGenerator.ts:64`) — rund
2.190 Rep/h, ein Fuenftel der Arbeitsrate.

**Urteil: lohnt, aber nicht dringend.** Zwei bis vier Entwicklerstunden fuer
82 Minuten gesparte Spielzeit je Runde — es amortisiert sich erst ueber
mehrere Runden, weil nach jedem Reset ein neuer Vorrat entsteht. **Rang 7, nicht
Rang 3.** Ausfuehren erst, wenn mehrere Faktionen beigetreten sind, sonst
verpufft die Rep in CyberSec.

---

## 8. Der Autopilot rechnet in Runden statt in Sekunden — und fuellt seine Pipeline zu einem Fuenfzigstel

**Beobachtung.** Die Telemetrie meldet `batching.expectedPerSec` zwischen
774 Mio und 1,8 Mrd $/s, gemessen werden 164,8 Mio $/s — Faktor 5 bis 11
daneben. Die Ursache ist ein Einheitenfehler im eigenen Code:
`src/autopilot.js:1119-1122` schreibt woertlich *"Eine Runde dauert rund eine
Sekunde, also ist der Mittelwert je Runde zugleich der erwartete Ertrag je
Sekunde"* — und teilt `moneyPlanned` genau danach. Eine Runde dauert
tatsaechlich **rund acht Sekunden** (drei unabhaengige Messungen ueber Telemetrie-
und Rundenzaehler).

Der zweite Teil wiegt schwerer. `LEAD_MS = 1200` gegen `4 * GAP_MS = 1600`
(`src/autopilot.js:214,222`) bedeutet, dass je Runde und Ziel rechnerisch
**genau ein** Stapel in den Kalender passt — die Telemetrie zeigt es
buchstaeblich: "15 Ziel(e) im Stapelbetrieb (15 neue Stapel diese Runde)". Der
Kalender eines Ziels traegt aber `tWeaken / (4 · GAP_MS)` Stapel; bei
`phantasy` sind das 47. Die Pipeline ist zu etwa einem Fuenfzigstel gefuellt —
und 9,36 PB Speicher liegen brach, was der Bot in seinem eigenen `reason`-String
meldet (Punkt 1).

**Hebel.** Das ist der groesste ungenutzte Einkommenshebel im Bot, und er
kostet weder Geld noch RAM. Aber: Einkommen ist heute **nicht** der Engpass
(Punkt 0), sondern Reputation — und Geld wird erst ab Favor 150 in Reputation
umtauschbar. Der Hebel zahlt sich also erst in der Spendenphase aus, dann aber
voll.

**Urteil: bauen, wenn die Punkte 1 bis 6 stehen. Vorher nicht.**

**Nebenbefund: Formulas.exe ist ein Placebo.** `home.programs` enthaelt kein
`Formulas.exe`, weil die Einkaufsliste des Autopiloten
(`src/autopilot.js:121-127`) nur die fuenf Portknacker kennt. Der naheliegende
Schluss "uns fehlt die Rechengrundlage" ist trotzdem falsch:
`src/lib/calc.js` bildet die Spielformeln bereits zeilengetreu nach —
`hackChance` (:135-142) gegen `Hacking.ts:9-24`, `hackPercent` (:152-158) gegen
`Hacking.ts:44-58` inklusive `balanceFactor` 240, `hackTime` (:167-170) gegen
`Hacking.ts:60-80`, und `growThreads` (:230-261) als vollstaendige
Newton-Raphson-Entsprechung zu `ServerHelpers.ts`. `ns.formulas.hacking.*` ruft
dieselben Funktionen auf. **Genauigkeitsgewinn: null.** Die 5 Mrd $
(`DarkWeb/DarkWebItems.ts:20`, Gate nur `Player.hasProgram`,
`NetscriptFunctions/Formulas.ts:61-65`, 0 GB RAM) sind 30 Sekunden Einkommen
und taugen als Gegenprobe gegen `calc.js` — als Hebel nicht.

---

## 9. Der Aktienmarkt — geprueft, verstanden, und auf einen klaren Ausloeser vertagt

**Beobachtung.** `hasWseAccount`, `hasTixApiAccess`, `has4SData`,
`has4SDataTixApi` — alle vier `false`, `StockMarketSave` leer.

**Was moeglich waere.** Der Minimalpfad ist billiger als der uebliche:
`purchaseTixApi` prueft **nicht** `hasWseAccount` und ruft selbst
`initStockMarket()` (`NetscriptFunctions/StockMarket.ts:316-333`);
`purchase4SMarketDataTixApi` prueft **nicht** `has4SData` (`:274-296`);
`buyStock`/`sellStock` brauchen nur `checkTixApiAccess` (`:139-159`). Also
**5 Mrd + 25 Mrd = 30 Mrd $**, kein Source File, keine `isTrusted`-Huerde, alles
ueber die ns-API zu 2,0 bis 2,5 GB je Funktion
(`Netscript/RamCostGenerator.ts:125-153`). `bitNodeOptions.disable4SData` steht
auf `false`. Ohne SF8 gesperrt sind Shorts (8.2, `:160,170`) und Limit-Orders
(8.3, `:183,195,205`) — wir koennten nur long gehen.

Ertrag aus der Preisformel: pro Tick (6 s, `StockMarket/data/Constants.ts:4`)
ist `E[Δ ln P] ≈ (2p − 1) · mv/200 = otlkMag · mv / 10000`
(`StockMarket/StockMarket.ts:264-300`), bei den besten Papieren 0,10 bis 0,20 %
je Tick bei 600 Ticks/h; Trendwechsel im Mittel alle ~167 Ticks
(`data/Constants.ts:6`, `StockMarket.ts:229,233`). Positionsgrenze: 33 Papiere
(`StockMarket/Enums.ts:18-55`), `maxShares` = 20 % der Gesamtaktien
(`Stock.ts:145-150`), Summe aller `marketCap` 2,71e13 → rund **5,43 Bio $** zum
Startpreis.

**Drei Daempfer, die eine naive Rechnung uebersieht.** Der Spread ist kein
Nebengeraeusch: `ask = price·(1+spreadPerc/100)`, `bid = price·(1−spreadPerc/100)`
(`Stock.ts:224,229`), Round-Trip **0,2 bis 3,2 %** — bei 0,15 % Drift je Tick
sind das mehrere Ticks Haltedauer allein zur Deckung. `influenceForecast` saegt
`otlkMag` genau der Papiere ab, die man handelt (Boden bei 5,
`Stock.ts:5,246-250`), Erholung nur `+10 Aktien je Tick` (`StockMarket.ts:318`).
Und `Math.random()` wird **einmal je Tick fuer alle 33 Papiere** gezogen
(`StockMarket.ts:264`, ausserhalb der Schleife) — die Bewegungen sind in der
Amplitude korreliert, Diversifikation hilft weniger als erwartet. Offline
tickt der Markt praktisch nicht, Hacking dagegen mit
`OfflineHackingIncome: 0.75`.

**Warum trotzdem nicht jetzt.** Punkt 0: der Engpass ist Reputation, und Geld
wird erst ab Favor 150 in Reputation umtauschbar. Punkt 1: wir **haben**
bereits 164,8 Mio $/s und werfen davon 164,2 Mio $/s weg. Eine zweite
Geldquelle zu bauen, waehrend die erste ungenutzt versickert, ist die falsche
Reihenfolge.

**Urteil: bauen, sobald die erste Faktion Favor 150 erreicht.** Ab diesem
Moment ist Geld der direkteste Weg zu Reputation und damit zu Augmentations —
1,094 Rep je Milliarde, und The Red Pill allein kostet 2,29 Bio $ statt 177
Stunden. Vorher ist es eine Baustelle ohne Abnehmer.

---

## 10. Was nichts bringt — damit es niemand nochmal prueft

**Intelligence: hart gesperrt.** `skills.intelligence = 0`, `exp.intelligence = 0`,
`persistentIntelligenceData.exp = 0`. `gainIntelligenceExp` schreibt nur, wenn
`Player.sourceFileLvl(5) > 0 || Player.bitNodeN === 5`
(`PersonObjects/Person.ts:176-188`). Wir haben weder das eine noch das andere.
Jede Quelle — Verbrechen (`Crime/Crimes.ts:40 ff.`), Programme schreiben
(`Work/CreateProgramWork.ts:79`), manuelles Terminal-Hacken
(`Terminal/commands/hack.ts:79`), Grafting — laeuft ins Leere.
`calculateIntelligenceBonus` (`PersonObjects/formulas/intelligence.ts:1-3`)
bleibt dauerhaft 1,0, in der Rep-Rate wie in der Hack-Zeit wie im
Share-Effekt. **Endgueltig erledigt.**

**Kampfwerte, Karma, Verbrechen: der falsche Weg.** Alle vier Kampfwerte 1,
alle `exp` 0, `karma` 0, `numPeopleKilled` 0, `hp` 10/10. Kampfwerte 1500
verlangen bei unserem Multiplikator 2,13e21 exp — dieselbe Sackgasse wie
Hacking ohne Multiplikatoren. Verbrechen wuerden Slum Snakes (Kampf 30,
1 Mio $, Karma −9, `FactionInfo.tsx:665`) und Tetrads oeffnen, blockieren aber
`currentWork` und damit den Rep-Erwerb — bei 278 h Rep-Bedarf der teuerste
denkbare Tausch. Technisch machbar waeren sie:
`Locations/ui/SlumsLocation.tsx:24-28` liest wie `FactionsRoot.tsx:89` nur
`e.isTrusted` aus einem gewoehnlichen `onClick`, der Weg aus
`doku/join-problem.md` traegt also auch dort — ebenso bei
`Locations/ui/CompanyLocation.tsx:62,71` und `Programs/ui/ProgramsRoot.tsx:96,108`.

**Firmenanstellung: nein.** `jobs = {}`, `CompaniesSave` enthaelt **keine
einzige** Firma mit Rep oder Favor. Charisma 1, und Firmenarbeit blockiert
`currentWork`. Der einzige Nebeneffekt waere, dass Coding Contracts
`CompanyReputation` mit Basis 4000 statt 2500 ausschuetten koennten
(`Constants.ts:91-92`) — Firmenrep hilft bei keiner erreichbaren Faktion.

**DarkNet: nein.** `DarknetSave = {storedCycles: 0, hasUsedHeartbleed: false}`,
Einstieg 30 bis 50 Mio (`DarkNet/Constants.ts:6-8`), also bezahlbar. Es gibt
trotzdem nichts zu holen: im ganzen Verzeichnis `DarkNet/` kommt weder
Faktionsrep noch Hacking-Erfahrung vor; jede Erfahrungsausschuettung ist
**Charisma** (`DarkNet/effects/effects.ts:121-132`, `ramblock.ts:32`,
`phishing.ts:16`, `NetscriptFunctions/Darknet.ts:276`). Die einzige
Augmentation-Quelle ist das Labyrinth, und das ist ohne SF15 abgeschaltet:
`hasFullDarknetAccess()` verlangt `bitNodeN === 15 || activeSourceFileLvl(15) > 0`
(`effects.ts:301`), ohne das entsteht gar kein Lab-Server
(`labyrinth.ts:486-497`). Beitrag zu den 30 Augmentations: **exakt 0**. Dazu
Charisma 1 gegen Anforderungen ab 182 — ein Passwortversuch in der tiefsten
erreichbaren Reihe dauert damit rund 48 s (`effects.ts:60-98`). `dnet_money`
(unser Wert 1,0) wirkt nur auf Darknet-Geld (`cacheFiles.ts:118`), ist also
zirkulaer. `hasUsedHeartbleed` ist eine Achievement-Flagge fuer BN15
(`Achievements/Achievements.ts:696`), in BN1 funktionslos.

**Go / IPvGO: spaeter.** `GoSave.stats` ist ein leeres Objekt — nie eine Partie
gespielt, obwohl ein Brett gegen Netburners bereitliegt. Der Mechanismus taugt:
`Daedalus` gibt `faction_rep`, `Illuminati` `hacking_speed`, `w0r1d_d43m0n`
direkt `mults.hacking` (`Go/effects/effect.ts:66-99`, Staerken in
`Go/Constants.ts:20,52,60,67`); SF14 verdoppelt nur, ist nicht Bedingung
(`effect.ts:18`). Die Wirkung ist `1 + ln(n+1) · (n+1)^0,3 · 0,002 · Staerke`
(`effect.ts:16-22`) — bei 5.000 Node Power sind das +43,8 % gegen `w0r1d_d43m0n`
(Staerke 2), aber nur +9,7 % gegen Daedalus (Staerke 1,1). Die Favor-Schiene
zahlt nur bei `winStreak % 2 === 0` (`Go/boardAnalysis/scoring.ts:66-79`), also
**400 Siege** fuer die gedeckelten 100.000 Rep (`effect.ts:30-42`). Und
`Go.prestigeAugmentation` loescht `nodePower` bei jedem Reset (`Go/Go.ts:34-47`).
Eine KI zu bauen, die gegen die Spiel-KI zuverlaessig gewinnt, ist ein eigenes
Vorhaben.

**Gesperrte Teilsysteme.** `sourceFiles` ist leer: Gang (SF2), Corporation
(SF3), Singularity (SF4), Intelligence (SF5), Bladeburner (SF6/7),
Aktien-Shorts und -Orders (SF8), Hacknet Server (SF9), Sleeves (SF10),
Grafting-Rabatt (SF11), Stanek (SF13), Go-Cheating (SF14), volles DarkNet
(SF15). `sleeves` und `StaneksGiftSave.fragments` leer, `AllGangsSave` ein
leerer String, `InfiltrationsSave.floors` 0, `hashManager` ein Objekt mit
lauter Nullwerten, `bitNodeOptions` ohne Overrides.

**Exploits.** `exploits: []`. Das Exploit-System (Source File −1) gibt keinen
Fortschritt in BN1, und die meisten Eintraege haengen an echten Nutzereingaben
(`Exploits/Unclickable.tsx:11`).

**Hacknet: Pflicht erfuellt, mehr nicht.** Drei Knoten, Level 71/65/65, RAM
4/2/2, Kerne 2/1/1, zusammen 371,4 $/s. Seit dem letzten Reset 0,01 Mrd $ gegen
1.116,27 Mrd $ aus Hacking — **0,001 %**. Ihr einziger Zweck ist die
Netburners-Bedingung (RAM ≥ 8, Kerne ≥ 4, Level ≥ 100, `FactionInfo.tsx:675`),
und die ist erfuellt. **Wichtig fuer den Reset:** `prestigeAugmentation` leert
`hacknetNodes` — ohne Wiederaufbau kommt die Netburners-Einladung nie wieder.
Das gehoert in die Reset-Checkliste aus Punkt 3.

**Freier Speicher und `ns.share()`.** 40,5 % Belegung klingt nach Reserve, ist
aber keine: der Share-Bonus ist `1 + ln(Faeden)/25`
(`NetworkShare/Share.ts:43-48`), also logarithmisch, und wir sitzen weit oben
auf der Kurve. 682.000 Faeden geben 1,5373; den gesamten freien Speicher
nachzulegen (rund 1,72 Mio Faeden) gibt 1,5743, also **+2,4 % Rep**. Umgekehrt
kostet eine Kuerzung auf ein Zehntel nur 6 %. Machen, weil es gratis ist — aber
niemand sollte hier Zeit investieren.

**`entropy` 0, `achievements` 13, `AliasesSave` leer, `LastExportBonus` "0".**
Kein Hebel.

---

## Reihenfolge, nach Wirkung je investierter Arbeitsstunde

**Minuten, sofort, ohne Entwicklungsarbeit:**

1. **Sperrkasse setzen** (`node tools/reserve.js …`) — stoppt, dass 99 % des
   Einkommens in 60 % leerstehenden Speicher fliesst (Punkt 1).
2. **home-Kerne-Ziel auf 0** — spart 478 Mrd $ fuer einen Bonus, der nur fuer
   Skripte auf home gilt (Punkt 1).
3. **Faktionsarbeit von CyberSec auf Tian Di Hui** — 34 Minuten bis S.N.A.,
   danach dauerhaft +26,5 % Rep-Rate (Punkte 5, 6).

**Eine bis zwei Stunden:**

4. **Kauf- und Reset-Regel in den Automaten**: echte Augmentations absteigend
   nach Basispreis, NeuroFlux zuletzt, installieren bei 10 bis 15
   **verschiedenen** Augmentations. Ohne diese Regel wiederholt sich der
   Faktor-4.205-Unfall in jeder Runde (Punkte 2, 3).
5. **Reset-Checkliste**: Hacknet neu bauen (sonst keine Netburners-Einladung),
   Programme nachkaufen (314 Mio), Backdoors setzen, Faktionen beitreten
   (Punkte 3, 4, 10).
6. **Backdoor-Regel**: Faktionsserver backdooren und beitreten, sobald
   `requiredHackingSkill` erreicht ist. Deckt `avmnite-02h` (2,1 s), `I.I.I.I`
   (2,9 s) und bei Level 512 `run4theh111z` ab — letzteres ist der Zugang zu
   BitRunners und damit zu Daedalus (Punkte 0, 4).
7. **Fokus-Terminplanung**: fokussiert arbeiten (+25 % Rep), kurz
   entfokussieren, wenn geklickt werden muss (Punkt 5).

**Ein Tagwerk, in dieser Reihenfolge:**

8. **Pipeline-Fuellung**: `LEAD_MS` gegen `4·GAP_MS` heben und
   `expectedPerSec` auf echte Sekunden umrechnen — der groesste
   Einkommenshebel, aber erst in der Spendenphase wirksam (Punkt 8).
9. **Fuenf Contract-Loeser** — 82 Minuten je Runde, amortisiert sich ueber
   mehrere Runden (Punkt 7).

**Mit klarem Ausloeser:**

10. **Aktienmarkt** (30 Mrd), sobald die erste Faktion Favor 150 erreicht. Ab da
    kauft Geld Reputation: 1,094 Rep je Milliarde, The Red Pill 2,29 Bio $
    statt 177 Stunden (Punkte 0, 9).

**Der Rahmen, den man dabei nicht vergessen darf:** BitNode 1 ist kein
Ein-Runden-Projekt. 30 Augmentations verteilen sich sinnvoll auf zwei bis drei
Reset-Runden zu je 5,6 h Wiederaufbau; danach kommen 2,5 Mio Daedalus-Rep fuer
The Red Pill und Hacking 3000 fuer `w0r1d_d43m0n`. Alles, was Entwicklerstunden
kostet, um Spielminuten zu sparen, ist in dieser Rechnung ein Verlust.
