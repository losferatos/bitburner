# A5 — Die drei Blöcke vom 02.09.2026 gegen den Live-Zustand, und die Brache

**Erhoben:** Fr 04.09.2026, 01:37–01:56 Ortszeit (alle Zeitangaben per `date`).
**Quellen:** `src/bn4net.js` (3273 Zeilen, vollständig gelesen — `wc -l` bestätigt die
Zahl aus dem Auftrag), die laufende Telemetrie über die Brücke (`data/bn4net.json`,
lesend), der Spielstand `backups/LIVE_197f4d61481686_BN10L2_2026-09-04T01-31_connect.json.gz`
und `reference/bitburner-src/src` (Spielquelltext).
**Keine Datei unter `src/` wurde angefasst.** Alle RFA-Aufrufe waren lesend.

---

## 0. Zusammenfassung in fünf Sätzen

1. **Zwei der drei Blöcke sind im laufenden Spiel per Konstruktion tot** — ihre
   gemeinsame Vorbedingung `eigene.length < ns.cloud.getServerLimit()` lautet in
   BitNode 10 `15 < 15` und ist damit **jede Runde falsch**.
2. Der dritte Block (Stillstandserkennung) ist erreichbar und läuft jede Runde,
   hat aber im beobachtbaren Fenster nichts auszulösen — alle fünf überwachten
   Telemetriedateien sind 0–47 s alt.
3. **Die „Brache" existiert nicht.** `brachAnteil` ist keine Bestandsgröße, sondern
   der Rest **einer einzigen Runde**, und er springt im Takt von ~35 s zwischen
   **0,84 und 0,0004** hin und her. Beide Werte aus dem Auftrag (0,8127) und aus
   meiner ersten Messung (0,00045) sind zwei Phasen derselben Rechteckschwingung.
4. Das Netz liegt nicht brach: **60–84 % davon werden in jeder zweiten bis dritten
   Runde als ein einziger Restposten auf das Erfahrungsziel `joesguns` geworfen**
   (`bn4net.js:2574-2583`, ausdrücklich ohne Deckel). Geldfähig sind nur
   **779.919 GB = 9,75 %** des Netzes, und die binden drei Zahlen: `SHARE_MAX`,
   die Kalenderplätze der drei Stapelziele und `KAP_ABZUG`.
5. **In BitNode 10 zahlt das alles nicht auf den Ausgang ein**, und zwar
   nachrechenbar: Der Serverpark steht am harten Deckel des Knotens, Hacking 850
   (das Tor zu The Covenant und damit zum einzigen skalierenden Geld→Rang-Hebel)
   verlangt das **7,4·10¹¹-fache** der heutigen Erfahrung, und Hash-Tausch gegen
   Rang ist ohne SF9 gesperrt. **In 26 der 40 Restläufe ist die Brache dagegen
   unmittelbar ausgangsrelevant** — Aufstellung in Abschnitt 6.4.

---

## 1. Der gemessene Nullpunkt

### 1.1 Netz (Spielstand 04.09.2026 01:31, aus `runningScripts`, `ramUsage × threads`)

| Größe | Wert |
|---|---|
| Server insgesamt | 87 |
| Netzspeicher `maxRam` | **7.997.564 GB** |
| belegt | **1.346.822 GB (16,8 %)** |
| frei | **6.650.742 GB (83,2 %)** |
| Fäden insgesamt | 507.469 |

Der Auftrag nennt „8,00 Mio GB, davon 6,65 Mio frei" — **bestätigt auf vier
signifikante Stellen.**

Zusammensetzung der belegten 1.346.822 GB:

| Posten | GB | Anteil am Netz |
|---|---:|---:|
| `worker/share.js` (200.000 Fäden × 4 GB) | 800.000 | 10,00 % |
| Stapelziel `the-hub` (hack/grow/weaken) | 354.464 | 4,43 % |
| Stapelziel `omega-net` | 122.498 | 1,53 % |
| Stapelziel `phantasy` | 50.320 | 0,63 % |
| offene Geldziele (10 Server, iron-gym … n00dles) | ≈ 9.700 | 0,12 % |
| Erfahrungsziel `joesguns` | 8.404 | 0,11 % |
| Werkzeuge (bn4rep 851, bn4life 294, blade 174, …) | ≈ 1.770 | 0,02 % |

Verteilung über die Wirte: `werk-0` 523.408/524.288 belegt, `werk-1` 505.053,
`werk-2` 151.117, `werk-3` 11.851 — **`werk-4` bis `werk-14` je 1.400–3.700 GB,
also praktisch leer.** home 128.995/131.072.

### 1.2 Figur (derselbe Spielstand)

| Größe | Wert |
|---|---|
| Hacking | 340 (exp **4,5410·10¹⁰**) |
| str / def / dex / agi | 100 / 100 / 109 / 107 |
| Geld | 12,257 Bio $ |
| Augmentierungen | 15 eingebaut, 2 wartend |
| Sleeves | **2**, davon `sleevesFromCovenant` **0** |
| Bladeburner-Rang | **649,00** |
| `numBlackOpsComplete` | 0 |
| Bladeburner-Skillpunkte | 0 offen, 216 insgesamt vergeben |
| `totalPlaytime` | 366,94 h, im Knoten 57,54 h |

### 1.3 Raten (eigene Messung, Fenster 01:50:00 → 01:53:00, 180 s)

| Größe | Wert |
|---|---|
| Geld | **+1,166 Mrd $/s = 4,20 Bio $/h** |
| Bladeburner-Rang | 659 → 661 = **+40,0 Rang/h** |
| Hacking | 341 → 341 (unverändert) |

**Verifikationsfrage 1 (welche Uhr?)** — Echtzeit, Wanduhr des Rechners, über
einen Zeitraum, in dem der Spieltab durchgehend im Vordergrund lief. Beide Raten
sind Spielzeit-Raten, weil die Engine bei sichtbarem Tab 1:1 taktet.
**Verifikationsfrage 3 (Rate oder Bestand?)** — beides sind echte Raten aus einer
Differenz über 180 s, kein Abbau eines Vorrats.

### 1.4 Erfahrungsformel geeicht

Die Spielformel `skill = floor(mult · (32·ln(exp + 534,5) − 200))` wurde als Code
nachgebaut und gegen den Spielstand geeicht. **Alle fünf Kennwerte werden exakt
reproduziert:**

| Kennwert | exp | Skill im Stand | nachgerechnet | eff. Multiplikator |
|---|---|---|---|---|
| hacking | 4,5410e10 | 340 | **340** | 1,66381 × 0,35 = 0,58233 |
| strength | 9,4773e4 | 100 | **100** | 1,50913 × 0,4 = 0,60365 |
| defense | 9,4784e4 | 100 | **100** | 0,60365 |
| dexterity | 6,9447e4 | 109 | **109** | 0,69722 |
| agility | 8,0361e4 | 107 | **107** | 0,66552 |

Damit ist jede Aussage über Erfahrungsziele in Abschnitt 6 belastbar, nicht
geschätzt.

---

## 2. Block 1 — A1-Regel, `bn4net.js:685-705`

Zeilennummern aus dem Auftrag **exakt bestätigt**: Die `if`-Zeile steht auf 685,
die schließende Klammer auf 705.

### 2.1 Was der Block tut

Er kauft **einen zusätzlichen Mietrechner**, wenn ein Werkzeug wartet, für das im
Park kein passender Rechner existiert. Er wählt dazu nicht die größte bezahlbare
Stufe (das tut die Leiter darunter), sondern die **kleinste Stufe, die das Werkzeug
fasst** (`:688-689`, Verdoppelung ab 32 GB bis `werkzeugWartetGb + 4`), und verlangt
nur den **doppelten** statt des vierfachen Preises (`:692`).

Die drei Bedingungen (`:685-686`), alle drei müssen gelten:

1. `werkzeugWartetGb > 0` — ein Werkzeug hat in der Vorrunde nirgends Platz
   gefunden. Gesetzt wird das nur an zwei Stellen: `:725` (Auftragsläufer) und
   `:3013` (Werkzeugstarter). Zurückgesetzt wird es **jede Runde** auf 0, sobald
   eine Werkbank existiert (`:2815`).
2. `eigene.length < ns.cloud.getServerLimit()` — im Park ist noch ein Platz frei.
3. `!eigene.some(h => getServerMaxRam(h) >= werkzeugWartetGb + 4)` — kein
   vorhandener Rechner ist groß genug.

### 2.2 Ist die Bedingung im laufenden Spiel je wahr geworden? — **Nein, und sie kann es nicht**

Bedingung 2 ist in BitNode 10 **strukturell falsch**:

```
getCloudServerLimit() = Math.round(ServerConstants.CloudServerLimit × CloudServerLimit_BN)
                      = Math.round(25 × 0,6) = 15
```
(`reference/bitburner-src/src/Server/ServerPurchases.ts:92-94`,
`Server/data/Constants.ts:12`, `BitNode/BitNode.tsx:841` für BN10 `CloudServerLimit: 0.6`)

Der Spielstand vom 01:31 enthält **`werk-0` bis `werk-14`, also genau 15 gekaufte
Rechner**. Damit lautet Bedingung 2 `15 < 15` → **falsch, in jeder Runde seit dem
Einbau am 02.09.**

Bedingung 1 ist ebenfalls dauerhaft falsch: Der Spielstand zeigt alle vierzehn
Werkzeuge laufend (`ausgang.js`, `hashes.js` fehlt lediglich mangels Hacknet,
`sleevecrime.js`, `blade.js`, `bbtrain.js`, `sleeve.js`, `bn4life.js`,
`homegrow.js`, `contracts.js`, `wakelock.js`, `popups.js`, `bn4rep.js`,
`bn4door.js`), also ist `fehlend` leer und `werkzeugWartetGb` bleibt bei 0.

**Zusatzbefund, der schwerer wiegt als der tote Block:** Auch der *Meldezweig*
(`:701-703`, „warte auf Geld", alle 60 Runden) hängt an derselben falschen
Bedingung. Ein wartendes Werkzeug im vollen Park erzeugt aus diesem Block also
**nicht einmal eine Logzeile**. Sichtbar wird der Zustand nur über `:3014`
(„passt auf … nie und findet auch sonst nirgends Platz"), und diese Zeile geht in
einem 200-Zeilen-Ringpuffer unter (Abschnitt 5.4).

### 2.3 Was passiert im Zielzustand (frischer Knoten, home 32 GB, 1 Kern, 1000 $, kein eigener Rechner)?

Zeile für Zeile, für den nächsten Routeneintrag (BN10 Lauf 3, also dieselben
Multiplikatoren):

- `:676-677` `reserviert` = 0 (`data/geldbedarf.txt` existiert nach dem Wechsel nicht).
- `:678` `eigene = []`, `eigene.length = 0`.
- `:685` Bedingung 1: In der **allerersten Runde** ist `werkzeugWartetGb` = 0 (das
  Feld wird erst in `:3013` gesetzt, also frühestens am Ende derselben Runde) →
  **Block wird übersprungen.** Er kann erst ab Runde 2 greifen.
- Ab Runde 2, wenn ein Werkzeug wartet: Bedingung 2 `0 < 15` ✓, Bedingung 3
  (kein Rechner) ✓.
- `:687` `limit = getCloudServerMaxRam() = 1 << (31 − clz32(round(1048576 × 0,5))) = 524288`.
- `:688-689` `gb` startet bei 32 und verdoppelt bis `werkzeugWartetGb + 4`.
  Welches Werkzeug wartet zuerst? `fehlend` folgt der Reihenfolge von `WERKZEUGE`
  (`:263-354`). Die ersten, die auf einem 32-GB-home *nicht* mehr Platz finden,
  sind `blade.js` (**174,35 GB**, M.4) und `bn4life.js` (**293,85 GB**). Für
  `blade.js` läuft die Schleife auf `gb = 256`, für `bn4life.js` auf `gb = 512`.
- `:690` `preis = getServerCost(256) = 256 × 55000 × 5 × 1,1^(8−6) = 85,18 Mio $`.
  Für 512 GB: `512 × 55000 × 5 × 1,1^3 = 187,4 Mio $`.
  (Formel `ServerPurchases.ts:22-40`; BN10 `CloudServerCost: 5`, `CloudServerSoftcap: 1.1`.)
- `:692` verlangt `preis × 2` frei: **170,4 Mio $ bzw. 374,8 Mio $.**
- Bei 1000 $ Startguthaben und (laut Kommentar `:725` gemessenen) 260 $/s im
  Kaltstart wären das **182 h bzw. 400 h.**

**Das ist der eigentliche Befund zu diesem Block:** Er wurde als Abkürzung gebaut
(„bbtrain (95 GB) bräuchte 140 Mio über die Leiter statt 53 Mio für einen passenden
128-GB-Rechner", `:682-683`), und in *diesem* Knoten ist er teurer als die Leiter
darunter — weil die Leiter im Kaltstart auf **Faktor 1,0** heruntergeht (`:740`),
dieser Block aber starr auf **Faktor 2** steht (`:692`). Ein 128-GB-Rechner kostet
in BN10 `128 × 55000 × 5 × 1,1^1 = 38,72 Mio`; über die Leiter mit Faktor 1,0 also
38,72 Mio, über diesen Block mit Faktor 2 **77,44 Mio**. Der Block, der die Leiter
beschleunigen sollte, **verdoppelt die Wartezeit**, sobald er greift.

### 2.4 Welche Annahme steckt darin, die im Zielzustand nicht gilt?

**Die Annahme, ein Mietrechner sei billig.** Die Begründung im Kommentar
(`:682-683`) rechnet mit `CloudServerCost = 1` — den Preisen von BitNode 4. In
BN10 ist `CloudServerCost: 5`; in BN3 ist er 2; in **BN9 ist `CloudServerLimit: 0`,
dort gibt es überhaupt keine Mietrechner** (`BitNode.tsx`, Fall 9). Die zweite
Annahme — „im Park ist noch Platz" — gilt nach wenigen Stunden nie mehr, weil
`CloudServerLimit` in BN10 nur 15 Plätze zulässt und die Leiter darunter sie
schnell füllt.

---

## 3. Block 2 — Stillstandserkennung, `bn4net.js:2713-2739`

Zeilennummern aus dem Auftrag **exakt bestätigt**: `for (const [datei, telemetrie,
maxAlterMs] of TELEMETRIE)` steht auf 2713, das aufräumende `for` endet auf 2739.

### 3.1 Was der Block tut

Er beendet ein Werkzeug, das als Prozess lebt, aber seit zu langer Zeit nichts
mehr in seine Telemetriedatei geschrieben hat. Der Starter (`:2989-3046`) holt es
in derselben Runde zurück, weil `:2733` es zusätzlich aus `laufend` streicht.

Überwacht werden fünf Werkzeuge mit je 10 min Toleranz (`:59-65`):
`blade.js`, `sleeve.js`, `bn4life.js`, `ausgang.js`, `bbtrain.js`.

Bedingungskette je Werkzeug:

| Zeile | Bedingung |
|---|---|
| `:2715` | das Werkzeug läuft überhaupt irgendwo (`orte`) |
| `:2716-2717` | es wurde schon einmal gesehen — sonst nur Zeitstempel setzen und **nächste Runde** |
| `:2718` | es läuft seit ≥ `maxAlterMs` (10 min) — jüngere Prozesse sind tabu |
| `:2721-2726` | Alter der Telemetrie; fehlt/kaputt → Alter ab erster Sichtung |
| `:2727` | Alter > `maxAlterMs` → **erst dann** `ns.kill` auf alle Instanzen |

### 3.2 Ist die Bedingung im laufenden Spiel je wahr geworden?

**Der Block läuft jede Runde — die Auslösebedingung ist derzeit für keines der
fünf Werkzeuge erfüllt.** Gemessen 04.09.2026 01:46:58 über die Brücke:

| Werkzeug | Telemetriezeit | Alter |
|---|---|---|
| `blade.js` | 01:46:58 | 0 s |
| `sleeve.js` | 01:46:12 | 46 s |
| `bn4life.js` | 01:46:51 | 7 s |
| `ausgang.js` | 01:46:11 | 47 s |
| `bbtrain.js` | 01:46:41 | 17 s |

Alle fünf weit unter 600 s. **Ob der Block seit dem 02.09. jemals ausgelöst hat,
kann ich nicht belegen** — und das ist selbst ein Befund: `data/bn4net-log.txt`
ist ein Ringpuffer über 200 Zeilen (`LOG_ZEILEN = 200`, `:389`), und **197 der 201
Zeilen** sind dieselbe Meldung („Anlauf für … übersprungen"). Die Auslösemeldung
(`:2734`, „lebt, schreibt aber seit … min nichts") kommt darin nicht vor, aber der
Puffer reicht auch nur bis 21:27:56 zurück und ist inhaltlich blind. **Ein
Negativbefund aus diesem Log wäre ungültig, weil das Werkzeug den ausgeschlossenen
Fall gar nicht mehr anzeigen kann.**

### 3.3 Was passiert im Zielzustand?

- Runde 1 nach dem Wechsel: `orte` enthält von den fünf nur `bn4life.js` und
  `ausgang.js` (die anderen drei laufen noch nicht — `blade.js` 174 GB,
  `bbtrain.js` 94,75 GB, `sleeve.js` 27,85 GB passen auf ein 32-GB-home nicht).
  Genau genommen: `bn4life.js` ist außerhalb BN4 **293,85 GB** groß und läuft im
  Zielzustand ebenfalls nicht. Es bleibt **`ausgang.js`** (8,15 GB, live gemessen).
- `:2717` setzt für `ausgang.js` `werkzeugSeit = jetzt` und springt weiter.
- Die folgenden **60 Runden (10 min)** greift `:2718` und der Block tut nichts.
- Danach wird `data/ausgang.json` gelesen. Schreibt `ausgang.js` normal, ist alles
  gut. Schreibt es nicht — der Fall, für den der Block gebaut ist —, wird es
  beendet und in derselben Runde neu gestartet.

**Ein sauberer Ablauf, mit einer Ausnahme:** `:2726` behandelt „Datei existiert
nicht" wie „seit dem Start nichts geschrieben". Im Zielzustand räumt `boot.js` die
`data/`-Marker beim Wechsel; ein Werkzeug, das seine Telemetrie erst nach dem
ersten Arbeitsschritt anlegt und dafür länger als 10 min braucht, wird also
**einmal grundlos erschlagen**. Das ist folgenlos (Neustart in derselben Runde),
kostet aber den Arbeitsstand — bei `bbtrain.js` ist das der Trainingsfortschritt.

### 3.4 Welche Annahme steckt darin, die im Zielzustand nicht gilt?

**Die Annahme, „lebt als Prozess" sei im Zielzustand überhaupt der interessante
Fall.** Der Kommentar (`:2701-2712`) nennt als Anlass 17 wirkungslose Neustarts
von `wakelock.js` — also ein Werkzeug, das läuft und hängt. Im Zielzustand ist der
häufige Fall aber, dass ein Werkzeug **gar nicht läuft**, weil es nirgends Platz
findet; dagegen hilft dieser Block per `:2715` (`if (!wo || !wo.length) continue`)
ausdrücklich nicht. Und er deckt, wie der Kommentar `:2710-2712` selbst einräumt,
`contracts`, `popups`, `bn4door`, `homegrow` und **ausgerechnet `wakelock`** nicht
ab — das Werkzeug, dessen Vorfall ihn ausgelöst hat.

Zweite Annahme: **eine feste 10-Minuten-Grenze auf einer Echtzeituhr.** Bei
verborgenem Tab bekommt die Seite laut Projektwissen 1 Timer-Aufwachen je Minute;
`ausgang.js` und `blade.js` takten mit 30–60 s. Eine Nacht mit verborgenem Tab
streckt jeden Schreibtakt, und der Block würde reihenweise gesunde Werkzeuge
erschlagen. Der Kommentar (`:57-58`) nennt genau das als Grund für die großzügige
Toleranz — 10 min sind bei 1 Wake/min aber nur 10 Takte, nicht 20–40.

---

## 4. Block 3 — Kaltstart-Leiter, `bn4net.js:733-749`

Zeilennummern aus dem Auftrag **exakt bestätigt**: `const kaltstart` steht auf 733,
die schließende Klammer der Kaufschleife auf 749.

### 4.1 Was der Block tut

```
733  const kaltstart = eigene.length === 0;
734  const leiter = kaltstart ? [1024,512,256,128,64,32] : [1024,512,256,128,64];
740  const faktor  = kaltstart ? 1.0 : 4;
741  for (const gb of leiter) {
742    const preis = ns.cloud.getServerCost(gb);
744    if (geld - reserviert < preis * faktor) continue;
745    purchaseServer(...); break;
749  }
```

Zwei Zugeständnisse an den Kaltstart: eine **zusätzliche 32-GB-Sprosse** und ein
**Sicherheitsfaktor von 1,0 statt 4**.

**Umgebende Bedingung (`:708`):** Der ganze Block steht im `else if
(eigene.length < ns.cloud.getServerLimit())`.

### 4.2 Ist die Bedingung im laufenden Spiel je wahr geworden? — **Nein**

Dieselbe Sperre wie bei Block 1: `eigene.length = 15`, `getServerLimit() = 15`,
also `15 < 15` = falsch. Der Zweig `:708-749` wird **nicht betreten**; stattdessen
läuft immer der `else`-Zweig ab `:750` (Serveraufrüstung).

Und selbst wenn er betreten würde: `kaltstart = eigene.length === 0` verlangt
**null** eigene Rechner. Beide Zusatzregeln des Blocks sind also seit dem Einbau
am 02.09. **nie ein einziges Mal** ausgeführt worden.

**Härtere Fassung desselben Befunds:** Auch die Serveraufrüstung im `else`-Zweig
ist heute wirkungslos. Es gilt

```
getCloudServerMaxRam() = 1 << (31 − clz32(round(1048576 × 0,5))) = 524288
```
und **alle 15 Rechner stehen im Spielstand auf exakt 524.288 GB**. Die Schleife
bricht daher sofort bei `:852` ab (`smallest.gb >= maxGb`). **Der Serverpark von
BitNode 10 ist am absoluten Deckel — er kann für kein Geld der Welt um ein
einziges Gigabyte wachsen.** Das ist die wichtigste Einzeltatsache für Frage 6.

### 4.3 Was passiert im Zielzustand?

- `:733` `kaltstart = true`.
- `:741-744` Die Leiter wird von oben durchlaufen. Preise in BN10
  (`CloudServerCost: 5`, `CloudServerSoftcap: 1.1`, Formel `ServerPurchases.ts:22-40`):

| Sprosse | Preis | verlangt (Faktor 1,0) | bei 260 $/s |
|---|---:|---:|---:|
| 1024 GB | 412,3 Mio $ | 412,3 Mio | 440 h |
| 512 GB | 187,4 Mio $ | 187,4 Mio | 200 h |
| 256 GB | 85,2 Mio $ | 85,2 Mio | 91 h |
| 128 GB | 38,7 Mio $ | 38,7 Mio | 41 h |
| 64 GB | 17,6 Mio $ | 17,6 Mio | 18,8 h |
| **32 GB** | **8,8 Mio $** | **8,8 Mio** | **9,4 h** |

- Bei 1000 $ Startguthaben fällt jede Sprosse durch, bis 8,8 Mio $ zusammen sind.
  **Der Bot steht ohne Werkbank, bis das erreicht ist.**

**Damit ist die Zahl aus dem Kommentar `:735-739` nachgerechnet und bestätigt —
und zugleich relativiert.** Der Kommentar sagt, mit Faktor 1,25 hätten 11 Mio $
gefehlt und der Bot habe deshalb 13,5 h bei 8 von 70 Rechnern gestanden. Mit
Faktor 1,0 sind es 8,8 Mio statt 11 Mio, also **−20 %: aus 13,5 h werden 10,8 h.**
**Die Änderung vom 02.09. entfernt den Stillstand nicht, sie kürzt ihn um 2,7 h.**

### 4.4 Welche Annahme steckt darin, die im Zielzustand nicht gilt?

**Die Annahme, 32 GB seien die kleinste sinnvolle Sprosse.** Die Begründung
(`:729`) lautet wörtlich: „das genügt für `darkweb.js` oder `contracts.js`".

Live gemessen am 04.09.2026 01:54 per `calculateRam`:

| Datei | Kommentar-Annahme | gemessen |
|---|---:|---:|
| `darkweb.js` | 27,65 GB | **2,65 GB** |
| `ausgang.js` | — | **8,15 GB** |
| `hashes.js` | — | **5,95 GB** |
| `sleevecrime.js` | — | **7,65 GB** |
| `hacknet.js` | — | **9,45 GB** |
| `popups.js` | 1,6 GB | **3,3 GB** |
| `contracts.js` | 17,65 GB | 17,65 GB |

`darkweb.js` — das Werkzeug, das der Kommentar als Grund für die 32er-Sprosse
nennt — ist **zehnmal kleiner als angenommen** (bestätigt Befund M.5). Damit gilt:

- eine **8-GB-Sprosse** kostet in BN10 `8 × 55000 × 5 = 2,20 Mio $` und trägt
  `darkweb.js` + `hashes.js` oder `ausgang.js` allein → **2,4 h statt 9,4 h**;
- eine **16-GB-Sprosse** kostet `4,40 Mio $` und trägt `ausgang.js` +
  `sleevecrime.js` + `hashes.js` + `popups.js` = 25,05 GB … nein, 16 GB reicht für
  `ausgang.js` + `hashes.js` (14,10 GB) → **4,7 h**.

**Die Leiter hört eine bis zwei Sprossen zu früh auf, und der Grund dafür ist eine
RAM-Zahl, die um Faktor 10 falsch ist.** Das ist der teuerste Einzelbefund an
diesem Block: Er kostet in jedem Kaltstart der 40 Restläufe rund 5–7 Stunden.

Zweite, unausgesprochene Annahme: **dass es überhaupt Mietrechner gibt.** In
**BitNode 9** ist `CloudServerLimit: 0`, also `getServerLimit() = 0`. Dort ist
`0 < 0` falsch, der ganze Kaufzweig entfällt, und der `else`-Zweig findet mit
`eigene = []` kein `smallest` (`:852` bricht sauber ab). **In den drei BN9-Läufen
der Route existiert keine Werkbank außer home und den Hacknet-Servern** — der
Kaltstart-Block ist dort nicht nur wirkungslos, sondern die Bauform „Werkbank =
gekaufter Rechner" trägt gar nicht.

---

## 5. Frage 5 — Wo die Grenze wirklich liegt

### 5.1 Zuerst: der Zusatzbefund des Auftrags ist in zwei Punkten zu korrigieren

**Korrektur A — `brachAnteil` ist keine Zahl, sondern eine Schwingung.**

`brachAnteil` wird auf `:3084` gebildet als `ueberschussMerker / ramTotal`.
`ueberschussMerker` ist nach `:2581/:2608` der Speicher, der in **genau dieser
einen Runde** nach der Zuteilung übrig blieb und aufs Erfahrungsziel ging.

Gemessen 04.09.2026, 01:42:04–01:44:27, 14 Abtastungen im 11-s-Takt, Runden
3715–3730:

| Runde | budgetGb | expStandGb | überschuss | **brachAnteil** |
|---:|---:|---:|---:|---:|
| 3715 | 4.440 | 6.764.837 | 1.925 | **0,00024** |
| 3716 | 1.865 | 6.766.708 | 666 | **0,00008** |
| **3717** | **6.747.244** | 9.173 | 6.744.758 | **0,84335** |
| 3719 | 4.315 | 6.734.122 | 2.126 | **0,00027** |
| **3720** | **6.731.547** | 2.070 | 6.729.004 | **0,84138** |
| 3721 | 5.686 | 6.728.947 | 3.497 | **0,00044** |
| 3722 | 4.207 | 6.732.391 | 3.101 | **0,00039** |
| 3723 | 2.845 | 6.735.436 | 0 | **0,00000** |
| **3724** | **6.727.740** | 6.489 | 6.723.780 | **0,84073** |
| **3725** | **6.718.045** | 3.046 | 6.716.867 | **0,83987** |
| 3726 | 7.926 | 6.716.810 | 5.973 | **0,00075** |
| 3727 | 10.260 | 6.722.726 | 7.892 | **0,00099** |
| **3728** | **6.720.184** | 7.835 | 6.718.308 | **0,84005** |
| **3730** | **6.716.122** | 9.571 | 6.713.641 | **0,83946** |

Die 0,8127 aus dem Auftrag und die 0,00045, die ich um 01:37 als erstes las, sind
**dieselbe Größe in zwei Phasen**. `budgetGb` und `expStandGb` sind exakte
Spiegelbilder voneinander.

**Verifikationsfrage 3 (Rate oder Bestand?)** — `brachAnteil` ist **weder**. Es ist
der Rest *einer* Zuteilungsrunde, geteilt durch einen Bestand. Als Kennzahl für
„wie viel des Netzes liegt brach" ist es unbrauchbar, weil der Zähler eine
Momentaufnahme mitten in einer Schwingung ist.

**Korrektur B — „unter 1 Prozent des Netzes für Stapel" ist falsch.**

Die 19.705 GB aus dem Auftrag sind `mischung.kapGesamtGb`, und dieses Feld ist
laut `:2372-2375` die Summe der Kapazitäten **der offenen Geldziele** — die
Stapelziele sind zu diesem Zeitpunkt bereits aus `moneyTargets` entfernt
(`:1321-1323`). Es beschreibt also gerade *nicht* die Stapel.

Gemessen liegt in den Stapeln:

| Ziel | belegt (GB) | Kalenderdeckel (GB) | Auslastung |
|---|---:|---:|---:|
| `the-hub` | 357.379 | 201 × 2.662 = **535.062** | 67 % |
| `omega-net` | 116.060 | 103 × 1.560 = **160.680** | 72 % |
| `phantasy` | 47.527 | 49 × 1.316 = **64.484** | 74 % |
| **Summe** | **520.966** | **760.226** | **69 %** |

Das sind **6,5 % des Netzes belegt bei 9,5 % möglichem Deckel** — nicht unter 1 %.
Über die 14 Abtastungen stieg der Stapelbestand von 391.848 auf 435.872 GB
(4,9 → 5,5 %).

### 5.2 Die vollständige Speicherbilanz — was bindet wirklich

Von 7.997.564 GB Netz kann der Motor in seiner heutigen Konfiguration
**geldfähig** höchstens verwenden:

| Posten | Deckel (GB) | Anteil | Bindende Zeile |
|---|---:|---:|---|
| Stapelziele (3) | 760.226 | 9,51 % | `:2121` × `:1979` × `:1281` |
| offene Geldziele (13) | 19.693 | 0,25 % | `:1145` `KAP_ABZUG = 0.2` |
| **Summe geldfähig** | **779.919** | **9,75 %** | |
| `worker/share.js` (Reputation) | 800.000 | 10,00 % | `:1474` `SHARE_MAX = 200000` |
| Rest → Erfahrungsziel | ≈ 6.417.645 | 80,24 % | `:2574-2583`, **ohne Deckel** |

**Die bindende Grenze für das Geld ist nicht eine, sondern drei — und keine davon
ist eine Speichergrenze:**

**(1) `BATCH_ZIELE = 3`, `bn4net.js:1281`.** Der Vorgabewert steht im Code
(`data/batch-ziele.txt` ist leer). `batchPlaetze = min(3, 16 − 2) = 3` (`:1318-1319`).
Ein Stapelziel nimmt gemessen **250-mal mehr Speicher** auf als ein offenes
(760.226/3 = 253.409 GB gegen 19.693/13 = 1.515 GB). **Das ist die mit Abstand
größte einzelne Stellschraube.** `BATCH_MIN_OFFENE_ZIELE = 2` (`:1312`) ließe heute
bis zu **14** Stapelziele zu.

**(2) Die Kalenderplätze, `bn4net.js:2121`.**
```
kalenderPlaetze = max(1, floor(tWeaken / (4 × GAP_MS)))
```
Mit `GAP_MS = 400` (`:1928`) belegt jeder Stapel 1,6 s Kalenderzeit. `the-hub`
meldet 201 Plätze → `tWeaken ≈ 321,6 s`. Mehr Speicher hilft hier nur, wenn `f`
eine Sprosse höher rutscht — **und das ist bereits unmöglich:**

`f` wird auf `:2143-2148` als kleinstes gewählt, dessen voller Kalender
`wunschGb = ramTotal × F_NETZANTEIL = 7.997.564 × 0,15 = 1.199.635 GB` fasst.
Der größte erreichbare Wert ist `the-hub` mit 535.062 GB — **44,6 % des
Wunsches.** Die Schleife bricht also nie ab, `fIndex` landet auf dem letzten
Element, und `fraction` ist **0,5 = das obere Ende von `F_LEITER`** (`:1979`).
Die Telemetrie bestätigt das für alle drei Ziele (`"fraction":0.5`).

**Damit ist `F_NETZANTEIL = 0.15` in diesem Knoten eine tote Zahl** — sie ist um
Faktor 2,24 unerreichbar, und `grenzErtrag()` (`:141-159`) rechnet trotzdem mit
`grenzAnteilMerker = 0.15` weiter, als bekäme jedes Stapelziel 15 % jedes neuen
Gigabytes. Das ist die Grundlage jeder Amortisationsrechnung des Serverausbaus.

**(3) `SHARE_MAX = 200000`, `bn4net.js:1474`.**
```
SHARE_DECKEL = max(1, min(200000, floor(7.997.564 × 0,12 / 4))) = min(200000, 239.926) = 200.000
```
Der Spielstand bestätigt exakt: **200.000 Fäden, 800.000 GB.** Der Kommentar
`:1469-1472` behauptet, „die eigentliche Bremse ist und bleibt `SHARE_ANTEIL`" —
**das ist seit dem Netzwachstum falsch: `SHARE_MAX` bindet, und zwar 17 % unter
dem, was `SHARE_ANTEIL` zuließe.**

### 5.3 Was der Restposten anrichtet

`:2574-2583` wirft den ganzen Rest in **einen einzigen Wunsch** auf das
Erfahrungsziel:
```
offen: Math.floor(budget / expRam)   →   6.717.000 / 1,75 ≈ 3,84 Mio Fäden
```
Diese Fäden binden das Netz für eine volle weaken-Dauer auf `joesguns`
(gerechnet aus `hackTime = 5·(2,5·10·3+500)/(340+50) = 7,4 s` → weaken ≈ 29,4 s
≈ 3 Runden). Genau das erklärt das Muster in der Tabelle 5.1: **auf eine freie
Runde folgen zwei bis drei gebundene.**

Daraus drei konkrete Schäden — keiner davon ist das, was der Auftrag vermutete:

**(a) Der Ausbaubremse fehlt der Boden.** `homegrow.js:112` kauft home-Speicher nur
`if (geld > kosten * 3 && brachAnteil < 0.34)`. Die Zahl, die dort gelesen wird,
ist ein Münzwurf mit 1:2,5-Verteilung. Dieselbe Größe steuert die
Serveraufrüstung: `bn4net.js:886` setzt den Ertrag auf 0, wenn
`ueberschussMerker > ramTotal * 0.05`. **Beide Bremsen entscheiden nach Zufall,
welche Runde sie erwischen.**

**(b) Die Stapel werden bestohlen — und ausgerechnet der wertvollste.** Der
Stapelzweig (`:2182`) rechnet mit `budget = freiGesamt() * BATCH_ANTEIL(0.6)`.
In einer gebundenen Runde sind das bei 4.735 GB frei nur 2.841 GB — das reicht für
**einen** `the-hub`-Stapel (2.662 GB). Die Telemetrie von Runde 3686 zeigt genau
das: `neueStapel` = 6 / 6 / **1**. Der Kalender läuft aber in Wanduhrzeit weiter
(`frueheste = jetzt + tWeaken − 3·GAP + SLACK`, `:2188`), **ein nicht gefüllter
Platz ist ersatzlos verloren.** Rechnerisch passen bei 10 s Rundendauer und
`LEAD_MS = 14000` (`:1939`) rund 6,25 Stapel je Runde und Ziel — das ist die
volle Kalenderrate. Erreicht wird sie nur in der freien Runde.

Und die Reihenfolge macht es schlimmer: `batchTargets` ist nach `steadyEff`
($/GB·s) sortiert, jedes Ziel nimmt sich der Reihe nach `freiGesamt() × 0,6`.
Gemessen:

| Ziel | erwartet $/s | Kalenderdeckel GB | **$/GB·s** | Position |
|---|---:|---:|---:|---:|
| `omega-net` | 523.015.052 | 160.680 | 3.255 | **1.** |
| `phantasy` | 186.754.253 | 64.484 | 2.896 | **2.** |
| `the-hub` | **984.682.942** | 535.062 | 1.840 | **3. (zuletzt)** |

**`the-hub` liefert 58 % des gesamten Stapelertrags und wird als letztes bedient,
weil es je Gigabyte am schlechtesten ist.** Bei 6,65 Mio GB freiem Speicher ist
$/GB·s die falsche Sortiergröße: Knapp sind nicht die Gigabyte, knapp sind die
Kalenderplätze. Der Ertragsverlust liegt bei 984,7 Mio × (1 − 0,67) ≈ **325 Mio $/s**.

**(c) Die Modellrechnung stimmt trotzdem.** Zur Gegenprobe: erwarteter
Stapelertrag bei voller Kalenderauslastung 1,694 Mrd $/s, gemessene Auslastung
57–69 %, plus offene Ziele (19.693 GB × 3.097 $/GB·s ≈ 61 Mio $/s) ergibt
**1,03–1,23 Mrd $/s** gegen **gemessene 1,166 Mrd $/s**. Abweichung unter 13 % —
das Modell des Motors ist belastbar, die Zuteilung ist es nicht.

### 5.4 Nebenbefund: das Log ist blind

`data/bn4net-log.txt` fasst 200 Zeilen (`:389`). Beim Abruf um 01:47 waren
**197 von 201 Zeilen** die Meldung „Anlauf für *X* übersprungen" aus `:2455`.
Sie wird `if (runde % 30 === 0)` für jedes durchgefallene Anlaufziel geschrieben —
bei neun Zielen alle fünf Minuten neun Zeilen. **Jede andere Meldung des Motors
wird darunter binnen zwei Stunden begraben**, einschließlich der Auslösemeldungen
aller drei hier untersuchten Blöcke. Das bestätigt Befund L.6 im Feld.

---

## 6. Frage 6 — Zahlt die Brache auf den Ausgang aus BitNode 10 ein?

**Antwort: nein, und der Nachweis besteht aus vier geschlossenen Türen.**

Der Ausgang aus BN10 läuft nach `src/route.json` über Verfahren V2 —
**Operation Daedalus, `reqdRank: 400e3`**
(`reference/bitburner-src/src/Bladeburner/data/BlackOperations.ts:704-708`).
Stand: Rang **661**, `numBlackOpsComplete` 0, gemessene Rate **40,0 Rang/h**.

Hacking-Erfahrung wirkt auf den Rang nicht direkt — die vier möglichen indirekten
Wege sind:

### 6.1 Tür 1: Mehr Rechenspeicher kaufen → **geschlossen, hart**

`getCloudServerLimit() = round(25 × 0,6) = 15` → 15 Rechner, alle vorhanden.
`getCloudServerMaxRam() = round(1.048.576 × 0,5) = 524.288` → alle 15 stehen im
Spielstand auf **exakt 524.288 GB**. **Der Park ist am Deckel; Geld kann daran
nichts ändern.**

Bleibt home: `getUpgradeHomeRamCost = currentRam × 32000 × 1,58^log2(currentRam) ×
HomeComputerRamCost(1,5)` (`PlayerObjectServerMethods.ts:30-40`,
`Server/data/Constants.ts:3`). Für 131.072 GB:
`131072 × 32000 × 1,58^17 × 1,5 = ` **14,99 Bio $** für +131.072 GB (+1,64 % Netz).
`homegrow.js:112` verlangt das Dreifache, also **45 Bio $** — bei 4,20 Bio $/h in
etwa **7,5 h** erreicht. Und dieser Speicher ginge zu 100 % an `joesguns`, denn
die Stapelkalender sind unabhängig vom Netz und `SHARE_MAX` ist erreicht.
**14,99 Bio $ für null zusätzliches Einkommen und null Rang.**

### 6.2 Tür 2: Hash-Tausch gegen Bladeburner-Rang → **geschlossen**

Das Spiel kennt „Exchange hashes for 100 Bladeburner Rank" und „Exchanges hashes
for 10 Bladeburner Skill Points", je 250 Hashes pro Stufe
(`Hacknet/data/HashUpgradesMetadata.tsx:90-107`). Das ist die einzige *direkte*
Geld→Rang-Umwandlung im Spiel.

Sie setzt Hacknet-**Server** voraus:
```
hasHacknetServers() = canAccessBitNodeFeature(9) && !disableHacknetServer
canAccessBitNodeFeature(9) = (bitNodeN === 9 || activeSourceFileLvl(9) > 0)
```
(`Hacknet/HacknetHelpers.tsx:34-36`, `BitNode/BitNodeUtils.ts:17-19`)

Der Spielstand führt SourceFiles **{1:1, 4:1, 5:1, 6:1, 10:1}** — **kein SF9**,
und der Knoten ist 10. **In diesem Lauf gibt es keine Hashes.** Genau deshalb legt
`hashes.js` die Datei `data/keine-hacknet.txt` an (`bn4net.js:2832-2843`).

### 6.3 Tür 3: Geld → zusätzliche Sleeves → Bladeburner-Aufträge → **geschlossen, um elf Größenordnungen**

Das ist der einzige Weg, auf dem Geld in BN10 den Rang skalieren könnte, und er
ist verlockend nah: `getSleeveCost(n) = 10^n × 10e12`
(`PersonObjects/Sleeve/SleeveCovenantPurchases.tsx:13-27`), also **10 Bio $ für den
ersten** — das Konto stand um 01:53 bei 13,78 Bio $. Bis zu 5 Sleeves
(`MaxSleevesFromCovenant = 5`); jeder zusätzliche Sleeve kann Bladeburner-Aufträge
und Field Analysis fahren, und beides gibt Rang (`Bladeburner.ts:1029-1039`,
`:1134-1145`).

**Aber:** `canPurchaseSleeve()` verlangt Mitgliedschaft in *The Covenant*, und
deren Einladungsbedingung lautet
```
inviteReqs: [haveAugmentations(20), haveMoney(75e9), haveSkill("hacking", 850), haveCombatSkills(850)]
```
(`Faction/FactionInfo.tsx:167`)

Gegen den geeichten Ist-Zustand:

| Bedingung | Ist | erforderlich | Faktor auf die Erfahrung |
|---|---:|---:|---:|
| Augmentierungen | 15 (+2 wartend) | 20 | fehlen 5 |
| Geld | 12,26 Bio $ | 75 Mrd $ | ✅ 163-fach erfüllt |
| **Hacking** | **340** (exp 4,541e10) | **850** (exp **3,343e22**) | **7,36·10¹¹** |
| **Kampfwerte** | **100** (exp 9,48e4) | **850** (exp **6,68e21**) | **7,05·10¹⁶** |

Mit der gemessenen Erfahrungsrate — Hacking 336 → 341 in ~1,55 h entspricht
**5,68·10⁹ exp/h** — ergibt sich:

- **Level 400**: braucht 1,088e12 exp → **183 h** (rund 8 Tage). Machbar.
- **Level 850**: braucht 3,343e22 exp → **5,9·10¹² h ≈ 671 Millionen Jahre.**

**Der Covenant-Weg ist nicht schwierig, er ist unmöglich.** Und die Kampfwerte
sind noch fünf Größenordnungen weiter weg als das Hacking, während `bbtrain.js`
konstruktionsgemäß bei **100** aufhört (dem Bladeburner-Beitrittstor).

Zur Vollständigkeit: `w0r1d_d43m0n` scheidet in BN10 ebenfalls aus —
`WorldDaemonDifficulty: 2` verlangt Hacking **6.000**, also **3,54·10¹⁴² exp**.

### 6.4 Tür 4: Geld → Augmentierungen → besserer Rang → **offen, aber nicht speichergebunden**

Bladeburner-Augmentierungen (Blade's Simulacrum, die Reputationsaugs der
Bladeburners-Fraktion) heben Erfolgschance und Statwachstum und damit die
Rangrate. In BN10 kosten sie `AugmentationMoneyCost: 5` und
`AugmentationRepCost: 2` (`BitNode.tsx`, Fall 10).

**Die bindende Größe ist dort aber die Reputation, nicht das Geld.** Beleg:
`bn4rep.js` schreibt seinen Geldbedarf nach `data/geldbedarf.txt`, und
`bn4net.js:676` respektiert ihn — das Konto wächst mit 4,20 Bio $/h und verdoppelt
sich alle drei Stunden, während zwei bereits gekaufte Augmentierungen seit dem
02.09. auf den Einbau warten (M.9). **Der Grenznutzen des nächsten Dollars in
BN10 ist damit praktisch null.**

Gym-Training (Kampfwerte → Bladeburner-Erfolgschance) kostet Millionen, nicht
Billionen, und ist bei 4,20 Bio $/h ohnehin frei.

### 6.5 Antwort auf Frage 6

**In BitNode 10 Lauf 2 ist die Brache folgenlos für den Ausgang.** Die Rechnung:

- Ausgang = Rang 400.000. Ist 661. Rate 40,0 Rang/h → linear **9.983 h ≈ 416 Tage.**
- Der zusätzliche Dollar kann daran nichts ändern: Serverpark am harten Deckel,
  Hashes gesperrt, Covenant um 11 Größenordnungen entfernt, Augmentierungen
  reputationsgebunden.
- Die Rangrate zu vervielfachen ist Aufgabe von `blade.js` (Skillpunkte,
  Truppgröße, Chaosverwaltung, Aktionswahl) — **alles Größen, die kein Geld
  kosten.** 216 Skillpunkte sind vergeben, 0 offen.

**Die Brache ist in BN10 nicht schädlich, aber sie ist auch nicht das Problem.
Das Problem ist, dass die Rangrate bei 40/h steht.**

Zwei Einschränkungen dieser Antwort, die ich ausdrücklich benenne:
1. Die 416 Tage sind **linear** gerechnet. Real beschleunigt sich der Rang, weil
   höhere Ränge bessere Operationen freischalten und Skillpunkte zurückfließen.
   Der Projektstand nennt für BN6 aus vergleichbarer Lage 71–148 h. Die
   Größenordnung „nicht in Stunden, sondern in Tagen" bleibt trotzdem stehen.
2. Der Schaden nach 5.3(b) — rund **325 Mio $/s entgangener Stapelertrag** —
   ist in BN10 gleichgültig, in jedem geldknappen Knoten aber nicht.

### 6.6 In welchen der 40 Restläufe ist die Brache **nicht** folgenlos?

Aus `src/route.json` (40 Einträge) und den Multiplikatoren aus `BitNode.tsx`:

**A — Die zehn V1-Läufe: dort ist die Brache der Motor des Ausgangs.**
Der Ausgang ist `w0r1d_d43m0n`, also das Hacking-Level selbst. Der Restposten aufs
Erfahrungsziel ist dort **genau die richtige Verwendung** und muss eher größer
werden, nicht kleiner.

| Knoten | Läufe | `WorldDaemonDifficulty` | nötiges Hacking | `HackExpGain` |
|---|---|---:|---:|---:|
| BN1 | L2, L3 | **5** | **15.000** | 1 |
| BN5 | L2, L3 | 1,5 | 4.500 | 0,5 |
| BN12 | L1, L2, L3 | steigend je Stufe | steigend | sinkend |
| BN8 | L1, L2, L3 | (nicht gesetzt) 1 | 3.000 | 1 |

BN1 mit Hacking 15.000 ist der mit Abstand größte Erfahrungsposten der ganzen
Route.

**B — Die 26 V2-Läufe ab BN9: dort wird Geld direkt in Rang tauschbar.**
In BN9 selbst gilt `bitNodeN === 9`, ab BN9 L1 gilt `activeSourceFileLvl(9) > 0` —
`canAccessBitNodeFeature(9)` ist damit **von BN9 L1 an in jedem weiteren Knoten der
Route wahr**. Hacknet-Server, Hashes und „Exchange for 100 Bladeburner Rank" /
„10 Bladeburner Skill Points" stehen überall zur Verfügung. Nach Routenreihenfolge:
BN9 ×3, BN2 ×3, BN3 ×3, BN11 ×3, BN6 ×2, BN7 ×3, BN14 ×3, BN13 ×3, BN15 ×3 =
**26 Läufe**, in denen jeder Dollar über den Hash-Umweg unmittelbar Rang wird und
damit den Ausgang beschleunigt. Jedes Gigabyte, das dort an `joesguns` geht, ist
verlorener Rang.

Innerhalb dieser Gruppe sind die **drei BN9-Läufe der schärfste Fall**:
`CloudServerLimit: 0` — es gibt **keine** Mietrechner, das Netz besteht aus home
und den Hacknet-Servern. Dazu `HackExpGain: 0.05` und `ScriptHackMoney: 0.1`. Der
uneingeschränkte Restposten aus `:2574` schiebt dort knappen Speicher in eine
Erfahrung, die um Faktor 20 gedämpft ist, während dieselben Gigabyte über die
Hash-Rate direkt Rang erzeugt hätten.

**C — Die vier V2-Läufe vor BN9 (BN10 L2/L3, BN4 L2/L3): dort ist die Brache folgenlos**, aus
den Gründen aus 6.1–6.4. In BN4 kommt hinzu, dass `HackExpGain: 0.4` und
`WorldDaemonDifficulty: 3` gelten, der Weg aber ohnehin V2 ist.

**Zusammenfassung der Einordnung:**

| Gruppe | Läufe | Brache … |
|---|---:|---|
| V1-Knoten (BN1 ×2, BN5 ×2, BN12 ×3, BN8 ×3) | **10** | **ist der Ausgang selbst** — beibehalten, ausbauen |
| V2-Knoten ab BN9 (Hashes verfügbar) | **26** | **kostet direkt Rang** — Geld ist Rang |
| V2-Knoten vor BN9 (BN10 ×2, BN4 ×2) | **4** | folgenlos für den Ausgang |

**In 36 von 40 Restläufen ist die heutige Verwendung des Netzes also eine
Entscheidung mit Folgen — in 10 davon die richtige, in 26 davon die falsche.**
Nur die vier Läufe, in denen der Bot gerade steht, sind der Sonderfall, in dem es
egal ist. Das ist der stärkste Grund, den Restposten aus `:2574-2583` **an das
Verfahren des Knotens zu binden** (`data/verfahren.txt` liegt bereits vor und wird
in `:2825-2831` schon gelesen), statt ihn wie heute unbedingt laufen zu lassen.

---

## 7. Befundliste zum Abhaken

| Nr. | Befund | Beleg | Status |
|---|---|---|---|
| A5.1 | A1-Regel `:685-705` ist im laufenden Spiel per Konstruktion tot (`15 < 15`) | `:685`, `ServerPurchases.ts:92-94`, Spielstand 15 werk-Server | OFFEN |
| A5.2 | Kaltstart-Leiter `:733-749` ebenfalls tot, gleiche Bedingung `:708` | `:708`, `:733` | OFFEN |
| A5.3 | A1-Regel ist im Kaltstart **teurer** als die Leiter (Faktor 2 gegen 1,0) | `:692` gegen `:740` | OFFEN |
| A5.4 | Kaltstart-Leiter endet bei 32 GB, begründet mit `darkweb.js` = 27,65 GB; gemessen **2,65 GB** | `:729`, `calculateRam` 01:54 | OFFEN |
| A5.5 | Serverpark BN10 am absoluten Deckel: 15 × 524.288 GB, beide Limits binden | `ServerPurchases.ts:92-101`, Spielstand | OFFEN |
| A5.6 | In BN9 gibt es **keine** Mietrechner (`CloudServerLimit: 0`) — die Bauform „Werkbank = gekaufter Rechner" trägt dort nicht | `BitNode.tsx` Fall 9 | OFFEN |
| A5.7 | `brachAnteil` schwingt im ~35-s-Takt zwischen 0,84 und 0,0004; beide Auftragswerte sind Phasen derselben Schwingung | 14 Abtastungen 01:42–01:44 | OFFEN |
| A5.8 | `homegrow.js:112` und `bn4net.js:886` entscheiden über diese Schwingung, also nach Zufall | `homegrow.js:106-118`, `:886` | OFFEN |
| A5.9 | „unter 1 % des Netzes für Stapel" ist falsch: 4,9–5,5 % belegt, 9,5 % Deckel; die 19.705 GB sind die Kapazität der **offenen** Ziele | `:2372-2375`, Telemetrie | OFFEN |
| A5.10 | `F_NETZANTEIL = 0.15` ist unerreichbar (1.199.635 GB gefordert, 535.062 GB maximal) — `f` klemmt am Leiterende, `grenzErtrag()` rechnet trotzdem damit | `:1980`, `:2124`, `:2143-2148`, Telemetrie `fraction: 0.5` | OFFEN |
| A5.11 | `SHARE_MAX = 200000` bindet, nicht `SHARE_ANTEIL` — der Kommentar `:1469-1472` sagt das Gegenteil | `:1474`, Spielstand 200.000 Fäden | OFFEN |
| A5.12 | Stapelziele werden nach $/GB·s sortiert, obwohl GB im Überfluss und Kalenderplätze knapp sind; `the-hub` (58 % des Ertrags) wird zuletzt bedient | `:1240-1243`, `:2182`, Telemetrie | OFFEN |
| A5.13 | Der Restposten `:2574-2583` bindet 60–84 % des Netzes und nimmt den Stapeln in 2 von 3 Runden das Budget; ~325 Mio $/s entgangener Ertrag | `:2574-2583`, Telemetrie `neueStapel 6/6/1` | OFFEN |
| A5.14 | `data/bn4net-log.txt`: 197 von 201 Zeilen sind dieselbe Meldung — das Log kann keinen Stillstand mehr belegen | `:389`, `:2455`, Abruf 01:47 | OFFEN |
| A5.15 | Stillstandserkennung `:2713-2739` deckt `wakelock.js` nicht ab — das Werkzeug, dessen Vorfall sie ausgelöst hat | `:59-65`, `:2710-2712` | OFFEN |
| A5.16 | Covenant-Sleeves (10 Bio $, bezahlbar) sind über Hacking 850 gesperrt — Faktor 7,4·10¹¹ auf die Erfahrung | `FactionInfo.tsx:167`, geeichte Formel | OFFEN |
| A5.17 | Hash→Rang ist in BN10 gesperrt (kein SF9), wird aber ab BN9 L1 in **26** Restläufen zur direkten Geld→Rang-Umwandlung | `HacknetHelpers.tsx:34`, `HashUpgradesMetadata.tsx:90-107`, `route.json` | OFFEN |
| A5.18 | Kontostand im Auftrag (10,9 Bio) war ~3 h alt; maßgeblich ist die Rate: **4,20 Bio $/h**, Verdopplung alle 3 h | Messung 01:50→01:53 | OFFEN |

---

## 8. Was ich **nicht** belegen kann

- **Ob die Stillstandserkennung seit dem 02.09. jemals ausgelöst hat.** Der
  Ringpuffer reicht nicht weit genug zurück und ist von einer einzigen Meldung
  überflutet. Ein Negativbefund wäre hier ungültig, weil das benutzte Werkzeug den
  ausgeschlossenen Fall gar nicht anzeigen könnte.
- **Die Kaltstart-Einnahmerate von 260 $/s.** Sie stammt aus dem Kommentar
  `:725` (BitNode 6) und ist von mir nicht nachgemessen; alle daraus abgeleiteten
  Stundenangaben in 2.3 und 4.3 sind entsprechend unsicher. Die *Preise* sind
  dagegen aus der Spielformel gerechnet und belastbar.
- **Der genaue Ertragsverlust durch 5.3(b).** Die 325 Mio $/s folgen aus der
  gemessenen Kalenderauslastung von `the-hub` (67 %) mal seinem gemeldeten
  Vollertrag. Wie viel davon auf die Budgethungerrunden und wie viel auf normale
  Anlaufeffekte entfällt, ist nicht getrennt gemessen.
- **Der reale, nichtlineare Rangverlauf bis 400.000.** Die 416 Tage sind eine
  lineare Fortschreibung von 40,0 Rang/h und mit Sicherheit zu pessimistisch.
