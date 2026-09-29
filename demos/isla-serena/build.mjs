// Baut die Demo zu einer einzigen, eigenständigen HTML-Datei (alles inline, keine Netzwerkzugriffe).
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const watch = process.argv.includes('--dev');

const result = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: !watch,
  write: false,
  target: ['es2020'],
  loader: { '.glb': 'binary', '.jpg': 'dataurl', '.png': 'dataurl', '.glsl': 'text' },
  legalComments: 'none',
});

const js = result.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
const css = fs.readFileSync('src/style.css', 'utf8');
const body = fs.readFileSync('src/body.html', 'utf8');

const head = `<title>Isla Serena Drive</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${css}</style>`;

// Artifact-Variante: ohne eigenes <html>/<head>/<body> (wird beim Publizieren umhüllt)
const fragment = `${head}\n${body}\n<script>${js}</script>\n`;
// Eigenständige Variante zum Doppelklicken
const full = `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n${head}\n</head>\n<body>\n${body}\n<script>${js}</script>\n</body>\n</html>\n`;

fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/isla-serena.html', full);
fs.writeFileSync('dist/artifact.html', fragment);
console.log(`dist/isla-serena.html  ${(full.length / 1024 / 1024).toFixed(2)} MB`);
