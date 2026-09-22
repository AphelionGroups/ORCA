// =========================================================
// ORCA User Profile & Identity Service
// =========================================================

export interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
  role?: string;
}

export const DEFAULT_USER: UserProfile = {
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'Nurhabib Assolihudin',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop&crop=faces',
  role: 'Creator'
};

export const getCurrentUser = (): UserProfile => {
  try {
    const saved = localStorage.getItem('orca_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.name) return parsed;
    }
  } catch (_) {}
  return DEFAULT_USER;
};

export const setCurrentUser = (user: UserProfile) => {
  try {
    localStorage.setItem('orca_current_user', JSON.stringify(user));
  } catch (_) {}
};
