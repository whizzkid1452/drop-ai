
import * as Tone from 'tone';
import type { LiveInstrument } from './instruments/LiveInstrument';
import { DefaultSynth } from './instruments/DefaultSynth';

/**
 * LiveAudioEngine
 * 
 * 실시간 연주(Live Performance)와 관련된 오디오 로직을 담당합니다.
 * AudioService에서 분리되어 단일 책임 원칙(SRP)을 준수합니다.
 */
export class LiveAudioEngine {
    private instrument: LiveInstrument;

    constructor() {
        // 기본 악기로 초기화
        this.instrument = new DefaultSynth();
    }

    /**
     * 악기 교체
     */
    setInstrument(instrument: LiveInstrument) {
        this.instrument.dispose(); // 기존 악기 정리
        this.instrument = instrument;
    }

    /**
     * 노트 재생 (Note On)
     * @param note MIDI 노트 번호 또는 음정 이름 (e.g. 60, "C4")
     * @param velocity 벨로시티 (0~127)
     */
    triggerAttack(note: string | number, velocity: number = 100): void {
        const vel = velocity / 127;
        const freq = this.toFrequency(note);

        this.instrument.triggerAttack(freq, vel);
    }

    /**
     * 노트 중지 (Note Off)
     * @param note MIDI 노트 번호 또는 음정 이름
     */
    triggerRelease(note: string | number): void {
        const freq = this.toFrequency(note);
        this.instrument.triggerRelease(freq);
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
        this.instrument.dispose();
    }
}
