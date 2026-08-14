import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('Clip을 설정하고 Cue 연주를 Timeline arrangement로 변환해 복원한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');
  await page.getByRole('button', { name: 'Open track inspector' }).click();

  const loopControls = page.getByRole('region', { name: 'Live loop controls' });
  await expect(loopControls).toBeVisible();
  await loopControls.getByRole('button', { exact: true, name: 'REC' }).first().click();
  await expect(loopControls.getByRole('button', { exact: true, name: 'STOP' }).first()).toBeVisible({
    timeout: 6_000,
  });

  await loopControls.getByRole('button', { exact: true, name: 'CLIP' }).first().click();
  await loopControls.getByLabel('Loop 1 name').fill('Verse');
  await loopControls.getByLabel('Loop 1 launch mode').selectOption('trigger');
  await loopControls.getByLabel('Loop 1 follow action', { exact: true }).selectOption('stop');
  await loopControls.getByLabel('Loop 1 follow action bars').selectOption('1');
  await loopControls.getByRole('button', { exact: true, name: 'SAVE' }).click();

  const existingRegionCount = await page.locator('[data-region-id]').count();
  await page.getByRole('button', { exact: true, name: 'Cue' }).click();
  const cueGrid = page.getByRole('dialog', { name: 'Cue Grid' });
  await cueGrid.getByLabel('Cue performance name').fill('First cue');
  await cueGrid.getByRole('button', { exact: true, name: 'RECORD CUE' }).click();
  await cueGrid.getByRole('gridcell', { name: /Verse/ }).click();
  await expect(cueGrid.getByRole('status')).toContainText('1 events');
  await cueGrid.getByRole('button', { exact: true, name: 'SAVE TAKE' }).click();
  await expect(cueGrid.getByText('First cue', { exact: true })).toBeVisible();
  await cueGrid.getByRole('button', { exact: true, name: 'ARRANGE' }).click();
  await expect(page.locator('[data-region-id]')).toHaveCount(existingRegionCount + 1);

  await cueGrid.getByRole('button', { name: 'Close Cue Grid' }).click();
  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '불러오기' }).click();
  await expect(page.locator('[data-region-id]')).toHaveCount(existingRegionCount + 1);
  await page.getByRole('button', { exact: true, name: 'Cue' }).click();
  await expect(page.getByRole('dialog', { name: 'Cue Grid' }).getByText('First cue', { exact: true })).toBeVisible();
});
