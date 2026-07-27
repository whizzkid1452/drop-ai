import type { IMidiInput, MidiInputDevice, MidiNoteOnEvent, MidiNoteOnListener } from './i-midi-input';
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

function parseNoteOnEvent(inputId: string, data: Uint8Array): MidiNoteOnEvent | null {
  const [status, note, velocity] = data;
  if (status === undefined || note === undefined || velocity === undefined) {
    return null;
  }
  const messageType = status & 0xf0;
  // MIDI 규약은 velocity 0인 Note On을 Note Off로 해석한다.
  if (messageType !== 0x90 || velocity === 0) {
    return null;
  }
  return {
    channel: (status & 0x0f) + 1,
    inputId,
    note,
    velocity,
  };
}

export class BrowserMidiInput implements IMidiInput {
  readonly #listeners = new Set<MidiNoteOnListener>();
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

  subscribe(listener: MidiNoteOnListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #bindInputs(): void {
    this.#unbindInputs();
    this.#access?.inputs.forEach(input => {
      const listener: EventListener = event => {
        const messageData = (event as MIDIMessageEvent).data;
        const noteOnEvent = messageData ? parseNoteOnEvent(input.id, messageData) : null;
        if (noteOnEvent) {
          this.#listeners.forEach(noteListener => noteListener(noteOnEvent));
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
