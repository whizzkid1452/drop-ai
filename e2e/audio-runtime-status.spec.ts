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
  await expect(capabilityPanel.locator('[data-feature="tempoLoopMetronome"]')).toContainText('사용 가능');
  await expect(capabilityPanel.locator('[data-feature="metering"]')).toContainText('사용 가능');
  await expect(capabilityPanel.locator('[data-feature="linearRecording"]')).toContainText('미구현');
});

test('Loop 범위와 Metronome을 Transport에서 바로 제어한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const loopLane = page.getByLabel('Loop Range');
  const laneBox = await loopLane.boundingBox();
  if (!laneBox) {
    throw new Error('Loop Range lane의 화면 위치를 확인하지 못했습니다.');
  }
  await page.mouse.move(laneBox.x + 96, laneBox.y + laneBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(laneBox.x + 288, laneBox.y + laneBox.height / 2);
  await page.mouse.up();

  await expect(page.getByTestId('loop-range')).toBeVisible();
  const loopButton = page.getByRole('button', { name: 'Loop 끄기' });
  await expect(loopButton).toHaveAttribute('aria-pressed', 'true');
  await loopButton.click();
  await expect(page.getByRole('button', { name: 'Loop 켜기' })).toHaveAttribute('aria-pressed', 'false');

  const metronomeButton = page.getByRole('button', { name: 'Metronome 켜기' });
  await metronomeButton.click();
  await expect(page.getByRole('button', { name: 'Metronome 끄기' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Metronome 볼륨').evaluate(input => {
    const volumeInput = input as HTMLInputElement;
    volumeInput.value = '0.4';
    volumeInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByLabel('Metronome 볼륨')).toHaveValue('0.4');
});

test('Track·Master·입력 meter와 Track monitoring을 즉시 확인한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const trackMeter = page.getByRole('meter', { name: 'Track' });
  const masterMeter = page.getByRole('meter', { name: 'Master' });
  const inputMeter = page.getByRole('meter', { name: 'Input' });
  await expect(trackMeter).toBeVisible();
  await expect(masterMeter).toBeVisible();
  await expect(inputMeter).toBeVisible();

  await page.getByTitle(/^Play/).click();
  await expect.poll(async () => Number(await trackMeter.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-60);
  await expect.poll(async () => Number(await masterMeter.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-60);

  await page.getByRole('button', { name: 'Track Mute' }).click();
  await expect.poll(async () => Number(await trackMeter.getAttribute('data-peak-dbfs'))).toBeLessThanOrEqual(-60);

  await page.getByRole('button', { name: '입력 장치 연결' }).click();
  await expect.poll(async () => Number(await inputMeter.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-60);

  const monitoringButton = page.getByRole('button', { name: /입력 모니터링$/ });
  await expect(monitoringButton).toBeEnabled();
  await monitoringButton.click();
  await expect(monitoringButton).toHaveAttribute('aria-pressed', 'true');
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
  await expect(page.getByLabel('입력 장치', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '입력 장치 연결' })).toBeDisabled();
  await page.getByRole('button', { name: 'Open track inspector' }).click();
  await expect(page.getByRole('button', { name: 'CONNECT' })).toBeDisabled();
});
