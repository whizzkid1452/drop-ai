/**
 * AutomationPoint
 * 
 * Represents a single point in an automation curve.
 */
export interface AutomationPoint {
    id: string;
    time: number;   // Time in seconds
    value: number;  // Normalized value (usually 0.0 ~ 1.0, but can be anything depending on parameter)
    curve?: 'linear' | 'exponential' | 'step'; // Interpolation type to the *next* point
}
