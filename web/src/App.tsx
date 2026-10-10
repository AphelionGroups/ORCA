import type { Component } from 'solid-js';
import { createSignal, createEffect, onMount, onCleanup, Switch, Match, Show } from 'solid-js';
import { PanelLeftOpen } from 'lucide-solid';
import { installControlInteractions } from './services/controlInteractions';
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
  const mobileQuery = window.matchMedia('(max-width: 767px)');
  const [isMobile, setIsMobile] = createSignal(mobileQuery.matches);
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(!mobileQuery.matches);
  let sidebarTrigger: HTMLButtonElement | undefined;
  createEffect(() => {
    if (!isAuthenticated() || !isMobile() || !isSidebarOpen()) return;
    const sidebar = document.getElementById('workspace-navigation');
    const controls = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]') || []).filter(el => el.offsetParent !== null);
    queueMicrotask(() => controls()[0]?.focus());
    const trap = (event: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); setIsSidebarOpen(false); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || !sidebar?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    onCleanup(() => {
      document.removeEventListener('keydown', trap);
      queueMicrotask(() => {
        if (document.querySelector('[aria-modal="true"]')) return;
        sidebarTrigger?.focus();
      });
    });
  });

  const handleNavigate = (route: string, spaceId?: string | null, projectId?: string | null) => {
    setCurrentRoute(route);
    if (isMobile()) setIsSidebarOpen(false);
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
      if (!isAuthenticated() || (document.querySelector('[aria-modal="true"]') && !isQuickCaptureOpen())) return;
      e.preventDefault();
      setIsQuickCaptureOpen(prev => !prev);
    }
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    const cleanupControls = installControlInteractions(document.body);
    const resizeSidebar = () => { setIsMobile(mobileQuery.matches); setIsSidebarOpen(!mobileQuery.matches); };
    mobileQuery.addEventListener('change', resizeSidebar);

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
      cleanupControls();
      mobileQuery.removeEventListener('change', resizeSidebar);
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
            title="Buka Sidebar" aria-label="Buka Sidebar" aria-controls="workspace-navigation" aria-expanded={isSidebarOpen()} ref={sidebarTrigger}
          >
            <PanelLeftOpen size={16} />
          </button>
        </Show>

        <Show when={isMobile() && isSidebarOpen()}><button class="sidebar-drawer-backdrop" aria-label="Tutup navigasi" tabindex="-1" onClick={() => setIsSidebarOpen(false)} /></Show>
        {/* Sidebar Navigation */}
        <Sidebar 
          isOpen={isSidebarOpen()}
          onToggle={() => setIsSidebarOpen(prev => !prev)}
          currentRoute={currentRoute()} 
          activeSpaceId={activeSpaceId()} 
          activeProjectId={activeProjectId()}
          currentUser={currentUser()}
          onNavigate={handleNavigate}
          onOpenQuickCapture={() => { if (isMobile()) setIsSidebarOpen(false); setIsQuickCaptureOpen(true); }}
          onOpenProfile={() => { if (isMobile()) setIsSidebarOpen(false); setIsProfileModalOpen(true); }}
          onLogout={handleLogout}
        />

        {/* Main View Area */}
        <div inert={isMobile() && isSidebarOpen()} class={`orca-main-viewport ${isSidebarOpen() ? '' : 'sidebar-collapsed'}`}>
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
                onSelectProject={(projectId, spaceId) => handleNavigate('projects', spaceId, projectId)}
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
