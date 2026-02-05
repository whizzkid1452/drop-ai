
import * as Tone from 'tone';

/**
 * LiveInstrument
 * 
 * 실시간 연주에 사용되는 악기의 공통 인터페이스입니다.
 * Synth, Sampler 등 다양한 악기를 동일한 방식으로 제어하기 위해 사용합니다.
 */
export interface LiveInstrument {
    /**
     * @param note Frequency (Hz) or Note Name (e.g. "C4")
     * @param velocity 0~1
     * @param time When to trigger (default: Tone.now())
     */
    triggerAttack(note: Tone.FrequencyClass | number | string, velocity: number, time?: number): void;

    /**
     * @param note Frequency (Hz) or Note Name (e.g. "C4")
     * @param time When to trigger (default: Tone.now())
     */
    triggerRelease(note: Tone.FrequencyClass | number | string, time?: number): void;

    /**
     * 자원 해제
     */
    dispose(): void;
}
