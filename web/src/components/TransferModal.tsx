import { createSignal, createMemo, onMount, onCleanup, Show, For } from 'solid-js';
import { Download, Upload, FileArchive, X, Check, Loader2 } from 'lucide-solid';
import { api, type Space, type Project } from '../services/api';
import { exportPackage, previewPackage, importPackage, packageCountLabels, type TransferRequest, type PackagePreview, type ImportResult } from '../services/transfer';
import { focusScope } from './focusScope';
import '../styles/transfer.css';

export function TransferModal(props: { onNavigate: (route: string, spaceId?: string | null, projectId?: string | null) => void }) {
  const [request, setRequest] = createSignal<TransferRequest | null>(null);
  const [file, setFile] = createSignal<File | null>(null);
  const [preview, setPreview] = createSignal<PackagePreview | null>(null);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [spaceId, setSpaceId] = createSignal('');
  const [projectId, setProjectId] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [uploadProgress, setUploadProgress] = createSignal<number | null>(null);
  const [reading, setReading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [result, setResult] = createSignal<ImportResult | null>(null);
  const [downloaded, setDownloaded] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  let requestId = '', generation = 0;
  const importing = () => request()?.mode === 'import';
  const exportScope = () => { const current = request(); return current?.mode === 'export' ? current.scope : null; };
  const needsProject = () => preview()?.scope.kind === 'board';
  const destinationProjects = createMemo(() => projects().filter(project => project.space_id === spaceId()));
  const canChooseProject = () => preview()?.scope.kind === 'board' || preview()?.scope.kind === 'task';
  const close = () => { if (busy()) return; generation++; setRequest(null); };
  onMount(() => {
    const open = (event: Event) => {
      if (busy()) return;
      generation++; requestId = crypto.randomUUID();
      setFile(null); setPreview(null); setSpaces([]); setProjects([]); setSpaceId(''); setProjectId(''); setResult(null); setDownloaded(false); setError(''); setReading(false); setDragOver(false); setUploadProgress(null);
      setRequest((event as CustomEvent<TransferRequest>).detail);
    };
    window.addEventListener('orca:transfer', open);
    onCleanup(() => { generation++; window.removeEventListener('orca:transfer', open); });
  });
  const chooseFile = async (selected: File | undefined) => {
    if (!selected || busy()) return;
    const ticket = ++generation; requestId = crypto.randomUUID();
    setFile(selected); setPreview(null); setResult(null); setError(''); setReading(true); setUploadProgress(0);
    if (selected.size > 128 * 1024 * 1024) { setReading(false); setError('Paket terlalu besar. Ukuran maksimum 128 MB.'); return; }
    try {
      const [info, availableSpaces, availableProjects] = await Promise.all([previewPackage(selected, percent => { if (ticket === generation) setUploadProgress(percent); }), api.getSpaces(), api.getProjects()]);
      if (ticket !== generation) return;
      setSpaces(availableSpaces); setProjects(availableProjects); setPreview(info);
      const current = request(); const preferred = current?.mode === 'import' ? current.spaceId : undefined;
      setSpaceId(availableSpaces.find(space => space.id === preferred)?.id || (availableSpaces.length === 1 ? availableSpaces[0]!.id : '')); setProjectId('');
    } catch (failure) { if (ticket === generation) setError(failure instanceof Error ? failure.message : 'Paket gagal diperiksa. Pilih berkas lalu coba lagi.'); }
    finally { if (ticket === generation) setReading(false); }
  };
  const download = async () => {
    const scope = exportScope(); if (!scope || busy()) return;
    setBusy(true); setError('');
    try {
      const blob = await exportPackage(scope); const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${(scope.name || scope.kind).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}.orca.zip`;
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); setDownloaded(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ekspor gagal. Coba lagi.'); }
    finally { setBusy(false); }
  };
  const importCopy = async () => {
    const selected = file(); const info = preview(); if (!selected || !info || busy() || reading() || info.requires_destination && (!spaceId() || needsProject() && !projectId())) return;
    setBusy(true); setError(''); setUploadProgress(0);
    try { setResult(await importPackage(selected, requestId, info.requires_destination ? spaceId() : undefined, info.requires_destination && canChooseProject() ? projectId() : undefined, setUploadProgress)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Impor belum berhasil. Coba lagi dengan paket dan tujuan yang sama.'); }
    finally { setBusy(false); }
  };
  const counts = () => result()?.counts || preview()?.counts || {};
  return <Show when={request()}><div class="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section class="modal-card transfer-modal" ref={element => focusScope(element, close)} aria-busy={busy() || reading()}>
      <header class="modal-header"><h3 class="modal-title">{result() ? 'Impor selesai' : downloaded() ? 'Paket siap' : importing() ? 'Impor paket ORCA' : `Export ${exportScope()?.kind || ''}`}</h3><button type="button" class="btn-ghost-icon" aria-label="Tutup transfer data" disabled={busy()} onClick={close}><X size={18} /></button></header>
      <Show when={error()}><p role="alert" class="modal-error-badge">{error()}<Show when={importing() && !preview()}><button type="button" class="task-parent-link" onClick={() => chooseFile(file() || undefined)}>Coba lagi</button></Show></p></Show>
      <Show when={!importing()}>
        <div class="transfer-intro"><FileArchive size={28} aria-hidden="true" /><div><h4>{exportScope()?.name || (exportScope()?.kind === 'workspace' ? 'Seluruh workspace' : 'Space terpilih')}</h4><p>{downloaded() ? 'Unduhan paket telah dimulai. Simpan berkas .orca.zip untuk diimpor kembali.' : 'Data terakhir yang tersimpan beserta konten terkait dan lampirannya akan dikemas dalam satu berkas .orca.zip.'}</p></div></div>
        <Show when={!downloaded()}><p class="transfer-note">{exportScope()?.kind === 'workspace' ? 'Mencakup Space, project, dokumen, board, task, jadwal, dan catatan Inbox.' : exportScope()?.kind === 'space' ? 'Mencakup seluruh project dan konten dalam Space ini.' : exportScope()?.kind === 'project' ? 'Mencakup task, dokumen, board, dan sesi Calendar terkait.' : exportScope()?.kind === 'board' ? 'Mencakup blok, posisi, koneksi, dan lampiran board.' : 'Mencakup detail task, subtask, dan sesi Calendar terkait.'}</p></Show>
      </Show>
      <Show when={importing() && !result()}>
        <label class={`transfer-dropzone ${dragOver() ? 'is-over' : ''}`} onDragOver={event => { event.preventDefault(); if (!busy()) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={event => { event.preventDefault(); setDragOver(false); void chooseFile(event.dataTransfer?.files[0]); }}>
          <Upload size={24} aria-hidden="true" /><strong>{file()?.name || 'Pilih atau letakkan paket ORCA di sini'}</strong><span>{file() ? `${file()!.size < 1024 * 1024 ? Math.max(1, Math.ceil(file()!.size / 1024)) + ' KB' : (file()!.size / 1024 / 1024).toFixed(1) + ' MB'} · Pilih berkas lain` : '.orca.zip · Maksimum 128 MB'}</span>
          <input class="accessible-file-input" type="file" accept=".zip,.orca.zip" aria-label="Pilih paket ORCA" disabled={busy() || reading()} onChange={event => { void chooseFile(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
        </label>
      </Show>
      <Show when={reading()}><p class="transfer-status" role="status"><Loader2 class="spin" size={18} />{uploadProgress() !== null && uploadProgress()! < 100 ? `Mengunggah paket… ${uploadProgress()}%` : 'Memeriksa isi paket…'}</p></Show>
      <Show when={preview() && !reading()}>
        <section class="transfer-preview" aria-label="Isi paket"><h4>{result() ? result()?.name : preview()?.name}</h4><dl class="transfer-counts"><For each={packageCountLabels.filter(([key]) => (counts()[key] || 0) > 0)}>{([key, label]) => <div><dt>{label}</dt><dd>{counts()[key]}</dd></div>}</For></dl></section>
        <Show when={preview()?.warnings.length}><section class="transfer-warnings" aria-label="Catatan paket"><h4>Perlu diketahui</h4><ul><For each={preview()?.warnings}>{warning => <li>{warning}</li>}</For></ul></section></Show>
        <Show when={!result() && preview()?.requires_destination}>
          <div class="transfer-destination"><label for="transfer-space">Space tujuan</label><select id="transfer-space" class="modal-form-input" value={spaceId()} disabled={busy()} onChange={event => { setSpaceId(event.currentTarget.value); setProjectId(''); requestId = crypto.randomUUID(); }}><option value="">Pilih Space</option><For each={spaces()}>{space => <option value={space.id}>{space.name}</option>}</For></select>
            <Show when={!spaces().length}><p class="transfer-note">Belum ada Space tujuan. Buat Space terlebih dahulu, lalu ulangi impor.</p></Show>
          </div>
          <Show when={canChooseProject() && spaceId()}><div class="transfer-destination"><label for="transfer-project">Project tujuan{needsProject() ? '' : ' (opsional)'}</label><select id="transfer-project" class="modal-form-input" value={projectId()} disabled={busy()} onChange={event => { setProjectId(event.currentTarget.value); requestId = crypto.randomUUID(); }}><option value="">{needsProject() ? 'Pilih project' : 'Tanpa project'}</option><For each={destinationProjects()}>{project => <option value={project.id}>{project.name}</option>}</For></select><Show when={needsProject() && !destinationProjects().length}><p class="transfer-note">Board dibuka dari project. Buat project di Space tujuan terlebih dahulu.</p></Show></div></Show>
        </Show>
        <Show when={!result()}><p class="transfer-note">{preview()?.requires_destination ? 'Konten ditambahkan sebagai salinan.' : 'Space dalam paket dibuat sebagai salinan baru.'} Data yang sudah ada tetap dipertahankan.</p></Show>
      </Show>
      <Show when={result()}><p class="transfer-status" role="status"><Check size={18} />Salinan berhasil ditambahkan ke workspace ini.</p></Show>
      <Show when={busy()}><p class="transfer-status" role="status"><Loader2 class="spin" size={18} />{importing() ? (uploadProgress() !== null && uploadProgress()! < 100 ? `Mengunggah paket… ${uploadProgress()}%` : 'Mengimpor konten dan lampiran…') : 'Menyiapkan paket dan lampiran…'}</p></Show>
      <footer class="transfer-footer"><button type="button" class="btn-secondary" onClick={close} disabled={busy()}>{result() || downloaded() ? 'Tutup' : 'Batal'}</button>
        <Show when={!importing() && !downloaded()}><button type="button" class="btn-primary" onClick={download} disabled={busy()}><Download size={16} />Unduh paket</button></Show>
        <Show when={importing() && !result()}><button type="button" class="btn-primary" onClick={importCopy} disabled={busy() || reading() || !preview() || !!preview()?.requires_destination && (!spaceId() || needsProject() && !projectId())}><Upload size={16} />Impor sebagai salinan</button></Show>
        <Show when={result()?.space_id}><button type="button" class="btn-primary" onClick={() => { const imported = result()!; close(); props.onNavigate('projects', imported.space_id, imported.project_id || null); }}>Buka hasil impor</button></Show>
      </footer>
    </section>
  </div></Show>;
}
