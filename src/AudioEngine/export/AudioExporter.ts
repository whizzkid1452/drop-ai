import * as Tone from 'tone';
import type { TrackData } from '@/AudioEngine/track/Track';
import { RegionRenderer } from '@/AudioEngine/logics/regionRenderer';
import {
    PLAYER_CONFIG,
    configurePlayerLoop,
    startPlayer
} from '@/AudioEngine/logics/playerConfig';
import { loadAndDecodeAudioBuffer } from '@/AudioEngine/logics/loadAndDecodeAudioBuffer';
import { AudioEngineError, AudioEngineErrorCode } from '@/AudioEngine/logics/audioEngine.errors';
import { audioBufferToWav } from '@/UI/components/Daw/components/ExportButton/utils/wavConverter';
import type { ExportRange } from './ExportOptions';

/**
 * AudioExporter
 * 
 * 프로젝트를 오디오 파일로 내보내는 책임을 가진 클래스.
 * AudioService에서 Export 로직을 분리하여 단일 책임 원칙을 준수합니다.
 * 
 * @example
 * ```typescript
 * const exporter = new AudioExporter();
 * const blob = await exporter.exportProject({
 *     tracks: trackData,
 *     range: { startTime: 0, endTime: 60 }
 * });
 * ```
 */
export class AudioExporter {
    /**
     * 프로젝트 전체를 오디오 파일로 내보냅니다.
     * Tone.Offline을 사용하여 정확한 타이밍과 이펙트를 반영합니다.
     * 
     * @param tracks - 내보낼 트랙 목록
     * @param range - 내보내기 범위 (선택사항)
     * @returns WAV 형식의 Blob
     * @throws {AudioEngineError} 내보내기 실패 시
     */
    async exportProject(
        tracks: TrackData[],
        range?: ExportRange
    ): Promise<Blob> {
        if (tracks.length === 0) {
            throw new AudioEngineError(
                AudioEngineErrorCode.EXPORT_NO_TRACKS,
                'No tracks to export'
            );
        }

        // 1. Preload Audio Buffers
        const audioBuffers = await this.preloadAudioBuffers(tracks);

        // 2. Calculate Duration
        const totalDuration = range
            ? range.endTime - range.startTime
            : this.getTotalDuration(tracks);

        if (totalDuration <= 0) {
            throw new AudioEngineError(
                AudioEngineErrorCode.EXPORT_ZERO_DURATION,
                'Export duration must be greater than 0',
                { totalDuration, range }
            );
        }

        // 3. Offline Rendering
        const renderedBuffer = await this.renderBuffer({
            tracks,
            totalDuration,
            audioBuffers,
            range,
        });

        // 4. Convert to WAV
        const audioBuffer = renderedBuffer.get();
        if (!audioBuffer) {
            throw new AudioEngineError(
                AudioEngineErrorCode.RENDER_FAILED,
                'Failed to render audio buffer'
            );
        }

        return audioBufferToWav(audioBuffer);
    }

    /**
     * 오디오 파일을 미리 로드하고 디코딩합니다.
     * Offline 렌더링 중에는 비동기 로딩이 불가능하므로 사전에 로드해야 합니다.
     */
    private async preloadAudioBuffers(tracks: TrackData[]): Promise<Map<string, AudioBuffer>> {
        const audioBuffers = new Map<string, AudioBuffer>();
        const context = Tone.getContext();

        await Promise.all(
            tracks.flatMap(track =>
                track.regions.map(async (region) => {
                    if (!region.audioFile) return;
                    const audioUrl = region.audioFile.url;
                    if (audioBuffers.has(audioUrl)) return;

                    const audioBuffer = await loadAndDecodeAudioBuffer({
                        audioContext: context,
                        audioUrl,
                    });
                    audioBuffers.set(audioUrl, audioBuffer);
                })
            )
        );

        return audioBuffers;
    }

    /**
     * 전체 프로젝트 길이를 계산합니다.
     */
    private getTotalDuration(tracks: TrackData[]): number {
        let totalDuration = 0;

        tracks.forEach(track => {
            track.regions.forEach((region) => {
                if (!region.audioFile) return;
                const duration = region.audioFile.duration ?? 0;
                const endPoint = region.startTime + duration;
                if (endPoint > totalDuration) {
                    totalDuration = endPoint;
                }
            });
        });

        return totalDuration;
    }

    /**
     * Offline 렌더링을 수행합니다.
     */
    private async renderBuffer({
        tracks,
        totalDuration,
        audioBuffers,
        range,
    }: {
        tracks: TrackData[];
        totalDuration: number;
        audioBuffers: Map<string, AudioBuffer>;
        range?: ExportRange;
    }) {
        return await Tone.Offline(({ transport }: { transport: ReturnType<typeof Tone.getTransport> }) => {
            tracks.forEach(track => {
                const channel = new Tone.Channel({
                    volume: track.volume ? Tone.gainToDb(track.volume) : 0,
                    pan: track.pan ?? 0,
                }).toDestination();

                track.regions.forEach((region) => {
                    if (!region.audioFile) return;

                    const buffer = audioBuffers.get(region.audioFile.url);
                    if (!buffer) return;

                    // region.audioFile이 확인됐으므로 렌더링 파라미터 계산
                    const baseParams = RegionRenderer.calculateRenderParams(region);
                    const adjustedParams = RegionRenderer.adjustForExportRange(baseParams, range);

                    if (adjustedParams.duration <= 0) return;

                    const player = new Tone.Player({
                        url: buffer,
                        loop: false,
                        ...PLAYER_CONFIG,
                    }).connect(channel);

                    configurePlayerLoop(
                        player,
                        adjustedParams.startOffset,
                        adjustedParams.duration
                    );

                    startPlayer({
                        player,
                        syncMode: false,
                        startTime: adjustedParams.startTime,
                        startOffset: adjustedParams.startOffset,
                        duration: adjustedParams.duration,
                    });
                });
            });

            transport.start();
        }, totalDuration);
    }
}
