import type { Config } from '@netlify/functions';
import { dispatchBillingWorker } from '../billing-runtime';

export default async function dispatchRenewals(): Promise<Response> {
  const siteUrl = process.env.URL;
  const jobSecret = process.env.BILLING_JOB_SECRET;
  if (!siteUrl || !jobSecret) {
    return new Response(null, { status: 503 });
  }

  try {
    await dispatchBillingWorker({ siteUrl, jobSecret });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export const config: Config = {
  schedule: '@hourly',
};
