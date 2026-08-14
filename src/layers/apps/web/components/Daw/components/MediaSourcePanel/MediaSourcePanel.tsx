import { useEffect, useRef, useState } from 'react';
import { useCommandExecutor, useMediaSourceQuery, useSession } from '@/layers/apps/web/context/layer-hooks';
import type { MediaSourceState } from '@/layers/queries/media-source-query';
import { AudioCommandType } from '@/types/audioCommand.schema';
import * as styles from './MediaSourcePanel.css.ts';

const BYTES_PER_KIBIBYTE = 1_024;
const BYTES_PER_MEBIBYTE = BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;

function formatByteLength(byteLength: number): string {
  if (byteLength >= BYTES_PER_MEBIBYTE) {
    return `${(byteLength / BYTES_PER_MEBIBYTE).toFixed(1)} MiB`;
  }
  return `${(byteLength / BYTES_PER_KIBIBYTE).toFixed(1)} KiB`;
}

function formatDuration(durationSeconds: number | null): string {
  return durationSeconds === null ? '길이 미확인' : `${durationSeconds.toFixed(2)}초`;
}

function parseTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    ),
  ];
}

function isCleanupResult(result: unknown): result is { readonly removedSourceIds: readonly string[] } {
  return typeof result === 'object' && result !== null && 'removedSourceIds' in result;
}

export function MediaSourcePanel() {
  const commandExecutor = useCommandExecutor();
  const mediaSourceQuery = useMediaSourceQuery();
  useSession(state => state.project.revision);
  const [searchText, setSearchText] = useState('');
  const [, setRefreshToken] = useState(0);
  const [auditionSourceId, setAuditionSourceId] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const auditionSourceIdRef = useRef<string | null>(null);
  const sources = mediaSourceQuery.readSources();
  const normalizedSearchText = searchText.trim().toLocaleLowerCase();
  const filteredSources = sources.filter(source => {
    if (normalizedSearchText.length === 0) {
      return true;
    }
    return [source.fileName, ...source.tags].some(value => value.toLocaleLowerCase().includes(normalizedSearchText));
  });
  const unusedSourceCount = sources.filter(source => !source.isInUse).length;

  useEffect(
    () => () => {
      if (auditionSourceIdRef.current !== null) {
        void commandExecutor.execute({ type: AudioCommandType.STOP_SOURCE_AUDITION }).catch(() => undefined);
      }
    },
    [commandExecutor]
  );

  const setAuditionState = (sourceId: string | null) => {
    auditionSourceIdRef.current = sourceId;
    setAuditionSourceId(sourceId);
  };

  const handleAudition = async (source: MediaSourceState) => {
    setErrorMessage(null);
    try {
      if (auditionSourceId === source.id) {
        await commandExecutor.execute({ type: AudioCommandType.STOP_SOURCE_AUDITION });
        setAuditionState(null);
        return;
      }
      await commandExecutor.execute({ type: AudioCommandType.AUDITION_SOURCE, sourceId: source.id });
      setAuditionState(source.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleTagsChange = async (sourceId: string, tags: readonly string[]) => {
    setErrorMessage(null);
    try {
      await commandExecutor.execute({ type: AudioCommandType.SET_SOURCE_TAGS, sourceId, tags: [...tags] });
      setRefreshToken(current => current + 1);
      setMessage('Source 태그를 저장했습니다.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCleanup = async () => {
    if (unusedSourceCount === 0 || isCleaning) {
      return;
    }
    setErrorMessage(null);
    setMessage(null);
    setIsCleaning(true);
    try {
      const result = await commandExecutor.execute({ type: AudioCommandType.CLEANUP_UNUSED_SOURCES });
      const removedCount = isCleanupResult(result) ? result.removedSourceIds.length : 0;
      setRefreshToken(current => current + 1);
      setMessage(`${removedCount}개 Source를 정리했습니다.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <section aria-label="Source 관리" className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>MEDIA SOURCES</h1>
          <span className={styles.metadata}>
            전체 {sources.length}개 · 사용 중 {sources.length - unusedSourceCount}개 · 미사용 {unusedSourceCount}개
          </span>
        </div>
        <div className={styles.headerActions}>
          <input
            aria-label="Source 검색"
            className={styles.searchInput}
            onChange={event => setSearchText(event.currentTarget.value)}
            placeholder="파일명 또는 태그 검색"
            type="search"
            value={searchText}
          />
          <button
            aria-label={`미사용 Source ${unusedSourceCount}개 정리`}
            className={styles.actionButton}
            disabled={unusedSourceCount === 0 || isCleaning}
            onClick={() => void handleCleanup()}
            type="button"
          >
            {isCleaning ? '정리 중' : `미사용 ${unusedSourceCount}개 정리`}
          </button>
        </div>
      </div>

      {message ? (
        <p className={styles.status} role="status">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {filteredSources.length === 0 ? (
        <p className={styles.emptyState}>조건에 맞는 Source가 없습니다.</p>
      ) : (
        <div className={styles.list}>
          {filteredSources.map(source => (
            <SourceCard
              auditionSourceId={auditionSourceId}
              key={source.id}
              onAudition={handleAudition}
              onTagsChange={handleTagsChange}
              source={source}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface SourceCardProps {
  readonly auditionSourceId: string | null;
  readonly onAudition: (source: MediaSourceState) => Promise<void>;
  readonly onTagsChange: (sourceId: string, tags: readonly string[]) => Promise<void>;
  readonly source: MediaSourceState;
}

function SourceCard({ auditionSourceId, onAudition, onTagsChange, source }: SourceCardProps) {
  const [tagText, setTagText] = useState(source.tags.join(', '));
  const isAuditioning = auditionSourceId === source.id;
  const derivation = source.derivation;

  useEffect(() => setTagText(source.tags.join(', ')), [source.tags]);

  return (
    <article
      aria-label={`${source.fileName} Source`}
      className={styles.card}
      data-derivation={derivation?.operation ?? 'original'}
      data-in-use={source.isInUse}
      data-source-id={source.id}
    >
      <div className={styles.cardHeader}>
        <strong>{source.fileName}</strong>
        <span className={styles.codecBadge}>{source.codec.toUpperCase()}</span>
        <span className={styles.statusBadge}>{source.isInUse ? '사용 중' : '미사용'}</span>
      </div>
      <dl className={styles.details}>
        <div>
          <dt>재생 지원</dt>
          <dd>{source.codecSupport || '미확인'}</dd>
        </div>
        <div>
          <dt>길이</dt>
          <dd>{formatDuration(source.durationSeconds)}</dd>
        </div>
        <div>
          <dt>크기</dt>
          <dd>{formatByteLength(source.byteLength)}</dd>
        </div>
        <div>
          <dt>참조</dt>
          <dd>{source.regionIds.length + source.loopSlotIds.length}개</dd>
        </div>
      </dl>
      {derivation ? (
        <p className={styles.metadata}>
          파생 처리: {derivation.operation} · 원본 {derivation.sourceId.slice(0, 8)}
        </p>
      ) : (
        <p className={styles.metadata}>원본 Source</p>
      )}
      {source.transientPositionsSeconds.length > 0 ? (
        <p className={styles.metadata}>Transient {source.transientPositionsSeconds.length}개</p>
      ) : null}
      {source.bwfMetadata ? (
        <p className={styles.metadata}>
          BWF: {source.bwfMetadata.description || '설명 없음'} · {source.bwfMetadata.originator || '제작자 미확인'} ·{' '}
          {source.bwfMetadata.originationDate || '날짜 미확인'}
        </p>
      ) : null}
      <div className={styles.tagActions}>
        <label className={styles.field}>
          <span>TAG</span>
          <input
            aria-label={`${source.fileName} 태그`}
            className={styles.tagInput}
            onChange={event => setTagText(event.currentTarget.value)}
            placeholder="쉼표로 구분"
            type="text"
            value={tagText}
          />
        </label>
        <button
          aria-label={`${source.fileName} 태그 저장`}
          className={styles.actionButton}
          onClick={() => void onTagsChange(source.id, parseTags(tagText))}
          type="button"
        >
          저장
        </button>
        <button
          aria-label={`${source.fileName} ${isAuditioning ? '미리듣기 중지' : '미리듣기'}`}
          aria-pressed={isAuditioning}
          className={`${styles.actionButton} ${isAuditioning ? styles.primaryAction : ''}`}
          onClick={() => void onAudition(source)}
          type="button"
        >
          {isAuditioning ? 'STOP' : 'AUDITION'}
        </button>
      </div>
    </article>
  );
}
