import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('기능 지원 상태를 확인하고 미구현 기능을 구분한다', async ({ page }) => {
  await page.goto('/');
  const fakeInputTrackCount = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const trackCount = stream.getAudioTracks().length;
    stream.getTracks().forEach(track => track.stop());
    return trackCount;
  });
  expect(fakeInputTrackCount).toBe(1);
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const runtimeStatus = page.getByRole('status', { name: /브라우저 오디오/ });
  await expect(runtimeStatus).toBeVisible();
  await runtimeStatus.click();

  const capabilityPanel = page.getByRole('region', { name: '오디오 기능 지원 상태' });
  await expect(capabilityPanel).toBeVisible();
  await expect(capabilityPanel.locator('[data-feature="timelinePlayback"]')).toContainText('사용 가능');
  await expect(capabilityPanel.locator('[data-feature="metering"]')).toContainText('미구현');
  await expect(capabilityPanel.locator('[data-feature="linearRecording"]')).toContainText('미구현');
});

test('오디오 입력 API가 없으면 원인 표시와 함께 관련 UI를 비활성화한다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  await page.getByRole('status', { name: /브라우저 오디오/ }).click();
  const liveInputCapability = page.locator('[data-feature="liveInput"]');
  await expect(liveInputCapability).toContainText('환경 차단');
  await expect(liveInputCapability).toContainText('미디어 장치 API 없음');
  await page.getByRole('button', { name: 'Open track inspector' }).click();
  await expect(page.getByRole('button', { name: 'DEFAULT INPUT' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'CONNECT' })).toBeDisabled();
});
