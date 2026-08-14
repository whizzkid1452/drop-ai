export type PluginParameterValue = boolean | number | string;

export interface PluginManifestSummary {
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export interface PluginNumberParameterDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: 'number';
  readonly minValue: number;
  readonly maxValue: number;
  readonly defaultValue: number;
  readonly step?: number;
}

export interface PluginBooleanParameterDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: 'boolean';
  readonly defaultValue: boolean;
}

export interface PluginEnumParameterDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: 'enum';
  readonly defaultValue: string;
  readonly options: readonly {
    readonly value: string;
    readonly name: string;
  }[];
}

export type PluginParameterDefinition =
  | PluginNumberParameterDefinition
  | PluginBooleanParameterDefinition
  | PluginEnumParameterDefinition;

export interface PluginCatalogEntry extends PluginManifestSummary {
  readonly category?: string;
  readonly parameters: readonly PluginParameterDefinition[];
  readonly presets?: readonly PluginPresetDefinition[];
  readonly supportsSidechain?: boolean;
}

export interface PluginPresetDefinition {
  readonly id: string;
  readonly name: string;
  readonly parameterValues: Readonly<Record<string, PluginParameterValue>>;
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
  readonly presetId?: string | null;
  readonly sidechainSourceTrackId?: string | null;
  readonly stateBlob?: string | null;
  readonly availability?: 'available' | 'missing';
}

export interface PluginRuntimeState {
  readonly instanceId: string;
  readonly latencySamples: number;
  readonly status: 'active' | 'bypassed' | 'failed' | 'missing';
  readonly reason: string | null;
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
