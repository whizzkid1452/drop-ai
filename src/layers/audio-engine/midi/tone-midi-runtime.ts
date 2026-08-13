import * as Tone from 'tone';
import { COMPLETE_RESOURCE_CLEANUP, type ResourceCleanupResult } from '../../shared/types/resource-cleanup';
import { BUILTIN_MIDI_INSTRUMENT_ID, cloneMidiTrackState, type MidiTrackState } from '../../shared/types/midi-state';

interface MidiTrackRuntimeEntry {
  readonly eventIds: readonly number[];
  readonly midi: MidiTrackState;
  readonly synth: Tone.PolySynth<Tone.Synth>;
}

export interface SetToneMidiTrackStateRequest {
  readonly destination: Tone.ToneAudioNode;
  readonly midi: MidiTrackState;
  readonly trackId: string;
}

export class ToneMidiRuntime {
  private readonly entries = new Map<string, MidiTrackRuntimeEntry>();

  setTrackState(request: SetToneMidiTrackStateRequest): void {
    this.assertSupportedInstrument(request.midi.instrumentId);
    const nextEntry = this.createEntry(request);
    const previousEntry = this.entries.get(request.trackId);

    if (previousEntry) {
      this.disposeEntry(previousEntry);
    }
    this.entries.set(request.trackId, nextEntry);
  }

  removeTrack(trackId: string): void {
    const entry = this.entries.get(trackId);
    if (!entry) {
      return;
    }
    this.disposeEntry(entry);
    this.entries.delete(trackId);
  }

  panic(): void {
    this.entries.forEach(entry => entry.synth.releaseAll());
  }

  dispose(): ResourceCleanupResult {
    let failedResourceCount = 0;
    this.entries.forEach((entry, trackId) => {
      try {
        this.disposeEntry(entry);
        this.entries.delete(trackId);
      } catch {
        failedResourceCount += 1;
      }
    });
    return failedResourceCount === 0 ? COMPLETE_RESOURCE_CLEANUP : { failedResourceCount, isComplete: false };
  }

  private createEntry({ destination, midi }: SetToneMidiTrackStateRequest): MidiTrackRuntimeEntry {
    const synth = new Tone.PolySynth(Tone.Synth).connect(destination);
    const eventIds: number[] = [];

    try {
      midi.regions.forEach(region => {
        region.notes.forEach(note => {
          const noteStartTimeSeconds = region.startTimeSeconds + note.startOffsetSeconds;
          const eventId = Tone.getTransport().schedule(audioTimeSeconds => {
            synth.triggerAttackRelease(
              Tone.Frequency(note.pitch, 'midi').toFrequency(),
              note.durationSeconds,
              audioTimeSeconds,
              note.velocity / 127
            );
          }, noteStartTimeSeconds);
          eventIds.push(eventId);
        });
      });
      return { eventIds, midi: cloneMidiTrackState(midi), synth };
    } catch (cause) {
      eventIds.forEach(eventId => Tone.getTransport().clear(eventId));
      synth.disconnect();
      synth.dispose();
      throw cause;
    }
  }

  private disposeEntry(entry: MidiTrackRuntimeEntry): void {
    entry.eventIds.forEach(eventId => Tone.getTransport().clear(eventId));
    entry.synth.releaseAll();
    entry.synth.disconnect();
    entry.synth.dispose();
  }

  private assertSupportedInstrument(instrumentId: string): void {
    if (instrumentId !== BUILTIN_MIDI_INSTRUMENT_ID) {
      throw new RangeError(`지원하지 않는 MIDI Instrument입니다: ${instrumentId}`);
    }
  }
}
