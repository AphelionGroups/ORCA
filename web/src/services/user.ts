import { getDemoProfile } from './demoStorage';
export interface UserProfile { id: string; workspace_id?: string; name: string; email?: string; avatar_url?: string; role?: string; }
export const getCurrentUser = (): UserProfile => {
  const profile = getDemoProfile();
  return { id: profile.id, workspace_id: profile.workspace_id, name: profile.full_name, email: profile.email, avatar_url: profile.avatar_url };
};
