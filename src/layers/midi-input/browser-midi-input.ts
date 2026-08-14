import type { IMidiInput, MidiInputDevice, MidiInputEvent, MidiInputListener } from './i-midi-input';
import { MidiInputError, MidiInputErrorCode } from './midi-input-error';

type RequestMidiAccess = (options?: MIDIOptions) => Promise<MIDIAccess>;

interface BrowserMidiInputOptions {
  readonly requestMidiAccess?: RequestMidiAccess | null;
}

interface MidiInputBinding {
  readonly input: MIDIInput;
  readonly listener: EventListener;
}

function resolveDefaultRequestMidiAccess(): RequestMidiAccess | null {
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
    return null;
  }
  return options => navigator.requestMIDIAccess(options);
}

function parseChannelVoiceEvent(inputId: string, data: Uint8Array): MidiInputEvent | null {
  const status = data[0];
  const firstDataByte = data[1];
  if (status === undefined || firstDataByte === undefined) {
    return null;
  }
  const messageType = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  if (messageType === 0xd0) {
    return { channel, inputId, type: 'channelPressure', value: firstDataByte };
  }

  const secondDataByte = data[2];
  if (secondDataByte === undefined) {
    return null;
  }
  if (messageType === 0x80 || (messageType === 0x90 && secondDataByte === 0)) {
    return { channel, inputId, note: firstDataByte, type: 'noteOff', velocity: secondDataByte };
  }
  if (messageType === 0x90) {
    return { channel, inputId, note: firstDataByte, type: 'noteOn', velocity: secondDataByte };
  }
  if (messageType === 0xb0) {
    return {
      channel,
      controllerNumber: firstDataByte,
      inputId,
      type: 'controlChange',
      value: secondDataByte,
    };
  }
  if (messageType === 0xe0) {
    return {
      channel,
      inputId,
      type: 'pitchBend',
      value: (secondDataByte << 7) + firstDataByte - 8192,
    };
  }
  return null;
}

export class BrowserMidiInput implements IMidiInput {
  readonly #listeners = new Set<MidiInputListener>();
  readonly #requestMidiAccess: RequestMidiAccess | null;
  #access: MIDIAccess | null = null;
  #bindings: MidiInputBinding[] = [];
  #stateChangeListener: EventListener | null = null;

  constructor(options: BrowserMidiInputOptions = {}) {
    this.#requestMidiAccess =
      options.requestMidiAccess === undefined ? resolveDefaultRequestMidiAccess() : options.requestMidiAccess;
  }

  async connect(): Promise<readonly MidiInputDevice[]> {
    if (this.#access) {
      return this.#listDevices();
    }
    if (!this.#requestMidiAccess) {
      throw new MidiInputError(MidiInputErrorCode.UNAVAILABLE, '이 브라우저는 Web MIDI API를 지원하지 않습니다.');
    }

    try {
      this.#access = await this.#requestMidiAccess({ sysex: false });
      this.#stateChangeListener = () => this.#bindInputs();
      this.#access.addEventListener('statechange', this.#stateChangeListener);
      this.#bindInputs();
      return this.#listDevices();
    } catch (cause) {
      this.disconnect();
      if (cause instanceof MidiInputError) {
        throw cause;
      }
      throw new MidiInputError(MidiInputErrorCode.ACCESS_FAILED, 'MIDI 입력 장치 권한을 얻지 못했습니다.', cause);
    }
  }

  disconnect(): void {
    this.#unbindInputs();
    if (this.#access && this.#stateChangeListener) {
      this.#access.removeEventListener('statechange', this.#stateChangeListener);
    }
    this.#stateChangeListener = null;
    this.#access = null;
  }

  subscribe(listener: MidiInputListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #bindInputs(): void {
    this.#unbindInputs();
    this.#access?.inputs.forEach(input => {
      const listener: EventListener = event => {
        const messageData = (event as MIDIMessageEvent).data;
        const midiEvent = messageData ? parseChannelVoiceEvent(input.id, messageData) : null;
        if (midiEvent) {
          this.#listeners.forEach(midiListener => midiListener(midiEvent));
        }
      };
      input.addEventListener('midimessage', listener);
      this.#bindings.push({ input, listener });
    });
  }

  #unbindInputs(): void {
    this.#bindings.forEach(({ input, listener }) => input.removeEventListener('midimessage', listener));
    this.#bindings = [];
  }

  #listDevices(): MidiInputDevice[] {
    return [...(this.#access?.inputs.values() ?? [])].map(input => ({
      id: input.id,
      manufacturer: input.manufacturer,
      name: input.name,
      state: input.state,
    }));
  }
}
