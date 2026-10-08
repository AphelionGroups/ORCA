import { focusScope } from '../components/focusScope';
import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { 
  Inbox, 
  Plus, 
  Trash2, 
  Clock, 
  CheckSquare, 
  FileText, 
  Edit3, 
  Check, 
  X, 
  RefreshCw,
  Loader2
} from 'lucide-solid';
import { api } from '../services/api';
import type { InboxNote, Space, Project } from '../services/api';

interface InboxViewProps {
  onNavigate: (route: string, spaceId?: string | null, projectId?: string | null) => void;
  onOpenQuickCapture: () => void;
}

export const InboxView: Component<InboxViewProps> = (props) => {
  const [quickInput, setQuickInput] = createSignal('');
  const [notes, setNotes] = createSignal<InboxNote[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [savingNote, setSavingNote] = createSignal(false);
  const [editingNoteId, setEditingNoteId] = createSignal<string | null>(null);
  const [editContent, setEditContent] = createSignal('');
  const [successToast, setSuccessToast] = createSignal<string | null>(null);

  // Conversion Modal State
  const [convertModalOpen, setConvertModalOpen] = createSignal(false);
  const [convertTargetType, setConvertTargetType] = createSignal<'task' | 'doc'>('task');
  const [convertingNote, setConvertingNote] = createSignal<InboxNote | null>(null);
  const [convertTitle, setConvertTitle] = createSignal('');
  const [convertSpaceId, setConvertSpaceId] = createSignal('');
  const [convertProjectId, setConvertProjectId] = createSignal('');
  const [convertPriority, setConvertPriority] = createSignal<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [convertLoading, setConvertLoading] = createSignal(false);
  const [convertError, setConvertError] = createSignal('');

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'Baru saja';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m yang lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}j yang lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}h yang lalu`;
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedNotes, fetchedSpaces, fetchedProjects] = await Promise.all([
        api.getInboxNotes(),
        api.getSpaces(),
        api.getProjects()
      ]);
      setNotes(fetchedNotes || []);
      setSpaces(fetchedSpaces || []);
      setProjects(fetchedProjects || []);
      if (fetchedSpaces && fetchedSpaces.length > 0 && !convertSpaceId()) {
        setConvertSpaceId(fetchedSpaces[0].id);
      }
    } catch (err) {
      console.error('Failed to load inbox data:', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
    const handleInboxUpdate = () => {
      loadData();
    };
    window.addEventListener('orca:inbox_updated', handleInboxUpdate);
    onCleanup(() => {
      window.removeEventListener('orca:inbox_updated', handleInboxUpdate);
    });
  });

  const availableProjectsForConvert = () => {
    const spId = convertSpaceId();
    if (!spId) return projects();
    return projects().filter(p => p.space_id === spId);
  };

  const handleAddNote = async (e?: Event) => {
    if (e) e.preventDefault();
    const val = quickInput().trim();
    if (!val) return;

    setSavingNote(true);
    try {
      const newNote = await api.createInboxNote({ content: val });
      if (newNote && newNote.id) {
        setNotes([newNote, ...notes().filter(n => n.id !== newNote.id)]);
      } else {
        await loadData();
      }
      setQuickInput('');
      showToast('Catatan disimpan ke Inbox');
    } catch (err) {
      console.error('Failed to capture inbox note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await api.deleteInboxNote(id);
      setNotes(notes().filter(n => n.id !== id));
      showToast('Catatan dihapus');
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleStartEdit = (note: InboxNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editContent().trim();
    if (!trimmed) return;
    try {
      const updated = await api.updateInboxNote(id, { content: trimmed });
      setNotes(notes().map(n => n.id === id ? updated : n));
      setEditingNoteId(null);
      showToast('Perubahan catatan disimpan');
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleOpenConvert = (note: InboxNote, type: 'task' | 'doc') => {
    setConvertingNote(note);
    setConvertTargetType(type);
    setConvertError('');
    // Use first line as title candidate
    const firstLine = note.content.split('\n')[0].trim();
    setConvertTitle(firstLine);
    if (spaces().length > 0 && !convertSpaceId()) {
      setConvertSpaceId(spaces()[0].id);
    }
    const avail = availableProjectsForConvert();
    if (avail.length > 0) {
      setConvertProjectId(avail[0].id);
    } else {
      setConvertProjectId('');
    }
    setConvertModalOpen(true);
  };

  const handleExecuteConvert = async (e: Event) => {
    e.preventDefault();
    const note = convertingNote();
    if (!note) return;

    const spaceId = convertSpaceId();
    if (!spaceId) {
      setConvertError('Pilih Space tujuan');
      return;
    }

    const projectId = convertProjectId();
    if (!projectId) {
      setConvertError('Pilih Project tujuan. Task dan Dokumen harus berada di dalam Project.');
      return;
    }

    setConvertLoading(true);
    setConvertError('');

    try {
      if (convertTargetType() === 'task') {
        await api.convertInboxNoteToTask(note.id, {
          space_id: spaceId,
          project_id: projectId,
          title: convertTitle().trim() || note.content,
          priority: convertPriority(),
        });
        setNotes(notes().filter(n => n.id !== note.id));
        setConvertModalOpen(false);
        showToast('Catatan berhasil dijadikan Task di Project!');
        props.onNavigate('projects', spaceId, projectId);
      } else {
        await api.convertInboxNoteToDoc(note.id, {
          space_id: spaceId,
          project_id: projectId,
          title: convertTitle().trim() || note.content,
        });
        setNotes(notes().filter(n => n.id !== note.id));
        setConvertModalOpen(false);
        showToast('Catatan berhasil dijadikan Dokumen di Project!');
        props.onNavigate('projects', spaceId, projectId);
      }
    } catch (err: any) {
      setConvertError(err.message || 'Gagal mengubah catatan');
    } finally {
      setConvertLoading(false);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <div class="breadcrumb-title">
            <Inbox size={16} color="var(--secondary)" />
            <span>Inbox</span>
          </div>
          <Show when={notes().length > 0}>
            <span style={{ "font-size": '11.5px', color: 'var(--text-dim)', "margin-left": '6px' }}>
              ({notes().length} catatan)
            </span>
          </Show>
        </div>

        <div class="header-actions">
          <button 
            type="button"
            onClick={loadData}
            title="Muat ulang catatan"
            class="btn-ghost-icon"
            style={{ width: '28px', height: '28px' }}
          >
            <RefreshCw size={14} class={loading() ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      <Show when={successToast()}>
        <div role="status" style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--surface-container-high)',
          border: '1px solid var(--surface-muted)',
          color: 'var(--text-main)',
          padding: '10px 16px',
          "border-radius": '8px',
          "font-size": '12.5px',
          display: 'flex',
          "align-items": 'center',
          gap: '8px',
          "box-shadow": 'none',
          "z-index": 1000
        }}>
          <Check size={14} color="var(--status-success)" />
          <span>{successToast()}</span>
        </div>
      </Show>

      {/* Main Content Area */}
      <div class="inbox-workspace" style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
        <div style={{ "max-width": '720px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '20px' }}>
          
          {/* Quick Note Input Box */}
          <form 
            onSubmit={handleAddNote}
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-default)',
              "border-radius": '4px',
              padding: '12px 14px',
              display: 'flex',
              "flex-direction": 'column',
              gap: '10px',
              "box-shadow": 'none'
            }}
          >
            <textarea
              rows={2}
              value={quickInput()}
              onInput={e => setQuickInput(e.currentTarget.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Tulis ide, catatan, atau pemikiran cepat... (Ctrl+Enter untuk simpan)"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-main)',
                "font-size": '13.5px',
                "font-family": 'inherit',
                resize: 'none',
                "line-height": 1.5,
                "box-sizing": 'border-box'
              }}
            />
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "border-top": '1px solid var(--border-subtle)', "padding-top": '8px' }}>
              <span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>
                Ide dan catatan cepat akan disimpan di Inbox sebelum dijadikan Todo/Dokumen
              </span>
              <button
                type="submit"
                class="btn-primary"
                disabled={!quickInput().trim() || savingNote()}
                style={{ padding: '6px 14px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '6px' }}
              >
                <Plus size={13} />
                <span>{savingNote() ? 'Menyimpan...' : 'Simpan ke Inbox'}</span>
              </button>
            </div>
          </form>

          {/* Notes List */}
          <Show when={!loading() && notes().length === 0}>
            <div style={{
              padding: '48px 24px',
              "text-align": 'center',
              display: 'flex',
              "flex-direction": 'column',
              "align-items": 'center',
              gap: '12px',
              background: 'var(--surface-container-lowest)',
              border: '1px dashed var(--border-default)',
              "border-radius": '4px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                "border-radius": '50%',
                background: 'var(--surface-container-high)',
                display: 'flex',
                "align-items": 'center',
                "justify-content": 'center'
              }}>
                <Inbox size={20} color="var(--text-dim)" />
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', "font-size": '14px', "font-weight": 600, color: 'var(--text-main)' }}>
                  Inbox Bersih
                </h4>
                <p style={{ margin: 0, "font-size": '12.5px', color: 'var(--text-dim)', "max-width": '360px', "line-height": 1.5 }}>
                  Gunakan Inbox untuk menangkap ide atau catatan sementara sebelum Anda mengaturnya ke dalam project atau tugas.
                </p>
                <button
                  type="button"
                  class="btn-secondary"
                  style={{ "margin-top": '14px', "font-size": '12px', padding: '6px 14px' }}
                  onClick={() => props.onOpenQuickCapture()}
                >
                  Buka Quick Capture (Ctrl+K)
                </button>
              </div>
            </div>
          </Show>

          <Show when={notes().length > 0}>
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
              <For each={notes()}>
                {(note) => (
                  <div style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border-default)',
                    "border-radius": '4px',
                    padding: '14px 16px',
                    display: 'flex',
                    "flex-direction": 'column',
                    gap: '10px',
                    transition: 'border-color 0.15s ease'
                  }}>
                    {/* Note Content / Editing */}
                    <Show 
                      when={editingNoteId() === note.id}
                      fallback={
                        <div style={{ 
                          "font-size": '13.5px', 
                          color: 'var(--text-main)', 
                          "white-space": 'pre-wrap', 
                          "line-height": 1.55,
                          "word-break": 'break-word' 
                        }}>
                          {note.content}
                        </div>
                      }
                    >
                      <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
                        <textarea
                          rows={3}
                          value={editContent()}
                          onInput={e => setEditContent(e.currentTarget.value)}
                          class="form-input"
                          style={{ width: '100%', "font-size": '13px', padding: '8px 10px', "box-sizing": 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: '6px', "justify-content": 'flex-end' }}>
                          <button
                            type="button"
                            class="btn-secondary"
                            style={{ padding: '4px 10px', "font-size": '11.5px' }}
                            onClick={() => setEditingNoteId(null)}
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            class="btn-primary"
                            style={{ padding: '4px 12px', "font-size": '11.5px' }}
                            onClick={() => handleSaveEdit(note.id)}
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    </Show>

                    {/* Note Footer: Time & Action Buttons */}
                    <div style={{
                      display: 'flex',
                      "align-items": 'center',
                      "justify-content": 'space-between',
                      "border-top": '1px solid var(--border-subtle)',
                      "padding-top": '8px',
                      "margin-top": '4px'
                    }}>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '5px', "font-size": '12px', color: 'var(--text-dim)' }}>
                        <Clock size={12} />
                        <span>{formatRelativeTime(note.created_at)}</span>
                      </div>

                      <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                        {/* Convert to Task */}
                        <button
                          type="button"
                          class="btn-secondary"
                          style={{ padding: '4px 8px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px' }}
                          title="Ubah catatan ini menjadi Task di dalam Project"
                          onClick={() => handleOpenConvert(note, 'task')}
                        >
                          <CheckSquare size={12} color="var(--primary)" />
                          <span>Jadikan Task</span>
                        </button>

                        {/* Convert to Document */}
                        <button
                          type="button"
                          class="btn-secondary"
                          style={{ padding: '4px 8px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px' }}
                          title="Ubah catatan ini menjadi Dokumen di dalam Project"
                          onClick={() => handleOpenConvert(note, 'doc')}
                        >
                          <FileText size={12} color="var(--secondary)" />
                          <span>Jadikan Dokumen</span>
                        </button>

                        {/* Edit Note */}
                        <button
                          type="button"
                          class="btn-ghost-icon"
                          style={{ width: '24px', height: '24px' }}
                          title="Edit Catatan"
                          onClick={() => handleStartEdit(note)}
                        >
                          <Edit3 size={13} color="var(--text-dim)" />
                        </button>

                        {/* Delete Note */}
                        <button
                          type="button"
                          class="btn-ghost-icon"
                          style={{ width: '24px', height: '24px' }}
                          title="Hapus Catatan"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 size={13} color="var(--status-error)" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>

      {/* Convert Note to Task / Document Modal */}
      <Show when={convertModalOpen()}>
        <div 
          class="modal-backdrop" 
          onClick={() => setConvertModalOpen(false)}
        >
          <div 
            class="modal-card" ref={el => focusScope(el, () => setConvertModalOpen(false))}
            style={{ "max-width": '460px' }}
            onClick={e => e.stopPropagation()}
          >
            <div class="modal-header">
              <h3 class="modal-title" style={{ "font-size": '15px', "font-weight": 600 }}>
                {convertTargetType() === 'task' ? 'Jadikan Task di Project' : 'Jadikan Dokumen di Project'}
              </h3>
              <button 
                type="button" 
                class="btn-ghost-icon"
                onClick={() => setConvertModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <Show when={convertError()}>
              <div class="modal-error-badge" style={{ "margin-bottom": '12px' }}>
                {convertError()}
              </div>
            </Show>

            <form onSubmit={handleExecuteConvert} style={{ display: 'flex', "flex-direction": 'column', gap: '14px' }}>
              <div style={{ "font-size": '12px', color: 'var(--text-dim)', background: 'var(--surface-container-lowest)', padding: '10px 12px', "border-radius": '8px', border: '1px solid var(--border-subtle)' }}>
                Catatan ini akan dipindahkan dari Inbox menjadi {convertTargetType() === 'task' ? 'sebuah Task' : 'sebuah Dokumen'} di project pilihan Anda.
              </div>

              {/* Space & Project Pickers */}
              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                <div>
                  <label class="modal-form-label">Space</label>
                  <select
                    value={convertSpaceId()}
                    onChange={e => {
                      setConvertSpaceId(e.currentTarget.value);
                      const avail = projects().filter(p => p.space_id === e.currentTarget.value);
                      setConvertProjectId(avail.length > 0 ? avail[0].id : '');
                    }}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '12.5px' }}
                  >
                    <For each={spaces()}>
                      {(sp) => (
                        <option value={sp.id}>{sp.name}</option>
                      )}
                    </For>
                  </select>
                </div>

                <div>
                  <label class="modal-form-label">Project Tujuan</label>
                  <select
                    value={convertProjectId()}
                    onChange={e => setConvertProjectId(e.currentTarget.value)}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '12.5px' }}
                    required
                  >
                    <option value="">Pilih Project...</option>
                    <For each={availableProjectsForConvert()}>
                      {(proj) => (
                        <option value={proj.id}>{proj.name}</option>
                      )}
                    </For>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label class="modal-form-label">
                  {convertTargetType() === 'task' ? 'Judul Task' : 'Judul Dokumen'}
                </label>
                <input 
                  type="text" 
                  value={convertTitle()} 
                  onInput={e => setConvertTitle(e.currentTarget.value)}
                  class="modal-form-input"
                  style={{ padding: '8px 10px', "font-size": '13px' }}
                  required
                />
              </div>

              {/* Priority if Task */}
              <Show when={convertTargetType() === 'task'}>
                <div>
                  <label class="modal-form-label">Prioritas</label>
                  <select
                    value={convertPriority()}
                    onChange={e => setConvertPriority(e.currentTarget.value as any)}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '12.5px' }}
                  >
                    <option value="low">Rendah (Low)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="high">Tinggi (High)</option>
                    <option value="urgent">Mendesak (Urgent)</option>
                  </select>
                </div>
              </Show>

              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: '8px', "margin-top": '6px', "border-top": '1px solid var(--border-default)', "padding-top": '12px' }}>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() => setConvertModalOpen(false)}
                  disabled={convertLoading()}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  class="btn-primary"
                  disabled={convertLoading() || !convertProjectId()}
                  style={{ display: 'flex', "align-items": 'center', gap: '6px' }}
                >
                  <Show when={convertLoading()}>
                    <Loader2 size={13} class="spin" />
                  </Show>
                  <span>{convertTargetType() === 'task' ? 'Konversi ke Task' : 'Konversi ke Dokumen'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
};
