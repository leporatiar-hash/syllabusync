import { API_URL, APP_VERSION } from './config';

/** -1 if a < b, 0 if equal, 1 if a > b, for dotted numeric versions like "1.2.10". */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Reads GET /app/config. Fails open: if the request fails, the app is allowed to run. */
export async function checkForcedUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/app/config`);
    if (!res.ok) return false;
    const { min_supported_version } = await res.json();
    return compareVersions(APP_VERSION, min_supported_version) < 0;
  } catch {
    return false;
  }
}
