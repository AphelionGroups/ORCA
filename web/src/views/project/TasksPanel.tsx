import {
  CheckSquare,
  Edit3,
  Kanban,
  List,
  Plus,
  Square,
  Trash2
} from 'lucide-solid';
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { api } from '../../services/api';
import type { ProjectController } from './useProjectController';
export const TasksPanel: Component<{ ctx: ProjectController }> = (props) => {
  const ctx = props.ctx; return (<Show when={ctx.activeTab() === 'tasks'}>
    <div class="tasks-workspace" style={{ height: '100%', "overflow-y": 'auto', padding: '24px 32px', "background-color": 'var(--surface)' }}>
      {/* Task View Mode Switcher & Actions Header */}
      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '20px' }}>
        <div class="segmented-control">
          <button type="button" onClick={() => ctx.setTaskViewMode('kanban')} class={`seg-btn ${ctx.taskViewMode() === 'kanban' ? 'active' : ''}`}>
            <Kanban size={13} />
            <span>Kanban</span>
          </button>
          <button type="button" onClick={() => ctx.setTaskViewMode('list')} class={`seg-btn ${ctx.taskViewMode() === 'list' ? 'active' : ''}`}>
            <List size={13} />
            <span>List</span>
          </button>
        </div>

        <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
          <button type="button" class="btn-primary" onClick={() => ctx.handleOpenNewTaskModal('todo')} style={{ padding: '7px 16px', "font-size": '13px', display: 'flex', "align-items": 'center', gap: '6px' }}>
            <Plus size={14} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* View 1: KANBAN BOARD */}
      <Show when={ctx.taskViewMode() === 'kanban'}>
        <div class="kanban-grid" tabIndex={0} role="region" aria-label="Task columns, scroll horizontally" style={{ display: 'grid', "grid-template-columns": 'repeat(4, minmax(260px, 1fr))', gap: '16px', "align-items": 'flex-start' }}>
          {[
            { key: 'todo' as const, title: 'Backlog', color: 'var(--outline-variant)' },
            { key: 'in_progress' as const, title: 'In Progress', color: 'var(--primary)' },
            { key: 'in_review' as const, title: 'In Review', color: 'var(--tertiary)' },
            { key: 'done' as const, title: 'Done', color: 'var(--secondary)' }
          ].map(col => {
            const colTasks = () => ctx.tasks().filter(t => t.status === col.key);
            const isDragOver = () => ctx.dragOverCol() === col.key;
            return (<div onDragOver={(e) => ctx.handleColDragOver(e, col.key)} onDragLeave={() => ctx.handleColDragLeave(col.key)} onDrop={(e) => ctx.handleColDrop(e, col.key)} style={{
              padding: '14px',
              "border-radius": '8px',
              "background-color": isDragOver() ? 'var(--surface-container-high)' : 'var(--surface-container-low)',
              border: isDragOver() ? '1.5px dashed var(--primary)' : '1px solid var(--border-default)',
              display: 'flex',
              "flex-direction": 'column',
              gap: '12px',
              "min-height": '400px',
              transition: 'background-color 0.15s ease, border-color 0.15s ease'
            }}>
              {/* Column Header */}
              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                  <span style={{ width: '9px', height: '9px', "border-radius": '50%', "background-color": col.color }}></span>
                  <span style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)' }}>{col.title}</span>
                </div>
                <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                  <span style={{ "font-size": '12px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', padding: '1px 6px', "border-radius": '4px', "background-color": 'var(--surface-container-high)' }}>
                    {colTasks().length}
                  </span>
                  <button onClick={() => ctx.handleOpenNewTaskModal(col.key)} title={`Add task in ${col.title}`} style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    display: 'flex',
                    "align-items": 'center',
                    padding: '3px',
                    "border-radius": '4px'
                  }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Task Cards in Column */}
              <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px', flex: 1 }}>
                <For each={colTasks()}>
                  {(t) => (<div draggable={true} onDragStart={(e) => ctx.handleTaskDragStart(e, t.id)} onDragEnd={ctx.handleTaskDragEnd} onClick={() => ctx.handleOpenEditTaskModal(t)} title="Drag to move column, or click to edit" style={{
                    padding: '12px 14px',
                    "border-radius": '7px',
                    "background-color": 'var(--surface-container)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    "flex-direction": 'column',
                    gap: '8px',
                    cursor: 'grab',
                    opacity: ctx.draggedTaskId() === t.id ? 0.45 : 1,
                    transition: 'box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', gap: '8px' }}>
                      <span style={{ "font-size": '12px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        #{t.id.slice(-4)}
                      </span>
                      <span style={{
                        "font-size": '12px',
                        "font-family": 'var(--font-mono)',
                        "text-transform": 'uppercase',
                        padding: '2px 6px',
                        "border-radius": '3px',
                        background: t.priority === 'urgent' ? 'rgba(239, 68, 68, 0.18)' : 'var(--surface-container-high)',
                        color: t.priority === 'urgent' ? '#f87171' : 'var(--text-muted)'
                      }}>
                        {t.priority}
                      </span>
                    </div>
                    <h4 style={{ "font-size": '13px', "font-weight": 500, color: 'var(--text-main)', margin: 0, "line-height": 1.4 }}>
                      {t.title}
                    </h4>
                    <Show when={t.due_date}>
                      <div style={{ display: 'flex', "align-items": 'center', "font-size": '12px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                        <span>Due {new Date(t.due_date!).toLocaleDateString()}</span>
                      </div>
                    </Show>
                  </div>)}
                </For>
              </div>
            </div>);
          })}
        </div>
      </Show>

      {/* View 2: LIST VIEW */}
      <Show when={ctx.taskViewMode() === 'list'}>
        <div style={{ "max-width": '900px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '14px' }}>
          {/* Add Task Button */}
          <button type="button" class="btn-secondary" onClick={() => ctx.handleOpenNewTaskModal('todo')} style={{
            display: 'flex',
            "align-items": 'center',
            gap: '8px',
            padding: '10px 16px',
            "font-size": '13px',
            "border-radius": '8px',
            width: '100%',
            "justify-content": 'center',
            "border-style": 'dashed'
          }}>
            <Plus size={15} />
            <span>Add New Task</span>
          </button>

          {/* Task List Items */}
          <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px' }}>
            <Show when={ctx.tasks().length > 0} fallback={<div style={{ padding: '36px', "text-align": 'center', color: 'var(--text-dim)', "font-size": '13px', "border-radius": '8px', border: '1px dashed var(--border-default)' }}>
              No tasks in this project yet. Click Add New Task to create one.
            </div>}>
              <For each={ctx.tasks()}>
                {(t) => {
                  const isDone = () => t.status === 'done';
                  return (<div style={{
                    display: 'flex',
                    "align-items": 'center',
                    "justify-content": 'space-between',
                    padding: '12px 16px',
                    "border-radius": '8px',
                    "background-color": 'var(--surface-container)',
                    border: '1px solid var(--border-default)',
                    gap: '12px',
                    transition: 'background-color 0.12s ease'
                  }}>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '12px', flex: 1, "min-width": 0 }}>
                      <button type="button" onClick={async (e) => {
                        e.stopPropagation();
                        const nextStatus = t.status === 'done' ? 'todo' : 'done';
                        const projectId = ctx.selectedProjectId();
                        try {
                          const updated = await api.updateTaskStatus(t.id, nextStatus, t.updated_at);
                          if (ctx.selectedProjectId() === projectId) ctx.setTasks(ctx.tasks().map(item => item.id === t.id ? updated : item));
                        }
                        catch (failure) { if (ctx.selectedProjectId() === projectId) ctx.setOperationError(failure instanceof Error ? failure.message : 'Could not update task'); }
                      }} style={{
                        background: 'none',
                        border: 'none',
                        color: isDone() ? 'var(--secondary)' : 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        "align-items": 'center'
                      }} title={isDone() ? 'Mark incomplete' : 'Mark done'}>
                        <Show when={isDone()} fallback={<Square size={17} />}>
                          <CheckSquare size={17} />
                        </Show>
                      </button>

                      <div onClick={() => ctx.handleOpenEditTaskModal(t)} style={{ display: 'flex', "flex-direction": 'column', gap: '2px', flex: 1, "min-width": 0, cursor: 'pointer' }}>
                        <span style={{
                          "font-size": '13px',
                          "font-weight": 500,
                          color: isDone() ? 'var(--text-dim)' : 'var(--text-main)',
                          "text-decoration": isDone() ? 'line-through' : 'none',
                          overflow: 'hidden',
                          "text-overflow": 'ellipsis',
                          "white-space": 'nowrap'
                        }}>
                          {t.title}
                        </span>
                        <span style={{ "font-size": '12px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
                          #{t.id.slice(-4)} {t.due_date ? `• Due ${new Date(t.due_date).toLocaleDateString()}` : ''}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', "align-items": 'center', gap: '10px', "flex-shrink": 0 }}>
                      <span style={{
                        "font-size": '12px',
                        "font-family": 'var(--font-mono)',
                        "text-transform": 'uppercase',
                        padding: '2px 7px',
                        "border-radius": '4px',
                        background: t.priority === 'urgent' ? 'rgba(244, 63, 94, 0.15)' : 'var(--surface-container-high)',
                        color: t.priority === 'urgent' ? '#f43f5e' : 'var(--text-muted)'
                      }}>
                        {t.priority}
                      </span>

                      <span style={{
                        padding: '3px 8px',
                        "font-size": '12px',
                        "border-radius": '4px',
                        background: 'var(--surface-container-high)',
                        color: 'var(--text-muted)',
                        "text-transform": 'capitalize'
                      }}>
                        {t.status.replace('_', ' ')}
                      </span>

                      <button type="button" onClick={() => ctx.handleOpenEditTaskModal(t)} class="btn-secondary" style={{ padding: '4px 8px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px' }} title="Edit Task">
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>

                      <button type="button" onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this task?')) {
                          try {
                            await api.deleteTask(t.id);
                            ctx.handleTaskDeleted(t.id);
                          }
                          catch (err) {
                            console.error('Failed to delete task:', err);
                          }
                        }
                      }} class="btn-ghost-danger" style={{ padding: '4px 8px', "font-size": '12px', display: 'flex', "align-items": 'center' }} title="Delete Task">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>);
                }}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  </Show>);
};
