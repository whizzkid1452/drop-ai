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

`202608060001_create_project_sync.sql`은 다음 서버 자원을 만듭니다.

- 사용자별 `project_documents`
- operation ID별 `project_change_receipts`
- revision 확인과 idempotency 처리를 담당하는 `apply_project_change` RPC

### 2. 브라우저 환경 변수 설정

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

로그인하지 않았거나 설정이 없으면 로컬 저장은 계속 동작하고 서버 전송만 대기합니다.

### 3. 동기화 흐름 확인

1. 프로젝트를 편집합니다.
2. IndexedDB의 `project-documents`, `project-summaries`, `project-outbox`가 같은 transaction에서 갱신되는지 확인합니다.
3. 로그인 후 `apply_project_change` 요청이 revision 순서로 전송되는지 확인합니다.
4. 요청 성공 뒤 해당 operation만 `project-outbox`에서 제거되는지 확인합니다.

### Verify Final Result

```bash
pnpm typecheck
pnpm test
pnpm build
```

네트워크를 끊고 편집한 뒤 다시 연결해 Outbox가 자동으로 비워지는지도 확인합니다. 같은 operation을 다시 보내면 서버는 `already_applied`를 반환해야 합니다.

## FAQ

### 여러 프로젝트를 동시에 전송하나요?

아니요. 현재 활성 프로젝트만 전송합니다. 같은 프로젝트의 중복 요청은 하나의 진행 중 요청으로 합칩니다.

### revision 충돌도 자동 재시도하나요?

아니요. 네트워크·인증·일시적 서버 오류만 자동 재시도합니다. revision 충돌은 병합이 필요하므로 Outbox에 유지하고 오류로 보고합니다.
