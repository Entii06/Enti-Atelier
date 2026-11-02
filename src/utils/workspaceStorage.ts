type LegacyStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
type Entry = { key: string; raw: string | null; revision?: number };
const RECOVERY_KEY = 'atelier_workspace_pending_v1';

/** Synchronous React initializers read a snapshot hydrated before the app mounts. */
export class WorkspaceStorage {
  private snapshot = new Map<string, string>();
  private db: IDBDatabase | null = null;
  private queue: Promise<void> = Promise.resolve();
  private recovery = new Map<string, string | null>();
  private revisions = new Map<string, number>();
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private disconnect: (() => void) | undefined;
  fallback = false;

  constructor(
    private factory: IDBFactory | undefined,
    private legacy: LegacyStorage | undefined,
    private reportError: () => void = () => {},
    private name = 'atelier_workspace_v1',
  ) {}

  async initialize() {
    // Preserve the old localStorage values as a recovery copy after migration.
    try {
      for (let i = 0; i < (this.legacy?.length ?? 0); i++) {
        const key = this.legacy!.key(i);
        if (!key?.startsWith('atelier_') || key === RECOVERY_KEY) continue;
        const raw = this.legacy!.getItem(key);
        if (raw !== null) this.snapshot.set(key, raw);
      }
      const pending = JSON.parse(this.legacy?.getItem(RECOVERY_KEY) || '[]');
      if (Array.isArray(pending)) this.recovery = new Map(pending);
    } catch { /* IndexedDB can still work when localStorage is blocked. */ }
    const applyRecovery = () => {
      for (const [key, raw] of this.recovery) {
        if (raw === null) this.snapshot.delete(key);
        else this.snapshot.set(key, raw);
      }
    };
    applyRecovery();

    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        if (!this.factory) { reject(new Error('IndexedDB unavailable')); return; }
        const request = this.factory.open(this.name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('values', { keyPath: 'key' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
      });
      const stored = await new Promise<Entry[]>((resolve, reject) => {
        const tx = this.db!.transaction('values', 'readonly');
        const request = tx.objectStore('values').getAll();
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
      });
      // IndexedDB is authoritative, including explicit deletion tombstones.
      const storedKeys = new Set<string>();
      for (const entry of stored) {
        storedKeys.add(entry.key);
        this.revisions.set(entry.key, entry.revision ?? 0);
        if (entry.raw === null) this.snapshot.delete(entry.key);
        else this.snapshot.set(entry.key, entry.raw);
      }
      applyRecovery();
      const migrated = [...this.snapshot].filter(([key]) => !storedKeys.has(key));
      await this.write(migrated.map(([key, raw]) => ({ key, raw })), true);
      await this.write([...this.recovery].map(([key, raw]) => ({ key, raw })));
      // Another tab may have completed migration while this tab was opening.
      await this.refresh();
      try { this.legacy?.removeItem(RECOVERY_KEY); } catch { /* Replay is idempotent. */ }
      this.recovery.clear();
    } catch {
      this.fallback = true;
      this.db?.close();
      this.db = null;
    }
    this.connect();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private connect() {
    if (typeof window === 'undefined' || this.disconnect) return;
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.name);
      this.channel.onmessage = () => { void this.refresh(); };
    }
    const refresh = () => { void this.refresh(); };
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    this.disconnect = () => {
      this.channel?.close();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }

  private apply(entries: Entry[], broadcast = false) {
    let changed = false;
    for (const entry of entries) {
      const revision = entry.revision ?? 0;
      if (revision < (this.revisions.get(entry.key) ?? 0)) continue;
      changed ||= this.getItem(entry.key) !== entry.raw;
      this.revisions.set(entry.key, revision);
      if (entry.raw === null) this.snapshot.delete(entry.key);
      else this.snapshot.set(entry.key, entry.raw);
    }
    if (changed) this.listeners.forEach(listener => listener());
    if (broadcast) this.channel?.postMessage({ changed: true });
  }

  async refresh() {
    await this.queue;
    if (!this.db) {
      const entries: Entry[] = [];
      try {
        for (let i = 0; i < (this.legacy?.length ?? 0); i++) {
          const key = this.legacy!.key(i);
          if (key?.startsWith('atelier_') && key !== RECOVERY_KEY) {
            entries.push({ key, raw: this.legacy!.getItem(key), revision: this.revisions.get(key) ?? 0 });
          }
        }
        this.apply(entries);
      } catch { /* Storage can be blocked by browser settings. */ }
      return;
    }
    try {
      const entries = await new Promise<Entry[]>((resolve, reject) => {
        const tx = this.db!.transaction('values', 'readonly');
        const request = tx.objectStore('values').getAll();
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
      });
      this.apply(entries);
    } catch { /* A local pending write still reports persistent storage errors. */ }
  }

  async exportValues() {
    await this.flush();
    await this.refresh();
    return Object.fromEntries(this.snapshot);
  }

  /** The updater runs against the latest value inside a serialized IDB transaction. */
  updateJSON<T>(key: string, fallback: T, update: (current: T) => T): Promise<T> {
    const parse = (raw: string | null | undefined): T => {
      try { return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; }
    };
    const operation = this.queue.then(async () => {
      if (this.db && !this.fallback) {
        const entry = await new Promise<Entry>((resolve, reject) => {
          const tx = this.db!.transaction('values', 'readwrite');
          const store = tx.objectStore('values');
          const request = store.get(key);
          let next: Entry;
          request.onsuccess = () => {
            try {
              const previous = request.result as Entry | undefined;
              next = { key, raw: JSON.stringify(update(parse(previous?.raw))), revision: (previous?.revision ?? 0) + 1 };
              store.put(next);
            } catch (error) { tx.abort(); reject(error); }
          };
          tx.oncomplete = () => resolve(next!);
          tx.onabort = () => reject(tx.error || new Error('Workspace update failed'));
        });
        this.apply([entry], true);
        return parse(entry.raw);
      }
      const updateFallback = async () => {
        const latest = this.legacy?.getItem(key) ?? this.getItem(key);
        const next = update(parse(latest));
        const raw = JSON.stringify(next);
        this.apply([{ key, raw, revision: (this.revisions.get(key) ?? 0) + 1 }], true);
        if (!this.legacy) throw new Error('No persistent storage available');
        this.recovery.set(key, raw);
        this.legacy.setItem(RECOVERY_KEY, JSON.stringify([...this.recovery]));
        this.legacy.setItem(key, raw);
        return next;
      };
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request(`${this.name}:fallback`, updateFallback);
      }
      return updateFallback();
    });
    this.queue = operation.then(() => {}, () => {});
    return operation.catch(error => { this.reportError(); throw error; });
  }

  getItem(key: string) { return this.snapshot.get(key) ?? null; }

  setItem(key: string, raw: string) {
    this.snapshot.set(key, raw);
    this.enqueue({ key, raw });
  }

  removeItem(key: string) {
    this.snapshot.delete(key);
    // A tombstone prevents an old localStorage copy from returning on next load.
    this.enqueue({ key, raw: null });
  }

  private write(entries: Array<{ key: string; raw: string | null }>, onlyMissing = false) {
    if (!entries.length) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('IndexedDB unavailable')); return; }
      const tx = this.db.transaction('values', 'readwrite');
      const store = tx.objectStore('values');
      const committed: Entry[] = [];
      for (const entry of entries) {
        const request = store.get(entry.key);
        request.onsuccess = () => {
          if (onlyMissing && request.result !== undefined) {
            committed.push(request.result);
            return;
          }
          const next = { ...entry, revision: (request.result?.revision ?? 0) + 1 };
          store.put(next);
          committed.push(next);
        };
      }
      tx.oncomplete = () => { this.apply(committed, true); resolve(); };
      tx.onabort = () => reject(tx.error);
    });
  }

  private enqueue(entry: { key: string; raw: string | null }) {
    this.queue = this.queue.then(async () => {
      try {
        if (!this.fallback) { await this.write([entry]); return; }
        throw new Error('Using localStorage fallback');
      } catch {
        this.fallback = true;
        try {
          if (!this.legacy) throw new Error('No persistent storage available');
          this.recovery.set(entry.key, entry.raw);
          this.legacy.setItem(RECOVERY_KEY, JSON.stringify([...this.recovery]));
          if (entry.raw === null) this.legacy.removeItem(entry.key);
          else this.legacy.setItem(entry.key, entry.raw);
        } catch { this.reportError(); }
      }
    });
  }

  async flush() { await this.queue; }
  close() { this.disconnect?.(); this.disconnect = undefined; this.db?.close(); }
}

function legacyStorage() {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; }
  catch { return undefined; }
}

export const workspaceStorage = new WorkspaceStorage(
  typeof indexedDB === 'undefined' ? undefined : indexedDB,
  legacyStorage(),
  () => window.dispatchEvent(new Event('atelier-storage-error')),
);
