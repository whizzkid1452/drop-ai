import { defineConfig, devices } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './e2e/fixtures/fake-audio-input';

const fakeAudioInputPath = ensureFakeAudioInputFixture();

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // Browser context가 달라도 같은 origin의 OPFS를 공유하므로 프로젝트 변경 시나리오는 순차 실행한다.
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            `--use-file-for-fake-audio-capture=${fakeAudioInputPath}`,
          ],
        },
        permissions: ['microphone'],
      },
    },
  ],
  reporter: 'list',
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173',
  },
});
