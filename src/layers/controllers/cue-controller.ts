import type { IAudioSourceRegistry } from '../audio-source-registry/i-audio-source-registry';
import type { LoopSlotState, SessionStore, TrackState } from '../session/session';
import { TimelineCoordinateMapper } from '../shared/timeline-coordinate-mapper';
import type { CuePerformance, CuePerformanceEvent, CueState } from '../shared/types/clip-cue-state';
import type { EditorTrackRegionSnapshot } from '../shared/types/editor-runtime';
import type { LoopSlotAddress } from '../audio-engine/i-audio-engine';
import type { EditorController } from './editor-controller';
import type { ConfigureClipSlotRequest, LoopController } from './loop-controller';
import type { RegionController } from './region-controller';

const MAX_ARRANGEMENT_REGIONS = 10_000;
const TIME_EPSILON_SECONDS = 0.000_001;

interface CueControllerDependencies {
  readonly audioSourceRegistry: IAudioSourceRegistry;
  readonly createEventId?: () => string;
  readonly createPerformanceId?: () => string;
  readonly createRegionId?: () => string;
  readonly editorController: EditorController;
  readonly loopController: LoopController;
  readonly now?: () => string;
  readonly regionController: RegionController;
  readonly schedule?: (callback: () => void, delayMilliseconds: number) => ReturnType<typeof setTimeout>;
  readonly sessionStore: SessionStore;
}

interface ArrangementRegion {
  readonly duration: number;
  readonly gain: number;
  readonly id: string;
  readonly sourceId: string;
  readonly sourceStartTime: number;
  readonly startTime: number;
  readonly trackId: string;
}

export class CueController {
  readonly #audioSourceRegistry: IAudioSourceRegistry;
  readonly #createEventId: () => string;
  readonly #createPerformanceId: () => string;
  readonly #createRegionId: () => string;
  readonly #editorController: EditorController;
  readonly #followTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #loopController: LoopController;
  readonly #now: () => string;
  readonly #regionController: RegionController;
  readonly #schedule: (callback: () => void, delayMilliseconds: number) => ReturnType<typeof setTimeout>;
  readonly #sessionStore: SessionStore;

  constructor({
    audioSourceRegistry,
    createEventId = () => crypto.randomUUID(),
    createPerformanceId = () => crypto.randomUUID(),
    createRegionId = () => crypto.randomUUID(),
    editorController,
    loopController,
    now = () => new Date().toISOString(),
    regionController,
    schedule = (callback, delayMilliseconds) => setTimeout(callback, delayMilliseconds),
    sessionStore,
  }: CueControllerDependencies) {
    this.#audioSourceRegistry = audioSourceRegistry;
    this.#createEventId = createEventId;
    this.#createPerformanceId = createPerformanceId;
    this.#createRegionId = createRegionId;
    this.#editorController = editorController;
    this.#loopController = loopController;
    this.#now = now;
    this.#regionController = regionController;
    this.#schedule = schedule;
    this.#sessionStore = sessionStore;
  }

  configureClip(request: ConfigureClipSlotRequest): void {
    this.#loopController.configureClip(request);
  }

  startRecording(): void {
    const state = this.#sessionStore.getState();
    if (state.cueRecording.isRecording) {
      throw new Error('Cue 연주 기록이 이미 진행 중입니다.');
    }
    state.setCueRecording({ events: [], isRecording: true, startQuarterNotes: this.#currentQuarterNotes() });
  }

  stopRecording(name: string): CuePerformance {
    const state = this.#sessionStore.getState();
    if (!state.cueRecording.isRecording) {
      throw new Error('진행 중인 Cue 연주 기록이 없습니다.');
    }
    if (state.cueRecording.events.length === 0) {
      state.setCueRecording({ events: [], isRecording: false, startQuarterNotes: 0 });
      throw new Error('실행한 Clip이 없어 Cue 연주를 저장하지 않았습니다.');
    }
    const performance: CuePerformance = {
      createdAt: this.#now(),
      events: state.cueRecording.events.map(event => ({ ...event })),
      id: this.#createPerformanceId(),
      name,
    };
    state.setCueState({ performances: [...state.cue.performances, performance] });
    state.setCueRecording({ events: [], isRecording: false, startQuarterNotes: 0 });
    return performance;
  }

  dismissRecording(): void {
    this.#sessionStore.getState().setCueRecording({ events: [], isRecording: false, startQuarterNotes: 0 });
  }

  setCueState(cue: CueState): void {
    const performanceIds = new Set<string>();
    cue.performances.forEach(performance => {
      if (performanceIds.has(performance.id)) {
        throw new Error(`중복 Cue 연주 ID입니다: ${performance.id}`);
      }
      performanceIds.add(performance.id);
      const eventIds = new Set<string>();
      performance.events.forEach(event => {
        if (eventIds.has(event.id)) {
          throw new Error(`중복 Cue Event ID입니다: ${event.id}`);
        }
        eventIds.add(event.id);
        this.#getSlot(event);
      });
    });
    this.#sessionStore.getState().setCueState(cue);
  }

  deletePerformance(performanceId: string): void {
    const state = this.#sessionStore.getState();
    if (!state.cue.performances.some(performance => performance.id === performanceId)) {
      throw new Error(`Cue 연주를 찾을 수 없습니다: ${performanceId}`);
    }
    state.setCueState({ performances: state.cue.performances.filter(performance => performance.id !== performanceId) });
  }

  async trigger(address: LoopSlotAddress): Promise<void> {
    const slot = this.#getSlot(address);
    if (slot.launchMode === 'toggle' && slot.state === 'playing') {
      this.stop(address);
      return;
    }
    await this.#loopController.trigger(address);
    this.#recordEvent(address, slot);
    this.#scheduleFollowAction(address, slot);
  }

  stop(address: LoopSlotAddress): void {
    this.#cancelFollowAction(address);
    this.#closeRecordedEvent(address);
    this.#loopController.stop(address);
  }

  stopAll(): void {
    this.#followTimers.forEach(timer => clearTimeout(timer));
    this.#followTimers.clear();
    this.#loopController.stopAll();
  }

  async convertToArrangement(performanceId: string): Promise<void> {
    const performance = this.#getPerformance(performanceId);
    const regions = this.#createArrangementRegions(performance);
    const affectedTrackIds = [...new Set(regions.map(region => region.trackId))];
    const previousTracks = this.#snapshotTrackRegions(affectedTrackIds);
    try {
      for (const region of regions) {
        await this.#regionController.addRegion(region.trackId, region);
        await this.#editorController.setRegionProcessing({
          gain: region.gain,
          regionId: region.id,
          trackId: region.trackId,
        });
      }
    } catch (cause) {
      await this.#editorController.restoreTrackRegions({ tracks: previousTracks });
      throw cause;
    }
  }

  #recordEvent(address: LoopSlotAddress, slot: LoopSlotState): void {
    const state = this.#sessionStore.getState();
    if (!state.cueRecording.isRecording) {
      return;
    }
    const startQuarterNotes = Math.max(0, this.#currentQuarterNotes() - state.cueRecording.startQuarterNotes);
    const meter = this.#createMapper().getMeterAtQuarterNotes(this.#currentQuarterNotes());
    const durationQuarterNotes = slot.lengthBars * meter.beatsPerBar * (4 / meter.beatUnit);
    const event: CuePerformanceEvent = {
      durationQuarterNotes,
      id: this.#createEventId(),
      slotId: address.slotId,
      startQuarterNotes,
      trackId: address.trackId,
    };
    state.setCueRecording({ ...state.cueRecording, events: [...state.cueRecording.events, event] });
  }

  #scheduleFollowAction(address: LoopSlotAddress, slot: LoopSlotState): void {
    this.#cancelFollowAction(address);
    if (slot.followAction.type === 'none') {
      return;
    }
    const mapper = this.#createMapper();
    const startQuarterNotes = this.#currentQuarterNotes();
    const meter = mapper.getMeterAtQuarterNotes(startQuarterNotes);
    const followQuarterNotes = slot.followAction.afterBars * meter.beatsPerBar * (4 / meter.beatUnit);
    const delayMilliseconds =
      (mapper.quarterNotesToSeconds(startQuarterNotes + followQuarterNotes) -
        mapper.quarterNotesToSeconds(startQuarterNotes)) *
      1_000;
    const timer = this.#schedule(() => {
      this.#followTimers.delete(this.#createAddressKey(address));
      void this.#executeFollowAction(address, slot).catch(cause => {
        this.#sessionStore.getState().updateLoopSlot({
          ...address,
          updates: { errorMessage: cause instanceof Error ? cause.message : String(cause), state: 'error' },
        });
      });
    }, delayMilliseconds);
    this.#followTimers.set(this.#createAddressKey(address), timer);
  }

  async #executeFollowAction(address: LoopSlotAddress, slot: LoopSlotState): Promise<void> {
    this.#loopController.stop(address);
    if (slot.followAction.type !== 'next') {
      return;
    }
    const slots = this.#getTrack(address.trackId).loopSlots ?? [];
    const currentIndex = slots.findIndex(candidate => candidate.id === address.slotId);
    const candidates = [...slots.slice(currentIndex + 1), ...slots.slice(0, currentIndex)];
    const nextSlot = candidates.find(candidate => candidate.sourceId !== null);
    if (nextSlot) {
      await this.trigger({ slotId: nextSlot.id, trackId: address.trackId });
    }
  }

  #cancelFollowAction(address: LoopSlotAddress): void {
    const key = this.#createAddressKey(address);
    const timer = this.#followTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.#followTimers.delete(key);
    }
  }

  #createArrangementRegions(performance: CuePerformance): ArrangementRegion[] {
    const mapper = this.#createMapper();
    const regions: ArrangementRegion[] = [];
    performance.events.forEach(event => {
      const slot = this.#getSlot(event);
      if (slot.sourceId === null) {
        throw new Error(`Cue Event의 Clip Source가 없습니다: ${event.slotId}`);
      }
      const sourceDurationSeconds = this.#audioSourceRegistry.resolve(slot.sourceId)?.metadata.durationSeconds;
      if (sourceDurationSeconds === null || sourceDurationSeconds === undefined) {
        throw new Error(`Cue Event의 Source 길이를 확인할 수 없습니다: ${slot.sourceId}`);
      }
      const sourceEndTimeSeconds = slot.sourceEndTimeSeconds ?? sourceDurationSeconds;
      const cycleDurationSeconds = sourceEndTimeSeconds - slot.sourceStartTimeSeconds;
      if (cycleDurationSeconds <= 0) {
        throw new Error(`Cue Event의 Clip Source 범위가 유효하지 않습니다: ${event.slotId}`);
      }
      const eventStartTimeSeconds = mapper.quarterNotesToSeconds(event.startQuarterNotes);
      const eventEndTimeSeconds = mapper.quarterNotesToSeconds(event.startQuarterNotes + event.durationQuarterNotes);
      let remainingSeconds = eventEndTimeSeconds - eventStartTimeSeconds;
      let offsetSeconds = 0;
      while (remainingSeconds > TIME_EPSILON_SECONDS) {
        const duration = Math.min(cycleDurationSeconds, remainingSeconds);
        regions.push({
          duration,
          gain: slot.gain,
          id: this.#createRegionId(),
          sourceId: slot.sourceId,
          sourceStartTime: slot.sourceStartTimeSeconds,
          startTime: eventStartTimeSeconds + offsetSeconds,
          trackId: event.trackId,
        });
        if (regions.length > MAX_ARRANGEMENT_REGIONS) {
          throw new Error('Cue 변환 Region 수가 허용 범위를 초과했습니다.');
        }
        offsetSeconds += duration;
        remainingSeconds -= duration;
      }
    });
    return regions;
  }

  #snapshotTrackRegions(trackIds: readonly string[]): EditorTrackRegionSnapshot[] {
    return trackIds.map(trackId => {
      const track = this.#getTrack(trackId);
      return {
        regions: track.regions.map(region => ({
          durationSeconds: region.duration,
          fadeIn: { ...region.fadeIn },
          fadeOut: { ...region.fadeOut },
          gain: region.gain,
          id: region.id,
          isOpaque: region.isOpaque,
          layer: region.layer,
          sourceId: region.sourceId,
          sourceStartTimeSeconds: region.sourceStartTime,
          startTimeSeconds: region.startTime,
        })),
        trackId,
      };
    });
  }

  #closeRecordedEvent(address: LoopSlotAddress): void {
    const state = this.#sessionStore.getState();
    if (!state.cueRecording.isRecording) {
      return;
    }
    const eventIndex = this.#findLatestRecordedEventIndex(state.cueRecording.events, address);
    const event = state.cueRecording.events[eventIndex];
    if (!event) {
      return;
    }
    const endQuarterNotes = Math.max(0, this.#currentQuarterNotes() - state.cueRecording.startQuarterNotes);
    const elapsedQuarterNotes = endQuarterNotes - event.startQuarterNotes;
    if (elapsedQuarterNotes <= 0) {
      return;
    }
    state.setCueRecording({
      ...state.cueRecording,
      events: state.cueRecording.events.map((candidate, index) =>
        index === eventIndex ? { ...candidate, durationQuarterNotes: elapsedQuarterNotes } : candidate
      ),
    });
  }

  #findLatestRecordedEventIndex(events: readonly CuePerformanceEvent[], address: LoopSlotAddress): number {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event?.trackId === address.trackId && event.slotId === address.slotId) {
        return index;
      }
    }
    return -1;
  }

  #getPerformance(performanceId: string): CuePerformance {
    const performance = this.#sessionStore
      .getState()
      .cue.performances.find(candidate => candidate.id === performanceId);
    if (!performance) {
      throw new Error(`Cue 연주를 찾을 수 없습니다: ${performanceId}`);
    }
    return performance;
  }

  #getSlot(address: LoopSlotAddress): LoopSlotState {
    const slot = this.#getTrack(address.trackId).loopSlots?.find(candidate => candidate.id === address.slotId);
    if (!slot) {
      throw new Error(`Clip Slot을 찾을 수 없습니다: ${address.slotId}`);
    }
    return slot;
  }

  #getTrack(trackId: string): TrackState {
    const track = this.#sessionStore.getState().tracks.get(trackId);
    if (!track) {
      throw new Error(`Track을 찾을 수 없습니다: ${trackId}`);
    }
    return track;
  }

  #currentQuarterNotes(): number {
    return this.#createMapper().secondsToQuarterNotes(this.#sessionStore.getState().currentTime);
  }

  #createMapper(): TimelineCoordinateMapper {
    const state = this.#sessionStore.getState();
    return new TimelineCoordinateMapper({
      beatUnit: state.meterChanges[0]?.beatUnit ?? 4,
      beatsPerBar: state.meterChanges[0]?.beatsPerBar ?? 4,
      meterChanges: state.meterChanges,
      tempoBpm: state.tempo,
      tempoChanges: state.tempoChanges,
    });
  }

  #createAddressKey(address: LoopSlotAddress): string {
    return `${address.trackId}\u0000${address.slotId}`;
  }
}
