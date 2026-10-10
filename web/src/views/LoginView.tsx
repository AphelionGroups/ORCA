import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Lock, Mail, User, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-solid';
import { handleTabKey } from '../components/tabs';
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
    if (loading()) return;
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

  const changeTab = (value: 'login' | 'register') => { if (!loading()) { setTab(value); setErrorMsg(null); } };
  return <div class="auth-page">
    <section class="auth-card" aria-label="ORCA account">
      <div class="auth-wordmark">ORCA</div>
      <h1>{tab() === 'login' ? 'Selamat datang kembali' : 'Buat workspace Anda'}</h1>
      <p class="auth-description">Ide, rencana, dan pekerjaanmu. Dalam satu tempat.</p>
      <div class="auth-tabs segmented-control" role="tablist" aria-label="Akses akun" onKeyDown={handleTabKey}>
        <button id="login-tab" type="button" role="tab" aria-selected={tab() === 'login'} aria-controls="auth-form" tabIndex={tab() === 'login' ? 0 : -1} disabled={loading()} class={`seg-btn ${tab() === 'login' ? 'active' : ''}`} onClick={() => changeTab('login')}>Masuk</button>
        <button id="register-tab" type="button" role="tab" aria-selected={tab() === 'register'} aria-controls="auth-form" tabIndex={tab() === 'register' ? 0 : -1} disabled={loading()} class={`seg-btn ${tab() === 'register' ? 'active' : ''}`} onClick={() => changeTab('register')}>Daftar Baru</button>
      </div>
      <form id="auth-form" class="auth-form" role="tabpanel" aria-labelledby={tab() === 'login' ? 'login-tab' : 'register-tab'} onSubmit={handleSubmit} aria-busy={loading()}>
        <Show when={errorMsg()}><p class="modal-error-badge" role="alert" id="auth-error">{errorMsg()}</p></Show>
        <Show when={tab() === 'register'}>
          <div class="auth-field"><label for="reg-fullname">Nama lengkap</label><div class="auth-field-wrap"><User class="auth-field-icon" size={16} aria-hidden="true" /><input id="reg-fullname" type="text" class="form-input" autocomplete="name" placeholder="Nama Anda" value={fullName()} onInput={event => setFullName(event.currentTarget.value)} required disabled={loading()} /></div></div>
        </Show>
        <div class="auth-field"><label for="auth-email">Alamat Email</label><div class="auth-field-wrap"><Mail class="auth-field-icon" size={16} aria-hidden="true" /><input id="auth-email" type="email" class="form-input" autocomplete="email" placeholder="nama@contoh.com" value={email()} onInput={event => setEmail(event.currentTarget.value)} required disabled={loading()} /></div></div>
        <div class="auth-field"><label for="auth-password">Kata Sandi</label><div class="auth-field-wrap"><Lock class="auth-field-icon" size={16} aria-hidden="true" /><input id="auth-password" type={showPassword() ? 'text' : 'password'} class="form-input" autocomplete={tab() === 'login' ? 'current-password' : 'new-password'} placeholder="Masukkan kata sandi" value={password()} onInput={event => setPassword(event.currentTarget.value)} required disabled={loading()} /><button type="button" class="btn-ghost-icon auth-eye" aria-label={showPassword() ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} aria-pressed={showPassword()} onClick={() => setShowPassword(value => !value)}><Show when={showPassword()} fallback={<Eye size={16} />}><EyeOff size={16} /></Show></button></div>
          <Show when={tab() === 'register'}><p class="auth-description" style={{margin:'0', 'font-size':'13px'}}>Gunakan minimal 6 karakter.</p></Show>
        </div>
        <Show when={tab() === 'register'}>
          <div class="auth-field"><label for="reg-confirm-password">Konfirmasi Kata Sandi</label><div class="auth-field-wrap"><Lock class="auth-field-icon" size={16} aria-hidden="true" /><input id="reg-confirm-password" type={showConfirmPassword() ? 'text' : 'password'} class="form-input" autocomplete="new-password" value={confirmPassword()} onInput={event => setConfirmPassword(event.currentTarget.value)} required disabled={loading()} /><button type="button" class="btn-ghost-icon auth-eye" aria-label={showConfirmPassword() ? 'Sembunyikan konfirmasi kata sandi' : 'Tampilkan konfirmasi kata sandi'} aria-pressed={showConfirmPassword()} onClick={() => setShowConfirmPassword(value => !value)}><Show when={showConfirmPassword()} fallback={<Eye size={16} />}><EyeOff size={16} /></Show></button></div><Show when={confirmPassword().length > 0 && confirmPassword() === password()}><p class="auth-hint"><CheckCircle2 size={14} />Kata sandi cocok</p></Show></div>
        </Show>
        <button type="submit" class="btn-primary auth-submit" disabled={loading()}><Show when={loading()}><Loader2 size={16} aria-hidden="true" /></Show><span>{loading() ? 'Memproses...' : tab() === 'login' ? 'Masuk ke Workspace' : 'Buat Akun & Workspace'}</span></button>
      </form>
    </section>
  </div>;
};
