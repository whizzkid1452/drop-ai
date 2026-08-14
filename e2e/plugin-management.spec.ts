import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('Plugin을 검색·설치하고 Preset을 저장·복원한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  await page.getByTitle(/^Open Track Info/).click();
  const pluginPanel = page.getByRole('region', { name: 'Track Plugins' });
  await expect(pluginPanel).toBeVisible();

  await pluginPanel.getByRole('searchbox', { name: 'Plugin 검색' }).fill('gain');
  await expect(pluginPanel.getByRole('combobox', { name: '설치할 Plugin' })).toHaveValue('builtin.gain');
  await pluginPanel.getByRole('button', { name: '선택 Plugin Favorite 변경' }).click();
  await expect(pluginPanel.getByRole('button', { name: '선택 Plugin Favorite 변경' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await pluginPanel.getByRole('button', { name: 'Plugin 설치' }).click();

  const preset = pluginPanel.getByRole('combobox', { name: 'Gain Preset' });
  await expect(preset).toBeVisible();
  await preset.selectOption('boost-3db');
  await expect(preset).toHaveValue('boost-3db');
  await expect(pluginPanel.getByText(/active/).first()).toBeVisible();

  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '불러오기' }).click();
  await page
    .getByRole('article', { name: /^Track / })
    .first()
    .click();
  await page.getByTitle(/^Open Track Info/).click();

  await expect(page.getByRole('combobox', { name: 'Gain Preset' })).toHaveValue('boost-3db');
});
