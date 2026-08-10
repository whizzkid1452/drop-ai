import * as Y from 'yjs';
import { readProjectDocumentSnapshot } from '../shared/types/project-document-reader';
import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';

const ROOT_MAP_NAME = 'project-document';
const COLLECTION_KIND_KEY = '__dropAiCrdtCollectionKind';
const COLLECTION_ITEMS_KEY = '__dropAiCrdtItems';
const COLLECTION_ORDER_KEY = '__dropAiCrdtOrder';
const KEYED_COLLECTION_KIND = 'keyed';
const SCALAR_COLLECTION_PATHS = new Set(['overdubSourceIds']);

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { readonly [key: string]: JsonValue };

interface ApplyProjectChangeRequest {
  readonly baseDocument: ProjectDocumentSnapshot;
  readonly nextDocument: ProjectDocumentSnapshot;
  readonly origin?: unknown;
}

export class ProjectCrdtDocument {
  readonly #document: Y.Doc;
  readonly #root: Y.Map<unknown>;

  private constructor(document: Y.Doc) {
    this.#document = document;
    this.#root = document.getMap(ROOT_MAP_NAME);
  }

  static create(initialDocument: ProjectDocumentSnapshot): ProjectCrdtDocument {
    const validatedDocument = readProjectDocumentSnapshot(initialDocument);
    const crdtDocument = new ProjectCrdtDocument(new Y.Doc());
    crdtDocument.#document.transact(() => {
      crdtDocument.#writeInitialObject(toJsonObject(validatedDocument));
    }, 'initial-project-document');
    return crdtDocument;
  }

  static fromUpdate(update: Uint8Array): ProjectCrdtDocument {
    const crdtDocument = new ProjectCrdtDocument(new Y.Doc());
    crdtDocument.applyUpdate(update);
    return crdtDocument;
  }

  applyProjectChange({ baseDocument, nextDocument, origin }: ApplyProjectChangeRequest): Uint8Array {
    const validatedBaseDocument = readProjectDocumentSnapshot(baseDocument);
    const validatedNextDocument = readProjectDocumentSnapshot(nextDocument);
    this.#assertSameProject(validatedBaseDocument, validatedNextDocument);

    const currentDocument = this.toProjectDocument();
    if (currentDocument.project.id !== validatedBaseDocument.project.id) {
      throw new Error('CRDT 문서와 변경 기준 문서의 프로젝트 ID가 다릅니다.');
    }

    const stateVector = Y.encodeStateVector(this.#document);
    this.#document.transact(() => {
      // base와 next의 차이만 쓰면 늦게 도착한 로컬 snapshot이 변경하지 않은 원격 필드를 덮어쓰지 않는다.
      applyObjectDiff({
        current: this.#root,
        before: toJsonObject(validatedBaseDocument),
        after: toJsonObject(validatedNextDocument),
        path: [],
      });
    }, origin);
    return Y.encodeStateAsUpdate(this.#document, stateVector);
  }

  applyUpdate(update: Uint8Array, origin?: unknown): void {
    Y.applyUpdate(this.#document, update, origin);
  }

  encodeStateAsUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.#document);
  }

  toProjectDocument(): ProjectDocumentSnapshot {
    return readProjectDocumentSnapshot(decodeMap(this.#root));
  }

  destroy(): void {
    this.#document.destroy();
  }

  #writeInitialObject(document: JsonObject): void {
    Object.entries(document).forEach(([key, value]) => {
      this.#root.set(key, createSharedValue(value, [key]));
    });
  }

  #assertSameProject(baseDocument: ProjectDocumentSnapshot, nextDocument: ProjectDocumentSnapshot): void {
    if (baseDocument.project.id !== nextDocument.project.id) {
      throw new Error('하나의 CRDT update에서 프로젝트 ID를 바꿀 수 없습니다.');
    }
  }
}

function applyObjectDiff({
  current,
  before,
  after,
  path,
}: {
  readonly current: Y.Map<unknown>;
  readonly before: JsonObject;
  readonly after: JsonObject;
  readonly path: readonly string[];
}): void {
  Object.keys(before).forEach(key => {
    if (!(key in after)) {
      current.delete(key);
    }
  });

  Object.entries(after).forEach(([key, afterValue]) => {
    const nextPath = [...path, key];
    if (!(key in before)) {
      current.set(key, createSharedValue(afterValue, nextPath));
      return;
    }

    const beforeValue = before[key];
    if (areJsonValuesEqual(beforeValue, afterValue)) {
      return;
    }

    applyValueDiff({ current, key, before: beforeValue, after: afterValue, path: nextPath });
  });
}

function applyValueDiff({
  current,
  key,
  before,
  after,
  path,
}: {
  readonly current: Y.Map<unknown>;
  readonly key: string;
  readonly before: JsonValue;
  readonly after: JsonValue;
  readonly path: readonly string[];
}): void {
  const currentValue = current.get(key);
  if (
    isJsonObject(before) &&
    isJsonObject(after) &&
    currentValue instanceof Y.Map &&
    !isKeyedCollection(currentValue)
  ) {
    applyObjectDiff({ current: currentValue, before, after, path });
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (isScalarCollectionPath(path) && currentValue instanceof Y.Array) {
      applyScalarArrayDiff(currentValue, before, after);
      return;
    }
    if (currentValue instanceof Y.Map && isKeyedCollection(currentValue)) {
      applyKeyedArrayDiff(currentValue, before, after, path);
      return;
    }
  }

  current.set(key, createSharedValue(after, path));
}

function applyKeyedArrayDiff(
  collection: Y.Map<unknown>,
  before: readonly JsonValue[],
  after: readonly JsonValue[],
  path: readonly string[]
): void {
  const beforeItems = createItemsById(before, path);
  const afterItems = createItemsById(after, path);
  const items = getCollectionItems(collection);
  const order = getCollectionOrder(collection);

  beforeItems.forEach((_item, id) => {
    if (!afterItems.has(id)) {
      items.delete(id);
    }
  });

  afterItems.forEach((afterItem, id) => {
    const beforeItem = beforeItems.get(id);
    if (!beforeItem) {
      items.set(id, createSharedValue(afterItem, [...path, id]));
      return;
    }
    if (areJsonValuesEqual(beforeItem, afterItem)) {
      return;
    }

    const currentItem = items.get(id);
    if (currentItem instanceof Y.Map && isJsonObject(beforeItem) && isJsonObject(afterItem)) {
      applyObjectDiff({ current: currentItem, before: beforeItem, after: afterItem, path: [...path, id] });
      return;
    }
    items.set(id, createSharedValue(afterItem, [...path, id]));
  });

  const beforeOrder = [...beforeItems.keys()];
  const afterOrder = [...afterItems.keys()];
  if (!areStringArraysEqual(beforeOrder, afterOrder)) {
    // 순서를 실제로 편집한 경우에만 Y.Array를 바꿔, 속성만 수정한 peer가 원격 순서 변경을 덮어쓰지 않게 한다.
    order.delete(0, order.length);
    order.push(afterOrder);
  }
}

function applyScalarArrayDiff(
  current: Y.Array<unknown>,
  before: readonly JsonValue[],
  after: readonly JsonValue[]
): void {
  const beforeKeys = new Set(before.map(createScalarKey));
  const afterKeys = new Set(after.map(createScalarKey));
  const removedKeys = new Set([...beforeKeys].filter(key => !afterKeys.has(key)));
  removeArrayValues(current, removedKeys, createScalarKey);

  after.forEach(value => {
    const valueKey = createScalarKey(value);
    if (!beforeKeys.has(valueKey)) {
      current.push([value]);
    }
  });
}

function createSharedValue(value: JsonValue, path: readonly string[]): unknown {
  if (Array.isArray(value)) {
    return isScalarCollectionPath(path) ? createScalarArray(value) : createKeyedCollection(value, path);
  }
  if (isJsonObject(value)) {
    const map = new Y.Map<unknown>();
    Object.entries(value).forEach(([key, childValue]) => {
      map.set(key, createSharedValue(childValue, [...path, key]));
    });
    return map;
  }
  return value;
}

function createKeyedCollection(values: readonly JsonValue[], path: readonly string[]): Y.Map<unknown> {
  const collection = new Y.Map<unknown>();
  const items = new Y.Map<unknown>();
  const order = new Y.Array<string>();
  const itemsById = createItemsById(values, path);
  itemsById.forEach((item, id) => {
    items.set(id, createSharedValue(item, [...path, id]));
  });
  order.push([...itemsById.keys()]);
  collection.set(COLLECTION_KIND_KEY, KEYED_COLLECTION_KIND);
  collection.set(COLLECTION_ITEMS_KEY, items);
  collection.set(COLLECTION_ORDER_KEY, order);
  return collection;
}

function createScalarArray(values: readonly JsonValue[]): Y.Array<unknown> {
  const array = new Y.Array<unknown>();
  array.push([...values]);
  return array;
}

function createItemsById(values: readonly JsonValue[], path: readonly string[]): Map<string, JsonObject> {
  const items = new Map<string, JsonObject>();
  values.forEach(value => {
    if (!isJsonObject(value) || typeof value.id !== 'string') {
      throw new Error(`CRDT keyed collection 항목에 ID가 없습니다: ${path.join('.')}`);
    }
    if (items.has(value.id)) {
      throw new Error(`CRDT keyed collection ID가 중복됐습니다: ${value.id}`);
    }
    items.set(value.id, value);
  });
  return items;
}

function getCollectionItems(collection: Y.Map<unknown>): Y.Map<unknown> {
  const items = collection.get(COLLECTION_ITEMS_KEY);
  if (!(items instanceof Y.Map)) {
    throw new Error('CRDT keyed collection items가 유효하지 않습니다.');
  }
  return items;
}

function getCollectionOrder(collection: Y.Map<unknown>): Y.Array<string> {
  const order = collection.get(COLLECTION_ORDER_KEY);
  if (!(order instanceof Y.Array)) {
    throw new Error('CRDT keyed collection order가 유효하지 않습니다.');
  }
  return order as Y.Array<string>;
}

function decodeMap(map: Y.Map<unknown>): JsonObject {
  const result: Record<string, JsonValue> = {};
  map.forEach((value, key) => {
    result[key] = decodeSharedValue(value);
  });
  return result;
}

function decodeSharedValue(value: unknown): JsonValue {
  if (value instanceof Y.Map) {
    return isKeyedCollection(value) ? decodeKeyedCollection(value) : decodeMap(value);
  }
  if (value instanceof Y.Array) {
    const seenValues = new Set<string>();
    return value.toArray().flatMap(item => {
      const decodedItem = decodeSharedValue(item);
      const itemKey = createScalarKey(decodedItem);
      if (seenValues.has(itemKey)) {
        return [];
      }
      seenValues.add(itemKey);
      return [decodedItem];
    });
  }
  if (isJsonPrimitive(value)) {
    return value;
  }
  throw new Error('CRDT 문서에 JSON으로 변환할 수 없는 값이 있습니다.');
}

function decodeKeyedCollection(collection: Y.Map<unknown>): JsonValue[] {
  const items = getCollectionItems(collection);
  const order = getCollectionOrder(collection).toArray();
  const orderedIds = [...new Set(order)].filter(id => items.has(id));
  const missingIds = [...items.keys()].filter(id => !orderedIds.includes(id)).sort();
  return [...orderedIds, ...missingIds].map(id => decodeSharedValue(items.get(id)));
}

function removeArrayValues<Value>(
  array: Y.Array<Value>,
  removedKeys: ReadonlySet<string>,
  createKey: (value: Value) => string = value => String(value)
): void {
  const values = array.toArray();
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (removedKeys.has(createKey(values[index]))) {
      array.delete(index, 1);
    }
  }
}

function isKeyedCollection(value: Y.Map<unknown>): boolean {
  return value.get(COLLECTION_KIND_KEY) === KEYED_COLLECTION_KIND;
}

function isScalarCollectionPath(path: readonly string[]): boolean {
  return SCALAR_COLLECTION_PATHS.has(path.at(-1) ?? '');
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return value === null || ['boolean', 'number', 'string'].includes(typeof value);
}

function areJsonValuesEqual(first: JsonValue, second: JsonValue): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function areStringArraysEqual(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function createScalarKey(value: unknown): string {
  return JSON.stringify(value);
}

function toJsonObject(value: ProjectDocumentSnapshot): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}
