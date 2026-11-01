import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecallGrade } from '../src/types.ts';
import type { VocabCard } from '../src/types.ts';
import { isCardDue, nextDueRefreshDelay, normalizeSchedule, previewNextIntervalLabel, reviewCard } from '../src/utils/scheduler.ts';

const now = Date.UTC(2026, 10, 1, 10);
const day = 86_400_000;
const grades = [RecallGrade.AGAIN, RecallGrade.HARD, RecallGrade.GOOD, RecallGrade.EASY];
function card(overrides: Partial<VocabCard> = {}): VocabCard {
  return {
    id: 'card', word: 'test', meaning: 'test', phonetic: '', partOfSpeech: 'noun',
    example: '', notes: '', paintingMotif: '', repetitions: 0, easeFactor: 2.5,
    interval: 0, nextReviewAt: now, lastReviewedAt: null, totalReviews: 0,
    lapses: 0, createdAt: now - day, ...overrides,
  };
}

test('explicit rating mapping: new Again/Hard/Good/Easy have increasing delays', () => {
  const results = grades.map(grade => reviewCard(card(), grade, now));
  const delays = results.map(result => result.nextReviewAt - now);
  assert.ok(delays.every(delay => delay > 0));
  assert.ok(delays.every((delay, i) => i === 0 || delay >= delays[i - 1]));
  assert.equal(results[0].nextReviewAt, now + 60_000);
  assert.equal(results[2].nextReviewAt, now + 10 * 60_000);
  assert.equal(results[0].lapses, 0, 'failing a new card is not a review lapse');
  assert.equal(results[3].fsrs?.state, 2);
  assert.equal(results[2].fsrs?.version, 'FSRS-6');
});

test('learning graduates, failed review relearns in 10 minutes and preserves identity', () => {
  let current = reviewCard(card(), RecallGrade.GOOD, now);
  current = reviewCard(current, RecallGrade.GOOD, current.nextReviewAt);
  assert.equal(current.fsrs?.state, 2);
  assert.ok(current.interval >= 1);
  const failedAt = current.nextReviewAt;
  const failed = reviewCard(current, RecallGrade.AGAIN, failedAt);
  assert.equal(failed.fsrs?.state, 3);
  assert.equal(failed.nextReviewAt, failedAt + 600_000);
  assert.equal(failed.lapses, current.lapses + 1);
  assert.equal(failed.totalReviews, current.totalReviews + 1);
  assert.equal(failed.id, current.id);
  const relearned = reviewCard(failed, RecallGrade.GOOD, failed.nextReviewAt);
  assert.equal(relearned.fsrs?.state, 2);
  assert.ok(relearned.nextReviewAt > failed.nextReviewAt);
});

test('legacy migration preserves due dates, content and counters on load', () => {
  const old = card({ repetitions: 5, totalReviews: 10, interval: 30, lapses: 2,
    nextReviewAt: now + 20 * day, lastReviewedAt: now - 10 * day });
  assert.deepEqual(normalizeSchedule(old, now), { ...old, fsrs: undefined });
  const reviewed = reviewCard(old, RecallGrade.GOOD, old.nextReviewAt);
  assert.equal(reviewed.fsrs?.estimatedFromLegacy, true);
  assert.equal(reviewed.totalReviews, 11);
  assert.equal(reviewed.lapses, 2);
  assert.ok(reviewed.fsrs!.stability > 0);
  assert.equal(reviewed.word, old.word);
  assert.equal(old.fsrs, undefined, 'review must not mutate input');
});

test('practice does not change schedule, counters or memory for any grade', () => {
  const old = reviewCard(card(), RecallGrade.EASY, now);
  for (const grade of grades) {
    let practiced = old;
    for (let i = 0; i < 10; i++) practiced = reviewCard(practiced, grade, now, true);
    assert.deepEqual(practiced, old);
  }
});

test('preview matches actual scheduling and is pure', () => {
  const input = card();
  const snapshot = JSON.stringify(input);
  assert.equal(previewNextIntervalLabel(input, RecallGrade.GOOD, now), '10 phút');
  assert.equal(previewNextIntervalLabel(input, RecallGrade.AGAIN, now), '1 phút');
  assert.equal(JSON.stringify(input), snapshot);
});

test('due refresh wakes exactly at upcoming deadline, including after last card fails', () => {
  const failed = reviewCard(card(), RecallGrade.AGAIN, now);
  assert.equal(isCardDue(failed, now), false);
  const almostDue = failed.nextReviewAt - 100;
  assert.equal(nextDueRefreshDelay([failed], almostDue), 100);
  assert.equal(isCardDue(failed, almostDue + 100), true);
  assert.equal(nextDueRefreshDelay([], now), 30_000);
});

test('persisted FSRS memory survives JSON serialization and gives the same next schedule', () => {
  const initial = reviewCard(card(), RecallGrade.EASY, now);
  const restored = normalizeSchedule(JSON.parse(JSON.stringify(initial)), initial.nextReviewAt);
  assert.deepEqual(reviewCard(restored, RecallGrade.GOOD, initial.nextReviewAt),
    reviewCard(initial, RecallGrade.GOOD, initial.nextReviewAt));
});

test('invalid imported values cannot poison FSRS or hide a card forever', () => {
  const invalid = card({ interval: -30, easeFactor: -2, nextReviewAt: Infinity,
    totalReviews: -4, repetitions: NaN, lapses: -3,
    fsrs: { version: 'FSRS-6', state: 2, stability: -10, difficulty: 100, learningStep: 0 } });
  const clean = normalizeSchedule(invalid, now);
  assert.equal(clean.interval, 0);
  assert.equal(clean.easeFactor, 1.3);
  assert.equal(clean.nextReviewAt, now);
  assert.equal(clean.fsrs, undefined);
  for (const grade of grades) {
    const next = reviewCard(clean, grade, now);
    assert.ok(Number.isFinite(next.nextReviewAt));
    assert.ok(next.nextReviewAt > now);
  }
});

test('early and overdue reviews use actual elapsed time; grade order stays monotonic', () => {
  let current = reviewCard(card(), RecallGrade.EASY, now);
  for (let i = 0; i < 10; i++) {
    const time = current.nextReviewAt + (i % 2 ? 10 * day : 0);
    const results = grades.map(grade => reviewCard(current, grade, time));
    assert.ok(results.every(result => Number.isFinite(result.nextReviewAt) && result.nextReviewAt > time));
    assert.ok(results.every((result, j) => j === 0 || result.nextReviewAt >= results[j - 1].nextReviewAt));
    current = results[2];
  }
});
