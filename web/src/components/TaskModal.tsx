import { focusScope } from './focusScope';
import type { Component } from 'solid-js';
import { createSignal, createEffect, Show, For } from 'solid-js';
import { X, Trash2, CheckSquare } from 'lucide-solid';
import { api, type Task } from '../services/api';

interface TaskModalProps {
  isOpen: boolean;
  taskToEdit: Task | null;
  defaultStatus?: Task['status'];
  defaultProjectId?: string;
  defaultSpaceId?: string;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted?: (taskId: string) => void;
}

const STATUS_OPTIONS: { value: Task['status']; label: string }[] = [
  { value: 'todo', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: Task['priority']; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'var(--text-muted)' },
  { value: 'medium', label: 'Medium', color: 'var(--primary)' },
  { value: 'high', label: 'High', color: 'var(--tertiary)' },
  { value: 'urgent', label: 'Urgent', color: 'var(--status-error)' },
];

export const TaskModal: Component<TaskModalProps> = (props) => {
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [status, setStatus] = createSignal<Task['status']>('todo');
  const [priority, setPriority] = createSignal<Task['priority']>('medium');
  const [dueDate, setDueDate] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  createEffect(() => {
    if (props.isOpen) {
      setError('');
      setConfirmDelete(false);
      if (props.taskToEdit) {
        setTitle(props.taskToEdit.title);
        setDescription(props.taskToEdit.description || '');
        setStatus(props.taskToEdit.status || 'todo');
        setPriority(props.taskToEdit.priority || 'medium');
        setDueDate(props.taskToEdit.due_date ? props.taskToEdit.due_date.slice(0, 10) : '');
      } else {
        setTitle('');
        setDescription('');
        setStatus(props.defaultStatus || 'todo');
        setPriority('medium');
        setDueDate('');
      }
    }
  });

  const handleSave = async (e?: Event) => {
    if (e) e.preventDefault();
    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      setError('Task title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (props.taskToEdit) {
        const updated = await api.updateTask(props.taskToEdit.id, {
          title: trimmedTitle,
          description: description().trim() || undefined,
          status: status(),
          priority: priority(),
          due_date: dueDate() || undefined,
        });
        props.onSaved(updated);
      } else {
        if (!props.defaultSpaceId && !props.defaultProjectId) {
          throw new Error('Space or Project is required to create a task');
        }
        const created = await api.createTask({
          title: trimmedTitle,
          description: description().trim() || undefined,
          status: status(),
          priority: priority(),
          due_date: dueDate() || undefined,
          project_id: props.defaultProjectId || undefined,
          space_id: props.defaultSpaceId || '',
        });
        props.onSaved(created);
      }
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!props.taskToEdit) return;
    setLoading(true);
    setError('');
    try {
      await api.deleteTask(props.taskToEdit.id);
      if (props.onDeleted) {
        props.onDeleted(props.taskToEdit.id);
      }
      props.onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
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
        <div class="modal-card" ref={el => focusScope(el, props.onClose)} style={{ "max-width": '540px' }}>
          {/* Header */}
          <div class="modal-header">
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <CheckSquare size={18} color="var(--primary)" />
              <h3 class="modal-title">
                {props.taskToEdit ? 'Edit Task' : 'New Task'}
              </h3>
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
            <div class="modal-error-badge" role="alert">
              {error()}
            </div>
          </Show>

          {/* Delete confirmation */}
          <Show when={confirmDelete()}>
            <div style={{
              padding: '16px',
              "border-radius": '8px',
              "background-color": 'var(--error-surface)',
              border: '1px solid var(--error-surface)',
              display: 'flex',
              "flex-direction": 'column',
              gap: '12px'
            }}>
              <p style={{ margin: 0, "font-size": '13px', color: 'var(--text-main)', "line-height": 1.5 }}>
                Are you sure you want to delete task <strong>"{title()}"</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() => setConfirmDelete(false)}
                  disabled={loading()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  style={{ "background-color": 'var(--status-error)', color: '#fff' }}
                  onClick={handleDelete}
                  disabled={loading()}
                >
                  {loading() ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </Show>

          <Show when={!confirmDelete()}>
            <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
              {/* Title input */}
              <div>
                <label class="modal-form-label">Task Title</label>
                <input 
                  autofocus
                  type="text" 
                  value={title()} 
                  onInput={e => setTitle(e.currentTarget.value)}
                  placeholder="What needs to be done?"
                  class="modal-form-input"
                  style={{ "font-size": '14px', padding: '10px 12px' }}
                />
              </div>

              {/* Status and Priority Row */}
              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '14px' }}>
                <div>
                  <label class="modal-form-label">Status</label>
                  <select
                    value={status()}
                    onChange={e => setStatus(e.currentTarget.value as Task['status'])}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '13px' }}
                  >
                    <For each={STATUS_OPTIONS}>
                      {(opt) => (
                        <option value={opt.value}>{opt.label}</option>
                      )}
                    </For>
                  </select>
                </div>

                <div>
                  <label class="modal-form-label">Priority</label>
                  <select
                    value={priority()}
                    onChange={e => setPriority(e.currentTarget.value as Task['priority'])}
                    class="modal-form-input"
                    style={{ padding: '8px 10px', "font-size": '13px' }}
                  >
                    <For each={PRIORITY_OPTIONS}>
                      {(opt) => (
                        <option value={opt.value}>{opt.label}</option>
                      )}
                    </For>
                  </select>
                </div>
              </div>

              {/* Due Date */}
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

              {/* Description */}
              <div>
                <label class="modal-form-label">Description / Notes (Optional)</label>
                <textarea 
                  rows={4} 
                  value={description()}
                  onInput={e => setDescription(e.currentTarget.value)}
                  placeholder="Add context, specifications, checklist, or criteria..."
                  class="modal-form-input"
                  style={{ resize: 'vertical', "font-size": '13px', "line-height": 1.5 }}
                />
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-top": '8px', "padding-top": '14px', "border-top": '1px solid var(--border-default)' }}>
                <div>
                  <Show when={props.taskToEdit}>
                    <button
                      type="button"
                      class="btn-ghost-danger"
                      onClick={() => setConfirmDelete(true)}
                      title="Delete Task"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </Show>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
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
                  >
                    {loading() ? 'Saving...' : props.taskToEdit ? 'Save Changes' : 'Create Task'}
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
