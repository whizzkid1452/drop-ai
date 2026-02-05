import * as Tone from 'tone';

/**
 * AudioPort
 * 
 * Abstraction for Audio Inputs/Outputs.
 * Currently wraps a Tone.Channel to provide Volume/Pan control and connectivity.
 */
export class AudioPort {
    private channel: Tone.Channel;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(options?: any) {
        this.channel = new Tone.Channel(options).toDestination();
    }

    // --- Connectivity ---

    connect(destination: Tone.InputNode): this {
        this.channel.connect(destination);
        return this;
    }

    disconnect(): this {
        this.channel.disconnect();
        return this;
    }

    dispose(): void {
        this.channel.dispose();
    }

    /**
     * The internal node to connect sources (e.g. Players) to.
     */
    get inputNode(): Tone.InputNode {
        return this.channel;
    }

    // --- Parameters ---

    get volume(): number {
        // Return linear gain (0.0 ~ 1.0) approx
        // Tone.volume.value is in dB.
        return Tone.dbToGain(this.channel.volume.value);
    }

    set volume(val: number) {
        // val is 0.0 ~ 1.0
        // Convert to dB
        const db = Tone.gainToDb(Math.max(0, val));
        this.channel.volume.rampTo(db, 0.1);
    }

    get pan(): number {
        return this.channel.pan.value;
    }

    set pan(val: number) {
        this.channel.pan.rampTo(val, 0.1);
    }
}
