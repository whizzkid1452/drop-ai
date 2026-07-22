import * as Tone from 'tone';
import { startPlayer } from './config/player-config';
import { encodeAudioBufferToWav } from './encoders/wav-encoder';
import { AudioEngineError, AudioEngineErrorCode, ERROR_MESSAGES } from './errors';
import type {
  ExportRequest,
  ExportTrack,
  IAudioEngine,
  RegionData,
  ReplaceRegionRequest,
  RescheduleRegionRequest,
} from './i-audio-engine';
import { RegionRenderer, type RegionRenderParams } from './renderers/region-renderer';

interface RegionPlayerEntry {
  player: Tone.Player;
  regionData: RegionData;
  revision: number;
}

interface CreateRegionEntriesRequest {
  channel: Tone.Channel;
  regions: RegionData[];
}

export class AudioEngine implements IAudioEngine {
  private channels: Map<string, Tone.Channel> = new Map();
  private desiredTrackVolumes: Map<string, number> = new Map();
  private mutedTrackIds: Set<string> = new Set();
  private players: Map<string, Map<string, RegionPlayerEntry>> = new Map();

  async play(): Promise<void> {
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    await Tone.getTransport().start();
  }

  pause(): void {
    Tone.getTransport().pause();
  }

  stop(): void {
    Tone.getTransport().stop();
  }

  setTime(time: number): void {
    Tone.getTransport().seconds = time;
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  async addTrack(trackId: string): Promise<void> {
    console.log(`[AudioEngine] Adding track: ${trackId}`);
    this.getOrInitChannel(trackId);
  }

  removeTrack(trackId: string): void {
    const trackPlayers = this.players.get(trackId);
    trackPlayers?.forEach(entry => this.disposePlayer(entry.player));
    this.players.delete(trackId);

    const channel = this.channels.get(trackId);
    if (channel) {
      channel.solo = false;
      channel.disconnect();
      channel.dispose();
    }
    this.channels.delete(trackId);
    this.desiredTrackVolumes.delete(trackId);
    this.mutedTrackIds.delete(trackId);
  }

  setTrackVolume(trackId: string, volume: number): void {
    const channel = this.getOrInitChannel(trackId);
    this.desiredTrackVolumes.set(trackId, volume);
    if (this.mutedTrackIds.has(trackId)) {
      return;
    }

    const volumeInDb = Tone.gainToDb(volume);
    channel.volume.rampTo(volumeInDb, 0.1);
  }

  setTrackPan(trackId: string, pan: number): void {
    const channel = this.getOrInitChannel(trackId);
    channel.pan.rampTo(pan, 0.1);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const channel = this.getExistingChannel(trackId);
    if (muted) {
      channel.mute = true;
      this.mutedTrackIds.add(trackId);
      return;
    }

    this.mutedTrackIds.delete(trackId);
    const desiredVolume = this.desiredTrackVolumes.get(trackId) ?? 1;
    channel.mute = false;
    channel.volume.value = Tone.gainToDb(desiredVolume);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this.getExistingChannel(trackId).solo = soloed;
  }

  getTrackParams(trackId: string): { volume: number; pan: number } | null {
    const channel = this.channels.get(trackId);
    if (!channel) {
      return null;
    }

    return {
      volume: this.desiredTrackVolumes.get(trackId) ?? Tone.dbToGain(channel.volume.value),
      pan: channel.pan.value,
    };
  }

  async addRegion(trackId: string, regionData: RegionData): Promise<void> {
    const channel = this.getOrInitChannel(trackId);
    const trackPlayers = this.players.get(trackId);
    if (!trackPlayers) {
      throw this.createRegionStateChangedError({ trackId, regionId: regionData.id });
    }
    if (trackPlayers.has(regionData.id)) {
      throw this.createRegionIdConflictError({ trackId, regionId: regionData.id });
    }

    const [entry] = await this.createScheduledRegionEntries({ channel, regions: [regionData] });
    if (!entry) {
      return;
    }
    if (this.players.get(trackId) !== trackPlayers) {
      this.cleanupRegionEntries([entry]);
      throw this.createRegionStateChangedError({ trackId, regionId: regionData.id });
    }
    if (trackPlayers.has(regionData.id)) {
      this.cleanupRegionEntries([entry]);
      throw this.createRegionIdConflictError({ trackId, regionId: regionData.id });
    }

    trackPlayers.set(entry.regionData.id, entry);
  }

  removeRegion(trackId: string, regionId: string): void {
    const trackPlayers = this.players.get(trackId);
    const entry = trackPlayers?.get(regionId);
    if (!entry) {
      return;
    }

    this.disposePlayer(entry.player);
    trackPlayers?.delete(regionId);
  }

  rescheduleRegion(request: RescheduleRegionRequest): void {
    const trackPlayers = this.players.get(request.trackId);
    const entry = this.getRegionEntry(request);
    const channel = this.getExistingChannel(request.trackId);
    const nextRegionData = { ...entry.regionData, startTime: request.startTime };
    const nextEntry: RegionPlayerEntry = {
      player: new Tone.Player({ url: entry.player.buffer, loop: false }).connect(channel),
      regionData: this.cloneRegionData(nextRegionData),
      revision: entry.revision + 1,
    };

    try {
      this.schedulePlayer(nextEntry.player, nextEntry.regionData);
    } catch (error) {
      this.cleanupRegionEntries([nextEntry]);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    this.disposePlayer(entry.player);
    trackPlayers?.set(request.regionId, nextEntry);
  }

  async replaceRegion(request: ReplaceRegionRequest): Promise<void> {
    const trackPlayers = this.players.get(request.trackId);
    const originalEntry = trackPlayers?.get(request.regionId);
    if (!trackPlayers || !originalEntry) {
      throw this.createRegionNotFoundError(request);
    }

    const originalRevision = originalEntry.revision;
    this.validateReplacementIds(trackPlayers, request);
    const channel = this.getExistingChannel(request.trackId);
    const replacementEntries = await this.createScheduledRegionEntries({
      channel,
      regions: request.replacements,
    });

    const currentEntry = trackPlayers.get(request.regionId);
    const stateChanged =
      this.players.get(request.trackId) !== trackPlayers ||
      currentEntry !== originalEntry ||
      currentEntry?.revision !== originalRevision;
    if (stateChanged) {
      this.cleanupRegionEntries(replacementEntries);
      throw this.createRegionStateChangedError(request);
    }

    try {
      this.validateReplacementIds(trackPlayers, request);
    } catch (error) {
      this.cleanupRegionEntries(replacementEntries);
      throw error;
    }

    this.disposePlayer(originalEntry.player);
    trackPlayers.delete(request.regionId);
    replacementEntries.forEach(entry => trackPlayers.set(entry.regionData.id, entry));
  }

  async exportProject(request: ExportRequest): Promise<Blob> {
    const duration = request.range.endTime - request.range.startTime;
    if (duration <= 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_ZERO_DURATION, ERROR_MESSAGES.EXPORT_ZERO_DURATION);
    }
    if (request.tracks.length === 0) {
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_NO_TRACKS, ERROR_MESSAGES.EXPORT_NO_TRACKS);
    }

    try {
      const renderedBuffer = await Tone.Offline(
        async () => this.scheduleExport(request),
        duration,
        2,
        request.sampleRate
      );
      const audioBuffer = renderedBuffer.get();
      if (!audioBuffer) {
        throw new AudioEngineError(AudioEngineErrorCode.RENDER_FAILED, ERROR_MESSAGES.RENDER_FAILED);
      }
      return encodeAudioBufferToWav(audioBuffer);
    } catch (error) {
      if (error instanceof AudioEngineError) {
        throw error;
      }
      throw new AudioEngineError(AudioEngineErrorCode.EXPORT_FAILED, ERROR_MESSAGES.EXPORT_FAILED, {
        cause: this.describeError(error),
      });
    }
  }

  private getOrInitChannel(trackId: string): Tone.Channel {
    const currentChannel = this.channels.get(trackId);
    if (currentChannel) {
      return currentChannel;
    }

    const channel = new Tone.Channel({
      volume: 0,
      pan: 0,
    }).toDestination();
    this.channels.set(trackId, channel);
    this.desiredTrackVolumes.set(trackId, 1);
    this.players.set(trackId, new Map());
    return channel;
  }

  private getExistingChannel(trackId: string): Tone.Channel {
    const channel = this.channels.get(trackId);
    if (!channel) {
      throw new AudioEngineError(AudioEngineErrorCode.TRACK_NOT_FOUND, ERROR_MESSAGES.TRACK_NOT_FOUND, { trackId });
    }
    return channel;
  }

  private getRegionEntry(request: RescheduleRegionRequest): RegionPlayerEntry {
    const entry = this.players.get(request.trackId)?.get(request.regionId);
    if (!entry) {
      throw this.createRegionNotFoundError(request);
    }
    return entry;
  }

  private async createScheduledRegionEntries(request: CreateRegionEntriesRequest): Promise<RegionPlayerEntry[]> {
    const entries = request.regions.map(regionData => ({
      player: new Tone.Player({ loop: false }).connect(request.channel),
      regionData: this.cloneRegionData(regionData),
      revision: 0,
    }));

    const loadResults = await Promise.allSettled(entries.map(entry => entry.player.load(entry.regionData.url)));
    const loadFailure = loadResults.find(result => result.status === 'rejected');
    if (loadFailure?.status === 'rejected') {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_LOAD_FAILED, ERROR_MESSAGES.REGION_LOAD_FAILED, {
        cause: this.describeError(loadFailure.reason),
      });
    }

    try {
      entries.forEach(entry => this.schedulePlayer(entry.player, entry.regionData));
    } catch (error) {
      this.cleanupRegionEntries(entries);
      throw new AudioEngineError(AudioEngineErrorCode.REGION_SCHEDULE_FAILED, ERROR_MESSAGES.REGION_SCHEDULE_FAILED, {
        cause: this.describeError(error),
      });
    }

    return entries;
  }

  private schedulePlayer(player: Tone.Player, regionData: RegionData): void {
    startPlayer({
      player,
      syncMode: true,
      startTime: regionData.startTime,
      startOffset: regionData.sourceStartTime,
      duration: regionData.duration,
    });
  }

  private validateReplacementIds(trackPlayers: Map<string, RegionPlayerEntry>, request: ReplaceRegionRequest): void {
    const replacementIds = new Set<string>();
    const hasConflict = request.replacements.some(replacement => {
      if (replacementIds.has(replacement.id)) {
        return true;
      }
      replacementIds.add(replacement.id);
      return replacement.id !== request.regionId && trackPlayers.has(replacement.id);
    });

    if (hasConflict) {
      throw this.createRegionIdConflictError(request);
    }
  }

  private createRegionIdConflictError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_ID_CONFLICT, ERROR_MESSAGES.REGION_ID_CONFLICT, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private createRegionStateChangedError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_STATE_CHANGED, ERROR_MESSAGES.REGION_STATE_CHANGED, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private createRegionNotFoundError(request: { trackId: string; regionId: string }): AudioEngineError {
    return new AudioEngineError(AudioEngineErrorCode.REGION_NOT_FOUND, ERROR_MESSAGES.REGION_NOT_FOUND, {
      trackId: request.trackId,
      regionId: request.regionId,
    });
  }

  private cloneRegionData(regionData: RegionData): RegionData {
    return { ...regionData };
  }

  private cleanupRegionEntries(entries: RegionPlayerEntry[]): void {
    entries.forEach(entry => {
      try {
        this.disposePlayer(entry.player);
      } catch (error) {
        console.error('[AudioEngine] Failed to clean up a Region Player', error);
      }
    });
  }

  private disposePlayer(player: Tone.Player): void {
    player.unsync();
    player.stop();
    player.disconnect();
    player.dispose();
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private async scheduleExport(request: ExportRequest): Promise<void> {
    const scheduledPlayers: Array<{ player: Tone.Player; params: RegionRenderParams }> = [];

    for (const track of this.getAudibleTracks(request.tracks)) {
      const channel = new Tone.Channel({
        volume: Tone.gainToDb(track.volume * request.masterVolume),
        pan: track.pan,
      }).toDestination();

      for (const region of track.regions) {
        const params = RegionRenderer.adjustForExportRange(RegionRenderer.calculateRenderParams(region), request.range);
        if (params.duration <= 0) {
          continue;
        }

        scheduledPlayers.push({ player: new Tone.Player({ loop: false }).connect(channel), params });
      }
    }

    await Promise.all(scheduledPlayers.map(({ player, params }) => player.load(params.url)));
    scheduledPlayers.forEach(({ player, params }) => {
      startPlayer({ player, syncMode: false, ...params });
    });
  }

  private getAudibleTracks(tracks: ExportTrack[]): ExportTrack[] {
    const hasSoloTrack = tracks.some(track => track.isSoloed);
    return tracks.filter(track => !track.isMuted && (!hasSoloTrack || track.isSoloed));
  }
}
