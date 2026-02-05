
import * as Tone from 'tone';
import type { LiveInstrument } from './LiveInstrument';

/**
 * DefaultSynth
 * 
 * 기본으로 제공되는 폴리포닉 신디사이저입니다.
 */
export class DefaultSynth implements LiveInstrument {
    private synth: Tone.PolySynth;

    constructor() {
        this.synth = new Tone.PolySynth(Tone.Synth, {
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 1
            }
        }).toDestination();
    }

    triggerAttack(note: Tone.FrequencyClass | number | string, velocity: number, time?: number): void {
        this.ensureContext();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.synth.triggerAttack(note as any, time ?? Tone.now(), velocity);
    }

    triggerRelease(note: Tone.FrequencyClass | number | string, time?: number): void {
        this.ensureContext();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.synth.triggerRelease(note as any, time ?? Tone.now());
    }

    dispose(): void {
        this.synth.dispose();
    }

    private ensureContext() {
        if (Tone.getContext().state !== 'running') {
            Tone.start();
        }
    }
}
