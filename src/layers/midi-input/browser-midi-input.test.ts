import { describe, expect, it, vi } from 'vitest';
import { BrowserMidiInput } from './browser-midi-input';

class FakeMidiInput extends EventTarget {
  readonly id = 'midi-input-1';
  readonly manufacturer = '테스트 제조사';
  readonly name = '테스트 키보드';
  readonly state = 'connected' as const;

  emit(data: readonly number[]): void {
    const event = new Event('midimessage');
    Object.defineProperty(event, 'data', { value: new Uint8Array(data) });
    this.dispatchEvent(event);
  }
}

function createMidiAccess(input: FakeMidiInput): MIDIAccess {
  return {
    inputs: new Map([[input.id, input]]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MIDIAccess;
}

describe('BrowserMidiInput', () => {
  it('권한을 요청하고 연결된 입력 장치를 반환한다', async () => {
    const input = new FakeMidiInput();
    const requestMidiAccess = vi.fn().mockResolvedValue(createMidiAccess(input));
    const midiInput = new BrowserMidiInput({ requestMidiAccess });

    await expect(midiInput.connect()).resolves.toEqual([
      {
        id: input.id,
        manufacturer: input.manufacturer,
        name: input.name,
        state: input.state,
      },
    ]);
    expect(requestMidiAccess).toHaveBeenCalledWith({ sysex: false });
  });

  it('Note On 메시지를 채널·음표·속도로 변환한다', async () => {
    const input = new FakeMidiInput();
    const midiInput = new BrowserMidiInput({ requestMidiAccess: () => Promise.resolve(createMidiAccess(input)) });
    const listener = vi.fn();
    midiInput.subscribe(listener);
    await midiInput.connect();

    input.emit([0x92, 36, 100]);

    expect(listener).toHaveBeenCalledWith({
      channel: 3,
      inputId: input.id,
      note: 36,
      type: 'noteOn',
      velocity: 100,
    });
  });

  it.each([
    [[0x82, 36, 64], { channel: 3, inputId: 'midi-input-1', note: 36, type: 'noteOff', velocity: 64 }],
    [[0x92, 36, 0], { channel: 3, inputId: 'midi-input-1', note: 36, type: 'noteOff', velocity: 0 }],
    [[0xb2, 74, 100], { channel: 3, controllerNumber: 74, inputId: 'midi-input-1', type: 'controlChange', value: 100 }],
    [[0xd2, 96], { channel: 3, inputId: 'midi-input-1', type: 'channelPressure', value: 96 }],
    [[0xe2, 0, 96], { channel: 3, inputId: 'midi-input-1', type: 'pitchBend', value: 4096 }],
  ])('channel voice 메시지 %j를 정규화한다', async (message, expected) => {
    const input = new FakeMidiInput();
    const midiInput = new BrowserMidiInput({ requestMidiAccess: () => Promise.resolve(createMidiAccess(input)) });
    const listener = vi.fn();
    midiInput.subscribe(listener);
    await midiInput.connect();

    input.emit(message);

    expect(listener).toHaveBeenCalledWith(expected);
  });

  it.each([{ message: [0xa2, 36, 100] }, { message: [0xf8] }])(
    '지원 범위 밖의 메시지 $message를 무시한다',
    async ({ message }) => {
      const input = new FakeMidiInput();
      const midiInput = new BrowserMidiInput({ requestMidiAccess: () => Promise.resolve(createMidiAccess(input)) });
      const listener = vi.fn();
      midiInput.subscribe(listener);
      await midiInput.connect();

      input.emit(message);

      expect(listener).not.toHaveBeenCalled();
    }
  );

  it('Web MIDI API가 없으면 분류된 오류를 반환한다', async () => {
    const midiInput = new BrowserMidiInput({ requestMidiAccess: null });

    await expect(midiInput.connect()).rejects.toMatchObject({ code: 'MIDI_INPUT_UNAVAILABLE' });
  });
});
