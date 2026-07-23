export type PluginParameterValue = boolean | number | string;

export interface PluginManifestSummary {
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export interface PluginParameterState {
  readonly id: string;
  readonly value: PluginParameterValue;
}

export interface PluginInstanceState {
  readonly id: string;
  readonly manifestSummary: PluginManifestSummary;
  readonly isEnabled: boolean;
  readonly parameters: readonly PluginParameterState[];
}

export interface PluginValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: readonly string[];
}

export interface PluginValidationResult {
  readonly manifestId: string;
  readonly status: 'invalid' | 'valid';
  readonly issues: readonly PluginValidationIssue[];
}

export interface PluginLogEntry {
  readonly id: string;
  readonly pluginInstanceId: string | null;
  readonly level: 'error' | 'info' | 'warn';
  readonly message: string;
  readonly createdAtEpochMs: number;
}
