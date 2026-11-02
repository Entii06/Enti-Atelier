import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkspaceStorage } from '../src/utils/workspaceStorage.ts';

function legacyStorage() {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
}

test('hydrate before render, migrate legacy data and prefer newer IndexedDB on reload', async () => {
  const legacy = legacyStorage();
  const key = 'atelier_arles_cards_v1';
  legacy.setItem(key, '[{"word":"legacy"}]');
  legacy.setItem('unrelated', 'private');
  const storage = new WorkspaceStorage(indexedDB, legacy, undefined, 'migration-test');
  await storage.initialize();
  assert.equal(storage.getItem(key), '[{"word":"legacy"}]');
  assert.equal(storage.getItem('unrelated'), null);
  storage.setItem(key, '[{"word":"first"}]');
  storage.setItem(key, '[{"word":"latest"}]');
  await storage.flush();
  storage.close();
  const reloaded = new WorkspaceStorage(indexedDB, legacy, undefined, 'migration-test');
  await reloaded.initialize();
  assert.equal(reloaded.getItem(key), '[{"word":"latest"}]');
  assert.equal(legacy.getItem(key), '[{"word":"legacy"}]', 'retain original recovery copy');
  reloaded.close();
});

test('deleted preferences stay deleted despite an old localStorage recovery copy', async () => {
  const legacy = legacyStorage();
  const key = 'atelier_arles_timer_offset_v1';
  legacy.setItem(key, '{"x":10,"y":20}');
  const storage = new WorkspaceStorage(indexedDB, legacy, undefined, 'delete-test');
  await storage.initialize();
  storage.removeItem(key);
  await storage.flush();
  storage.close();
  const reloaded = new WorkspaceStorage(indexedDB, legacy, undefined, 'delete-test');
  await reloaded.initialize();
  assert.equal(reloaded.getItem(key), null);
  reloaded.close();
});

test('fallback journal recovers latest values and deletions when IndexedDB returns', async () => {
  const legacy = legacyStorage();
  const key = 'atelier_arles_cards_v1';
  legacy.setItem(key, 'old');
  const initial = new WorkspaceStorage(indexedDB, legacy, undefined, 'recovery-test');
  await initial.initialize();
  initial.close();
  const fallback = new WorkspaceStorage(undefined, legacy, undefined, 'recovery-test');
  await fallback.initialize();
  assert.equal(fallback.fallback, true);
  fallback.setItem(key, 'new');
  fallback.setItem('atelier_arles_theme_v1', 'theme');
  fallback.removeItem('atelier_arles_theme_v1');
  await fallback.flush();
  const recovered = new WorkspaceStorage(indexedDB, legacy, undefined, 'recovery-test');
  await recovered.initialize();
  assert.equal(recovered.getItem(key), 'new');
  assert.equal(recovered.getItem('atelier_arles_theme_v1'), null);
  assert.equal(legacy.getItem('atelier_workspace_pending_v1'), null);
  recovered.close();
});

test('unavailable storage reports failure instead of silently losing new data', async () => {
  let errors = 0;
  const storage = new WorkspaceStorage(undefined, undefined, () => { errors++; });
  await storage.initialize();
  storage.setItem('atelier_arles_cards_v1', 'new');
  await storage.flush();
  assert.equal(errors, 1);
  assert.equal(storage.getItem('atelier_arles_cards_v1'), 'new');
});

test('two stale tabs add, edit and delete against the latest committed collection', async () => {
  const a = new WorkspaceStorage(indexedDB, undefined, undefined, 'concurrent-tabs');
  const b = new WorkspaceStorage(indexedDB, undefined, undefined, 'concurrent-tabs');
  await a.initialize();
  await b.initialize();
  type Card = { id: string; meaning: string; reviews: number };
  const key = 'atelier_arles_cards_v1';
  const initial: Card[] = [{ id: 'a', meaning: 'old', reviews: 0 }];
  await a.updateJSON(key, initial, current => current);
  await b.refresh();
  await Promise.all([
    a.updateJSON(key, initial, current => [...current, { id: 'b', meaning: 'B', reviews: 0 }]),
    b.updateJSON(key, initial, current => [...current, { id: 'c', meaning: 'C', reviews: 0 }]),
  ]);
  await Promise.all([
    a.updateJSON(key, initial, current => current.map(c => c.id === 'a' ? { ...c, meaning: 'new' } : c)),
    b.updateJSON(key, initial, current => current.map(c => c.id === 'a' ? { ...c, reviews: c.reviews + 1 } : c)),
  ]);
  await a.updateJSON(key, initial, current => current.filter(c => c.id !== 'b'));
  // b still has an older snapshot, but its next action cannot resurrect b.
  await b.updateJSON(key, initial, current => [...current, { id: 'd', meaning: 'D', reviews: 0 }]);
  let notifications = 0;
  const unsubscribe = a.subscribe(() => notifications++);
  await a.refresh();
  const result = JSON.parse(a.getItem(key)!);
  assert.deepEqual(result.map((c: Card) => c.id).sort(), ['a', 'c', 'd']);
  assert.deepEqual(result[0], { id: 'a', meaning: 'new', reviews: 1 });
  assert.equal(notifications, 1);
  unsubscribe(); a.close(); b.close();
});

test('failed updater aborts and does not poison subsequent queued actions', async () => {
  const storage = new WorkspaceStorage(indexedDB, undefined, () => {}, 'abort-update');
  await storage.initialize();
  await storage.updateJSON('count', 0, () => 1);
  await assert.rejects(storage.updateJSON('count', 0, () => { throw new Error('bad action'); }));
  assert.equal(storage.getItem('count'), '1');
  await storage.updateJSON('count', 0, n => n + 1);
  assert.equal(storage.getItem('count'), '2');
  storage.close();
});

test('fallback updates read latest persisted values rather than a stale tab snapshot', async () => {
  const legacy = legacyStorage();
  const a = new WorkspaceStorage(undefined, legacy);
  const b = new WorkspaceStorage(undefined, legacy);
  await a.initialize(); await b.initialize();
  await a.updateJSON('atelier_count', 0, n => n + 1);
  await b.updateJSON('atelier_count', 0, n => n + 1);
  await a.refresh();
  assert.equal(a.getItem('atelier_count'), '2');
});

test('a committed write automatically refreshes another tab through BroadcastChannel', async () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  Object.assign(globalThis, { window: new EventTarget(), document: new EventTarget() });
  const a = new WorkspaceStorage(indexedDB, undefined, undefined, 'broadcast-tabs');
  const b = new WorkspaceStorage(indexedDB, undefined, undefined, 'broadcast-tabs');
  try {
    await a.initialize(); await b.initialize();
    let unsubscribe = () => {};
    const changed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Other tab was not refreshed')), 2000);
      unsubscribe = b.subscribe(() => {
        if (b.getItem('atelier_count') === '1') { clearTimeout(timeout); resolve(); }
      });
    });
    await a.updateJSON('atelier_count', 0, n => n + 1);
    await changed;
    unsubscribe();
    assert.equal(b.getItem('atelier_count'), '1');
  } finally {
    a.close(); b.close();
    Object.assign(globalThis, { window: previousWindow, document: previousDocument });
  }
});
