import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, Switch, Match } from 'solid-js';
import { Sidebar } from './components/Sidebar';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { InboxView } from './views/InboxView';
import { ProjectsView } from './views/ProjectsView';
import { TasksView } from './views/TasksView';
import { CalendarView } from './views/CalendarView';

export const App: Component = () => {
  const [currentRoute, setCurrentRoute] = createSignal<string>('projects');
  const [activeSpaceId, setActiveSpaceId] = createSignal<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = createSignal<boolean>(false);

  const handleNavigate = (route: string, spaceId?: string | null) => {
    setCurrentRoute(route);
    if (spaceId !== undefined) {
      setActiveSpaceId(spaceId);
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
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'tasks'}>
            <TasksView 
              activeSpaceId={activeSpaceId()} 
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
