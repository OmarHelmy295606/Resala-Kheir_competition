import { useCallback, useEffect, useRef, useState } from 'react';
import { getMySubmissions, uploadVideoSubmission } from './storage';
import logo from './assets/logo.png';

const FORM_URL = import.meta.env.VITE_GOOGLE_FORM_URL;
const USER_ID_ENTRY = import.meta.env.VITE_GOOGLE_FORM_USER_ID_ENTRY;

function formLink(username) {
  try {
    if (!FORM_URL) return '#';
    const url = new URL(FORM_URL);
    url.searchParams.set('usp', 'pp_url');
    if (USER_ID_ENTRY) {
      url.searchParams.set(USER_ID_ENTRY, username);
    }
    return url.toString();
  } catch {
    return '#';
  }
}

function formatDate(iso) {
  if (!iso) return 'Just now';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function Home({ user, onLogout }) {
  const [currentUser, setCurrentUser] = useState(user);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload states
  const [file, setFile] = useState(null);
  const [linkInput, setLinkInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const loadSubmissions = useCallback(() => {
    getMySubmissions(currentUser?.id)
      .then((data) => {
        setSubmissions(Array.isArray(data) ? data : []);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  function handleRefresh() {
    setLoading(true);
    loadSubmissions();
  }

  useEffect(() => {
    loadSubmissions();
    window.addEventListener('focus', loadSubmissions);
    return () => window.removeEventListener('focus', loadSubmissions);
  }, [loadSubmissions]);

  async function handleDirectUpload(e) {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess('');

    if (!file && !linkInput.trim()) {
      setUploadError('Please choose a video file or enter a video link.');
      return;
    }

    setUploading(true);
    try {
      const res = await uploadVideoSubmission({
        file,
        videoUrl: linkInput.trim(),
        user: currentUser,
      });

      if (res.success) {
        setUploadSuccess('🎉 Video submitted successfully! +1 point added to your score.');
        setFile(null);
        setLinkInput('');
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (res.user) {
          setCurrentUser(res.user);
        }

        // Add new submission to list immediately
        setSubmissions((prev) => [res.submission, ...prev.filter((s) => s.id !== res.submission.id)]);
      }
    } catch (err) {
      setUploadError(err.message || 'Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  const submissionPoints = submissions.reduce((sum, s) => sum + (Number(s.points) || 0), 0);
  const displayScore = currentUser?.score !== undefined ? currentUser.score : submissionPoints;
  const hasUploaded = submissions.length > 0;
  const formReady = Boolean(FORM_URL);

  return (
    <div className="home-page">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logo} alt="Resala AUC" className="topbar-logo" />
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Resala Kheir</span>
        </div>
        <div className="topbar-user">
          <a
            href="/leaderboard"
            className="link-button"
            style={{ color: '#f3dea0', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}
          >
            🏆 Leaderboard
          </a>
          <a
            href="/admin"
            className="link-button"
            style={{ color: '#fca5a5', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}
          >
            🛡️ Admin
          </a>
          <span>
            Hi, <strong>{currentUser?.username || 'Competitor'}</strong>
          </span>
          <span className="points-pill">{displayScore} pts</span>
          <button className="link-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="home-grid">
        {/* Upload Card */}
        <section className="home-card">
          <p className="eyebrow">Submit a video</p>
          <h1 className="title">Upload your video</h1>
          <p className="subtitle">
            Each video earns 1 point once it's received. Videos are stored securely in Google Drive
            and reviewed by admins.
          </p>

          {uploadSuccess && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: '#dcfce7',
                color: '#166534',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              {uploadSuccess}
            </div>
          )}

          {uploadError && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              {uploadError}
            </div>
          )}

          <form onSubmit={handleDirectUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* File input */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  marginBottom: '6px',
                }}
              >
                Choose Video File (MP4, MOV, WebM):
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: '#f8fafc',
                  fontSize: '13px',
                }}
              />
              {file && (
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#10b981', fontWeight: 600 }}>
                  ✓ Selected: {file.name} ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                </p>
              )}
            </div>

            {/* Video link alternative */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--navy)',
                  marginBottom: '6px',
                }}
              >
                Or Paste Video Link (Google Drive / YouTube):
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... or https://youtu.be/..."
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              className="primary upload-button"
              disabled={uploading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 700,
                cursor: uploading ? 'wait' : 'pointer',
              }}
            >
              {uploading ? 'Uploading to Google Drive...' : 'Upload & Submit Video (+1 pt)'}
            </button>
          </form>

          {/* Optional Google Form fallback */}
          {formReady && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--muted)' }}>
                Alternative submission method:
              </p>
              <a
                className="secondary-button"
                href={formLink(currentUser?.username)}
                target="_blank"
                rel="noreferrer"
                style={{ height: '44px', fontSize: '14px' }}
              >
                Open Google Form in new tab ↗
              </a>
            </div>
          )}

          {/* Unlocked Leaderboard Button */}
          <div style={{ marginTop: '20px' }}>
            {hasUploaded ? (
              <a className="secondary-button" href="/leaderboard">
                🏆 View Leaderboard
              </a>
            ) : (
              <>
                <a className="secondary-button" href="/leaderboard" style={{ opacity: 0.9 }}>
                  🏆 View Leaderboard
                </a>
                <p className="hint">
                  Submit your video above to earn your spot on the live podium!
                </p>
              </>
            )}
          </div>
        </section>

        {/* Submissions Card */}
        <section className="home-card">
          <div className="section-head">
            <h2 className="section-title">My submissions ({submissions.length})</h2>
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
              <li key={s.id || i} className="submission">
                <div>
                  <strong>Submission #{submissions.length - i}</strong>
                  {s.video_url && s.video_url.startsWith('http') && (
                    <a
                      href={s.video_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'block', fontSize: '12px', color: '#315efb', marginTop: '2px' }}
                    >
                      View Video ↗
                    </a>
                  )}
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