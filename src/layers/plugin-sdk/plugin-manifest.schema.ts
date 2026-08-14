import { z } from 'zod';

export const PLUGIN_MANIFEST_SCHEMA_VERSION = 1 as const;

const MAX_TEXT_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_MANIFEST_ENTRIES = 128;
const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/;
const MEMBER_ID_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const PROCESSOR_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const WORKLET_MODULE_PATH_PATTERN = /^(?:\.\/)?(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.m?js$/;
const SEMANTIC_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const displayNameSchema = z.string().trim().min(1).max(MAX_TEXT_LENGTH);
const memberIdSchema = z.string().min(1).max(MAX_TEXT_LENGTH).regex(MEMBER_ID_PATTERN);

const PluginNumberParameterSchema = z.strictObject({
  id: memberIdSchema,
  name: displayNameSchema,
  type: z.literal('number'),
  minValue: z.number().finite(),
  maxValue: z.number().finite(),
  defaultValue: z.number().finite(),
  step: z.number().finite().positive().optional(),
});

const PluginBooleanParameterSchema = z.strictObject({
  id: memberIdSchema,
  name: displayNameSchema,
  type: z.literal('boolean'),
  defaultValue: z.boolean(),
});

const PluginEnumParameterSchema = z.strictObject({
  id: memberIdSchema,
  name: displayNameSchema,
  type: z.literal('enum'),
  defaultValue: memberIdSchema,
  options: z
    .array(
      z.strictObject({
        value: memberIdSchema,
        name: displayNameSchema,
      })
    )
    .min(1)
    .max(MAX_MANIFEST_ENTRIES),
});

export const PluginParameterManifestSchema = z.discriminatedUnion('type', [
  PluginNumberParameterSchema,
  PluginBooleanParameterSchema,
  PluginEnumParameterSchema,
]);

export const PluginUiControlSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('slider'), parameterId: memberIdSchema }),
  z.strictObject({ type: z.literal('toggle'), parameterId: memberIdSchema }),
  z.strictObject({ type: z.literal('select'), parameterId: memberIdSchema }),
]);

const PluginManifestBaseSchema = z.strictObject({
  schemaVersion: z.literal(PLUGIN_MANIFEST_SCHEMA_VERSION),
  id: z.string().min(1).max(MAX_TEXT_LENGTH).regex(PLUGIN_ID_PATTERN),
  name: displayNameSchema,
  description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH).optional(),
  version: z.string().min(1).max(MAX_TEXT_LENGTH).regex(SEMANTIC_VERSION_PATTERN),
  type: z.literal('effect'),
  category: memberIdSchema.optional(),
  parameters: z.array(PluginParameterManifestSchema).max(MAX_MANIFEST_ENTRIES),
  presets: z
    .array(
      z.strictObject({
        id: memberIdSchema,
        name: displayNameSchema,
        parameterValues: z.record(memberIdSchema, z.union([z.boolean(), z.number().finite(), memberIdSchema])),
      })
    )
    .max(MAX_MANIFEST_ENTRIES)
    .optional(),
  supportsSidechain: z.boolean().optional(),
  dsp: z.strictObject({
    workletModulePath: z.string().min(1).max(MAX_TEXT_LENGTH).regex(WORKLET_MODULE_PATH_PATTERN),
    processorName: z.string().min(1).max(MAX_TEXT_LENGTH).regex(PROCESSOR_NAME_PATTERN),
  }),
  ui: z.strictObject({
    controls: z.array(PluginUiControlSchema).max(MAX_MANIFEST_ENTRIES),
  }),
});

export type PluginParameterManifest = z.infer<typeof PluginParameterManifestSchema>;
export type PluginUiControl = z.infer<typeof PluginUiControlSchema>;

interface RefinementOptions<TEntry> {
  readonly entries: readonly TEntry[];
  readonly getValue: (entry: TEntry) => string;
  readonly pathPrefix: readonly (string | number)[];
  readonly label: string;
  readonly context: z.RefinementCtx;
}

function addDuplicateValueIssues<TEntry>({
  entries,
  getValue,
  pathPrefix,
  label,
  context,
}: RefinementOptions<TEntry>): void {
  const seenValues = new Set<string>();

  entries.forEach((entry, index) => {
    const value = getValue(entry);
    if (seenValues.has(value)) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate ${label}: ${value}`,
        path: [...pathPrefix, index],
      });
      return;
    }

    seenValues.add(value);
  });
}

interface ParameterRefinementOptions {
  readonly parameter: PluginParameterManifest;
  readonly parameterIndex: number;
  readonly context: z.RefinementCtx;
}

function validateParameterDefinition({ parameter, parameterIndex, context }: ParameterRefinementOptions): void {
  if (parameter.type === 'number') {
    validateNumberParameter({ parameter, parameterIndex, context });
    return;
  }

  if (parameter.type === 'enum') {
    validateEnumParameter({ parameter, parameterIndex, context });
  }
}

interface NumberParameterRefinementOptions {
  readonly parameter: z.infer<typeof PluginNumberParameterSchema>;
  readonly parameterIndex: number;
  readonly context: z.RefinementCtx;
}

function validateNumberParameter({ parameter, parameterIndex, context }: NumberParameterRefinementOptions): void {
  if (parameter.maxValue <= parameter.minValue) {
    context.addIssue({
      code: 'custom',
      message: 'Number parameter maxValue must be greater than minValue',
      path: ['parameters', parameterIndex, 'maxValue'],
    });
    return;
  }

  if (parameter.defaultValue < parameter.minValue || parameter.defaultValue > parameter.maxValue) {
    context.addIssue({
      code: 'custom',
      message: 'Number parameter defaultValue must be within its range',
      path: ['parameters', parameterIndex, 'defaultValue'],
    });
  }
}

interface EnumParameterRefinementOptions {
  readonly parameter: z.infer<typeof PluginEnumParameterSchema>;
  readonly parameterIndex: number;
  readonly context: z.RefinementCtx;
}

function validateEnumParameter({ parameter, parameterIndex, context }: EnumParameterRefinementOptions): void {
  addDuplicateValueIssues({
    entries: parameter.options,
    getValue: option => option.value,
    pathPrefix: ['parameters', parameterIndex, 'options'],
    label: 'enum option value',
    context,
  });

  if (parameter.options.some(option => option.value === parameter.defaultValue)) {
    return;
  }

  context.addIssue({
    code: 'custom',
    message: 'Enum parameter defaultValue must reference an option',
    path: ['parameters', parameterIndex, 'defaultValue'],
  });
}

const expectedControlTypeByParameterType = {
  boolean: 'toggle',
  enum: 'select',
  number: 'slider',
} as const;

interface ControlRefinementOptions {
  readonly controls: readonly PluginUiControl[];
  readonly parameters: readonly PluginParameterManifest[];
  readonly context: z.RefinementCtx;
}

function validateUiControls({ controls, parameters, context }: ControlRefinementOptions): void {
  const parametersById = new Map(parameters.map(parameter => [parameter.id, parameter]));

  addDuplicateValueIssues({
    entries: controls,
    getValue: control => control.parameterId,
    pathPrefix: ['ui', 'controls'],
    label: 'UI control parameterId',
    context,
  });

  controls.forEach((control, controlIndex) => {
    const parameter = parametersById.get(control.parameterId);
    if (!parameter) {
      context.addIssue({
        code: 'custom',
        message: `UI control references a missing parameter: ${control.parameterId}`,
        path: ['ui', 'controls', controlIndex, 'parameterId'],
      });
      return;
    }

    if (control.type === expectedControlTypeByParameterType[parameter.type]) {
      return;
    }

    context.addIssue({
      code: 'custom',
      message: `UI control type does not match parameter type: ${control.parameterId}`,
      path: ['ui', 'controls', controlIndex, 'type'],
    });
  });
}

function isPresetValueCompatible(parameter: PluginParameterManifest, value: boolean | number | string): boolean {
  if (parameter.type === 'boolean') {
    return typeof value === 'boolean';
  }
  if (parameter.type === 'enum') {
    return typeof value === 'string' && parameter.options.some(option => option.value === value);
  }
  return typeof value === 'number' && value >= parameter.minValue && value <= parameter.maxValue;
}

function validatePresets(
  presets: NonNullable<z.infer<typeof PluginManifestBaseSchema>['presets']>,
  parameters: readonly PluginParameterManifest[],
  context: z.RefinementCtx
): void {
  addDuplicateValueIssues({
    entries: presets,
    getValue: preset => preset.id,
    pathPrefix: ['presets'],
    label: 'preset ID',
    context,
  });
  const parametersById = new Map(parameters.map(parameter => [parameter.id, parameter]));
  presets.forEach((preset, presetIndex) => {
    Object.entries(preset.parameterValues).forEach(([parameterId, value]) => {
      const parameter = parametersById.get(parameterId);
      if (parameter && isPresetValueCompatible(parameter, value)) {
        return;
      }
      context.addIssue({
        code: 'custom',
        message: parameter ? `Preset value is invalid: ${parameterId}` : `Preset parameter is missing: ${parameterId}`,
        path: ['presets', presetIndex, 'parameterValues', parameterId],
      });
    });
  });
}

export const PluginManifestSchema = PluginManifestBaseSchema.superRefine((manifest, context) => {
  addDuplicateValueIssues({
    entries: manifest.parameters,
    getValue: parameter => parameter.id,
    pathPrefix: ['parameters'],
    label: 'parameter ID',
    context,
  });

  manifest.parameters.forEach((parameter, parameterIndex) => {
    validateParameterDefinition({ parameter, parameterIndex, context });
  });
  validateUiControls({ controls: manifest.ui.controls, parameters: manifest.parameters, context });
  validatePresets(manifest.presets ?? [], manifest.parameters, context);
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

export interface PluginManifestValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export type PluginManifestValidation =
  | {
      readonly status: 'valid';
      readonly manifest: PluginManifest;
      readonly issues: readonly [];
    }
  | {
      readonly status: 'invalid';
      readonly manifest: null;
      readonly issues: readonly PluginManifestValidationIssue[];
    };

export function validatePluginManifest(input: unknown): PluginManifestValidation {
  const result = PluginManifestSchema.safeParse(input);
  if (result.success) {
    return { status: 'valid', manifest: result.data, issues: [] };
  }

  return {
    status: 'invalid',
    manifest: null,
    issues: result.error.issues.map(issue => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map(pathSegment => (typeof pathSegment === 'symbol' ? String(pathSegment) : pathSegment)),
    })),
  };
}

export function createPluginManifestSummary(manifest: PluginManifest) {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
  };
}

export function createPluginCatalogEntry(manifest: PluginManifest) {
  return {
    ...createPluginManifestSummary(manifest),
    category: manifest.category ?? 'other',
    parameters: manifest.parameters.map(parameter => {
      if (parameter.type !== 'enum') {
        return { ...parameter };
      }
      return { ...parameter, options: parameter.options.map(option => ({ ...option })) };
    }),
    presets: (manifest.presets ?? []).map(preset => ({
      ...preset,
      parameterValues: { ...preset.parameterValues },
    })),
    supportsSidechain: manifest.supportsSidechain ?? false,
  };
}
