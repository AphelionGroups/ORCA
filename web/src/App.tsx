import type { Component } from 'solid-js';
import { createSignal, onMount, onCleanup, Switch, Match } from 'solid-js';
import { Sidebar } from './components/Sidebar';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { SpatialCanvasScreen } from './views/SpatialCanvasScreen';
import { CanvasHubScreen } from './views/CanvasHubScreen';
import { DocumentsScreen } from './views/DocumentsScreen';
import { TasksBoardScreen } from './views/TasksBoardScreen';
import { SpacesMasterScreen } from './views/SpacesMasterScreen';
import { CalendarScreen } from './views/CalendarScreen';

export const App: Component = () => {
  const [currentRoute, setCurrentRoute] = createSignal<string>('canvas');
  const [activeSpaceId, setActiveSpaceId] = createSignal<string>('bisnis-a');
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = createSignal<boolean>(false);

  const handleNavigate = (route: string, spaceId?: string) => {
    setCurrentRoute(route);
    if (spaceId) setActiveSpaceId(spaceId);
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
          <Match when={currentRoute() === 'canvas'}>
            <SpatialCanvasScreen 
              onNavigate={handleNavigate}
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'canvas-hub'}>
            <CanvasHubScreen 
              onNavigate={handleNavigate} 
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'documents'}>
            <DocumentsScreen 
              onNavigate={handleNavigate} 
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'tasks'}>
            <TasksBoardScreen 
              onNavigate={handleNavigate} 
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'spaces'}>
            <SpacesMasterScreen 
              onNavigate={handleNavigate} 
              onOpenQuickCapture={() => setIsQuickCaptureOpen(true)} 
            />
          </Match>
          <Match when={currentRoute() === 'calendar'}>
            <CalendarScreen 
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
