import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show } from 'solid-js';
import { 
  Inbox, 
  Plus, 
  Check, 
  Trash2, 
  Clock, 
  FolderKanban,
  RotateCcw
} from 'lucide-solid';
import { api } from '../services/api';
import type { Task, Space, Project } from '../services/api';

interface InboxViewProps {
  onNavigate: (route: string, spaceId?: string | null) => void;
  onOpenQuickCapture: () => void;
}

export const InboxView: Component<InboxViewProps> = (props) => {
  const [quickInput, setQuickInput] = createSignal('');
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [assigningTaskId, setAssigningTaskId] = createSignal<string | null>(null);

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedTasks, fetchedSpaces, fetchedProjects] = await Promise.all([
        api.getTasks({ inbox: true }),
        api.getSpaces(),
        api.getProjects()
      ]);
      setTasks(fetchedTasks || []);
      setSpaces(fetchedSpaces || []);
      setProjects(fetchedProjects || []);
    } catch (err) {
      console.error('Failed to load inbox data:', err);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadData();
  });

  const getSpaceInfo = (spaceId: string) => {
    const sp = spaces().find(s => s.id === spaceId);
    return {
      name: sp ? sp.name : 'Workspace',
      color: sp ? sp.color : 'var(--secondary)'
    };
  };

  const handleAddItem = async (e: Event) => {
    e.preventDefault();
    const val = quickInput().trim();
    if (!val) return;

    const defaultSpace = spaces()[0]?.id || '018f0000-0000-7000-8000-000000000010';
    try {
      const newTask = await api.createTask({
        title: val,
        space_id: defaultSpace,
        status: 'todo',
        priority: 'medium',
      });
      setTasks([newTask, ...tasks()]);
      setQuickInput('');
    } catch (err) {
      console.error('Failed to capture inbox task:', err);
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      await api.updateTaskStatus(id, 'done');
      setTasks(tasks().filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to mark task done:', err);
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks(tasks().filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleAssignToProject = async (taskId: string, projectId: string) => {
    try {
      await api.updateTask(taskId, { project_id: projectId });
      setTasks(tasks().filter(t => t.id !== taskId));
      setAssigningTaskId(null);
      props.onNavigate('projects');
    } catch (err) {
      console.error('Failed to assign task to project:', err);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <div class="breadcrumb-title">
            <Inbox size={17} color="var(--secondary)" />
            <span>Inbox</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="badge-outline">
            Triage & Ingestion
          </span>
        </div>

        <div class="header-actions">
          <button 
            onClick={loadData}
            title="Refresh inbox"
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

          <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
            {tasks().length} items awaiting triage
          </span>
          <button 
            onClick={props.onOpenQuickCapture}
            class="btn-pill-white"
          >
            <Plus size={14} />
            <span>Quick Capture</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, "overflow-y": 'auto', padding: '32px', "background-color": 'var(--surface)' }}>
        <div style={{ "max-width": '880px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '20px' }}>
          
          {/* Quick Input Bar */}
          <form onSubmit={handleAddItem}>
            <div style={{
              display: 'flex',
              "align-items": 'center',
              gap: '10px',
              padding: '8px 14px',
              "background-color": 'var(--surface-container-low)',
              border: '1px solid var(--border-default)',
              "border-radius": '8px',
              "box-shadow": '0 4px 20px rgba(0, 0, 0, 0.25)'
            }}>
              <Plus size={16} color="var(--text-dim)" />
              <input 
                type="text"
                value={quickInput()}
                onInput={e => setQuickInput(e.currentTarget.value)}
                placeholder="Type a thought, task, or raw note... press Enter to capture"
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  "font-size": '13px',
                  outline: 'none'
                }}
              />
              <span class="kbd-badge">Enter</span>
            </div>
          </form>

          {/* Inbox List */}
          <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
            <Show when={!loading()} fallback={
              <div style={{ color: 'var(--text-dim)', "font-size": '12px', "text-align": 'center', padding: '40px 0' }}>
                Connecting to live stream...
              </div>
            }>
              <Show when={tasks().length > 0} fallback={
                <div style={{
                  padding: '48px 24px',
                  "text-align": 'center',
                  "border-radius": '8px',
                  border: '1px dashed var(--border-default)',
                  color: 'var(--text-dim)'
                }}>
                  <Inbox size={28} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                  <p style={{ "font-size": '13px', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>Inbox Zero Achieved</p>
                  <span style={{ "font-size": '11px' }}>All captured items have been triaged or promoted to projects.</span>
                </div>
              }>
                <For each={tasks()}>
                  {(task) => {
                    const spaceInfo = getSpaceInfo(task.space_id);
                    const isAssigning = () => assigningTaskId() === task.id;

                    return (
                      <div 
                        style={{
                          padding: '16px',
                          "border-radius": '8px',
                          "background-color": 'rgba(24, 26, 32, 0.8)',
                          border: '1px solid var(--border-default)',
                          display: 'flex',
                          "flex-direction": 'column',
                          gap: '12px',
                          transition: 'border-color 0.15s ease'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          "align-items": 'flex-start',
                          "justify-content": 'space-between',
                          gap: '16px'
                        }}>
                          <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px', flex: 1 }}>
                            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                              <span style={{
                                padding: '2px 6px',
                                "border-radius": '4px',
                                "font-size": '10px',
                                "font-family": 'var(--font-mono)',
                                "text-transform": 'uppercase',
                                background: 'rgba(68, 225, 222, 0.12)',
                                color: 'var(--secondary)'
                              }}>
                                {task.priority || 'task'}
                              </span>
                              <span style={{
                                "font-size": '11px',
                                color: spaceInfo.color,
                                "font-family": 'var(--font-mono)',
                                display: 'flex',
                                "align-items": 'center',
                                gap: '4px'
                              }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  "border-radius": '50%',
                                  "background-color": spaceInfo.color
                                }} />
                                {spaceInfo.name}
                              </span>
                              <span style={{ "font-size": '11px', color: 'var(--text-dim)', display: 'flex', "align-items": 'center', gap: '4px' }}>
                                <Clock size={11} />
                                {formatRelativeTime(task.created_at)}
                              </span>
                            </div>

                            <h3 style={{ "font-size": '13px', "font-weight": 500, color: '#fff', margin: 0, "line-height": 1.4 }}>
                              {task.title}
                            </h3>

                            {task.description && (
                              <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Triage Action Buttons */}
                          <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                            <button 
                              title="Promote to Project"
                              onClick={() => {
                                if (projects().length === 1) {
                                  handleAssignToProject(task.id, projects()[0].id);
                                } else {
                                  setAssigningTaskId(isAssigning() ? null : task.id);
                                }
                              }}
                              style={{
                                padding: '5px 10px',
                                "border-radius": '4px',
                                "background-color": isAssigning() ? 'var(--primary)' : 'var(--surface-container-high)',
                                color: '#fff',
                                "font-size": '11px',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                "align-items": 'center',
                                gap: '4px'
                              }}
                            >
                              <FolderKanban size={12} color={isAssigning() ? '#fff' : "var(--primary)"} />
                              <span>To Project</span>
                            </button>

                            <button 
                              title="Archive / Done"
                              onClick={() => handleMarkDone(task.id)}
                              style={{
                                padding: '5px 8px',
                                "border-radius": '4px',
                                background: 'none',
                                color: 'var(--text-dim)',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <Check size={14} />
                            </button>

                            <button 
                              title="Discard"
                              onClick={() => handleDiscard(task.id)}
                              style={{
                                padding: '5px 8px',
                                "border-radius": '4px',
                                background: 'none',
                                color: 'var(--text-dim)',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Project selector dropdown when promoted */}
                        <Show when={isAssigning()}>
                          <div style={{
                            padding: '10px 12px',
                            "border-radius": '6px',
                            "background-color": 'var(--surface-container-lowest)',
                            border: '1px solid var(--border-default)',
                            display: 'flex',
                            "align-items": 'center',
                            "justify-content": 'space-between',
                            gap: '8px'
                          }}>
                            <span style={{ "font-size": '11px', color: 'var(--text-muted)' }}>
                              Select destination project:
                            </span>
                            <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                              <For each={projects()}>
                                {(proj) => (
                                  <button
                                    onClick={() => handleAssignToProject(task.id, proj.id)}
                                    style={{
                                      padding: '4px 10px',
                                      "border-radius": '4px',
                                      "font-size": '11px',
                                      "background-color": 'rgba(255, 255, 255, 0.08)',
                                      color: '#fff',
                                      border: '1px solid var(--border-default)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {proj.name}
                                  </button>
                                )}
                              </For>
                              <button
                                onClick={() => setAssigningTaskId(null)}
                                style={{
                                  padding: '4px 8px',
                                  "font-size": '11px',
                                  color: 'var(--text-dim)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </main>
    </div>
  );
};
