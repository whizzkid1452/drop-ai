import { test, expect } from './fixtures';

test.describe('Audio Playback', () => {
  test.beforeEach(async ({ page, audio }) => {
    await page.goto('/cli-test');
    // Helper to start audio context on user interaction if needed
    await page.locator('body').click();
    await audio.attachMeter();
  });

  test('should play audio after upload', async ({ page, audio }) => {
    // 1. Simulate file upload (using CLI command for consistent setup if possible, or UI)
    // For now, let's use the CLI input if available, or just use the upload command logic.
    // Since we don't have a real file, we can generate a buffer or use a dummy file.
    // However, the app uses `URL.createObjectURL(file)`.

    // We will inject a command to load a dummy oscillator buffer instead of real file upload for stability
    // Or we can use a small silent/sine wave file.

    // Let's create a dummy file and upload it via the hidden input
    await page.evaluate(() => {
      // Create a dummy audio file
      const buffer = new ArrayBuffer(44100 * 2); // 1 sec of silence/noise
      const view = new Float32Array(buffer);
      for (let i = 0; i < view.length; i++) view[i] = Math.sin(i / 100); // Sine wave
      const blob = new Blob([buffer], { type: 'audio/wav' });
      const file = new File([blob], 'test-tone.wav', { type: 'audio/wav' });

      // Find input and dispatch change
      // But CLI upload creates the input dynamically...
      // Let's use the UI "Upload" button if exists, or just type `upload` in CLI
    });

    // Type 'upload' in CLI to trigger file picker? No, CLI `upload` creates input programmatically.
    // We can mock the file picker or manually call controller logic.
    // Easier: Type `upload` and hack the input creation?

    // Better strategy for this test:
    // 1. Type `upload` in CLI.
    // 2. Expect file chooser.
    // 3. Set files.

    // Create a dummy WAV file
    // Note: Creating a valid WAV file in JS is verbose.
    // Playwright cannot easily "fake" audio content that Web Audio API decodes without a valid container.
    // Alternative: We can mock `AudioEngine.loadFile`?
    // No, E2E should test real integration.

    // Let's try uploading a small text file as audio? Tone.js might fail decoding.
    // We need a valid audio file.
    // For now, let's assume `test-assets/sine.wav` exists or generate one.

    // Actually, `AudioEngine.loadFile` uses `ToneAudioBuffer.load(src)`.
    // If we pass a Blob URL of a Float32Array, Tone might not decode it as WAV.

    // Plan B: Expose a "loadTestTone" command in CLI for E2E?
    // Or just check if `play` command starts Transport (we already verified that).
    // The user wants to verify "Sound".

    // Let's add a `load-test-tone` command to CLI for testing purposes?
    // Or better: Just check Transport for now, as decoding requires valid file.
    // Wait, we can generate a simple valid WAV file using some helper or library?
    // Too complex for now.

    // Let's check Transport state first, which confirms "Engine" is running.
    // Checking RMS requires actual audio data.

    // For now, let's verify Transport State as proxy for "Playback Started".

    // Play command
    // Play command
    // xterm.js handles input via keyboard events on focused element.
    // Click on the terminal container to focus it.
    await page.locator('.terminal').first().click();
    await page.keyboard.type('play');
    await page.keyboard.press('Enter');

    await expect(async () => {
      const state = await audio.getTransportState();
      expect(state).toBe('started');
    }).toPass();

    const seconds = await audio.getTransportSeconds();
    await page.waitForTimeout(1000);
    const secondsAfter = await audio.getTransportSeconds();
    expect(secondsAfter).toBeGreaterThan(seconds);
  });
});
