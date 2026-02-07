
import { useEffect, useState, useRef, useCallback } from 'react';

export type MidiMsg = {
    command: number;
    channel: number;
    note: number;
    velocity: number;
    timestamp: number;
    sourceId: string;
};

type MidiCallback = (msg: MidiMsg) => void;

interface MidiState {
    isEnabled: boolean;
    inputs: WebMidi.MIDIInput[];
    outputs: WebMidi.MIDIOutput[];
    error: string | null;
}

// Global listener registry to avoid adding too many native event listeners
const listeners = new Set<MidiCallback>();

export function useMidi() {
    const [state, setState] = useState<MidiState>({
        isEnabled: false,
        inputs: [],
        outputs: [],
        error: null,
    });

    const accessRef = useRef<WebMidi.MIDIAccess | null>(null);

    const handleMidiMessage = useCallback((event: WebMidi.MIDIMessageEvent) => {
        if (!event.data) return;

        const [status, note, velocity] = event.data;
        const command = status & 0xf0;
        const channel = status & 0x0f;

        const msg: MidiMsg = {
            command,
            channel,
            note,
            velocity,
            timestamp: event.timeStamp,
            sourceId: (event.target as WebMidi.MIDIInput).id,
        };

        listeners.forEach(callback => callback(msg));
    }, []);

    const updateDevices = useCallback(() => {
        if (!accessRef.current) return;

        const inputs = Array.from(accessRef.current.inputs.values());
        const outputs = Array.from(accessRef.current.outputs.values());

        setState(prev => ({ ...prev, inputs, outputs }));

        // Auto-attach listeners to all inputs
        inputs.forEach(input => {
            // Avoid double binding if possible, but native onmidimessage overwrite is safe
            input.onmidimessage = handleMidiMessage;
        });
    }, [handleMidiMessage]);

    useEffect(() => {
        if (!navigator.requestMIDIAccess) {
            setState(prev => ({ ...prev, error: "Web MIDI API not supported in this browser." }));
            return;
        }

        navigator.requestMIDIAccess()
            .then((access) => {
                accessRef.current = access;
                setState(prev => ({ ...prev, isEnabled: true }));
                updateDevices();

                access.onstatechange = (e) => {
                    console.log('MIDI connection status changed', e);
                    updateDevices();
                };
            })
            .catch((err) => {
                console.error("MIDI Access Failed", err);
                setState(prev => ({ ...prev, error: "MIDI Access Denied" }));
            });
    }, [updateDevices]);

    return state;
}

export function useMidiNote(callback: (note: number, velocity: number, isNoteOn: boolean) => void) {
    useEffect(() => {
        const handler: MidiCallback = (msg) => {
            // Note On: 144 (0x90), Note Off: 128 (0x80)
            // Some devices send Note On with 0 velocity as Note Off
            if (msg.command === 144 && msg.velocity > 0) {
                callback(msg.note, msg.velocity, true);
            } else if (msg.command === 128 || (msg.command === 144 && msg.velocity === 0)) {
                callback(msg.note, 0, false);
            }
        };

        listeners.add(handler);
        return () => {
            listeners.delete(handler);
        };
    }, [callback]);
}
