import type { Component } from 'solid-js';
import { createSignal, onMount, For } from 'solid-js';
import { 
  Inbox, 
  FolderKanban, 
  CheckSquare, 
  Calendar, 
  SlidersHorizontal, 
  Bolt,
  PanelLeftClose
} from 'lucide-solid';
import { api, type Space } from '../services/api';

interface SidebarProps {
  currentRoute: string;
  activeSpaceId: string | null;
  onNavigate: (route: string, spaceId?: string | null) => void;
  onOpenQuickCapture: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const [spaces, setSpaces] = createSignal<{ id: string | null; name: string; slug: string }[]>([
    { id: null, name: 'All Spaces', slug: 'all' },
    { id: '018f0000-0000-7000-8000-000000000010', name: 'Kantor', slug: 'kantor' },
    { id: '018f0000-0000-7000-8000-000000000020', name: 'Pribadi', slug: 'pribadi' },
    { id: '018f0000-0000-7000-8000-000000000030', name: 'Bisnis A', slug: 'bisnis-a' },
    { id: '018f0000-0000-7000-8000-000000000040', name: 'Bisnis B', slug: 'bisnis-b' }
  ]);

  onMount(async () => {
    try {
      const data = await api.getSpaces();
      if (data && data.length > 0) {
        setSpaces([
          { id: null, name: 'All Spaces', slug: 'all' },
          ...data.map((s: Space) => ({ id: s.id, name: s.name, slug: s.slug }))
        ]);
      }
    } catch (_) {}
  });

  return (
    <aside class="orca-sidebar">
      <div style={{ display: 'flex', "flex-direction": 'column', gap: '24px' }}>
        {/* Wordmark Header */}
        <div class="sidebar-brand-row">
          <div class="brand-logo" onClick={() => props.onNavigate('projects', null)}>
            <span class="brand-text">ORCA</span>
            <span class="brand-cyan-dot"></span>
          </div>
          <button 
            aria-label="Collapse sidebar" 
            class="btn-ghost-icon"
            style={{ width: '28px', height: '28px' }}
          >
            <PanelLeftClose size={16} color="var(--text-dim)" />
          </button>
        </div>

        {/* Spaces Switcher */}
        <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px' }}>
          <div class="sidebar-section-header">
            <span>Spaces</span>
            <button 
              class="btn-ghost-icon" 
              style={{ width: '20px', height: '20px' }} 
              onClick={() => props.onNavigate('projects', null)}
              title="Filter Spaces"
            >
              <SlidersHorizontal size={13} color="var(--text-dim)" />
            </button>
          </div>

          <div style={{ display: 'flex', "flex-direction": 'column', gap: '2px' }}>
            <For each={spaces()}>
              {(s) => {
                const isActive = () => props.activeSpaceId === s.id;
                return (
                  <div
                    class={`sidebar-nav-item ${isActive() ? 'active' : ''}`}
                    onClick={() => props.onNavigate(props.currentRoute, s.id)}
                  >
                    <span>{s.name}</span>
                  </div>
                );
              }}
            </For>
          </div>
        </div>

        {/* Navigation Views Section */}
        <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px' }}>
          <div class="sidebar-section-header">Views</div>
          <nav style={{ display: 'flex', "flex-direction": 'column', gap: '2px' }}>
            {/* 1. Inbox */}
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'inbox' ? 'active' : ''}`}
              onClick={() => props.onNavigate('inbox')}
            >
              <Inbox size={16} color={props.currentRoute === 'inbox' ? 'var(--secondary)' : 'var(--text-dim)'} />
              <span>Inbox</span>
            </div>

            {/* 2. Projects */}
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'projects' ? 'active' : ''}`}
              onClick={() => props.onNavigate('projects')}
            >
              <FolderKanban size={16} color={props.currentRoute === 'projects' ? 'var(--primary)' : 'var(--text-dim)'} />
              <span>Projects</span>
            </div>

            {/* 3. Tasks */}
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'tasks' ? 'active' : ''}`}
              onClick={() => props.onNavigate('tasks')}
            >
              <CheckSquare size={16} color={props.currentRoute === 'tasks' ? 'var(--secondary)' : 'var(--text-dim)'} />
              <span>Tasks</span>
            </div>

            {/* 4. Calendar */}
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'calendar' ? 'active' : ''}`}
              onClick={() => props.onNavigate('calendar')}
            >
              <Calendar size={16} color={props.currentRoute === 'calendar' ? 'var(--tertiary)' : 'var(--text-dim)'} />
              <span>Calendar</span>
            </div>
          </nav>
        </div>
      </div>

      {/* Quick Capture Bottom Button */}
      <div style={{ "padding-top": '16px', "border-top": '1px solid var(--border-subtle)' }}>
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
    </aside>
  );
};
