import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test('MIDI note를 편집·재생하고 SMF export/import round trip으로 timing을 유지한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  await page.getByRole('button', { name: '빈 MIDI Track 추가' }).click();
  const tracks = page.getByRole('article', { name: /^Track / });
  await expect(tracks).toHaveCount(2);

  const midiTrack = tracks.nth(1);
  await midiTrack.getByRole('button', { name: /Piano Roll 표시$/ }).click();
  await midiTrack.getByRole('button', { name: /MIDI note 추가$/ }).click();

  const note = midiTrack.locator('[data-note-id]').first();
  await expect(note).toBeVisible();
  await note.press('ArrowRight');
  await note.press('Shift+ArrowRight');
  await note.click();
  await midiTrack.getByRole('slider', { name: /note velocity$/ }).fill('64');
  await expect(midiTrack.getByRole('spinbutton', { name: /note 시작$/ })).toHaveValue('0.25');
  await expect(midiTrack.getByRole('spinbutton', { name: /note 길이$/ })).toHaveValue('0.75');
  await expect(midiTrack.getByRole('slider', { name: /note velocity$/ })).toHaveValue('64');

  const midiMeter = midiTrack.getByRole('meter', { name: 'Track' });
  await page.getByTitle(/^Play/).click();
  await expect.poll(async () => Number(await midiMeter.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-60);
  await page.getByTitle(/^Stop/).click();

  const downloadPromise = page.waitForEvent('download');
  await midiTrack.getByRole('button', { name: /MIDI 파일 내보내기$/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.mid$/);
  const exportedMidiPath = await download.path();
  if (!exportedMidiPath) {
    throw new Error('내보낸 MIDI 파일 경로를 확인하지 못했습니다.');
  }

  await page.getByLabel('MIDI 파일 선택').setInputFiles(exportedMidiPath);
  await expect(tracks).toHaveCount(3);
  const importedTrack = tracks.nth(2);
  await importedTrack.getByRole('button', { name: /Piano Roll 표시$/ }).click();
  await importedTrack.locator('[data-note-id]').first().click();
  await expect(importedTrack.getByRole('spinbutton', { name: /note 시작$/ })).toHaveValue('0.25');
  await expect(importedTrack.getByRole('spinbutton', { name: /note 길이$/ })).toHaveValue('0.75');
  await expect(importedTrack.getByRole('slider', { name: /note velocity$/ })).toHaveValue('64');

  await page.getByTitle(/^Save/).click();
  await expect(page.getByText('Save completed', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '불러오기' }).click();
  await expect(page.getByRole('article', { name: /^Track / })).toHaveCount(3);
});
