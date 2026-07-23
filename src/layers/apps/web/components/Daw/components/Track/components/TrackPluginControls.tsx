import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommandExecutor, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  executePluginEnabledChange,
  executePluginInstall,
  executePluginParameterChange,
  executePluginRemoval,
  type PluginActionResult,
} from '@/layers/apps/web/hooks/plugin-action-commands';
import type { PluginInstanceState, PluginParameterDefinition, PluginParameterValue } from '@/types/plugin-state';
import * as styles from './TrackPluginControls.css.ts';

interface TrackPluginControlsProps {
  trackId: string;
  pluginInstances: readonly PluginInstanceState[];
}

interface PluginParameterControlProps {
  definition: PluginParameterDefinition;
  instance: PluginInstanceState;
  isDisabled: boolean;
  onChange: (parameterId: string, value: PluginParameterValue) => void;
}

interface PluginParameterChangeRequest {
  instanceId: string;
  parameterId: string;
  value: PluginParameterValue;
}

function getParameterValue(instance: PluginInstanceState, definition: PluginParameterDefinition): PluginParameterValue {
  return instance.parameters.find(parameter => parameter.id === definition.id)?.value ?? definition.defaultValue;
}

function PluginParameterControl({ definition, instance, isDisabled, onChange }: PluginParameterControlProps) {
  const inputId = `${instance.id}-${definition.id}`;
  const value = getParameterValue(instance, definition);

  if (definition.type === 'number') {
    const numberValue = typeof value === 'number' ? value : definition.defaultValue;
    return (
      <label className={styles.parameter} htmlFor={inputId}>
        <span className={styles.parameterName}>{definition.name}</span>
        <input
          id={inputId}
          name={definition.id}
          type="range"
          min={definition.minValue}
          max={definition.maxValue}
          step={definition.step ?? 'any'}
          disabled={isDisabled}
          value={numberValue}
          onChange={event => {
            const nextValue = Number(event.currentTarget.value);
            if (Number.isFinite(nextValue)) {
              onChange(definition.id, nextValue);
            }
          }}
        />
        <output className={styles.parameterValue} htmlFor={inputId}>
          {numberValue}
        </output>
      </label>
    );
  }

  if (definition.type === 'boolean') {
    const booleanValue = typeof value === 'boolean' ? value : definition.defaultValue;
    return (
      <label className={styles.parameter} htmlFor={inputId}>
        <span className={styles.parameterName}>{definition.name}</span>
        <input
          id={inputId}
          name={definition.id}
          type="checkbox"
          disabled={isDisabled}
          checked={booleanValue}
          onChange={event => onChange(definition.id, event.currentTarget.checked)}
        />
      </label>
    );
  }

  const enumValue = typeof value === 'string' ? value : definition.defaultValue;
  return (
    <label className={styles.parameter} htmlFor={inputId}>
      <span className={styles.parameterName}>{definition.name}</span>
      <select
        id={inputId}
        name={definition.id}
        className={styles.select}
        disabled={isDisabled}
        value={enumValue}
        onChange={event => onChange(definition.id, event.currentTarget.value)}
      >
        {definition.options.map(option => (
          <option key={option.value} value={option.value}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TrackPluginControls({ trackId, pluginInstances }: TrackPluginControlsProps) {
  const commandExecutor = useCommandExecutor();
  const pluginCatalog = useSession(state => state.pluginCatalog);
  const catalogEntries = useMemo(() => Array.from(pluginCatalog.values()), [pluginCatalog]);
  const [selectedManifestId, setSelectedManifestId] = useState(catalogEntries[0]?.id ?? '');
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const pendingActionIdRef = useRef<string | null>(null);
  const isPending = pendingActionId !== null;

  useEffect(() => {
    if (!pluginCatalog.has(selectedManifestId)) {
      setSelectedManifestId(catalogEntries[0]?.id ?? '');
    }
  }, [catalogEntries, pluginCatalog, selectedManifestId]);

  const runAction = async (actionId: string, action: () => Promise<PluginActionResult>) => {
    if (pendingActionIdRef.current !== null) {
      return;
    }

    pendingActionIdRef.current = actionId;
    setPendingActionId(actionId);
    try {
      await action();
    } finally {
      pendingActionIdRef.current = null;
      setPendingActionId(null);
    }
  };

  const handleInstall = async () => {
    if (!selectedManifestId) {
      return;
    }
    await runAction(`install:${selectedManifestId}`, () =>
      executePluginInstall({
        trackId,
        manifestId: selectedManifestId,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  const handleRemove = async (instanceId: string) => {
    await runAction(`remove:${instanceId}`, () =>
      executePluginRemoval({
        trackId,
        instanceId,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  const handleEnabledChange = async (instanceId: string, isEnabled: boolean) => {
    await runAction(`enabled:${instanceId}`, () =>
      executePluginEnabledChange({
        trackId,
        instanceId,
        isEnabled,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  const handleParameterChange = ({ instanceId, parameterId, value }: PluginParameterChangeRequest) => {
    void runAction(`parameter:${instanceId}:${parameterId}`, () =>
      executePluginParameterChange({
        trackId,
        instanceId,
        parameterId,
        value,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  return (
    <section className={styles.container} aria-label="Track Plugins">
      <div className={styles.header}>
        <strong className={styles.title}>Plugins</strong>
        {catalogEntries.length > 0 ? (
          <div className={styles.addControls}>
            <select
              className={styles.select}
              aria-label="설치할 Plugin"
              disabled={isPending}
              value={selectedManifestId}
              onChange={event => setSelectedManifestId(event.currentTarget.value)}
            >
              {catalogEntries.map(plugin => (
                <option key={plugin.id} value={plugin.id}>
                  {plugin.name}
                </option>
              ))}
            </select>
            <button
              className={styles.addButton}
              type="button"
              aria-label="Plugin 설치"
              disabled={isPending || !selectedManifestId}
              onClick={() => void handleInstall()}
            >
              {pendingActionId?.startsWith('install:') ? '설치 중…' : '추가'}
            </button>
          </div>
        ) : (
          <span className={styles.emptyMessage}>설치 가능한 Plugin이 없습니다.</span>
        )}
      </div>

      <div className={styles.instanceList}>
        {pluginInstances.map(instance => {
          const manifest = pluginCatalog.get(instance.manifestSummary.id);
          return (
            <article className={styles.instance} key={instance.id}>
              <div className={styles.instanceHeader}>
                <span>{instance.manifestSummary.name}</span>
                <div className={styles.instanceActions}>
                  <button
                    className={styles.toggleButton}
                    type="button"
                    aria-label={`${instance.manifestSummary.name} Plugin ${instance.isEnabled ? '비활성화' : '활성화'}`}
                    aria-pressed={instance.isEnabled}
                    disabled={isPending}
                    onClick={() => void handleEnabledChange(instance.id, !instance.isEnabled)}
                  >
                    {pendingActionId === `enabled:${instance.id}` ? '변경 중…' : instance.isEnabled ? '켜짐' : '꺼짐'}
                  </button>
                  <button
                    className={styles.removeButton}
                    type="button"
                    aria-label={`${instance.manifestSummary.name} Plugin 삭제`}
                    disabled={isPending}
                    onClick={() => void handleRemove(instance.id)}
                  >
                    {pendingActionId === `remove:${instance.id}` ? '삭제 중…' : '삭제'}
                  </button>
                </div>
              </div>
              {manifest ? (
                manifest.parameters.map(definition => (
                  <PluginParameterControl
                    key={definition.id}
                    definition={definition}
                    instance={instance}
                    isDisabled={isPending}
                    onChange={(parameterId, value) =>
                      handleParameterChange({ instanceId: instance.id, parameterId, value })
                    }
                  />
                ))
              ) : (
                <span className={styles.emptyMessage}>Parameter 정보를 불러올 수 없습니다.</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
