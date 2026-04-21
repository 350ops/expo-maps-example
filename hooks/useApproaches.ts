import { useEffect, useState } from 'react';
import type { Resort } from '../data/resorts';
import { getApproaches } from '../services/flights';
import type { Trajectory } from '../services/flights/types';

type State = {
  data: Trajectory[] | null;
  loading: boolean;
  error: Error | null;
};

export function useApproaches(resort: Resort | null): State {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!resort) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    getApproaches(resort, 30)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err as Error });
      });
    return () => {
      cancelled = true;
    };
  }, [resort]);

  return state;
}
