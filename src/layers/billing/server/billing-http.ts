export interface AccessTokenVerifier {
  (accessToken: string): Promise<{ readonly userId: string } | null>;
}

export const BILLING_JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
};

export function createBillingJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: BILLING_JSON_HEADERS,
  });
}

export async function authenticateBillingRequest(
  request: Request,
  verifyAccessToken: AccessTokenVerifier
): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!accessToken) {
    return null;
  }

  const verifiedUser = await verifyAccessToken(accessToken);
  return verifiedUser?.userId ?? null;
}
