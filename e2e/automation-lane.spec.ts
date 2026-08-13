import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('Automation 점을 편집하고 Undo·Redo·저장 복원한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  const track = page.getByRole('article', { name: /^Track / }).first();
  const automationToggle = track.getByRole('button', { name: /Automation Lane 표시$/ });
  await expect(automationToggle).toBeEnabled();
  await automationToggle.click();
  await expect(automationToggle).toHaveAttribute('aria-pressed', 'true');

  await track.getByRole('button', { name: /Automation Lane 추가$/ }).click();
  const automationLane = track.getByLabel(/Automation Lane$/, { exact: true });
  await expect(automationLane).toBeVisible();
  await automationLane.dblclick({ position: { x: 120, y: 24 } });

  const points = automationLane.locator('[data-point-id]');
  await expect(points).toHaveCount(1);
  await points.first().click();
  await track.getByRole('button', { name: '선택한 Automation 점 복사' }).click();

  await page.getByRole('button', { name: 'Timeline edit point' }).click({ position: { x: 320, y: 10 } });
  await track.getByRole('button', { name: 'Automation 점 붙여넣기' }).click();
  await expect(points).toHaveCount(2);

  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(points).toHaveCount(1);
  await page.getByRole('button', { name: '다시 실행' }).click();
  await expect(points).toHaveCount(2);

  const automationMode = track.getByRole('combobox', { name: /Automation mode$/ });
  await automationMode.selectOption('touch');
  await expect(automationMode).toHaveValue('touch');

  const writeValue = track.getByRole('slider', { name: /Automation write value$/ });
  await expect(writeValue).toBeEnabled();
  const writtenPoint = points.last();
  const pointLabelBeforeWrite = await writtenPoint.getAttribute('aria-label');
  await writeValue.press('ArrowRight');
  await expect(writtenPoint).not.toHaveAttribute('aria-label', pointLabelBeforeWrite ?? '');
  const pointLabelAfterWrite = await writtenPoint.getAttribute('aria-label');

  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect(writtenPoint).toHaveAttribute('aria-label', pointLabelBeforeWrite ?? '');
  await expect(automationMode).toHaveValue('touch');
  await page.getByRole('button', { name: '다시 실행' }).click();
  await expect(writtenPoint).toHaveAttribute('aria-label', pointLabelAfterWrite ?? '');

  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '불러오기' }).click();

  const restoredTrack = page.getByRole('article', { name: /^Track / }).first();
  await restoredTrack.getByRole('button', { name: /Automation Lane 표시$/ }).click();
  const restoredPoints = restoredTrack.getByLabel(/Automation Lane$/, { exact: true }).locator('[data-point-id]');
  await expect(restoredPoints).toHaveCount(2);
  await expect(restoredPoints.last()).toHaveAttribute('aria-label', pointLabelAfterWrite ?? '');
  await expect(restoredTrack.getByRole('combobox', { name: /Automation mode$/ })).toHaveValue('touch');
});
