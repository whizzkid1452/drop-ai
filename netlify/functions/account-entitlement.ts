import type { Config } from '@netlify/functions';
import { createAccountEntitlementHandler } from '../../src/layers/billing/server/account-entitlement-handler';
import { createSupabaseAccountEntitlementDependencies } from '../../src/layers/billing/server/create-supabase-account-entitlement-dependencies';

type AccountEntitlementHandler = (request: Request) => Promise<Response>;

let accountEntitlementHandler: AccountEntitlementHandler | undefined;

function readRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`필수 서버 환경 변수가 없습니다: ${name}`);
  }
  return value;
}

function getAccountEntitlementHandler(): AccountEntitlementHandler {
  if (accountEntitlementHandler) {
    return accountEntitlementHandler;
  }

  const dependencies = createSupabaseAccountEntitlementDependencies({
    supabaseUrl: readRequiredEnvironmentVariable('SUPABASE_URL'),
    publishableKey: readRequiredEnvironmentVariable('SUPABASE_PUBLISHABLE_KEY'),
    secretKey: readRequiredEnvironmentVariable('SUPABASE_SECRET_KEY'),
  });
  accountEntitlementHandler = createAccountEntitlementHandler(dependencies);
  return accountEntitlementHandler;
}

export default async function accountEntitlement(request: Request): Promise<Response> {
  try {
    return await getAccountEntitlementHandler()(request);
  } catch {
    return Response.json(
      {
        code: 'SERVER_CONFIGURATION_ERROR',
        message: '계정 권한 서버가 설정되지 않았습니다.',
      },
      { status: 503 }
    );
  }
}

export const config: Config = {
  path: '/api/account/entitlement',
};
