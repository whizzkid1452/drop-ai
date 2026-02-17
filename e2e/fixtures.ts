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
  };
};

export const test = base.extend<AudioFixtures>({
  audio: async ({ page }, use) => {
    const audioHelper = {
      attachMeter: async () => {
        await page.evaluate(async () => {
          // @ts-ignore
          if (window.Tone && !window._testMeter) {
            // @ts-ignore
            const Tone = window.Tone;
            const meter = new Tone.Meter();
            Tone.getDestination().connect(meter);
            // @ts-ignore
            window._testMeter = meter;
            console.log('Test Meter Attached');
          }
        });
      },

      isPlaying: async (threshold = -60) => {
        return await page.evaluate(thresh => {
          // @ts-ignore
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
          // @ts-ignore
          const meter = window._testMeter;
          if (!meter) return true; // No meter means no monitoring, but technically silence at the meter loc
          const level = meter.getValue();
          return typeof level === 'number' && level <= thresh;
        }, threshold);
      },

      getTransportSeconds: async () => {
        return await page.evaluate(() => {
          // @ts-ignore
          return window.Tone?.getTransport().seconds ?? 0;
        });
      },

      getTransportState: async () => {
        return await page.evaluate(() => {
          // @ts-ignore
          return window.Tone?.getTransport().state ?? 'stopped';
        });
      },
    };

    await use(audioHelper);
  },
});

export { expect } from '@playwright/test';
