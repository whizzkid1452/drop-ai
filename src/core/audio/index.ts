/**
 * Audio Core 모듈
 * Web Audio API 기반 DAW 오디오 처리 시스템
 */

export { AudioEngine } from './AudioEngine';
export { Transport } from './Transport';
export { Metronome } from './Metronome';
export { Track } from './Track';
export { Bus } from './Bus';
export { Route } from './Route';
export { Processor, type IProcessor, ProcessorState } from './Processor';
export { ProcessorChain } from './ProcessorChain';
export type { ProcessorChainNode, ProcessorChainStructure, LatencyInfo } from './ProcessorChain';
export { ProcessorPlacement } from './Route';
export { Clip } from './Clip';
export { Session } from './Session';
export { UndoStack } from './UndoStack';
export type { Command } from './UndoStack';

// Region/Playlist 시스템
export { Region } from './Region';
export type { RegionProperties, FadeInfo } from './Region';
export { AudioRegion } from './AudioRegion';
export { Playlist } from './Playlist';
export type { PlaylistItem } from './Playlist';

// BufferManager 시스템
export { BufferManager, ThreadBuffers } from './BufferManager';
export type { BufferPoolConfig } from './BufferManager';