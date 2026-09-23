import type { Component } from 'solid-js';
import { createSignal, createEffect, Show, For } from 'solid-js';
import { X, Trash2, Briefcase, User, Rocket, Layers, Folder, Globe, Sparkles } from 'lucide-solid';
import { api, type Space } from '../services/api';

interface SpaceModalProps {
  isOpen: boolean;
  spaceToEdit: Space | null;
  onClose: () => void;
  onSaved: (space: Space) => void;
  onDeleted?: (spaceId: string) => void;
}

const COLOR_PRESETS = [
  { label: 'Lavender', value: '#8b8df8' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Cyan', value: '#44e1de' },
  { label: 'Teal', value: '#00c5c2' },
  { label: 'Violet', value: '#cebdff' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Emerald', value: '#10b981' },
];

const ICON_PRESETS = [
  { id: 'briefcase', icon: Briefcase },
  { id: 'user', icon: User },
  { id: 'rocket', icon: Rocket },
  { id: 'layers', icon: Layers },
  { id: 'folder', icon: Folder },
  { id: 'globe', icon: Globe },
  { id: 'sparkles', icon: Sparkles },
];

export const SpaceModal: Component<SpaceModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [color, setColor] = createSignal(COLOR_PRESETS[0].value);
  const [icon, setIcon] = createSignal(ICON_PRESETS[0].id);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  createEffect(() => {
    if (props.isOpen) {
      setError('');
      setConfirmDelete(false);
      if (props.spaceToEdit) {
        setName(props.spaceToEdit.name);
        setColor(props.spaceToEdit.color || COLOR_PRESETS[0].value);
        setIcon(props.spaceToEdit.icon || ICON_PRESETS[0].id);
      } else {
        setName('');
        setColor(COLOR_PRESETS[0].value);
        setIcon(ICON_PRESETS[0].id);
      }
    }
  });

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const trimmed = name().trim();
    if (!trimmed) {
      setError('Space name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (props.spaceToEdit) {
        const updated = await api.updateSpace(props.spaceToEdit.id, {
          name: trimmed,
          color: color(),
          icon: icon(),
        });
        props.onSaved(updated);
      } else {
        const slug = trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `space-${Date.now()}`;

        const created = await api.createSpace({
          name: trimmed,
          slug,
          color: color(),
          icon: icon(),
          sort_order: 10,
        });
        props.onSaved(created);
      }
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save space');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!props.spaceToEdit) return;
    setLoading(true);
    setError('');

    try {
      await api.deleteSpace(props.spaceToEdit.id);
      if (props.onDeleted) {
        props.onDeleted(props.spaceToEdit.id);
      }
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete space');
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
        <div class="modal-card">
          {/* Header */}
          <div class="modal-header">
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <div 
                style={{
                  width: '10px',
                  height: '10px',
                  "border-radius": '50%',
                  "background-color": color()
                }}
              />
              <h3 class="modal-title">
                {props.spaceToEdit ? 'Edit Space' : 'New Space'}
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
            <div class="modal-error-badge">
              {error()}
            </div>
          </Show>

          {/* Delete Confirmation Alert */}
          <Show when={confirmDelete()}>
            <div class="modal-delete-confirm-box">
              <div style={{ "font-weight": 600, "margin-bottom": '4px' }}>
                Hapus Space "{props.spaceToEdit?.name}"?
              </div>
              <div style={{ "font-size": '11px', color: 'var(--text-muted)', "margin-bottom": '12px' }}>
                Seluruh project, canvas boards, dokumen, dan tasks di dalam space ini akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
              </div>
              <div style={{ display: 'flex', gap: '8px', "justify-content": 'flex-end' }}>
                <button 
                  type="button"
                  class="btn-secondary"
                  style={{ padding: '4px 10px', "font-size": '11px' }}
                  onClick={() => setConfirmDelete(false)}
                  disabled={loading()}
                >
                  Batal
                </button>
                <button 
                  type="button"
                  class="btn-danger"
                  style={{ padding: '4px 10px', "font-size": '11px' }}
                  onClick={handleDelete}
                  disabled={loading()}
                >
                  {loading() ? 'Menghapus...' : 'Ya, Hapus Space'}
                </button>
              </div>
            </div>
          </Show>

          <Show when={!confirmDelete()}>
            <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
              {/* Name Field */}
              <div>
                <label class="modal-form-label">Space Name</label>
                <input 
                  type="text" 
                  autofocus
                  value={name()} 
                  onInput={(e) => setName(e.currentTarget.value)}
                  placeholder="e.g. Kantor, Pribadi, Bisnis A..."
                  class="modal-form-input"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label class="modal-form-label">Theme Color</label>
                <div style={{ display: 'flex', gap: '8px', "flex-wrap": 'wrap', "margin-top": '4px' }}>
                  <For each={COLOR_PRESETS}>
                    {(cp) => (
                      <button
                        type="button"
                        onClick={() => setColor(cp.value)}
                        style={{
                          width: '26px',
                          height: '26px',
                          "border-radius": '50%',
                          "background-color": cp.value,
                          border: color() === cp.value ? '2px solid #ffffff' : '2px solid transparent',
                          outline: color() === cp.value ? `2px solid ${cp.value}` : 'none',
                          cursor: 'pointer',
                          transition: 'transform 0.1s ease',
                          transform: color() === cp.value ? 'scale(1.15)' : 'scale(1)',
                        }}
                        title={cp.label}
                      />
                    )}
                  </For>
                </div>
              </div>

              {/* Icon Presets */}
              <div>
                <label class="modal-form-label">Icon</label>
                <div style={{ display: 'flex', gap: '6px', "flex-wrap": 'wrap', "margin-top": '4px' }}>
                  <For each={ICON_PRESETS}>
                    {(ip) => {
                      const IconComp = ip.icon;
                      const isSelected = () => icon() === ip.id;
                      return (
                        <button
                          type="button"
                          onClick={() => setIcon(ip.id)}
                          style={{
                            width: '32px',
                            height: '32px',
                            "border-radius": '6px',
                            display: 'flex',
                            "align-items": 'center',
                            "justify-content": 'center',
                            border: isSelected() ? `1px solid ${color()}` : '1px solid var(--border-default)',
                            background: isSelected() ? 'var(--surface-container-high)' : 'var(--surface-container)',
                            color: isSelected() ? color() : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <IconComp size={15} />
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>

              {/* Footer Actions */}
              <div class="modal-footer-row">
                <div>
                  <Show when={props.spaceToEdit}>
                    <button 
                      type="button"
                      class="btn-ghost-danger"
                      onClick={() => setConfirmDelete(true)}
                      title="Delete Space"
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
                    {loading() ? 'Menyimpan...' : props.spaceToEdit ? 'Simpan' : 'Buat Space'}
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
