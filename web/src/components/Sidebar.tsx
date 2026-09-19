import type { Component } from 'solid-js';

interface SidebarProps {
  currentRoute: string;
  activeSpaceId: string;
  onNavigate: (route: string, spaceId?: string) => void;
  onOpenQuickCapture: () => void;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const spaces = [
    { id: 'all', name: 'All Spaces', route: 'spaces' },
    { id: 'kantor', name: 'Kantor', route: 'spaces' },
    { id: 'pribadi', name: 'Pribadi', route: 'spaces' },
    { id: 'bisnis-a', name: 'Bisnis A', route: 'canvas' },
    { id: 'bisnis-b', name: 'Bisnis B', route: 'spaces' }
  ];

  return (
    <aside class="orca-sidebar">
      <div style={{ display: 'flex', "flex-direction": 'column', gap: '24px' }}>
        {/* Wordmark Header */}
        <div class="sidebar-brand-row">
          <div class="brand-logo" onClick={() => props.onNavigate('spaces')}>
            <span class="brand-text">ORCA</span>
            <span class="brand-cyan-dot"></span>
          </div>
          <button 
            aria-label="Collapse sidebar" 
            class="btn-ghost-icon"
            style={{ width: '28px', height: '28px' }}
          >
            <span class="material-symbols-outlined" style={{ "font-size": '17px' }}>dock_to_right</span>
          </button>
        </div>

        {/* Spaces Switcher */}
        <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px' }}>
          <div class="sidebar-section-header">
            <span>Spaces</span>
            <button 
              class="btn-ghost-icon" 
              style={{ width: '20px', height: '20px' }} 
              onClick={() => props.onNavigate('spaces')}
              title="Manage Spaces"
            >
              <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>tune</span>
            </button>
          </div>

          <div style={{ display: 'flex', "flex-direction": 'column', gap: '2px' }}>
            {spaces.map(s => {
              const isCanvasRoute = ['canvas', 'documents', 'tasks'].includes(props.currentRoute);
              const isActive = (s.id === 'bisnis-a' && isCanvasRoute) || 
                               (s.id === 'all' && props.currentRoute === 'spaces' && props.activeSpaceId === 'all') ||
                               (props.activeSpaceId === s.id);

              return (
                <div
                  class={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => props.onNavigate(s.route, s.id)}
                >
                  <span>{s.name}</span>
                </div>
              );
            })}
          </div>

          {/* Subproject under active space */}
          <div style={{ "margin-top": '-4px' }}>
            <span 
              class="subproject-link"
              style={{ cursor: 'pointer' }}
              onClick={() => props.onNavigate('canvas', 'bisnis-a')}
            >
              Rebranding & Launch
            </span>
          </div>
        </div>

        {/* Navigation Views Section */}
        <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px' }}>
          <div class="sidebar-section-header">Views</div>
          <nav style={{ display: 'flex', "flex-direction": 'column', gap: '2px' }}>
            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'spaces' ? 'active' : ''}`}
              onClick={() => props.onNavigate('spaces')}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px', color: 'var(--text-dim)' }}>grid_view</span>
              <span>Spaces Master</span>
            </div>

            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'canvas-hub' ? 'active' : ''}`}
              onClick={() => props.onNavigate('canvas-hub')}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px', color: 'var(--secondary)' }}>dashboard</span>
              <span>Canvas Hub</span>
            </div>

            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'canvas' ? 'active' : ''}`}
              onClick={() => props.onNavigate('canvas')}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px', color: 'var(--secondary)' }}>gesture</span>
              <span>Spatial Canvas</span>
            </div>

            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'documents' ? 'active' : ''}`}
              onClick={() => props.onNavigate('documents')}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px', color: 'var(--tertiary)' }}>description</span>
              <span>Documents</span>
            </div>

            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'tasks' ? 'active' : ''}`}
              onClick={() => props.onNavigate('tasks')}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px', color: 'var(--secondary)' }}>check_circle</span>
              <span>Tasks & Sprint</span>
            </div>

            <div 
              class={`sidebar-nav-item ${props.currentRoute === 'calendar' ? 'active' : ''}`}
              onClick={() => props.onNavigate('calendar')}
            >
              <span class="material-symbols-outlined" style={{ "font-size": '17px', color: 'var(--primary)' }}>calendar_today</span>
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
            <span class="material-symbols-outlined" style={{ "font-size": '16px', color: 'var(--secondary)' }}>bolt</span>
            <span style={{ "font-weight": 500 }}>Quick Capture</span>
          </div>
          <span class="kbd-badge">Ctrl+K</span>
        </button>
      </div>
    </aside>
  );
};
