import * as DocumentPicker from 'expo-document-picker';

import { apiRaw, errorMessage } from './api';

/** Pick a PDF/DOCX syllabus and POST it as multipart to `path` (/upload or /courses/{id}/syllabus). */
export async function pickAndUploadSyllabus(path: string): Promise<{ ok: true; data: any } | { ok: false; error: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const file = res.assets[0];
  const body = new FormData();
  // React Native's FormData accepts { uri, name, type } file parts.
  body.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/pdf' } as unknown as Blob);
  const r = await apiRaw(path, { method: 'POST', body });
  if (!r.ok) return { ok: false, error: await errorMessage(r) };
  return { ok: true, data: await r.json() };
}
