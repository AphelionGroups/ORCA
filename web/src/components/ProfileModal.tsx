import type { Component } from 'solid-js';
import { createSignal, createEffect, onCleanup, Show } from 'solid-js';
import { 
  X, 
  Camera, 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Loader2, 
  Check, 
  AlertCircle,
  HardDrive
} from 'lucide-solid';
import { api } from '../services/api';
import { getCurrentUser, setCurrentUser } from '../services/user';
import type { UserProfile } from '../services/user';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (user: UserProfile) => void;
}

export const ProfileModal: Component<ProfileModalProps> = (props) => {
  const [fullName, setFullName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [avatarUrl, setAvatarUrl] = createSignal('');
  const [currentPassword, setCurrentPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [showPasswordChange, setShowPasswordChange] = createSignal(false);
  const [isUploading, setIsUploading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [successMsg, setSuccessMsg] = createSignal<string | null>(null);
  const [storageDriver, setStorageDriver] = createSignal<string>('Object Storage');

  // Keyboard navigation: Escape key closes modal (UI/UX Pro Max Guideline)
  createEffect(() => {
    if (!props.isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        props.onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });

  createEffect(() => {
    if (props.isOpen) {
      const u = getCurrentUser();
      setFullName(u.name || '');
      setEmail(u.email || '');
      setAvatarUrl(u.avatar_url || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowPasswordChange(false);

      // Fetch fresh profile from backend
      api.getProfile().then(data => {
        setFullName(data.full_name);
        setEmail(data.email);
        setAvatarUrl(data.avatar_url || '');
        setCurrentUser({
          id: data.id,
          workspace_id: data.workspace_id,
          name: data.full_name,
          email: data.email,
          avatar_url: data.avatar_url,
          role: data.role
        });
      }).catch(_ => {});
    }
  });

  const handleAvatarFileChange = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Pilih file gambar yang valid (JPEG, PNG, WebP, GIF)');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const uploadRes = await api.uploadImage(file);
      setAvatarUrl(uploadRes.url);
      setStorageDriver(uploadRes.driver === 's3' ? 'S3/R2/Supabase' : 'Local Storage');
      setSuccessMsg(`Foto berhasil diunggah ke ${uploadRes.driver === 's3' ? 'Object Storage' : 'Local Storage'}! Simpan profil untuk menerapkan.`);
    } catch (err: any) {
      setErrorMsg('Gagal mengunggah foto: ' + (err.message || 'Error'));
    } finally {
      setIsUploading(false);
      input.value = '';
    }
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName().trim() || !email().trim()) {
      setErrorMsg('Nama lengkap dan email tidak boleh kosong');
      return;
    }

    if (showPasswordChange()) {
      if (!currentPassword()) {
        setErrorMsg('Masukkan password saat ini untuk mengganti password');
        return;
      }
      if (newPassword().length < 6) {
        setErrorMsg('Password baru minimal 6 karakter');
        return;
      }
      if (newPassword() !== confirmPassword()) {
        setErrorMsg('Konfirmasi password baru tidak cocok');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: any = {
        full_name: fullName().trim(),
        email: email().trim(),
        avatar_url: avatarUrl() || undefined
      };

      if (showPasswordChange()) {
        payload.current_password = currentPassword();
        payload.new_password = newPassword();
      }

      const updated = await api.updateProfile(payload);

      const profile: UserProfile = {
        id: updated.id,
        workspace_id: updated.workspace_id,
        name: updated.full_name,
        email: updated.email,
        avatar_url: updated.avatar_url,
        role: updated.role
      };
      setCurrentUser(profile);

      if (props.onProfileUpdated) {
        props.onProfileUpdated(profile);
      }

      setSuccessMsg('Profil berhasil diperbarui!');
      setTimeout(() => {
        props.onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan profil');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div 
          class="modal-container" 
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          style={{ width: '520px', "max-width": '95vw', "max-height": '90vh', "overflow-y": 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="modal-header" style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '18px' }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                "border-radius": '8px', 
                background: 'rgba(99, 102, 241, 0.15)', 
                color: 'var(--primary-fixed)', 
                display: 'flex', 
                "align-items": 'center', 
                "justify-content": 'center' 
              }}>
                <User size={18} aria-hidden="true" />
              </div>
              <div>
                <h3 id="profile-modal-title" style={{ margin: 0, "font-size": '16px', "font-weight": 600, color: 'var(--text-main)' }}>
                  Edit Profil Pengguna
                </h3>
                <span style={{ "font-size": '12px', color: 'var(--text-dim)' }}>
                  Kelola identitas, foto profil, dan keamanan akun ORCA
                </span>
              </div>
            </div>
            <button 
              type="button" 
              class="btn-icon" 
              aria-label="Tutup jendela edit profil"
              onClick={props.onClose} 
              style={{ "border-radius": '6px', padding: '8px' }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Feedback Messages */}
          <Show when={errorMsg()}>
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.12)', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              color: '#f87171', 
              padding: '10px 14px', 
              "border-radius": '8px', 
              "font-size": '13px', 
              display: 'flex', 
              "align-items": 'center', 
              gap: '8px', 
              "margin-bottom": '16px' 
            }}>
              <AlertCircle size={16} style={{ "flex-shrink": 0 }} />
              <span>{errorMsg()}</span>
            </div>
          </Show>

          <Show when={successMsg()}>
            <div style={{ 
              background: 'rgba(34, 197, 94, 0.12)', 
              border: '1px solid rgba(34, 197, 94, 0.3)', 
              color: '#4ade80', 
              padding: '10px 14px', 
              "border-radius": '8px', 
              "font-size": '13px', 
              display: 'flex', 
              "align-items": 'center', 
              gap: '8px', 
              "margin-bottom": '16px' 
            }}>
              <Check size={16} style={{ "flex-shrink": 0 }} />
              <span>{successMsg()}</span>
            </div>
          </Show>

          <form onSubmit={handleSave}>
            {/* Avatar Section */}
            <div style={{ 
              display: 'flex', 
              "align-items": 'center', 
              gap: '18px', 
              padding: '14px', 
              background: 'var(--surface-container-lowest)', 
              "border-radius": '10px', 
              border: '1px solid var(--border-default)', 
              "margin-bottom": '18px' 
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{ 
                  width: '68px', 
                  height: '68px', 
                  "border-radius": '50%', 
                  overflow: 'hidden', 
                  background: 'var(--surface-container-high)', 
                  border: '2px solid var(--primary-fixed)', 
                  display: 'flex', 
                  "align-items": 'center', 
                  "justify-content": 'center' 
                }}>
                  <Show when={avatarUrl()} fallback={
                    <User size={32} color="var(--text-dim)" />
                  }>
                    <img 
                      src={avatarUrl()} 
                      alt="Avatar" 
                      style={{ width: '100%', height: '100%', "object-fit": 'cover' }} 
                    />
                  </Show>
                </div>

                <label 
                  style={{ 
                    position: 'absolute', 
                    bottom: '-2px', 
                    right: '-2px', 
                    background: 'var(--primary-fixed)', 
                    color: '#000', 
                    "border-radius": '50%', 
                    width: '26px', 
                    height: '26px', 
                    display: 'flex', 
                    "align-items": 'center', 
                    "justify-content": 'center', 
                    cursor: isUploading() ? 'not-allowed' : 'pointer',
                    "box-shadow": '0 2px 6px rgba(0,0,0,0.4)' 
                  }}
                  title="Upload avatar ke Object Storage"
                >
                  <Show when={isUploading()} fallback={<Camera size={14} />}>
                    <Loader2 size={14} class="spin" />
                  </Show>
                  <input 
                    type="file" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    disabled={isUploading()} 
                    onChange={handleAvatarFileChange} 
                  />
                </label>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)', "margin-bottom": '4px' }}>
                  Foto Profil & Avatar
                </div>
                <div style={{ "font-size": '11px', color: 'var(--text-dim)', "margin-bottom": '8px' }}>
                  Disimpan otomatis ke Object Storage (Supabase Storage / Cloudflare R2 / AWS S3).
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <label 
                    class="btn-secondary" 
                    style={{ 
                      padding: '4px 10px', 
                      "font-size": '11px', 
                      display: 'inline-flex', 
                      "align-items": 'center', 
                      gap: '5px', 
                      cursor: 'pointer' 
                    }}
                  >
                    <Camera size={12} />
                    <span>{isUploading() ? 'Mengunggah...' : 'Ganti Foto'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      disabled={isUploading()} 
                      onChange={handleAvatarFileChange} 
                    />
                  </label>
                  <Show when={avatarUrl()}>
                    <button 
                      type="button" 
                      class="btn-secondary" 
                      style={{ padding: '4px 8px', "font-size": '11px', color: 'var(--text-dim)' }}
                      onClick={() => setAvatarUrl('')}
                    >
                      Hapus
                    </button>
                  </Show>
                </div>
              </div>
            </div>

            {/* General Fields */}
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '14px', "margin-bottom": '18px' }}>
              <div>
                <label for="profile-name-input" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                  Nama Lengkap
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="profile-name-input"
                    type="text" 
                    class="form-input" 
                    autocomplete="name"
                    style={{ width: '100%', "padding-left": '34px', "box-sizing": 'border-box' }} 
                    placeholder="Nama Lengkap" 
                    value={fullName()} 
                    onInput={(e) => setFullName(e.currentTarget.value)} 
                    required 
                  />
                  <User size={15} aria-hidden="true" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>
              </div>

              <div>
                <label for="profile-email-input" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                  Alamat Email (Login)
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    id="profile-email-input"
                    type="email" 
                    class="form-input" 
                    autocomplete="email"
                    style={{ width: '100%', "padding-left": '34px', "box-sizing": 'border-box' }} 
                    placeholder="email@orca.local" 
                    value={email()} 
                    onInput={(e) => setEmail(e.currentTarget.value)} 
                    required 
                  />
                  <Mail size={15} aria-hidden="true" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                </div>
              </div>

              {/* Workspace Badge */}
              <div style={{ 
                display: 'flex', 
                "align-items": 'center', 
                "justify-content": 'space-between', 
                padding: '8px 12px', 
                background: 'var(--surface-container-low)', 
                "border-radius": '6px', 
                "font-size": '11px', 
                color: 'var(--text-dim)' 
              }}>
                <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                  <ShieldCheck size={14} color="var(--primary-fixed)" />
                  <span>Workspace Role: <strong>Workspace Owner</strong></span>
                </div>
                <div style={{ display: 'flex', "align-items": 'center', gap: '5px' }}>
                  <HardDrive size={12} />
                  <span>Media: {storageDriver()}</span>
                </div>
              </div>
            </div>

            {/* Password Section Toggle */}
            <div style={{ "margin-bottom": '20px', border: '1px solid var(--border-default)', "border-radius": '8px', padding: '12px' }}>
              <div 
                style={{ 
                  display: 'flex', 
                  "justify-content": 'space-between', 
                  "align-items": 'center', 
                  cursor: 'pointer' 
                }}
                onClick={() => setShowPasswordChange(prev => !prev)}
              >
                <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                  <Lock size={15} color="var(--primary-fixed)" />
                  <span style={{ "font-size": '13px', "font-weight": 500, color: 'var(--text-main)' }}>
                    Ubah Kata Sandi (Password)
                  </span>
                </div>
                <button 
                  type="button" 
                  class="btn-secondary" 
                  style={{ padding: '4px 10px', "font-size": '11px' }}
                >
                  {showPasswordChange() ? 'Batal' : 'Ganti Password'}
                </button>
              </div>

              <Show when={showPasswordChange()}>
                <div style={{ display: 'flex', "flex-direction": 'column', gap: '10px', "margin-top": '14px', "padding-top": '12px', "border-top": '1px solid var(--border-default)' }}>
                  <div>
                    <label for="profile-cur-pass" style={{ display: 'block', "font-size": '11px', color: 'var(--text-dim)', "margin-bottom": '4px' }}>
                      Password Saat Ini
                    </label>
                    <input 
                      id="profile-cur-pass"
                      type="password" 
                      class="form-input" 
                      autocomplete="current-password"
                      style={{ width: '100%', "box-sizing": 'border-box' }} 
                      placeholder="Masukkan password saat ini" 
                      value={currentPassword()} 
                      onInput={(e) => setCurrentPassword(e.currentTarget.value)} 
                    />
                  </div>

                  <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label for="profile-new-pass" style={{ display: 'block', "font-size": '11px', color: 'var(--text-dim)', "margin-bottom": '4px' }}>
                        Password Baru
                      </label>
                      <input 
                        id="profile-new-pass"
                        type="password" 
                        class="form-input" 
                        autocomplete="new-password"
                        style={{ width: '100%', "box-sizing": 'border-box' }} 
                        placeholder="Min 6 karakter" 
                        value={newPassword()} 
                        onInput={(e) => setNewPassword(e.currentTarget.value)} 
                      />
                    </div>
                    <div>
                      <label for="profile-conf-pass" style={{ display: 'block', "font-size": '11px', color: 'var(--text-dim)', "margin-bottom": '4px' }}>
                        Konfirmasi Password Baru
                      </label>
                      <input 
                        id="profile-conf-pass"
                        type="password" 
                        class="form-input" 
                        autocomplete="new-password"
                        style={{ width: '100%', "box-sizing": 'border-box' }} 
                        placeholder="Ulangi password baru" 
                        value={confirmPassword()} 
                        onInput={(e) => setConfirmPassword(e.currentTarget.value)} 
                      />
                    </div>
                  </div>
                </div>
              </Show>
            </div>

            {/* Footer Actions */}
            <div style={{ display: 'flex', "justify-content": 'flex-end', gap: '8px' }}>
              <button 
                type="button" 
                class="btn-secondary" 
                onClick={props.onClose}
                disabled={isSaving()}
                style={{ "min-height": '36px' }}
              >
                Batal
              </button>
              <button 
                type="submit" 
                class="btn-primary" 
                style={{ display: 'inline-flex', "align-items": 'center', gap: '6px', "min-height": '36px' }}
                disabled={isSaving() || isUploading()}
                aria-busy={isSaving()}
              >
                <Show when={isSaving()} fallback={<Check size={15} />}>
                  <Loader2 size={15} class="spin" />
                </Show>
                <span>{isSaving() ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};
