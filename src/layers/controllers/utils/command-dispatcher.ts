import { AppController } from '../app-controller';
import { type SessionState } from '@/layers/session';
import { AudioCommandType, type AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import { downloadBlob } from '@/layers/apps/web/components/Daw/components/ExportButton/utils/audioExport';

/**
 * Get the first track ID from SessionState
 */
const getFirstTrackId = (session: SessionState): string => {
  const tracks = Array.from(session.tracks.values());
  if (tracks.length === 0) {
    throw new Error('No tracks available. Please add an audio file first.');
  }
  return tracks[0].id;
};

/**
 * Get the first region ID from the first track
 */
const getFirstRegionId = (session: SessionState, trackId: string): string => {
  const track = session.tracks.get(trackId);
  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }
  if (track.regions.length === 0) {
    throw new Error(`No regions available in track ${trackId}. Please add a region first.`);
  }
  return track.regions[0].id;
};

/**
 * Get the URL from the first region of the first track
 */
const getFirstRegionUrl = (session: SessionState, trackId: string): string => {
  const track = session.tracks.get(trackId);
  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }
  if (track.regions.length === 0) {
    throw new Error(`No regions available in track ${trackId}. Please add a region with URL first.`);
  }
  const firstRegion = track.regions[0];
  const url = firstRegion.audioFileUrl; // Changed from audioFile?.url to audioFileUrl based on SessionState
  if (!url) {
    throw new Error(`No URL available in the first region. Please add a region with URL first.`);
  }
  return url;
};

export async function executeAudioCommand(
  controller: AppController,
  session: SessionState,
  command: AudioCommand
): Promise<void> {
  console.log('[CommandDispatcher] Executing:', command);

  switch (command.type) {
    case AudioCommandType.PLAY:
      await controller.playback.handlePlay();
      break;

    case AudioCommandType.PAUSE:
      controller.playback.handlePause();
      break;

    case AudioCommandType.STOP:
      controller.playback.handleStop();
      break;

    case AudioCommandType.SET_CURRENT_TIME:
      controller.playback.handleSeek(command.time);
      break;

    case AudioCommandType.SET_TRACK_VOLUME: {
      const trackId = command.trackId ?? getFirstTrackId(session);
      controller.track.setVolume(trackId, command.volume);
      break;
    }

    case AudioCommandType.SET_TRACK_PAN: {
      const trackId = command.trackId ?? getFirstTrackId(session);
      controller.track.setPan(trackId, command.pan);
      break;
    }

    case AudioCommandType.LOAD_REGION: {
      const trackId = command.trackId ?? getFirstTrackId(session);
      const url = command.url ?? getFirstRegionUrl(session, trackId);
      
      // We need RegionData structure for addRegion
      // But verify if controller.region.addRegion takes RegionData or args.
      // Based on my previous edit, it takes RegionData.
      // But command has startTime, startOffset, duration.
      
      const regionData = {
          id: command.regionId ?? crypto.randomUUID(),
          url: url,
          startTime: command.startTime,
          sourceStartTime: command.startOffset ?? 0,
          duration: command.duration,
      };
      
      await controller.region.addRegion(trackId, regionData);
      break;
    }

    case AudioCommandType.UNLOAD_REGION: {
      const trackId = command.trackId ?? getFirstTrackId(session);
      const regionId = command.regionId ?? getFirstRegionId(session, trackId);
      controller.region.removeRegion(trackId, regionId);
      break;
    }

    case AudioCommandType.SET_EXPORT_RANGE:
      // controller.export.setExportRange? Or playback?
      // Check ExportController.
      // Usually playback controller handles range or export controller.
      // Session has setExportRange action.
      // AppController should probably expose a way to set this.
      // For now, I'll assume controller.export.setExportRange exists or I need to add it.
      // Actually session store has setExportRange.
      // I can access session store update via controller? 
      // No... I should add method to ExportController or PlaybackController.
      // Let's assume ExportController has it for now, if not I will add it.
       controller.export.setExportRange(command.startTime, command.endTime);
      break;

    case AudioCommandType.CLEAR_EXPORT_RANGE:
       controller.export.setExportRange(null, null);
      break;

    case AudioCommandType.EXPORT_AUDIO: {
      const blob = await controller.export.exportProject();
      if (blob instanceof Blob) {
        const filename = command.filename || 'export';
        downloadBlob(blob, `${filename}.wav`);
      }
      break;
    }

    default:
      console.warn('[CommandDispatcher] Unknown command:', command);
  }
}
