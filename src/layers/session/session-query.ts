import type { SessionState, SessionStore } from './session';

type SessionActionKey = {
  [Key in keyof SessionState]: SessionState[Key] extends (...arguments_: never[]) => unknown ? Key : never;
}[keyof SessionState];

type ReadonlySessionValue<Value> =
  Value extends Map<infer Key, infer Entry>
    ? ReadonlyMap<Key, Entry>
    : Value extends Set<infer Entry>
      ? ReadonlySet<Entry>
      : Value extends Array<infer Entry>
        ? readonly Entry[]
        : Value;

export type SessionSnapshot = {
  readonly [Key in Exclude<keyof SessionState, SessionActionKey>]: ReadonlySessionValue<SessionState[Key]>;
};

export interface ISessionQuery {
  readonly getState: () => SessionSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}

function createSnapshot(state: SessionState): SessionSnapshot {
  const stateEntries = Object.entries(state)
    .filter(([, value]) => typeof value !== 'function')
    .map(([key, value]) => [key, cloneTopLevelCollection(value)]);

  return Object.freeze(Object.fromEntries(stateEntries)) as SessionSnapshot;
}

function cloneTopLevelCollection(value: unknown): unknown {
  if (value instanceof Map) {
    return new Map(value);
  }
  if (value instanceof Set) {
    return new Set(value);
  }
  if (Array.isArray(value)) {
    return [...value];
  }
  return value;
}

export function createSessionQuery(sessionStore: SessionStore): ISessionQuery {
  let sourceState = sessionStore.getState();
  let snapshot = createSnapshot(sourceState);

  return {
    getState: () => {
      const nextSourceState = sessionStore.getState();
      if (nextSourceState !== sourceState) {
        sourceState = nextSourceState;
        snapshot = createSnapshot(sourceState);
      }
      return snapshot;
    },
    subscribe: listener => sessionStore.subscribe(() => listener()),
  };
}
