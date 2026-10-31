import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentUser,
  getLeaderboard,
  isCurrentAdminAuthorized,
  verifyAdminPasskey,
  revokeAdminAccess,
  deductPoints,
  revertDeduction,
  getDeductionLogs,
  ADMIN_EMAILS,
} from './storage';
import './Admin.css';

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

const REASON_OPTIONS = [
  'Rule Violation',
  'Late Submission / Missed Deadline',
  'Incomplete Milestone Evidence',
  'Fair Play / Code of Conduct Penalty',
  'Audit Adjustment / Score Correction',
  'Other / Custom',
];

export default function Admin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [players, setPlayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState('');

  // Deduction Modal State
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [deductAmount, setDeductAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [customReasonText, setCustomReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Initial auth & data loading
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setCurrentUser(user);
          const hasAccess = isCurrentAdminAuthorized(user);
          setAuthorized(hasAccess);

          if (hasAccess) {
            const [board, pastLogs] = await Promise.all([
              getLeaderboard(),
              getDeductionLogs(),
            ]);
            setPlayers(Array.isArray(board) ? board : []);
            setLogs(pastLogs);
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [board, pastLogs] = await Promise.all([
        getLeaderboard(),
        getDeductionLogs(),
      ]);
      setPlayers(Array.isArray(board) ? board : []);
      setLogs(pastLogs);
    } catch (err) {
      console.error('Failed to refresh admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleUnlock(e) {
    e.preventDefault();
    setAuthError('');
    if (!passkeyInput.trim()) {
      setAuthError('Please enter the admin passkey.');
      return;
    }

    const success = verifyAdminPasskey(passkeyInput);
    if (success) {
      setAuthorized(true);
      refreshData();
    } else {
      setAuthError('Invalid admin passkey. Please check credentials or contact system admin.');
    }
  }

  function handleLockAdmin() {
    revokeAdminAccess();
    setAuthorized(false);
    setPasskeyInput('');
  }

  function openDeductModal(player, defaultAmt = 50) {
    setSelectedPlayer(player);
    setDeductAmount(defaultAmt);
    setCustomAmount('');
    setSelectedReason(REASON_OPTIONS[0]);
    setCustomReasonText('');
    setModalError('');
  }

  function closeDeductModal() {
    setSelectedPlayer(null);
    setModalError('');
    setSubmitting(false);
  }

  async function handleConfirmDeduction(e) {
    e.preventDefault();
    if (!selectedPlayer) return;

    const amount = customAmount ? parseInt(customAmount, 10) : deductAmount;
    if (isNaN(amount) || amount <= 0) {
      setModalError('Please specify a positive point amount.');
      return;
    }

    const finalReason = selectedReason === 'Other / Custom'
      ? (customReasonText.trim() || 'Admin penalty')
      : selectedReason;

    const adminName = currentUser?.username || currentUser?.email || 'Admin';

    setSubmitting(true);
    setModalError('');

    try {
      const result = await deductPoints({
        username: selectedPlayer.username,
        points: amount,
        reason: finalReason,
        adminName,
      });

      // Update state
      setPlayers(result.leaderboard || []);
      setLogs(getDeductionLogs());
      setToast(`Deducted ${amount} points from ${selectedPlayer.username}`);
      setTimeout(() => setToast(''), 4000);
      closeDeductModal();
    } catch (err) {
      setModalError(err.message || 'Failed to deduct points.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevert(logId) {
    if (!window.confirm('Are you sure you want to revert this deduction and refund the points?')) {
      return;
    }

    try {
      await revertDeduction(logId);
      const [board, pastLogs] = await Promise.all([
        getLeaderboard(),
        getDeductionLogs(),
      ]);
      setPlayers(board);
      setLogs(pastLogs);
      setToast('Deduction successfully reverted and points refunded.');
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to revert deduction.');
    }
  }

  // Filtered and sorted players
  const filteredPlayers = players
    .filter((p) =>
      p.username.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  const totalPoints = players.reduce(
    (sum, p) => sum + (Number(p.score) || 0),
    0
  );
  const highestScore = Number(players[0]?.score) || 0;
  const totalDeducted = logs
    .filter((l) => !l.reverted && l.deductedPoints > 0)
    .reduce((sum, l) => sum + Number(l.deductedPoints || 0), 0);

  // Effective amount for modal preview
  const currentModalAmount = customAmount ? parseInt(customAmount, 10) || 0 : deductAmount;
  const currentModalScore = Number(selectedPlayer?.score) || 0;
  const previewScore = Math.max(0, currentModalScore - currentModalAmount);

  return (
    <main className={`admin-page ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      <div className="admin-container">
        {/* Navigation Bar */}
        <nav className="admin-nav">
          <div className="admin-brand">
            <img src="/resala-logo.png" alt="Resala Kheir Logo" className="admin-logo" />
            <div className="admin-brand-text">
              <h1>Resala Kheir Competition</h1>
              <span className="admin-badge">Admin Arena</span>
            </div>
          </div>

          <div className="admin-nav-actions">
            <a
              href="https://drive.google.com/drive/folders/1suRsXzc-Q7Fr8jnIL5vdtSve4X0tcspx"
              target="_blank"
              rel="noreferrer"
              className="nav-link-btn"
              title="Open Google Drive submissions folder"
              style={{ color: '#3b82f6', fontWeight: 700 }}
            >
              📁 Google Drive Videos ↗
            </a>
            <a href="/leaderboard" className="nav-link-btn" title="Go to public leaderboard">
              🏆 View Leaderboard
            </a>
            <a href="/" className="nav-link-btn" title="Go to account portal">
              👤 User Portal
            </a>
            {authorized && (
              <button
                type="button"
                className="nav-link-btn"
                onClick={handleLockAdmin}
                title="Lock administrative controls"
              >
                🔒 Exit Admin
              </button>
            )}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Toggle dark mode"
              title="Toggle theme"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </nav>

        {/* Lock Screen if not authorized */}
        {!authorized ? (
          <section className="auth-lock-card">
            <div className="lock-icon-wrap">🛡️</div>
            <h2>Admin Authorization Required</h2>
            <p>
              This section is reserved for competition administrators to monitor the leaderboard
              and manage participant penalties.
            </p>

            {authError && <div className="auth-error-banner">{authError}</div>}

            <form onSubmit={handleUnlock} className="auth-lock-form">
              <input
                type="password"
                placeholder="Enter Admin Passkey"
                className="passkey-input"
                value={passkeyInput}
                onChange={(e) => setPasskeyInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn-unlock">
                Authorize Access →
              </button>
            </form>

            <div className="lock-hints">
              <span>Admin credentials recognized:</span>
              <br />
              <strong>{ADMIN_EMAILS.slice(0, 2).join(' • ')}</strong>
              <br />
              <small style={{ opacity: 0.8 }}>(Passkey: <code>resala2026</code>)</small>
            </div>
          </section>
        ) : (
          <>
            {/* Toast Notification */}
            {toast && (
              <div
                style={{
                  background: 'var(--admin-panel)',
                  border: '1px solid var(--admin-blue)',
                  color: 'var(--admin-text)',
                  padding: '12px 20px',
                  borderRadius: '12px',
                  boxShadow: 'var(--admin-shadow)',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontWeight: 600,
                }}
              >
                <span>⚡</span> {toast}
              </div>
            )}

            {/* Admin Header */}
            <header className="admin-header">
              <h2>Leaderboard & Points Administration</h2>
              <p>
                Logged in as <strong>{currentUser?.username || currentUser?.email || 'Authorized Administrator'}</strong>.
                You can review player rankings, enforce competition guidelines, and deduct points.
              </p>
            </header>

            {/* Quick Metrics */}
            <section className="admin-stats-grid">
              <article className="admin-stat-card">
                <div className="stat-top">
                  <span>Competitors</span>
                  <span className="stat-icon-wrap">👥</span>
                </div>
                <strong>{players.length}</strong>
                <span className="stat-hint">Active participants</span>
              </article>

              <article className="admin-stat-card">
                <div className="stat-top">
                  <span>Points Pool</span>
                  <span className="stat-icon-wrap">✦</span>
                </div>
                <strong>{totalPoints.toLocaleString()}</strong>
                <span className="stat-hint">Total points earned</span>
              </article>

              <article className="admin-stat-card">
                <div className="stat-top">
                  <span>Top Score</span>
                  <span className="stat-icon-wrap">👑</span>
                </div>
                <strong>{highestScore.toLocaleString()}</strong>
                <span className="stat-hint">{players[0]?.username || 'None'}</span>
              </article>

              <article className="admin-stat-card" style={{ borderColor: 'var(--admin-red-border)' }}>
                <div className="stat-top" style={{ color: 'var(--admin-red)' }}>
                  <span>Points Deducted</span>
                  <span className="stat-icon-wrap">⚠️</span>
                </div>
                <strong style={{ color: 'var(--admin-red)' }}>-{totalDeducted.toLocaleString()}</strong>
                <span className="stat-hint">{logs.filter((l) => !l.reverted).length} penalties active</span>
              </article>
            </section>

            {/* Search and Controls */}
            <div className="admin-controls-card">
              <div className="search-input-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Filter competitors by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="controls-right">
                <span style={{ fontSize: '13px', color: 'var(--admin-muted)' }}>
                  Showing {filteredPlayers.length} of {players.length}
                </span>
                <button
                  type="button"
                  className="admin-refresh-btn"
                  onClick={refreshData}
                  disabled={loading}
                >
                  <span className={loading ? 'refresh-spinning' : ''}>↻</span> Refresh
                </button>
              </div>
            </div>

            {/* Leaderboard Table with Deduct Controls */}
            <section className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h3>Competitor Leaderboard</h3>
                  <p>Select any competitor to deduct points or adjust their score</p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Competitor</th>
                      <th style={{ width: '140px' }}>Score</th>
                      <th style={{ width: '220px' }}>Quick Deduct</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px' }}>
                          <p style={{ margin: 0, color: 'var(--admin-muted)' }}>
                            {searchQuery ? `No competitors matching "${searchQuery}"` : 'No registered competitors yet. The board is completely clean and ready!'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((player, index) => {
                        const score = Number(player.score) || 0;
                        const rank = index + 1;
                        return (
                          <tr key={player.username}>
                            <td>
                              <strong style={{ opacity: rank <= 3 ? 1 : 0.7 }}>
                                {rank === 1 ? '🥇 #1' : rank === 2 ? '🥈 #2' : rank === 3 ? '🥉 #3' : `#${rank}`}
                              </strong>
                            </td>
                            <td>
                              <div className="user-cell">
                                <div className="user-avatar">
                                  {player.username.charAt(0).toUpperCase()}
                                </div>
                                <div className="user-info">
                                  <span className="user-name">{player.username}</span>
                                  {player.video_link && (
                                    <a
                                      href={player.video_link}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        fontSize: '11px',
                                        color: '#3b82f6',
                                        fontWeight: 600,
                                        textDecoration: 'none',
                                      }}
                                    >
                                      ▶ Watch Video ↗
                                    </a>
                                  )}
                                  {rank === 1 && (
                                    <span style={{ fontSize: '11px', color: 'var(--admin-gold)', fontWeight: 700 }}>
                                      CURRENT LEADER
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="user-score">{score.toLocaleString()}</span>
                              <span className="score-pts"> PTS</span>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="quick-deduct-pill"
                                  onClick={() => openDeductModal(player, 10)}
                                  title="Quick deduct 10 points"
                                >
                                  -10
                                </button>
                                <button
                                  type="button"
                                  className="quick-deduct-pill"
                                  onClick={() => openDeductModal(player, 50)}
                                  title="Quick deduct 50 points"
                                >
                                  -50
                                </button>
                                <button
                                  type="button"
                                  className="quick-deduct-pill"
                                  onClick={() => openDeductModal(player, 100)}
                                  title="Quick deduct 100 points"
                                >
                                  -100
                                </button>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="deduct-action-btn"
                                onClick={() => openDeductModal(player, 50)}
                              >
                                <span>⚠️</span> Deduct
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Audit Log / Past Penalties */}
            <section className="admin-card">
              <div className="admin-card-head">
                <div>
                  <h3>Penalty & Deduction History</h3>
                  <p>Audit trail of all point adjustments. Deductions can be reverted if needed.</p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Target Competitor</th>
                      <th>Deduction</th>
                      <th>Score Impact</th>
                      <th>Reason</th>
                      <th>Admin</th>
                      <th style={{ textAlign: 'right' }}>Status / Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                          <p style={{ margin: 0, color: 'var(--admin-muted)' }}>
                            No point deductions have been issued yet.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const dateFormatted = new Date(log.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={log.id} style={{ opacity: log.reverted ? 0.6 : 1 }}>
                            <td style={{ fontSize: '13px', color: 'var(--admin-muted)' }}>
                              {dateFormatted}
                            </td>
                            <td>
                              <strong>{log.username}</strong>
                            </td>
                            <td>
                              <span
                                style={{
                                  color: log.deductedPoints > 0 ? 'var(--admin-red)' : 'var(--admin-green)',
                                  fontWeight: 700,
                                }}
                              >
                                {log.deductedPoints > 0 ? `-${log.deductedPoints}` : `+${Math.abs(log.deductedPoints)}`} pts
                              </span>
                            </td>
                            <td style={{ fontSize: '13px' }}>
                              {log.previousScore} ➔ <strong>{log.newScore}</strong>
                            </td>
                            <td>{log.reason}</td>
                            <td style={{ fontSize: '13px', color: 'var(--admin-muted)' }}>
                              {log.adminName}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {log.reverted ? (
                                <span className="reverted-tag">Reverted</span>
                              ) : log.deductedPoints > 0 ? (
                                <button
                                  type="button"
                                  className="audit-revert-btn"
                                  onClick={() => handleRevert(log.id)}
                                  title="Refund points and cancel penalty"
                                >
                                  Revert ↺
                                </button>
                              ) : (
                                <span className="reverted-tag">Bonus / Refund</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Deduction Modal */}
        {selectedPlayer && (
          <div className="modal-backdrop" onClick={closeDeductModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>⚠️ Deduct Points</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={closeDeductModal}
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <div className="modal-target-box">
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
                    Target Participant
                  </span>
                  <div className="modal-target-user">{selectedPlayer.username}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--admin-muted)', textTransform: 'uppercase' }}>
                    Current Score
                  </span>
                  <div className="modal-target-score">
                    <strong>{Number(selectedPlayer.score || 0).toLocaleString()}</strong> PTS
                  </div>
                </div>
              </div>

              {modalError && (
                <div className="auth-error-banner" style={{ marginBottom: '16px' }}>
                  {modalError}
                </div>
              )}

              <form onSubmit={handleConfirmDeduction}>
                <div className="modal-form-group">
                  <label>Points to Deduct</label>
                  <div className="quick-amount-presets">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`preset-chip ${!customAmount && deductAmount === amt ? 'active' : ''}`}
                        onClick={() => {
                          setDeductAmount(amt);
                          setCustomAmount('');
                        }}
                      >
                        -{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    placeholder="Or enter custom amount..."
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    style={{ marginTop: '10px' }}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Reason / Penalty Category</label>
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                  >
                    {REASON_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedReason === 'Other / Custom' && (
                  <div className="modal-form-group">
                    <label>Specify Reason / Notes</label>
                    <textarea
                      rows={2}
                      placeholder="Explain the reason for this deduction..."
                      value={customReasonText}
                      onChange={(e) => setCustomReasonText(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="score-impact-preview">
                  <span>New Projected Score:</span>
                  <span>
                    {currentModalScore} ➔ <strong>{previewScore} PTS</strong> (-{currentModalAmount} PTS)
                  </span>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeDeductModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-danger"
                    disabled={submitting || currentModalAmount <= 0}
                  >
                    {submitting ? 'Deducting...' : `Confirm -${currentModalAmount} Points`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
