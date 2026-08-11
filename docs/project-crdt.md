# Yjs 프로젝트 문서 병합 기반 사용하기

## Goal

프로젝트 변경을 Yjs update로 표현하고, 서로 다른 순서로 update를 적용해도 같은 문서로 수렴하는 기반을 검증합니다.

## Prerequisites

- Node.js 26 이상
- `yjs` 13.6 이상
- `202608060003_create_project_crdt_updates.sql`이 적용된 Supabase 프로젝트

## Step-by-Step Guide

### 1. 초기 CRDT 문서 만들기

```ts
const projectCrdt = ProjectCrdtDocument.create(projectDocument);
const initialUpdate = projectCrdt.encodeStateAsUpdate();
```

새 peer는 `ProjectCrdtDocument.fromUpdate(initialUpdate)`로 같은 CRDT 식별자와 이력을 공유해야 합니다. 같은 JSON을 각 peer가 독립적으로 초기화하면 동일한 CRDT 이력을 공유하는 것이 아닙니다.

### 2. 로컬 변경을 update로 만들기

```ts
const update = projectCrdt.applyProjectChange({
  baseDocument,
  nextDocument,
  origin: operationId,
});
```

구현은 `baseDocument`와 `nextDocument`의 차이만 Yjs shared type에 기록합니다. Track, Region, Plugin instance처럼 ID가 있는 배열은 ID별 `Y.Map`으로 저장해 서로 다른 entity와 속성의 동시 변경을 보존합니다.

실제 로컬 저장소는 전체 CRDT state를 프로젝트 문서 record에 함께 보관합니다. 새 Outbox 항목에는 직전 state 이후의 update만 넣습니다. 기존 JSON record를 처음 전환할 때는 서버가 독립적으로 복원할 수 있도록 seed와 현재 변경을 합친 전체 state를 넣습니다.

### 3. update 교환하기

```ts
projectCrdt.applyUpdate(remoteUpdate, 'remote');
const mergedDocument = projectCrdt.toProjectDocument();
```

Yjs update는 적용 순서와 중복 여부에 관계없이 수렴합니다. 서버의 `project_crdt_updates`는 update를 해석하지 않고 append-only로 보관합니다.

### 4. 원격 update를 로컬 저장소에 반영하기

`ProjectSyncCoordinator`는 프로젝트별 마지막 `sequence_id` 이후 update를 100개씩 조회합니다. 조회한 update는 현재 Yjs state에
병합하고, 다음 값을 IndexedDB의 같은 transaction에서 저장합니다.

- 병합된 ProjectDocument
- 누적 Yjs state
- 마지막으로 반영한 `sequence_id`

이미 저장한 sequence는 다시 적용하지 않습니다. 로컬 Yjs state가 없는 이전 JSON record는 서버의 첫 update를 기준 이력으로
사용합니다. 같은 JSON을 로컬에서 다시 초기화하면 서버와 같은 CRDT 이력이 되지 않기 때문입니다.

### Verify Final Result

```bash
pnpm test -- src/layers/project-crdt
pnpm typecheck
```

## 현재 경계

- 같은 scalar 속성을 동시에 바꾸면 Yjs의 일관된 단일 값으로 수렴하며 두 값을 함께 보존하지는 않습니다.
- keyed collection 순서를 동시에 바꾸면 모든 peer가 같은 순서로 수렴하지만, 두 사용자의 순서 의도를 모두 보존하는 것은 아닙니다.
- 기존 JSON Outbox record는 누락 없이 전송하기 위해 기존 snapshot RPC를 계속 사용합니다. 새 commit부터 CRDT append RPC를 사용합니다.
- 원격 update를 저장한 뒤 누락된 미디어를 검증·다운로드하고 활성 Session과 AudioEngine을 교체합니다.
- Runtime 준비 중 로컬 Session이 바뀌면 원격 적용을 보류하고 저장된 cursor의 문서를 지수 백오프로 다시 적용합니다.
- 원격 프로젝트 목록 조회는 아직 구현하지 않았습니다.
- project collaborator 권한, 실시간 presence, update log 압축은 아직 구현하지 않았습니다.
