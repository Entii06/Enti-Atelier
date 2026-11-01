import { useEffect, useRef, useState } from 'react';
import type { ReviewLogRecord } from '../types';
import { loadReviewHistory, mergeReviewHistory, saveReviewHistory } from '../utils/reviewHistory';

export function useReviewHistory(legacyKey: string) {
  const [logs, setLogs] = useState<ReviewLogRecord[]>(() => {
    try {
      const value = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  });
  const [storage, setStorage] = useState<'loading' | 'indexedDB' | 'localStorage'>('loading');
  const [error, setError] = useState<string | null>(null);
  const savedIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    loadReviewHistory().then(stored => {
      if (cancelled) return;
      savedIds.current = new Set(stored.map(log => log.id));
      setLogs(current => mergeReviewHistory(stored, current));
      setStorage('indexedDB');
    }).catch(() => {
      if (!cancelled) setStorage('localStorage');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (storage === 'loading') return;
    const fallback = () => {
      try {
        localStorage.setItem(legacyKey, JSON.stringify(logs));
      } catch {
        setError('Không thể lưu lịch sử ôn tập. Hãy xuất bản sao dữ liệu trước khi đóng trang.');
      }
    };
    if (storage === 'localStorage') { fallback(); return; }
    const pending = logs.filter(log => !savedIds.current.has(log.id));
    if (!pending.length) return;
    pending.forEach(log => savedIds.current.add(log.id));
    saveReviewHistory(pending).catch(() => {
      pending.forEach(log => savedIds.current.delete(log.id));
      fallback();
      setStorage('localStorage');
    });
    // Keep the legacy snapshot as a recovery copy; do not truncate stored history.
  }, [logs, storage, legacyKey]);

  return [logs, setLogs, error] as const;
}
