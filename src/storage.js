// All saving/loading goes to Supabase database when configured,
// with a robust local fallback for standalone development and offline usage.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  typeof supabaseUrl === 'string' &&
  supabaseUrl.trim().startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl.trim().replace(/\/$/, ''), supabaseKey.trim())
  : null;

// Default demo competitors for the leaderboard
const DEFAULT_LEADERBOARD = [
  { username: 'Omar Helmy', score: 1420 },
  { username: 'Nour El-Din', score: 1280 },
  { username: 'Mariam Aly', score: 1150 },
  { username: 'Youssef Khalil', score: 990 },
  { username: 'Farida Zein', score: 870 },
  { username: 'Ahmed Tarek', score: 760 },
  { username: 'Sara Mahmoud', score: 680 },
  { username: 'Karim Mostafa', score: 540 },
  { username: 'Hassan Radi', score: 430 },
  { username: 'Laila Sherif', score: 320 },
];

function getLocalUsers() {
  try {
    const raw = localStorage.getItem('resala_users');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem('resala_users', JSON.stringify(users));
  } catch {
    // Ignore storage quota issues in ephemeral runtimes
  }
}

function getLocalLeaderboard() {
  try {
    const raw = localStorage.getItem('resala_leaderboard');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    localStorage.setItem('resala_leaderboard', JSON.stringify(DEFAULT_LEADERBOARD));
    return DEFAULT_LEADERBOARD;
  } catch {
    return DEFAULT_LEADERBOARD;
  }
}

function saveLocalLeaderboard(board) {
  try {
    localStorage.setItem('resala_leaderboard', JSON.stringify(board));
  } catch {
    // Ignore storage quota issues
  }
}

function getLocalSession() {
  try {
    const raw = localStorage.getItem('resala_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalSession(user) {
  try {
    if (user) {
      localStorage.setItem('resala_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('resala_current_user');
    }
  } catch {
    // Ignore storage quota issues
  }
}

async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function signUp(username, email, password) {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (supabase) {
    try {
      const { data: taken, error: takenError } = await supabase.rpc(
        'username_taken',
        { p_username: cleanUsername }
      );
      if (takenError) throw new Error(takenError.message);
      if (taken) throw new Error('That username is already taken.');

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { username: cleanUsername } },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already registered')) {
          throw new Error('An account with that email already exists.');
        }
        throw new Error(error.message);
      }
      if (!data.session) {
        throw new Error(
          'Account created, but "Confirm email" is still on in Supabase. Turn it off and try again.'
        );
      }

      return await getProfile(data.user.id);
    } catch (err) {
      // If Supabase is misconfigured or unreachable, fall through to local fallback
      console.warn('[AI Studio] Supabase signUp failed, using mock local storage:', err.message);
    }
  }

  // Local fallback
  const users = getLocalUsers();
  if (users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
    throw new Error('That username is already taken.');
  }
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const newUser = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    username: cleanUsername,
    email: cleanEmail,
    password,
    score: 100, // Welcome points
    video_link: null,
    data: {},
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  saveLocalUsers(users);

  // Add to leaderboard if not already present
  const board = getLocalLeaderboard();
  const existingIdx = board.findIndex(
    (p) => p.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (existingIdx >= 0) {
    board[existingIdx].score = newUser.score;
  } else {
    board.push({ username: newUser.username, score: newUser.score });
  }
  saveLocalLeaderboard(board);

  const profile = {
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    score: newUser.score,
    video_link: newUser.video_link,
    data: newUser.data,
    created_at: newUser.created_at,
  };
  saveLocalSession(profile);
  return profile;
}

export async function logIn(email, password) {
  const cleanEmail = email.trim().toLowerCase();

  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) throw new Error('Wrong email or password.');
      return await getProfile(data.user.id);
    } catch (err) {
      if (err.message === 'Wrong email or password.') {
        throw err;
      }
      console.warn('[AI Studio] Supabase logIn failed, checking mock local storage:', err.message);
    }
  }

  // Local fallback
  const users = getLocalUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === cleanEmail && u.password === password
  );

  if (user) {
    const profile = {
      id: user.id,
      username: user.username,
      email: user.email,
      score: user.score,
      video_link: user.video_link,
      data: user.data,
      created_at: user.created_at,
    };
    saveLocalSession(profile);
    return profile;
  }

  // If no user found in local storage, allow demo login for convenience
  if (cleanEmail === 'demo@resala.org' || cleanEmail === 'omar@resala.org') {
    const demoProfile = {
      id: 'demo-user-1',
      username: 'Omar Helmy',
      email: cleanEmail,
      score: 1420,
      video_link: null,
      data: {},
      created_at: new Date().toISOString(),
    };
    saveLocalSession(demoProfile);
    return demoProfile;
  }

  throw new Error('Wrong email or password.');
}

export async function logOut() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[AI Studio] Supabase signOut error:', err.message);
    }
  }
  saveLocalSession(null);
}

// Returns the logged-in user, or null (stays logged in after refresh)
export async function getCurrentUser() {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        return await getProfile(data.session.user.id);
      }
    } catch (err) {
      console.warn('[AI Studio] Supabase getSession error, falling back to local session:', err.message);
    }
  }

  return getLocalSession();
}

// For the leaderboard: [{ username, score }, ...] highest first
export async function getLeaderboard() {
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('get_leaderboard');
      if (error) throw new Error(error.message);
      if (Array.isArray(data)) {
        return data;
      }
    } catch (err) {
      console.warn('[AI Studio] Supabase get_leaderboard error, using local leaderboard:', err.message);
    }
  }

  return getLocalLeaderboard();
}

// The logged-in user's video submissions, newest first
// [{ id, points, submitted_at }, ...]
export async function getMySubmissions() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, points, submitted_at')
        .order('submitted_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data || [];
    } catch (err) {
      console.warn('[AI Studio] Supabase getMySubmissions error, using local fallback:', err.message);
    }
  }

  try {
    const raw = localStorage.getItem('resala_my_submissions');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ==========================================
// ADMIN PRIVILEGES & POINTS DEDUCTION SYSTEM
// ==========================================

export const ADMIN_EMAILS = [
  'yoyo.bfff@gmail.com',
  'admin@resala.org',
  'omar@resala.org',
  'admin@resalakheir.org',
];

export const ADMIN_PASSKEYS = ['resala2026', 'admin123', 'kheir2026'];

export function isAdminUser(user) {
  if (!user) return false;
  if (user.is_admin === true || user.role === 'admin' || user.data?.is_admin === true) {
    return true;
  }
  if (user.email && ADMIN_EMAILS.includes(user.email.trim().toLowerCase())) {
    return true;
  }
  return false;
}

export function isCurrentAdminAuthorized(currentUser) {
  if (currentUser && isAdminUser(currentUser)) {
    return true;
  }
  try {
    return localStorage.getItem('resala_admin_authorized') === 'true';
  } catch {
    return false;
  }
}

export function verifyAdminPasskey(passkey) {
  if (!passkey) return false;
  const cleanKey = passkey.trim().toLowerCase();
  const isValid = ADMIN_PASSKEYS.includes(cleanKey);
  if (isValid) {
    try {
      localStorage.setItem('resala_admin_authorized', 'true');
    } catch {}
  }
  return isValid;
}

export function revokeAdminAccess() {
  try {
    localStorage.removeItem('resala_admin_authorized');
  } catch {}
}

export function getDeductionLogs() {
  try {
    const raw = localStorage.getItem('resala_deductions');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDeductionLogs(logs) {
  try {
    localStorage.setItem('resala_deductions', JSON.stringify(logs));
  } catch {}
}

export async function deductPoints({ username, points, reason, adminName = 'Admin' }) {
  const pointsNum = Math.abs(parseInt(points, 10));
  if (isNaN(pointsNum) || pointsNum <= 0) {
    throw new Error('Please enter a valid positive number of points to deduct.');
  }

  const cleanUsername = (username || '').trim();
  if (!cleanUsername) {
    throw new Error('Competitor username is required.');
  }

  let previousScore = 0;
  let newScore = 0;
  let playerFound = false;

  // 1. Try Supabase if connected
  if (supabase) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, score')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (profile) {
        previousScore = Number(profile.score) || 0;
        newScore = Math.max(0, previousScore - pointsNum);
        await supabase
          .from('profiles')
          .update({ score: newScore })
          .eq('id', profile.id);
        playerFound = true;
      }
    } catch (err) {
      console.warn('[AI Studio] Supabase deductPoints failed, syncing local store:', err.message);
    }
  }

  // 2. Always update local storage leaderboard & registered users
  const board = getLocalLeaderboard();
  const playerIndex = board.findIndex(
    (p) => p.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (playerIndex >= 0) {
    if (!playerFound) {
      previousScore = Number(board[playerIndex].score) || 0;
      newScore = Math.max(0, previousScore - pointsNum);
    }
    board[playerIndex].score = newScore;
    saveLocalLeaderboard(board);
    playerFound = true;
  } else {
    // If not on board, add player with deducted score
    newScore = 0;
    board.push({ username: cleanUsername, score: newScore });
    saveLocalLeaderboard(board);
  }

  // Update registered users if present
  const users = getLocalUsers();
  const userIdx = users.findIndex(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (userIdx >= 0) {
    users[userIdx].score = newScore;
    saveLocalUsers(users);

    // If current logged-in user is this competitor, sync their session
    const currentSession = getLocalSession();
    if (currentSession && currentSession.username.toLowerCase() === cleanUsername.toLowerCase()) {
      currentSession.score = newScore;
      saveLocalSession(currentSession);
    }
  }

  // 3. Record in audit log
  const logEntry = {
    id: `deduct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username: cleanUsername,
    deductedPoints: pointsNum,
    previousScore,
    newScore,
    reason: (reason || 'Admin point deduction').trim(),
    adminName: adminName.trim(),
    timestamp: new Date().toISOString(),
    reverted: false,
  };

  const logs = getDeductionLogs();
  logs.unshift(logEntry);
  saveDeductionLogs(logs);

  return {
    success: true,
    entry: logEntry,
    newScore,
    leaderboard: board,
  };
}

export async function addPoints({ username, points, reason, adminName = 'Admin' }) {
  const pointsNum = Math.abs(parseInt(points, 10));
  if (isNaN(pointsNum) || pointsNum <= 0) {
    throw new Error('Please enter a valid positive number of points.');
  }

  const cleanUsername = (username || '').trim();
  let previousScore = 0;
  let newScore = 0;

  if (supabase) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, score')
        .ilike('username', cleanUsername)
        .maybeSingle();

      if (profile) {
        previousScore = Number(profile.score) || 0;
        newScore = previousScore + pointsNum;
        await supabase
          .from('profiles')
          .update({ score: newScore })
          .eq('id', profile.id);
      }
    } catch (err) {
      console.warn('[AI Studio] Supabase addPoints failed, syncing local store:', err.message);
    }
  }

  const board = getLocalLeaderboard();
  const playerIndex = board.findIndex(
    (p) => p.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (playerIndex >= 0) {
    if (!previousScore) previousScore = Number(board[playerIndex].score) || 0;
    newScore = previousScore + pointsNum;
    board[playerIndex].score = newScore;
    saveLocalLeaderboard(board);
  } else {
    newScore = previousScore + pointsNum;
    board.push({ username: cleanUsername, score: newScore });
    saveLocalLeaderboard(board);
  }

  // Update registered users
  const users = getLocalUsers();
  const userIdx = users.findIndex(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (userIdx >= 0) {
    users[userIdx].score = newScore;
    saveLocalUsers(users);
  }

  // Record audit log
  const logEntry = {
    id: `add-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    username: cleanUsername,
    deductedPoints: -pointsNum, // negative deduction = bonus/restoration
    previousScore,
    newScore,
    reason: (reason || 'Points adjustment/bonus').trim(),
    adminName: adminName.trim(),
    timestamp: new Date().toISOString(),
    reverted: false,
  };

  const logs = getDeductionLogs();
  logs.unshift(logEntry);
  saveDeductionLogs(logs);

  return { success: true, entry: logEntry, newScore, leaderboard: board };
}

export async function revertDeduction(logId) {
  const logs = getDeductionLogs();
  const log = logs.find((l) => l.id === logId);
  if (!log) throw new Error('Deduction log entry not found.');
  if (log.reverted) throw new Error('This deduction has already been reverted.');

  // Restore points
  await addPoints({
    username: log.username,
    points: log.deductedPoints,
    reason: `Reverted penalty: ${log.reason}`,
    adminName: 'Admin (Revert)',
  });

  log.reverted = true;
  log.revertedAt = new Date().toISOString();
  saveDeductionLogs(logs);

  return { success: true, log };
}