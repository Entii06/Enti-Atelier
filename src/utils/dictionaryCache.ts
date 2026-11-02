import type { DictionarySuggestion } from './srs';

const DAY_MS = 86_400_000;
export const DICTIONARY_CACHE_TTL = 7 * DAY_MS;
export const AUDIO_CACHE_TTL = 30 * DAY_MS;
const FALLBACK_CACHE_TTL = 60 * 60 * 1000;
const LIMITS = {
  dictionary: { count: 500, bytes: 10 * 1024 * 1024 },
  audio: { count: 300, bytes: 50 * 1024 * 1024 },
};
type Kind = keyof typeof LIMITS;
interface Entry {
  key: string;
  kind: Kind;
  value: DictionarySuggestion | Blob;
  expiresAt: number;
  accessedAt: number;
  bytes: number;
}

export function normalizeDictionaryWord(word: string) {
  return word.trim().replace(/\s+/g, ' ').toLowerCase();
}

function validSuggestion(value: DictionarySuggestion | null): value is DictionarySuggestion {
  return Boolean(value && [value.meaning, value.phonetic, value.englishDefinition, value.example]
    .some(field => typeof field === 'string' && field.trim()));
}

function validAudio(value: Blob | null): value is Blob {
  return value instanceof Blob && value.size >= 256 && value.type.startsWith('audio/');
}

function pronunciationKey(endpoint: string) {
  const url = new URL(endpoint, 'https://local.invalid');
  const word = normalizeDictionaryWord(url.searchParams.get('word') || '');
  const accent = url.searchParams.get('accent') === 'uk' ? 'uk' : 'us';
  return `audio:v1:${accent}:${word}`;
}

/** A disposable cache, separate from vocabulary, FSRS progress and review history. */
export class DictionaryCache {
  private memory = new Map<string, Entry>();
  private database: Promise<IDBDatabase | null> | undefined;

  constructor(
    private factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
    private now: () => number = Date.now,
    private databaseName = 'atelier_dictionary_cache_v1',
  ) {}

  private open() {
    if (!this.database) {
      this.database = new Promise<IDBDatabase | null>(resolve => {
        if (!this.factory) { resolve(null); return; }
        let settled = false;
        const finish = (db: IDBDatabase | null) => {
          if (settled) { db?.close(); return; }
          settled = true;
          clearTimeout(timer);
          resolve(db);
        };
        // A blocked/disabled cache must not leave dictionary requests waiting.
        const timer = setTimeout(() => finish(null), 800);
        try {
          const request = this.factory.open(this.databaseName, 1);
          request.onupgradeneeded = () => request.result.createObjectStore('entries', { keyPath: 'key' });
          request.onerror = () => finish(null);
          request.onblocked = () => finish(null);
          request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => { db.close(); this.database = undefined; };
            finish(db);
          };
        } catch { finish(null); }
      });
    }
    return this.database;
  }

  private async transaction<T>(run: (store: IDBObjectStore, setResult: (result: T) => void) => void): Promise<T | undefined> {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise(resolve => {
      let tx: IDBTransaction | undefined;
      let result: T | undefined;
      const timer = setTimeout(() => {
        try { tx?.abort(); } catch { /* Already completed. */ }
        resolve(undefined);
      }, 800);
      const finish = (value: T | undefined) => { clearTimeout(timer); resolve(value); };
      try {
        tx = db.transaction('entries', 'readwrite');
        tx.oncomplete = () => finish(result);
        tx.onabort = () => finish(undefined);
        run(tx.objectStore('entries'), value => { result = value; });
      } catch { finish(undefined); }
    });
  }

  private evictions(entries: Entry[]) {
    const now = this.now();
    const removed = entries.filter(entry => entry.expiresAt <= now);
    for (const kind of ['dictionary', 'audio'] as const) {
      const fresh = entries.filter(entry => entry.kind === kind && entry.expiresAt > now)
        .sort((a, b) => a.accessedAt - b.accessedAt);
      let bytes = fresh.reduce((total, entry) => total + entry.bytes, 0);
      while (fresh.length > LIMITS[kind].count || bytes > LIMITS[kind].bytes) {
        const oldest = fresh.shift()!;
        removed.push(oldest);
        bytes -= oldest.bytes;
      }
    }
    return removed;
  }

  private async read<T extends Entry['value']>(key: string): Promise<T | null> {
    const memory = this.memory.get(key);
    if (memory && memory.expiresAt > this.now()) {
      memory.accessedAt = this.now();
      // Touch persistent LRU without delaying playback/lookup.
      void this.transaction(store => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) store.put({ ...request.result, accessedAt: this.now() });
        };
      });
      return memory.value as T;
    }
    this.memory.delete(key);
    const stored = await this.transaction<Entry | null>((store, setResult) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as Entry | undefined;
        if (!entry || entry.expiresAt <= this.now()) {
          if (entry) store.delete(key);
          setResult(null);
          return;
        }
        entry.accessedAt = this.now();
        store.put(entry);
        setResult(entry);
      };
    });
    if (!stored) return null;
    this.memory.set(key, stored);
    for (const entry of this.evictions([...this.memory.values()])) this.memory.delete(entry.key);
    return stored.value as T;
  }

  private async write(kind: Kind, key: string, value: Entry['value'], ttl: number) {
    try {
      const bytes = value instanceof Blob ? value.size : new Blob([JSON.stringify(value)]).size;
      // Large one-off audio can still play without occupying the cache.
      if (kind === 'audio' && bytes > 2 * 1024 * 1024) return;
      if (bytes > LIMITS[kind].bytes) return;
      const entry: Entry = { key, kind, value, bytes, accessedAt: this.now(), expiresAt: this.now() + ttl };
      this.memory.set(key, entry);
      for (const old of this.evictions([...this.memory.values()])) this.memory.delete(old.key);
      await this.transaction(store => {
        store.put(entry);
        const request = store.getAll();
        request.onsuccess = () => {
          for (const old of this.evictions(request.result)) store.delete(old.key);
        };
      });
    } catch { /* Caching is optional; never fail a successful lookup/playback. */ }
  }

  async lookup(
    word: string,
    load: () => Promise<DictionarySuggestion | null>,
    signal?: AbortSignal,
  ): Promise<DictionarySuggestion | null> {
    if (signal?.aborted) return null;
    const key = `dictionary:v1:${normalizeDictionaryWord(word)}`;
    const cached = await this.read<DictionarySuggestion>(key);
    if (signal?.aborted) return null;
    if (validSuggestion(cached)) return structuredClone(cached);
    const value = await load();
    if (signal?.aborted) return null;
    if (validSuggestion(value)) {
      const ttl = value.source === 'cambridge' && value.meaning?.trim()
        ? DICTIONARY_CACHE_TTL : FALLBACK_CACHE_TTL;
      // Callers may edit returned suggestions; keep the cached copy independent.
      await this.write('dictionary', key, structuredClone(value), ttl);
    }
    return value;
  }

  async pronunciation(endpoint: string, load: () => Promise<Blob | null>, signal?: AbortSignal): Promise<Blob | null> {
    if (signal?.aborted) return null;
    const key = pronunciationKey(endpoint);
    const cached = await this.read<Blob>(key);
    if (signal?.aborted) return null;
    if (validAudio(cached)) return cached;
    const value = await load();
    if (signal?.aborted) return null;
    if (!validAudio(value)) return null;
    await this.write('audio', key, value, AUDIO_CACHE_TTL);
    return value;
  }

  async forgetPronunciation(endpoint: string) {
    const key = pronunciationKey(endpoint);
    this.memory.delete(key);
    await this.transaction(store => { store.delete(key); });
  }

  async close() {
    (await this.database)?.close();
    this.database = undefined;
    this.memory.clear();
  }
}

export const dictionaryCache = new DictionaryCache();
