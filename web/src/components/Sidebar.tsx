import type { Component } from 'solid-js';
import { createSignal, onMount, For, Show } from 'solid-js';
import { 
  Inbox, 
  Calendar, 
  FolderKanban,
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Bolt,
  PanelLeftClose,
  Sun,
  Moon,
  Monitor,
  Briefcase,
  User,
  Rocket,
  Layers,
  Folder,
  Globe,
  Sparkles
} from 'lucide-solid';
import { api, type Space, type Project } from '../services/api';
import { themeMode, setThemeMode } from '../services/theme';
import { SpaceModal } from './SpaceModal';
import { ProjectModal } from './ProjectModal';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentRoute: string;
  activeSpaceId: string | null;
  activeProjectId?: string | null;
  onNavigate: (route: string, spaceId?: string | null, projectId?: string | null) => void;
  onOpenQuickCapture: () => void;
}

const getSpaceIconComponent = (iconId?: string) => {
  switch (iconId) {
    case 'briefcase': return Briefcase;
    case 'user': return User;
    case 'rocket': return Rocket;
    case 'layers': return Layers;
    case 'globe': return Globe;
    case 'sparkles': return Sparkles;
    case 'folder':
    default: return Folder;
  }
};

export const Sidebar: Component<SidebarProps> = (props) => {
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [collapsedSpaces, setCollapsedSpaces] = createSignal<Record<string, boolean>>({});

  // Modals state
  const [isSpaceModalOpen, setIsSpaceModalOpen] = createSignal(false);
  const [spaceToEdit, setSpaceToEdit] = createSignal<Space | null>(null);

  const [isProjectModalOpen, setIsProjectModalOpen] = createSignal(false);
  const [projectToEdit, setProjectToEdit] = createSignal<Project | null>(null);
  const [projectModalDefaultSpaceId, setProjectModalDefaultSpaceId] = createSignal('');

  const loadData = async () => {
    try {
      const [fetchedSpaces, fetchedProjects] = await Promise.all([
        api.getSpaces(),
        api.getProjects()
      ]);
      if (fetchedSpaces) setSpaces(fetchedSpaces);
      if (fetchedProjects) setProjects(fetchedProjects);
    } catch (err) {
      console.error('Failed to load spaces and projects in sidebar:', err);
    }
  };

  onMount(() => {
    loadData();
  });

  const toggleSpaceCollapse = (spaceId: string, e: MouseEvent) => {
    e.stopPropagation();
    setCollapsedSpaces(prev => ({
      ...prev,
      [spaceId]: !prev[spaceId]
    }));
  };

  const handleOpenNewSpaceModal = () => {
    setSpaceToEdit(null);
    setIsSpaceModalOpen(true);
  };

  const handleOpenEditSpaceModal = (space: Space, e: MouseEvent) => {
    e.stopPropagation();
    setSpaceToEdit(space);
    setIsSpaceModalOpen(true);
  };

  const handleOpenNewProjectModal = (spaceId?: string, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setProjectToEdit(null);
    setProjectModalDefaultSpaceId(spaceId || (spaces()[0]?.id || ''));
    setIsProjectModalOpen(true);
  };

  const handleOpenEditProjectModal = (project: Project, e: MouseEvent) => {
    e.stopPropagation();
    setProjectToEdit(project);
    setIsProjectModalOpen(true);
  };

  const getProjectsForSpace = (spaceId: string) => {
    return projects().filter(p => p.space_id === spaceId);
  };

  return (
    <aside class={`orca-sidebar ${props.isOpen ? '' : 'collapsed'}`}>
      {/* 1. Fixed Header */}
      <div class="sidebar-brand-row">
        <div class="brand-logo" onClick={() => props.onNavigate('projects', null, null)}>
          <span class="brand-text">ORCA</span>
        </div>
        <button 
          type="button"
          aria-label="Collapse sidebar" 
          class="btn-ghost-icon"
          style={{ width: '28px', height: '28px' }}
          onClick={props.onToggle}
          title="Tutup Sidebar"
        >
          <PanelLeftClose size={16} color="var(--text-dim)" />
        </button>
      </div>

      {/* 2. Scrollable Middle Section (Views & Spaces) */}
      <div class="sidebar-scroll-area">
        {/* 1. Navigation Views Section (Moved to TOP: Only Inbox & Calendar) */}
        <div style={{ display: 'flex', "flex-direction": 'column', gap: '4px' }}>
          <div class="sidebar-section-header">Views</div>
          <nav style={{ display: 'flex', "flex-direction": 'column', gap: '2px' }}>
            {/* 1. Inbox */}
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'inbox' ? 'active' : ''}`}
              onClick={() => props.onNavigate('inbox', props.activeSpaceId, null)}
            >
              <Inbox size={15} color={props.currentRoute === 'inbox' ? 'var(--secondary)' : 'var(--text-dim)'} />
              <span>Inbox</span>
            </div>

            {/* 2. Calendar */}
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'calendar' ? 'active' : ''}`}
              onClick={() => props.onNavigate('calendar', props.activeSpaceId, null)}
            >
              <Calendar size={15} color={props.currentRoute === 'calendar' ? 'var(--tertiary)' : 'var(--text-dim)'} />
              <span>Calendar</span>
            </div>
          </nav>
        </div>

        {/* 2. Spaces Section with Collapsible Projects Tree */}
        <div style={{ display: 'flex', "flex-direction": 'column', gap: '4px' }}>
          <div class="sidebar-section-header" style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <span>Spaces</span>
            <div style={{ display: 'flex', "align-items": 'center', gap: '4px' }}>
              <button 
                class="btn-ghost-icon" 
                style={{ width: '20px', height: '20px' }} 
                onClick={handleOpenNewSpaceModal}
                title="Tambah Space Baru"
              >
                <Plus size={13} color="var(--text-dim)" />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', "flex-direction": 'column', gap: '2px' }}>
            {/* All Spaces Entry */}
            <div
              class={`sidebar-space-row ${props.activeSpaceId === null && !props.activeProjectId ? 'active' : ''}`}
              onClick={() => props.onNavigate('projects', null, null)}
            >
              <div class="sidebar-space-left">
                <span style={{ width: '16px', display: 'inline-block' }} />
                <Layers size={14} style={{ color: 'var(--text-muted)', "flex-shrink": 0 }} />
                <span class="sidebar-space-title">All Spaces</span>
              </div>
            </div>

            {/* List of Spaces */}
            <For each={spaces()}>
              {(space) => {
                const isCollapsed = () => !!collapsedSpaces()[space.id];
                const spaceProjects = () => getProjectsForSpace(space.id);
                const isSpaceActive = () => props.activeSpaceId === space.id;
                const SpaceIcon = getSpaceIconComponent(space.icon);

                return (
                  <div class="sidebar-space-group">
                    {/* Space Row: Clicking toggles collapse and opens the space's project cards */}
                    <div 
                      class={`sidebar-space-row ${isSpaceActive() ? 'active' : ''}`}
                      onClick={() => {
                        // 1. Toggle collapse status (terbalik dari status sebelumnya)
                        setCollapsedSpaces(prev => ({
                          ...prev,
                          [space.id]: !prev[space.id]
                        }));
                        // 2. Tampilkan card project dari space ini
                        props.onNavigate('projects', space.id, null);
                      }}
                      title={`Klik untuk buka/tutup dan tampilkan projects ${space.name}`}
                    >
                      <div class="sidebar-space-left">
                        {/* Chevron Collapse Toggle */}
                        <button
                          type="button"
                          class="sidebar-chevron-btn"
                          onClick={(e) => toggleSpaceCollapse(space.id, e)}
                          title={isCollapsed() ? 'Expand Space' : 'Collapse Space'}
                        >
                          <Show when={isCollapsed()} fallback={<ChevronDown size={13} />}>
                            <ChevronRight size={13} />
                          </Show>
                        </button>

                        {/* Space Icon (Colored with selected space color) */}
                        <SpaceIcon 
                          size={14} 
                          style={{ color: space.color || 'var(--primary)', "flex-shrink": 0 }} 
                        />

                        {/* Space Name */}
                        <span class="sidebar-space-title" title={space.name}>
                          {space.name}
                        </span>
                      </div>

                      {/* Space Hover Actions */}
                      <div class="sidebar-row-actions">
                        <button
                          type="button"
                          class="sidebar-action-icon-btn"
                          onClick={(e) => handleOpenNewProjectModal(space.id, e)}
                          title={`Tambah Project ke ${space.name}`}
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          class="sidebar-action-icon-btn"
                          onClick={(e) => handleOpenEditSpaceModal(space, e)}
                          title="Edit Space"
                        >
                          <MoreVertical size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Nested Projects Tree */}
                    <Show when={!isCollapsed()}>
                      <div class="sidebar-project-tree">
                        <For each={spaceProjects()}>
                          {(project) => {
                            const isProjectActive = () => props.activeProjectId === project.id;
                            return (
                              <div
                                class={`sidebar-project-item ${isProjectActive() ? 'active' : ''}`}
                                onClick={() => props.onNavigate('projects', space.id, project.id)}
                                title={project.name}
                              >
                                <div class="sidebar-project-item-left">
                                  <FolderKanban size={13} style={{ "flex-shrink": 0, opacity: isProjectActive() ? 1 : 0.6 }} />
                                  <span class="sidebar-project-title">
                                    {project.name}
                                  </span>
                                </div>

                                <div class="sidebar-row-actions">
                                  <button
                                    type="button"
                                    class="sidebar-action-icon-btn"
                                    onClick={(e) => handleOpenEditProjectModal(project, e)}
                                    title="Edit Project"
                                  >
                                    <MoreVertical size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          }}
                        </For>

                        {/* Add Project Shortcut */}
                        <button
                          type="button"
                          class="sidebar-add-project-link"
                          onClick={(e) => handleOpenNewProjectModal(space.id, e)}
                        >
                          <Plus size={11} />
                          <span>Add project</span>
                        </button>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>

      {/* 3. Footer Area (Fixed) */}
      <div class="sidebar-footer-fixed">
        {/* Theme Switcher Widget */}
        <div class="sidebar-theme-widget">
          <button 
            type="button"
            class={`theme-toggle-btn ${themeMode() === 'light' ? 'active' : ''}`}
            onClick={() => setThemeMode('light')}
            title="Light Theme"
          >
            <Sun size={13} />
            <span>Light</span>
          </button>
          <button 
            type="button"
            class={`theme-toggle-btn ${themeMode() === 'system' ? 'active' : ''}`}
            onClick={() => setThemeMode('system')}
            title="System Theme"
          >
            <Monitor size={13} />
            <span>Auto</span>
          </button>
          <button 
            type="button"
            class={`theme-toggle-btn ${themeMode() === 'dark' ? 'active' : ''}`}
            onClick={() => setThemeMode('dark')}
            title="Dark Theme"
          >
            <Moon size={13} />
            <span>Dark</span>
          </button>
        </div>

        {/* Quick Capture Bottom Button */}
        <button 
          class="sidebar-quick-capture"
          onClick={() => props.onOpenQuickCapture()}
          type="button"
        >
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <Bolt size={15} color="var(--secondary)" />
            <span style={{ "font-weight": 500 }}>Quick Capture</span>
          </div>
          <span class="kbd-badge">Ctrl+K</span>
        </button>
      </div>

      {/* Space Modal (Create / Edit / Delete) */}
      <SpaceModal
        isOpen={isSpaceModalOpen()}
        spaceToEdit={spaceToEdit()}
        onClose={() => setIsSpaceModalOpen(false)}
        onSaved={async (saved) => {
          await loadData();
          if (!spaceToEdit()) {
            props.onNavigate(props.currentRoute, saved.id, null);
          }
        }}
        onDeleted={async (deletedId) => {
          await loadData();
          if (props.activeSpaceId === deletedId) {
            props.onNavigate(props.currentRoute, null, null);
          }
        }}
      />

      {/* Project Modal (Create / Edit / Delete) */}
      <ProjectModal
        isOpen={isProjectModalOpen()}
        projectToEdit={projectToEdit()}
        defaultSpaceId={projectModalDefaultSpaceId()}
        spaces={spaces()}
        onClose={() => setIsProjectModalOpen(false)}
        onSaved={async (saved) => {
          await loadData();
          // Open project board directly!
          props.onNavigate('projects', saved.space_id, saved.id);
        }}
        onDeleted={async (deletedId) => {
          await loadData();
          if (props.activeProjectId === deletedId) {
            props.onNavigate('projects', props.activeSpaceId, null);
          }
        }}
      />
    </aside>
  );
};
