// Usage: node tools/shot.mjs <url-query> <out-prefix> [frames...]
// Boots the built game in headless Chromium, holds keys, and saves screenshots.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const [query = '', out = '/tmp/claude-0/shots/shot', script = '[]'] = process.argv.slice(2);
const steps = JSON.parse(script); // [{wait: ms}, {down: 'ArrowRight'}, {up: 'ArrowRight'}, {shot: 'name'}, {eval: 'js'}]

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => server.stdout.on('data', (d) => d.toString().includes('4173') && res()));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({ viewport: { width: 960, height: 672 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:4173/${query}`);
await page.waitForTimeout(500);
let n = 0;
for (const s of steps) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.down) await page.keyboard.down(s.down);
  if (s.up) await page.keyboard.up(s.up);
  if (s.press) await page.keyboard.press(s.press);
  if (s.eval) console.log('eval:', JSON.stringify(await page.evaluate(s.eval)));
  if (s.shot) await page.locator('canvas').screenshot({ path: `${out}-${s.shot ?? n++}.png` });
}
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
server.kill();
process.exit(0);
