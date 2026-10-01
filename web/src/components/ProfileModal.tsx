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
  HardDrive,
  Eye,
  EyeOff,
  Cloud,
  KeyRound,
  Trash2,
  Sparkles,
  Info
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
  const [activeTab, setActiveTab] = createSignal<'general' | 'security' | 'storage'>('general');
  const [fullName, setFullName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [avatarUrl, setAvatarUrl] = createSignal('');
  const [currentPassword, setCurrentPassword] = createSignal('');
  const [newPassword, setNewPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [showCurrentPass, setShowCurrentPass] = createSignal(false);
  const [showNewPass, setShowNewPass] = createSignal(false);
  const [showConfPass, setShowConfPass] = createSignal(false);
  const [isUploading, setIsUploading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);
  const [successMsg, setSuccessMsg] = createSignal<string | null>(null);
  const [storageDriver, setStorageDriver] = createSignal<string>('Object Storage (S3 API)');

  // Keyboard navigation: Escape key closes modal (WCAG 2.2 Guideline)
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
      setActiveTab('general');

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

  const getPasswordStrength = () => {
    const p = newPassword();
    if (!p) return { label: '', color: 'transparent', score: 0 };
    if (p.length < 6) return { label: 'Terlalu pendek (min 6)', color: '#ef4444', score: 1 };
    const hasNum = /\d/.test(p);
    const hasSpecial = /[^A-Za-z0-9]/.test(p);
    if (p.length >= 8 && hasNum && hasSpecial) return { label: 'Sangat Kuat', color: '#22c55e', score: 3 };
    if (p.length >= 6 && (hasNum || hasSpecial)) return { label: 'Cukup Kuat', color: '#eab308', score: 2 };
    return { label: 'Standar', color: '#f97316', score: 1 };
  };

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
      setStorageDriver(uploadRes.driver === 's3' ? 'S3-Compatible (R2/Supabase/AWS)' : 'Local Disk Storage');
      setSuccessMsg(`Foto berhasil diunggah ke ${uploadRes.driver === 's3' ? 'Object Storage' : 'Local Storage'}!`);
      setTimeout(() => setSuccessMsg(null), 3500);
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

    const cleanName = fullName().trim();
    const cleanEmail = email().trim();

    if (!cleanName || !cleanEmail) {
      setErrorMsg('Nama lengkap dan email tidak boleh kosong');
      return;
    }

    if (newPassword()) {
      if (!currentPassword()) {
        setErrorMsg('Masukkan kata sandi saat ini untuk melakukan perubahan');
        setActiveTab('security');
        return;
      }
      if (newPassword().length < 6) {
        setErrorMsg('Kata sandi baru minimal 6 karakter');
        setActiveTab('security');
        return;
      }
      if (newPassword() !== confirmPassword()) {
        setErrorMsg('Konfirmasi kata sandi baru tidak cocok');
        setActiveTab('security');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: any = {
        full_name: cleanName,
        email: cleanEmail,
        avatar_url: avatarUrl() || undefined
      };

      if (newPassword() && currentPassword()) {
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

      setSuccessMsg('Profil dan data akun Anda berhasil diperbarui!');
      setTimeout(() => {
        props.onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan perubahan profil');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="modal-backdrop" onClick={props.onClose}>
        <div 
          class="profile-modal-card" 
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cover & Ambient Header */}
          <div class="profile-cover-banner">
            <div class="profile-cover-pattern" />
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px', "z-index": 2 }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                "backdrop-filter": 'blur(6px)',
                padding: '4px 10px',
                "border-radius": '20px',
                display: 'flex',
                "align-items": 'center',
                gap: '6px',
                color: '#fff',
                "font-size": '11px',
                "font-weight": 600,
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <Sparkles size={12} />
                <span>ORCA Account Hub</span>
              </div>
            </div>

            <button 
              type="button" 
              class="profile-header-close"
              aria-label="Tutup jendela edit profil"
              onClick={props.onClose} 
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          {/* Modal Main Body */}
          <div class="profile-studio-body">
            {/* Avatar & Hero Row */}
            <div class="profile-avatar-row">
              <div class="profile-avatar-large">
                <Show when={avatarUrl()} fallback={
                  <div style={{ width: '100%', height: '100%', display: 'flex', "align-items": 'center', "justify-content": 'center', "border-radius": '50%', background: 'var(--surface-container-high)' }}>
                    <User size={36} color="var(--primary)" />
                  </div>
                }>
                  <img 
                    src={avatarUrl()} 
                    alt="Foto Profil" 
                  />
                </Show>

                {/* Camera Upload Badge */}
                <label 
                  class="profile-avatar-cam-badge"
                  title="Klik untuk mengganti avatar"
                  style={{ cursor: isUploading() ? 'not-allowed' : 'pointer' }}
                >
                  <Show when={isUploading()} fallback={<Camera size={13} />}>
                    <Loader2 size={13} class="spin" />
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

              {/* Quick Actions (Upload / Remove) */}
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <label 
                  class="btn-secondary" 
                  style={{ 
                    padding: '6px 12px', 
                    "font-size": '11px', 
                    "font-weight": 600,
                    display: 'inline-flex', 
                    "align-items": 'center', 
                    gap: '5px', 
                    cursor: isUploading() ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Camera size={13} />
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
                    style={{ padding: '6px 10px', "font-size": '11px', color: '#f87171' }}
                    onClick={() => setAvatarUrl('')}
                    title="Hapus foto profil"
                  >
                    <Trash2 size={13} />
                  </button>
                </Show>
              </div>
            </div>

            {/* Hero Meta (Name & Badges) */}
            <div class="profile-hero-meta">
              <h2 id="profile-modal-title" class="profile-hero-name">
                {fullName() || 'Pengguna ORCA'}
              </h2>
              <div class="profile-hero-badges">
                <span style={{ 
                  "font-size": '11px', 
                  color: 'var(--text-dim)', 
                  display: 'flex', 
                  "align-items": 'center', 
                  gap: '4px' 
                }}>
                  <Mail size={12} />
                  {email() || 'user@orca.local'}
                </span>
                <span style={{
                  "font-size": '10px',
                  "font-weight": 600,
                  padding: '2px 8px',
                  "border-radius": '12px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--primary-dim)',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  Workspace Owner
                </span>
                <span style={{
                  "font-size": '10px',
                  "font-weight": 500,
                  padding: '2px 8px',
                  "border-radius": '12px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#4ade80',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  display: 'inline-flex',
                  "align-items": 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', "border-radius": '50%', background: '#22c55e' }} />
                  Aktif
                </span>
              </div>
            </div>

            {/* Navigation Tabs (General vs Security vs Storage) */}
            <div class="profile-nav-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                class={`profile-nav-tab ${activeTab() === 'general' ? 'active' : ''}`}
                aria-selected={activeTab() === 'general'}
                onClick={() => setActiveTab('general')}
              >
                <User size={14} />
                <span>Identitas</span>
              </button>
              <button
                type="button"
                role="tab"
                class={`profile-nav-tab ${activeTab() === 'security' ? 'active' : ''}`}
                aria-selected={activeTab() === 'security'}
                onClick={() => setActiveTab('security')}
              >
                <KeyRound size={14} />
                <span>Keamanan</span>
              </button>
              <button
                type="button"
                role="tab"
                class={`profile-nav-tab ${activeTab() === 'storage' ? 'active' : ''}`}
                aria-selected={activeTab() === 'storage'}
                onClick={() => setActiveTab('storage')}
              >
                <Cloud size={14} />
                <span>Storage</span>
              </button>
            </div>

            {/* Alert Messages */}
            <Show when={errorMsg()}>
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.12)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', 
                color: '#f87171', 
                padding: '10px 14px', 
                "border-radius": '8px', 
                "font-size": '12px', 
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
                "font-size": '12px', 
                display: 'flex', 
                "align-items": 'center', 
                gap: '8px', 
                "margin-bottom": '16px' 
              }}>
                <Check size={16} style={{ "flex-shrink": 0 }} />
                <span>{successMsg()}</span>
              </div>
            </Show>

            {/* Tab Panels */}
            <form onSubmit={handleSave}>
              {/* TAB 1: IDENTITAS UMUM */}
              <Show when={activeTab() === 'general'}>
                <div style={{ display: 'flex', "flex-direction": 'column', gap: '14px', "margin-bottom": '20px' }}>
                  <div>
                    <label for="profile-fullname-input" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                      Nama Lengkap
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="profile-fullname-input"
                        type="text" 
                        class="form-input" 
                        autocomplete="name"
                        style={{ 
                          width: '100%', 
                          "padding-left": '38px', 
                          height: '40px',
                          "border-radius": '8px',
                          background: 'var(--surface-container-low)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-main)',
                          "font-size": '13px',
                          "box-sizing": 'border-box' 
                        }} 
                        placeholder="Contoh: Nurhabib Assolihudin" 
                        value={fullName()} 
                        onInput={(e) => setFullName(e.currentTarget.value)} 
                        required 
                      />
                      <User size={15} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    </div>
                  </div>

                  <div>
                    <label for="profile-email-input" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                      Alamat Email (Akun Utama)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="profile-email-input"
                        type="email" 
                        class="form-input" 
                        autocomplete="email"
                        style={{ 
                          width: '100%', 
                          "padding-left": '38px', 
                          height: '40px',
                          "border-radius": '8px',
                          background: 'var(--surface-container-low)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-main)',
                          "font-size": '13px',
                          "box-sizing": 'border-box' 
                        }} 
                        placeholder="nama@domain.com" 
                        value={email()} 
                        onInput={(e) => setEmail(e.currentTarget.value)} 
                        required 
                      />
                      <Mail size={15} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div class="profile-info-grid">
                    <div class="profile-info-card">
                      <div style={{ display: 'flex', "align-items": 'center', gap: '6px', "margin-bottom": '4px', color: 'var(--text-dim)', "font-size": '11px' }}>
                        <ShieldCheck size={13} color="var(--primary)" />
                        <span>Hak Akses</span>
                      </div>
                      <div style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)' }}>
                        Workspace Owner
                      </div>
                      <div style={{ "font-size": '10px', color: 'var(--text-dim)', "margin-top": '2px' }}>
                        Kontrol penuh atas seluruh proyek & media
                      </div>
                    </div>

                    <div class="profile-info-card">
                      <div style={{ display: 'flex', "align-items": 'center', gap: '6px', "margin-bottom": '4px', color: 'var(--text-dim)', "font-size": '11px' }}>
                        <HardDrive size={13} color="#44e1de" />
                        <span>Penyimpanan Media</span>
                      </div>
                      <div style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)', overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>
                        {storageDriver()}
                      </div>
                      <div style={{ "font-size": '10px', color: 'var(--text-dim)', "margin-top": '2px' }}>
                        Terkonfigurasi via S3/R2/Supabase
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

              {/* TAB 2: KEAMANAN & KATA SANDI */}
              <Show when={activeTab() === 'security'}>
                <div style={{ display: 'flex', "flex-direction": 'column', gap: '14px', "margin-bottom": '20px' }}>
                  <div style={{
                    padding: '10px 14px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    "border-radius": '8px',
                    display: 'flex',
                    "align-items": 'center',
                    gap: '10px'
                  }}>
                    <Info size={16} color="var(--primary)" style={{ "flex-shrink": 0 }} />
                    <span style={{ "font-size": '11.5px', color: 'var(--text-muted)', "line-height": 1.4 }}>
                      Kosongkan bagian kata sandi jika Anda hanya ingin memperbarui identitas profil dan foto avatar.
                    </span>
                  </div>

                  <div>
                    <label for="profile-curr-pass" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                      Kata Sandi Saat Ini
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        id="profile-curr-pass"
                        type={showCurrentPass() ? 'text' : 'password'} 
                        class="form-input" 
                        autocomplete="current-password"
                        style={{ 
                          width: '100%', 
                          "padding-left": '38px', 
                          "padding-right": '40px',
                          height: '40px',
                          "border-radius": '8px',
                          background: 'var(--surface-container-low)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-main)',
                          "font-size": '13px',
                          "box-sizing": 'border-box' 
                        }} 
                        placeholder="Masukkan kata sandi saat ini" 
                        value={currentPassword()} 
                        onInput={(e) => setCurrentPassword(e.currentTarget.value)} 
                      />
                      <Lock size={15} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                      <button
                        type="button"
                        aria-label={showCurrentPass() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '8px',
                          display: 'flex',
                          "align-items": 'center',
                          "justify-content": 'center'
                        }}
                        onClick={() => setShowCurrentPass(prev => !prev)}
                      >
                        <Show when={showCurrentPass()} fallback={<Eye size={15} />}>
                          <EyeOff size={15} />
                        </Show>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', "grid-template-columns": '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '6px' }}>
                        <label for="profile-new-pass" style={{ "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)' }}>
                          Kata Sandi Baru
                        </label>
                        <Show when={newPassword()}>
                          <span style={{ "font-size": '10px', color: getPasswordStrength().color, "font-weight": 600 }}>
                            {getPasswordStrength().label}
                          </span>
                        </Show>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input 
                          id="profile-new-pass"
                          type={showNewPass() ? 'text' : 'password'} 
                          class="form-input" 
                          autocomplete="new-password"
                          style={{ 
                            width: '100%', 
                            "padding-left": '38px', 
                            "padding-right": '36px',
                            height: '40px',
                            "border-radius": '8px',
                            background: 'var(--surface-container-low)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-main)',
                            "font-size": '13px',
                            "box-sizing": 'border-box' 
                          }} 
                          placeholder="Min 6 karakter" 
                          value={newPassword()} 
                          onInput={(e) => setNewPassword(e.currentTarget.value)} 
                        />
                        <KeyRound size={15} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                        <button
                          type="button"
                          aria-label={showNewPass() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                          style={{
                            position: 'absolute',
                            right: '6px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '8px'
                          }}
                          onClick={() => setShowNewPass(prev => !prev)}
                        >
                          <Show when={showNewPass()} fallback={<Eye size={14} />}>
                            <EyeOff size={14} />
                          </Show>
                        </button>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '6px' }}>
                        <label for="profile-conf-pass" style={{ "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)' }}>
                          Konfirmasi Sandi
                        </label>
                        <Show when={confirmPassword() && confirmPassword() === newPassword()}>
                          <span style={{ "font-size": '10px', color: '#4ade80', "font-weight": 600 }}>
                            Cocok ✓
                          </span>
                        </Show>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input 
                          id="profile-conf-pass"
                          type={showConfPass() ? 'text' : 'password'} 
                          class="form-input" 
                          autocomplete="new-password"
                          style={{ 
                            width: '100%', 
                            "padding-left": '38px', 
                            "padding-right": '36px',
                            height: '40px',
                            "border-radius": '8px',
                            background: 'var(--surface-container-low)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-main)',
                            "font-size": '13px',
                            "box-sizing": 'border-box' 
                          }} 
                          placeholder="Ulangi sandi baru" 
                          value={confirmPassword()} 
                          onInput={(e) => setConfirmPassword(e.currentTarget.value)} 
                        />
                        <KeyRound size={15} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                        <button
                          type="button"
                          aria-label={showConfPass() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                          style={{
                            position: 'absolute',
                            right: '6px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '8px'
                          }}
                          onClick={() => setShowConfPass(prev => !prev)}
                        >
                          <Show when={showConfPass()} fallback={<Eye size={14} />}>
                            <EyeOff size={14} />
                          </Show>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

              {/* TAB 3: OBJECT STORAGE & INFRA */}
              <Show when={activeTab() === 'storage'}>
                <div style={{ display: 'flex', "flex-direction": 'column', gap: '14px', "margin-bottom": '20px' }}>
                  <div style={{
                    padding: '14px',
                    background: 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    "border-radius": '10px',
                    display: 'flex',
                    "flex-direction": 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                        <Cloud size={16} color="var(--primary)" />
                        <span style={{ "font-size": '13px', "font-weight": 600, color: 'var(--text-main)' }}>
                          Status S3 Object Storage
                        </span>
                      </div>
                      <span style={{
                        "font-size": '10px',
                        "font-weight": 600,
                        padding: '2px 8px',
                        "border-radius": '10px',
                        background: 'rgba(68, 225, 222, 0.1)',
                        color: '#44e1de',
                        border: '1px solid rgba(68, 225, 222, 0.25)'
                      }}>
                        Connected
                      </span>
                    </div>

                    <div style={{ "font-size": '12px', color: 'var(--text-dim)', "line-height": 1.5 }}>
                      Setiap gambar avatar dan canvas board disimpan langsung ke bucket S3 yang ditentukan di file konfigurasi <code style={{ color: '#44e1de', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', "border-radius": '3px' }}>.env</code> (Supabase Storage, Cloudflare R2, atau AWS S3).
                    </div>

                    <div style={{
                      display: 'grid',
                      "grid-template-columns": '1fr 1fr',
                      gap: '8px',
                      padding: '10px',
                      background: 'rgba(0, 0, 0, 0.25)',
                      "border-radius": '8px',
                      "font-size": '11px'
                    }}>
                      <div>
                        <span style={{ color: 'var(--text-dim)' }}>Driver Aktif:</span>
                        <div style={{ color: 'var(--text-main)', "font-weight": 600, "margin-top": '2px' }}>
                          {storageDriver()}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-dim)' }}>Tenant Scope:</span>
                        <div style={{ color: 'var(--text-main)', "font-weight": 600, "margin-top": '2px' }}>
                          UUIDv7 Isolated
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>

              {/* Modal Footer Controls */}
              <div style={{ 
                display: 'flex', 
                "align-items": 'center', 
                "justify-content": 'flex-end', 
                gap: '10px',
                "padding-top": '16px',
                "border-top": '1px solid var(--border-subtle)'
              }}>
                <button 
                  type="button" 
                  class="btn-secondary" 
                  onClick={props.onClose}
                  disabled={isSaving()}
                  style={{ height: '38px', padding: '0 16px', "font-size": '12.5px', "border-radius": '8px' }}
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  class="btn-primary" 
                  style={{ 
                    height: '38px', 
                    padding: '0 18px', 
                    "font-size": '12.5px', 
                    "border-radius": '8px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    "box-shadow": '0 4px 14px rgba(99, 102, 241, 0.35)'
                  }}
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
      </div>
    </Show>
  );
};

