type LegacyStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
type Entry = { key: string; raw: string | null };
const RECOVERY_KEY = 'atelier_workspace_pending_v1';

/** Synchronous React initializers read a snapshot hydrated before the app mounts. */
export class WorkspaceStorage {
  private snapshot = new Map<string, string>();
  private db: IDBDatabase | null = null;
  private queue: Promise<void> = Promise.resolve();
  private recovery = new Map<string, string | null>();
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
        if (entry.raw === null) this.snapshot.delete(entry.key);
        else this.snapshot.set(entry.key, entry.raw);
      }
      applyRecovery();
      const migrated = [...this.snapshot].filter(([key]) => !storedKeys.has(key));
      const writes = new Map<string, string | null>(migrated);
      for (const [key, raw] of this.recovery) writes.set(key, raw);
      await this.write([...writes].map(([key, raw]) => ({ key, raw })));
      try { this.legacy?.removeItem(RECOVERY_KEY); } catch { /* Replay is idempotent. */ }
      this.recovery.clear();
    } catch {
      this.fallback = true;
      this.db?.close();
      this.db = null;
    }
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

  private write(entries: Array<{ key: string; raw: string | null }>) {
    if (!entries.length) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      if (!this.db) { reject(new Error('IndexedDB unavailable')); return; }
      const tx = this.db.transaction('values', 'readwrite');
      for (const entry of entries) tx.objectStore('values').put(entry);
      tx.oncomplete = () => resolve();
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
  close() { this.db?.close(); }
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
