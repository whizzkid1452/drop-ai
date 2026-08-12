import type { BBTPosition } from '@/layers/shared/timeline-coordinate-mapper';

export function formatMusicalPosition({ bar, beat, tick }: BBTPosition): string {
  return `${bar.toString().padStart(3, '0')}|${beat.toString().padStart(2, '0')}|${tick.toString().padStart(4, '0')}`;
}
