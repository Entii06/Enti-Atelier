import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUDIO_CACHE_TTL, DICTIONARY_CACHE_TTL, DictionaryCache, dictionaryCache } from '../src/utils/dictionaryCache.ts';
import { playDictionaryPronunciation, stopDictionaryPronunciation } from '../src/utils/audio.ts';

const suggestion = { source: 'cambridge' as const, phonetic: '/test/', meaning: 'kiểm tra', example: 'A test.' };
const audio = () => new Blob([new Uint8Array(512)], { type: 'audio/mpeg' });

test('dictionary repeats normalize whitespace/case, reuse cache and isolate edits', async () => {
  const cache = new DictionaryCache(indexedDB, Date.now, 'dictionary-repeat-test');
  let calls = 0;
  const load = async () => { calls++; return { ...suggestion }; };
  await cache.lookup('  Take   OFF ', load);
  const second = await cache.lookup('take off', load);
  second!.meaning = 'changed by caller';
  assert.equal((await cache.lookup('TAKE OFF', load))!.meaning, suggestion.meaning);
  assert.equal(calls, 1);
  await cache.close();
});

test('dictionary survives a new cache instance and expires after 7 days', async () => {
  let now = 1_000_000;
  let calls = 0;
  const load = async () => { calls++; return { ...suggestion }; };
  const initial = new DictionaryCache(indexedDB, () => now, 'dictionary-reload-test');
  await initial.lookup('test', load);
  await initial.close();
  const reloaded = new DictionaryCache(indexedDB, () => now, 'dictionary-reload-test');
  now += DICTIONARY_CACHE_TTL - 1;
  await reloaded.lookup('test', load);
  assert.equal(calls, 1);
  now++;
  await reloaded.lookup('test', load);
  assert.equal(calls, 2);
  await reloaded.close();
});

test('incomplete fallback has a shorter lifetime so Vietnamese lookup can recover', async () => {
  let now = 100;
  let calls = 0;
  const cache = new DictionaryCache(indexedDB, () => now, 'dictionary-fallback-test');
  await cache.lookup('fallback', async () => ({ source: 'dictionary_fallback', phonetic: '/test/' }));
  now += 60 * 60 * 1000;
  const result = await cache.lookup('fallback', async () => { calls++; return { ...suggestion }; });
  assert.equal(calls, 1);
  assert.equal(result!.meaning, suggestion.meaning);
  await cache.close();
});

test('missing words and failed requests are never cached', async () => {
  const cache = new DictionaryCache(indexedDB, Date.now, 'dictionary-failure-test');
  let calls = 0;
  const missing = async () => { calls++; return null; };
  assert.equal(await cache.lookup('missing', missing), null);
  assert.equal(await cache.lookup('missing', missing), null);
  assert.equal(calls, 2);
  await assert.rejects(cache.lookup('offline', async () => { throw new Error('offline'); }), /offline/);
  assert.equal((await cache.lookup('offline', async () => ({ ...suggestion })))!.meaning, suggestion.meaning);
  await cache.close();
});

test('UK and US audio remain separate; URL ordering/case do not duplicate entries', async () => {
  const cache = new DictionaryCache(indexedDB, Date.now, 'audio-accent-test');
  let calls = 0;
  const load = async () => { calls++; return audio(); };
  await cache.pronunciation('/api/dictionary/audio?word=Beautiful&accent=uk', load);
  await cache.pronunciation('/api/dictionary/audio?accent=uk&word=beautiful', load);
  assert.equal(calls, 1);
  await cache.pronunciation('/api/dictionary/audio?word=beautiful&accent=us', load);
  assert.equal(calls, 2);
  await cache.close();
});

test('audio Blob persists across reloads and expires after 30 days', async () => {
  let now = 1_000;
  let calls = 0;
  const url = '/api/dictionary/audio?word=test&accent=uk';
  const load = async () => { calls++; return audio(); };
  const initial = new DictionaryCache(indexedDB, () => now, 'audio-reload-test');
  await initial.pronunciation(url, load);
  await initial.close();
  const reloaded = new DictionaryCache(indexedDB, () => now, 'audio-reload-test');
  const cached = await reloaded.pronunciation(url, load);
  assert.equal(cached!.type, 'audio/mpeg');
  assert.equal(cached!.size, 512);
  assert.equal(calls, 1);
  now += AUDIO_CACHE_TTL;
  await reloaded.pronunciation(url, load);
  assert.equal(calls, 2);
  await reloaded.close();
});

test('invalid and undecodable audio are not retained', async () => {
  const cache = new DictionaryCache(indexedDB, Date.now, 'audio-invalid-test');
  const url = '/api/dictionary/audio?word=bad&accent=uk';
  assert.equal(await cache.pronunciation(url, async () => new Blob(['error'], { type: 'text/html' })), null);
  let calls = 0;
  const load = async () => { calls++; return audio(); };
  await cache.pronunciation(url, load);
  await cache.forgetPronunciation(url);
  await cache.pronunciation(url, load);
  assert.equal(calls, 2);
  await cache.close();
});

test('cancelled requests neither load unnecessarily nor save a cancelled result', async () => {
  const cache = new DictionaryCache(indexedDB, Date.now, 'dictionary-abort-test');
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  assert.equal(await cache.lookup('test', async () => { calls++; return { ...suggestion }; }, controller.signal), null);
  assert.equal(calls, 0);
  const during = new AbortController();
  assert.equal(await cache.lookup('test', async () => { during.abort(); return { ...suggestion }; }, during.signal), null);
  await cache.lookup('test', async () => { calls++; return { ...suggestion }; });
  assert.equal(calls, 1);
  await cache.close();
});

test('unavailable IndexedDB still permits lookup and bounded in-memory reuse', async () => {
  const failingFactory = { open() { throw new Error('storage disabled'); } } as unknown as IDBFactory;
  const cache = new DictionaryCache(failingFactory);
  let calls = 0;
  const load = async () => { calls++; return { ...suggestion }; };
  await cache.lookup('test', load);
  await cache.lookup('test', load);
  assert.equal(calls, 1);
  await cache.close();
});

test('dictionary capacity evicts oldest unused entries while retaining a recent hit', async () => {
  let now = 0;
  const cache = new DictionaryCache(indexedDB, () => ++now, 'dictionary-capacity-test');
  for (let i = 0; i < 500; i++) await cache.lookup(`word-${i}`, async () => ({ ...suggestion }));
  await cache.lookup('word-0', async () => { throw new Error('recent word must hit'); });
  await cache.lookup('word-500', async () => ({ ...suggestion }));
  let refetches = 0;
  await cache.lookup('word-1', async () => { refetches++; return { ...suggestion }; });
  assert.equal(refetches, 1);
  await cache.lookup('word-0', async () => { throw new Error('recent word must still hit'); });
  await cache.close();
});

test('pronunciation player uses cached audio on a second click without fetching', async t => {
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  let played = 0;
  class FakeAudio {
    pause() {}
    async play() { played++; }
  }
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FakeAudio });
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return new Response(audio(), { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  try {
    await playDictionaryPronunciation('player-cache-test', 'uk');
    await playDictionaryPronunciation('player-cache-test', 'uk');
    assert.equal(played, 2);
    assert.equal(requests, 1);
  } finally {
    stopDictionaryPronunciation();
    await dictionaryCache.close();
    if (originalAudio) Object.defineProperty(globalThis, 'Audio', originalAudio);
    else Reflect.deleteProperty(globalThis, 'Audio');
  }
});
