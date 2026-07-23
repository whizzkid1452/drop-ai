# 멀티스테이지 빌드를 위한 Dockerfile
FROM node:26.5.0-alpine AS base

# pnpm 설치
RUN npm install --global pnpm@11.16.0

# 의존성 설치 단계
FROM base AS deps
WORKDIR /app

# 의존성 명세와 pnpm 설정 복사
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 빌드 단계
FROM base AS builder
WORKDIR /app

# 의존성 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# 빌드 실행
RUN pnpm build

# 프로덕션 단계
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# 빌드 결과물 복사
COPY --from=builder /app/dist .

# nginx 설정 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 포트 노출
EXPOSE 80

# nginx 시작
CMD ["nginx", "-g", "daemon off;"]
