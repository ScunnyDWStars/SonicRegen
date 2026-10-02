import { expect, test, type Page } from '@playwright/test';

interface GameHandle {
  __game: { scene: { leader?: { x: number }; state?: string }; frame: number; transitioning: boolean };
}

/** Press a key once the current scene has finished fading in. */
async function press(page: Page, key: string): Promise<void> {
  await page.waitForFunction(() => !(window as unknown as GameHandle).__game.transitioning);
  await page.waitForTimeout(150);
  await page.keyboard.press(key);
  await page.waitForTimeout(100);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

const leaderX = (page: Page) =>
  page.evaluate(() => (window as unknown as GameHandle).__game.scene.leader?.x ?? null);

test('title → data select → character select → Palm Coast, and Sonic runs', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as GameHandle).__game?.frame > 30);
  await page.locator('canvas').screenshot({ path: 'test-results/title.png' });
  await press(page, 'Enter'); // PRESS START
  await press(page, 'Enter'); // PLAY
  await press(page, 'ArrowLeft'); // NO SAVE
  await press(page, 'Enter');
  await press(page, 'Enter'); // Sonic & Tails
  await page.waitForFunction(() => (window as unknown as GameHandle).__game.scene.state === 'play', null, {
    timeout: 10_000,
  });
  const x0 = (await leaderX(page))!;
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowRight');
  expect((await leaderX(page))!).toBeGreaterThan(x0 + 200);
  await page.locator('canvas').screenshot({ path: 'test-results/palm-coast.png' });
  expect(errors).toEqual([]);
});

test('every zone loads directly', async ({ page }) => {
  const errors = watchErrors(page);
  for (const zone of ['palm-coast', 'neon-refinery', 'jungle-isle']) {
    for (const act of [1, 2]) {
      await page.goto(`/?zone=${zone}&act=${act}&mute`);
      await page.waitForFunction(
        () => (window as unknown as GameHandle).__game?.scene.state === 'play',
        null,
        {
          timeout: 10_000,
        },
      );
      await page.locator('canvas').screenshot({ path: `test-results/${zone}-${act}.png` });
    }
  }
  expect(errors).toEqual([]);
});

test('special stage renders', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?special=3&mute');
  await page.waitForTimeout(1500);
  await page.locator('canvas').screenshot({ path: 'test-results/special.png' });
  expect(errors).toEqual([]);
});
