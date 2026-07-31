interface AuthCallbackUrlOptions {
  readonly origin: string;
  readonly basePath: string;
}

export function createAuthCallbackUrl({ origin, basePath }: AuthCallbackUrlOptions): string {
  // 하위 경로 배포에서도 Redirect URL이 앱의 base path를 벗어나지 않게 한다.
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return new URL(`${normalizedBasePath.replace(/^\//, '')}auth/callback`, `${origin}/`).toString();
}
