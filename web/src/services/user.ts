// =========================================================
// ORCA User Profile & Identity Service
// =========================================================

export interface UserProfile {
  id: string;
  workspace_id?: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role?: string;
}

export const DEFAULT_USER: UserProfile = {
  id: '018f0000-0000-7000-8000-000000000002',
  workspace_id: '018f0000-0000-7000-8000-000000000001',
  name: 'Nurhabib Assolihudin',
  email: 'user@orca.local',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=faces',
  role: 'Owner'
};

export const getCurrentUser = (): UserProfile => {
  try {
    const saved = localStorage.getItem('orca_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.name || parsed.full_name)) {
        return {
          id: parsed.id,
          workspace_id: parsed.workspace_id,
          name: parsed.name || parsed.full_name,
          email: parsed.email,
          avatar_url: parsed.avatar_url,
          role: parsed.role || 'Owner'
        };
      }
    }
  } catch (_) {}
  return DEFAULT_USER;
};

export const setCurrentUser = (user: UserProfile) => {
  try {
    localStorage.setItem('orca_current_user', JSON.stringify(user));
  } catch (_) {}
};

export const clearCurrentUser = () => {
  try {
    localStorage.removeItem('orca_current_user');
    localStorage.removeItem('orca_auth_token');
  } catch (_) {}
};
