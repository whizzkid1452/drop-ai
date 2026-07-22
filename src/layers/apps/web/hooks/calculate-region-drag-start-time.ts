interface CalculateRegionDragStartTimeOptions {
  initialStartTime: number;
  initialPointerX: number;
  currentPointerX: number;
  pixelsPerSecond: number;
}

export function calculateRegionDragStartTime({
  initialStartTime,
  initialPointerX,
  currentPointerX,
  pixelsPerSecond,
}: CalculateRegionDragStartTimeOptions): number {
  if (!Number.isFinite(pixelsPerSecond) || pixelsPerSecond <= 0) {
    return Math.max(0, initialStartTime);
  }

  const pointerDelta = currentPointerX - initialPointerX;
  return Math.max(0, initialStartTime + pointerDelta / pixelsPerSecond);
}
