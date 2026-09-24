import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, Switch, Match } from 'solid-js';
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
      {/* Sidebar Navigation */}
      <Sidebar 
        currentRoute={currentRoute()} 
        activeSpaceId={activeSpaceId()} 
        activeProjectId={activeProjectId()}
        onNavigate={handleNavigate}
        onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
      />

      {/* Main View Area */}
      <div class="orca-main-viewport">
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
      />
    </div>
  );
};

export default App;
