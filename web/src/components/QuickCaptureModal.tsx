import type { Component } from 'solid-js';
import { createSignal, createEffect, Show, For } from 'solid-js';
import { Bolt, X, Link, Folder } from 'lucide-solid';
import { api } from '../services/api';
import type { Space } from '../services/api';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated?: () => void;
}

export const QuickCaptureModal: Component<QuickCaptureModalProps> = (props) => {
  const [type, setType] = createSignal<'Document' | 'Task'>('Task');
  const [title, setTitle] = createSignal('');
  const [note, setNote] = createSignal('');
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  // Re-fetch spaces and reset form whenever modal opens
  createEffect(async () => {
    if (props.isOpen) {
      setError('');
      setTitle('');
      setNote('');
      try {
        const data = await api.getSpaces();
        if (data && data.length > 0) {
          setSpaces(data);
          if (!selectedSpaceId() || !data.some(s => s.id === selectedSpaceId())) {
            setSelectedSpaceId(data[0].id);
          }
        }
      } catch (_) {}
    }
  });

  const handleSave = async (e?: Event) => {
    if (e) e.preventDefault();
    if (!title().trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const spaceId = selectedSpaceId() || (spaces()[0]?.id || '');
      if (!spaceId) {
        throw new Error('No active space found to associate item with.');
      }

      if (type() === 'Task') {
        await api.createTask({
          title: title().trim(),
          description: note().trim() || undefined,
          space_id: spaceId,
          status: 'todo',
          priority: 'medium',
        });
      } else {
        await api.createDocument({
          title: title().trim(),
          content: note().trim() || 'Quick captured document draft...',
          space_id: spaceId,
          doc_type: 'notes',
          is_pinned: false,
        });
      }

      setTitle('');
      setNote('');
      props.onClose();
      if (props.onItemCreated) props.onItemCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to capture item');
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
          {/* Modal Header */}
          <div class="modal-header">
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <Bolt size={16} color="var(--brand-secondary, #44e1de)" />
              <h3 class="modal-title">
                Quick Capture & Ingestion
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

          <Show when={error()}>
            <div class="modal-error-badge">
              {error()}
            </div>
          </Show>

          <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: '14px' }}>
            {/* Target Type switcher */}
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <span class="modal-form-label" style={{ margin: 0 }}>Target Type</span>
              <div style={{ display: 'flex', gap: '4px', padding: '2px', "border-radius": '6px', "background-color": 'var(--surface-container)', border: '1px solid var(--border-default)' }}>
                <button 
                  type="button"
                  onClick={() => setType('Task')}
                  style={{
                    padding: '4px 12px',
                    "border-radius": '4px',
                    border: 'none',
                    "background-color": type() === 'Task' ? 'rgba(68, 225, 222, 0.2)' : 'transparent',
                    color: type() === 'Task' ? 'var(--brand-secondary, #44e1de)' : 'var(--text-muted)',
                    "font-weight": type() === 'Task' ? 600 : 400,
                    "font-size": '11px',
                    cursor: 'pointer'
                  }}
                >
                  Task
                </button>
                <button 
                  type="button"
                  onClick={() => setType('Document')}
                  style={{
                    padding: '4px 12px',
                    "border-radius": '4px',
                    border: 'none',
                    "background-color": type() === 'Document' ? 'rgba(139, 141, 248, 0.2)' : 'transparent',
                    color: type() === 'Document' ? 'var(--brand-primary, #8b8df8)' : 'var(--text-muted)',
                    "font-weight": type() === 'Document' ? 600 : 400,
                    "font-size": '11px',
                    cursor: 'pointer'
                  }}
                >
                  Document
                </button>
              </div>
            </div>

            {/* Space Selector */}
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <span class="modal-form-label" style={{ margin: 0 }}>Space</span>
              <select
                value={selectedSpaceId()}
                onChange={e => setSelectedSpaceId(e.currentTarget.value)}
                class="modal-form-input"
                style={{ width: 'auto', "min-width": '160px', padding: '4px 8px', "font-size": '12px' }}
              >
                <For each={spaces()}>
                  {(sp) => (
                    <option value={sp.id}>{sp.name}</option>
                  )}
                </For>
              </select>
            </div>

            {/* Title */}
            <div>
              <label class="modal-form-label">Title</label>
              <input 
                autofocus
                type="text" 
                value={title()} 
                onInput={e => setTitle(e.currentTarget.value)}
                placeholder={type() === 'Task' ? "e.g., Finalize export..." : "e.g., Visual design guidelines..."}
                class="modal-form-input"
              />
            </div>

            {/* Description / Content */}
            <div>
              <label class="modal-form-label">
                {type() === 'Task' ? 'Task Details / Context' : 'Document Markdown Content'}
              </label>
              <textarea 
                rows={3} 
                value={note()}
                onInput={e => setNote(e.currentTarget.value)}
                placeholder="Key thoughts, architectural notes, or markdown bullet points..."
                class="modal-form-input"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Footer Row */}
            <div class="modal-footer-row" style={{ "margin-top": '8px', "padding-top": '12px' }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: '6px', color: 'var(--text-dim)', "font-size": '11px' }}>
                <Folder size={13} />
                <span>{type() === 'Task' ? 'Inbox Triage' : 'Document Store'}</span>
              </div>
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={props.onClose} 
                  class="btn-secondary"
                  disabled={loading()}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  class="btn-primary"
                  disabled={loading()}
                  style={{ display: 'flex', "align-items": 'center', gap: '5px' }}
                >
                  <Link size={13} />
                  <span>{loading() ? 'Saving...' : `Capture ${type()}`}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};
