import type { PluginManifestValidationIssue } from '../plugin-sdk/plugin-manifest.schema';

export const PluginHostErrorCode = {
  INVALID_MANIFEST: 'INVALID_MANIFEST',
  MANIFEST_ALREADY_REGISTERED: 'MANIFEST_ALREADY_REGISTERED',
} as const;

export type PluginHostErrorCode = (typeof PluginHostErrorCode)[keyof typeof PluginHostErrorCode];

interface PluginHostErrorOptions {
  readonly code: PluginHostErrorCode;
  readonly message: string;
  readonly manifestId?: string;
  readonly issues?: readonly PluginManifestValidationIssue[];
}

export class PluginHostError extends Error {
  readonly code: PluginHostErrorCode;
  readonly manifestId?: string;
  readonly issues: readonly PluginManifestValidationIssue[];

  constructor({ code, message, manifestId, issues = [] }: PluginHostErrorOptions) {
    super(message);
    this.name = 'PluginHostError';
    this.code = code;
    this.manifestId = manifestId;
    this.issues = issues.map(issue => ({ ...issue, path: [...issue.path] }));
  }
}
