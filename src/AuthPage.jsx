import { useState } from 'react';
import { signUp, logIn } from './storage';
import logo from './assets/logo.png';

const STRENGTH = [
  { label: 'Too short', color: '#e5e9f2' },
  { label: 'Weak', color: '#e05252' },
  { label: 'Okay', color: '#e5a83b' },
  { label: 'Good', color: '#4a74e0' },
  { label: 'Strong', color: '#2e9d63' },
];

function getStrength(pw) {
  if (pw.length < 6) return 0;
  let score = 1;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const ICONS = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('signup'); // 'signup' or 'login'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0); // replays the shake
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isSignup = mode === 'signup';
  const strength = getStrength(password);

  function showError(message) {
    setError(message);
    setErrorKey(k => k + 1);
  }

  function switchMode(newMode) {
    if (newMode === mode) return;
    setMode(newMode);
    setError('');
    setPassword('');
    setShowPassword(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (isSignup && username.trim().length < 3) {
      return showError('Username must be at least 3 characters.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return showError('Please enter a valid email.');
    }
    if (isSignup && password.length < 6) {
      return showError('Password must be at least 6 characters.');
    }
    if (!password) {
      return showError('Please enter your password.');
    }

    setLoading(true);
    try {
      const user = isSignup
        ? await signUp(username, email, password)
        : await logIn(email, password);
      setSuccess(true);
      setTimeout(() => onAuth(user), 1300);
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {/* ---------- Left: logo panel ---------- */}
        <aside className="brand-panel">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="orb orb-1" />
          <div className="orb orb-2" />

          <div className="logo-wrap">
            <span className="logo-ripple" />
            <span className="logo-ripple" />
            <img src={logo} alt="Resala AUC" className="logo" />
          </div>
        </aside>

        {/* ---------- Right: form ---------- */}
        <main className="form-panel">
          {success ? (
            <div className="success">
              <svg className="check" viewBox="0 0 52 52" aria-hidden="true">
                <circle className="check-circle" cx="26" cy="26" r="24" />
                <path className="check-mark" d="M15 27l7 7 15-15" />
              </svg>
              <h2 className="title">
                {isSignup ? 'Account created!' : 'Welcome back!'}
              </h2>
              <p className="subtitle">Taking you in…</p>
            </div>
          ) : (
            <>
              <p className="eyebrow">
                {isSignup ? 'New here? It takes less than a minute.' : 'Good to see you again.'}
              </p>
              <h1 className="title">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="subtitle">
                {isSignup
                  ? 'Sign up to save your progress.'
                  : 'Log in to pick up where you left off.'}
              </p>

              <div className="tabs" data-mode={mode}>
                <button
                  type="button"
                  className={isSignup ? 'tab active' : 'tab'}
                  onClick={() => switchMode('signup')}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  className={!isSignup ? 'tab active' : 'tab'}
                  onClick={() => switchMode('login')}
                >
                  Log in
                </button>
                <span className="tab-indicator" />
              </div>

              <form key={mode} onSubmit={handleSubmit} noValidate>
                {isSignup && (
                  <div className="field">
                    <Icon name="user" />
                    <input
                      id="username"
                      type="text"
                      placeholder=" "
                      autoComplete="username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                    />
                    <label htmlFor="username">Username</label>
                  </div>
                )}

                <div className="field">
                  <Icon name="mail" />
                  <input
                    id="email"
                    type="email"
                    placeholder=" "
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                  <label htmlFor="email">Email</label>
                </div>

                <div className="field has-toggle">
                  <Icon name="lock" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder=" "
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <label htmlFor="password">Password</label>
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowPassword(s => !s)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {isSignup && password && (
                  <div className="strength">
                    <div className="strength-bar">
                      <div
                        className="strength-fill"
                        style={{
                          width: `${(strength / 4) * 100}%`,
                          background: STRENGTH[strength].color,
                        }}
                      />
                    </div>
                    <span style={{ color: STRENGTH[strength].color }}>
                      {STRENGTH[strength].label}
                    </span>
                  </div>
                )}

                {error && (
                  <p key={errorKey} className="error">
                    {error}
                  </p>
                )}

                <button type="submit" className="primary" disabled={loading}>
                  {loading ? (
                    <span className="spinner" />
                  ) : isSignup ? (
                    'Create account'
                  ) : (
                    'Log in'
                  )}
                </button>
              </form>

              <p className="switch">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                >
                  {isSignup ? 'Log in' : 'Sign up'}
                </button>
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}