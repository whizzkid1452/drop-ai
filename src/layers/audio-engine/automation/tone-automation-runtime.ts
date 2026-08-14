import * as Tone from 'tone';
import type { TimelineRange } from '../../shared/types/project-document.schema';
import type { AutomationLaneState, AutomationTarget } from '../../shared/types/automation-state';
import { scheduleAutomationLane, type IAutomationAudioTarget } from './automation-param-scheduler';

interface AutomationTrackLanes {
  readonly automationLanes: readonly AutomationLaneState[];
  readonly trackId: string;
}

interface ResolveAutomationTargetRequest {
  readonly target: AutomationTarget;
  readonly trackId: string;
}

interface ToneAutomationRuntimeDependencies {
  readonly listTrackLanes: () => readonly AutomationTrackLanes[];
  readonly resolveTarget: (request: ResolveAutomationTargetRequest) => IAutomationAudioTarget;
}

export class ToneAutomationRuntime {
  private isLoopEnabled = false;
  private loopEventId: number | null = null;
  private loopRange: TimelineRange | null = null;

  constructor(private readonly dependencies: ToneAutomationRuntimeDependencies) {}

  assertTargetsResolvable(automationTracks: readonly AutomationTrackLanes[]): void {
    automationTracks.forEach(({ automationLanes, trackId }) => {
      automationLanes
        .filter(lane => lane.isEnabled && lane.points.length > 0)
        .forEach(lane => this.dependencies.resolveTarget({ target: lane.target, trackId }));
    });
  }

  refresh(): void {
    const transport = Tone.getTransport();
    this.scheduleFrom({
      audioStartTimeSeconds: Tone.now(),
      timelineStartTimeSeconds: transport.seconds,
    });
    this.refreshLoopEvent();
  }

  holdAtCurrentPosition(): void {
    const transport = Tone.getTransport();
    this.scheduleFrom({
      audioStartTimeSeconds: Tone.now(),
      timelineEndTimeSeconds: transport.seconds,
      timelineStartTimeSeconds: transport.seconds,
    });
  }

  setLoopRange(range: TimelineRange | null): void {
    this.loopRange = range ? { ...range } : null;
    this.refreshLoopEvent();
  }

  setLoopEnabled(isEnabled: boolean): void {
    this.isLoopEnabled = isEnabled;
    this.refreshLoopEvent();
  }

  clearTargets(automationTracks: readonly AutomationTrackLanes[]): void {
    const audioTimeSeconds = Tone.now();
    automationTracks.forEach(({ automationLanes, trackId }) => {
      automationLanes
        .filter(lane => lane.isEnabled && lane.points.length > 0)
        .forEach(lane => {
          const target = this.dependencies.resolveTarget({ target: lane.target, trackId });
          target.cancelScheduledValues(audioTimeSeconds);
          target.restoreBaseValue(audioTimeSeconds);
        });
    });
  }

  private scheduleFrom({
    audioStartTimeSeconds,
    timelineEndTimeSeconds,
    timelineStartTimeSeconds,
  }: {
    readonly audioStartTimeSeconds: number;
    readonly timelineEndTimeSeconds?: number;
    readonly timelineStartTimeSeconds: number;
  }): void {
    this.dependencies.listTrackLanes().forEach(({ automationLanes, trackId }) => {
      automationLanes
        .filter(lane => lane.isEnabled && lane.points.length > 0)
        .forEach(lane => {
          scheduleAutomationLane({
            audioStartTimeSeconds,
            lane,
            target: this.dependencies.resolveTarget({ target: lane.target, trackId }),
            timelineEndTimeSeconds,
            timelineStartTimeSeconds,
          });
        });
    });
  }

  private refreshLoopEvent(): void {
    const transport = Tone.getTransport();
    if (this.loopEventId !== null) {
      transport.clear(this.loopEventId);
      this.loopEventId = null;
    }
    if (!this.isLoopEnabled || this.loopRange === null) {
      return;
    }

    const loopRange = this.loopRange;
    this.loopEventId = transport.schedule(audioTimeSeconds => {
      this.scheduleFrom({
        audioStartTimeSeconds: audioTimeSeconds,
        timelineEndTimeSeconds: loopRange.endTimeSeconds,
        timelineStartTimeSeconds: loopRange.startTimeSeconds,
      });
    }, loopRange.startTimeSeconds);
  }
}
