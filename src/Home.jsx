import { useEffect, useState } from 'react';
import { getMySubmissions } from './storage';
import logo from './assets/logo.png';

const FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL;
const USER_ID_ENTRY = import.meta.env.VITE_GOOGLE_FORM_USER_ID_ENTRY;

// The form link with the user's ID already filled in
function formLink(userId) {
  const url = new URL(FORM_URL);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(USER_ID_ENTRY, userId);
  return url.toString();
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// `user` has: id, username, email, score, data
export default function Home({ user, onLogout }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadSubmissions() {
    getMySubmissions()
      .then(data => {
        setSubmissions(data);
        setError('');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  function handleRefresh() {
    setLoading(true);
    loadSubmissions();
  }

  // Load now, and again whenever the user comes back from the form's tab
  useEffect(() => {
    loadSubmissions();
    window.addEventListener('focus', loadSubmissions);
    return () => window.removeEventListener('focus', loadSubmissions);
  }, []);

  const points = submissions.reduce((sum, s) => sum + s.points, 0);
  const formReady = FORM_URL && USER_ID_ENTRY;

  return (
    <div className="home-page">
      <header className="topbar">
        <img src={logo} alt="Resala AUC" className="topbar-logo" />
        <div className="topbar-user">
          <span>
            Hi, <strong>{user.username}</strong>
          </span>
          <span className="points-pill">{points} pts</span>
          <button className="link-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="home-grid">
        <section className="home-card">
          <p className="eyebrow">Submit a video</p>
          <h1 className="title">Upload your video</h1>
          <p className="subtitle">
            Each video earns 1 point once it's received. Admins review every
            video and may remove the point if it doesn't follow the rules.
          </p>

          {formReady ? (
            <>
              <ol className="upload-steps">
                <li>Click the button below. The upload form opens in a new tab.</li>
                <li>Sign in to Google if it asks you to.</li>
                <li>
                  Your User ID is already filled in. Please don't change it.
                </li>
                <li>Choose your video and submit.</li>
                <li>Come back to this tab. Your video appears under My submissions.</li>
              </ol>
              <a
                className="primary upload-button"
                href={formLink(user.id)}
                target="_blank"
                rel="noreferrer"
              >
                Upload a video
              </a>
            </>
          ) : (
            <p className="error">
              The upload form isn't set up yet. Add VITE_GOOGLE_FORM_URL and
              VITE_GOOGLE_FORM_USER_ID_ENTRY to .env.local.
            </p>
          )}
        </section>

        <section className="home-card">
          <div className="section-head">
            <h2 className="section-title">My submissions</h2>
            <button className="link-button" onClick={handleRefresh} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          {!loading && !error && submissions.length === 0 && (
            <p className="hint">No videos yet. Your uploads will show up here.</p>
          )}

          <ul className="submission-list">
            {submissions.map((s, i) => (
              <li key={s.id} className="submission">
                <div>
                  <strong>Video {submissions.length - i}</strong>
                  <span className="submission-date">{formatDate(s.submitted_at)}</span>
                </div>
                {s.points > 0 ? (
                  <span className="badge counted">+1 point</span>
                ) : (
                  <span className="badge removed">Point removed</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
