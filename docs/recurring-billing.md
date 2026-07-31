# 토스페이먼츠 월 구독 설정

## 목표

토스페이먼츠 카드 등록창에서 빌링키를 발급하고, 서버가 매월 같은 구독 금액을 승인하도록 설정합니다.

## 사전 준비

- 토스페이먼츠 자동결제 계약 또는 테스트 상점 키
- Supabase 프로젝트
- Netlify 사이트
- 사용자에게 표시할 월 구독 가격

## 단계별 설정

### 1. 데이터베이스 변경 적용

다음 마이그레이션을 적용합니다.

```bash
supabase db push
```

`202607310002_create_recurring_billing.sql`은 카드 등록 intent, 구독, 주문을 저장합니다. 빌링키 관련
테이블은 `anon`과 `authenticated` 역할의 접근을 차단합니다.

### 2. 비밀 키 생성

빌링키 암호화에는 32바이트 키를 base64로 인코딩한 값을 사용합니다.

```bash
openssl rand -base64 32
```

worker 호출용 비밀값도 별도로 생성합니다.

```bash
openssl rand -hex 32
```

### 3. Netlify 환경 변수 등록

다음 값을 Netlify 환경 변수에 등록합니다. 비밀값은 Functions 범위에서만 사용합니다.

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
TOSS_CLIENT_KEY
TOSS_SECRET_KEY
PRO_MONTHLY_PRICE_KRW
BILLING_KEY_ENCRYPTION_KEY
BILLING_JOB_SECRET
```

`PRO_MONTHLY_PRICE_KRW`는 임의 기본값이 없습니다. 실제 판매할 원화 월 가격을 양의 정수로
등록해야 합니다.

### 4. 토스 자동결제 계약 확인

테스트 키로는 가상 승인을 확인할 수 있습니다. 라이브 키로 자동결제를 받으려면 자동결제 계약과
리스크 검토가 완료된 상점 키가 필요합니다.

### 5. 구독 실행 흐름 확인

1. `POST /api/billing/intents`가 카드 등록용 `customerKey`와 가격을 만듭니다.
2. 브라우저가 토스 SDK의 `requestBillingAuth()`를 호출합니다.
3. 성공 URL의 `authKey`, `customerKey`를 `POST /api/billing/activate`로 보냅니다.
4. 서버는 빌링키를 암호화해 저장하고 백그라운드 worker에서 첫 결제를 승인합니다.
5. 매시간 실행되는 dispatcher가 결제일이 된 구독을 worker로 전달합니다.
6. 취소 요청은 다음 결제일에 추가 승인을 하지 않고 빌링키를 삭제합니다.

### 최종 결과 확인

- 첫 결제가 성공하면 `account_entitlements.plan_code`가 `pro`로 변경됩니다.
- 같은 주문 재처리는 같은 토스 멱등키를 사용합니다.
- 카드사가 명시적으로 거절하면 구독은 `past_due`가 됩니다.
- 네트워크 단절로 결과가 불명확하면 새 주문을 만들지 않고 같은 주문을 다시 확인합니다.

Netlify Scheduled Function은 배포 미리보기에서 자동 실행되지 않습니다. Netlify의 Functions 화면에서
`dispatch-billing-renewals`를 수동 실행해 테스트합니다.
