// Tone.js API를 앱 전체에 노출하지 않는 이유는 Tone.js가 앱의 도메인 모델이 아니라 오디오 구현체이기 때문입니다.
// 추상화 기준이 다른 tone.js API를 오디오 엔진에서 도메인 모델로 어댑팅합니다.
// 또한, agent 가 명령으로 오디오 편집을 수행해야하기때문에 도메인 명령으로 추상화하는것이 더욱 적합하다고 판단했습니다.
// 앱은 Track, Region, Master Volume 같은 개념으로 동작해야 하고, Tone.js의 Player, Channel, Transport, Destination은 그 개념을 구현하는 세부 기술입니다.
// 이를 AudioEngine 계층에 캡슐화하면 Controller와 UI는 도메인 명령만 다루고, Tone.js 변경이나 테스트 mock, export/재생 그래프 일관성 관리가 쉬워집니다.
// 반대로 Tone.js 호출이 여러 계층에 퍼지면 결합도가 높아지고 상태 동기화와 테스트가 어려워집니다.

import * as Tone from 'tone';
import type { IAudioEngine } from './i-audio-engine';
import type { RegionState } from '../session/session';
import { encodeWav } from '@/utils/wav-encoder';

interface TrackNodes {
  channel: Tone.Channel;
}

interface RegionNodes {
  player: Tone.Player;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
}

//implements:IAudioEngine 인터페이스 규약을 따른다는 선언, 메서드가 빠지면 타입 에러
export class AudioEngine implements IAudioEngine {
  //ID기반 조회/수정/삭제 >> 맵 자료구조 사용
  private tracks = new Map<string, TrackNodes>();
  private regions = new Map<string, RegionNodes>();
  private buffers = new Map<string, Tone.ToneAudioBuffer>();

  //클래스 메서드 함수 선언(function 키워드 없이 선언)
  async play(): Promise<void> {
    console.log('[AudioEngine] Play');
    //getTransport() : Tone.js의 전역 타임라인/시계객체(전역 싱글톤 객체)를 가져오는 함수
    //재생 헤드, BPM, 루프 구간을 관리하는 중심 객체
    if (Tone.getTransport().state !== 'started') {
      Tone.getTransport().start();
    }
  }

  //E2E 테스트에서 브라우저 콘솔이나 Playwright가 window.Tone으로 Tone 상태를 볼 수 있게 만든 디버그용 코드
  // Debug helper for E2E tests
  //function() {}는 메서드 축약 문법 or 객체 리터럴 안
  constructor() {
    //실행환경이 브라우저면 window 객체가 존재한다.
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Tone is extended globally for debugging
      //디버깅을 위해 Tone을 전역(window)에 노출
      //window객체에 프로퍼티 할당(Tone)
      //접근은 window.Tone 혹은 window['Tone'](대괄호 표기법, 동적 키)
      window.Tone = Tone;
    }
  }

  stop(): void {
    console.log('[AudioEngine] Stop');
    Tone.getTransport().stop();
  }

  pause(): void {
    console.log('[AudioEngine] Pause');
    Tone.getTransport().pause();
  }

  // @note 추후 master 버스 모듈 분리 필요
  //master volume 설정
  setMasterVolume(value: number): void {
    console.log(`[AudioEngine] Set Master Volume: ${value}`);
    //getDestination() : Tone.js의 마스터 출력을 가져온다
    // @이부분 꼭 변환해야하나? 입력단에서 db 단위로 입력하면되잖아
    Tone.getDestination().volume.value =
      value <= 0 ? -Infinity : 20 * Math.log10(value); //데시벨 변환식 0이하면 무음
  }

  seekTo(time: number): void {
    console.log(`[AudioEngine] Seek to: ${time}`);
    Tone.getTransport().seconds = time;
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  async loadFile(file: File): Promise<{ src: string; duration: number }> {
    const src = URL.createObjectURL(file);
    console.log(`[AudioEngine] Loading file from ${src}`);

    // Decode and cache buffer
    const buffer = new Tone.ToneAudioBuffer();
    await buffer.load(src);
    this.buffers.set(src, buffer);

    return { src, duration: buffer.duration };
  }

  createTrack(id: string): void {
    console.log(`[AudioEngine] Create Track: ${id}`);
    if (this.tracks.has(id)) {
      console.warn(`[AudioEngine] Track ${id} already exists`);
      return;
    }
    //트랙하나 = tone.channel 하나
    const channel = new Tone.Channel().toDestination();
    this.tracks.set(id, { channel });
    //객체 축약 {channel: channel} channel 프로퍼티를 가진 객체를 밸류로 tracks 맵에 추가
  }

  addRegion(trackId: string, region: RegionState): void {
    console.log(`[AudioEngine] Add Region: ${region.id} to ${trackId}`);
    const track = this.tracks.get(trackId);
    if (!track) {
      //guard clause (특히 비정상/예외 조건을 early return)
      console.error(`[AudioEngine] Track ${trackId} not found`);
      return;
    }

    const buffer = this.buffers.get(region.src);
    if (!buffer) {
      console.error(`[AudioEngine] Buffer for ${region.src} not found`);
      return;
    }

    //track.channel : 트랙의 믹서 채널
    //Tone.Player(buffer) : 오디오파일/버커를 재생하는 소스 노드
    const player = new Tone.Player(buffer).connect(track.channel);

    //constructor Player(url?: string | AudioBuffer | Tone.ToneAudioBuffer, onload?: () => void): Tone.Player (+1 overload)
    //() => void : 인자로 아무것도 받지않고, 아무것도 반환하지 않는 함수
    //(+1 overload) : 같은 함수/생성자가 여러 형태의 인자 조합을 받을 수 있다. , 다른 호출 형태가 하나 더 있다. +1

    // Sync to transport
    // start(startTime, offset, duration)
    player.sync().start(region.startTime, region.offset, region.duration);

    this.regions.set(region.id, {
      player,
      trackId,
      startTime: region.startTime,
      duration: region.duration,
      offset: region.offset,
    });
  }

  removeRegion(_trackId: string, regionId: string): void {
    console.log(`[AudioEngine] Remove Region: ${regionId}`);
    const regionNode = this.regions.get(regionId);
    if (regionNode) {
      //dispose() :  객체가 쓰던 리소스를 정리하고 수명 종료시키는 메서드 (tone.js 내장)
      regionNode.player.dispose();
      this.regions.delete(regionId);
    }
  }

  moveRegion(_trackId: string, regionId: string, newStartTime: number): void {
    console.log(`[AudioEngine] Move Region: ${regionId} to ${newStartTime}s`);
    const regionNode = this.regions.get(regionId);
    if (!regionNode) {
      console.warn(`[AudioEngine] Region ${regionId} not found`);
      return;
    }

    const { player, duration, offset } = regionNode;

    // unsync detach from transport
    player.unsync();

    // stop if playing
    player.stop();

    // reschedule with preserved offset and duration
    player.sync().start(newStartTime, offset, duration);

    // Update stored state
    regionNode.startTime = newStartTime;
  }

  setTrackVolume(id: string, volume: number): void {
    const track = this.tracks.get(id);
    if (track) {
      const db = volume <= 0 ? -Infinity : 20 * Math.log10(volume);
      track.channel.volume.value = db;
    }
  }

  setTrackMute(id: string, muted: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.mute = muted;
    }
  }

  setTrackSolo(id: string, soloed: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.solo = soloed;
    }
  }

  setTrackPan(id: string, pan: number): void {
    const track = this.tracks.get(id);
    if (track) {
      track.channel.pan.value = pan;
    }
  }

  removeTrack(id: string): void {
    console.log(`[AudioEngine] Removing track: ${id}`);
    const track = this.tracks.get(id);
    if (track) {
      track.channel.dispose();
      this.tracks.delete(id);
    }

    // Also remove all regions associated with this track
    for (const [regionId, regionNode] of this.regions) {
      if (regionNode.trackId === id) {
        this.removeRegion(id, regionId);
      }
    }
  }

  setLoop(loop: boolean): void {
    console.log(`[AudioEngine] Set Loop: ${loop}`);
    Tone.getTransport().loop = loop;
  }

  setLoopPoints(start: number, end: number): void {
    console.log(`[AudioEngine] Set Loop Points: ${start} -> ${end}`);
    Tone.getTransport().loopStart = start;
    Tone.getTransport().loopEnd = end;
  }

  setBpm(bpm: number): void {
    console.log(`[AudioEngine] Set BPM: ${bpm}`);
    Tone.getTransport().bpm.value = bpm;
  }

  getDebugInfo(): string {
    const t = Tone.getTransport();
    let info = `Transport: State=${t.state}, Loop=${t.loop}, BPM=${t.bpm.value}, Pos=${t.position}\n`;
    info += `LoopPoints: ${t.loopStart} -> ${t.loopEnd}\n`;
    info += `Tracks: ${this.tracks.size}, Regions: ${this.regions.size}, Buffers: ${this.buffers.size}\n`;

    this.regions.forEach((r, id) => {
      info += `  [${id}] Track=${r.trackId} Start=${r.player.start} Offset=${r.offset} Dur=${r.duration} State=${r.player.state}\n`;
      // Note: Tone.Player doesn't expose 'start' time property easily if synced.
      // But we stored it in 'r.duration' etc.
    });
    return info;
  }

  //현재 세션 정보를 바탕으로 오디오를 다시 구성
  async exportSession(
    duration: number,
    tracks: Map<
      string,
      {
        volume: number;
        isMuted: boolean;
        isSoloed: boolean;
        pan: number;
        regions: RegionState[];
      }
    >
  ): Promise<Blob> {
    console.log(`[AudioEngine] Exporting session: ${duration}s`);

    // Use Tone.Offline to render audio (메모리 안에서 오디오 렌더링, export용)
    const buffer = await Tone.Offline(({ transport }) => {
      // 1. Setup Transport
      transport.bpm.value = Tone.getTransport().bpm.value;

      // 2. Reconstruct Tracks & Regions in Offline Context
      //각 트랙의 trackState를 순회하면서 오프라인 렌더링용 채널을 트랙마다 새로 생성합니다.
      //그 채널을 toDestination으로 최종 출력으로 연결합니다.
      tracks.forEach((trackState, _trackId) => {
        const channel = new Tone.Channel().toDestination(); //트랙하나의
        channel.volume.value =
          trackState.volume <= 0
            ? -Infinity
            : 20 * Math.log10(trackState.volume);
        channel.mute = trackState.isMuted;
        channel.solo = trackState.isSoloed;
        channel.pan.value = trackState.pan;

        //트랙의 각 리전에 대해 this.buffer에서 region.src키로 원본 버퍼를 찾습니다.
        trackState.regions.forEach(region => {
          //this는 현재 클래스 인스턴스 자신
          //AudioEngine 객체가 가지고 있는 buffers 필드(멤버 변수)
          const originalBuffer = this.buffers.get(region.src);
          //버퍼가 있으면 tone.player를 새로 만들고 해당 트랙 채널에 연결합니다.
          if (originalBuffer) {
            const player = new Tone.Player(originalBuffer).connect(channel);
            //transport 타임라인에 동기화된 예약 재생을 걸어둡니다.
            player
              .sync()
              //startTime 에 예약재생
              .start(region.startTime, region.offset, region.duration);
          }
        });
      });

      // 3. Start Transport
      transport.start();
    }, duration);

    // 4. Encode to WAV
    // Tone.Offline returns a ToneAudioBuffer, access native AudioBuffer via .get()
    const renderedBuffer = buffer.get();
    if (!renderedBuffer) {
      //undefined 체크해서 as AudioBuffer 제거
      throw new Error('Failed to get rendered buffer');
    }
    const wavBlob = encodeWav(renderedBuffer);
    return wavBlob;
  }
}
