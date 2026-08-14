import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('저장소·탭·AudioContext 상태를 진단하고 키보드로 복구 UI를 조작한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const runtimeStatus = page.getByRole('status', { name: /브라우저 오디오/ });
  await runtimeStatus.click();
  const diagnostics = page.getByRole('region', { name: 'Runtime 안정성 진단' });
  await expect(diagnostics).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => ({ quota: 100, usage: 96 }),
    });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(diagnostics.locator('[data-diagnostic="storage"] dd')).toHaveAttribute('data-status', 'critical');
  await expect(diagnostics.locator('[data-diagnostic="storage"]')).toContainText('96.0%');
  await expect(diagnostics.getByRole('alert')).toContainText('저장소 사용량이 95% 이상');
  await expect(diagnostics.locator('[data-diagnostic="visibility"]')).toContainText('hidden');

  const resumeButton = diagnostics.getByRole('button', { name: '오디오 재개' });
  if (await resumeButton.isVisible()) {
    await resumeButton.focus();
    await page.keyboard.press('Enter');
    await expect(diagnostics.locator('[data-diagnostic="audio-context"]')).toContainText('running');
  }

  const cueButton = page.getByRole('button', { exact: true, name: 'Cue' });
  await cueButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Cue Grid' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Cue Grid' })).toBeHidden();
  await expect(cueButton).toBeFocused();
});
