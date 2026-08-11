# 프로젝트 Outbox를 Supabase와 동기화하기

## Goal

로컬 편집을 먼저 저장하고, 로그인과 네트워크가 사용 가능할 때 활성 프로젝트의 Outbox를 Supabase로 전송합니다.

## Prerequisites

- Node.js 26 이상
- Supabase 프로젝트와 CLI
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Step-by-Step Guide

### 1. 서버 스키마 적용

저장소를 Supabase 프로젝트에 연결한 뒤 migration을 적용합니다.

```bash
supabase link --project-ref <project-ref>
supabase db push
```

`202608060001_create_project_sync.sql`, `202608060002_create_project_media.sql`, `202608060003_create_project_crdt_updates.sql`은 다음 서버 자원을 만듭니다.

- 사용자별 `project_documents`
- operation ID별 `project_change_receipts`
- revision 확인과 idempotency 처리를 담당하는 `apply_project_change` RPC
- 사용자별 private `project-media` Storage bucket 접근 정책
- Source ID를 SHA-256 Storage 경로에 연결하는 `project_media_refs`와 `register_project_media` RPC
- 사용자·프로젝트별 append-only `project_crdt_updates`와 idempotent `append_project_crdt_update` RPC

### 2. 브라우저 환경 변수 설정

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

로그인하지 않았거나 설정이 없으면 로컬 저장은 계속 동작하고 서버 전송만 대기합니다.

### 3. 동기화 흐름 확인

1. 프로젝트를 편집합니다.
2. IndexedDB의 `project-documents`, `project-summaries`, `project-outbox`가 같은 transaction에서 갱신되는지 확인합니다.
3. 로그인 후 참조 미디어가 `project-media/<user-id>/<sha256>` 경로에 먼저 업로드되는지 확인합니다.
4. 새 Outbox 항목이 `append_project_crdt_update` 요청으로 로컬 revision 순서대로 전송되는지 확인합니다.
5. 요청 성공 뒤 해당 operation만 `project-outbox`에서 제거되는지 확인합니다.
6. `project_crdt_updates`에서 로컬 cursor보다 큰 `sequence_id`를 오름차순으로 조회하는지 확인합니다.
7. 병합된 문서, 누적 Yjs state, 마지막 `sequence_id`가 하나의 IndexedDB transaction에서 저장되는지 확인합니다.
8. 문서가 참조하는 Source가 OPFS에 없으면 `project_media_refs`와 private Storage에서 내려받는지 확인합니다.
9. Source 크기와 SHA-256 검증 뒤 AudioEngine·Source Registry·Session 순서로 현재 Runtime이 교체되는지 확인합니다.

업그레이드 전에 생성된 JSON Outbox 항목에는 CRDT update가 없습니다. 이 항목은 기존 `apply_project_change` RPC로 전송해 미전송 변경을 보존합니다.

### Verify Final Result

```bash
pnpm typecheck
pnpm test
pnpm build
```

네트워크를 끊고 편집한 뒤 다시 연결해 Outbox가 자동으로 비워지는지도 확인합니다. 같은 operation을 다시 보내면 서버는 `already_applied`를 반환해야 합니다.

저장소 병합 검증은 다음 명령으로 실행합니다.

```bash
pnpm test -- src/layers/project-repository/project-crdt-remote-sync.test.ts
pnpm test -- src/layers/project-sync/project-sync-coordinator.test.ts
```

## FAQ

### 여러 프로젝트를 동시에 전송하나요?

아니요. 현재 활성 프로젝트만 전송합니다. 같은 프로젝트의 중복 요청은 하나의 진행 중 요청으로 합칩니다.

### revision 충돌도 자동 재시도하나요?

CRDT update append는 snapshot revision을 비교하지 않습니다. 기존 JSON Outbox의 snapshot RPC에서 revision 충돌이 발생하면 자동 재시도하지 않고 Outbox에 유지합니다.

### 원격 변경이 현재 화면에도 즉시 반영되나요?

동기화가 실행되면 활성 프로젝트의 원격 변경을 Session과 AudioEngine에 반영합니다. 로컬에 없는 미디어는 private Storage에서
받아 크기와 SHA-256을 검증한 뒤 OPFS에 저장합니다. Runtime 준비 중 현재 Session이 바뀌면 준비한 자원을 폐기하고
지수 백오프로 다시 시도합니다. 서버 변경을 실시간으로 구독하는 기능은 아직 없으므로, 원격 변경 발생 자체가 즉시 동기화를
시작하지는 않습니다.
