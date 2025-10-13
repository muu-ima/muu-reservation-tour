export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

type FetchOptions = RequestInit & { json?: unknown };

export async function api(path: string, opts: FetchOptions = {}) {
  const url = `${API_BASE}${path}`;
  const { json, headers, ...rest } = opts;

  const init: RequestInit = {
    ...rest,
    headers: {
      'Accept': 'application/json',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    // セッション/サンクタム認証を使う場合のみ:
    // credentials: 'include',
  };

  const res = await fetch(url, json ? { ...init, body: JSON.stringify(json) } : init);

  if (!res.ok) {
    // 400系/500系を一箇所で拾う
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}
