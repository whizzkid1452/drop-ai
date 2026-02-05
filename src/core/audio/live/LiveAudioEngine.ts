
import * as Tone from 'tone';

/**
 * LiveAudioEngine
 * 
 * 실시간 연주(Live Performance)와 관련된 오디오 로직을 담당합니다.
 * AudioService에서 분리되어 단일 책임 원칙(SRP)을 준수합니다.
 */
export class LiveAudioEngine {
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

    /**
     * 노트 재생 (Note On)
     * @param note MIDI 노트 번호 또는 음정 이름 (e.g. 60, "C4")
     * @param velocity 벨로시티 (0~127)
     */
    triggerAttack(note: string | number, velocity: number = 100): void {
        const vel = velocity / 127;
        const freq = this.toFrequency(note);

        if (Tone.getContext().state !== 'running') {
            Tone.start();
        }

        this.synth.triggerAttack(freq, Tone.now(), vel);
    }

    /**
     * 노트 중지 (Note Off)
     * @param note MIDI 노트 번호 또는 음정 이름
     */
    triggerRelease(note: string | number): void {
        const freq = this.toFrequency(note);
        this.synth.triggerRelease(freq, Tone.now());
    }

    /**
     * 입력을 Frequency로 변환
     */
    private toFrequency(note: string | number): number {
        return typeof note === 'number'
            ? Tone.Frequency(note, "midi").toFrequency()
            : Tone.Frequency(note).toFrequency();
    }

    dispose(): void {
        this.synth.dispose();
    }
}
