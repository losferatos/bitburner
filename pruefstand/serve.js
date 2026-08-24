/**
 * Pruefstand-Webserver fuer den BitNode-Ausgangstest.
 *
 * WARUM ES DIESEN SERVER GIBT
 *
 * Der echte Spielstand liegt auf https://bitburner-official.github.io/ und ist
 * rund hundert Stunden Arbeit. Bitburner speichert in IndexedDB (db.ts:28,
 * :83-84, :119-120): Datenbank "bitburnerSave", Store "savestring",
 * Schluessel "save". IndexedDB ist **pro Origin**. Ein zweiter Tab derselben
 * URL teilt sich also dieselbe Datenbank und denselben Schluessel, beide
 * Instanzen autospeichern darauf, und der Stand waere mit hoher
 * Wahrscheinlichkeit ueberschrieben. Ein privates Fenster hilft nicht - es
 * trennt Sitzungen, nicht Herkuenfte.
 *
 * Deshalb faehrt jeder Ausgangstest auf einem EIGENEN Origin:
 * http://localhost:8799. Eigener Origin heisst eigene IndexedDB, und damit
 * kann der Pruefstand den echten Stand physisch nicht anfassen - das ist eine
 * Eigenschaft des Browsers, keine Abmachung, an die man sich halten muss.
 *
 * WAS AUSGELIEFERT WIRD
 *
 * Der Quelltextbaum unter reference/bitburner-src, gebaut mit
 * `npx webpack --mode production`. webpack.config.js:39 setzt publicPath auf
 * "/dist" und :57 legt die index.html eine Ebene UEBER dist ab - also muss die
 * Wurzel des Baums ausgeliefert werden, nicht der dist-Ordner.
 *
 * reference/ ist in .gitignore; der Build liegt also bewusst ausserhalb des
 * Repos, nur dieser Server ist versioniert.
 *
 * Aufruf:  node pruefstand/serve.js
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Das Projekt ist ein ES-Modul-Paket (package.json "type": "module"), deshalb
// gibt es __dirname nicht - er wird aus import.meta.url hergeleitet.
const HERE = path.dirname(fileURLToPath(import.meta.url));

const PORT = 8799;
const ROOT = path.resolve(HERE, "..", "reference", "bitburner-src");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  // Nur der Pfad zaehlt; ein Query-Teil wuerde sonst im Dateinamen landen.
  let rel = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (rel === "/") rel = "/index.html";

  // Pfadausbruch verhindern: erst aufloesen, dann pruefen, ob das Ergebnis
  // noch unter ROOT liegt. Ein "../.." im Pfad kaeme sonst an den ganzen
  // Rechner heran.
  const file = path.resolve(ROOT, "." + rel);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("verboten");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("nicht gefunden: " + rel);
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      // Der Pruefstand wird oft neu gebaut - ein Cache wuerde alte Buendel
      // ausliefern und Messungen verfaelschen.
      "cache-control": "no-store",
    });
    res.end(data);
  });
});

if (!fs.existsSync(path.join(ROOT, "index.html"))) {
  console.error("index.html fehlt in " + ROOT);
  console.error("Erst bauen:  cd reference/bitburner-src && npx webpack --mode production");
  process.exit(1);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log("Pruefstand laeuft auf http://localhost:8799");
  console.log("Wurzel: " + ROOT);
  console.log("");
  console.log("Eigener Origin = eigene IndexedDB. Der echte Spielstand auf");
  console.log("bitburner-official.github.io ist hiervon nicht erreichbar.");
});
