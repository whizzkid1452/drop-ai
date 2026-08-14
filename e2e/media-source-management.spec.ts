import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('파생 Source를 만들고 검색·태그·미리듣기·미사용 정리를 수행한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  await page
    .locator('[data-region-id]')
    .first()
    .click({ position: { x: 24, y: 36 } });
  await page.getByRole('button', { name: 'Open track inspector' }).click();
  await page.getByLabel('Region 오디오 파일 선택').setInputFiles(ensureFakeAudioInputFixture());
  const regionDeleteButtons = page.getByRole('button', { name: 'Region 삭제' });
  await expect(regionDeleteButtons).toHaveCount(2);
  await page.getByRole('button', { name: 'Close track inspector' }).click();
  page.once('dialog', dialog => dialog.accept());
  await regionDeleteButtons.last().evaluate(button => button.click());
  await expect(regionDeleteButtons).toHaveCount(1);
  await page
    .locator('[data-region-id]')
    .first()
    .click({ position: { x: 24, y: 36 } });
  await page.getByRole('button', { name: 'Open track inspector' }).click();
  await page.getByRole('button', { name: '선택 Region Bounce' }).click();

  await page.getByRole('button', { name: 'Open Media' }).click();
  const sourcePanel = page.getByRole('region', { name: 'Source 관리' });
  await expect(sourcePanel).toBeVisible();
  await expect(sourcePanel.locator('[data-source-id]')).toHaveCount(3);
  await expect(sourcePanel.locator('[data-derivation="bounce"]')).toBeVisible();

  await sourcePanel.getByRole('searchbox', { name: 'Source 검색' }).fill('bounce');
  const derivedSource = sourcePanel.locator('[data-derivation="bounce"]');
  await expect(derivedSource).toBeVisible();
  const tagInput = derivedSource.getByRole('textbox', { name: /태그$/ });
  await tagInput.fill('edited, bounce');
  await derivedSource.getByRole('button', { name: /태그 저장$/ }).click();
  await expect(tagInput).toHaveValue('edited, bounce');

  await derivedSource.getByRole('button', { name: /미리듣기$/ }).click();
  await expect(derivedSource.getByRole('button', { name: /미리듣기 중지$/ })).toBeVisible();
  await derivedSource.getByRole('button', { name: /미리듣기 중지$/ }).click();

  await sourcePanel.getByRole('searchbox', { name: 'Source 검색' }).fill('');
  await sourcePanel.getByRole('button', { name: '미사용 Source 1개 정리' }).click();
  await expect(sourcePanel.locator('[data-source-id]')).toHaveCount(2);
  await expect(sourcePanel).toContainText('1개 Source를 정리했습니다.');
});
