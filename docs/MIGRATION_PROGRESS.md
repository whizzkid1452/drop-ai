# Web DAW 마이그레이션 진행 현황

## 목표

브라우저에서 동작하는 DAW를 만들되, 모든 변경 진입점이 같은 규칙을 사용하도록 유지한다.

```text
Web UI / CLI / Agent
        ↓
CommandExecutor
        ↓
Controller
        ↓
Session / IAudioEngine
```

구체 객체는 Composition Root에서만 생성하고, 상위 계층은 `IAudioEngine` 같은 인터페이스에 의존한다.

## 현재 기준

- 확인 날짜: 2026-07-23
- 브랜치: `main`
- 병합 범위: `f48e919..e09eaea`
- 병합된 커밋: 82개
- 변경 파일: 222개
- 원격 반영: 아직 Push하지 않음

이 문서는 위 병합 범위와 `main` 전체 검증 결과를 기준으로 작성했다.

상태 표시는 다음 의미로 사용한다.

- ✅: 현재 코드와 테스트에서 완료를 확인함
- 🟡: 기본 경로는 있으나 명시된 제약이 남아 있음
- ⬜: 현재 공통 Command 계약에서 완료를 확인하지 못함

## 완료된 내용

| 영역                | 상태 | 현재 결과                                                               |
| ------------------- | ---- | ----------------------------------------------------------------------- |
| 공통 명령 경로      | ✅   | Web UI, 내부 CLI, Agent가 `CommandExecutor`를 사용한다.                 |
| 명령 검증           | ✅   | Zod의 엄격한 스키마로 명령 종류와 입력 범위를 검증한다.                 |
| 명령 실행 순서      | ✅   | 단건·묶음 명령을 같은 대기열에서 입력 순서대로 실행한다.                |
| Track               | ✅   | 추가, 삭제, 이름, 볼륨, Pan, Mute, Solo를 지원한다.                     |
| Region              | ✅   | Source 연결, 추가, 삭제, 이동, 분할을 지원한다.                         |
| 재생                | ✅   | 재생, 일시정지, 정지, 재생 위치 변경을 지원한다.                        |
| 프로젝트 메타데이터 | ✅   | Tempo와 Master Volume을 변경하고 저장한다.                              |
| Undo·Redo           | 🟡   | 주요 편집을 지원한다. Track 삭제와 Region 분할은 아래 제약이 있다.      |
| 프로젝트 저장       | ✅   | 버전이 있는 프로젝트 문서와 IndexedDB 저장소를 사용한다.                |
| 프로젝트 불러오기   | ✅   | 오디오 Source, Plugin chain, Master Volume을 준비한 뒤 상태를 교체한다. |
| 오디오 Source 저장  | ✅   | OPFS에 원본 오디오를 저장하고 `sourceId`로 참조한다.                    |
| Plugin 규격         | ✅   | Manifest, SDK 계약, Host registry, 호환성 검증을 제공한다.              |
| Plugin 처리         | ✅   | Gain과 Saturation을 직렬 chain으로 처리한다.                            |
| Plugin 제어         | ✅   | 설치, 제거, 순서 변경, 활성화, Parameter 변경을 지원한다.               |
| 오프라인 Export     | ✅   | 활성 Plugin chain과 Master Volume을 반영해 WAV를 만든다.                |
| Web UI              | ✅   | 가져오기, 저장, 불러오기, Undo·Redo, Track·Plugin 제어를 연결했다.      |
| WebLLM 사전 로딩    | ✅   | 앱 시작 시 모델 초기화를 시작하고 동시 요청은 같은 Promise를 사용한다.  |
| 배포 전제조건       | ✅   | 브라우저 오디오 기능, 격리 헤더, WebAssembly CSP를 검사한다.            |

## Tone.js 사용 범위

Tone.js를 제외한 설계가 아니다. 현재 `tone` 15.1.22를 사용한다.

- Gain Plugin은 Tone.js `Gain`으로 처리한다.
- Saturation Plugin은 Tone.js `Distortion`으로 처리한다.
- Track chain과 Master Volume도 브라우저 오디오 그래프에 연결된다.
- Controller는 Tone.js 구체 객체를 직접 참조하지 않고 `IAudioEngine`에 의존한다.

이 구조는 Tone.js를 오디오 구현에 사용하면서도 Command, Controller, Session 테스트를 구체 라이브러리와 분리한다.

## 주요 완료 커밋

| 커밋      | 내용                             |
| --------- | -------------------------------- |
| `07e7ad4` | 프로젝트 변경 명령 계약 추가     |
| `4a136ef` | 명령 실행 순서 일원화            |
| `e936ea0` | 프로젝트 저장 경로 연결          |
| `31f842d` | 프로젝트 불러오기 경로 연결      |
| `8cb1391` | 편집 Undo·Redo 추가              |
| `8888e2d` | Plugin manifest 검증 계약 추가   |
| `15e2930` | PluginHost registry 추가         |
| `a532113` | Tone.js Gain Runtime 추가        |
| `4fe9115` | Plugin 직렬 chain 연결           |
| `d9a0e12` | Plugin 상태 프로젝트 저장 활성화 |
| `a51d83d` | Plugin 활성화 상태 제어          |
| `ff599fa` | Plugin 오프라인 렌더링           |
| `b318386` | 내장 Saturation 추가             |
| `28e3b71` | Plugin 처리 순서 변경            |
| `2a2641d` | Master Volume 실시간 제어        |
| `056c565` | Track 이름 변경                  |
| `1203e41` | WebLLM 모델 사전 로딩            |
| `e09eaea` | 마이그레이션 진행 현황 문서 추가 |

전체 커밋은 다음 명령으로 확인한다.

```powershell
git log --reverse --oneline origin/main..HEAD
```

## 현재 제약

### Undo·Redo

- 기록은 앱 실행 중에만 유지한다.
- 최대 100개 편집을 보관한다.
- Track 삭제와 Region 분할은 손실 없는 복원 명령이 아직 없다.
- 이 두 변경이 성공하면 잘못된 복원을 막기 위해 기존 Undo 기록을 제거한다.

### 브라우저 기능 범위

현재 `AudioCommandType`에는 다음 기능의 공통 명령 계약이 없다.

- 실시간 녹음과 Punch In/Out
- MIDI Track과 MIDI 편집
- Bus, Aux Send, Return Routing
- Automation Lane
- Time Stretch와 Pitch Shift

따라서 이 기능은 Web UI, CLI, Agent를 같은 경로로 연결하는 작업까지 완료된 상태가 아니다.

VST와 Audio Unit은 운영체제의 네이티브 Plugin 규격이다. 현재 브라우저 Plugin Host와 직접 호환되지 않는다.

### 빌드 크기

프로덕션 빌드는 성공하지만, 일부 JavaScript chunk가 500KB를 넘는다는 경고가 있다. 기능 오류는 아니며, 초기 로딩 성능은 별도 측정이 필요하다.

## 다음 진행 순서

아래 순서는 현재 의존 관계를 기준으로 한 계획이다.

1. Bus와 Send/Return을 표현할 Routing 상태와 `IAudioEngine` 계약을 추가한다.
2. Routing 명령을 Controller, Web UI, CLI, Agent에 연결한다.
3. Plugin Parameter Automation 상태와 시간 기반 실행 경로를 추가한다.
4. MediaRecorder 또는 AudioWorklet 입력을 Source 저장소와 연결해 녹음을 추가한다.
5. MIDI 상태와 스케줄링을 Audio Track과 분리된 계약으로 추가한다.
6. 각 기능을 목적별 브랜치와 stacked PR로 분리한다.

각 기능은 다음 순서를 반복한다.

```text
테스트 작성 → Command Schema → Controller → Session / IAudioEngine
→ Web UI / CLI / Agent → 전체 검증 → 별도 커밋
```

## 검증 결과

`main` 병합 후 다음 결과를 확인했다.

- Test Files: 81개 통과
- Tests: 1,026개 통과
- ESLint: 통과
- TypeScript 빌드 검사: 통과
- 프로덕션 빌드: 통과

다시 검증하려면 다음 명령을 실행한다.

```powershell
npx --yes -p node@22.12.0 -p pnpm@9.12.2 -- pnpm test
npx --yes -p node@22.12.0 -p pnpm@9.12.2 -- pnpm lint
npx --yes -p node@22.12.0 -p pnpm@9.12.2 -- pnpm exec tsc -b --pretty false
npx --yes -p node@22.12.0 -p pnpm@9.12.2 -- pnpm build
```

## 현재 결론

기본 편집, 저장·불러오기, Plugin 처리, 오프라인 Export, Master Volume, Track 이름 변경, WebLLM 사전 로딩까지
`main`에 병합됐다.

전체 데스크톱 DAW 기능 이식은 아직 완료되지 않았다. 다음 핵심 기반은 Routing이며, 이후 Automation, Recording, MIDI 순서로 확장해야 한다.
