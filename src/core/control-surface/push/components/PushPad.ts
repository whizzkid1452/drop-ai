
import type { SurfacePad } from '../../components/SurfacePad';

export class PushPad implements SurfacePad {
    constructor(
        private sendMidi: (status: number, data1: number, data2: number) => void,
        private note: number
    ) { }

    setColor(color: number): void {
        // Ableton Push uses Note On messages for pad LEDs
        this.sendMidi(0x90, this.note, color);
    }

    pulse(color: number): void {
        // Simple pulse implementation (could be more complex with timers)
        this.setColor(color);
        setTimeout(() => this.setColor(0), 200);
    }
}
