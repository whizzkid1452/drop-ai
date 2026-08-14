import { useEffect, useMemo, useRef, useState } from 'react';
import { useCommandExecutor, usePluginRuntimeQuery, useSession } from '@/layers/apps/web/context/layer-hooks';
import {
  executePluginEnabledChange,
  executePluginInstall,
  executePluginMove,
  executePluginParameterChange,
  executePluginPresetApply,
  executePluginRemoval,
  executePluginFavoriteChange,
  executePluginSidechainChange,
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
  const pluginRuntime = usePluginRuntimeQuery();
  const pluginCatalog = useSession(state => state.pluginCatalog);
  const favoritePluginManifestIds = useSession(state => state.favoritePluginManifestIds);
  const tracks = useSession(state => state.tracks);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const categories = useMemo(
    () => [...new Set(Array.from(pluginCatalog.values()).map(plugin => plugin.category ?? 'other'))].sort(),
    [pluginCatalog]
  );
  const catalogEntries = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLocaleLowerCase();
    return Array.from(pluginCatalog.values()).filter(plugin => {
      const matchesSearch =
        normalizedSearchText.length === 0 ||
        plugin.name.toLocaleLowerCase().includes(normalizedSearchText) ||
        plugin.id.toLocaleLowerCase().includes(normalizedSearchText);
      const matchesCategory = selectedCategory === 'all' || (plugin.category ?? 'other') === selectedCategory;
      const matchesFavorite = !showFavoritesOnly || favoritePluginManifestIds.has(plugin.id);
      return matchesSearch && matchesCategory && matchesFavorite;
    });
  }, [favoritePluginManifestIds, pluginCatalog, searchText, selectedCategory, showFavoritesOnly]);
  const runtimeStates = new Map(pluginRuntime.readTrack(trackId).map(state => [state.instanceId, state]));
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

  const handleMove = async (instanceId: string, targetIndex: number) => {
    await runAction(`move:${instanceId}`, () =>
      executePluginMove({
        trackId,
        instanceId,
        targetIndex,
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

  const handlePresetChange = async (instanceId: string, presetId: string) => {
    await runAction(`preset:${instanceId}`, () =>
      executePluginPresetApply({
        trackId,
        instanceId,
        presetId,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  const handleSidechainChange = async (instanceId: string, sourceTrackId: string | null) => {
    await runAction(`sidechain:${instanceId}`, () =>
      executePluginSidechainChange({
        trackId,
        instanceId,
        sourceTrackId,
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  const handleFavoriteChange = async () => {
    if (!selectedManifestId) {
      return;
    }
    await runAction(`favorite:${selectedManifestId}`, () =>
      executePluginFavoriteChange({
        manifestId: selectedManifestId,
        isFavorite: !favoritePluginManifestIds.has(selectedManifestId),
        executeCommand: command => commandExecutor.execute(command),
        notifyFailure: message => window.alert(message),
      })
    );
  };

  return (
    <section className={styles.container} aria-label="Track Plugins">
      <div className={styles.header}>
        <strong className={styles.title}>Plugins</strong>
      </div>
      <div className={styles.browserControls}>
        <input
          className={styles.searchInput}
          aria-label="Plugin 검색"
          placeholder="이름 또는 ID"
          type="search"
          value={searchText}
          onChange={event => setSearchText(event.currentTarget.value)}
        />
        <select
          className={styles.select}
          aria-label="Plugin Category"
          value={selectedCategory}
          onChange={event => setSelectedCategory(event.currentTarget.value)}
        >
          <option value="all">전체 Category</option>
          {categories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <label className={styles.favoriteFilter}>
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={event => setShowFavoritesOnly(event.currentTarget.checked)}
          />
          Favorite만
        </label>
      </div>
      <div className={styles.header}>
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
                  {favoritePluginManifestIds.has(plugin.id) ? '★ ' : ''}
                  {plugin.name} · {plugin.category ?? 'other'}
                </option>
              ))}
            </select>
            <button
              className={styles.toggleButton}
              type="button"
              aria-label="선택 Plugin Favorite 변경"
              aria-pressed={favoritePluginManifestIds.has(selectedManifestId)}
              disabled={isPending || !selectedManifestId}
              onClick={() => void handleFavoriteChange()}
            >
              {favoritePluginManifestIds.has(selectedManifestId) ? '★' : '☆'}
            </button>
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
        {pluginInstances.map((instance, index) => {
          const manifest = pluginCatalog.get(instance.manifestSummary.id);
          const runtimeState = runtimeStates.get(instance.id);
          const runtimeStatus = runtimeState?.status ?? (instance.availability === 'missing' ? 'missing' : 'failed');
          const isRuntimeUnavailable = runtimeStatus === 'failed' || runtimeStatus === 'missing';
          return (
            <article className={styles.instance} key={instance.id}>
              <div className={styles.instanceHeader}>
                <span>
                  {instance.manifestSummary.name}{' '}
                  <span className={styles.runtimeBadge} data-status={runtimeStatus}>
                    {runtimeStatus}
                    {runtimeState && runtimeState.latencySamples > 0 ? ` · ${runtimeState.latencySamples} samples` : ''}
                  </span>
                </span>
                <div className={styles.instanceActions}>
                  <button
                    className={styles.toggleButton}
                    type="button"
                    aria-label={`${instance.manifestSummary.name} Plugin 위로 이동`}
                    disabled={isPending || index === 0}
                    onClick={() => void handleMove(instance.id, index - 1)}
                  >
                    위
                  </button>
                  <button
                    className={styles.toggleButton}
                    type="button"
                    aria-label={`${instance.manifestSummary.name} Plugin 아래로 이동`}
                    disabled={isPending || index === pluginInstances.length - 1}
                    onClick={() => void handleMove(instance.id, index + 1)}
                  >
                    아래
                  </button>
                  <button
                    className={styles.toggleButton}
                    type="button"
                    aria-label={`${instance.manifestSummary.name} Plugin ${instance.isEnabled ? '비활성화' : '활성화'}`}
                    aria-pressed={instance.isEnabled}
                    disabled={isPending || isRuntimeUnavailable}
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
              {runtimeState?.reason ? (
                <span className={styles.runtimeReason} role="status">
                  {runtimeState.reason}
                </span>
              ) : null}
              {manifest?.presets && manifest.presets.length > 0 ? (
                <label className={styles.settingRow}>
                  <span>Preset</span>
                  <select
                    className={styles.select}
                    aria-label={`${instance.manifestSummary.name} Preset`}
                    disabled={isPending || isRuntimeUnavailable}
                    value={instance.presetId ?? ''}
                    onChange={event => {
                      if (event.currentTarget.value) {
                        void handlePresetChange(instance.id, event.currentTarget.value);
                      }
                    }}
                  >
                    <option value="">Custom</option>
                    {manifest.presets.map(preset => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {manifest?.supportsSidechain ? (
                <label className={styles.settingRow}>
                  <span>Sidechain</span>
                  <select
                    className={styles.select}
                    aria-label={`${instance.manifestSummary.name} Sidechain source`}
                    disabled={isPending || isRuntimeUnavailable}
                    value={instance.sidechainSourceTrackId ?? ''}
                    onChange={event => void handleSidechainChange(instance.id, event.currentTarget.value || null)}
                  >
                    <option value="">없음</option>
                    {[...tracks.values()]
                      .filter(track => track.id !== trackId)
                      .map(track => (
                        <option key={track.id} value={track.id}>
                          {track.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {manifest ? (
                manifest.parameters.map(definition => (
                  <PluginParameterControl
                    key={definition.id}
                    definition={definition}
                    instance={instance}
                    isDisabled={isPending || isRuntimeUnavailable}
                    onChange={(parameterId, value) =>
                      handleParameterChange({ instanceId: instance.id, parameterId, value })
                    }
                  />
                ))
              ) : (
                <span className={styles.emptyMessage}>Plugin runtime과 Parameter 정보를 찾을 수 없습니다.</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
