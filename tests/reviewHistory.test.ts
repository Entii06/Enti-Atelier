import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RecallGrade } from '../src/types.ts';
import { loadReviewHistory, mergeReviewHistory, saveReviewHistory } from '../src/utils/reviewHistory.ts';

test('migration and subsequent writes retain over 500 logs and deduplicate safely', async () => {
  const logs = Array.from({ length: 650 }, (_, i) => ({
    id: `review-${i}`, cardId: 'card', word: 'test', grade: RecallGrade.GOOD,
    reviewedAt: 1000 + i, newInterval: 1,
  }));
  await saveReviewHistory(logs);
  const stored = await loadReviewHistory();
  assert.equal(stored.length, 650);
  const duringHydration = { ...logs[0], id: 'new-review', reviewedAt: 9999 };
  const merged = mergeReviewHistory(stored, logs.slice(0, 500), [duringHydration]);
  assert.equal(merged.length, 651);
  assert.equal(merged[0].id, 'new-review');
  await saveReviewHistory([duringHydration]);
  assert.equal((await loadReviewHistory()).length, 651);
  await saveReviewHistory([duringHydration]);
  assert.equal((await loadReviewHistory()).length, 651, 'retrying cannot duplicate a review');
});
