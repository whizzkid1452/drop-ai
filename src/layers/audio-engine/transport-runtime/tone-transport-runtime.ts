import * as Tone from 'tone';
import type { TimelineRange } from '../../shared/types/project-document.schema';
import type { SetAudioTempoMapRequest } from '../i-audio-engine';
import { createTempoSchedule } from './tempo-schedule';

const METRONOME_INTERVAL = '4n';
const METRONOME_NOTE = 'C6';
const METRONOME_NOTE_LENGTH = '32n';

export class ToneTransportRuntime {
  private tempoEventIds: number[] = [];
  private metronomeEventId: number | null = null;
  private metronomeSynth: Tone.Synth | null = null;
  private metronomeVolume = 0.8;
  private loopRange: TimelineRange | null = null;

  setTempoMap(request: SetAudioTempoMapRequest): void {
    const schedule = createTempoSchedule(request.changes);
    const transport = Tone.getTransport();
    this.clearTempoEvents();

    const currentEntry = [...schedule].reverse().find(entry => entry.atTimeSeconds <= transport.seconds);
    if (!currentEntry) {
      throw new RangeError('현재 Transport 위치에 적용할 Tempo가 없습니다.');
    }
    transport.bpm.value = currentEntry.bpm;

    this.tempoEventIds = schedule.map(entry =>
      transport.schedule(time => {
        transport.bpm.setValueAtTime(entry.bpm, time);
      }, entry.atTimeSeconds)
    );
  }

  setLoopRange(range: TimelineRange | null): void {
    const transport = Tone.getTransport();
    if (range === null) {
      this.loopRange = null;
      transport.loop = false;
      return;
    }
    if (range.endTimeSeconds <= range.startTimeSeconds) {
      throw new RangeError('Loop 끝 시각은 시작 시각보다 커야 합니다.');
    }

    this.loopRange = { ...range };
    transport.loopStart = range.startTimeSeconds;
    transport.loopEnd = range.endTimeSeconds;
  }

  setLoopEnabled(isEnabled: boolean): void {
    if (isEnabled && this.loopRange === null) {
      throw new RangeError('Loop를 활성화하려면 범위를 먼저 설정해야 합니다.');
    }
    Tone.getTransport().loop = isEnabled;
  }

  setMetronomeEnabled(isEnabled: boolean): void {
    if (!isEnabled) {
      this.clearMetronomeEvent();
      return;
    }
    if (this.metronomeEventId !== null) {
      return;
    }

    const synth = this.getMetronomeSynth();
    this.metronomeEventId = Tone.getTransport().scheduleRepeat(time => {
      synth.triggerAttackRelease(METRONOME_NOTE, METRONOME_NOTE_LENGTH, time);
    }, METRONOME_INTERVAL);
  }

  setMetronomeVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('Metronome 볼륨은 0 이상 1 이하여야 합니다.');
    }
    this.metronomeVolume = volume;
    if (this.metronomeSynth) {
      this.metronomeSynth.volume.value = Tone.gainToDb(volume);
    }
  }

  private getMetronomeSynth(): Tone.Synth {
    if (!this.metronomeSynth) {
      this.metronomeSynth = new Tone.Synth().connect(Tone.getDestination());
      this.metronomeSynth.volume.value = Tone.gainToDb(this.metronomeVolume);
    }
    return this.metronomeSynth;
  }

  private clearTempoEvents(): void {
    const transport = Tone.getTransport();
    this.tempoEventIds.forEach(eventId => transport.clear(eventId));
    this.tempoEventIds = [];
  }

  private clearMetronomeEvent(): void {
    if (this.metronomeEventId === null) {
      return;
    }
    Tone.getTransport().clear(this.metronomeEventId);
    this.metronomeEventId = null;
  }
}
