# Remote File API (RFA) — Protokoll fuer einen eigenen WebSocket-Server

**Quellstand:** Bitburner Release **v3.0.1**, Baum `reference\v301`.
Alle Zeilennummern beziehen sich auf diesen Stand. Modul: `src/RemoteFileAPI/` (4 Dateien).

---

## 1. Wer verbindet zu wem

**Das Spiel ist der WebSocket-CLIENT. Dein Programm ist der SERVER.**

Das ist der wichtigste Punkt und der haeufigste Denkfehler. Trotz des Namens "Remote File API"
oeffnet Bitburner selbst eine ausgehende WebSocket-Verbindung zu der Adresse, die in den
Spieloptionen steht. Du musst also einen WebSocket-Server aufmachen und darauf warten,
dass das Spiel sich verbindet.

```
src/RemoteFileAPI/Remote.ts:42   const address = (Settings.UseWssForRemoteFileApi ? "wss" : "ws") + "://" + this.ipaddr + ":" + this.port;
src/RemoteFileAPI/Remote.ts:48   this.connection = new WebSocket(address);
```

Der Verbindungsaufbau wird ausgeloest:

| Ausloeser | Quelle |
| --- | --- |
| Automatisch 2 Sekunden nach dem Laden des Spiels | `src/index.tsx:37` — `setTimeout(newRemoteFileApiConnection, 2000);` |
| Manuell ueber Options -> Remote API -> Button "Connect" | `src/GameOptions/ui/RemoteAPIPage.tsx:161` |
| Automatischer Reconnect nach Verbindungsabbruch | `src/RemoteFileAPI/Remote.ts:92-106` |

Der Aufbau wird ganz uebersprungen, wenn der Port 0 ist oder groesser als 65535
(`src/RemoteFileAPI/RemoteFileAPI.ts:8`). Port 0 ist der Auslieferungszustand und bedeutet
"Feature aus".

**Konsequenz fuer die Umsetzung:** Es genuegt ein einfacher WS-Server (z. B. `ws` in Node,
`websockets` in Python). Kein TLS noetig, solange der Spieler den Schalter "Use wss" auf
aus laesst — das ist der Auslieferungszustand (`src/Settings/Settings.ts:51`).

---

## 2. Nachrichtenformat

Das Format ist **JSON-RPC-2.0-aehnlich, aber NICHT konform**. Die Doku im Spiel sagt das
ausdruecklich: "All APIs use an input/output format similar to the JSON RPC 2.0 protocol"
(`src/Documentation/doc/en/programming/remote_api.md:38`).

Es gibt nur **eine** Klasse fuer beide Richtungen:

```ts
src/RemoteFileAPI/MessageDefinitions.ts:4-21
export class RFAMessage {
  jsonrpc = "2.0";
  public method?: string;
  public result?: ResultType;
  public params?: FileDescription;
  public error?: string;
  public id?: number;
  ...
}
```

### Anfrage (dein Server -> Spiel)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "pushFile",
  "params": { "filename": "test.js", "content": "...", "server": "home" }
}
```

### Antwort (Spiel -> dein Server), Erfolg

```json
{ "jsonrpc": "2.0", "id": 1, "result": "OK" }
```

### Antwort (Spiel -> dein Server), Fehler

```json
{ "jsonrpc": "2.0", "id": 1, "error": "Invalid hostname: hone" }
```

### Abweichungen von echtem JSON-RPC 2.0 — wichtig beim Parsen

1. **`error` ist ein reiner String**, kein Objekt mit `code`/`message`/`data`.
   `src/RemoteFileAPI/MessageDefinitions.ts:9` — `public error?: string;`
   Es gibt **keine** numerischen Fehlercodes. Wer eine JSON-RPC-Bibliothek einsetzt,
   die `error: {code, message}` erwartet, faellt hier auf die Nase.
2. **Das Feld `jsonrpc` der eingehenden Nachricht wird nie geprueft.** Das Spiel liest nur
   `method`, `params` und `id` (`src/RemoteFileAPI/Remote.ts:120-127`). Du kannst `jsonrpc`
   weglassen; es funktioniert trotzdem. Umgekehrt setzt das Spiel es in jeder Antwort.
3. **`id` ist optional und wird ungeprueft durchgereicht.** Das Spiel spiegelt genau das
   zurueck, was es bekommen hat. Ist `id` nicht gesetzt, faellt das Feld in der Antwort
   durch `JSON.stringify` weg (undefined-Felder werden nicht serialisiert). Du bekommst
   dann `{"jsonrpc":"2.0","result":"OK"}` ohne `id`.
4. **`id` muss keine Zahl sein.** Typisiert ist `number`, aber es findet keinerlei
   Laufzeitpruefung statt — der Wert wird nur kopiert. Trotzdem: bei Zahlen bleiben.
5. **Keine Batch-Requests.** Ein `JSON.parse` je WebSocket-Nachricht, kein Array-Handling.
   Ein Array als Nachricht ergaebe `msg.method === undefined` und damit den Fehler
   "Unknown message received".
6. **Nur Text-Frames.** `JSON.parse(e.data as string)` — Binaerframes wuerden zu einer
   nicht abgefangenen Exception fuehren.

---

## 3. Die 11 Methoden vollstaendig

Definiert in `src/RemoteFileAPI/MessageHandlers.ts:88-263` (Objekt `RFARequestHandler`).

Es gibt genau vier Parameter-Formen (`src/RemoteFileAPI/MessageDefinitions.ts:38-56`):

| Form | Felder | Pruefer |
| --- | --- | --- |
| `FileData` | `filename`, `content`, `server` | `isFileData` (`:67`) |
| `FileLocation` | `filename`, `server` | `isFileLocation` (`:72`) |
| `FileServer` | `server` | `isFileServer` (`:82`) |
| (keine) | — | — |

Die Pruefer sind reine `typeof x === "string"`-Tests. Zusaetzliche, unbekannte Felder
in `params` werden **ignoriert**, nicht abgelehnt.

### 3.1 `pushFile` — Datei anlegen oder ueberschreiben

`src/RemoteFileAPI/MessageHandlers.ts:89-98`

- **params:** `{ filename: string, content: string, server: string }`
- **result:** `"OK"` (String)
- Ruft `server.writeToContentFile(path, content)` auf (`src/Server/BaseServer.ts:288`).
  Existierende Dateien werden kommentarlos ueberschrieben
  (`src/Server/BaseServer.ts:255-268` fuer Skripte, `:272` fuer Textdateien).
- **Loest KEIN Spielspeichern aus.** Die Option `SaveGameOnFileSave`
  (`src/Settings/Settings.ts:53`) wirkt nur im spielinternen Skripteditor
  (`src/ScriptEditor/ui/utils.ts:97`), nicht im RFA-Pfad.

### 3.2 `getFile` — Dateiinhalt lesen

`src/RemoteFileAPI/MessageHandlers.ts:100-113`

- **params:** `{ filename: string, server: string }`
- **result:** Dateiinhalt als String
- Fehler wenn die Datei nicht existiert (siehe Fehlerliste unten).

### 3.3 `getFileMetadata` — Zeitstempel einer Datei

`src/RemoteFileAPI/MessageHandlers.ts:115-134`

- **params:** `{ filename: string, server: string }`
- **result:** `{ filename: string, atime: number, mtime: number, btime: number }`

**Achtung, Doku-Fehler im Spiel:** Die mitgelieferte Doku
(`src/Documentation/doc/en/programming/remote_api.md:128-133`) behauptet, `atime`/`btime`/`mtime`
seien Strings. Der Code liefert **Zahlen** — Millisekunden aus `Date.now()`
(`src/Paths/FileMetadata.ts:12-17` und `:30-36`). Verlass dich auf den Code.

Bedeutung: `atime` = letzter Lesezugriff, `mtime` = letzte Aenderung, `btime` = Erzeugung
(`src/Paths/FileMetadata.ts:4-9`).

### 3.4 `deleteFile` — Datei loeschen

`src/RemoteFileAPI/MessageHandlers.ts:136-149`

- **params:** `{ filename: string, server: string }`
- **result:** `"OK"`
- Delegiert an `BaseServer.removeFile` (`src/Server/BaseServer.ts:180`). Ein laufendes Skript
  kann nicht geloescht werden — dann kommt ein Fehler zurueck.

### 3.5 `getFileNames` — Dateinamen eines Servers

`src/RemoteFileAPI/MessageHandlers.ts:151-161`

- **params:** `{ server: string }`
- **result:** `string[]`
- **Reihenfolge:** erst alle Textdateien, dann alle Skripte
  (`:158` — `[...server.textFiles.keys(), ...server.scripts.keys()]`).
- Enthaelt **nicht**: Programme (`.exe`), Literatur (`.lit`), Contracts (`.cct`),
  Cache-Dateien.

### 3.6 `getAllFiles` — alle Dateien mit Inhalt

`src/RemoteFileAPI/MessageHandlers.ts:163-175`

- **params:** `{ server: string }`
- **result:** `{ filename: string, content: string }[]`
- **Reihenfolge hier umgekehrt zu `getFileNames`:** erst Skripte, dann Textdateien
  (`:170` — `[...server.scripts, ...server.textFiles]`). Diese Inkonsistenz steht so im Code.

### 3.7 `getAllFileMetadata` — alle Dateien mit Zeitstempeln

`src/RemoteFileAPI/MessageHandlers.ts:177-189`

- **params:** `{ server: string }`
- **result:** `{ filename: string, atime: number, mtime: number, btime: number }[]`
- Reihenfolge wie bei `getAllFiles`: Skripte zuerst.

### 3.8 `calculateRam` — RAM-Bedarf eines Skripts

`src/RemoteFileAPI/MessageHandlers.ts:191-217`

- **params:** `{ filename: string, server: string }`
- **result:** `number` (GB)
- Zusaetzliche Pruefung: die Datei muss eine **Skript**-Endung haben, nicht nur irgendeine
  gueltige Endung (`:199`). Eine `.txt` ergibt hier einen Fehler.
- Ruft `script.getRamUsage(server.scripts)` auf; das kann fehlschlagen, wenn das Skript
  nicht parsebar ist oder Importe fehlen.

### 3.9 `getDefinitionFile` — NetscriptDefinitions.d.ts

`src/RemoteFileAPI/MessageHandlers.ts:219-221`

- **params:** keine (werden nicht angesehen)
- **result:** der komplette Inhalt von `src/ScriptEditor/NetscriptDefinitions.d.ts` als String
- Wird zur Uebersetzungszeit eingebunden (`:15` — `import libSource from "...?raw"`), ist also
  ein Konstantenwert. **Grossenordnung: mehrere hundert Kilobyte.** Diese Antwort ist die
  groesste, die im normalen Betrieb vorkommt (ausser `getSaveFile`).

### 3.10 `getSaveFile` — Spielstand abholen

`src/RemoteFileAPI/MessageHandlers.ts:223-252`

- **params:** keine
- **result:** `{ identifier: string, binary: boolean, save: string }`
- **Die einzige asynchrone Methode.** Der Handler ist `async` und der Versand passiert in
  `void response.then(...)` (`src/RemoteFileAPI/Remote.ts:130-133`). Siehe Abschnitt 6
  zur Reihenfolge.
- `identifier` ist ein Spieler-Kennzeichen (`Player.identifier`, `src/PersonObjects/Player/PlayerObject.ts:71`).
- Ist `binary: true`, wurde ein `Uint8Array` byteweise in einen String umgesetzt
  (`String.fromCharCode` je Byte, `:239-242`). Zum Zurueckwandeln jedes Zeichen per
  `charCodeAt(0)` nehmen. **Nicht** UTF-8-dekodieren — der String enthaelt Codepoints 0-255,
  und wenn du ihn als UTF-8 behandelst, zerlegst du ihn.
- Dies ist die groesste Antwort ueberhaupt; ein gewachsener Spielstand ist mehrere Megabyte.

### 3.11 `getAllServers` — Serverliste

`src/RemoteFileAPI/MessageHandlers.ts:254-262`

- **params:** keine
- **result:** `{ hostname: string, hasAdminRights: boolean, purchasedByPlayer: boolean }[]`
- **Wichtige Luecke:** Der Aufruf ist `GetAllServers()` ohne Argument. Der Parameter heisst
  `showDarkweb` und ist standardmaessig `false`
  (`src/Server/AllServers.ts:58-67`). Damit fehlen **alle DarknetServer** in der Antwort,
  inklusive `darkweb` selbst. Wer in BitNode 15 oder mit dem `darkscape`-Programm spielt,
  bekommt ueber diese Methode also ein unvollstaendiges Bild des Netzes. Die
  Netscript-Funktion `scan()` im Spiel zeigt sie sehr wohl.
- Es gibt **keine** weiteren Felder — kein RAM, kein Geld, kein Hacking-Level. Wer
  Zielserverdaten braucht, muss ein Skript im Spiel laufen lassen und die Daten in eine
  Datei schreiben, die man dann per `getFile` abholt.

---

## 4. Standardport

**Es gibt keinen im Code erzwungenen Standardport.** Der Auslieferungswert ist 0 und
bedeutet "aus":

```
src/Settings/Settings.ts:45   RemoteFileApiAddress: "localhost",
src/Settings/Settings.ts:47   RemoteFileApiPort: 0,
src/Settings/Settings.ts:49   RemoteFileApiReconnectionDelay: 0,
src/Settings/Settings.ts:51   UseWssForRemoteFileApi: false,
```

**12525** ist die einzige Zahl, die im Code als Portvorschlag auftaucht — als Platzhaltertext
im Eingabefeld (`src/GameOptions/ui/RemoteAPIPage.tsx:122` — `placeholder="12525"`). Das ist
die Konvention, die alle Gemeinschaftswerkzeuge verwenden. **Nimm 12525**, dann muss der
Spieler nichts umstellen ausser die 0 zu ersetzen.

Gueltiger Bereich: 0 bis 65535 einschliesslich (`src/Settings/SettingsUtils.ts:65-70`).
Der Verbindungsversuch wird abgebrochen bei Port 0 oder > 65535
(`src/RemoteFileAPI/RemoteFileAPI.ts:8`) — beachte, dass diese Pruefung negative Werte
nicht abfaengt, die Validierung beim Setzen aber schon.

**Hostname-Regeln** (`src/Settings/SettingsUtils.ts:24-62`):
- darf nicht leer sein
- darf kein Schema enthalten (`http://`, `https://` werden abgelehnt)
- darf keinen Port, Pfad oder Query-Teil enthalten
- IPv6 muss in eckigen Klammern stehen, z. B. `[::1]` (`src/GameOptions/ui/RemoteAPIPage.tsx:80`)
- leerer Wert wird beim Verbinden zu `"localhost"` (`src/RemoteFileAPI/RemoteFileAPI.ts:10`)

---

## 5. Groessen, Zeitlimits, Besonderheiten

### Groessenbeschraenkungen

**Keine — weder eingehend noch ausgehend.** Es gibt im gesamten RFA-Modul keine Pruefung
auf Nachrichtenlaenge, keine Fragmentierung, keinen Puffer-Deckel. Praktische Folgen:

- Dein Server muss `maxPayload` gross genug setzen. In Node mit dem `ws`-Paket ist der
  Vorgabewert 100 MB — das reicht. Setzt du ihn kleiner, brechen `getSaveFile` und
  `getDefinitionFile` ab.
- In die andere Richtung: ein sehr grosses `pushFile` wird ohne Murren angenommen.

### Zeitlimits

**Keine.** Es gibt kein Timeout auf Anfragen, kein Ping/Pong-Keepalive im Spielcode
(der Browser macht Pong automatisch, wenn dein Server pingt — das ist Browserverhalten,
nicht Spiellogik). Wenn dein Server nicht antwortet, wartet das Spiel einfach.

Das einzige Zeitmass im Modul ist der **Reconnect-Verzug**:
`Settings.RemoteFileApiReconnectionDelay` in Sekunden, Vorgabe 0 = kein Reconnect
(`src/RemoteFileAPI/Remote.ts:92`, `:104`). Bei > 0 versucht das Spiel nach jedem
Verbindungsabbruch erneut, unbegrenzt oft.

### Besonderheiten beim Verbindungsaufbau

- **Das Spiel sendet beim Verbinden nichts.** Kein Handshake, kein Hallo, keine
  Versionsmeldung. Dein Server erfaehrt nur, dass eine Verbindung offen ist. Wenn du wissen
  willst, mit welchem Spielstand du redest, musst du selbst `getSaveFile` oder
  `getAllServers` schicken.
- **Keine Authentifizierung, kein Origin-Check, kein Subprotokoll.** `new WebSocket(address)`
  ohne zweites Argument (`src/RemoteFileAPI/Remote.ts:48`) — also kein
  `Sec-WebSocket-Protocol`. Lehnt dein Server Verbindungen ohne Subprotokoll ab, kommt
  nichts zustande.
- **Nur eine Verbindung gleichzeitig.** Das Modul haelt genau eine `Remote`-Instanz
  (`src/RemoteFileAPI/RemoteFileAPI.ts:4`); ein neuer Verbindungsversuch schliesst den
  alten zuerst (`:7`).
- **Der automatische Reconnect wird beim manuellen Verbinden vollstaendig abgeraeumt**
  (`src/RemoteFileAPI/Remote.ts:31-32`) — sonst haetten sich Reconnect-Timer gestapelt.
- **Auf Bitburner-Seite gesetztes Flag:** Beim absichtlichen Schliessen setzt das Spiel
  `connection.intentionallyClosed = true` (`src/RemoteFileAPI/Remote.ts:35`, Typ in
  `src/@types/global.d.ts`). Das ist rein spielintern und fuer dich nicht sichtbar.
- **Fehlerfaelle beim Aufbau erzeugen nur eine Snackbar-Meldung im Spiel**
  (`src/RemoteFileAPI/Remote.ts:11-13`), nichts geht nach aussen.

---

## 6. Kann der externe Server unaufgefordert senden?

**Ja — und zwar ausschliesslich er.** Die Rollenverteilung ist voellig einseitig:

- Das Spiel sendet **nur** Antworten. Der einzige Sendepfad im gesamten Modul ist
  `this.send(...)` innerhalb von `handleMessageEvent`
  (`src/RemoteFileAPI/Remote.ts:124`, `:131`, `:134`) — also immer als Reaktion auf eine
  eingehende Nachricht.
- Es gibt **keine** Push-Benachrichtigungen des Spiels: kein "Datei wurde im Editor
  geaendert", kein "Spielstand neu geladen", kein "BitNode gewechselt". Wenn du auf so
  etwas reagieren willst, musst du pollen.
- Dein Server darf jederzeit senden, so viele Anfragen wie er will, auch parallel.

### Reihenfolge der Antworten ist NICHT garantiert

Das ist die wichtigste praktische Falle. Alle Handler bis auf einen sind synchron und
antworten sofort. `getSaveFile` ist `async` und antwortet ueber ein Promise
(`src/RemoteFileAPI/Remote.ts:128-133`):

```ts
const response = RFARequestHandler[msg.method](msg);
if (!response) return;
if (response instanceof Promise) {
  void response.then((data) => this.send(JSON.stringify(data)));
  return;
}
this.send(JSON.stringify(response));
```

Schickst du `getSaveFile` und danach `getFile`, kommt die Antwort auf `getFile`
mit hoher Wahrscheinlichkeit **zuerst** zurueck. **Ordne Antworten immer ueber `id` zu,
niemals ueber die Reihenfolge.** Halte dafuer eine Map von `id` auf offenes Promise.

### `if (!response) return;`

Zeile `src/RemoteFileAPI/Remote.ts:129`: Gibt ein Handler etwas Falsches zurueck, wird gar
nicht geantwortet. Bei den elf eingebauten Methoden tritt das nie ein — alle geben eine
`RFAMessage` zurueck. Es ist eine Vorkehrung fuer Erweiterungen. Trotzdem gut zu wissen:
Wenn du auf eine Antwort wartest, brauchst du dein eigenes Timeout, denn das Spiel
garantiert nirgends, dass ueberhaupt geantwortet wird.

---

## 7. Alle Fehlermeldungen

Die Fehlermeldungen sind reine Strings im Feld `error`. Vollstaendige Liste, jeweils mit
Ausloeser:

| Meldung (wortgetreu) | Wann | Quelle |
| --- | --- | --- |
| `Unknown message received` | `method` fehlt oder ist kein bekannter Methodenname | `src/RemoteFileAPI/Remote.ts:123` |
| `Missing params` | `params` fehlt oder ist falsy, bei allen Methoden ausser den drei parameterlosen | `src/RemoteFileAPI/MessageHandlers.ts:31` |
| `Invalid params: <JSON der params>` | `params` hat nicht die geforderten String-Felder | `src/RemoteFileAPI/MessageHandlers.ts:36` |
| `Invalid file path: <filename>` | `resolveFilePath` liefert null — ungueltige Zeichen, leerer Dateiname, fehlende Endung, `..` im absoluten Pfad | `src/RemoteFileAPI/MessageHandlers.ts:53` |
| `Invalid file extension. Filename: <filename>` | Endung ist weder Text- noch Skriptendung | `src/RemoteFileAPI/MessageHandlers.ts:59` |
| `Invalid hostname: <server>` | `GetServer()` findet weder Hostname noch IP | `src/RemoteFileAPI/MessageHandlers.ts:65` (Dateimethoden) und `:82` (Servermethoden) |
| `File does not exist. Filename: <filename>` | `getFile`, `getFileMetadata` und `calculateRam`, wenn die Datei fehlt | `:109`, `:124`, `:205` |
| `File is not a script. Filename: <filename>` | `calculateRam` auf einer Textdatei | `src/RemoteFileAPI/MessageHandlers.ts:200` |
| `Cannot calculate RAM usage of an invalid script. Filename: <filename>` | `calculateRam`, wenn `getRamUsage()` scheitert (Syntaxfehler, fehlende Importe) | `src/RemoteFileAPI/MessageHandlers.ts:211` |
| `Text file <path> not found.` | `deleteFile` auf nicht vorhandener Textdatei | `src/Server/BaseServer.ts:183` |
| `Script <path> not found.` | `deleteFile` auf nicht vorhandenem Skript | `src/Server/BaseServer.ts:189` |
| `Cannot delete a script that is currently running!` | `deleteFile` auf einem laufenden Skript | `src/Server/BaseServer.ts:190` |
| `Failed` | Rueckfallwert, wenn `removeFile` fehlschlaegt ohne eigene Meldung | `src/RemoteFileAPI/MessageHandlers.ts:145` |

**Nicht abgefangen und daher kein `error`, sondern eine stillschweigend geschluckte
Ausnahme in der Browserkonsole:** kaputtes JSON in der eingehenden Nachricht.
`JSON.parse` in `src/RemoteFileAPI/Remote.ts:120` steht nicht in einem `try`. Du bekommst
darauf **gar keine Antwort**. Also immer gueltiges JSON schicken.

---

## 8. Dateipfad-Regeln (die haeufigste Fehlerquelle)

Bevor eine Datei angefasst wird, laeuft `resolveFilePath` (`src/Paths/FilePath.ts:61`).
Die Regeln stehen in `src/Paths/Directory.ts:18-31`:

**Verbotene Zeichen in Pfad und Dateiname:**
`/` (nur als Verzeichnistrenner erlaubt), `*`, `?`, `[`, `]`, `!`, `\`, `~`, `|`, `#`,
`"`, `'` sowie **jedes Leerzeichen** (`\s`).

Weitere Regeln (`src/Paths/FilePath.ts:10-15`):
- Der Dateiname muss einen Punkt mit mindestens einem Zeichen davor und danach haben.
- Kein `//` im Pfad, keine 0-langen Verzeichnisnamen.
- Fuehrende `/` werden abgeschnitten (`src/Paths/FilePath.ts:63`); `"/lib/x.js"` und
  `"lib/x.js"` sind derselbe Pfad. Im Spiel gespeichert wird die Fassung **ohne**
  fuehrenden Schraegstrich.
- `.` und `..` als Verzeichnisnamen sind in absoluten Pfaden verboten.

**Erlaubte Endungen** — nur diese kommen durch `pushFile`/`getFile`/`deleteFile`:

| Art | Endungen | Quelle |
| --- | --- | --- |
| Skript | `.js`, `.jsx`, `.ts`, `.tsx`, `.script` | `src/Paths/ScriptFilePath.ts:20` |
| Text | `.txt`, `.json`, `.css` | `src/Paths/TextFilePath.ts:8` |

`.script` ist NS1 und laesst sich nicht mehr ausfuehren, aber weiter uebertragen und
loeschen (Kommentar `src/Paths/ScriptFilePath.ts:11-19`).

**Nicht erreichbar ueber RFA:** `.exe` (Programme), `.lit` (Literatur), `.cct` (Contracts),
`.msg`, Cache-Dateien.

---

## 9. Minimalgeruest fuer einen eigenen Server (Node, `ws`)

```js
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 12525 });
let nextId = 1;

wss.on("connection", (ws) => {
  const pending = new Map(); // id -> {resolve, reject, timer}

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const entry = pending.get(msg.id);
    if (!entry) return;                 // unbekannte id: verwerfen
    pending.delete(msg.id);
    clearTimeout(entry.timer);
    if (msg.error !== undefined) entry.reject(new Error(msg.error));
    else entry.resolve(msg.result);
  });

  function call(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      // eigenes Timeout: das Spiel garantiert keine Antwort
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("RFA timeout: " + method));
      }, 30_000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  // Beispielablauf
  call("getAllServers").then(console.log);
  call("pushFile", { server: "home", filename: "hallo.js",
                     content: "export async function main(ns){ns.tprint('hi')}" });
});
```

Merkposten, die dieses Geruest bereits beruecksichtigt:
1. Zuordnung ueber `id`, nicht ueber Reihenfolge (wegen `getSaveFile`).
2. Eigenes Timeout, weil das Spiel keines hat.
3. `error` als String behandeln, nicht als Objekt.
4. Kein Subprotokoll verlangen.

---

## 10. Ablaufdiagramm im Spiel

Die Spieldoku verweist auf ein Sequenzdiagramm:
`src/Documentation/images/remote-file-api-sequence-diagram.svg`, eingebunden in
`src/Documentation/doc/en/programming/remote_api.md:34`. Inhaltlich deckt es sich mit dem
oben Beschriebenen.

Die Spieldoku nennt ausserdem vier Gemeinschaftswerkzeuge, die dasselbe Protokoll
bedienen und als Vergleichsimplementierung taugen
(`src/Documentation/doc/en/programming/remote_api.md:16-19`):
`typescript-template`, `viteburner`, `bb-external-editor`, `BitburnerGoFilesync`.

---

## Abweichungen dev vs v3.0.1

Der zunaechst geoeffnete dev-Baum (`reference\bitburner-src`, Version 3.0.2) weicht im
RFA-Modul **erheblich** ab. Wer gegen dev entwickelt, baut am gespielten Stand vorbei.

| Punkt | v3.0.1 (gespielt) | dev (3.0.2) |
| --- | --- | --- |
| Nachrichtenklassen | **eine** Klasse `RFAMessage` mit lauter optionalen Feldern | aufgeteilt in `RFARequest`, `RFASuccessResponse`, `RFAErrorResponse`, gemeinsame abstrakte Basis `RFAMessage` |
| Handler-Signatur | `(message: RFAMessage) => RFAMessage \| Promise<RFAMessage>` | `(message: RFARequest) => RFAResponse \| Promise<RFAResponse>` |
| `if (!response) return;` in `handleMessageEvent` | **vorhanden** (`Remote.ts:129`) | entfernt |
| Spielstand holen | `saveObject.getSaveData()` (`MessageHandlers.ts:224`) | freie Funktion `getSaveData()` |

**Am Draht aendert sich dadurch nichts.** Die versendeten JSON-Objekte sind in beiden
Staenden identisch aufgebaut: `jsonrpc`, `id`, dazu entweder `method`+`params` oder
`result` bzw. `error`. Die Methodenliste, die Parameterformen und saemtliche
Fehlermeldungen sind Wort fuer Wort gleich. Ein Server, der gegen v3.0.1 gebaut wird,
laeuft unveraendert auch gegen dev.

Auch die Spieldoku `remote_api.md` unterscheidet sich zwischen den Staenden (67 geaenderte
Zeilen), aber nur in Formulierung und Werkzeugliste, nicht in der API-Beschreibung.
