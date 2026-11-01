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
