// Thin JSON client for the Cloud Function behind Firebase Hosting (same origin).
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; raw?: Blob; type?: string } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body !== undefined || opts.raw ? 'POST' : 'GET'),
    credentials: 'same-origin',
    headers: opts.raw
      ? { 'Content-Type': opts.type || 'application/octet-stream' }
      : opts.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : undefined,
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || 'Something went wrong. Please try again.', res.status);
  return data as T;
}
