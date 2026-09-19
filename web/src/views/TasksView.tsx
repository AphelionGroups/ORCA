import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';
import { 
  CheckSquare, 
  Plus, 
  Kanban, 
  List
} from 'lucide-solid';

interface TaskItem {
  id: string;
  title: string;
  desc?: string;
  priority: 'urgent' | 'p1' | 'p2' | 'p3';
  status: 'backlog' | 'in_progress' | 'in_review' | 'done';
  spaceName: string;
  projectName?: string;
  dueDate?: string;
  user: string;
}

interface TasksViewProps {
  onOpenQuickCapture: () => void;
  activeSpaceId?: string | null;
}

export const TasksView: Component<TasksViewProps> = (props) => {
  const [viewMode, setViewMode] = createSignal<'kanban' | 'list'>('kanban');

  const [tasks, setTasks] = createSignal<TaskItem[]>([
    {
      id: '#TSK-102',
      title: 'Competitor Typography Benchmark',
      desc: 'Catalog variable weights and optical foundry licenses across premier Nordic industrial brands.',
      priority: 'p3',
      status: 'backlog',
      spaceName: 'Bisnis A',
      projectName: 'Rebranding & Launch',
      dueDate: 'May 14',
      user: 'AR'
    },
    {
      id: '#TSK-108',
      title: '3D Asset Render Specs',
      desc: 'Define specular roughness maps and refractive indices for procedural packaging bottles.',
      priority: 'p2',
      status: 'backlog',
      spaceName: 'Bisnis A',
      projectName: 'Rebranding & Launch',
      dueDate: 'May 18',
      user: 'DL'
    },
    {
      id: '#TSK-097',
      title: 'Finalize Packaging Print Specs',
      desc: 'Review pantone spot varnishes, foil clearances, and cardboard tensile metrics.',
      priority: 'urgent',
      status: 'in_progress',
      spaceName: 'Bisnis A',
      projectName: 'Rebranding & Launch',
      dueDate: 'Tomorrow',
      user: 'HN'
    },
    {
      id: '#TSK-104',
      title: 'Obsidian Glass Finish Calibration',
      desc: 'Fine-tune dynamic noise displacement shaders across OLED tablets.',
      priority: 'p1',
      status: 'in_progress',
      spaceName: 'Kantor',
      projectName: 'Core Architecture',
      dueDate: 'May 16',
      user: 'VR'
    },
    {
      id: '#TSK-089',
      title: 'Brand Identity Guidelines v1.2',
      desc: 'Comprehensive token mapping, sub-brand co-existence hierarchy, and editorial layout.',
      priority: 'p1',
      status: 'in_review',
      spaceName: 'Bisnis A',
      projectName: 'Rebranding & Launch',
      dueDate: 'Waiting on CEO',
      user: 'FA'
    },
    {
      id: '#TSK-078',
      title: 'Core Value Pillars Definition',
      desc: 'Consolidate executive feedback into 3 foundational brand attributes: Precision, Clarity, Restraint.',
      priority: 'p2',
      status: 'done',
      spaceName: 'Bisnis A',
      projectName: 'Rebranding & Launch',
      dueDate: 'May 10',
      user: 'DL'
    },
    {
      id: '#TSK-081',
      title: 'Domain Switch Strategy',
      desc: 'DNS failover latency simulation, SSL wildcard renewal, and global CDN cache warming routes.',
      priority: 'p3',
      status: 'done',
      spaceName: 'Bisnis B',
      projectName: 'Cloud Infrastructure',
      dueDate: 'May 11',
      user: 'AR'
    }
  ]);

  const columns = [
    { id: 'backlog', title: 'Backlog', color: 'var(--outline-variant)' },
    { id: 'in_progress', title: 'In Progress', color: 'var(--primary)' },
    { id: 'in_review', title: 'In Review', color: 'var(--tertiary)' },
    { id: 'done', title: 'Done', color: 'var(--secondary)' }
  ];

  const getTasksByStatus = (status: string) => {
    return tasks().filter(t => t.status === status);
  };

  const toggleTaskDone = (id: string) => {
    setTasks(tasks().map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'done' ? 'todo' : 'done' as any };
      }
      return t;
    }));
  };

  return (
    <div style={{ height: '100vh', display: 'flex', "flex-direction": 'column', "background-color": '#111317', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-top-header" style={{ position: 'sticky', top: 0, "z-index": 40 }}>
        <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
          <CheckSquare size={18} color="var(--secondary)" />
          <h1 style={{ "font-size": '14px', "font-weight": 600, color: '#fff', margin: 0 }}>Tasks</h1>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--outline)', padding: '2px 8px', "border-radius": '4px', "background-color": 'var(--surface-container-low)', border: '1px solid var(--border-default)' }}>
            Execution Board
          </span>
        </div>

        {/* View Switcher & Action */}
        <div style={{ display: 'flex', "align-items": 'center', gap: '12px' }}>
          {/* Kanban vs List toggle */}
          <div style={{ display: 'flex', "align-items": 'center', padding: '2px', "border-radius": '4px', "background-color": 'var(--surface-container-lowest)', border: '1px solid var(--border-default)' }}>
            <button 
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '4px 8px',
                "border-radius": '4px',
                border: 'none',
                background: viewMode() === 'kanban' ? 'var(--surface-container)' : 'transparent',
                color: viewMode() === 'kanban' ? 'var(--secondary)' : 'var(--text-dim)',
                cursor: 'pointer',
                display: 'flex',
                "align-items": 'center'
              }}
            >
              <Kanban size={15} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{
                padding: '4px 8px',
                "border-radius": '4px',
                border: 'none',
                background: viewMode() === 'list' ? 'var(--surface-container)' : 'transparent',
                color: viewMode() === 'list' ? 'var(--secondary)' : 'var(--text-dim)',
                cursor: 'pointer',
                display: 'flex',
                "align-items": 'center'
              }}
            >
              <List size={15} />
            </button>
          </div>

          <button 
            onClick={props.onOpenQuickCapture}
            style={{
              display: 'flex',
              "align-items": 'center',
              gap: '6px',
              padding: '5px 12px',
              "font-size": '12px',
              "font-weight": 500,
              color: '#000',
              "background-color": '#fff',
              border: 'none',
              "border-radius": '4px',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>New Task</span>
          </button>
        </div>
      </header>

      {/* Main Task Area */}
      <main style={{ flex: 1, "overflow-y": 'auto', padding: '24px 32px', "background-color": '#111317' }}>
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
                          <div style={{
                            padding: '14px',
                            "border-radius": '6px',
                            "background-color": 'var(--surface-container-low)',
                            border: task.priority === 'urgent' ? '1px solid rgba(244,63,94,0.3)' : '1px solid var(--border-default)',
                            display: 'flex',
                            "flex-direction": 'column',
                            gap: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}>
                            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                              <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>{task.id}</span>
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

                            {task.desc && (
                              <p style={{ "font-size": '11px', color: 'var(--text-muted)', margin: 0, "line-height": 1.4 }}>
                                {task.desc}
                              </p>
                            )}

                            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-top": '6px', "border-top": '1px solid rgba(255,255,255,0.05)', "font-size": '10px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                              <span>{task.dueDate}</span>
                              <div style={{ width: '18px', height: '18px', "border-radius": '50%', "background-color": 'var(--surface-container-high)', display: 'flex', "align-items": 'center', "justify-content": 'center', "font-size": '8px', color: '#fff' }}>
                                {task.user}
                              </div>
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
          <div style={{ display: 'flex', "flex-direction": 'column', gap: '4px', "max-width": '1000px', margin: '0 auto' }}>
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
                      onChange={() => toggleTaskDone(task.id)}
                      style={{ cursor: 'pointer', "accent-color": 'var(--secondary)' }}
                    />
                    <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', width: '64px' }}>
                      {task.id}
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
                      {task.spaceName}
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
                    <span style={{ "font-size": '11px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                      {task.dueDate}
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </main>
    </div>
  );
};
