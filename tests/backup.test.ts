import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARDS_KEY, createBackup, mergeCards, mergePuzzle, parseBackup, restoreBackup } from '../src/utils/backup.ts';
import { workspaceStorage } from '../src/utils/workspaceStorage.ts';
import { loadReviewHistory } from '../src/utils/reviewHistory.ts';
import { loadCustomArtworksFromDB } from '../src/utils/artworkStorage.ts';
import type { ArtworkItem, ArtworkPuzzleState, VocabCard } from '../src/types';

const card = (id: string, reviewed: number | null = null): VocabCard => ({
  id, word: id, phonetic: '', meaning: 'test', partOfSpeech: 'noun', example: '',
  notes: '', paintingMotif: 'starry_night', repetitions: 1, easeFactor: 2.5,
  interval: 1, nextReviewAt: 123456, lastReviewedAt: reviewed, totalReviews: 1,
  lapses: 0, createdAt: 123,
  fsrs: { version: 'FSRS-6', stability: 1, difficulty: 5, state: 2, learningStep: 0 },
});
const backup = () => ({ format: 'enti-atelier-backup', version: 1, createdAt: new Date().toISOString(), workspace: { [CARDS_KEY]: [card('a')] }, reviews: [], artworks: [] });

test('backup validates the entire document, including settings and schedule numbers', () => {
  assert.equal(parseBackup(backup()).version, 1);
  for (const invalid of [
    { ...backup(), version: 9 },
    { ...backup(), reviews: [{ id: 'x', grade: 99 }] },
    { ...backup(), artworks: [{ id: 'x', imageSrc: 'javascript:alert(1)' }] },
    { ...backup(), workspace: { [CARDS_KEY]: [{ ...card('a'), interval: -1 }] } },
    { ...backup(), workspace: { [CARDS_KEY]: [card('a'), card('a')] } },
    { ...backup(), workspace: { [CARDS_KEY]: [], unrelated: 'value' } },
    { ...backup(), workspace: { [CARDS_KEY]: [], atelier_arles_timer_scale_v1: 999 } },
  ]) assert.throws(() => parseBackup(invalid));
  assert.doesNotThrow(() => parseBackup({ ...backup(), workspace: { [CARDS_KEY]: [], atelier_arles_timer_scale_v1: 150, atelier_arles_brightness_v1: 90 } }));
});

test('card restore preserves newer scheduling and is additive and idempotent', () => {
  const current = [card('a', 200), card('b', 100)];
  const incoming = [card('a', 100), card('b', 300), card('c')];
  const merged = mergeCards(current, incoming);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].lastReviewedAt, 200);
  assert.equal(merged[1].lastReviewedAt, 300);
  assert.deepEqual(mergeCards(merged, incoming), merged);
});

test('puzzle merge keeps earned dates and caps placements at earned pieces', () => {
  const current: ArtworkPuzzleState = { gridVersion: 2, loginDates: ['2026-11-01'], selectedArtworkId: 'a', placedByArtwork: { a: [{ pieceIndex: 0, placedDate: '2026-11-01', placedAt: 1 }] }, lastPlacedPiece: null, showGridLines: true, showUnderdrawing: true };
  const incoming = { ...current, placedByArtwork: { b: [{ pieceIndex: 0, placedDate: '2026-11-01', placedAt: 2 }] } };
  const merged = mergePuzzle(current, incoming);
  assert.deepEqual(merged.loginDates, current.loginDates);
  assert.equal(Object.values(merged.placedByArtwork).flat().length, 1);
  assert.equal(merged.placedByArtwork.a.length, 1);
  assert.deepEqual(mergePuzzle(merged, incoming), merged);
  const twoArtworks = { ...current, loginDates: ['2026-11-01', '2026-11-02'], placedByArtwork: { a: current.placedByArtwork.a, b: incoming.placedByArtwork.b } };
  const conflict = { ...twoArtworks, placedByArtwork: { a: [...current.placedByArtwork.a, { pieceIndex: 1, placedDate: '2026-11-02', placedAt: 3 }] } };
  assert.equal(mergePuzzle(twoArtworks, conflict).placedByArtwork.b.length, 1, 'keep all current placements before allocating imported pieces');
});

test('complete backup round trip restores images, review history, FSRS and preferences', async () => {
  // Artwork storage's browser adapter uses window.indexedDB.
  const previousWindow = globalThis.window;
  const previousIndexedDB = globalThis.indexedDB;
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
  Object.assign(globalThis, { window: { indexedDB, dispatchEvent() {} } });
  // Avoid browser BroadcastChannel setup in this Node-only test.
  try {
    const artwork: ArtworkItem = { id: 'custom-backup', viTitle: 'test', originalTitle: '', locationYear: '', medium: '', accessionCode: '', quoteVi: '', quoteSource: '', imageSrc: 'data:image/png;base64,aGVsbG8=', imageScaleClass: '', fallbackBgClass: '', isDark: true, paletteKey: 'starry_night', isCustom: true };
    const file = parseBackup({ ...backup(), workspace: { [CARDS_KEY]: [card('a', 200)], atelier_arles_pomo_history_v1: [{ id: 'session', mode: 'focus', durationMinutes: 25, completedAt: 500, intention: 'test', paintingTheme: '' }], atelier_arles_timer_scale_v1: 125 }, artworks: [artwork], reviews: [{ id: 'backup-review', cardId: 'a', word: 'a', grade: 4, reviewedAt: 200, newInterval: 1 }] });
    // The singleton has no DB in Node; provide a persistent fallback for this round-trip test.
    const values = new Map<string, string>();
    Object.assign(workspaceStorage as any, { legacy: { get length() { return values.size; }, key: (i: number) => [...values.keys()][i], getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }, fallback: true });
    await restoreBackup(file, [card('existing')]);
    await restoreBackup(file, [card('existing')]);
    const exported = await createBackup([], []);
    assert.deepEqual((exported.workspace[CARDS_KEY] as VocabCard[]).map(c => c.id).sort(), ['a', 'existing']);
    assert.deepEqual((exported.workspace[CARDS_KEY] as VocabCard[]).find(c => c.id === 'a')?.fsrs, (file.workspace[CARDS_KEY] as VocabCard[])[0].fsrs);
    assert.equal(exported.workspace.atelier_arles_timer_scale_v1, 125);
    assert.equal((exported.workspace.atelier_arles_pomo_history_v1 as any[]).length, 1);
    assert.equal((await loadReviewHistory()).filter(r => r.id === 'backup-review').length, 1);
    assert.equal((await loadCustomArtworksFromDB(true)).find(a => a.id === artwork.id)?.imageSrc, artwork.imageSrc);
    assert.ok(exported.reviews.some(r => r.id === 'backup-review'));
  } finally {
    Object.assign(globalThis, { window: previousWindow, indexedDB: previousIndexedDB });
  }
});
