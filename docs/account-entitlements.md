# 계정 권한 서버 설정

## 목표

로그인한 사용자가 자신의 `free` 또는 `pro` 권한만 조회하도록 설정합니다.

## 사전 준비

- Supabase 프로젝트
- Netlify 사이트
- Supabase CLI 또는 Supabase SQL Editor

## 단계별 설정

### 1. 데이터베이스 변경 적용

Supabase CLI를 사용하는 경우 다음 명령을 실행합니다.

```bash
supabase db push
```

SQL Editor를 사용하는 경우
`supabase/migrations/202607310001_create_account_entitlements.sql` 파일 내용을 실행합니다.

마이그레이션은 다음 규칙을 적용합니다.

- 신규 사용자는 `free` 권한으로 시작합니다.
- 로그인한 사용자는 자신의 권한만 읽을 수 있습니다.
- 브라우저에서는 권한 행을 추가·수정·삭제할 수 없습니다.

### 2. Netlify 서버 환경 변수 등록

Netlify의 사이트 환경 변수에 다음 값을 등록합니다. 값은 Functions 범위에서 사용할 수 있어야 합니다.

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY`에는 `VITE_` 접두사를 붙이지 않습니다. 브라우저 번들에 포함되면 안 되는 서버 전용 비밀
키입니다.

### 3. 권한 API 확인

로그인한 사용자의 Supabase access token을 Bearer 토큰으로 전달합니다.

```bash
curl https://YOUR_SITE.example/api/account/entitlement \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

정상 응답 예시는 다음과 같습니다.

```json
{
  "planCode": "free",
  "status": "active",
  "currentPeriodEnd": null
}
```

### 최종 결과 확인

- 토큰이 없거나 유효하지 않으면 HTTP 401을 반환합니다.
- 정상 토큰이면 토큰 소유자의 권한만 반환합니다.
- 서버 환경 변수가 없으면 HTTP 503을 반환합니다.
