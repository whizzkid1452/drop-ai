import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('Snapshot·Track Template·Archive를 UI에서 생성하고 복원한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const trackName = page.getByLabel('Track 이름').first();
  const originalName = await trackName.inputValue();
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Session lifecycle' });
  await dialog.getByLabel('Snapshot name').fill('Baseline');
  await dialog.getByRole('button', { name: 'Create snapshot' }).click();
  await expect(dialog.getByText('Baseline')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close Session lifecycle' }).click();

  await trackName.fill('Changed after snapshot');
  await page.getByRole('button', { name: '이름 적용' }).first().click();
  await expect(trackName).toHaveValue('Changed after snapshot');
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await dialog.locator('article').filter({ hasText: 'Baseline' }).getByRole('button', { name: 'Restore' }).click();
  await expect(trackName).toHaveValue(originalName);

  await dialog.getByLabel('Template kind').selectOption('track');
  await dialog.getByLabel('Template name').fill('Audio strip');
  await dialog.getByRole('button', { name: 'Save template' }).click();
  const templateRow = dialog.locator('article').filter({ hasText: 'Audio strip' });
  await expect(templateRow).toBeVisible();
  await templateRow.getByRole('button', { name: 'Apply' }).click();
  await dialog.getByRole('button', { name: 'Close Session lifecycle' }).click();
  await expect(page.getByText('2 tracks', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Session', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export archive' }).click();
  const archiveDownload = await downloadPromise;
  const archivePath = await archiveDownload.path();
  if (!archivePath) {
    throw new Error('Session Archive 임시 경로를 찾을 수 없습니다.');
  }
  await dialog.getByRole('button', { name: 'Close Session lifecycle' }).click();

  await trackName.fill('Changed after archive');
  await page.getByRole('button', { name: '이름 적용' }).first().click();
  await page.getByRole('button', { name: 'Session', exact: true }).click();
  await dialog.getByLabel('Session archive file').setInputFiles(archivePath);
  await expect(trackName).toHaveValue(originalName);
  await expect(page.getByText('2 tracks', { exact: true })).toBeVisible();
});
