import { test as base, expect, Page } from '@playwright/test';

// Declare the types of your fixtures.
type AudioFixtures = {
  audio: {
    /**
     * Checks if audio is currently playing (RMS > threshold).
     * @param threshold DB threshold (default -60)
     */
    isPlaying: (threshold?: number) => Promise<boolean>;
    /**
     * Checks if audio is silent (RMS < threshold).
     */
    isSilent: (threshold?: number) => Promise<boolean>;
    /**
     * Gets current Transport position in seconds.
     */
    getTransportSeconds: () => Promise<number>;
    /**
     * Gets current Transport state.
     */
    getTransportState: () => Promise<string>;
    /**
     * Attach a meter to the destination to monitor output.
     * Must be called once before checking levels.
     */
    attachMeter: () => Promise<void>;
    /**
     * Gets the dominant frequency from the FFT analysis.
     */
    getDominantFrequency: () => Promise<number>;
  };
};

export const test = base.extend<AudioFixtures>({
  audio: async ({ page }, use) => {
    const audioHelper = {
      attachMeter: async () => {
        await page.evaluate(async () => {
          // @ts-expect-error - Tone is available in window
          if (window.Tone && !window._testMeter) {
            // @ts-expect-error - Tone is available in window
            const Tone = window.Tone;
            const meter = new Tone.Meter();
            const fft = new Tone.FFT(2048);
            Tone.getDestination().connect(meter);
            Tone.getDestination().connect(fft);
            // @ts-expect-error - _testMeter is added for testing
            window._testMeter = meter;
            // @ts-expect-error - _testFFT is added for testing
            window._testFFT = fft;
            console.log('Test Meter & FFT Attached');
          }
        });
      },

      getDominantFrequency: async () => {
        return await page.evaluate(() => {
          // @ts-expect-error - _testFFT is added for testing
          const fft = window._testFFT;
          if (!fft) return 0;
          const values = fft.getValue();
          let maxVal = -Infinity;
          let maxIndex = -1;
          for (let i = 0; i < values.length; i++) {
            if (values[i] > maxVal) {
              maxVal = values[i];
              maxIndex = i;
            }
          }
          // @ts-expect-error - Tone is available in window
          const sampleRate = window.Tone.context.sampleRate;
          console.log(
            '[Fixture] FFT Size:',
            fft.size,
            'Values Len:',
            values.length,
            'SampleRate:',
            sampleRate,
            'MaxIndex:',
            maxIndex
          );
          // Frequency = index * sampleRate / fftSize
          // fftSize = 2 * frequencyBinCount (values.length)
          const freq = (maxIndex * sampleRate) / (values.length * 2);
          return freq;
        });
      },

      isPlaying: async (threshold = -60) => {
        return await page.evaluate(thresh => {
          // @ts-expect-error - _testMeter is added for testing
          const meter = window._testMeter;
          if (!meter) return false;
          const level = meter.getValue();
          // Tone.Meter returns decibels (negative infinity to 0)
          // If level is finite and > threshold, we consider it playing
          return typeof level === 'number' && level > thresh;
        }, threshold);
      },

      isSilent: async (threshold = -60) => {
        return await page.evaluate(thresh => {
          // @ts-expect-error - _testMeter is added for testing
          const meter = window._testMeter;
          if (!meter) return true; // No meter means no monitoring, but technically silence at the meter loc
          const level = meter.getValue();
          return typeof level === 'number' && level <= thresh;
        }, threshold);
      },

      getTransportSeconds: async () => {
        return await page.evaluate(() => {
          // @ts-expect-error - Tone is available in window
          return window.Tone?.getTransport().seconds ?? 0;
        });
      },

      getTransportState: async () => {
        return await page.evaluate(() => {
          // @ts-expect-error - Tone is available in window
          return window.Tone?.getTransport().state ?? 'stopped';
        });
      },
    };

    await use(audioHelper);
  },
});

export { expect } from '@playwright/test';
