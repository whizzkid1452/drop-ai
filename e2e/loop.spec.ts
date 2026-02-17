import { test, expect } from './fixtures';

test.describe('Loop Logic', () => {
  test.beforeEach(async ({ page, audio }) => {
    await page.goto('/cli-test');
    await page.locator('body').click();
    await audio.attachMeter();
  });

  test('should loop playback within range', async ({ page, audio }) => {
    // 1. Set Loop 0-2s
    await page.locator('.terminal').first().click();
    await page.keyboard.type('loop 0 2');
    await page.keyboard.press('Enter');

    // 2. Play
    await page.keyboard.type('play');
    await page.keyboard.press('Enter');

    // 3. Wait for > 2s (loop end)
    await page.waitForTimeout(2500);

    // 4. Verify Transport never exceeds ~2.1s and is running
    const seconds = await audio.getTransportSeconds();
    expect(seconds).toBeLessThan(2.2); // Tolerance for buffer
    expect(seconds).toBeGreaterThan(0);

    // 5. Verify it wraps around (hard to catch exact wrapping in poll, but if it didn't wrap it would be > 2.5s)
    // If loop was OFF, it would be around 2.5s now.
  });

  test('should disable loop', async ({ page, audio }) => {
    // 1. Set Loop Off
    await page.locator('.terminal').first().click();
    await page.keyboard.type('loop off');
    await page.keyboard.press('Enter');

    // 2. Play
    await page.keyboard.type('play');
    await page.keyboard.press('Enter');

    // 3. Wait for 3s
    await page.waitForTimeout(3000);

    // 4. Verify Transport exceeds 2s (default loop end was 4s in session store, but we set loop off)
    // Wait, session defaults are loopStart=0, loopEnd=4, isLooping=false.
    // So 'loop off' just confirms it.

    const seconds = await audio.getTransportSeconds();
    expect(seconds).toBeGreaterThan(2.9);
  });
});
