import type { TimelineMarker } from '@/layers/shared/timeline-marker';

function sortTimelineMarkers(markers: readonly TimelineMarker[]): TimelineMarker[] {
  return [...markers].sort(
    (left, right) => left.quarterNotePosition - right.quarterNotePosition || left.id.localeCompare(right.id)
  );
}

export function addTimelineMarker(markers: readonly TimelineMarker[], marker: TimelineMarker): TimelineMarker[] {
  return sortTimelineMarkers([...markers, { ...marker }]);
}

export function moveTimelineMarker(
  markers: readonly TimelineMarker[],
  markerId: string,
  quarterNotePosition: number
): TimelineMarker[] {
  return sortTimelineMarkers(
    markers.map(marker => (marker.id === markerId ? { ...marker, quarterNotePosition } : { ...marker }))
  );
}

export function renameTimelineMarker(
  markers: readonly TimelineMarker[],
  markerId: string,
  name: string
): TimelineMarker[] {
  return markers.map(marker => (marker.id === markerId ? { ...marker, name } : { ...marker }));
}

export function removeTimelineMarker(markers: readonly TimelineMarker[], markerId: string): TimelineMarker[] {
  return markers.filter(marker => marker.id !== markerId).map(marker => ({ ...marker }));
}
