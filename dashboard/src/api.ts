// Rutas relativas sin diagonal inicial: la app se publica en una subruta.
export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export const pct = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined ? '—' : `${(v * 100).toFixed(d)}%`;
export const num = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined ? '—' : v.toFixed(d);
export const signed = (v: number, d = 1, suffix = '') => `${v >= 0 ? '+' : ''}${v.toFixed(d)}${suffix}`;
export const signedPct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)} pp`;
