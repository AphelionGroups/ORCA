import {
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutGrid,
  Plus,
  RotateCcw
} from 'lucide-solid';
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { ProjectModal } from '../components/ProjectModal';
import { TaskModal } from '../components/TaskModal';
import { BoardPanel } from './project/BoardPanel';
import { DocumentsPanel } from './project/DocumentsPanel';
import { TasksPanel } from './project/TasksPanel';
import type { ProjectsViewProps } from './project/types';
import { useProjectController } from './project/useProjectController';
export const ProjectsView: Component<ProjectsViewProps> = (props) => {
  const ctx = useProjectController(props); return (<div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>

    {/* Project Hub Top Header */}
    <header class="orca-header">
      <div class="header-breadcrumbs">
        <button onClick={() => ctx.setSelectedProjectId(null)} class="breadcrumb-label">
          <FolderKanban size={15} color="var(--primary)" />
          <span>Projects</span>
        </button>

        <Show when={ctx.selectedProjectId() && ctx.currentProject()}>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-title">
            {ctx.currentProject()?.name}
          </span>
        </Show>
      </div>

      {/* Center: The 3 Core Project Hub Tabs */}
      <Show when={ctx.selectedProjectId()}>
        <div class="segmented-control">
          <button class={`seg-btn ${ctx.activeTab() === 'docs' ? 'active' : ''}`} onClick={() => ctx.setActiveTab('docs')}>
            <FileText size={13} color={ctx.activeTab() === 'docs' ? 'var(--tertiary)' : 'var(--text-dim)'} />
            <span>Docs & Plans</span>
            <Show when={ctx.docs().length > 0}>
              <span style={{ "font-size": '10px', opacity: 0.6 }}>({ctx.docs().length})</span>
            </Show>
          </button>
          <button class={`seg-btn ${ctx.activeTab() === 'board' ? 'active' : ''}`} onClick={() => ctx.setActiveTab('board')}>
            <LayoutGrid size={13} color={ctx.activeTab() === 'board' ? 'var(--secondary)' : 'var(--text-dim)'} />
            <span>Board</span>
            <Show when={ctx.boards().length > 0}>
              <span style={{ "font-size": '10px', opacity: 0.6 }}>({ctx.boards().length})</span>
            </Show>
          </button>
          <button class={`seg-btn ${ctx.activeTab() === 'tasks' ? 'active' : ''}`} onClick={() => ctx.setActiveTab('tasks')}>
            <CheckSquare size={13} color={ctx.activeTab() === 'tasks' ? 'var(--primary)' : 'var(--text-dim)'} />
            <span>Tasks</span>
            <Show when={ctx.tasks().length > 0}>
              <span style={{ "font-size": '10px', opacity: 0.6 }}>({ctx.tasks().length})</span>
            </Show>
          </button>
        </div>
      </Show>

      {/* Right Header Actions */}
      <div class="header-actions">
        <button onClick={ctx.loadProjects} title="Refresh" style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-dim)',
          cursor: 'pointer',
          display: 'flex',
          "align-items": 'center',
          padding: '6px'
        }}>
          <RotateCcw size={14} />
        </button>
        <button onClick={props.onOpenQuickCapture} class="btn-pill-white">
          <Plus size={14} />
          <span>New Item</span>
        </button>
      </div>
    </header>

    {/* Main Container */}
    <Show when={!ctx.selectedProjectId()} fallback={<div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

      {/* =========================================================
           TAB 1: DOCS & PLANS
           ========================================================= */}
      <DocumentsPanel ctx={ctx} />

      {/* =========================================================
           TAB 2: BOARD (GALLERY & MILANOTE SPATIAL CANVAS)
           ========================================================= */}
      <BoardPanel ctx={ctx} />

      {/* =========================================================
           TAB 3: TASKS (PROJECT KANBAN & LIST VIEWS)
           ========================================================= */}
      {/* =========================================================
           TAB 3: TASKS (PROJECT KANBAN & LIST VIEWS)
           ========================================================= */}
      <TasksPanel ctx={ctx} />

    </div>}>
      {/* =========================================================
       PROJECT DIRECTORY VIEW (When no project is opened)
       ========================================================= */}
      <main style={{ flex: 1, "overflow-y": 'auto', padding: '32px', "background-color": 'var(--surface)' }}>
        <div style={{ "max-width": '1100px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '24px' }}>
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <div>
              <h1 style={{ "font-size": '22px', "font-weight": 600, color: 'var(--text-main)', margin: 0 }}>
                {props.activeSpaceId ? `Projects — ${ctx.getSpaceName(props.activeSpaceId)}` : 'All Projects'}
              </h1>
              <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Wadah inisiatif terpadu: satukan Dokumen Strategi, Spatial Board Milanote, dan Tasks Kanban.
              </p>
            </div>
            <button type="button" class="btn-primary" onClick={() => ctx.setIsNewProjectModalOpen(true)} style={{ display: 'flex', "align-items": 'center', gap: '6px', padding: '8px 16px', "font-size": '13px' }}>
              <Plus size={15} />
              <span>New Project</span>
            </button>
          </div>

          <div style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            <Show when={!ctx.loadingProjects()} fallback={<div style={{ "grid-column": '1 / -1', color: 'var(--text-dim)', padding: '36px 0', "text-align": 'center', "font-size": '13px' }}>
              Memuat projects...
            </div>}>
              <Show when={ctx.projects().length > 0} fallback={<div style={{ "grid-column": '1 / -1', padding: '48px 24px', "text-align": 'center', border: '1px dashed var(--border-default)', "border-radius": '8px', color: 'var(--text-muted)' }}>
                <p style={{ "font-size": '14px', margin: '0 0 8px 0', "font-weight": 500, color: 'var(--text-main)' }}>Belum ada project di space ini</p>
                <p style={{ "font-size": '12px', color: 'var(--text-dim)', margin: 0 }}>Klik tombol New Project untuk membuat project pertama di space ini.</p>
              </div>}>
                <For each={ctx.projects()}>
                  {(proj) => (<div onClick={() => {
                    ctx.setSelectedProjectId(proj.id);
                    ctx.setActiveTab('board');
                  }} style={{
                    padding: '20px',
                    "border-radius": '8px',
                    "background-color": 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    "flex-direction": 'column',
                    "justify-content": 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                        <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--secondary)', background: 'rgba(68,225,222,0.1)', padding: '2px 6px', "border-radius": '3px' }}>
                          {ctx.getSpaceName(proj.space_id)}
                        </span>
                        <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', "text-transform": 'capitalize' }}>
                          {proj.status}
                        </span>
                      </div>

                      <h3 style={{ "font-size": '15px', "font-weight": 600, color: 'var(--text-main)', margin: 0 }}>
                        {proj.name}
                      </h3>

                      <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                        {proj.description || 'No description provided.'}
                      </p>
                    </div>

                    <div style={{ "margin-top": '16px', "padding-top": '12px', "border-top": '1px solid var(--border-default)', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span>Target: {proj.target_date ? new Date(proj.target_date).toLocaleDateString() : 'Ongoing'}</span>
                      </div>
                      <span style={{ color: 'var(--secondary)', "font-family": 'var(--font-mono)' }}>Open Hub →</span>
                    </div>
                  </div>)}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </main>
    </Show>

    {/* Project Modal for Creating/Editing Projects */}
    <ProjectModal isOpen={ctx.isNewProjectModalOpen()} projectToEdit={null} spaces={ctx.spaces()} defaultSpaceId={props.activeSpaceId || undefined} onClose={() => ctx.setIsNewProjectModalOpen(false)} onSaved={() => {
      ctx.setIsNewProjectModalOpen(false);
      ctx.loadProjects();
    }} />

    {/* Task Modal for Creating/Editing/Deleting Tasks */}
    <TaskModal isOpen={ctx.isTaskModalOpen()} taskToEdit={ctx.taskToEdit()} defaultStatus={ctx.defaultTaskCol()} defaultProjectId={ctx.selectedProjectId() || undefined} defaultSpaceId={ctx.currentProject()?.space_id || props.activeSpaceId || undefined} onClose={() => ctx.setIsTaskModalOpen(false)} onSaved={ctx.handleTaskSaved} onDeleted={ctx.handleTaskDeleted} />
  </div>);
};
