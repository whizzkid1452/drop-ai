import { readFile } from 'node:fs/promises';
import { expect, test, type Download } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('다중 range를 24-bit WAV로 내보내고 loudness 분석 결과를 표시한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export & Analysis' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Sample format').selectOption('pcm24');
  await dialog.getByLabel('Sample rate').selectOption('48000');
  await dialog.getByLabel('Normalization').selectOption('lufs');
  await dialog.getByRole('button', { name: 'Add range' }).click();
  await dialog.getByLabel('Range name 1').fill('Intro');
  await dialog.getByLabel('Range end 1').fill('1');
  await dialog.getByLabel('Range name 2').fill('Outro');
  await dialog.getByLabel('Range start 2').fill('1');
  await dialog.getByLabel('Range end 2').fill('2');

  const downloads: Download[] = [];
  page.on('download', download => downloads.push(download));
  await dialog.getByRole('button', { name: 'Start export' }).click();
  await expect.poll(() => downloads.length).toBe(2);
  const introAnalysis = dialog.locator('article').filter({ hasText: 'Intro.wav' });
  await expect(introAnalysis).toBeVisible();
  await expect(dialog.locator('article').filter({ hasText: 'Outro.wav' })).toBeVisible();
  await expect(introAnalysis.getByText(/LUFS/)).toBeVisible();
  await expect(introAnalysis.getByText(/dBTP/)).toBeVisible();

  for (const download of downloads) {
    const path = await download.path();
    if (!path) {
      throw new Error('내보낸 WAV 임시 경로를 찾을 수 없습니다.');
    }
    const wav = await readFile(path);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(48_000);
    expect(wav.readUInt16LE(34)).toBe(24);
    expect(wav.length).toBeGreaterThan(44);
  }
});
