# Ardour 참조 기능 구현 플랜과 진행 현황

## 목적

Ardour의 주요 DAW 기능을 기준으로 `drop-ai`의 현재 구현과 미구현 범위를 구분하고, 의존 순서에 맞춘 구현 계획과 진행 체크리스트를 관리한다.

이 문서에서 **완료**는 `daw-engine`에 타입이나 클래스만 존재하는 상태가 아니다. 다음 경로가 모두 연결되고 테스트된 상태를 뜻한다.

```text
ProjectDocument → Session → AudioCommand → Controller → IAudioEngine
→ Web UI / CLI / Agent → 테스트
```

## 비교 기준

### 기준 버전

- `drop-ai`: `main`의 `79c1b02e1243630ff70e4358352015252469b251` (2026-08-13)
- Ardour 공식 소스: `master`의 `b784ad01ee3de9e594cfba9acb372b208c870b7c` (2026-08-13 조회)
- Ardour 기능 목록: [공식 매뉴얼 목차](https://manual.ardour.org/toc/), [공식 기능 페이지](https://ardour.org/features.html)
- Ardour 구조 참고: [공식 소스 저장소](https://github.com/Ardour/ardour), [개발 문서](https://ardour.org/development)

로컬 `C:\code\wk\ardour`에는 `.git/HEAD`, 루트 `wscript`, 대부분의 `libs/ardour` 소스가 없다. 따라서 이 폴더만으로 Ardour 버전이나 전체 구현을 확정할 수 없다. 공식 소스와 매뉴얼을 비교 기준으로 사용한다.

### 범위

포함한다.

- 세션, 트랙, 재생, 녹음, 편집, MIDI, Cue
- Routing, Mixer, Plugin, Automation
- Import, Export, Video, 동기화, Control Surface
- 환경설정, 단축키, 스크립팅, 성능 진단

제외한다.

- GTK 화면을 픽셀 단위로 복제하는 작업
- Ardour 빌드·패키징·번역 인프라
- 운영체제별 드라이버 구현 자체
- 외부 Plugin 전체와 Ardour 번들 Plugin의 UI를 그대로 복제하는 작업

## 라이선스 경계

Ardour는 [GNU GPL v2](https://ardour.org/copying.html)로 배포된다. 현재 `daw-engine/core`와 `daw-engine/ui-utils`는 MIT 라이선스다.

따라서 기본 계획은 다음과 같다.

- Ardour의 동작과 공개 문서를 요구사항으로 참고한다.
- Ardour 소스 코드를 현재 MIT 모듈에 직접 복사하지 않는다.
- TypeScript와 Web Audio 환경에 맞게 독립적으로 구현한다.
- Ardour 코드를 직접 사용하려면 먼저 프로젝트 배포 방식과 GPL 준수 범위를 결정한다.

정확한 라이선스 의무 범위는 법률 검토가 필요하다. 라이선스 결정 전에는 Ardour 코드의 직접 복사를 진행하지 않는다.

## 상태 기준

| 상태         | 의미                                                         |
| ------------ | ------------------------------------------------------------ |
| ✅ 완료      | 정의한 하위 범위가 제품 경로에 연결되고 테스트가 있다.       |
| 🟡 부분      | 일부 동작만 있거나 `daw-engine` 코어에만 구현되어 있다.      |
| ⬜ 미구현    | 현재 제품 경로에서 확인하지 못했다.                          |
| 🚧 결정 필요 | 브라우저 제약이나 라이선스 때문에 제품 결정이 먼저 필요하다. |

## 현재 진행 요약

아래 20개 기능군은 크기가 서로 다르다. 개수는 상태 요약이며 전체 작업량의 백분율이 아니다.

| 기능군                      | 상태      | 확인된 현재 범위                                                                  | 남은 핵심 범위                                                           |
| --------------------------- | --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 공통 변경 경로              | ✅ 완료   | Zod 검증, 단일 대기열, Web UI·CLI·Agent의 `CommandExecutor` 사용                  | 새 기능도 같은 경로로 추가                                               |
| 프로젝트 로컬·원격 저장     | ✅ 완료   | IndexedDB, OPFS, 자동 저장, Outbox, Yjs update, Supabase 미디어 복원              | 협업 권한, presence, update 압축                                         |
| 기본 Transport              | ✅ 완료   | Play, Pause, Stop, Seek                                                           | Punch, preroll, metronome, 외부 동기화                                   |
| 음악 시간과 Ruler           | 🟡 부분   | Tempo/Meter Map, BBT, Grid/Snap, Zoom, Follow Playhead, 기본 Marker, Export Range | Loop·Punch·CD·Cue·Section marker, 실제 오디오 scheduler의 Tempo Map 반영 |
| Audio Track과 기본 Mixer    | 🟡 부분   | Audio Track, Volume, Pan, Mute, Solo, Master Volume                               | MIDI/Aux/Bus/Folder/VCA, multichannel, meter, monitor, group             |
| 기본 Region 편집            | 🟡 부분   | Import, 배치, 이동, 분할, 삭제, waveform                                          | trim, slip, copy/paste, fade, crossfade, layer, playlist, stretch        |
| Live Loop와 Cue 기반        | 🟡 부분   | 정량화 녹음·재생·정지, overdub, 4개 기본 slot, 저장, MIDI pad                     | Clip library, follow action, launch option, stretch, Cue 편집            |
| 선형 Recording              | ⬜ 미구현 | Loop capture용 입력 기반만 존재                                                   | Track arm, multitrack, punch, take, latency 정렬                         |
| 고급 편집과 Playlist        | ⬜ 미구현 | `daw-engine`에 일부 모델과 command가 존재                                         | 제품 상태·runtime·UI·저장 연결                                           |
| Routing, Bus, Send, Insert  | ⬜ 미구현 | `daw-engine`에 `Route`, `SendBus`, `RoutingGraph`가 존재                          | Adapter, runtime graph, command, UI, 저장 연결                           |
| Metering, Monitor, Latency  | 🟡 부분   | Loop 입력 monitoring만 존재                                                       | peak/RMS/true peak, monitor section, latency compensation, xrun          |
| Automation                  | ⬜ 미구현 | `daw-engine`에 `AutomationList`와 mode가 존재                                     | runtime scheduling, lane UI, command, 저장                               |
| MIDI DAW                    | 🟡 부분   | Web MIDI note를 Loop slot trigger로 변환                                          | MIDI Track, record, piano roll, instrument, controller automation        |
| Plugin                      | 🟡 부분   | Manifest, Host, generic control UI, Gain·Saturation runtime                       | core 20종 DSP 연결, preset, latency, sidechain, 외부 Plugin 전략         |
| Audio Import와 Source 관리  | 🟡 부분   | MIME 검사, 브라우저 decode, OPFS 원본 보존                                        | codec 보장, sample-rate 변환, tag, copy/link, source 정리                |
| Export                      | 🟡 부분   | 44.1 kHz stereo PCM WAV, 범위, Plugin chain, Master 반영                          | format·bit depth·channel 설정, stem, loudness, dither, batch             |
| Session 작업 흐름           | 🟡 부분   | 문서 v1~v6 migration, 자동 저장, 원격 복원                                        | named snapshot, 지속 Undo, template, metadata, archive, cleanup          |
| Video                       | ⬜ 미구현 | `daw-engine`에 일부 Video 타입만 존재                                             | import, thumbnail, monitor, frame lock, mux/export                       |
| 외부 동기화·Control Surface | ⬜ 미구현 | 고정 MIDI pad mapping만 존재                                                      | MTC/LTC/MIDI Clock, MIDI learn, OSC, WebSocket, native surface bridge    |
| 환경설정·단축키·스크립팅    | 🟡 부분   | 고정 단축키, JSON CLI, Agent command                                              | 사용자 key binding, preference 저장, 권한이 있는 scripting API           |

요약: 완료 3개, 부분 11개, 미구현 6개다. 이 분류는 기능군 수 기준이며 작업량 가중치는 적용하지 않았다.

## 가장 큰 구조적 차이

`daw-engine` 코어에는 Ardour를 참고한 도메인 타입이 많이 있다. 그러나 `drop-ai`의 `DawEngineAdapter`는 다음 기능을 제품 runtime에 연결하지 않는다.

### 명시적으로 지원하지 않는 Adapter 기능

- Track·Master meter
- 선형 Recording
- Core Export와 Region buffer render
- Region audition, strip silence, normalize, reverse
- MIDI Track, MIDI Region, MIDI instrument

### 현재 no-op인 Adapter 기능

- 일반 IO connect/disconnect
- Processor 제거와 Automation
- Track monitor, solo isolate/safe, monitor mode
- Punch, metronome, tempo 전달
- Master processor와 master IO
- Send Bus 전체
- Loop range, MIDI panic

근거: [`daw-engine-adapter.ts`](../src/layers/audio-engine/daw-engine-adapter.ts), [`AudioProvider.ts`](../daw-engine/core/src/audio/AudioProvider.ts)

따라서 코어 클래스의 존재만으로 제품 기능을 완료 처리하지 않는다. Silent no-op은 기능 지원으로 표시하지 않는다.

## 구현 원칙

1. 모든 변경은 `AudioCommand → Controller → Session / IAudioEngine` 경로를 사용한다.
2. 조회는 Query 계약으로 분리한다.
3. ProjectDocument에 저장되지 않는 편집 기능은 완료로 보지 않는다.
4. runtime이 지원하지 않는 기능은 capability로 명시하고 UI에서 비활성화한다.
5. `noOperation`으로 성공처럼 보이게 하지 않는다.
6. Undo·Redo, 자동 저장, CRDT, 원격 복원까지 함께 검증한다.
7. 각 PR은 한 가지 목적만 가진다.
8. 큰 기능은 `기반 타입 → runtime → 소비자 연결 → 정리` 순서의 stacked PR로 나눈다.
9. 브라우저에서 직접 지원할 수 없는 네이티브 기능은 별도 bridge로 분리한다.

## 단계별 구현 계획

체크 항목 수는 진행 추적용이다. 항목별 난이도는 같지 않다.

| 단계 | 목적                           | 현재 체크 |
| ---- | ------------------------------ | --------: |
| 0    | 기준·라이선스 확정             |       2/4 |
| 1    | Capability와 Adapter 계약 정리 |       1/5 |
| 2    | 시간축·Transport·Audio backend |       4/9 |
| 3    | Track·Routing·Mixer            |      2/12 |
| 4    | 선형 Recording                 |      2/11 |
| 5    | Editor·Region·Playlist         |      2/14 |
| 6    | Automation                     |       0/8 |
| 7    | MIDI                           |      1/11 |
| 8    | Plugin                         |      3/11 |
| 9    | Media·Import·Export            |      3/11 |
| 10   | Session 수명주기               |      4/10 |
| 11   | Clip·Cue                       |       4/9 |
| 12   | Video                          |       0/6 |
| 13   | 외부 제어·환경설정·스크립팅    |       2/9 |
| 14   | 검증·성능·복구                 |       2/8 |
| 합계 | 동일 가중 체크 항목            |    32/138 |

### 0. 기준과 라이선스 확정

- [x] `drop-ai`와 Ardour 기준 commit을 고정했다.
- [x] 현재 구현과 Adapter 미연결 기능을 분리했다.
- [ ] 동작 재구현을 유지할지, GPL 파생 작업을 허용할지 결정한다.
- [ ] 결정에 맞춰 루트 LICENSE, NOTICE, 배포 소스 제공 절차를 확정한다.

완료 조건: 구현자가 복사 가능한 자료와 복사하면 안 되는 자료를 구분할 수 있다.

### 1. Capability와 Adapter 계약 정리

- [x] `DawEngineAdapter`를 Composition Root에 연결했다.
- [ ] `AudioRuntimeCapabilities`에 recording, routing, meter, MIDI, video, native plugin 지원 여부를 추가한다.
- [ ] Adapter의 `unsupported`와 `noOperation`을 capability 또는 명시적 오류로 바꾼다.
- [ ] Web UI·CLI·Agent가 지원하지 않는 명령을 실행 전에 거부한다.
- [ ] 모든 `AudioProvider` 메서드에 contract test를 추가한다.

완료 조건: 지원하지 않는 기능이 성공처럼 반환되지 않는다.

### 2. 시간축, Transport, Audio backend

- [x] Play, Pause, Stop, Seek를 제공한다.
- [x] Tempo Map과 Meter Map을 저장하고 편집한다.
- [x] BBT ruler, grid, snap, zoom focus, follow playhead를 제공한다.
- [x] 기본 location marker와 Export Range를 저장하고 편집한다.
- [ ] Tempo Map을 AudioEngine scheduler와 Loop runtime에 반영한다.
- [ ] Loop Range와 Punch Range의 상태·명령·ruler를 추가한다.
- [ ] Metronome, count-in, preroll을 추가한다.
- [ ] 입력·출력 장치, sample rate, buffer size 설정을 추가한다.
- [ ] 입력·Plugin·출력 latency 측정, compensation, xrun 기록을 추가한다.

완료 조건: Tempo 변경 구간과 Punch 구간에서 재생·녹음 위치가 sample/frame 허용 오차 안에서 일치한다.

### 3. Track, Routing, Mixer

- [x] Audio Track의 Volume, Pan, Mute, Solo를 제공한다.
- [x] Master Volume과 직렬 Plugin chain을 제공한다.
- [ ] Audio, MIDI, Aux, Bus, Folder, VCA Track을 구분한다.
- [ ] Track 순서, 색, 높이, channel layout을 저장한다.
- [ ] Mono, stereo, multichannel Route graph를 구현한다.
- [ ] Bus와 subgroup routing을 구현한다.
- [ ] Pre/Post-fader Send와 Return을 구현한다.
- [ ] External Insert, Plugin sidechain, pin routing을 구현한다.
- [ ] Track·Bus·Master peak/RMS/true-peak meter를 구현한다.
- [ ] Monitor·Foldback section과 dim, cut, mono를 구현한다.
- [ ] AFL/PFL/SIP, solo isolate/safe, polarity, stereo width와 multichannel panner를 구현한다.
- [ ] Track Group, VCA, Mixer Scene, strip template을 구현한다.

완료 조건: 임의 routing graph가 저장·복원되고 feedback cycle은 실행 전에 거부된다.

### 4. 선형 Recording

- [x] 사용자 입력 장치 선택과 PCM capture 기반이 있다.
- [x] 정량화 Loop 녹음과 비파괴 overdub가 있다.
- [ ] Global record와 Track arm 상태를 추가한다.
- [ ] Timeline에 연속 Audio Region을 기록한다.
- [ ] Punch In/Out과 punch preroll을 구현한다.
- [ ] Count-in과 metronome을 녹음 흐름에 연결한다.
- [ ] Input, disk, auto monitoring과 wet record point를 구분한다.
- [ ] 여러 Track의 동시 녹음을 구현한다.
- [ ] Take, Playlist, layered/non-layered record mode를 구현한다.
- [ ] Stop-and-Forget, 중단 복구, 미완료 Source 정리를 구현한다.
- [ ] 입력 latency를 측정해 기록 Region 시작 위치를 보정한다.

완료 조건: 30분 multitrack 녹음, punch, 중단 복구 후 Source와 ProjectDocument가 일치한다.

### 5. Editor, Region, Playlist

- [x] Audio import, Region 배치·이동·분할·삭제가 있다.
- [x] Waveform, 가로 scroll, zoom, playhead 표시가 있다.
- [ ] Track·Region·Range selection과 edit point 모델을 추가한다.
- [ ] Cut, copy, paste, duplicate, nudge, align을 추가한다.
- [ ] Trim, resize, slip, push/pull, ripple, insert/remove time을 추가한다.
- [ ] Fade, crossfade, Region gain, gain envelope를 추가한다.
- [ ] Overlap의 opaque/transparent, layer 순서와 stacked lane 표시를 추가한다.
- [ ] Playlist, Take, comp workflow를 추가한다.
- [ ] Region Group과 Section 단위 편집을 추가한다.
- [ ] Reverse, normalize, strip silence를 runtime과 연결한다.
- [ ] Time stretch와 pitch shift를 추가한다.
- [ ] Transient 분석과 Rhythm Ferret 동작을 추가한다.
- [ ] Bounce, consolidate, freeze와 thaw를 추가한다.
- [ ] Source·Region list, tag, audition을 추가한다.

완료 조건: 모든 편집이 원본 Source를 변경하지 않고 Undo·Redo와 저장·복원을 지원한다.

### 6. Automation

- [ ] Track, Pan, Send, Plugin Parameter Automation을 ProjectDocument에 저장한다.
- [ ] AudioWorklet 또는 AudioParam timeline에 sample-accurate event를 예약한다.
- [ ] Lane, point, curve, interpolation UI를 구현한다.
- [ ] Manual, Read, Write, Touch, Latch mode를 구현한다.
- [ ] Touch 시작·종료와 write pass를 하나의 기록 단위로 관리한다.
- [ ] Copy, paste, range erase, thinning을 구현한다.
- [ ] Region에 귀속된 Automation과 Track Automation을 구분한다.
- [ ] Web UI·CLI·Agent·Undo·Redo·CRDT 경로를 연결한다.

완료 조건: offline render와 realtime playback이 같은 automation 결과를 만든다.

### 7. MIDI

- [x] Web MIDI note를 Loop slot trigger로 사용할 수 있다.
- [ ] MIDI Track, port, channel, Route 상태를 저장한다.
- [ ] Standard MIDI File import/export를 연결한다.
- [ ] MIDI Region scheduler와 instrument Plugin을 연결한다.
- [ ] Realtime record, overdub, loop, punch를 구현한다.
- [ ] Piano roll과 다중 Region 편집을 구현한다.
- [ ] Note, chord, velocity의 추가·이동·분할·복사·삭제를 구현한다.
- [ ] Quantize와 transpose를 구현한다.
- [ ] CC, pitch bend, aftertouch Automation을 구현한다.
- [ ] Program change와 MIDNAM 표시를 구현한다.
- [ ] Step entry, virtual keyboard, list editor, tracer, panic을 구현한다.

완료 조건: MIDI import → 편집 → instrument 재생 → export round trip에서 note와 timing이 보존된다.

### 8. Plugin

- [x] Manifest, Host, 검증, generic Parameter UI가 있다.
- [x] Gain과 Saturation DSP runtime이 있다.
- [x] 설치, 제거, 순서 변경, bypass, Parameter 변경이 저장된다.
- [ ] `daw-engine`의 20개 built-in descriptor를 실제 DSP에 연결하거나 metadata-only임을 명시한다.
- [ ] Factory/User preset과 Plugin state blob을 저장한다.
- [ ] Plugin Parameter Automation을 연결한다.
- [ ] Sidechain, pin mapping, reported latency compensation을 연결한다.
- [ ] Plugin manager의 검색, category, favorite, rescan, quarantine를 구현한다.
- [ ] Instrument Plugin 계약을 추가한다.
- [ ] VST3, Audio Unit, LV2를 위한 실행 전략을 결정한다.
- [ ] Plugin crash 격리와 project restore 실패 처리를 추가한다.

브라우저는 VST3, Audio Unit, LV2의 네이티브 ABI를 직접 실행하지 못한다. 다음 중 하나를 선택해야 한다.

1. 브라우저 전용 Web Audio/WASM Plugin만 지원한다.
2. Desktop companion이 네이티브 Plugin을 실행하고 브라우저와 IPC로 연결한다.
3. 서버에서 offline render만 제공한다.

완료 조건: 지원 format, 격리 방식, latency, state restore 실패 동작이 명시되고 테스트된다.

### 9. Media, Import, Export

- [x] MP3, WAV, Ogg, WebM, AAC, FLAC MIME을 입력 후보로 받는다.
- [x] 원본 Blob을 content hash 기반 OPFS 저장소에 보존한다.
- [x] Plugin chain과 Master를 반영한 44.1 kHz stereo PCM WAV export가 있다.
- [ ] 브라우저별 실제 codec 지원을 탐지하고 오류를 구분한다.
- [ ] Sample-rate conversion, copy/link, tag, Source cleanup을 구현한다.
- [ ] BWF metadata 읽기·쓰기를 연결한다.
- [ ] Sample rate, bit depth, channel layout, dither 설정을 추가한다.
- [ ] AIFF, CAF, BWF, FLAC, Ogg/Vorbis, MP3 export를 추가한다.
- [ ] 다중 range, batch, 다중 format, stem export를 추가한다.
- [ ] Peak, true peak, LUFS, loudness range, normalization 분석을 추가한다.
- [ ] CUE/TOC, video mux, 외부 DAW용 stem interchange를 추가한다.

완료 조건: 같은 ProjectDocument의 반복 export가 설정별로 재현 가능하고 clip·loudness 결과가 검증된다.

### 10. Session 수명주기

- [x] ProjectDocument v1~v6 migration이 있다.
- [x] IndexedDB 자동 저장과 Outbox가 있다.
- [x] Yjs update와 원격 미디어를 병합·복원한다.
- [x] 새 runtime graph를 준비한 뒤 원자적으로 교체한다.
- [ ] Named Snapshot과 Snapshot 목록을 추가한다.
- [ ] Undo history를 저장하고 재시작 뒤 복원한다.
- [ ] Session·Track·Mixer Strip template을 추가한다.
- [ ] Session metadata, backup, crash recovery를 추가한다.
- [ ] 미사용 Source cleanup, archive, 공유 package를 추가한다.
- [ ] Collaborator 권한, presence, update log 압축을 추가한다.

완료 조건: migration, snapshot, remote merge, media 복원 중 하나가 실패해도 기존 session을 사용할 수 있다.

### 11. Clip과 Cue

- [x] Track마다 4개 기본 Loop slot을 만든다.
- [x] 정량화 launch·stop을 제공한다.
- [x] 비파괴 overdub layer를 제공한다.
- [x] 저장·복원과 Web UI·CLI·Agent·MIDI pad를 연결했다.
- [ ] Local Clip library와 검색을 추가한다.
- [ ] Clip gain, start/end, launch mode, quantization을 slot별로 저장한다.
- [ ] Follow Action을 추가한다.
- [ ] Tempo 변경에 맞춘 stretch option을 추가한다.
- [ ] Cue grid 녹음·편집과 linear arrangement 변환을 추가한다.

완료 조건: Cue 실행을 arrangement로 기록하고 저장·복원해 같은 순서와 timing으로 재생한다.

### 12. Video

- [ ] Video metadata와 frame rate를 ProjectDocument에 저장한다.
- [ ] Video import와 soundtrack 추출을 추가한다.
- [ ] Thumbnail timeline과 별도 monitor를 추가한다.
- [ ] Region을 video frame timebase에 고정한다.
- [ ] Transcode, trim, blank frame, mux export를 추가한다.
- [ ] 외부 decoder와 monitor 실패 시 자원 정리와 복구를 구현한다.

완료 조건: 지원 frame rate마다 seek와 audio/video sync 오차를 측정해 허용 범위 안임을 검증한다.

### 13. 외부 제어, 환경설정, 스크립팅

- [x] 고정 keyboard shortcut이 있다.
- [x] JSON CLI와 Agent가 공통 command를 사용한다.
- [ ] 사용자가 key binding을 변경·저장할 수 있게 한다.
- [ ] Audio, editor, mixer preference 저장소를 추가한다.
- [ ] Generic MIDI learn과 parameter mapping을 추가한다.
- [ ] OSC와 WebSocket control surface를 추가한다.
- [ ] Mackie, Push 등 네이티브 장치는 companion bridge 범위를 결정한다.
- [ ] MTC, LTC, MIDI Clock transport master를 추가한다.
- [ ] 권한·timeout·취소를 가진 scripting API를 추가한다.

완료 조건: 외부 입력도 UI와 같은 command·validation·undo 정책을 사용한다.

### 14. 검증, 성능, 복구

- [x] Unit, component, architecture boundary test가 있다.
- [x] Cross-Origin Isolation과 WebAssembly CSP 검사가 있다.
- [ ] 실제 브라우저에서 재생·녹음·장치 권한 E2E를 추가한다.
- [ ] Offline render golden file과 허용 오차 비교를 추가한다.
- [ ] 모든 ProjectDocument version의 migration matrix를 유지한다.
- [ ] DSP load, memory, xrun, waveform cache 지표와 budget을 추가한다.
- [ ] 장시간 녹음, 탭 suspend, storage quota, cleanup 실패를 검증한다.
- [ ] Keyboard-only, screen reader, Chromium·Firefox·Safari 호환성을 검증한다.

완료 조건: 기능별 regression test와 성능 budget이 PR merge 조건에 포함된다.

## PR 분리 규칙

각 단계는 다음 stacked PR 순서를 사용한다.

1. `refactor/<domain>-foundation`: 타입, interface, ProjectDocument 새 version, migration, 실패하는 test
2. `refactor/<domain>-runtime`: `daw-engine`과 `IAudioEngine` runtime 구현
3. `feature/<domain>-commands`: AudioCommand, Controller, Undo·Redo, 자동 저장
4. `feature/<domain>-ui`: Web UI, CLI, Agent 연결
5. `refactor/<domain>-cleanup`: legacy 제거와 전체 검증. 실제 정리가 있을 때만 만든다.

뒤 PR의 base는 앞 PR branch로 설정한다. 각 PR은 독립적으로 build와 test가 통과해야 한다.

## 기능별 완료 기준

모든 새 기능은 아래 항목을 충족해야 완료로 표시한다.

- [ ] 실패하는 test를 먼저 작성했다.
- [ ] Domain type과 불변 조건이 명확하다.
- [ ] ProjectDocument version과 migration이 있다.
- [ ] AudioCommand schema가 엄격하게 입력을 검증한다.
- [ ] Controller가 Session과 runtime 변경 순서를 관리한다.
- [ ] `IAudioEngine` 구현과 capability가 일치한다.
- [ ] Web UI·CLI·Agent 중 적용 가능한 진입점을 연결했다.
- [ ] Undo·Redo 범위를 명시하고 검증했다.
- [ ] 자동 저장, CRDT, 원격 복원 결과를 검증했다.
- [ ] 실패 시 보상, 자원 정리, 사용자 오류 메시지가 있다.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`가 통과한다.

## 우선 구현 순서

다음 순서는 기능 의존성을 기준으로 한다.

```text
라이선스·Capability
→ 시간축·Audio backend
→ Routing·Mixer
→ 선형 Recording
→ Editor·Playlist
→ Automation
→ MIDI·Plugin
→ Import·Export·Session
→ Clip·Cue
→ Video·외부 제어
→ 성능·복구 검증
```

첫 구현 대상은 **1단계 Capability와 Adapter 계약 정리**다. 현재 silent no-op을 먼저 제거해야 이후 기능의 완료 여부를 테스트로 판정할 수 있다.

## 일정 추정 전 필요한 정보

현재 근거만으로 완료 날짜를 계산할 수 없다. 다음 정보가 있어야 일정 추정이 가능하다.

- 브라우저 전용인지 Desktop companion을 포함하는지
- GPL 코드 직접 사용 여부
- 지원할 운영체제와 브라우저
- Native Plugin 지원 범위
- Audio E2E 장비와 테스트 인력
- 단계별 우선순위와 팀 velocity

Ardour 공식 개발 문서는 전체 코드베이스를 약 100만 줄, UI를 약 21만 줄, backend를 약 16만 줄로 설명한다. 따라서 전체 기능 대응은 한 PR이나 단일 milestone로 처리하지 않는다.
