import { api } from './api';

// "Where do you go?" -> which LMS the school uses -> sign in there. Backend: Backend/schools.py.

export type School = { name: string; domain: string };
export type LmsProvider = 'brightspace' | 'canvas';
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
  return provider === 'brightspace' ? 'Brightspace' : provider === 'canvas' ? 'Canvas' : 'your LMS';
}

export function lmsStartUrl(provider: LmsProvider, host: string) {
  return provider === 'brightspace' ? `https://${host}/d2l/home` : `https://${host}/login`;
}

/** The school's site icon at up to 128px (Google's favicon service); SchoolLogo falls back to initials. */
export const schoolLogoUrl = (domain: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
