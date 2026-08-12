import type { SessionStore } from '../session/session';
import type { TimelineMarker } from '../shared/timeline-marker';

export class TimelineController {
  constructor(private readonly sessionStore: SessionStore) {}

  setMarkers(markers: readonly TimelineMarker[]): void {
    this.sessionStore.getState().setTimelineMarkers(markers);
  }
}
