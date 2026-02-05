
// Type definitions for Web MIDI API
// Project: https://www.w3.org/TR/webmidi/

interface Navigator {
    requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
}

declare namespace WebMidi {
    interface MIDIOptions {
        sysex?: boolean;
        software?: boolean;
    }

    type MIDIPortType = "input" | "output";
    type MIDIPortDeviceState = "disconnected" | "connected";
    type MIDIPortConnectionState = "open" | "closed" | "pending";

    interface MIDIPort extends EventTarget {
        id: string;
        manufacturer?: string;
        name?: string;
        type: MIDIPortType;
        version?: string;
        state: MIDIPortDeviceState;
        connection: MIDIPortConnectionState;
        onstatechange: ((this: MIDIPort, e: MIDIConnectionEvent) => any) | null;
        open(): Promise<MIDIPort>;
        close(): Promise<MIDIPort>;
    }

    interface MIDIInput extends MIDIPort {
        onmidimessage: ((this: MIDIInput, e: MIDIMessageEvent) => any) | null;
    }

    interface MIDIOutput extends MIDIPort {
        send(data: Sequence<number> | number[], timestamp?: number): void;
        clear(): void;
    }

    interface MIDIAccess extends EventTarget {
        inputs: MIDIInputMap;
        outputs: MIDIOutputMap;
        onstatechange: ((this: MIDIAccess, e: MIDIConnectionEvent) => any) | null;
        sysexEnabled: boolean;
    }

    interface MIDIInputMap extends ReadonlyMap<string, MIDIInput> { }
    interface MIDIOutputMap extends ReadonlyMap<string, MIDIOutput> { }

    interface MIDIMessageEvent extends Event {
        data: Uint8Array;
    }

    interface MIDIConnectionEvent extends Event {
        port: MIDIPort;
    }
}
