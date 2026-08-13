import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('기능별 runtime 지원 상태를 확인한다', async ({ page }) => {
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
  await expect(capabilityPanel.locator('[data-feature="linearRecording"]')).toContainText('사용 가능');
  await expect(capabilityPanel.locator('[data-feature="regionProcessing"]')).toContainText('사용 가능');
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

test('단일 Track을 녹음하고 저장된 waveform Region을 다시 불러온다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const existingRegionCount = await page.getByRole('button', { name: 'Region 삭제' }).count();
  const armButton = page.getByRole('button', { name: /녹음 arm$/ }).first();
  await armButton.click();
  await expect(armButton).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '녹음 시작' }).click();
  const stopButton = page.getByRole('button', { name: '녹음 중지' });
  await expect(stopButton).toBeVisible();
  await expect(page.getByRole('group', { name: '녹음' })).toContainText('녹음 중');
  await page.waitForTimeout(750);
  await stopButton.click();

  await expect(page.getByRole('button', { name: '녹음 시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Region 삭제' })).toHaveCount(existingRegionCount + 1);

  await page.reload();
  const projectSelect = page.getByLabel('프로젝트');
  await expect(projectSelect).toBeEnabled();
  await page.getByRole('button', { name: '불러오기' }).click();
  await expect(page.getByRole('button', { name: 'Region 삭제' })).toHaveCount(existingRegionCount + 1);
  await expect(page.getByRole('button', { name: /녹음 arm$/ }).first()).toHaveAttribute('aria-pressed', 'false');

  const restoredTrackMeter = page.getByRole('meter', { name: 'Track' });
  await page.getByTitle(/^Play/).click();
  await expect.poll(async () => Number(await restoredTrackMeter.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-60);
});

test('Region을 선택해 복제하고 Undo·Redo·저장·복원한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const regions = page.locator('[data-region-id]');
  await expect(regions).toHaveCount(1);
  await regions.first().click({ position: { x: 24, y: 36 } });
  await expect(regions.first()).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('region', { name: 'Region 편집 도구' })).toContainText('1 REGION');

  await page.getByRole('button', { name: 'Region 복제' }).click();
  await expect(regions).toHaveCount(2);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

  await page.keyboard.press('Control+z');
  await expect(regions).toHaveCount(1);
  await expect(page.getByRole('button', { name: '다시 실행' })).toBeEnabled();
  await page.keyboard.press('Control+Shift+z');
  await expect(regions).toHaveCount(2);

  const timeline = page.getByLabel(/timeline$/).first();
  const timelineBox = await timeline.boundingBox();
  if (!timelineBox) {
    throw new Error('Track Timeline 위치를 확인하지 못했습니다.');
  }
  await page.mouse.move(timelineBox.x + 420, timelineBox.y + 36);
  await page.mouse.down();
  await page.mouse.move(timelineBox.x + 520, timelineBox.y + 36);
  await page.mouse.up();
  await expect(page.getByTestId('range-selection')).toBeVisible();

  await regions.first().click({ position: { x: 24, y: 36 } });
  await page.keyboard.press('Control+c');
  const editPoint = page.getByRole('button', { name: 'Timeline edit point' });
  await editPoint.click({ position: { x: 500, y: 10 } });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('Control+v');
  await expect(regions).toHaveCount(3);
  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: '불러오기' }).click();
  await expect(regions).toHaveCount(3);
  await expect(page.getByRole('region', { name: 'Region 편집 도구' })).toContainText('0 REGION');
});

test('Region gain과 Fade를 Inspector에서 변경하고 저장 후 복원한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const region = page.locator('[data-region-id]').first();
  await region.click({ position: { x: 24, y: 36 } });
  await page.getByRole('button', { name: 'Open track inspector' }).click();

  const gainInput = page.getByRole('slider', { name: 'Region gain' });
  const fadeInInput = page.getByRole('slider', { name: 'Region fade in' });
  await expect(gainInput).toBeVisible();
  await gainInput.fill('0.5');
  await fadeInInput.fill('0.25');
  await expect(gainInput).toHaveValue('0.5');
  await expect(fadeInInput).toHaveValue('0.25');
  await expect(page.getByRole('button', { name: 'Region fade in' })).toBeVisible();

  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '불러오기' }).click();
  await page
    .locator('[data-region-id]')
    .first()
    .click({ position: { x: 24, y: 36 } });
  await page.getByRole('button', { name: 'Open track inspector' }).click();

  await expect(page.getByRole('slider', { name: 'Region gain' })).toHaveValue('0.5');
  await expect(page.getByRole('slider', { name: 'Region fade in' })).toHaveValue('0.25');
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
  await expect(page.getByRole('button', { name: '녹음 시작' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /녹음 arm$/ }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Open track inspector' }).click();
  await expect(page.getByRole('button', { name: 'CONNECT' })).toBeDisabled();
});
