const SAFE_ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,100}$/;

export interface BillingActivationCallback {
  readonly authKey: string;
  readonly customerKey: string;
}

export function readBillingActivationCallback(search: string): BillingActivationCallback | null {
  const searchParams = new URLSearchParams(search);
  const authKey = searchParams.get('authKey')?.trim();
  const customerKey = searchParams.get('customerKey')?.trim();

  if (!authKey || !customerKey) {
    return null;
  }

  return { authKey, customerKey };
}

export function readBillingFailureCode(search: string): string | null {
  const code = new URLSearchParams(search).get('code');
  return code && SAFE_ERROR_CODE_PATTERN.test(code) ? code : null;
}
