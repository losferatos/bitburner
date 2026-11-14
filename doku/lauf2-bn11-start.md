# Lauf 2, BN1.1: Startpfad bis 32 GB home (Handanleitung)

Stand 14.11.2026. Fuer eine begleitende Claude-Sitzung. BN1.1 laeuft halbautomatisch:
`coldstart.js` verdient Geld, die Haendeschritte (TOR, Knacker, home-RAM) macht
die Sitzung mit Eric. Ab 32 GB home uebernimmt der Kern (`boot.js`).

## Was gemessen ist (tools/ram.js, geeicht an 126 Live-Werten)

| Datei | GB | Rolle |
|---|---:|---|
| alter Autopilot (Commit 7ebf2a4, `autopilot.js` + `lib/calc.js`) | 7,10 | Vorlage, zu gross neben Handwerkzeug (0,9 GB frei) |
| alter Einkaeufer (`invest.js`, Commit 7ebf2a4) | 10,75 | Vorlage fuer `coldbuy.js`, zu gross |
| **`coldstart.js`** | **5,00** | Laeufer: knacken, Arbeiter, Ziele, Status |
| `coldbuy.js` | 5,75 | mietet Rechner, laeuft auf einem FREMDEN Rechner |
| `boot.js` (unveraendert) | 5,50 | passt auf 8 GB nur allein |
| `darkweb.js` | 2,65 | TOR/Knacker kaufen (DOM-Griff ueber globalThis) |
| Arbeiter weaken/grow/hack | 1,80 / 1,80 / 1,75 | |

Auf home 8 GB bleiben neben `coldstart.js` 3,0 GB frei: genau Platz fuer `darkweb.js`.
Deshalb arbeiten die Arbeiter dort NICHT auf home, sondern auf den genukten Fremdrechnern.

## Ablauf

0. Voraussetzung: Z1 (Uebergabe der Bruecke) ist durch, die Bruecke hat `src/` geschoben.
   Pruefen: Terminal `ls` zeigt `coldstart.js`, `coldbuy.js`, `worker/`, `lib/calc.js`.
   **AutoexecScript auf `coldstart.js` setzen** (Optionen; nicht `boot.js`). Warum:
   Das Spiel startet das Autoexec-Skript vor den gespeicherten Skripten. Mit `boot.js`
   (5,5 GB) wird `coldstart.js` (5,0 GB) auf 8 GB nach einem Neuladen nicht mehr
   wiederhergestellt (10,5 > 8), und auf 16 GB beendet `boot.js` es nach fuenf
   Minuten. `coldstart.js` als Autoexec laeuft bei jeder Groesse: unter 32 GB
   arbeitet es, ab 32 GB startet es `boot.js` und endet. (`boot.js` hat ausserdem
   den Zweig `home < 32 GB -> coldstart.js`, falls es doch gestartet wird.)
1. Terminal: `run coldstart.js` (oder `run coldstart.js darkweb`, siehe Schritt 3).
   `run boot.js` geht auch, schreibt auf 8 GB aber nur den Hinweis `run coldstart.js`
   nach `data/boot.txt` und beendet sich (zusammen passen sie nicht); ab 16 GB startet
   es `coldstart.js` selbst.
2. Zustand ansehen: `cat data/coldstart.txt` (alle ~10 s neu; Felder `schritt`,
   `reserve`, `ziele`, `gerootet`, `mietGb`). `schritt` nennt den naechsten Handkauf.
3. Haendeschritte in dieser Reihenfolge (`coldstart.js` haelt das Geld dafuer zurueck,
   `coldbuy.js` kauft nur darueber hinaus):

| Schritt | Preis | Wie |
|---|---:|---|
| TOR-Router | 200k | `run darkweb.js` (Spieler muss in Sector-12 stehen), oder Alt+W, Alpha Enterprises |
| BruteSSH.exe | 500k | `run darkweb.js` (kauft von billig nach teuer, was bezahlbar ist) |
| (Mieten) | 440k/8 GB | `coldbuy.js` automatisch, sobald das Geld ueber der Reserve liegt |
| home 8 -> 16 GB | 1,01 M | Alt+W, Alpha Enterprises, "Upgrade 'home' RAM" |
| FTPCrack.exe | 1,5 M | `run darkweb.js` |
| home 16 -> 32 GB | 3,19 M | wie oben |

   Reserve-Regel: TOR und BruteSSH werden immer zurueckgehalten; die teureren Posten
   erst, wenn 64 GB Mietrechner stehen (Mieten ist mit 55k/GB billiger als home-RAM
   mit 126k/GB). `run coldstart.js darkweb` startet `darkweb.js` selbst, sobald das
   Geld fuer den Handschritt da ist - es klickt durch die Oberflaeche und nimmt den
   Fokus, also nur auf Ansage.
4. **16 GB sind Zwischenstand, kein Ziel.** Kern (10,8) + Waechter (6,1) = 16,9 GB passen
   dort nicht. Auf 16 GB bleibt `coldstart.js` laufen (home arbeitet dann mit, 6 GB
   bleiben frei); `boot.js` startet unterhalb von 32 GB nur noch `coldstart.js`, es
   beendet nichts mehr.
5. Ab 32 GB home startet `coldstart.js` von selbst `boot.js` und beendet sich;
   `coldbuy.js` beendet sich ebenfalls, `shop.js` (Kern) uebernimmt das Mieten.

## Nach einem Einbau (Augmentierungen)

Der Einbau beendet alle Skripte und wirft Programme und TOR weg, setzt home aber **nicht**
zurueck: der home-RAM bleibt erhalten (`prestigeAugmentation`, Prestige.ts:55-110, ruft
kein `setMaxRam`; nur `prestigeSourceFile` setzt home auf 8/32/128 GB, Prestige.ts:245-253,
also beim Knotenwechsel). Die Skripte liegen weiter auf home. Nach dem Einbau den
home-RAM MESSEN (`getServerMaxRam` bzw. Terminal `free`), nicht annehmen:

| home nach Einbau | Was zu tun ist |
|---|---|
| 8 GB | `run coldstart.js` (`darkweb`-Argument nicht vergessen, falls gewollt) |
| 16 GB | `run coldstart.js` (`boot.js` startet es dort selbst) |
| ab 32 GB | `run boot.js`; mit gesetztem Autoexec kommt das nach einem Neuladen von selbst |

TOR und Knacker sind nach dem Einbau weg und werden wie oben neu gekauft.

## Der Sprung BN1.1 -> BN4.1 (ENTSCHEIDUNG ERICS AUSSTEHEND)

Ohne SF4 wirft jeder Singularity-Aufruf ausserhalb von BN4: `exit.js` ist dort 520 GB
gross und `destroyW0r1dD43m0n` wirft. Der Bot kann BN1.1 also nicht selbst verlassen.
Die Schutzregeln (kein Handsprung, Destroy/b1tflum3 nicht von Hand, keine Augs von
Hand) bleiben unveraendert. Ein Weg aus BN1.1 braucht deshalb eine ausdrueckliche
Ausnahme von Eric - sie steht in keiner Bau-Datei:

- Ausnahme fuer genau EINEN Handsprung BN1.1 -> BN4.1 (Augmentierungen, Red Pill,
  BitVerse von Hand, mit der begleitenden Sitzung), oder
- ein DOM-Werkzeug fuer den Ausgang (`bitverse.js`, 27,25 GB, klickt per DOM und prueft
  die Route NICHT - es muesste vorher `zielErlaubt` gegen `route-lauf2.json` fragen,
  auf einem gemieteten 32-GB-Rechner).

Nach der BitVerse-Wahl startet nichts von selbst: `prestigeSourceFile` beendet alle
Skripte, und Autoexec laeuft nur beim Laden. Also **Seite neu laden** (Autoexec
`coldstart.js` startet) oder im Terminal `run boot.js` bzw. `run coldstart.js`.
Wie lange BN1.1 bis zur Red Pill dauert, ist NICHT gemessen; die "3-4 h Sitzungszeit"
im Bauplan sind eine Schaetzung. Messen im Dev-Build-Lauf (K11), bevor
"halbautomatisch" als tragfaehig gilt.

## Exploit-Skripte im frischen Stand (Bauplan X1, geprueft 14.11.2026)

`pushAll` legt `exploit.js`, `exploit2.js`, `exploit3.js`, `hacktimer.js` und
`timerzwang.js` auf home ab. Geprueft (Suche ueber `src/`, `registry.json` und alle
Kernpfade): **keine Registry-Zeile und kein Kern startet eine davon** - die einzige
Erwaehnung ist ein Kommentar in `popups.js`. Im frischen Stand sind sie also tot, solange
niemand sie startet; ein Nebeneffekt durch das Hochladen entsteht nicht.

Gezielt starten waere erlaubt ("alles ist erlaubt", Eric 13.11.), nur mit Grenzen aus
`tools/ram.js --einzeln`:

| Datei | GB | Im frischen BN1.1 |
|---|---:|---|
| `exploit.js` | 1,6 | laeuft auf 8 GB home (neben `coldstart.js` 5,0 -> 6,6); muss GENAU 1,6 GB haben (`ns.bypass`-Bedingung), also nie veraendern. Sammelt SF-1 (je +0,1 % auf alle Multiplikatoren, ueberlebt jeden Reset), wirkt nach einem Neuladen der Seite |
| `exploit2.js` | siehe Kopf | Zeitgeber-Exploits, ohne Oberflaeche; vorher den Kopf der Datei lesen (friert `performance.now` kurz ein) |
| `exploit3.js` | 114,1 (SF4=1) | braucht SF1 und Singularity - im frischen Stand nicht startbar |
| `hacktimer.js` | 27,25 | nur mit `--scharf` wirksam, braucht einen 32-GB-Rechner; ohne SF/32 GB nicht startbar |
| `timerzwang.js` | 2,25 | Schalter fuer `hacktimer.js`, ohne diesen wirkungslos |

Der Nutzen von SF-1 ist klein (siehe Kopf von `exploit2.js`); wer ihn will, startet
`exploit.js` einmal von Hand, sobald Platz ist. Nichts davon gehoert in die Automatik.

## Was NICHT von allein geht

Faktionen, Backdoors, Beitritte, Arbeit, Augmentierungen, Einbau, Red Pill, BitVerse:
weiter Handarbeit mit `tools/task.js` (K05b im Bauplan); diese DOM-Werkzeuge kosten
heute 27-31 GB (`ram.js --einzeln`) und laufen erst auf 32-GB-Rechnern. Der Kern
(Ausgang, Route, Gewerke) ist hier nicht gemeint.

## Grenzen / offen (nichts davon gemessen)

- Einkommen auf 8 GB bis zur ersten Miete: ungemessen (Dev-Build-Lauf K11).
- `MIET_ZUERST_GB = 64`, `HACK_ANTEIL = 0.3`, `HOME_FREI_GB = 6` sind Startwerte
  (Konstanten oben in `coldstart.js`), nach dem ersten echten Lauf nachziehen.
- `coldstart.js` rechnet mit Multiplikatoren 1 (kein `getPlayer`, spart 0,5 GB):
  nach Augmentierungen rechnet es zu vorsichtig, nie zu knapp.
