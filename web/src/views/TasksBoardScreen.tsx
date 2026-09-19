import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';

interface TaskItem {
  id: string;
  title: string;
  desc: string;
  canvas?: string;
  doc?: string;
  pdf?: string;
  date: string;
  user: string;
  priority?: string;
  urgent?: boolean;
  progress?: string;
  done?: boolean;
}

interface TasksBoardScreenProps {
  onNavigate: (route: string) => void;
  onOpenQuickCapture: () => void;
}

export const TasksBoardScreen: Component<TasksBoardScreenProps> = (props) => {
  const [filterAssigned, setFilterAssigned] = createSignal(false);

  const columns: { id: string; title: string; count: number; color: string; tasks: TaskItem[] }[] = [
    {
      id: 'backlog',
      title: 'Backlog',
      count: 2,
      color: 'var(--outline-variant)',
      tasks: [
        { id: '#TSK-102', priority: 'P4', title: 'Competitor Typography Benchmark', desc: 'Catalog variable weights and optical foundry licenses across premier Nordic industrial brands.', canvas: '@Canvas/Typography', date: 'May 14', user: 'AR' },
        { id: '#TSK-108', priority: 'P2', title: '3D Asset Render Specs', desc: 'Define specular roughness maps and refractive indices for procedural packaging bottles.', canvas: '@Canvas/Assets-C1', date: 'May 18', user: 'DL' }
      ]
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      count: 2,
      color: 'var(--primary)',
      tasks: [
        { id: '#TSK-097', priority: 'Urgent', title: 'Finalize Packaging Print Specs', desc: 'Review pantone spot varnishes, foil clearances, and cardboard tensile metrics.', canvas: '@Canvas/Box-Dieline', doc: 'Doc: Packaging v2', date: 'Tomorrow', user: 'HN', urgent: true, progress: '3/5 (60%)' },
        { id: '#TSK-104', priority: 'P1', title: 'Obsidian Glass Finish Calibration', desc: 'Fine-tune dynamic noise displacement shaders across OLED tablets.', canvas: '@Canvas/Surface-Shader', date: 'May 16', user: 'VR' }
      ]
    },
    {
      id: 'in-review',
      title: 'In Review',
      count: 1,
      color: 'var(--tertiary)',
      tasks: [
        { id: '#TSK-089', priority: 'P1', title: 'Brand Identity Guidelines v1.2', desc: 'Comprehensive token mapping, sub-brand co-existence hierarchy, and editorial layout.', canvas: '@Canvas/Identity-System', pdf: 'Bisnis_A_Brand_Book_v1.2.pdf', date: 'Waiting on CEO', user: 'FA' }
      ]
    },
    {
      id: 'done',
      title: 'Done',
      count: 2,
      color: 'var(--secondary-container)',
      tasks: [
        { id: '#TSK-078', done: true, title: 'Core Value Pillars Definition', desc: 'Consolidate executive feedback into 3 foundational brand attributes: Precision, Clarity, Restraint.', canvas: '@Canvas/Strategy-Node', date: 'Completed May 10', user: 'DL' },
        { id: '#TSK-081', done: true, title: 'Domain Switch Strategy', desc: 'DNS failover latency simulation, SSL wildcard renewal, and global CDN cache warming routes.', date: 'Completed May 11', user: 'AR' }
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', "flex-direction": 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <span style={{ "font-size": '14px', "font-weight": 500, color: 'var(--text-main)' }}>Bisnis A</span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ "font-size": '14px', color: 'var(--text-muted)' }}>Rebranding & Launch</span>
        </div>

        {/* Segmented Tab Switcher */}
        <div class="segmented-tab-group">
          <button class="segmented-tab-btn" onClick={() => props.onNavigate('canvas')}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>gesture</span>
            <span>Canvas</span>
          </button>
          <button class="segmented-tab-btn" onClick={() => props.onNavigate('documents')}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>description</span>
            <span>Documents</span>
          </button>
          <button class="segmented-tab-btn active">
            <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--secondary)' }}>check_circle</span>
            <span>Tasks</span>
          </button>
        </div>

        <div class="header-actions">
          <button class="btn-pill-white" onClick={() => props.onOpenQuickCapture()}>
            <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>add</span>
            <span>New</span>
          </button>
        </div>
      </header>

      {/* Main Kanban Viewport */}
      <main class="tasks-viewport">
        <div style={{ "max-width": '1400px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '24px' }}>
          
          {/* Velocity Header */}
          <div style={{ display: 'flex', "align-items": 'flex-end', "justify-content": 'space-between', "border-bottom": '1px solid var(--border-subtle)', "padding-bottom": '16px' }}>
            <div style={{ display: 'flex', "align-items": 'baseline', gap: '14px' }}>
              <h1 style={{ "font-size": '22px', "font-weight": 600, color: 'white', "letter-spacing": '-0.3px' }}>
                Sprint Execution
              </h1>
              <span style={{ padding: '2px 8px', "border-radius": '4px', background: 'var(--surface-container-high)', "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--secondary)', "letter-spacing": '0.1em', "text-transform": 'uppercase' }}>
                Q2 • Week 08
              </span>
              <span style={{ "font-size": '12px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                18 of 24 tasks delivered
              </span>
            </div>

            <div style={{ display: 'flex', "align-items": 'center', gap: '8px', background: 'var(--surface-container-low)', padding: '6px 12px', "border-radius": '8px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', "text-transform": 'uppercase' }}>Velocity</span>
              <span style={{ "font-size": '13px', "font-weight": 600, color: 'var(--secondary)' }}>76%</span>
            </div>
          </div>

          {/* Sub Filter Toolbar */}
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <button 
                onClick={() => setFilterAssigned(!filterAssigned())}
                style={{
                  padding: '6px 12px',
                  "border-radius": '4px',
                  "font-size": '12px',
                  background: filterAssigned() ? 'var(--primary)' : 'var(--surface-container-low)',
                  color: filterAssigned() ? '#0c0e12' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  "font-weight": filterAssigned() ? 600 : 400
                }}
              >
                Assigned to Me
              </button>
              <button style={{ padding: '6px 12px', "border-radius": '4px', "font-size": '12px', background: 'var(--surface-container-low)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                Due this week
              </button>
              <button style={{ padding: '6px 12px', "border-radius": '4px', "font-size": '12px', background: 'var(--surface-container-low)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                Priority: High
              </button>
            </div>

            <button 
              onClick={() => props.onOpenQuickCapture()}
              class="btn-pill-white"
            >
              <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>add</span>
              <span>New Task</span>
            </button>
          </div>

          {/* Kanban Columns */}
          <div class="kanban-grid-4col">
            <For each={columns}>
              {(col) => (
                <div class="kanban-col">
                  {/* Column Header */}
                  <div class="kanban-col-header">
                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', "border-radius": '50%', background: col.color }} />
                      <span style={{ "font-size": '13px', "font-weight": 600, color: 'white' }}>{col.title}</span>
                      <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>{col.count}</span>
                    </div>
                    <button class="btn-ghost-icon" style={{ width: '20px', height: '20px' }}>
                      <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>more_horiz</span>
                    </button>
                  </div>

                  {/* Tasks List */}
                  <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px' }}>
                    <For each={col.tasks}>
                      {(task) => (
                        <div class="task-sprint-card">
                          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                            <span style={{ "font-size": '10.5px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>{task.id}</span>
                            <span style={{
                              "font-size": '10px',
                              "font-family": 'var(--font-mono)',
                              "text-transform": 'uppercase',
                              padding: '2px 6px',
                              "border-radius": '4px',
                              background: task.priority === 'Urgent' ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.06)',
                              color: task.priority === 'Urgent' ? '#f43f5e' : 'var(--text-muted)'
                            }}>
                              {task.priority}
                            </span>
                          </div>

                          <h4 style={{
                            "font-size": '13px',
                            "font-weight": 600,
                            color: task.done ? 'var(--text-dim)' : 'white',
                            "text-decoration": task.done ? 'line-through' : 'none',
                            "line-height": 1.4
                          }}>
                            {task.title}
                          </h4>

                          <p style={{ "font-size": '12px', color: 'var(--text-muted)', "line-height": 1.5 }}>
                            {task.desc}
                          </p>

                          {task.canvas && (
                            <div 
                              style={{ display: 'flex', "align-items": 'center', gap: '6px', "font-size": '11px', color: 'var(--secondary)', cursor: 'pointer' }}
                              onClick={() => props.onNavigate('canvas')}
                            >
                              <span class="material-symbols-outlined" style={{ "font-size": '13px' }}>gesture</span>
                              <span>{task.canvas}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-top": '8px', "border-top": '1px solid rgba(255,255,255,0.06)', "font-size": '11px', color: 'var(--text-dim)' }}>
                            <span>{task.date}</span>
                            <span style={{ width: '20px', height: '20px', "border-radius": '50%', background: '#262932', color: 'white', display: 'flex', "align-items": 'center', "justify-content": 'center', "font-size": '9px', "font-weight": 600 }}>
                              {task.user}
                            </span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>

        </div>
      </main>
    </div>
  );
};
