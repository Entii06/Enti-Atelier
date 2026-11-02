import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { SetStateAction } from 'react';
import { workspaceStorage } from '../utils/workspaceStorage';

/** Persist actions, not stale snapshots; subscribe to commits from every tab. */
export function useWorkspaceState<T>(key: string, initializer: T | (() => T), normalize?: (value: T) => T) {
  const [initial] = useState(initializer);
  const initialRaw = useRef(workspaceStorage.getItem(key));
  const normalizeRef = useRef(normalize);
  const raw = useSyncExternalStore(workspaceStorage.subscribe, () => workspaceStorage.getItem(key));
  const value = useMemo(() => {
    if (raw === initialRaw.current || raw === null) return initial;
    try {
      const parsed = JSON.parse(raw) as T;
      return normalizeRef.current ? normalizeRef.current(parsed) : parsed;
    } catch { return initial; }
  }, [raw, initial]);
  useEffect(() => {
    void workspaceStorage.updateJSON(key, initial, current => normalizeRef.current ? normalizeRef.current(current) : current).catch(() => {});
  }, [key, initial]);
  const setValue = useCallback((action: SetStateAction<T>) => {
    void workspaceStorage.updateJSON(key, initial, latest => {
      const current = normalizeRef.current ? normalizeRef.current(latest) : latest;
      return typeof action === 'function' ? (action as (value: T) => T)(current) : action;
    }).catch(() => { /* workspaceStorage reports the error to the app. */ });
  }, [key, initial]);
  return [value, setValue] as const;
}
