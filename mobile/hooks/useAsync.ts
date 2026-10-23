import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/** Loads data on screen focus with loading / error / refresh states. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const run = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading((l) => l && data === null);
    try { const r = await fn(); if (alive.current) { setData(r); setError(null); } }
    catch (e: any) { if (alive.current) setError(e?.message ?? 'Something went wrong'); }
    finally { if (alive.current) { setLoading(false); setRefreshing(false); } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useFocusEffect(useCallback(() => { run(); }, [run]));
  return { data, error, loading, refreshing, reload: () => run(true), retry: () => { setLoading(true); run(); } };
}
