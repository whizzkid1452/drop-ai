export interface IAudioEngine {
    play(): Promise<void>;
    stop(): void;
    pause(): void;
}
