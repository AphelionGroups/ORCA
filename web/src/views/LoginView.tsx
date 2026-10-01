import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { 
  LogIn, 
  UserPlus, 
  Lock, 
  Mail, 
  User, 
  Loader2, 
  AlertCircle,
  Layers,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight
} from 'lucide-solid';
import { api } from '../services/api';
import type { UserProfile } from '../services/user';
import { setCurrentUser } from '../services/user';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: Component<LoginViewProps> = (props) => {
  const [tab, setTab] = createSignal<'login' | 'register'>('login');
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [fullName, setFullName] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [showPassword, setShowPassword] = createSignal(false);
  const [showConfirmPassword, setShowConfirmPassword] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email().trim();
    const cleanPassword = password();
    const cleanName = fullName().trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Email dan kata sandi wajib diisi');
      return;
    }

    if (tab() === 'register') {
      if (!cleanName) {
        setErrorMsg('Nama lengkap wajib diisi');
        return;
      }
      if (cleanPassword.length < 6) {
        setErrorMsg('Kata sandi baru minimal 6 karakter');
        return;
      }
      if (cleanPassword !== confirmPassword()) {
        setErrorMsg('Konfirmasi kata sandi tidak cocok');
        return;
      }
    }

    setLoading(true);

    try {
      if (tab() === 'login') {
        const res = await api.login(cleanEmail, cleanPassword);
        const profile: UserProfile = {
          id: res.user.id,
          workspace_id: res.user.workspace_id,
          name: res.user.full_name,
          email: res.user.email,
          avatar_url: res.user.avatar_url,
          role: res.user.role
        };
        setCurrentUser(profile);
        props.onLoginSuccess(profile);
      } else {
        const res = await api.register(cleanEmail, cleanPassword, cleanName);
        const profile: UserProfile = {
          id: res.user.id,
          workspace_id: res.user.workspace_id,
          name: res.user.full_name,
          email: res.user.email,
          avatar_url: res.user.avatar_url,
          role: res.user.role
        };
        setCurrentUser(profile);
        props.onLoginSuccess(profile);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memproses autentikasi. Periksa kembali email dan kata sandi Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      "min-height": '100vh',
      display: 'flex',
      "align-items": 'center',
      "justify-content": 'center',
      background: 'radial-gradient(circle at 50% 10%, #171b26 0%, #0a0c10 100%)',
      color: 'var(--text-main)',
      padding: '24px 16px',
      "box-sizing": 'border-box',
      position: 'relative',
      overflow: 'hidden',
      "font-family": 'var(--font-sans)'
    }}>
      {/* Background Dot Matrix Grid */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        "background-image": 'radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
        "background-size": '28px 28px',
        "pointer-events": 'none',
        opacity: 0.8
      }} />

      {/* Atmospheric Ambient Glows */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '350px',
        background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.18) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 80%)',
        filter: 'blur(50px)',
        "pointer-events": 'none'
      }} />

      <div style={{
        position: 'absolute',
        bottom: '5%',
        right: '10%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(68, 225, 222, 0.08) 0%, transparent 70%)',
        filter: 'blur(40px)',
        "pointer-events": 'none'
      }} />

      {/* Main Container Card */}
      <div style={{
        width: '460px',
        "max-width": '100%',
        background: 'rgba(26, 28, 34, 0.85)',
        "backdrop-filter": 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        "border-radius": '18px',
        padding: '36px 32px',
        "box-shadow": '0 0 0 1px rgba(255, 255, 255, 0.03), 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 80px -20px rgba(99, 102, 241, 0.15)',
        position: 'relative',
        "z-index": 1,
        "box-sizing": 'border-box'
      }}>
        {/* Top Header & Branding */}
        <div style={{ "text-align": 'center', "margin-bottom": '26px' }}>
          <div style={{
            display: 'inline-flex',
            "align-items": 'center',
            "justify-content": 'center',
            width: '44px',
            height: '44px',
            "border-radius": '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
            color: '#fff',
            "margin-bottom": '12px',
            "box-shadow": '0 6px 20px rgba(99, 102, 241, 0.4)'
          }}>
            <Layers size={24} />
          </div>

          <h1 style={{ 
            margin: '0 0 6px 0', 
            "font-size": '22px', 
            "font-weight": 700, 
            "letter-spacing": '-0.02em',
            color: 'var(--text-main)'
          }}>
            ORCA
          </h1>

          <p style={{ margin: '0 0 20px 0', "font-size": '13px', color: 'var(--text-dim)' }}>
            Personal & Team Workspace
          </p>
        </div>

        {/* Tab Switcher */}
        <div 
          role="tablist"
          aria-label="Mode Autentikasi"
          style={{
            display: 'grid',
            "grid-template-columns": '1fr 1fr',
            background: 'rgba(12, 14, 18, 0.75)',
            padding: '4px',
            "border-radius": '10px',
            "margin-bottom": '22px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab() === 'login'}
            style={{
              padding: '9px 12px',
              "font-size": '12px',
              "font-weight": 600,
              "border-radius": '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              "align-items": 'center',
              "justify-content": 'center',
              gap: '6px',
              background: tab() === 'login' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: tab() === 'login' ? '#ffffff' : 'var(--text-dim)',
              "box-shadow": tab() === 'login' ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={() => { setTab('login'); setErrorMsg(null); }}
          >
            <LogIn size={14} color={tab() === 'login' ? 'var(--primary)' : 'currentColor'} />
            <span>Masuk Akun</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab() === 'register'}
            style={{
              padding: '9px 12px',
              "font-size": '12px',
              "font-weight": 600,
              "border-radius": '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              "align-items": 'center',
              "justify-content": 'center',
              gap: '6px',
              background: tab() === 'register' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              color: tab() === 'register' ? '#ffffff' : 'var(--text-dim)',
              "box-shadow": tab() === 'register' ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={() => { setTab('register'); setErrorMsg(null); }}
          >
            <UserPlus size={14} color={tab() === 'register' ? 'var(--primary)' : 'currentColor'} />
            <span>Daftar Baru</span>
          </button>
        </div>

        {/* Error Alert Box */}
        <Show when={errorMsg()}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#fca5a5',
            padding: '11px 14px',
            "border-radius": '10px',
            "font-size": '12px',
            display: 'flex',
            "align-items": 'flex-start',
            gap: '10px',
            "margin-bottom": '18px',
            "line-height": 1.45,
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <AlertCircle size={16} style={{ "flex-shrink": 0, "margin-top": '1px', color: '#f87171' }} />
            <span>{errorMsg()}</span>
          </div>
        </Show>

        {/* Main Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
          {/* Full Name (Register Only) */}
          <Show when={tab() === 'register'}>
            <div>
              <label for="reg-fullname" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                Nama Lengkap
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-fullname"
                  type="text"
                  class="form-input"
                  autocomplete="name"
                  style={{
                    width: '100%',
                    "padding-left": '38px',
                    "padding-right": '12px',
                    height: '42px',
                    "border-radius": '9px',
                    background: 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-main)',
                    "font-size": '13px',
                    "box-sizing": 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  placeholder="Contoh: Nurhabib Assolihudin"
                  value={fullName()}
                  onInput={(e) => setFullName(e.currentTarget.value)}
                  required
                />
                <User size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', "pointer-events": 'none' }} />
              </div>
            </div>
          </Show>

          {/* Email Address */}
          <div>
            <label for="auth-email" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
              Alamat Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-email"
                type="email"
                class="form-input"
                autocomplete="email"
                style={{
                  width: '100%',
                  "padding-left": '38px',
                  "padding-right": '12px',
                  height: '42px',
                  "border-radius": '9px',
                  background: 'var(--surface-container-low)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-main)',
                  "font-size": '13px',
                  "box-sizing": 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                placeholder="nama@domain.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <Mail size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', "pointer-events": 'none' }} />
            </div>
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', "justify-content": 'space-between', "align-items": 'center', "margin-bottom": '6px' }}>
              <label for="auth-password" style={{ "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)' }}>
                Kata Sandi
              </label>
              <Show when={tab() === 'register'}>
                <span style={{ "font-size": '11px', color: 'var(--text-dim)' }}>
                  Minimal 6 karakter
                </span>
              </Show>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-password"
                type={showPassword() ? 'text' : 'password'}
                class="form-input"
                autocomplete={tab() === 'login' ? 'current-password' : 'new-password'}
                style={{
                  width: '100%',
                  "padding-left": '38px',
                  "padding-right": '40px',
                  height: '42px',
                  "border-radius": '9px',
                  background: 'var(--surface-container-low)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-main)',
                  "font-size": '13px',
                  "box-sizing": 'border-box',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                placeholder="••••••••"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
              />
              <Lock size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', "pointer-events": 'none' }} />
              <button
                type="button"
                aria-label={showPassword() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-controls="auth-password"
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
                  "justify-content": 'center',
                  "border-radius": '6px'
                }}
                onClick={() => setShowPassword(prev => !prev)}
                title={showPassword() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <Show when={showPassword()} fallback={<Eye size={16} />}>
                  <EyeOff size={16} />
                </Show>
              </button>
            </div>
          </div>

          {/* Confirm Password (Register Only) */}
          <Show when={tab() === 'register'}>
            <div>
              <label for="reg-confirm-password" style={{ display: 'block', "font-size": '12px', "font-weight": 500, color: 'var(--text-muted)', "margin-bottom": '6px' }}>
                Konfirmasi Kata Sandi
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword() ? 'text' : 'password'}
                  class="form-input"
                  autocomplete="new-password"
                  style={{
                    width: '100%',
                    "padding-left": '38px',
                    "padding-right": '40px',
                    height: '42px',
                    "border-radius": '9px',
                    background: 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-main)',
                    "font-size": '13px',
                    "box-sizing": 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  placeholder="Ulangi kata sandi di atas"
                  value={confirmPassword()}
                  onInput={(e) => setConfirmPassword(e.currentTarget.value)}
                  required
                />
                <Lock size={16} aria-hidden="true" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', "pointer-events": 'none' }} />
                <button
                  type="button"
                  aria-label={showConfirmPassword() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  aria-controls="reg-confirm-password"
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
                    "justify-content": 'center',
                    "border-radius": '6px'
                  }}
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  title={showConfirmPassword() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  <Show when={showConfirmPassword()} fallback={<Eye size={16} />}>
                    <EyeOff size={16} />
                  </Show>
                </button>
              </div>
              <Show when={confirmPassword().length > 0 && confirmPassword() === password()}>
                <div style={{ display: 'flex', "align-items": 'center', gap: '5px', "font-size": '11px', color: '#4ade80', "margin-top": '4px' }}>
                  <CheckCircle2 size={12} />
                  <span>Kata sandi cocok</span>
                </div>
              </Show>
            </div>
          </Show>

          {/* Submit Action Button */}
          <button
            type="submit"
            class="btn-primary"
            style={{
              width: '100%',
              height: '44px',
              "font-size": '13px',
              "font-weight": 600,
              display: 'flex',
              "align-items": 'center',
              "justify-content": 'center',
              gap: '8px',
              "border-radius": '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              color: '#ffffff',
              "box-shadow": '0 4px 16px rgba(79, 70, 229, 0.4)',
              cursor: loading() ? 'not-allowed' : 'pointer',
              "margin-top": '6px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            disabled={loading()}
          >
            <Show when={loading()} fallback={
              <>
                <span>{tab() === 'login' ? 'Masuk ke Workspace' : 'Buat Akun & Inisialisasi'}</span>
                <ArrowRight size={15} />
              </>
            }>
              <Loader2 size={16} class="spin" />
              <span>Memproses autentikasi...</span>
            </Show>
          </button>
        </form>
      </div>
    </div>
  );
};
