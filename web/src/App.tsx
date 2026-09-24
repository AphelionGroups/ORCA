import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, Switch, Match, Show } from 'solid-js';
import { PanelLeftOpen } from 'lucide-solid';
import { Sidebar } from './components/Sidebar';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { InboxView } from './views/InboxView';
import { ProjectsView } from './views/ProjectsView';
import { CalendarView } from './views/CalendarView';

export const App: Component = () => {
  const [currentRoute, setCurrentRoute] = createSignal<string>('projects');
  const [activeSpaceId, setActiveSpaceId] = createSignal<string | null>(null);
  const [activeProjectId, setActiveProjectId] = createSignal<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = createSignal<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal<boolean>(true);

  const handleNavigate = (route: string, spaceId?: string | null, projectId?: string | null) => {
    setCurrentRoute(route);
    if (spaceId !== undefined) {
      setActiveSpaceId(spaceId);
    }
    if (projectId !== undefined) {
      setActiveProjectId(projectId);
    } else if (spaceId !== undefined && spaceId !== activeSpaceId()) {
      setActiveProjectId(null);
    }
  };

  // Global keyboard shortcut Ctrl+K / Cmd+K
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setIsQuickCaptureOpen(prev => !prev);
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div class="orca-app">
      {/* Floating Sidebar Reopen Button when Sidebar is Collapsed */}
      <Show when={!isSidebarOpen()}>
        <button 
          type="button"
          class="sidebar-toggle-floating-btn" 
          onClick={() => setIsSidebarOpen(true)}
          title="Buka Sidebar"
        >
          <PanelLeftOpen size={16} />
        </button>
      </Show>

      {/* Sidebar Navigation */}
      <Sidebar 
        isOpen={isSidebarOpen()}
        onToggle={() => setIsSidebarOpen(prev => !prev)}
        currentRoute={currentRoute()} 
        activeSpaceId={activeSpaceId()} 
        activeProjectId={activeProjectId()}
        onNavigate={handleNavigate}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Main View Area */}
      <div class={`orca-main-viewport ${isSidebarOpen() ? '' : 'sidebar-collapsed'}`}>
        <Switch>
          <Match when={currentRoute() === 'inbox'}>
            <InboxView 
              onNavigate={handleNavigate}
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'projects'}>
            <ProjectsView 
              activeSpaceId={activeSpaceId()} 
              activeProjectId={activeProjectId()}
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'calendar'}>
            <CalendarView 
              onNavigate={handleNavigate} 
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
        </Switch>
      </div>

      {/* Rapid Action Modal */}
      <QuickCaptureModal 
        isOpen={isQuickCaptureOpen()} 
        onClose={() => setIsQuickCaptureOpen(false)}
        onItemCreated={() => {
          // Re-trigger current route to reload
          const curRoute = currentRoute();
          handleNavigate(curRoute, activeSpaceId(), activeProjectId());
        }}
      />
    </div>
  );
};

export default App;
