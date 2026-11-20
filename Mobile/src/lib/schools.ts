import { api } from './api';
import { API_URL } from './config';

// "Where do you go?" -> which LMS the school uses -> sign in there. Backend: Backend/schools.py.

export type School = { name: string; domain: string };
export type LmsProvider = 'brightspace' | 'canvas' | 'blackboard';
export type LmsOption = { provider: LmsProvider; host: string; name: string; source: string };

export const searchSchools = (q: string) => api<School[]>(`/schools/search?q=${encodeURIComponent(q)}`);
export const suggestSchool = () => api<{ school: School | null }>('/schools/suggest').then((r) => r.school);
export const identifyLms = (url: string) => api<LmsOption>('/schools/lms/identify', { method: 'POST', body: JSON.stringify({ url }) });
export const confirmLms = (domain: string, provider: LmsProvider, host: string) =>
  api('/schools/lms/confirm', { method: 'POST', body: JSON.stringify({ domain, provider, host }) }).catch(() => {});

// Detection probes a handful of hosts (up to ~5s), so start it as soon as the school is picked
// and let the LMS step pick up the same promise.
const lmsCache = new Map<string, Promise<LmsOption[]>>();
export function schoolLms(domain: string): Promise<LmsOption[]> {
  let p = lmsCache.get(domain);
  if (!p) {
    p = api<{ options: LmsOption[] }>(`/schools/lms?domain=${encodeURIComponent(domain)}`)
      .then((r) => r.options)
      .catch(() => {
        lmsCache.delete(domain);
        return [];
      });
    lmsCache.set(domain, p);
  }
  return p;
}

/** What students call it (mirrors LMS_BRANDS in Backend/schools.py for profiles saved earlier). */
export function lmsBrand(host: string | null | undefined, provider: string | null | undefined) {
  if (host === 'lms.cofc.edu') return 'OAKS';
  return provider === 'brightspace' ? 'Brightspace' : provider === 'canvas' ? 'Canvas' : provider === 'blackboard' ? 'Blackboard' : 'your LMS';
}

export function lmsStartUrl(provider: LmsProvider, host: string) {
  if (provider === 'brightspace') return `https://${host}/d2l/home`;
  // Blackboard can park visitors in a guest session ("Institution Page", no way to sign in), so start
  // with its logout address: it ends any guest session and shows the school's real sign-in.
  if (provider === 'blackboard') return `https://${host}/webapps/login/?action=logout`;
  return `https://${host}/login`;
}

/** square: athletics mark or site icon; wide: the official logo. Picked server-side (404 when none). */
export const schoolLogoUrl = (domain: string, kind: 'square' | 'wide' = 'square') =>
  `${API_URL}/schools/logo?domain=${encodeURIComponent(domain)}&kind=${kind}`;
