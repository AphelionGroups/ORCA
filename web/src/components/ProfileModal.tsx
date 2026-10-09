import { focusScope } from './focusScope';
import type { Component } from 'solid-js';
import { createSignal, createEffect, Show } from 'solid-js';
import { X, Loader2 } from 'lucide-solid';
import { api } from '../services/api';
import { getCurrentUser, type UserProfile } from '../services/user';
interface ProfileModalProps { isOpen: boolean; onClose: () => void; onProfileUpdated?: (user: UserProfile) => void; }
export const ProfileModal: Component<ProfileModalProps> = props => {
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  createEffect(() => { if (props.isOpen) { const user = getCurrentUser(); setName(user.name); setEmail(user.email || ''); setError(''); } });
  const save = async (event: Event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const profile = await api.updateProfile({ full_name: name().trim(), email: email().trim() });
      props.onProfileUpdated?.({ id: profile.id, workspace_id: profile.workspace_id, name: profile.full_name, email: profile.email, avatar_url: profile.avatar_url });
      props.onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save profile.'); }
    finally { setSaving(false); }
  };
  return <Show when={props.isOpen}>
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="profile-modal-card" ref={el => focusScope(el, props.onClose)} onClick={event => event.stopPropagation()}>
        <div class="modal-header"><h2>Demo profile</h2><button type="button" class="icon-btn" aria-label="Close profile" onClick={props.onClose}><X size={18} /></button></div>
        <form onSubmit={save}>
          <div class="modal-body">
            <p>Your profile and workspace changes are saved only in this browser.</p>
            <div class="form-group"><label for="demo-name">Name</label><input id="demo-name" class="form-input" required value={name()} onInput={event => setName(event.currentTarget.value)} /></div>
            <div class="form-group"><label for="demo-email">Email</label><input id="demo-email" class="form-input" required type="email" value={email()} onInput={event => setEmail(event.currentTarget.value)} /></div>
            <Show when={error()}><p role="alert">{error()}</p></Show>
          </div>
          <div class="modal-footer"><button type="button" class="btn-secondary" onClick={props.onClose}>Cancel</button><button type="submit" class="btn-primary" disabled={saving()}>{saving() ? <Loader2 size={16} /> : 'Save profile'}</button></div>
        </form>
      </div>
    </div>
  </Show>;
};
