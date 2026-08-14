import { expect, test } from '@playwright/test';
import { ensureFakeAudioInputFixture } from './fixtures/fake-audio-input';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class FakeMidiInput extends EventTarget {
      readonly id = 'keyboard-1';
      readonly manufacturer = 'Drop AI Test';
      readonly name = 'Fake MIDI Keyboard';
      readonly state = 'connected';
      readonly type = 'input';

      send(data: readonly number[]): void {
        const event = new Event('midimessage');
        Object.defineProperty(event, 'data', { value: new Uint8Array(data) });
        this.dispatchEvent(event);
      }
    }

    const input = new FakeMidiInput();
    const access = new EventTarget() as EventTarget & { inputs: Map<string, FakeMidiInput> };
    access.inputs = new Map([[input.id, input]]);
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: async () => access,
    });
    Object.defineProperty(window, '__sendMidiMessage', {
      configurable: true,
      value: (data: readonly number[]) => input.send(data),
    });
  });
});

test('가짜 MIDI 입력을 녹음하고 CC·Quantize·Transpose·재생을 확인한다', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(ensureFakeAudioInputFixture());
  await page.waitForURL('**/daw');

  await page.getByRole('button', { name: '빈 MIDI Track 추가' }).click();
  const midiTrack = page.getByRole('article', { name: /^Track / }).nth(1);
  await midiTrack.getByRole('button', { name: /Piano Roll 표시$/ }).click();
  await midiTrack.getByRole('button', { name: /MIDI 입력 연결$/ }).click();
  await expect(midiTrack.getByRole('combobox', { name: /MIDI 입력 장치$/ })).toHaveValue('keyboard-1');

  await page.getByTitle(/^Play/).click();
  await midiTrack.getByRole('button', { name: /MIDI 녹음 시작$/ }).click();
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    (window as typeof window & { __sendMidiMessage: (data: readonly number[]) => void }).__sendMidiMessage([
      0x90, 60, 100,
    ]);
    (window as typeof window & { __sendMidiMessage: (data: readonly number[]) => void }).__sendMidiMessage([
      0xb0, 74, 96,
    ]);
  });
  await page.waitForTimeout(260);
  await page.evaluate(() => {
    (window as typeof window & { __sendMidiMessage: (data: readonly number[]) => void }).__sendMidiMessage([
      0x80, 60, 0,
    ]);
  });
  await expect(midiTrack.getByText(/REC · 3 EVENTS/)).toBeVisible();
  await midiTrack.getByRole('button', { name: /MIDI 녹음 종료$/ }).click();
  await page.getByTitle(/^Stop/).click();

  const note = midiTrack.locator('[data-note-id]').first();
  await expect(note).toBeVisible();
  await note.click();
  await expect(midiTrack.getByRole('option', { name: /CC 74/ })).toHaveCount(1);

  await midiTrack.getByRole('button', { name: /MIDI Quantize$/ }).click();
  await expect
    .poll(async () => {
      const noteStart = Number(await midiTrack.getByRole('spinbutton', { name: /note 시작$/ }).inputValue());
      return Math.abs(noteStart / 0.25 - Math.round(noteStart / 0.25));
    })
    .toBeLessThan(0.000_001);

  await midiTrack.getByRole('button', { name: /MIDI \+12 transpose$/ }).click();
  await expect(midiTrack.getByRole('spinbutton', { name: /note pitch$/ })).toHaveValue('72');

  const midiMeter = midiTrack.getByRole('meter', { name: 'Track' });
  await page.getByTitle(/^Play/).click();
  await expect.poll(async () => Number(await midiMeter.getAttribute('data-peak-dbfs'))).toBeGreaterThan(-60);
  await page.getByTitle(/^Stop/).click();
  await midiTrack.getByRole('button', { name: /MIDI Panic$/ }).click();
});
