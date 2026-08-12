import type { TimelineCoordinateMapper } from '@/layers/shared/timeline-coordinate-mapper';

interface CalculateRegionDragStartTimeOptions {
  initialStartTime: number;
  initialPointerX: number;
  currentPointerX: number;
  coordinateMapper: TimelineCoordinateMapper;
}

export function calculateRegionDragStartTime({
  initialStartTime,
  initialPointerX,
  currentPointerX,
  coordinateMapper,
}: CalculateRegionDragStartTimeOptions): number {
  const pointerDelta = currentPointerX - initialPointerX;
  const initialPixel = coordinateMapper.secondsToPixels(initialStartTime);
  return coordinateMapper.pixelsToSeconds(Math.max(0, initialPixel + pointerDelta));
}
