# Supabase 이메일 로그인 설정

## Goal

DROP.AI에서 이메일 Magic Link 로그인과 로그아웃을 사용할 수 있도록 Supabase Auth를 설정한다.

## Prerequisites

- Supabase 프로젝트
- 로컬 개발 환경의 Node.js와 pnpm
- 배포할 앱 URL

## Step-by-Step Guide

### 1. 공개 환경변수 설정

프로젝트 루트에 `.env.local`을 만들고 Supabase 프로젝트의 URL과 Publishable key를 입력한다.

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

두 값은 브라우저에 공개되는 설정이다. 이후 추가할 관리자 키와 결제 시크릿 키에는 `VITE_` 접두사를 사용하지 않는다.

### 2. Redirect URL 등록

Supabase Dashboard의 Auth URL 설정에 다음 주소를 등록한다.

```text
http://localhost:5173/auth/callback
https://<배포 도메인>/auth/callback
```

앱을 하위 경로에 배포하면 해당 base path도 포함한다.

```text
https://<배포 도메인>/<base-path>/auth/callback
```

### 3. 로그인 확인

개발 서버를 실행한다.

```bash
pnpm dev
```

1. 시작 화면의 `LOG IN`을 선택한다.
2. 이메일을 입력하고 `로그인 링크 받기`를 선택한다.
3. 받은 링크를 연다.
4. 화면에 이메일과 `LOG OUT`이 표시되는지 확인한다.

### Verify Final Result

다음 명령이 모두 성공해야 한다.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## FAQ

<details>
<summary>환경변수가 없으면 어떻게 되나요?</summary>

기존 편집 기능은 그대로 실행되고 로그인 제어는 표시되지 않는다. `/login`에서는 설정 안내를 표시한다.

</details>

<details>
<summary>이 설정만으로 유료 기능을 보호할 수 있나요?</summary>

아니다. 인증은 사용자 식별만 담당한다. 결제 완료 여부와 유료 기능 권한은 후속 서버·데이터베이스 단계에서 검증해야 한다.

</details>
