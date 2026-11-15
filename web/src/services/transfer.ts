import { ApiError, getAuthToken, removeAuthToken } from './api';
import { announceDataChange } from './dataRefresh';

export type ExportScope = { kind: 'workspace' | 'space' | 'project' | 'board' | 'task'; id?: string; name?: string };
export type TransferRequest = { mode: 'export'; scope: ExportScope } | { mode: 'import'; spaceId?: string };
export interface PackagePreview { name: string; scope: ExportScope; counts: Record<string, number>; warnings: string[]; requires_destination: boolean; bytes: number }
export interface ImportResult { name: string; counts: Record<string, number>; ids: Record<string, string>; warnings: string[]; space_id?: string; project_id?: string }
const base = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export function openExport(scope: ExportScope) { window.dispatchEvent(new CustomEvent<TransferRequest>('orca:transfer', { detail: { mode: 'export', scope } })); }
export function openImport(spaceId?: string) { window.dispatchEvent(new CustomEvent<TransferRequest>('orca:transfer', { detail: { mode: 'import', spaceId } })); }

async function send(path: string, options: RequestInit) {
  const token = getAuthToken();
  const response = await fetch(`${base}/transfer/${path}`, { ...options, headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    if (response.status === 401) { removeAuthToken(); window.dispatchEvent(new Event('orca:auth_unauthorized')); }
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error || message; } catch { /* Non-JSON transport error. */ }
    throw new ApiError(message, response.status);
  }
  return response;
}
export async function exportPackage(scope: ExportScope) {
  const query = new URLSearchParams({ kind: scope.kind }); if (scope.id) query.set('id', scope.id);
  const response = await send(`export?${query}`, {});
  return response.blob();
}
function sendForm(path: string, data: FormData, onProgress?: (percent: number) => void): Promise<{ data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', `${base}/transfer/${path}`); xhr.timeout = 120000;
    const token = getAuthToken(); if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => {
      let body; try { body = JSON.parse(xhr.responseText); } catch { reject(new ApiError('Respons server tidak dapat dibaca. Coba lagi.', xhr.status)); return; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(body); return; }
      if (xhr.status === 401) { removeAuthToken(); window.dispatchEvent(new Event('orca:auth_unauthorized')); }
      reject(new ApiError(body.error || `Request failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Koneksi terputus. Coba lagi dengan paket dan tujuan yang sama.', 0));
    xhr.ontimeout = () => reject(new ApiError('Server belum memberi kepastian hasil. Coba lagi dengan paket dan tujuan yang sama.', 0));
    xhr.send(data);
  });
}
export async function previewPackage(file: File, onProgress?: (percent: number) => void): Promise<PackagePreview> {
  const data = new FormData(); data.append('file', file);
  return (await sendForm('preview', data, onProgress)).data;
}
export async function importPackage(file: File, requestId: string, spaceId?: string, projectId?: string, onProgress?: (percent: number) => void): Promise<ImportResult> {
  const data = new FormData(); data.append('file', file); data.append('request_id', requestId);
  if (spaceId) data.append('space_id', spaceId); if (projectId) data.append('project_id', projectId);
  const result = (await sendForm('import', data, onProgress)).data;
  announceDataChange(); return result;
}
export const packageCountLabels: [string, string][] = [['spaces', 'Space'], ['projects', 'project'], ['documents', 'dokumen'], ['note_boards', 'board'], ['tasks', 'task'], ['note_blocks', 'blok'], ['events', 'jadwal'], ['inbox_notes', 'catatan Inbox'], ['entity_links', 'hubungan'], ['assets', 'lampiran']];
