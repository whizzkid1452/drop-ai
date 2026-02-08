export class Session {
    // Pure State Management
    private _isPlaying: boolean = false;

    get isPlaying(): boolean {
        return this._isPlaying;
    }

    setPlaying(playing: boolean): void {
        this._isPlaying = playing;
        console.log(`[Session] State updated: isPlaying = ${playing}`);
    }
}
