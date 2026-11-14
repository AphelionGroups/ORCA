import {
  ArrowRight,
  CheckSquare,
  FileText,
  FolderKanban,
  LayoutGrid,
  Plus
} from 'lucide-solid';
import { PageOptions } from '../components/PageOptions';
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { handleTabKey } from '../components/tabs';
import { ProjectModal } from '../components/ProjectModal';
import { TaskModal } from '../components/TaskModal';
import { BoardPanel } from './project/BoardPanel';
import { DocumentsPanel } from './project/DocumentsPanel';
import { TasksPanel } from './project/TasksPanel';
import type { ProjectsViewProps } from './project/types';
import type { Project } from '../services/api';
import { useProjectController } from './project/useProjectController';
export const ProjectsView: Component<ProjectsViewProps> = (props) => {
  const ctx = useProjectController(props);
  const openProject = (project: Project) => {
    if (props.onSelectProject) props.onSelectProject(project.id, project.space_id);
    else { ctx.setSelectedProjectId(project.id); ctx.setActiveTab('board'); }
  };
  return (<div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>

    {/* Project Hub Top Header */}
    <header class="orca-header">
      <div class="header-breadcrumbs">
        <button onClick={() => props.onSelectProject ? props.onSelectProject(null, props.activeSpaceId || null) : ctx.setSelectedProjectId(null)} class="breadcrumb-label">
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
        <div class="segmented-control project-tabs" role="tablist" aria-label="Project views" onKeyDown={handleTabKey}>
          <button type="button" role="tab" id="project-docs-tab" aria-controls="project-docs-panel" aria-selected={ctx.activeTab() === 'docs'} tabindex={ctx.activeTab() === 'docs' ? 0 : -1} class={`seg-btn ${ctx.activeTab() === 'docs' ? 'active' : ''}`} onClick={() => ctx.setActiveTab('docs')}>
            <FileText size={13} color={ctx.activeTab() === 'docs' ? 'var(--tertiary)' : 'var(--text-dim)'} />
            <span>Docs & Plans</span>
            <Show when={ctx.docs().length > 0}>
              <span style={{ "font-size": '12px', opacity: 0.6 }}>({ctx.docs().length})</span>
            </Show>
          </button>
          <button type="button" role="tab" id="project-board-tab" aria-controls="project-board-panel" aria-selected={ctx.activeTab() === 'board'} tabindex={ctx.activeTab() === 'board' ? 0 : -1} class={`seg-btn ${ctx.activeTab() === 'board' ? 'active' : ''}`} onClick={() => ctx.setActiveTab('board')}>
            <LayoutGrid size={13} color={ctx.activeTab() === 'board' ? 'var(--secondary)' : 'var(--text-dim)'} />
            <span>Board</span>
            <Show when={ctx.boards().length > 0}>
              <span style={{ "font-size": '12px', opacity: 0.6 }}>({ctx.boards().length})</span>
            </Show>
          </button>
          <button type="button" role="tab" id="project-tasks-tab" aria-controls="project-tasks-panel" aria-selected={ctx.activeTab() === 'tasks'} tabindex={ctx.activeTab() === 'tasks' ? 0 : -1} class={`seg-btn ${ctx.activeTab() === 'tasks' ? 'active' : ''}`} onClick={() => ctx.setActiveTab('tasks')}>
            <CheckSquare size={13} color={ctx.activeTab() === 'tasks' ? 'var(--primary)' : 'var(--text-dim)'} />
            <span>Tasks</span>
            <Show when={ctx.tasks().length > 0}>
              <span style={{ "font-size": '12px', opacity: 0.6 }}>({ctx.tasks().length})</span>
            </Show>
          </button>
        </div>
      </Show>

      {/* Right Header Actions */}
      <div class="header-actions">
<PageOptions onRefresh={ctx.refreshData} busy={ctx.loadingProjects() || ctx.loadingSubData()} />
        <button onClick={props.onOpenQuickCapture} class="btn-pill-white">
          <Plus size={14} />
          <span>New Item</span>
        </button>
      </div>
    </header>

    <Show when={ctx.operationError()}>
      <div role="alert" class="operation-error">
        <span>{ctx.operationError()}</span>
        <button class="btn-secondary" onClick={() => ctx.setOperationError('')}>Dismiss</button>
      </div>
    </Show>
    <Show when={ctx.loadError()}><div role="alert" class="operation-error">{ctx.loadError()}<button class="btn-secondary" onClick={() => void ctx.refreshData()}>Coba lagi</button></div></Show>
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
      <main class="project-overview context-panel" style={{ flex: 1, "overflow-y": 'auto', padding: "var(--space-8)", "background-color": 'var(--surface)' }}>
        <div style={{ "max-width": '1100px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: "var(--space-6)" }}>
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <div>
              <h1 style={{ "font-size": '22px', "font-weight": 600, color: 'var(--text-main)', margin: 0 }}>
                {props.activeSpaceId ? `Projects — ${ctx.getSpaceName(props.activeSpaceId)}` : 'All Projects'}
              </h1>
              <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: "var(--space-1) 0 0 0" }}>
                Satukan dokumen, ide, dan pekerjaan dalam satu project.
              </p>
            </div>
            <button type="button" class="btn-primary" onClick={() => ctx.setIsNewProjectModalOpen(true)} style={{ display: 'flex', "align-items": 'center', gap: "var(--space-2)", padding: "var(--space-2) var(--space-4)", "font-size": '13px' }}>
              <Plus size={15} />
              <span>New Project</span>
            </button>
          </div>

          <div class="project-grid" style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fill, minmax(320px, 1fr))', gap: "var(--space-5)" }}>
            <Show when={!ctx.loadingProjects()} fallback={<div style={{ "grid-column": '1 / -1', color: 'var(--text-dim)', padding: "var(--space-9) 0", "text-align": 'center', "font-size": '13px' }}>
              Memuat projects...
            </div>}>
              <Show when={ctx.projects().length > 0} fallback={<div style={{ "grid-column": '1 / -1', padding: "var(--space-12) var(--space-6)", "text-align": 'center', border: '1px dashed var(--border-default)', "border-radius": '8px', color: 'var(--text-muted)' }}>
                <p style={{ "font-size": '14px', margin: "0 0 var(--space-2) 0", "font-weight": 500, color: 'var(--text-main)' }}>Belum ada project di space ini</p>
                <p style={{ "font-size": '12px', color: 'var(--text-dim)', margin: 0 }}>Klik tombol New Project untuk membuat project pertama di space ini.</p>
              </div>}>
                <For each={ctx.projects()}>
                  {(proj) => (<div class="project-card" role="button" tabindex="0" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(proj); } }} onClick={() => openProject(proj)} style={{
                    padding: "var(--space-5)",
                    "border-radius": '8px',
                    "background-color": 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    "flex-direction": 'column',
                    "justify-content": 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', "flex-direction": 'column', gap: "var(--space-2)" }}>
                      <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                        <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', color: 'var(--secondary)', background: 'var(--surface-muted)', padding: "var(--space-1) var(--space-2)", "border-radius": '3px' }}>
                          {ctx.getSpaceName(proj.space_id)}
                        </span>
                        <span style={{ "font-size": '12px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)', "text-transform": 'capitalize' }}>
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

                    <div class="project-card-footer" style={{ "margin-top": "var(--space-4)", "padding-top": "var(--space-3)", "border-top": '1px solid var(--border-default)', display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)' }}>
                      <div style={{ display: 'flex', gap: "var(--space-2)" }}>
                        <span>Target: {proj.target_date ? new Date(proj.target_date).toLocaleDateString() : 'Ongoing'}</span>
                      </div>
                      <span class="project-open">Open Hub <span class="direction-badge" aria-hidden="true"><ArrowRight size={14} /></span></span>
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
