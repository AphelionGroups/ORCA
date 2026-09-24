import type { Component } from 'solid-js';
import { createSignal, createEffect, Show, For } from 'solid-js';
import { Bolt, X, CheckSquare, FileText } from 'lucide-solid';
import { api } from '../services/api';
import type { Space, Project } from '../services/api';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated?: () => void;
}

export const QuickCaptureModal: Component<QuickCaptureModalProps> = (props) => {
  const [type, setType] = createSignal<'Task' | 'Document'>('Task');
  const [title, setTitle] = createSignal('');
  const [note, setNote] = createSignal('');
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
      setTitle('');
      setNote('');
      setDueDate('');
      setPriority('medium');
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
    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const spaceId = selectedSpaceId() || (spaces()[0]?.id || '');
      if (!spaceId) {
        throw new Error('Please select a space for this item.');
      }

      if (type() === 'Task') {
        await api.createTask({
          title: trimmedTitle,
          description: note().trim() || undefined,
          space_id: spaceId,
          project_id: selectedProjectId() || undefined,
          status: 'todo',
          priority: priority(),
          due_date: dueDate() || undefined,
        });
      } else {
        await api.createDocument({
          title: trimmedTitle,
          content: note().trim() || 'Quick captured document draft...',
          space_id: spaceId,
          project_id: selectedProjectId() || undefined,
          doc_type: 'notes',
          is_pinned: false,
        });
      }

      setTitle('');
      setNote('');
      props.onClose();
      if (props.onItemCreated) {
        props.onItemCreated();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to capture item');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Show when={props.isOpen}>
      <div 
        class="modal-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
      >
        <div class="modal-card" style={{ "max-width": '540px' }} onKeyDown={handleKeyDown}>
          {/* Modal Header */}
          <div class="modal-header">
            <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                "border-radius": '8px',
                "background-color": 'rgba(68, 225, 222, 0.12)',
                display: 'flex',
                "align-items": 'center',
                "justify-content": 'center'
              }}>
                <Bolt size={18} color="var(--secondary)" />
              </div>
              <div>
                <h3 class="modal-title" style={{ "font-size": '16px', "font-weight": 600 }}>
                  Quick Capture
                </h3>
                <p style={{ margin: 0, "font-size": '12px', color: 'var(--text-muted)' }}>
                  Rapidly capture a task or document from anywhere (Ctrl+K)
                </p>
              </div>
            </div>
            <button 
              type="button"
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

          <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
            {/* Target Type Selector */}
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <span class="modal-form-label" style={{ margin: 0 }}>Item Type</span>
              <div class="segmented-control">
                <button 
                  type="button"
                  onClick={() => setType('Task')}
                  class={`seg-btn ${type() === 'Task' ? 'active' : ''}`}
                  style={{ display: 'flex', "align-items": 'center', gap: '6px', padding: '6px 14px' }}
                >
                  <CheckSquare size={13} />
                  <span>Task</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setType('Document')}
                  class={`seg-btn ${type() === 'Document' ? 'active' : ''}`}
                  style={{ display: 'flex', "align-items": 'center', gap: '6px', padding: '6px 14px' }}
                >
                  <FileText size={13} />
                  <span>Document</span>
                </button>
              </div>
            </div>

            {/* Space & Project Selectors */}
            <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '12px' }}>
              <div>
                <label class="modal-form-label">Space</label>
                <select
                  value={selectedSpaceId()}
                  onChange={e => {
                    setSelectedSpaceId(e.currentTarget.value);
                    setSelectedProjectId('');
                  }}
                  class="modal-form-input"
                  style={{ padding: '8px 10px', "font-size": '13px' }}
                >
                  <For each={spaces()}>
                    {(sp) => (
                      <option value={sp.id}>{sp.name}</option>
                    )}
                  </For>
                </select>
              </div>

              <div>
                <label class="modal-form-label">Project (Optional)</label>
                <select
                  value={selectedProjectId()}
                  onChange={e => setSelectedProjectId(e.currentTarget.value)}
                  class="modal-form-input"
                  style={{ padding: '8px 10px', "font-size": '13px' }}
                >
                  <option value="">No Project (Inbox / General)</option>
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
                {type() === 'Task' ? 'Task Title' : 'Document Title'}
              </label>
              <input 
                autofocus
                type="text" 
                value={title()} 
                onInput={e => setTitle(e.currentTarget.value)}
                placeholder={type() === 'Task' ? "e.g., Finalize API specification" : "e.g., Q4 Roadmap & Strategic Initiatives"}
                class="modal-form-input"
                style={{ "font-size": '14px', padding: '10px 12px' }}
              />
            </div>

            {/* If Task: Priority and Due Date */}
            <Show when={type() === 'Task'}>
              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '12px' }}>
                <div>
                  <label class="modal-form-label">Priority</label>
                  <select
                    value={priority()}
                    onChange={e => setPriority(e.currentTarget.value as any)}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '13px' }}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label class="modal-form-label">Due Date (Optional)</label>
                  <input 
                    type="date" 
                    value={dueDate()} 
                    onInput={e => setDueDate(e.currentTarget.value)}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '13px' }}
                  />
                </div>
              </div>
            </Show>

            {/* Description / Content */}
            <div>
              <label class="modal-form-label">
                {type() === 'Task' ? 'Notes / Context (Optional)' : 'Document Content (Markdown)'}
              </label>
              <textarea 
                rows={4} 
                value={note()}
                onInput={e => setNote(e.currentTarget.value)}
                placeholder={type() === 'Task' ? "Add details or background info..." : "Type document thoughts, draft notes, or markdown..."}
                class="modal-form-input"
                style={{ resize: 'vertical', "font-size": '13px', "line-height": 1.5 }}
              />
            </div>

            {/* Footer Row */}
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-top": '6px', "padding-top": '14px', "border-top": '1px solid var(--border-default)' }}>
              <span style={{ "font-size": '11px', color: 'var(--text-dim)' }}>
                Tip: Press <kbd style={{ padding: '2px 5px', "border-radius": '3px', background: 'var(--surface-container-high)', border: '1px solid var(--border-default)' }}>Ctrl+Enter</kbd> to save
              </span>

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
                  style={{ display: 'flex', "align-items": 'center', gap: '6px' }}
                >
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
