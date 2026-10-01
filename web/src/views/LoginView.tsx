import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { 
  LogIn, 
  UserPlus, 
  Lock, 
  Mail, 
  User, 
  ShieldCheck, 
  Loader2, 
  AlertCircle,
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  LayoutGrid,
  FileText,
  Calendar,
  CheckSquare
} from 'lucide-solid';
import { api } from '../services/api';
import type { UserProfile } from '../services/user';
import { setCurrentUser } from '../services/user';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginView: Component<LoginViewProps> = (props) => {
  const [tab, setTab] = createSignal<'login' | 'register'>('login');
  const [email, setEmail] = createSignal('user@orca.local');
  const [password, setPassword] = createSignal('orca12345');
  const [fullName, setFullName] = createSignal('Nurhabib Assolihudin');
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

  const handleFillDemo = async () => {
    setTab('login');
    setEmail('user@orca.local');
    setPassword('orca12345');
    setErrorMsg(null);

    // Auto submit demo credentials for instant frictionless entry
    setLoading(true);
    try {
      const res = await api.login('user@orca.local', 'orca12345');
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
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal login demo. Pastikan database backend sudah berjalan.');
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
            width: '48px',
            height: '48px',
            "border-radius": '14px',
            background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
            color: '#fff',
            "margin-bottom": '12px',
            "box-shadow": '0 8px 24px rgba(99, 102, 241, 0.45)',
            position: 'relative'
          }}>
            <Layers size={26} />
            <span style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              width: '10px',
              height: '10px',
              "border-radius": '50%',
              background: '#44e1de',
              border: '2px solid #1a1c22'
            }} />
          </div>

          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'center', gap: '8px', "margin-bottom": '6px' }}>
            <h1 style={{ 
              margin: 0, 
              "font-size": '24px', 
              "font-weight": 700, 
              "letter-spacing": '-0.03em',
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
              "-webkit-background-clip": 'text',
              "-webkit-text-fill-color": 'transparent'
            }}>
              ORCA
            </h1>
            <span style={{
              "font-size": '10px',
              "font-weight": 600,
              padding: '2px 7px',
              "border-radius": '20px',
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              "letter-spacing": '0.04em',
              "text-transform": 'uppercase'
            }}>
              v0.1
            </span>
          </div>

          <p style={{ margin: '0 0 14px 0', "font-size": '13px', color: 'var(--text-dim)', "line-height": 1.4 }}>
            Personal & Business Operating System
          </p>

          {/* Micro Feature Highlights */}
          <div style={{
            display: 'flex',
            "flex-wrap": 'wrap',
            "justify-content": 'center',
            gap: '6px'
          }}>
            <div style={{ display: 'inline-flex', "align-items": 'center', gap: '4px', "font-size": '11px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', "border-radius": '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <LayoutGrid size={11} color="var(--primary)" />
              <span>Canvas</span>
            </div>
            <div style={{ display: 'inline-flex', "align-items": 'center', gap: '4px', "font-size": '11px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', "border-radius": '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <FileText size={11} color="#44e1de" />
              <span>Docs</span>
            </div>
            <div style={{ display: 'inline-flex', "align-items": 'center', gap: '4px', "font-size": '11px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', "border-radius": '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <CheckSquare size={11} color="#f59e0b" />
              <span>Tasks</span>
            </div>
            <div style={{ display: 'inline-flex', "align-items": 'center', gap: '4px', "font-size": '11px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.03)', padding: '3px 8px', "border-radius": '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Calendar size={11} color="#ec4899" />
              <span>Schedule</span>
            </div>
          </div>
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

        {/* Quick Demo Access Box */}
        <div style={{
          "margin-top": '22px',
          padding: '14px',
          background: 'rgba(12, 14, 18, 0.6)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          "border-radius": '11px',
          display: 'flex',
          "flex-direction": 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
              <Sparkles size={14} color="#818cf8" />
              <span style={{ "font-size": '12px', "font-weight": 600, color: 'var(--text-main)' }}>
                Akun Demo Pengembang
              </span>
            </div>
            <span style={{ "font-size": '10px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', "border-radius": '4px' }}>
              Offline / Dev Ready
            </span>
          </div>

          <div style={{ "font-size": '11px', color: 'var(--text-dim)', "line-height": 1.4 }}>
            Gunakan kredensial bawaan: <code style={{ color: '#44e1de', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', "border-radius": '3px' }}>user@orca.local</code> • <code style={{ color: '#cebdff', background: 'rgba(0,0,0,0.3)', padding: '1px 5px', "border-radius": '3px' }}>orca12345</code>
          </div>

          <button
            type="button"
            class="btn-secondary"
            style={{
              width: '100%',
              padding: '8px 12px',
              "font-size": '12px',
              "font-weight": 500,
              display: 'flex',
              "align-items": 'center',
              "justify-content": 'center',
              gap: '6px',
              "border-radius": '7px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onClick={handleFillDemo}
            disabled={loading()}
          >
            <Sparkles size={13} color="var(--primary)" />
            <span>Isi Otomatis & Masuk Instan</span>
          </button>
        </div>

        {/* Security & Self-Hosted Footer Badge */}
        <div style={{
          "margin-top": '18px',
          "text-align": 'center',
          display: 'flex',
          "align-items": 'center',
          "justify-content": 'center',
          gap: '5px',
          "font-size": '11px',
          color: 'var(--text-dim)'
        }}>
          <ShieldCheck size={13} color="#4ade80" />
          <span>Self-Hosted Privacy • Secured by JWT & Bcrypt</span>
        </div>
      </div>
    </div>
  );
};
