
import type { ControlSurface } from '../ControlSurface';
import { PushPad } from './components/PushPad';

export class PushController implements ControlSurface {
    readonly name = "Ableton Push";

    private input: MIDIInput | null = null;
    private output: MIDIOutput | null = null;
    private pads: Map<number, PushPad> = new Map();

    // Event handlers
    public onPadPress?: (note: number, velocity: number) => void;
    public onPadRelease?: (note: number) => void;

    constructor() {
        this.handleMidiMessage = this.handleMidiMessage.bind(this);
    }

    async connect(): Promise<void> {
        if (!navigator.requestMIDIAccess) {
            throw new Error("Web MIDI API not supported");
        }

        const access = await navigator.requestMIDIAccess({ sysex: true });

        console.log(`[PushController] MIDI Access Granted. Inputs: ${access.inputs.size}`);

        // Find Push devices or fallback to first available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inputs = Array.from(access.inputs.values() as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.input = (inputs.find((i: any) => i.name?.includes("Ableton Push")) || inputs[0]) as MIDIInput;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const outputs = Array.from(access.outputs.values() as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.output = (outputs.find((o: any) => o.name?.includes("Ableton Push")) || outputs[0]) as MIDIOutput;

        if (this.input) {
            console.log(`[PushController] Connected Input: ${this.input.name}`);
            this.input.addEventListener('midimessage', this.handleMidiMessage);

            if (this.output) {
                console.log(`[PushController] Connected Output: ${this.output.name}`);
                this.initializePads();
            }

            console.log("Ableton Push (or compatible device) Connected");
        } else {
            console.warn("Ableton Push not found");
        }
    }

    disconnect(): void {
        if (this.input) {
            this.input.removeEventListener('midimessage', this.handleMidiMessage);
        }
        this.input = null;
        this.output = null;
        this.pads.clear();
    }

    isConnected(): boolean {
        return this.input !== null && this.output !== null;
    }

    private initializePads() {
        // Push 1/2 pads: 36 to 99 (typically 8x8 grid)
        // This is a simplified simplification, actual mapping depends on User Mode
        for (let i = 36; i <= 99; i++) {
            this.pads.set(i, new PushPad(this.sendMidi.bind(this), i));
        }
    }

    private sendMidi(status: number, data1: number, data2: number) {
        if (this.output) {
            this.output.send([status, data1, data2]);
        }
    }

    private handleMidiMessage(event: MIDIMessageEvent) {
        if (!event.data) return;
        const [status, data1, data2] = event.data;
        const command = status & 0xF0;

        // console.log(`[MIDI] Status: ${status.toString(16)} Data1: ${data1} Data2: ${data2}`); // Verbose log

        // Note On
        if (command === 0x90 && data2 > 0) {
            // console.log(`[PushController] Note On detected: ${data1} vel: ${data2}`);
            if (this.onPadPress) this.onPadPress(data1, data2);
        }
        // Note Off
        else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
            if (this.onPadRelease) this.onPadRelease(data1);
        }
    }

    getPad(note: number): PushPad | undefined {
        return this.pads.get(note);
    }
}
