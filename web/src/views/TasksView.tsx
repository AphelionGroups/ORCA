import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show, createEffect } from 'solid-js';
import { 
  CheckSquare, 
  Plus, 
  Kanban, 
  List,
  RotateCcw,
  ChevronRight
} from 'lucide-solid';
import { api } from '../services/api';
import type { Task, Space, Project } from '../services/api';

interface TasksViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
}

export const TasksView: Component<TasksViewProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'kanban' | 'list'>('kanban');
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [quickTaskTitle, setQuickTaskTitle] = createSignal('');

  const columns = [
    { id: 'todo', title: 'Backlog', color: 'var(--outline-variant)' },
    { id: 'in_progress', title: 'In Progress', color: 'var(--primary)' },
    { id: 'in_review', title: 'In Review', color: 'var(--tertiary)' },
    { id: 'done', title: 'Done', color: 'var(--secondary)' }
  ];

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedTasks, fetchedSpaces, fetchedProjects] = await Promise.all([
        api.getTasks({ space_id: props.activeSpaceId || undefined }),
        api.getSpaces(),
        api.getProjects()
      ]);
      setTasks(fetchedTasks || []);
      setSpaces(fetchedSpaces || []);
      setProjects(fetchedProjects || []);
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  createEffect(() => {
    const spaceId = props.activeSpaceId;
    api.getTasks({ space_id: spaceId || undefined }).then(res => {
      setTasks(res || []);
    }).catch(console.error);
  });

  const getSpaceName = (spaceId?: string) => {
    if (!spaceId) return 'All Spaces';
    return spaces().find(s => s.id === spaceId)?.name || 'Space';
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return 'Inbox / Standalone';
    return projects().find(p => p.id === projectId)?.name || 'Project';
  };

  const getTasksByStatus = (status: string) => {
    return tasks().filter(t => t.status === status);
  };

  const toggleTaskDone = async (task: Task) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.updateTaskStatus(task.id, nextStatus);
      setTasks(tasks().map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.error('Failed to toggle task status:', err);
    }
  };

  const advanceTaskStatus = async (task: Task) => {
    const statusCycle: Record<string, Task['status']> = {
      'todo': 'in_progress',
      'in_progress': 'in_review',
      'in_review': 'done',
      'done': 'todo'
    };
    const nextStatus = statusCycle[task.status] || 'in_progress';
    try {
      await api.updateTaskStatus(task.id, nextStatus);
      setTasks(tasks().map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
    } catch (err) {
      console.error('Failed to advance task status:', err);
    }
  };

  const handleQuickAdd = async (e: Event) => {
    e.preventDefault();
    const title = quickTaskTitle().trim();
    if (!title) return;

    const spaceId = props.activeSpaceId || spaces()[0]?.id || '018f0000-0000-7000-8000-000000000010';
    try {
      const newTask = await api.createTask({
        title,
        space_id: spaceId,
        status: 'todo',
        priority: 'medium',
      });
      setTasks([newTask, ...tasks()]);
      setQuickTaskTitle('');
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <div class="breadcrumb-title">
            <CheckSquare size={17} color="var(--secondary)" />
            <span>Tasks</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="badge-outline">
            Execution Board
          </span>
          <Show when={props.activeSpaceId}>
            <span class="breadcrumb-sep">/</span>
            <span style={{ "font-size": '11px', color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>
              {getSpaceName(props.activeSpaceId || undefined)}
            </span>
          </Show>
        </div>

        {/* View Switcher & Action */}
        <div class="header-actions">
          <button 
            onClick={loadData}
            title="Refresh"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              "align-items": 'center',
              padding: '6px'
            }}
          >
            <RotateCcw size={14} />
          </button>

          {/* Kanban vs List toggle */}
          <div class="segmented-control">
            <button 
              onClick={() => setViewMode('kanban')}
              class={`seg-btn ${viewMode() === 'kanban' ? 'active' : ''}`}
            >
              <Kanban size={13} />
              <span>Kanban</span>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              class={`seg-btn ${viewMode() === 'list' ? 'active' : ''}`}
            >
              <List size={13} />
              <span>List</span>
            </button>
          </div>

          <button 
            onClick={props.onOpenQuickCapture}
            class="btn-pill-white"
          >
            <Plus size={14} />
            <span>New Task</span>
          </button>
        </div>
      </header>

      {/* Main Task Area */}
      <main style={{ flex: 1, "overflow-y": 'auto', padding: '24px 32px', "background-color": 'var(--surface)' }}>
        {/* Quick Add Bar */}
        <div style={{ "max-width": viewMode() === 'list' ? '1000px' : 'none', margin: '0 auto 20px auto' }}>
          <form onSubmit={handleQuickAdd}>
            <div style={{
              display: 'flex',
              "align-items": 'center',
              gap: '10px',
              padding: '8px 14px',
              "background-color": 'var(--surface-container-low)',
              border: '1px solid var(--border-default)',
              "border-radius": '8px'
            }}>
              <Plus size={15} color="var(--text-dim)" />
              <input 
                type="text"
                value={quickTaskTitle()}
                onInput={e => setQuickTaskTitle(e.currentTarget.value)}
                placeholder="Quick add task to Backlog... press Enter"
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  "font-size": '12px',
                  outline: 'none'
                }}
              />
              <span class="kbd-badge">Enter</span>
            </div>
          </form>
        </div>

        <Show when={!loading()} fallback={
          <div style={{ color: 'var(--text-dim)', padding: '40px 0', "text-align": 'center' }}>
            Syncing task graph...
          </div>
        }>
          {viewMode() === 'kanban' ? (
            /* Kanban Board */
            <div style={{ display: 'grid', "grid-template-columns": 'repeat(4, minmax(280px, 1fr))', gap: '20px', "align-items": 'flex-start' }}>
              <For each={columns}>
                {(col) => {
                  const colTasks = () => getTasksByStatus(col.id);
                  return (
                    <div style={{
                      display: 'flex',
                      "flex-direction": 'column',
                      gap: '12px',
                      "background-color": 'rgba(22, 24, 29, 0.4)',
                      padding: '12px',
                      "border-radius": '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      {/* Column Header */}
                      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', padding: '4px 6px' }}>
                        <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                          <span style={{ width: '8px', height: '8px', "border-radius": '50%', "background-color": col.color }}></span>
                          <span style={{ "font-size": '12px', "font-weight": 600, color: '#fff' }}>{col.title}</span>
                        </div>
                        <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', padding: '1px 6px', "border-radius": '4px', "background-color": 'rgba(255,255,255,0.05)' }}>
                          {colTasks().length}
                        </span>
                      </div>

                      {/* Task Cards */}
                      <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
                        <For each={colTasks()}>
                          {(task) => (
                            <div 
                              onClick={() => advanceTaskStatus(task)}
                              title="Click to advance status"
                              style={{
                                padding: '14px',
                                "border-radius": '6px',
                                "background-color": 'var(--surface-container-low)',
                                border: task.priority === 'urgent' ? '1px solid rgba(244,63,94,0.3)' : '1px solid var(--border-default)',
                                display: 'flex',
                                "flex-direction": 'column',
                                gap: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
                                  #{task.id.slice(-4)}
                                </span>
                                <span style={{
                                  "font-size": '9px',
                                  "font-family": 'var(--font-mono)',
                                  "text-transform": 'uppercase',
                                  padding: '1px 5px',
                                  "border-radius": '3px',
                                  background: task.priority === 'urgent' ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)',
                                  color: task.priority === 'urgent' ? '#f43f5e' : 'var(--text-muted)'
                                }}>
                                  {task.priority}
                                </span>
                              </div>

                              <h4 style={{
                                "font-size": '12px',
                                "font-weight": 600,
                                color: task.status === 'done' ? 'var(--text-dim)' : '#fff',
                                "text-decoration": task.status === 'done' ? 'line-through' : 'none',
                                margin: 0,
                                "line-height": 1.4
                              }}>
                                {task.title}
                              </h4>

                              {task.description && (
                                <p style={{ "font-size": '11px', color: 'var(--text-muted)', margin: 0, "line-height": 1.4 }}>
                                  {task.description}
                                </p>
                              )}

                              <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-top": '6px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '10px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                                <span>{getSpaceName(task.space_id)}</span>
                                <span style={{ color: col.color, display: 'flex', "align-items": 'center', gap: '2px' }}>
                                  Advance <ChevronRight size={10} />
                                </span>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          ) : (
            /* List View */
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px', "max-width": '1000px', margin: '0 auto' }}>
              <For each={tasks()}>
                {(task) => (
                  <div style={{
                    padding: '10px 16px',
                    "border-radius": '6px',
                    "background-color": 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    "align-items": 'center',
                    "justify-content": 'space-between',
                    gap: '16px'
                  }}>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '12px', flex: 1 }}>
                      <input 
                        type="checkbox" 
                        checked={task.status === 'done'}
                        onChange={() => toggleTaskDone(task)}
                        style={{ cursor: 'pointer', "accent-color": 'var(--secondary)' }}
                      />
                      <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', width: '50px' }}>
                        #{task.id.slice(-4)}
                      </span>
                      <span style={{
                        "font-size": '13px',
                        color: task.status === 'done' ? 'var(--text-dim)' : '#fff',
                        "text-decoration": task.status === 'done' ? 'line-through' : 'none'
                      }}>
                        {task.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
                      <span style={{ "font-size": '11px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                        {getProjectName(task.project_id)}
                      </span>
                      <span style={{ "font-size": '11px', color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>
                        {getSpaceName(task.space_id)}
                      </span>
                      <span style={{
                        "font-size": '10px',
                        "font-family": 'var(--font-mono)',
                        "text-transform": 'uppercase',
                        padding: '2px 6px',
                        "border-radius": '4px',
                        background: task.priority === 'urgent' ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)',
                        color: task.priority === 'urgent' ? '#f43f5e' : 'var(--text-muted)'
                      }}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          )}
        </Show>
      </main>
    </div>
  );
};
