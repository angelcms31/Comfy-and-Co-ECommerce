import { useCallback, useEffect, useState, type DependencyList } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// runs a request when deps change and keeps loading / error / data together
export function useAsync<T>(request: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    request()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((err: unknown) => {
        if (active) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Something went wrong' });
      });
    return () => {
      active = false;
    };
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ data, loading: false, error: null }), []);

  return { ...state, reload, setData };
}
