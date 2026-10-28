import { useEffect, useRef, useState } from 'react';
import { getMySubmissions } from './storage';
import logo from './assets/logo.png';

const FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL;
const USER_ID_ENTRY = import.meta.env.VITE_GOOGLE_FORM_USER_ID_ENTRY;

// The form link with the user's ID already filled in
function formLink(userId, embedded) {
  const url = new URL(FORM_URL);
  url.searchParams.set('usp', 'pp_url');
  url.searchParams.set(USER_ID_ENTRY, userId);
  if (embedded) url.searchParams.set('embedded', 'true');
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
  const frameLoads = useRef(0);

  async function loadSubmissions() {
    setLoading(true);
    setError('');
    try {
      setSubmissions(await getMySubmissions());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  // The iframe loads again after the form is sent, so check for the new
  // submission (the Apps Script needs a few seconds to save it)
  function handleFrameLoad() {
    frameLoads.current += 1;
    if (frameLoads.current > 1) setTimeout(loadSubmissions, 5000);
  }

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
              <iframe
                className="form-frame"
                src={formLink(user.id, true)}
                title="Video upload form"
                onLoad={handleFrameLoad}
              >
                Loading…
              </iframe>
              <p className="hint">
                Your User ID is filled in for you, so please don't change it.
                Upload not working?{' '}
                <a href={formLink(user.id, false)} target="_blank" rel="noreferrer">
                  Open the form in a new tab
                </a>
                .
              </p>
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
            <button className="link-button" onClick={loadSubmissions} disabled={loading}>
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
