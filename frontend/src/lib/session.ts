import type { Session } from '@/types/models';

const KEY = 'comfyco.session';

// "Remember me" keeps the session in localStorage, otherwise it's gone when the browser closes
export function getSavedSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session, remember = true) {
  clearSession();
  try {
    (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch {
    // storage blocked, the user just won't stay logged in
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
