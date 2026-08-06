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

### 3. update 교환하기

```ts
projectCrdt.applyUpdate(remoteUpdate, 'remote');
const mergedDocument = projectCrdt.toProjectDocument();
```

Yjs update는 적용 순서와 중복 여부에 관계없이 수렴합니다. 서버의 `project_crdt_updates`는 update를 해석하지 않고 append-only로 보관합니다.

### Verify Final Result

```bash
pnpm test -- src/layers/project-crdt
pnpm typecheck
```

## 현재 경계

- 같은 scalar 속성을 동시에 바꾸면 Yjs의 일관된 단일 값으로 수렴하며 두 값을 함께 보존하지는 않습니다.
- 기존 entity의 배열 순서 변경은 아직 지원하지 않습니다.
- update log 압축과 기존 JSON Outbox 소비자 전환은 후속 PR 범위입니다.
