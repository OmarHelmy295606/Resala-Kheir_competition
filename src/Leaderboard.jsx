
import { useCallback, useEffect, useState } from 'react';
import { getLeaderboard, logOut } from './storage';
import './Leaderboard.css';

const CHALLENGES = [
  'Your next point could change your ranking.',
  'Consistency creates champions. Keep going.',
  'Every contribution brings Resala Kheir forward.',
  'The crown is earned, one point at a time.',
];

export default function Leaderboard() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getLeaderboard();
      setPlayers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getLeaderboard()
      .then((data) => {
        if (isMounted) {
          setPlayers(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Could not load the leaderboard.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function returnToLogin(e) {
    e.preventDefault();
    try {
      await logOut();
    } finally {
      window.location.href = '/';
    }
  }

  const ranked = [...players].sort(
    (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
  );

  const totalPoints = ranked.reduce(
    (sum, player) => sum + (Number(player.score) || 0), 0
  );
  const highestScore = Number(ranked[0]?.score) || 0;
  const topTenThreshold = ranked.length >= 10
    ? Number(ranked[9]?.score) || 0
    : null;

  const podium = [
    { player: ranked[1], rank: 2, medal: '🥈', tier: 'silver' },
    { player: ranked[0], rank: 1, medal: '👑', tier: 'gold' },
    { player: ranked[2], rank: 3, medal: '🥉', tier: 'bronze' },
  ];

  const [challengeIndex, setChallengeIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setChallengeIndex((index) => (index + 1) % CHALLENGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className={`leaderboard-page ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      <div className="dashboard-glow dashboard-glow-one" />
      <div className="dashboard-glow dashboard-glow-two" />

      <section className="leaderboard-container">
        <nav className="dashboard-nav">
          <div className="brand-lockup">
            <img src="/resala-logo.png" alt="Resala Kheir logo" className="brand-logo" />
            <div>
              <strong>RESALA KHEIR COMPETITION</strong>
              <span>COMPETITION ARENA</span>
            </div>
          </div>

          <div className="nav-actions">
            <a className="back-to-login" href="/">
              Go to submissions page
            </a>
            <a className="back-to-login" href="/" onClick={returnToLogin}>
              ← Return to log in page
            </a>
            <a
              href="/admin"
              className="season-pill"
              style={{ textDecoration: 'none', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
              title="Administrator access to manage points and view rankings"
            >
              🛡️ Admin
            </a>
            <span className="season-pill">
              <span className="season-dot" /> COMPETITION LIVE
            </span>
            <button
              className="theme-toggle"
              onClick={() => setDarkMode((value) => !value)}
              type="button"
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </nav>

        <header className="leaderboard-header">
          <p className="leaderboard-eyebrow">THE RACE TO MAKE A DIFFERENCE</p>
          <h1>
            Rise to the <span>Top.</span>
          </h1>
          <p className="leaderboard-subtitle">
            Every point tells a story. Every effort moves us forward.
          </p>
        </header>

        <section className="stats-grid">
          <article className="stat-card stat-blue">
            <div className="stat-icon">⚡</div>
            <span className="stat-label">COMPETITORS</span>
            <strong>{ranked.length.toLocaleString()}</strong>
            <span className="stat-foot">Players on the board</span>
          </article>

          <article className="stat-card stat-violet">
            <div className="stat-icon">✦</div>
            <span className="stat-label">POINTS POOL</span>
            <strong>{totalPoints.toLocaleString()}</strong>
            <span className="stat-foot">Points earned together</span>
          </article>

          <article className="stat-card stat-gold">
            <div className="stat-icon">♛</div>
            <span className="stat-label">HIGH SCORE</span>
            <strong>{highestScore.toLocaleString()}</strong>
            <span className="stat-foot">
              {ranked[0]?.username || 'Your name could be here'}
            </span>
          </article>
        </section>

        <section className="challenger-zone">
          <div className="challenger-icon">🎯</div>
          <div className="challenger-copy">
            <span>CHALLENGER ZONE</span>
            <h2>
              {ranked.length >= 10
                ? `The Top 10 target is ${topTenThreshold.toLocaleString()} points`
                : 'Your place in the Top 10 is waiting'}
            </h2>
            <p>
              {ranked.length >= 10
                ? 'Beat the benchmark and fight your way into the elite.'
                : `${10 - ranked.length} more ${10 - ranked.length === 1 ? 'spot is' : 'spots are'} available in the first Top 10.`}
            </p>
          </div>
          <div className="challenger-arrow" aria-hidden="true">↗</div>
        </section>

        <div className="challenge-ticker" aria-live="polite">
          <span className="ticker-star">✦</span>
          <span className="ticker-label">THE MINDSET</span>
          <span key={challengeIndex} className="ticker-message">
            {CHALLENGES[challengeIndex]}
          </span>
        </div>

        {error ? (
          <section className="leaderboard-empty">
            <div className="empty-icon">⚠️</div>
            <h2>Rankings couldn't load</h2>
            <p>{error}</p>
            <button className="leaderboard-refresh" onClick={() => loadLeaderboard(true)} type="button">
              Try again ↻
            </button>
          </section>
        ) : (
          <>
            <section className="podium-section">
              <div className="competition-section-heading">
                <div>
                  <span className="section-overline">THE ELITE</span>
                  <h2>Hall of Champions</h2>
                </div>
                <span className="live-indicator"><span /> LIVE BOARD</span>
              </div>

              <div className="competition-podium">
                {podium.map(({ player, rank, medal, tier }) => (
                  <article
                    key={rank}
                    className={`podium-card podium-${tier} ${!player ? 'podium-ghost' : ''}`}
                  >
                    <div className="podium-medal">
                      {player ? medal : <span className="ghost-question">?</span>}
                    </div>
                    <span className="podium-rank">
                      {rank === 1 ? 'THE CROWN' : `RANK #${rank}`}
                    </span>
                    <h3>{player?.username || 'Claim this spot'}</h3>
                    <div className="podium-score">
                      {player ? (Number(player.score) || 0).toLocaleString() : '---'}
                      <span> PTS</span>
                    </div>
                    <p className="podium-callout">
                      {player
                        ? rank === 1 ? 'THE CHAMPION' : 'IN THE TOP THREE'
                        : rank === 1 ? 'Claim the crown' : 'Your place awaits'}
                    </p>
                    <div className={`podium-platform platform-${rank}`}>
                      {rank}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="leaderboard-card">
              <div className="leaderboard-card-heading">
                <div>
                  <span className="section-overline">THE RANKINGS</span>
                  <h2>Every Point Counts</h2>
                  <p className="table-description">
                    One leaderboard. Unlimited potential.
                  </p>
                </div>
                <button
                  className="leaderboard-refresh"
                  onClick={() => loadLeaderboard(true)}
                  disabled={loading}
                  type="button"
                >
                  <span className={loading ? 'refresh-spinning' : ''}>↻</span>
                  {loading ? 'Updating' : 'Refresh'}
                </button>
              </div>

              {ranked.length === 0 && !loading ? (
                <div className="leaderboard-empty">
                  <div className="empty-icon">🏆</div>
                  <h2>Be the first to make your mark</h2>
                  <p>The leaderboard is ready. Your competition story starts here.</p>
                </div>
              ) : ranked.length === 0 ? (
                <p className="leaderboard-message">Loading competitors...</p>
              ) : (
                <div className="leaderboard-table-wrap">
                  <table className="leaderboard-table">
                    <thead>
                      <tr>
                        <th>POSITION</th>
                        <th>COMPETITOR</th>
                        <th>POINTS PROGRESS</th>
                        <th>SCORE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((player, index) => {
                        const rank = index + 1;
                        const score = Number(player.score) || 0;
                        const progress = highestScore > 0
                          ? Math.max(0, Math.min(100, score / highestScore * 100))
                          : 0;
                        const tier = rank === 1 ? 'gold' : rank <= 10 ? 'elite' : 'bronze';

                        return (
                          <tr
                            key={`${player.username}-${rank}`}
                            className={`ranking-row tier-${tier} ${rank <= 3 ? `table-top-${rank}` : ''}`}
                          >
                            <td>
                              <span className={`leaderboard-rank rank-${rank}`}>
                                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                              </span>
                            </td>
                            <td className="leaderboard-username">
                              <div className="competitor-cell">
                                <span className={`competitor-avatar avatar-${tier}`}>
                                  {String(player.username || '?').charAt(0).toUpperCase()}
                                </span>
                                <span className="competitor-name">
                                  {player.username}
                                  {rank === 1 && <span className="table-champion-tag">CHAMPION</span>}
                                  {rank > 1 && rank <= 10 && <span className="elite-tag">ELITE</span>}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="score-progress">
                                <span style={{ width: `${progress}%` }} />
                              </div>
                            </td>
                            <td className="leaderboard-score">
                              {score.toLocaleString()}
                              <span className="points-suffix"> pts</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <footer className="dashboard-footer">
                <span>✦ BUILT ON KINDNESS. DRIVEN BY COMPETITION.</span>
                <button onClick={() => loadLeaderboard(true)} type="button" className="footer-update">
                  Update rankings ↻
                </button>
              </footer>
            </section>
          </>
        )}

        <footer className="page-footer">
          RESALA KHEIR <span>•</span> EVERY POINT MAKES A DIFFERENCE
        </footer>
      </section>
    </main>
  );
}
