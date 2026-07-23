import type {
  PluginCatalogEntry,
  PluginInstanceState,
  PluginParameterDefinition,
  PluginParameterState,
  PluginParameterValue,
} from './types/plugin-state';
import type { ProjectPluginInstance } from './types/project-document.schema';

export const ProjectPluginCompatibilityIssueCode = {
  MANIFEST_NOT_FOUND: 'MANIFEST_NOT_FOUND',
  MANIFEST_CATALOG_CONFLICT: 'MANIFEST_CATALOG_CONFLICT',
  MANIFEST_VERSION_MISMATCH: 'MANIFEST_VERSION_MISMATCH',
  PARAMETER_DEFINITION_ID_CONFLICT: 'PARAMETER_DEFINITION_ID_CONFLICT',
  PARAMETER_ID_CONFLICT: 'PARAMETER_ID_CONFLICT',
  PARAMETER_NOT_FOUND: 'PARAMETER_NOT_FOUND',
  PARAMETER_MISSING: 'PARAMETER_MISSING',
  INVALID_PARAMETER_VALUE: 'INVALID_PARAMETER_VALUE',
} as const;

export type ProjectPluginCompatibilityIssueCode =
  (typeof ProjectPluginCompatibilityIssueCode)[keyof typeof ProjectPluginCompatibilityIssueCode];

export interface ProjectPluginCompatibilityIssue {
  readonly code: ProjectPluginCompatibilityIssueCode;
  readonly instanceId: string;
  readonly manifestId: string;
  readonly parameterId?: string;
  readonly actualVersion?: string;
  readonly expectedVersion?: string;
}

export type ProjectPluginCompatibilityResult =
  | {
      readonly status: 'compatible';
      readonly pluginInstance: PluginInstanceState;
    }
  | {
      readonly status: 'incompatible';
      readonly issues: readonly ProjectPluginCompatibilityIssue[];
    };

interface ValidateProjectPluginCompatibilityRequest {
  readonly instance: ProjectPluginInstance;
  readonly pluginCatalog: readonly PluginCatalogEntry[];
}

interface CreateIssueRequest {
  readonly instance: ProjectPluginInstance;
  readonly code: ProjectPluginCompatibilityIssueCode;
  readonly parameterId?: string;
  readonly actualVersion?: string;
  readonly expectedVersion?: string;
}

export function isPluginParameterValueCompatible(
  parameter: PluginParameterDefinition,
  value: PluginParameterValue
): boolean {
  if (parameter.type === 'boolean') {
    return typeof value === 'boolean';
  }
  if (parameter.type === 'enum') {
    return typeof value === 'string' && parameter.options.some(option => option.value === value);
  }
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= parameter.minValue && value <= parameter.maxValue
  );
}

export function validateProjectPluginCompatibility({
  instance,
  pluginCatalog,
}: ValidateProjectPluginCompatibilityRequest): ProjectPluginCompatibilityResult {
  const matchingCatalogEntries = pluginCatalog.filter(entry => entry.id === instance.manifestId);
  if (matchingCatalogEntries.length === 0) {
    return createIncompatibleResult(
      createIssue({ instance, code: ProjectPluginCompatibilityIssueCode.MANIFEST_NOT_FOUND })
    );
  }
  if (matchingCatalogEntries.length > 1) {
    return createIncompatibleResult(
      createIssue({ instance, code: ProjectPluginCompatibilityIssueCode.MANIFEST_CATALOG_CONFLICT })
    );
  }

  const [catalogEntry] = matchingCatalogEntries;
  if (!catalogEntry) {
    return createIncompatibleResult(
      createIssue({ instance, code: ProjectPluginCompatibilityIssueCode.MANIFEST_NOT_FOUND })
    );
  }
  if (catalogEntry.version !== instance.manifestVersion) {
    return createIncompatibleResult(
      createIssue({
        instance,
        code: ProjectPluginCompatibilityIssueCode.MANIFEST_VERSION_MISMATCH,
        actualVersion: instance.manifestVersion,
        expectedVersion: catalogEntry.version,
      })
    );
  }

  const definitionIds = new Set<string>();
  const definitionIssues: ProjectPluginCompatibilityIssue[] = [];
  catalogEntry.parameters.forEach(parameter => {
    if (definitionIds.has(parameter.id)) {
      definitionIssues.push(
        createIssue({
          instance,
          code: ProjectPluginCompatibilityIssueCode.PARAMETER_DEFINITION_ID_CONFLICT,
          parameterId: parameter.id,
        })
      );
      return;
    }
    definitionIds.add(parameter.id);
  });
  if (definitionIssues.length > 0) {
    return { status: 'incompatible', issues: definitionIssues };
  }

  const definitionsById = new Map(catalogEntry.parameters.map(parameter => [parameter.id, parameter]));
  const seenParameterIds = new Set<string>();
  const parameterValuesById = new Map<string, PluginParameterValue>();
  const issues: ProjectPluginCompatibilityIssue[] = [];

  instance.parameters.forEach(parameter => {
    if (seenParameterIds.has(parameter.id)) {
      issues.push(
        createIssue({
          instance,
          code: ProjectPluginCompatibilityIssueCode.PARAMETER_ID_CONFLICT,
          parameterId: parameter.id,
        })
      );
      return;
    }
    seenParameterIds.add(parameter.id);

    const definition = definitionsById.get(parameter.id);
    if (!definition) {
      issues.push(
        createIssue({
          instance,
          code: ProjectPluginCompatibilityIssueCode.PARAMETER_NOT_FOUND,
          parameterId: parameter.id,
        })
      );
      return;
    }
    if (!isPluginParameterValueCompatible(definition, parameter.value)) {
      issues.push(
        createIssue({
          instance,
          code: ProjectPluginCompatibilityIssueCode.INVALID_PARAMETER_VALUE,
          parameterId: parameter.id,
        })
      );
      return;
    }

    parameterValuesById.set(parameter.id, parameter.value);
  });

  catalogEntry.parameters.forEach(parameter => {
    if (seenParameterIds.has(parameter.id)) {
      return;
    }
    issues.push(
      createIssue({
        instance,
        code: ProjectPluginCompatibilityIssueCode.PARAMETER_MISSING,
        parameterId: parameter.id,
      })
    );
  });
  if (issues.length > 0) {
    return { status: 'incompatible', issues };
  }

  const parameterStates = createParameterStates({ instance, catalogEntry, parameterValuesById });
  if (parameterStates.status === 'incompatible') {
    return parameterStates;
  }

  return {
    status: 'compatible',
    pluginInstance: {
      id: instance.id,
      manifestSummary: { id: catalogEntry.id, name: catalogEntry.name, version: catalogEntry.version },
      isEnabled: instance.isEnabled,
      parameters: parameterStates.parameters,
    },
  };
}

function createParameterStates({
  instance,
  catalogEntry,
  parameterValuesById,
}: {
  readonly instance: ProjectPluginInstance;
  readonly catalogEntry: PluginCatalogEntry;
  readonly parameterValuesById: ReadonlyMap<string, PluginParameterValue>;
}):
  | { readonly status: 'compatible'; readonly parameters: readonly PluginParameterState[] }
  | { readonly status: 'incompatible'; readonly issues: readonly ProjectPluginCompatibilityIssue[] } {
  const parameters: PluginParameterState[] = [];

  for (const definition of catalogEntry.parameters) {
    const value = parameterValuesById.get(definition.id);
    if (value === undefined) {
      return createIncompatibleResult(
        createIssue({
          instance,
          code: ProjectPluginCompatibilityIssueCode.PARAMETER_MISSING,
          parameterId: definition.id,
        })
      );
    }
    parameters.push({ id: definition.id, value });
  }

  return { status: 'compatible', parameters };
}

function createIssue({
  instance,
  code,
  parameterId,
  actualVersion,
  expectedVersion,
}: CreateIssueRequest): ProjectPluginCompatibilityIssue {
  return {
    code,
    instanceId: instance.id,
    manifestId: instance.manifestId,
    ...(parameterId ? { parameterId } : {}),
    ...(actualVersion ? { actualVersion } : {}),
    ...(expectedVersion ? { expectedVersion } : {}),
  };
}

function createIncompatibleResult(
  issue: ProjectPluginCompatibilityIssue
): Extract<ProjectPluginCompatibilityResult, { status: 'incompatible' }> {
  return { status: 'incompatible', issues: [issue] };
}
