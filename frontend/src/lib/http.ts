import { getSavedSession } from './session';

// FastAPI url, set VITE_API_URL in frontend/.env to change it
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

type Params = Record<string, string | number | boolean | undefined | null>;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function http<T>(path: string, opts: { method?: string; params?: Params; body?: unknown } = {}): Promise<T> {
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(opts.params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const token = getSavedSession()?.access_token;
  // files are sent as FormData, the browser sets that Content-Type itself
  const isForm = opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    throw new HttpError(0, "Can't reach the server right now. Please try again later.");
  }

  if (!res.ok) {
    // FastAPI puts error messages in "detail" (a list when validation fails)
    const data = await res.json().catch(() => null);
    const detail = typeof data?.detail === 'string' ? data.detail : Array.isArray(data?.detail) ? data.detail[0]?.msg : res.statusText;
    throw new HttpError(res.status, detail || 'Request failed');
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
