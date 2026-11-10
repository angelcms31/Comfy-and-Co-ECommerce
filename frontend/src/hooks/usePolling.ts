import { useEffect, useRef } from 'react';

// runs `tick` every `ms` while `enabled`, skipping while the browser tab is hidden. Used by the chat to pick up new messages.
export function usePolling(tick: () => void, ms: number, enabled = true) {
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  }, [tick]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') latest.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, enabled]);
}
