import { expect, test } from '@playwright/test';

interface GameHandle {
  __game: { scene: { leader?: { x: number; rings: number } }; frame: number };
}

test('boots and Sonic can run', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
  });
  await page.goto('/?zone=test');
  await page.waitForFunction(() => (window as unknown as GameHandle).__game?.frame > 30);
  const x0 = await page.evaluate(() => (window as unknown as GameHandle).__game.scene.leader!.x);
  await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowRight');
  const x1 = await page.evaluate(() => (window as unknown as GameHandle).__game.scene.leader!.x);
  expect(x1).toBeGreaterThan(x0 + 200);
  await page.locator('canvas').screenshot({ path: 'test-results/boot.png' });
  expect(errors.filter((e) => !e.includes('404'))).toEqual([]);
});
