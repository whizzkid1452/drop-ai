import { test, expect } from './fixtures';

/**
 * Generates a simple sine wave WAV buffer.
 */
function createWavBuffer(
  duration: number,
  sampleRate: number = 44100,
  freq: number = 440
): Buffer {
  const length = sampleRate * duration;
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const time = i / sampleRate;
    buffer[i] = Math.sin(2 * Math.PI * freq * time);
  }

  const wavBuffer = Buffer.alloc(44 + length * 4);

  // RIFF Chunk
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + length * 4, 4);
  wavBuffer.write('WAVE', 8);

  // fmt Chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16); // Subchunk1Size
  wavBuffer.writeUInt16LE(3, 20); // AudioFormat (3 = Float)
  wavBuffer.writeUInt16LE(1, 22); // NumChannels
  wavBuffer.writeUInt32LE(sampleRate, 24); // SampleRate
  wavBuffer.writeUInt32LE(sampleRate * 4, 28); // ByteRate
  wavBuffer.writeUInt16LE(4, 32); // BlockAlign
  wavBuffer.writeUInt16LE(32, 34); // BitsPerSample

  // data Chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(length * 4, 40);

  // Write Float32 samples
  for (let i = 0; i < length; i++) {
    wavBuffer.writeFloatLE(buffer[i], 44 + i * 4);
  }

  return wavBuffer;
}

test.describe('CLI Workflow', () => {
  test.beforeEach(async ({ page, audio }) => {
    await page.goto('/cli-test');
    await page.locator('.terminal').first().click();
    await audio.attachMeter();
  });

  test('should upload file and support region commands', async ({ page }) => {
    // 1. Prepare File
    const wavData = createWavBuffer(2.0, 44100, 440); // 2 seconds of 440Hz

    // 2. Create Track and get ID
    await page.keyboard.type('track add');
    await page.keyboard.press('Enter');

    // Wait for output
    await page.waitForTimeout(500);
    const trackOutput = await page.locator('.xterm-rows').innerText();
    // Match "Track [uuid] added."
    const trackMatch = trackOutput.match(/Track ([a-zA-Z0-9-]+) added/);
    const trackId = trackMatch ? trackMatch[1] : null;
    console.log('Captured Track ID:', trackId);
    expect(trackId).toBeTruthy();

    // Now upload to this specific track
    const fileChooserPromise = page.waitForEvent('filechooser');
    // Ensure we type valid command
    await page.keyboard.type(`upload ${trackId}`);
    await page.keyboard.press('Enter');

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'cli-test.wav',
      mimeType: 'audio/wav',
      buffer: wavData,
    });

    // Wait for upload success message
    await expect(page.locator('.xterm-rows')).toContainText('Added region');

    // Parse the Region ID from the output
    // We get the entire terminal text again to catch the new message
    await page.waitForTimeout(500);
    const terminalText = await page.locator('.xterm-rows').innerText();
    // Look for success message for THIS track
    const match = terminalText.match(
      new RegExp(`Added region ([a-zA-Z0-9-]+) to track ${trackId}`)
    );
    const regionId = match ? match[1] : null;

    console.log('Captured Region ID from upload:', regionId);
    expect(regionId).toBeTruthy();

    if (regionId && trackId) {
      // A. Split Region at 1s
      const splitCommand = `region split ${trackId} ${regionId} 1.0`;
      await page.keyboard.type(splitCommand);
      await page.keyboard.press('Enter');

      // Allow command to process
      await page.waitForTimeout(500);
      const output = await page.locator('.xterm-rows').innerText();
      console.log('Terminal Output after split:', output);

      await expect(page.locator('.xterm-rows')).toContainText(
        `Split region ${regionId}`
      );

      // B. Check count
      // status
      await page.keyboard.type('status');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const statusOutput = await page.locator('.xterm-rows').innerText();
      const regionCount = (statusOutput.match(/Start:/g) || []).length;
      expect(regionCount).toBeGreaterThanOrEqual(2);
    }
  });
});
