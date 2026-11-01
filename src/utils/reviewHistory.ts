import type { ReviewLogRecord } from '../types';

function openHistory(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('atelier_review_history_v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('reviews', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Review history database blocked'));
  });
}

export function mergeReviewHistory(...sources: ReviewLogRecord[][]) {
  return [...new Map(sources.flat().map(log => [log.id, log])).values()]
    .sort((a, b) => b.reviewedAt - a.reviewedAt);
}

export async function loadReviewHistory(): Promise<ReviewLogRecord[]> {
  const db = await openHistory();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviews', 'readonly');
    const request = tx.objectStore('reviews').getAll();
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function saveReviewHistory(logs: ReviewLogRecord[]) {
  const db = await openHistory();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('reviews', 'readwrite');
    const store = tx.objectStore('reviews');
    for (const log of logs) store.put(log);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
