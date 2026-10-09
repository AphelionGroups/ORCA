import { focusScope } from './focusScope';
import type { Component } from 'solid-js';
import { createSignal, createEffect, Show, For } from 'solid-js';
import { X, Trash2, FolderKanban } from 'lucide-solid';
import { api, type Project, type Space } from '../services/api';

interface ProjectModalProps {
  isOpen: boolean;
  projectToEdit: Project | null;
  defaultSpaceId?: string;
  spaces: Space[];
  onClose: () => void;
  onSaved: (project: Project) => void;
  onDeleted?: (projectId: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

export const ProjectModal: Component<ProjectModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [spaceId, setSpaceId] = createSignal('');
  const [status, setStatus] = createSignal('active');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  createEffect(() => {
    if (props.isOpen) {
      setError('');
      setConfirmDelete(false);
      if (props.projectToEdit) {
        setName(props.projectToEdit.name);
        setDescription(props.projectToEdit.description || '');
        setSpaceId(props.projectToEdit.space_id);
        setStatus(props.projectToEdit.status || 'active');
      } else {
        setName('');
        setDescription('');
        setSpaceId(props.defaultSpaceId || (props.spaces.length > 0 ? props.spaces[0].id : ''));
        setStatus('active');
      }
    }
  });

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const trimmedName = name().trim();
    if (!trimmedName) {
      setError('Project name is required');
      return;
    }
    const targetSpaceId = spaceId() || props.defaultSpaceId;
    if (!targetSpaceId) {
      setError('Please select a space for this project');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (props.projectToEdit) {
        const updated = await api.updateProject(props.projectToEdit.id, {
          expected_updated_at: props.projectToEdit.updated_at,
          name: trimmedName,
          description: description().trim() || null,
          status: status(),
        });
        props.onSaved(updated);
      } else {
        const created = await api.createProject({
          space_id: targetSpaceId,
          name: trimmedName,
          description: description().trim() || undefined,
          status: status(),
          kanban_columns: ['To Do', 'In Progress', 'Done'],
        });
        props.onSaved(created);
      }
      window.dispatchEvent(new CustomEvent('orca:projects_updated'));
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!props.projectToEdit) return;
    setLoading(true);
    setError('');

    try {
      await api.deleteProject(props.projectToEdit.id);
      if (props.onDeleted) {
        props.onDeleted(props.projectToEdit.id);
      }
      window.dispatchEvent(new CustomEvent('orca:projects_updated'));
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div 
        class="modal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      >
        <div class="modal-card" ref={el => focusScope(el, props.onClose)}>
          {/* Header */}
          <div class="modal-header">
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <FolderKanban size={18} style={{ color: 'var(--brand-primary)' }} />
              <h3 class="modal-title">
                {props.projectToEdit ? 'Edit Project' : 'New Project'}
              </h3>
            </div>
            <button 
              onClick={props.onClose} 
              class="btn-ghost-icon"
              aria-label="Close modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Error Message */}
          <Show when={error()}>
            <div class="modal-error-badge" role="alert">
              {error()}
            </div>
          </Show>

          {/* Delete Confirmation Alert */}
          <Show when={confirmDelete()}>
            <div class="modal-delete-confirm-box">
              <div style={{ "font-weight": 600, "margin-bottom": '4px' }}>
                Hapus Project "{props.projectToEdit?.name}"?
              </div>
              <div style={{ "font-size": '12px', color: 'var(--text-muted)', "margin-bottom": '12px' }}>
                Seluruh canvas boards, documents, dan tasks yang terkait dengan project ini akan ikut terhapus permanen. Tindakan ini tidak dapat dibatalkan.
              </div>
              <div style={{ display: 'flex', gap: '8px', "justify-content": 'flex-end' }}>
                <button 
                  type="button"
                  class="btn-secondary"
                  style={{ padding: '4px 10px', "font-size": '12px' }}
                  onClick={() => setConfirmDelete(false)}
                  disabled={loading()}
                >
                  Batal
                </button>
                <button 
                  type="button"
                  class="btn-danger"
                  style={{ padding: '4px 10px', "font-size": '12px' }}
                  onClick={handleDelete}
                  disabled={loading()}
                >
                  {loading() ? 'Menghapus...' : 'Ya, Hapus Project'}
                </button>
              </div>
            </div>
          </Show>

          <Show when={!confirmDelete()}>
            <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: '14px' }}>
              {/* Name Field */}
              <div>
                <label class="modal-form-label">Project Name</label>
                <input 
                  type="text" 
                  autofocus
                  value={name()} 
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="e.g. Website Redesign, Marketing Q3..."
                  class="modal-form-input"
                />
              </div>

              {/* Space Selection (only selectable when creating new) */}
              <Show when={!props.projectToEdit}>
                <div>
                  <label class="modal-form-label">Space</label>
                  <select 
                    class="modal-form-input"
                    value={spaceId()}
                    onChange={(e) => setSpaceId(e.currentTarget.value)}
                  >
                    <For each={props.spaces}>
                      {(sp) => (
                        <option value={sp.id}>{sp.name}</option>
                      )}
                    </For>
                  </select>
                </div>
              </Show>

              {/* Status */}
              <div>
                <label class="modal-form-label">Status</label>
                <select 
                  class="modal-form-input"
                  value={status()}
                  onChange={(e) => setStatus(e.currentTarget.value)}
                >
                  <For each={STATUS_OPTIONS}>
                    {(opt) => (
                      <option value={opt.value}>{opt.label}</option>
                    )}
                  </For>
                </select>
              </div>

              {/* Description */}
              <div>
                <label class="modal-form-label">Description (Optional)</label>
                <textarea 
                  rows={3}
                  value={description()} 
                  onInput={(e) => setDescription(e.currentTarget.value)}
                  placeholder="Ringkasan atau tujuan dari project ini..."
                  class="modal-form-input"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Footer Actions */}
              <div class="modal-footer-row">
                <div>
                  <Show when={props.projectToEdit}>
                    <button 
                      type="button"
                      class="btn-ghost-danger"
                      onClick={() => setConfirmDelete(true)}
                      title="Delete Project"
                    >
                      <Trash2 size={14} />
                      <span>Hapus</span>
                    </button>
                  </Show>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    class="btn-secondary"
                    onClick={props.onClose}
                    disabled={loading()}
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    class="btn-primary"
                    disabled={loading()}
                  >
                    {loading() ? 'Menyimpan...' : props.projectToEdit ? 'Simpan' : 'Buat Project'}
                  </button>
                </div>
              </div>
            </form>
          </Show>
        </div>
      </div>
    </Show>
  );
};
