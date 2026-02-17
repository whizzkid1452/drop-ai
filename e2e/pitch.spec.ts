import { test, expect } from './fixtures';

test.describe('Pitch Verification', () => {
  test.beforeEach(async ({ page, audio }) => {
    await page.goto('/cli-test');
    await page.locator('.terminal').first().click();
    await audio.attachMeter();
  });

  test('should play correct frequencies at correct times', async ({
    page,
    audio,
  }) => {
    // 1. Generate Test Audio (WAV) and Load it
    await page.evaluate(async () => {
      // Create 2 seconds of audio
      // 0-1s: 440Hz
      // 1-2s: 880Hz
      const sampleRate = 44100;
      const duration = 2;
      const length = sampleRate * duration;
      const buffer = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        const time = i / sampleRate;
        // Adjust phase to prevent click, but for FFT analysis simple switch is fine
        // Note: Instantaneous frequency switch
        const freq = time < 1.0 ? 440 : 880;
        buffer[i] = Math.sin(2 * Math.PI * freq * time);
      }

      console.log(
        'Buffer generated. SampleRate:',
        sampleRate,
        'Length:',
        length
      );

      // Simple WAV encoding (Mono, 32-bit float)
      const wavBuffer = new ArrayBuffer(44 + length * 4);
      const view = new DataView(wavBuffer);

      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      // RIFF header
      writeString(0, 'RIFF');
      view.setUint32(4, 36 + length * 4, true);
      writeString(8, 'WAVE');
      // fmt chunk
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true); // Subchunk1Size
      view.setUint16(20, 3, true); // AudioFormat (3 = Float)
      view.setUint16(22, 1, true); // NumChannels
      view.setUint32(24, sampleRate, true); // SampleRate
      view.setUint32(28, sampleRate * 4, true); // ByteRate
      view.setUint16(32, 4, true); // BlockAlign
      view.setUint16(34, 32, true); // BitsPerSample
      // data chunk
      writeString(36, 'data');
      view.setUint32(40, length * 4, true);

      const floatView = new Float32Array(wavBuffer, 44);
      floatView.set(buffer);

      const blob = new Blob([wavBuffer], { type: 'audio/wav' });

      // Inject into AudioEngine
      // @ts-ignore
      if (window.audioEngine) {
        // @ts-ignore
        const { src, duration: d } = await window.audioEngine.loadFile(
          new File([blob], 'test.wav')
        );
        // @ts-ignore
        window.audioEngine.createTrack('track-1');
        // @ts-ignore
        window.audioEngine.addRegion('track-1', {
          id: 'region-1',
          trackId: 'track-1',
          src: src,
          startTime: 0,
          duration: d,
          offset: 0,
        });
      }
    });

    // 2. Play
    await page.keyboard.type('play');
    await page.keyboard.press('Enter');

    // 3. Verify 440Hz at 0.5s
    await page.waitForTimeout(500);
    const secs1 = await audio.getTransportSeconds();
    console.log('Current Transport Seconds:', secs1);
    const freq1 = await audio.getDominantFrequency();
    console.log('Frequency at 0.5s:', freq1);

    // Allow error margin (FFT bins)
    expect(freq1).toBeGreaterThan(430);
    expect(freq1).toBeLessThan(460);

    // 4. Verify 880Hz at 1.5s
    await page.waitForTimeout(1000); // Now at ~1.5s
    const secs2 = await audio.getTransportSeconds();
    console.log('Current Transport Seconds:', secs2);
    const freq2 = await audio.getDominantFrequency();
    console.log('Frequency at 1.5s:', freq2);

    expect(freq2).toBeGreaterThan(870);
    expect(freq2).toBeLessThan(900);
  });
});
