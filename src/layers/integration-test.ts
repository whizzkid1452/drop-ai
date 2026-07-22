import { MockAudioEngine } from './audio-engine/mock-audio-engine';
import { createApp } from './apps/create-app';
import { AudioCommandType } from './shared/types/audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_URL = 'https://example.com/test.wav';

async function runIntegrationTest() {
  console.log('--- Starting Layers Integration Test ---');

  // 1. Setup with Mock Engine
  const mockEngine = new MockAudioEngine();
  const { session, commandExecutor } = createApp({ audioEngine: mockEngine });

  let notificationCount = 0;
  // Zustand vanilla store subscribe
  session.subscribe(state => {
    notificationCount++;
    console.log(
      `[Test] Session updated! Count: ${notificationCount}, isPlaying: ${state.isPlaying}, Tracks: ${state.tracks.size}`
    );
  });

  // 2. Test Playback
  console.log('\n[Test] Testing Playback Commands...');
  await commandExecutor.execute({ type: AudioCommandType.PLAY });
  if (session.getState().isPlaying !== true) {
    throw new Error('Playback failed to update session');
  }

  await commandExecutor.execute({ type: AudioCommandType.STOP });
  if (session.getState().isPlaying !== false) {
    throw new Error('Stop failed to update session');
  }

  // 3. Test Track Management
  console.log('\n[Test] Testing Track Commands...');
  await commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID, url: TRACK_URL });
  if (session.getState().tracks.size !== 1) throw new Error('Track addition failed');

  const track = session.getState().tracks.get(TRACK_ID);
  if (track?.id !== TRACK_ID) throw new Error('Track ID mismatch');

  await commandExecutor.execute({
    type: AudioCommandType.SET_TRACK_VOLUME,
    trackId: TRACK_ID,
    volume: 0.5,
  });
  if (session.getState().tracks.get(TRACK_ID)?.volume !== 0.5) throw new Error('Track volume update failed');

  await commandExecutor.execute({ type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID });
  if (session.getState().tracks.size !== 0) throw new Error('Track removal failed');

  console.log('\n--- Integration Test Passed Successfully! ---');
  console.log(`Total notifications received: ${notificationCount}`);
}

runIntegrationTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
