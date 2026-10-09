import { focusScope } from './focusScope';
import type { Component } from 'solid-js';
import { createSignal, createEffect, Show, For } from 'solid-js';
import { X, CheckSquare, FileText, StickyNote, Loader2 } from 'lucide-solid';
import { api } from '../services/api';
import type { Space, Project } from '../services/api';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated?: () => void;
}

export const QuickCaptureModal: Component<QuickCaptureModalProps> = (props) => {
  const [type, setType] = createSignal<'Note' | 'Task' | 'Document'>('Note');
  const [content, setContent] = createSignal('');
  const [title, setTitle] = createSignal('');
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = createSignal('');
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = createSignal('');
  const [priority, setPriority] = createSignal<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [dueDate, setDueDate] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  // Re-fetch spaces whenever modal opens
  createEffect(async () => {
    if (props.isOpen) {
      setError('');
      setContent('');
      setTitle('');
      setDueDate('');
      setPriority('medium');
      setType('Note'); // Always default to quick note/thought
      try {
        const [spaceData, projData] = await Promise.all([
          api.getSpaces(),
          api.getProjects()
        ]);
        if (spaceData && spaceData.length > 0) {
          setSpaces(spaceData);
          if (!selectedSpaceId() || !spaceData.some(s => s.id === selectedSpaceId())) {
            setSelectedSpaceId(spaceData[0].id);
          }
        }
        setProjects(projData || []);
      } catch (_) {}
    }
  });

  const availableProjects = () => {
    const spId = selectedSpaceId();
    if (!spId) return projects();
    return projects().filter(p => p.space_id === spId);
  };

  const handleSave = async (e?: Event) => {
    if (e) e.preventDefault();
    setError('');

    if (type() === 'Note') {
      const cleanContent = content().trim();
      if (!cleanContent) {
        setError('Tulis catatan atau pemikiran Anda terlebih dahulu');
        return;
      }

      setLoading(true);
      try {
        await api.createInboxNote({ content: cleanContent });
        window.dispatchEvent(new CustomEvent('orca:inbox_updated'));
        setContent('');
        props.onClose();
        if (props.onItemCreated) {
          props.onItemCreated();
        }
      } catch (err: any) {
        setError(err.message || 'Gagal menyimpan catatan ke Inbox');
      } finally {
        setLoading(false);
      }
      return;
    }

    // For Task or Document, Space & Project are required
    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      setError(type() === 'Task' ? 'Judul task wajib diisi' : 'Judul dokumen wajib diisi');
      return;
    }

    const spaceId = selectedSpaceId();
    if (!spaceId) {
      setError('Pilih Space untuk menyimpan item ini');
      return;
    }

    const projectId = selectedProjectId();
    if (!projectId) {
      setError('Pilih Project tujuan. Task dan Dokumen harus disimpan di dalam Project.');
      return;
    }

    setLoading(true);
    try {
      if (type() === 'Task') {
        await api.createTask({
          title: trimmedTitle,
          description: content().trim() || undefined,
          space_id: spaceId,
          project_id: projectId,
          status: 'todo',
          priority: priority(),
          due_date: dueDate() || undefined,
        });
      } else {
        await api.createDocument({
          title: trimmedTitle,
          content: content().trim() || '',
          space_id: spaceId,
          project_id: projectId,
          doc_type: 'general',
          is_pinned: false,
        });
      }

      setTitle('');
      setContent('');
      props.onClose();
      if (props.onItemCreated) {
        props.onItemCreated();
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan item');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      props.onClose();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div 
        class="modal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      >
        <div class="modal-card" ref={el => focusScope(el, props.onClose)} style={{ "max-width": '520px' }} onKeyDown={handleKeyDown}>
          {/* Modal Header */}
          <div class="modal-header">
            <div>
              <h3 class="modal-title" style={{ "font-size": '15px', "font-weight": 600 }}>
                Quick Capture
              </h3>
            </div>
            <button 
              type="button" 
              onClick={props.onClose} 
              class="btn-ghost-icon"
              aria-label="Tutup jendela"
            >
              <X size={16} />
            </button>
          </div>

          {/* Type Selector (Note vs Task vs Document) */}
          <div style={{ "margin-bottom": '16px' }}>
            <div class="segmented-control" style={{ width: '100%', display: 'flex' }}>
              <button 
                type="button"
                onClick={() => { setType('Note'); setError(''); }}
                class={`seg-btn ${type() === 'Note' ? 'active' : ''}`}
                style={{ flex: 1, display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '6px', padding: '7px 12px' }}
              >
                <StickyNote size={13} />
                <span>Catatan (Inbox)</span>
              </button>
              <button 
                type="button"
                onClick={() => { setType('Task'); setError(''); }}
                class={`seg-btn ${type() === 'Task' ? 'active' : ''}`}
                style={{ flex: 1, display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '6px', padding: '7px 12px' }}
              >
                <CheckSquare size={13} />
                <span>Task (Project)</span>
              </button>
              <button 
                type="button"
                onClick={() => { setType('Document'); setError(''); }}
                class={`seg-btn ${type() === 'Document' ? 'active' : ''}`}
                style={{ flex: 1, display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '6px', padding: '7px 12px' }}
              >
                <FileText size={13} />
                <span>Dokumen (Project)</span>
              </button>
            </div>
          </div>

          <Show when={error()}>
            <div class="modal-error-badge" role="alert" style={{ "margin-bottom": '14px' }}>
              {error()}
            </div>
          </Show>

          <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: '14px' }}>
            {/* 1. Quick Note Mode (Direct to Inbox) */}
            <Show when={type() === 'Note'}>
              <div>
                <textarea 
                  autofocus
                  rows={4} 
                  value={content()}
                  onInput={e => setContent(e.currentTarget.value)}
                  placeholder="Tulis ide, catatan, atau pemikiran yang baru terpikirkan... (Ctrl+Enter untuk simpan)"
                  class="modal-form-input"
                  style={{ resize: 'vertical', "font-size": '13px', "line-height": 1.5, padding: '10px 12px' }}
                />
              </div>
            </Show>

            {/* 2. Task / Document Structured Mode (Must target Project) */}
            <Show when={type() !== 'Note'}>
              {/* Space & Project Selectors */}
              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                <div>
                  <label class="modal-form-label">Space</label>
                  <select
                    value={selectedSpaceId()}
                    onChange={e => {
                      setSelectedSpaceId(e.currentTarget.value);
                      setSelectedProjectId('');
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
                    value={selectedProjectId()}
                    onChange={e => setSelectedProjectId(e.currentTarget.value)}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '12.5px' }}
                    required
                  >
                    <option value="">Pilih Project...</option>
                    <For each={availableProjects()}>
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
                  {type() === 'Task' ? 'Judul Task' : 'Judul Dokumen'}
                </label>
                <input 
                  type="text" 
                  value={title()} 
                  onInput={e => setTitle(e.currentTarget.value)}
                  placeholder={type() === 'Task' ? "Contoh: Selesaikan desain halaman login" : "Contoh: Rencana Strategi Q4"}
                  class="modal-form-input"
                  style={{ "font-size": '13px', padding: '9px 12px' }}
                  required
                />
              </div>

              {/* If Task: Priority and Due Date */}
              <Show when={type() === 'Task'}>
                <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label class="modal-form-label">Prioritas</label>
                    <select
                      value={priority()}
                      onChange={e => setPriority(e.currentTarget.value as any)}
                      class="modal-form-input"
                      style={{ padding: '8px 10px', "font-size": '12.5px' }}
                    >
                      <option value="low">Rendah (Low)</option>
                      <option value="medium">Sedang (Medium)</option>
                      <option value="high">Tinggi (High)</option>
                      <option value="urgent">Mendesak (Urgent)</option>
                    </select>
                  </div>

                  <div>
                    <label class="modal-form-label">Tenggat Waktu (Opsional)</label>
                    <input 
                      type="date" 
                      value={dueDate()} 
                      onInput={e => setDueDate(e.currentTarget.value)}
                      class="modal-form-input"
                      style={{ padding: '8px 10px', "font-size": '12.5px' }}
                    />
                  </div>
                </div>
              </Show>

              {/* Description / Content */}
              <div>
                <label class="modal-form-label">
                  {type() === 'Task' ? 'Keterangan Tambahan (Opsional)' : 'Isi Dokumen (Opsional)'}
                </label>
                <textarea 
                  rows={3} 
                  value={content()}
                  onInput={e => setContent(e.currentTarget.value)}
                  placeholder={type() === 'Task' ? "Tambahkan detail atau konteks..." : "Tulis draft isi dokumen..."}
                  class="modal-form-input"
                  style={{ resize: 'vertical', "font-size": '13px', "line-height": 1.5 }}
                />
              </div>
            </Show>

            {/* Footer Row */}
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-top": '4px', "padding-top": '14px', "border-top": '1px solid var(--border-default)' }}>
              <span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>
                Tekan <kbd style={{ padding: '2px 5px', "border-radius": '3px', background: 'var(--surface-container-high)', border: '1px solid var(--border-default)' }}>Ctrl+Enter</kbd> untuk simpan
              </span>

              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={props.onClose} 
                  class="btn-secondary"
                  disabled={loading()}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  class="btn-primary"
                  disabled={loading()}
                  style={{ display: 'flex', "align-items": 'center', gap: '6px' }}
                >
                  <Show when={loading()}>
                    <Loader2 size={13} class="spin" />
                  </Show>
                  <span>
                    {loading() 
                      ? 'Menyimpan...' 
                      : type() === 'Note' 
                        ? 'Simpan ke Inbox' 
                        : type() === 'Task' 
                          ? 'Simpan Task' 
                          : 'Simpan Dokumen'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};
