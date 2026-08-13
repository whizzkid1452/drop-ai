import { expect, test, type Page } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

async function openDawWithAudio(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');
}

test('Mixer에서 Bus Route와 Send를 만들고 저장·복원한다', async ({ page }) => {
  await openDawWithAudio(page);
  await page.getByRole('button', { name: 'Open Mixer' }).click();

  const audioStrip = page.locator('article[data-route-kind="audio"]').first();
  await expect(audioStrip).toBeVisible();
  await page.getByRole('button', { name: 'Add Bus Track' }).click();

  const busStrip = page.locator('article[data-route-kind="bus"]');
  await expect(busStrip).toHaveCount(1);
  const outputSelect = audioStrip.locator('select[aria-label$=" output"]');
  await outputSelect.selectOption({ index: 1 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(outputSelect).toHaveValue(/^track:/);

  await audioStrip.getByRole('button', { name: /^Add Send to / }).click();
  await expect(audioStrip.locator('[data-send-id]')).toHaveCount(1);

  const monitorDim = page.getByRole('button', { name: 'Monitor Dim' });
  await monitorDim.click();
  await expect(monitorDim).toHaveAttribute('aria-pressed', 'true');

  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('프로젝트')).toBeEnabled();
  await page.getByRole('button', { name: '불러오기' }).click();
  await page.getByRole('button', { name: 'Open Mixer' }).click();

  const restoredAudioStrip = page.locator('article[data-route-kind="audio"]').first();
  await expect(page.locator('article[data-route-kind="bus"]')).toHaveCount(1);
  await expect(restoredAudioStrip.locator('select[aria-label$=" output"]')).toHaveValue(/^track:/);
  await expect(restoredAudioStrip.locator('[data-send-id]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Monitor Dim' })).toHaveAttribute('aria-pressed', 'false');
});
