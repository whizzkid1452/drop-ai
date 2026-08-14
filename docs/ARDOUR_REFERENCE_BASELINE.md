# Ardour 참조 기준선

## 목적

Ardour의 동작을 참고해 `drop-ai`의 브라우저 DAW 기능을 구현할 때 사용할 소스 버전과 현재 연결 상태를 고정한다.
Ardour 코드는 복사하지 않고 사용자 동작, 상태 전이, 오류 조건만 독립적으로 재구현한다.

## 기준 버전

- `drop-ai`: `79c1b02` (`main`, 2026-08-13 확인)
- Ardour: `b168ce622c07ec7d63b4fb12f4f5e4782ea09411`
- Ardour 복구 경로: `C:\code\wk\ardour-reference-b168ce6`

기존 `C:\code\wk\ardour`는 핵심 소스와 Git 객체가 없는 불완전한 복사본이므로 변경하지 않는다.
복구본은 6,434개 파일을 포함하며 다음 핵심 파일의 존재를 확인했다.

- `gtk2_ardour/editor.cc`, `gtk2_ardour/mixer_ui.cc`
- `libs/ardour/session.cc`, `route.cc`, `playlist.cc`
- `libs/ardour/automation_list.cc`, `midi_region.cc`, `export_graph_builder.cc`

## 상태 판정 기준

| 상태           | 판정 조건                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------ |
| 완료           | ProjectDocument, Session, AudioCommand, Controller, IAudioEngine, Web UI와 테스트가 연결됨 |
| 코어만 존재    | `daw-engine/core`에 타입 또는 알고리즘만 존재함                                            |
| Adapter 미연결 | 제품 경로가 `unsupported` 또는 의도 불명의 무동작 처리로 끝남                              |
| 없음           | 제품 코드와 코어에 대응 구현이 없음                                                        |

## 기능 기준선

| 기능                 | 현재 상태      | 근거                                                                                        |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| 기본 Transport       | 완료           | Play, Pause, Stop, Seek가 공통 명령 경로와 UI에 연결됨                                      |
| Tempo·Meter Map      | Adapter 미연결 | 문서와 ruler는 있으나 `AudioProvider.setTempo`가 runtime을 변경하지 않음                    |
| Loop Range·Metronome | Adapter 미연결 | 코어 API는 있으나 `enableLoop`, `setLoopRange`, `enableMetronome`이 runtime을 변경하지 않음 |
| Track·Master Meter   | Adapter 미연결 | 코어 Meter 타입은 있으나 Provider 조회가 명시적 미지원임                                    |
| 선형 녹음            | Adapter 미연결 | Loop capture 기반은 있으나 Provider 녹음 메서드는 명시적 미지원임                           |
| 기본 Region 편집     | 완료           | Import, 이동, 분할, 삭제와 waveform UI가 연결됨                                             |
| 고급 Region·Playlist | 코어만 존재    | Trim, Fade, Crossfade, Playlist, Take 타입과 명령이 제품 상태에 연결되지 않음               |
| Routing·Bus·Send     | Adapter 미연결 | 코어 Route graph가 있으나 Provider IO와 Send가 runtime을 변경하지 않음                      |
| Automation           | Adapter 미연결 | 코어 Automation 모델은 있으나 Provider scheduling과 제품 lane UI가 없음                     |
| MIDI DAW             | Adapter 미연결 | MIDI 입력은 Loop trigger에만 사용하며 Track·Region runtime은 미지원임                       |
| Plugin               | 부분 완료      | Gain·Saturation runtime과 공통 Parameter UI만 연결됨                                        |
| Source 관리          | 부분 완료      | OPFS 원본 저장은 있으나 tag, audition, 파생 Source 관리 UI가 없음                           |
| Export               | 부분 완료      | 44.1 kHz stereo PCM WAV만 제품 경로에 연결됨                                                |
| Session 수명주기     | 부분 완료      | 자동 저장·원격 복원은 있으나 Snapshot·archive·crash recovery UI가 없음                      |
| Clip·Cue             | 부분 완료      | 기본 Loop slot은 있으나 Clip library, Follow Action, arrangement 변환이 없음                |

코어 클래스의 존재는 제품 기능 완료의 근거로 사용하지 않는다. `DawEngineAdapter`의 실제 위임과 Web UI에서의 실행 가능성을
함께 확인해야 한다.

## 검증 기준선

현재 환경의 Node.js는 `24.16.0`이고 프로젝트 요구 버전은 Node.js 26 이상이다. 이 환경 차이가 있는 상태에서 다음 명령은
성공했지만, 기능 PR의 최종 검증은 Node.js 26.5.0에서 다시 실행한다.

- `pnpm test`
- `pnpm typecheck`, `pnpm typecheck:daw-engine`
- `pnpm lint`, `pnpm lint:daw-engine`
- `pnpm build`, `pnpm build:daw-engine`

현재 lint는 오류 없이 기존 warning 26개를 보고한다. 신규 PR은 warning 수를 늘리지 않는다.
