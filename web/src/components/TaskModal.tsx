import { openExport } from '../services/transfer';
import { TASK_STATUS_OPTIONS as STATUS_OPTIONS } from '../services/taskContract';
import { focusScope } from './focusScope';
import type { Component } from 'solid-js';
import { createSignal, createEffect, onCleanup, Show, For, untrack } from 'solid-js';
import '../styles/subtasks.css';
import { X, Trash2, CheckSquare, Square, Plus } from 'lucide-solid';
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


const PRIORITY_OPTIONS: { value: Task['priority']; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'var(--text-muted)' },
  { value: 'medium', label: 'Medium', color: 'var(--primary)' },
  { value: 'high', label: 'High', color: 'var(--tertiary)' },
  { value: 'urgent', label: 'Urgent', color: 'var(--status-error)' },
];

export const TaskModal: Component<TaskModalProps> = (props) => {
  const [activeTask, setActiveTask] = createSignal<Task | null>(null);
  const [children, setChildren] = createSignal<Task[]>([]);
  const [childrenLoading, setChildrenLoading] = createSignal(false);
  const [childrenError, setChildrenError] = createSignal('');
  const [childTitle, setChildTitle] = createSignal('');
  const [childBusy, setChildBusy] = createSignal(false);
  const [autoComplete, setAutoComplete] = createSignal(false);
  const [delegating, setDelegating] = createSignal(false);
  const [delegatedTo, setDelegatedTo] = createSignal('');
  const [followUpDate, setFollowUpDate] = createSignal('');
  const [delegationNote, setDelegationNote] = createSignal('');
  let recipientInput: HTMLInputElement | undefined;
  const hydrateDelegation = (task: Task | null) => { setDelegating(!!task?.delegated_to); setDelegatedTo(task?.delegated_to || ''); setFollowUpDate(task?.follow_up_date?.slice(0, 10) || ''); setDelegationNote(task?.delegation_note || ''); };
  const clearDelegation = () => { setDelegating(false); setDelegatedTo(''); setFollowUpDate(''); setDelegationNote(''); };
  const [plannedDate, setPlannedDate] = createSignal('');
  let childInput: HTMLInputElement | undefined;
  let generation = 0;
  onCleanup(() => { generation++; });
  const [title, setTitle] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [status, setStatus] = createSignal<Task['status']>('todo');
  const [priority, setPriority] = createSignal<Task['priority']>('medium');
  const [dueDate, setDueDate] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);

  const closeModal = () => { if (!loading() && !childBusy()) props.onClose(); };

  createEffect(() => {
    const sourceTask = props.taskToEdit;
    if (props.isOpen) {
      setError('');
      setConfirmDelete(false);
      untrack(() => { setActiveTask(sourceTask); hydrateDelegation(sourceTask);
      setChildTitle(''); setChildren([]); setChildrenError('');
      if (props.taskToEdit) {
        setTitle(props.taskToEdit.title);
        setDescription(props.taskToEdit.description || '');
        setStatus(props.taskToEdit.status || 'todo');
        setPriority(props.taskToEdit.priority || 'medium');
        setDueDate(props.taskToEdit.due_date ? props.taskToEdit.due_date.slice(0, 10) : '');
        setPlannedDate(props.taskToEdit.planned_date?.slice(0, 10) || '');
        setAutoComplete(!!props.taskToEdit.auto_complete_subtasks);
      } else {
        setPlannedDate(''); setAutoComplete(false);
        setTitle('');
        setDescription('');
        setStatus(props.defaultStatus || 'todo');
        setPriority('medium');
        setDueDate('');
      }
      void loadChildren(); });
    } else { generation++; }
  });

  const loadChildren = async () => {
    const task = activeTask(); const ticket = ++generation;
    if (!task) { setChildrenLoading(false); return; }
    setChildrenLoading(true); setChildrenError('');
    try {
      const items = await api.getTasks({ parent_task_id: task.id });
      if (ticket === generation) setChildren(items.filter(item => item.parent_task_id === task.id).sort((a,b) => a.created_at.localeCompare(b.created_at)));
    } catch (err) { if (ticket === generation) setChildrenError(err instanceof Error ? err.message : 'Subtask gagal dimuat.'); }
    finally { if (ticket === generation) setChildrenLoading(false); }
  };
  const dirty = () => { const t = activeTask(); return !!t && (title() !== t.title || description() !== (t.description || '') || status() !== t.status || priority() !== t.priority || dueDate() !== (t.due_date?.slice(0,10) || '') || plannedDate() !== (t.planned_date?.slice(0,10) || '') || autoComplete() !== !!t.auto_complete_subtasks || delegating() !== !!t.delegated_to || delegatedTo() !== (t.delegated_to || '') || followUpDate() !== (t.follow_up_date?.slice(0,10) || '') || delegationNote() !== (t.delegation_note || '')); };
  const openTask = async (id: string) => {
    if (childBusy() || loading()) return;
    if ((dirty() || childTitle().trim()) && !window.confirm('Perubahan belum disimpan. Buang perubahan dan buka task lain?')) return;
    setChildBusy(true); setError('');
    const ticket = ++generation;
    try {
      const task = await api.getTask(id);
      if (ticket !== generation) return;
      setActiveTask(task); hydrateDelegation(task); setTitle(task.title); setDescription(task.description || ''); setStatus(task.status); setPriority(task.priority);
      setDueDate(task.due_date?.slice(0,10) || ''); setPlannedDate(task.planned_date?.slice(0,10) || ''); setAutoComplete(!!task.auto_complete_subtasks); setConfirmDelete(false); setChildTitle(''); setChildren([]);
      await loadChildren();
    } catch (err) { if (ticket === generation) setError(err instanceof Error ? err.message : 'Task gagal dibuka.'); }
    finally { setChildBusy(false); }
  };
  const refreshActive = async () => {
    const task = activeTask(); if (!task) return;
    const ticket = generation;
    const updated = await api.getTask(task.id);
    if (ticket !== generation) return;
    // Do not bless a newer version if unrelated edits could overwrite another tab.
    const fields = ['title', 'description', 'priority', 'due_date', 'planned_date', 'auto_complete_subtasks', 'delegated_to', 'follow_up_date', 'delegation_note'] as const;
    if (fields.some(key => updated[key] !== task[key])) throw new Error('Task berubah di tempat lain. Tutup dan buka kembali sebelum menyimpan detail. Perubahan subtask sudah tersimpan.');
    if (status() === task.status) setStatus(updated.status);
    setActiveTask(updated);
  };
  const addChild = async () => {
    const task = activeTask(); const value = childTitle().trim();
    if (!task || !value || childBusy() || childrenError() || childrenLoading()) return;
    setChildBusy(true); setError('');
    try {
      const created = await api.createTask({ title: value, space_id: task.space_id, project_id: task.project_id, parent_task_id: task.id });
      setChildren(items => [...items, created]); setChildTitle(''); await refreshActive();
    } catch (err) { setError(err instanceof Error ? err.message : 'Subtask gagal ditambahkan.'); }
    finally { setChildBusy(false); childInput?.focus(); }
  };
  const toggleChild = async (child: Task) => {
    if (childBusy()) return;
    setChildBusy(true); setError('');
    try {
      const updated = await api.updateTaskStatus(child.id, child.status === 'done' ? 'todo' : 'done', child.updated_at);
      setChildren(items => items.map(item => item.id === child.id ? updated : item)); await refreshActive();
    } catch (err) { setError(err instanceof Error ? err.message : 'Status gagal disimpan.'); await loadChildren(); }
    finally { setChildBusy(false); }
  };
  const detach = async () => {
    const task = activeTask(); if (!task || childBusy()) return;
    if (dirty() && !window.confirm('Simpan perubahan terlebih dahulu, atau buang perubahan untuk melepas subtask?')) return;
    setChildBusy(true); setError('');
    try {
      const updated = await api.updateTask(task.id, { parent_task_id: null, expected_updated_at: task.updated_at });
      setActiveTask(updated); hydrateDelegation(updated); setTitle(updated.title); setDescription(updated.description || ''); setStatus(updated.status); setPriority(updated.priority); setDueDate(updated.due_date?.slice(0,10) || ''); setPlannedDate(updated.planned_date?.slice(0,10) || ''); setAutoComplete(!!updated.auto_complete_subtasks);
      await loadChildren();
    } catch (err) { setError(err instanceof Error ? err.message : 'Subtask gagal dilepas.'); }
    finally { setChildBusy(false); }
  };

  const handleSave = async (e?: Event) => {
    if (loading() || childBusy() || childrenLoading()) { e?.preventDefault(); return; }
    if (e) e.preventDefault();
    const trimmedTitle = title().trim();
    if (!trimmedTitle) {
      setError('Task title is required');
      return;
    }

    if (delegating() && !delegatedTo().trim()) { setError('Isi nama penanggung jawab.'); recipientInput?.focus(); return; }
    setLoading(true);
    setError('');

    try {
      if (activeTask()) {
        const updated = await api.updateTask(activeTask()!.id, {
          expected_updated_at: activeTask()!.updated_at,
          delegated_to: delegating() ? delegatedTo().trim() : null,
          follow_up_date: delegating() && followUpDate() ? followUpDate() : null,
          delegation_note: delegating() && delegationNote().trim() ? delegationNote().trim() : null,
          title: trimmedTitle,
          description: description().trim() || null,
          planned_date: plannedDate() || null,
          auto_complete_subtasks: autoComplete(),
          status: status(),
          priority: priority(),
          due_date: dueDate() ? `${dueDate()}T00:00:00Z` : null,
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
          due_date: dueDate() ? `${dueDate()}T00:00:00Z` : undefined,
          planned_date: plannedDate() || undefined,
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
    if (!activeTask() || loading() || childBusy() || childrenLoading() || childrenError()) return;
    setLoading(true);
    setError('');
    try {
      await api.deleteTask(activeTask()!.id);
      if (props.onDeleted) {
        props.onDeleted(activeTask()!.id);
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
        aria-busy={loading() || childBusy()}
        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      >
        <div ref={el => focusScope(el, closeModal)} class="modal-card" style={{ "max-width": '540px' }}>
          {/* Header */}
          <div class="modal-header">
            <div style={{ display: 'flex', "align-items": 'center', gap: "var(--space-2)" }}>
              <CheckSquare size={18} color="var(--primary)" />
              <h3 class="modal-title">
                {activeTask() ? 'Edit Task' : 'New Task'}
              </h3>
            </div>
            <button 
              type="button"
              onClick={closeModal}
              class="btn-ghost-icon"
              aria-label="Close modal" disabled={loading() || childBusy()}
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
              padding: "var(--space-4)",
              "border-radius": '8px',
              "background-color": 'var(--error-surface)',
              border: '1px solid var(--error-surface)',
              display: 'flex',
              "flex-direction": 'column',
              gap: "var(--space-3)"
            }}>
              <p style={{ margin: 0, "font-size": '13px', color: 'var(--text-main)', "line-height": 1.5 }}>
                Hapus task <strong>"{title()}"</strong>{activeTask()?.descendant_count ? ` beserta ${activeTask()!.descendant_count} subtask` : ''}? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div style={{ display: 'flex', "justify-content": 'flex-end', gap: "var(--space-2)" }}>
                <button
                  type="button"
                  class="btn-secondary"
                  onClick={() => setConfirmDelete(false)}
                  disabled={loading() || childBusy()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn-primary"
                  style={{ "background-color": 'var(--status-error)', color: 'var(--background)' }}
                  onClick={handleDelete}
                  disabled={loading()}
                >
                  {loading() ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </Show>

          <Show when={!confirmDelete()}>
            <form onSubmit={handleSave} style={{ display: 'flex', "flex-direction": 'column', gap: "var(--space-4)" }}>
              <Show when={activeTask()?.parent_task_id}><div class="task-parent-context">
                <button type="button" class="task-parent-link" onClick={() => openTask(activeTask()!.parent_task_id!)} disabled={childBusy()}>Kembali ke {activeTask()?.parent_title || 'task induk'}</button>
                <button type="button" class="task-parent-link task-detach" onClick={detach} disabled={childBusy()}>Jadikan task mandiri</button>
              </div></Show>
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
                  style={{ "font-size": '14px', padding: "var(--space-3) var(--space-3)" }}
                />
              </div>

              {/* Status and Priority Row */}
              <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: "var(--space-4)" }}>
                <div>
                  <label class="modal-form-label">Status</label>
                  <select
                    value={status()}
                    onChange={e => setStatus(e.currentTarget.value as Task['status'])}
                    class="modal-form-input"
                    style={{ padding: "var(--space-2) var(--space-3)", "font-size": '13px' }}
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
                    style={{ padding: "var(--space-2) var(--space-3)", "font-size": '13px' }}
                  >
                    <For each={PRIORITY_OPTIONS}>
                      {(opt) => (
                        <option value={opt.value}>{opt.label}</option>
                      )}
                    </For>
                  </select>
                </div>
              </div>

              <div><label class="modal-form-label" for="task-planned-date">Planned date (Optional)</label><input id="task-planned-date" type="date" value={plannedDate()} onInput={e => setPlannedDate(e.currentTarget.value)} class="modal-form-input" /></div>
              {/* Due Date */}
              <div>
                <label class="modal-form-label">Due Date (Optional)</label>
                <input 
                  type="date" 
                  value={dueDate()} 
                  onInput={e => setDueDate(e.currentTarget.value)}
                  class="modal-form-input"
                  style={{ padding: "var(--space-2) var(--space-3)", "font-size": '13px' }}
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

              <section class="task-delegation" aria-label="Delegasi task">
                <Show when={!delegating()} fallback={<>
                  <div class="task-delegation-heading"><h4>Delegasi</h4><button type="button" class="task-parent-link" disabled={loading() || childBusy()} onClick={clearDelegation}>Cabut delegasi</button></div>
                  <div class="task-delegation-fields"><div><label class="modal-form-label" for="task-delegated-to">Penanggung jawab</label><input id="task-delegated-to" ref={recipientInput} class="modal-form-input" maxlength={255} value={delegatedTo()} placeholder="Nama rekan, vendor, atau klien" onInput={event => setDelegatedTo(event.currentTarget.value)} disabled={loading() || childBusy()} /></div>
                  <div><label class="modal-form-label" for="task-follow-up-date">Tanggal follow-up (opsional)</label><input id="task-follow-up-date" class="modal-form-input" type="date" value={followUpDate()} onInput={event => setFollowUpDate(event.currentTarget.value)} disabled={loading() || childBusy()} /></div></div>
                  <div><label class="modal-form-label" for="task-delegation-note">Catatan delegasi (opsional)</label><textarea id="task-delegation-note" class="modal-form-input" rows={2} maxlength={4000} value={delegationNote()} placeholder="Apa yang sedang ditunggu?" onInput={event => setDelegationNote(event.currentTarget.value)} disabled={loading() || childBusy()} /></div>
                </>}><button type="button" class="btn-secondary" disabled={loading() || childBusy()} onClick={() => { setDelegating(true); queueMicrotask(() => recipientInput?.focus()); }}>Delegasikan</button></Show>
              </section>
              <Show when={activeTask() && (!activeTask()?.parent_task_id || children().length > 0)}>
                <section class="task-subtasks" aria-label="Subtask">
                  <div class="task-subtasks-heading"><h4>Subtask</h4><span aria-live="polite">{children().filter(t => t.status === 'done').length} dari {children().filter(t => t.status !== 'cancelled').length} selesai</span></div>
                  <Show when={childrenLoading()}><p class="task-subtasks-empty">Memuat subtask…</p></Show>
                  <Show when={childrenError()}><p role="alert" class="modal-error-badge">{childrenError()} <button type="button" class="task-parent-link" onClick={() => void loadChildren()}>Coba lagi</button></p></Show>
                  <Show when={!childrenLoading() && !childrenError() && !children().length}><p class="task-subtasks-empty">Pecah pekerjaan ini menjadi langkah kecil.</p></Show>
                  <ul class="task-subtask-list"><For each={children()}>{child => <li class="task-subtask-row" data-done={child.status === 'done'}>
                    <button type="button" class="task-subtask-toggle" aria-label={child.status === 'done' ? 'Buka kembali ' + child.title : 'Selesaikan ' + child.title} aria-pressed={child.status === 'done'} disabled={childBusy() || loading() || child.status === 'cancelled'} onClick={() => toggleChild(child)}>{child.status === 'done' ? <CheckSquare size={18} /> : <Square size={18} />}</button>
                    <button type="button" class="task-subtask-open" disabled={childBusy() || loading()} onClick={() => openTask(child.id)}><span>{child.title}</span><Show when={child.status === 'cancelled' || child.due_date}><small>{child.status === 'cancelled' ? 'Dibatalkan' : 'Due ' + child.due_date?.slice(0, 10)}</small></Show></button>
                  </li>}</For></ul>
                  <Show when={!activeTask()?.parent_task_id}><div class="task-subtask-add">
                    <input ref={childInput} class="modal-form-input" aria-label="Judul subtask" placeholder="Tambah subtask, lalu Enter…" value={childTitle()} disabled={childBusy() || loading() || childrenLoading()} onInput={e => setChildTitle(e.currentTarget.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); void addChild(); } }} />
                    <button type="button" class="btn-secondary" aria-label="Tambah subtask" disabled={!childTitle().trim() || childBusy() || loading() || childrenLoading()} onClick={addChild}><Plus size={16} /></button>
                  </div>
                  <label class="task-subtask-rule" for="task-auto-subtasks"><input id="task-auto-subtasks" type="checkbox" checked={autoComplete()} disabled={childBusy()} onChange={e => setAutoComplete(e.currentTarget.checked)} /><span>Selesaikan task ini ketika semua subtask selesai. Berlaku setelah disimpan.</span></label></Show>
                </section>
              </Show>
              {/* Footer Actions */}
              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-top": "var(--space-2)", "padding-top": "var(--space-4)", "border-top": '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', "flex-wrap": 'wrap' }}>
                  <Show when={activeTask()}><button type="button" class="btn-secondary" disabled={loading() || childBusy()} onClick={() => openExport({ kind: 'task', id: activeTask()!.id, name: activeTask()!.title })}>Export</button></Show>
                  <Show when={activeTask()}>
                    <button
                      type="button"
                      class="btn-ghost-danger"
                      onClick={() => setConfirmDelete(true)} disabled={loading() || childBusy() || childrenLoading() || !!childrenError()}
                      title="Delete Task"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </Show>
                </div>

                <div style={{ display: 'flex', gap: "var(--space-2)" }}>
                  <button 
                    type="button" 
                    onClick={closeModal}
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
                    {loading() ? 'Saving...' : activeTask() ? 'Save Changes' : 'Create Task'}
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
