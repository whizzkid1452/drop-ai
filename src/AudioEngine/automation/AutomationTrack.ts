import type { AutomationPoint } from './AutomationPoint';

/**
 * AutomationTrack
 * 
 * Manages a list of automation points for a specific parameter (e.g., Volume, Pan).
 * Handles adding/removing points and calculating the value at a specific time (interpolation).
 */
export class AutomationTrack {
    private points: AutomationPoint[] = [];

    constructor(initialPoints: AutomationPoint[] = []) {
        this.points = [...initialPoints].sort((a, b) => a.time - b.time);
    }

    addPoint(point: AutomationPoint) {
        // Remove existing point at the exact same time if any (or just overwrite strategy?)
        // For simplicity, we filter out points within a tiny epsilon or strictly same time.
        this.points = this.points.filter(p => Math.abs(p.time - point.time) > 0.0001);
        this.points.push(point);
        this.points.sort((a, b) => a.time - b.time);
    }

    removePoint(id: string) {
        this.points = this.points.filter(p => p.id !== id);
    }

    getPoints(): AutomationPoint[] {
        return [...this.points];
    }

    /**
     * Calculate value at a specific time.
     */
    getValueAt(time: number): number {
        if (this.points.length === 0) return 0; // Default value? Or should be provided?

        // 1. Time before first point -> value of first point
        if (time <= this.points[0].time) return this.points[0].value;

        // 2. Time after last point -> value of last point
        if (time >= this.points[this.points.length - 1].time) {
            return this.points[this.points.length - 1].value;
        }

        // 3. Find surrounding points
        // We know time is between points[0] and points[last]
        let prevIndex = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            if (time >= this.points[i].time && time < this.points[i + 1].time) {
                prevIndex = i;
                break;
            }
        }

        const prev = this.points[prevIndex];
        const next = this.points[prevIndex + 1];

        // 4. Interpolate
        return this.interpolate(prev, next, time);
    }

    private interpolate(prev: AutomationPoint, next: AutomationPoint, time: number): number {
        const t = (time - prev.time) / (next.time - prev.time); // Normalized time 0.0 ~ 1.0

        // Basic Linear Interpolation
        // TODO: Support 'exponential', 'step', 'bezier' etc based on prev.curve
        const curve = prev.curve || 'linear';

        switch (curve) {
            case 'step':
                return prev.value; // Hold value until next point
            case 'linear':
            default:
                return prev.value + (next.value - prev.value) * t;
        }
    }
}
