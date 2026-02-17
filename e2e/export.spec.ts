import { test, expect } from './fixtures';

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page, audio }) => {
    await page.goto('/cli-test');
    await page.locator('.terminal').first().click();
    await audio.attachMeter();
  });

  test('should export session to WAV', async ({ page, audio }) => {
    // 1. Create content (Track -> Upload/Generate)
    // To satisfy "Session is empty" check, we need a region.
    // Creating a track and uploading a file is complex without actual file.
    // We can inject a region directly via evaluate?
    // Or just use the Upload command flow again?
    // Let's use upload command flow for realism.

    // Generate buffer
    const wavData = await page.evaluate(() => {
      // Create simple 1s WAV buffer
      const sampleRate = 44100;
      const length = sampleRate;
      const buffer = new Float32Array(length);
      for (let i = 0; i < length; i++) buffer[i] = Math.sin(i);

      // Minimal WAV
      const b = new ArrayBuffer(44 + length * 4);
      const v = new DataView(b);
      v.setUint32(0, 0x46464952, true); // RIFF
      v.setUint32(4, 36 + length * 4, true);
      v.setUint32(8, 0x45564157, true); // WAVE
      v.setUint32(12, 0x20746d66, true); // fmt
      v.setUint32(16, 16, true);
      v.setUint16(20, 3, true); // Float
      v.setUint16(22, 1, true); // Mono
      v.setUint32(24, sampleRate, true);
      v.setUint32(28, sampleRate * 4, true);
      v.setUint16(32, 4, true);
      v.setUint16(34, 32, true);
      v.setUint32(36, 0x61746164, true); // data
      v.setUint32(40, length * 4, true);
      return Array.from(new Uint8Array(b));
    });

    const buffer = new Uint8Array(wavData).buffer;

    // Track Add
    await page.keyboard.type('track add');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const trackOutput = await page.locator('.xterm-rows').innerText();
    const trackMatch = trackOutput.match(/Track ([a-zA-Z0-9-]+) added/);
    const trackId = trackMatch ? trackMatch[1] : null;
    expect(trackId).toBeTruthy();

    // Upload
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.type(`upload ${trackId}`);
    await page.keyboard.press('Enter');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'test.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from(buffer),
    });
    await expect(page.locator('.xterm-rows')).toContainText('Added region');

    // 2. Export
    // Prepare download listener
    const downloadPromise = page.waitForEvent('download');

    await page.keyboard.type('export my-mix.wav');
    await page.keyboard.press('Enter');

    const download = await downloadPromise;

    // 3. Verify
    expect(download.suggestedFilename()).toBe('my-mix.wav');

    // Optional: Save and check size
    // const path = await download.path();
    // const stats = fs.statSync(path);
    // expect(stats.size).toBeGreaterThan(100);
  });
});
