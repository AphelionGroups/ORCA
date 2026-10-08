import type { Component } from 'solid-js';
import { createSignal, createEffect, onMount, onCleanup, Switch, Match, Show } from 'solid-js';
import { PanelLeftOpen } from 'lucide-solid';
import { Sidebar } from './components/Sidebar';
import { QuickCaptureModal } from './components/QuickCaptureModal';
import { ProfileModal } from './components/ProfileModal';
import { LoginView } from './views/LoginView';
import { InboxView } from './views/InboxView';
import { ProjectsView } from './views/ProjectsView';
import { CalendarView } from './views/CalendarView';
import { api, getAuthToken } from './services/api';
import { getCurrentUser, setCurrentUser, type UserProfile } from './services/user';

export const App: Component = () => {
  const [isAuthenticated, setIsAuthenticated] = createSignal<boolean>(Boolean(getAuthToken()));
  const [currentUser, setCurrentUserState] = createSignal<UserProfile>(getCurrentUser());
  const [isProfileModalOpen, setIsProfileModalOpen] = createSignal<boolean>(false);
  const [currentRoute, setCurrentRoute] = createSignal<string>('projects');
  const [activeSpaceId, setActiveSpaceId] = createSignal<string | null>(null);
  const [activeProjectId, setActiveProjectId] = createSignal<string | null>(null);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = createSignal<boolean>(false);
  const [isMobile, setIsMobile] = createSignal(window.matchMedia('(max-width: 767px)').matches);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal<boolean>(!isMobile());
  createEffect(() => {
    if (!isMobile() || !isSidebarOpen() || !isAuthenticated()) return;
    queueMicrotask(() => document.querySelector<HTMLElement>('#workspace-navigation button')?.focus());
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); setIsSidebarOpen(false); }
      if (event.key === 'Tab') {
        const sidebar = document.getElementById('workspace-navigation');
        const items = Array.from(sidebar?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    onCleanup(() => { document.removeEventListener('keydown', keyboard); requestAnimationFrame(() => document.querySelector<HTMLElement>('.sidebar-toggle-floating-btn')?.focus()); });
  });

  const handleNavigate = (route: string, spaceId?: string | null, projectId?: string | null) => {
    if (isMobile()) setIsSidebarOpen(false);
    setCurrentRoute(route);
    if (route === 'inbox' || route === 'calendar') {
      setActiveSpaceId(null);
      setActiveProjectId(null);
      return;
    }
    setActiveSpaceId(spaceId ?? null);
    setActiveProjectId(projectId ?? null);
  };

  // Global keyboard shortcut Ctrl+K / Cmd+K
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setIsQuickCaptureOpen(prev => !prev);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
  };

  onMount(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const resize = (event: MediaQueryListEvent) => { setIsMobile(event.matches); setIsSidebarOpen(!event.matches); };
    media.addEventListener('change', resize);
    onCleanup(() => media.removeEventListener('change', resize));
    window.addEventListener('keydown', handleKeyDown);

    const handleAuthRevoked = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('orca:auth_unauthorized', handleAuthRevoked);
    window.addEventListener('orca:auth_logout', handleAuthRevoked);

    // If token exists, verify token & sync profile
    if (getAuthToken()) {
      api.getProfile().then(data => {
        const profile: UserProfile = {
          id: data.id,
          workspace_id: data.workspace_id,
          name: data.full_name,
          email: data.email,
          avatar_url: data.avatar_url,
          role: data.role
        };
        setCurrentUser(profile);
        setCurrentUserState(profile);
        setIsAuthenticated(true);
      }).catch(_ => {
        setIsAuthenticated(false);
      });
    }

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('orca:auth_unauthorized', handleAuthRevoked);
      window.removeEventListener('orca:auth_logout', handleAuthRevoked);
    });
  });

  return (
    <Show 
      when={isAuthenticated()} 
      fallback={
        <LoginView 
          onLoginSuccess={(user) => {
            setCurrentUserState(user);
            setIsAuthenticated(true);
          }} 
        />
      }
    >
      <div class="orca-app">
        {/* Floating Sidebar Reopen Button when Sidebar is Collapsed */}
        <Show when={!isSidebarOpen()}>
          <button 
            type="button"
            class="sidebar-toggle-floating-btn" 
            onClick={() => setIsSidebarOpen(true)}
            title="Buka Sidebar" aria-label="Buka Sidebar" aria-expanded={isSidebarOpen()} aria-controls="workspace-navigation"
          >
            <PanelLeftOpen size={16} />
          </button>
        </Show>

        <Show when={isMobile() && isSidebarOpen()}>
          <button class="sidebar-drawer-backdrop" aria-label="Tutup Sidebar" tabIndex={-1} onClick={() => setIsSidebarOpen(false)} />
        </Show>
        {/* Sidebar Navigation */}
        <Sidebar 
          isOpen={isSidebarOpen()}
          onToggle={() => setIsSidebarOpen(prev => !prev)}
          currentRoute={currentRoute()} 
          activeSpaceId={activeSpaceId()} 
          activeProjectId={activeProjectId()}
          currentUser={currentUser()}
          onNavigate={handleNavigate}
          onOpenQuickCapture={() => setIsQuickCaptureOpen(true)}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Main View Area */}
        <main id="main-content" aria-label="Workspace" inert={isMobile() && isSidebarOpen()} class={`orca-main-viewport ${isSidebarOpen() ? '' : 'sidebar-collapsed'}`}>
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
        </main>

        {/* Rapid Action Modal */}
        <QuickCaptureModal 
          isOpen={isQuickCaptureOpen()} 
          onClose={() => setIsQuickCaptureOpen(false)}
          onItemCreated={() => {
            const curRoute = currentRoute();
            handleNavigate(curRoute, activeSpaceId(), activeProjectId());
          }}
        />

        {/* User Profile Edit Modal */}
        <ProfileModal 
          isOpen={isProfileModalOpen()}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={(updated) => {
            setCurrentUserState(updated);
          }}
        />
      </div>
    </Show>
  );
};

export default App;
