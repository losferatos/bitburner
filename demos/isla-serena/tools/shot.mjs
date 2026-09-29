// Headless-Screenshots (SwiftShader) zum Prüfen der Optik: node tools/shot.mjs out.png "t=17&cam=0" wartezeit_s
import { chromium } from 'playwright-core';
import path from 'node:path';
const [out = 'shot.png', query = '', wait = '6', w = '960', h = '540', js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const url = 'file://' + path.resolve('dist/isla-serena.html') + '?auto&' + query;
const t0 = Date.now();
await page.goto(url);
try { await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('gone'), null, { timeout: 240000 }); } catch (e) { logs.push('TIMEOUT waiting for loader'); }
console.log('load s', ((Date.now() - t0) / 1000).toFixed(1));
const q = new URLSearchParams(query);
if (q.has('js')) await page.evaluate(q.get('js'));
if (js) await page.evaluate(js);
await page.waitForTimeout(+wait * 1000);
await page.screenshot({ path: out, timeout: 180000 });
const info = await page.evaluate(() => { const d = window.__demo; if (!d) return null; const i = d.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, cam: d.director.name, hour: d.sky.hour.toFixed(2), fps: document.getElementById('hud-fps').textContent }; });
console.log(JSON.stringify(info));
console.log(logs.filter(l => !l.includes('GPU stall')).slice(0, 30).join('\n'));
await browser.close();
