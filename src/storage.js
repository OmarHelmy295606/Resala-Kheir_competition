// All saving/loading now goes to the Supabase database.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function signUp(username, email, password) {
  const { data: taken, error: takenError } = await supabase.rpc(
    'username_taken',
    { p_username: username }
  );
  if (takenError) throw new Error(takenError.message);
  if (taken) throw new Error('That username is already taken.');

  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { username: username.trim() } },
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

  return getProfile(data.user.id);
}

export async function logIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new Error('Wrong email or password.');
  return getProfile(data.user.id);
}

export async function logOut() {
  await supabase.auth.signOut();
}

// Returns the logged-in user, or null (stays logged in after refresh)
export async function getCurrentUser() {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return await getProfile(data.session.user.id);
  } catch {
    return null;
  }
}

// For the leaderboard: [{ username, score }, ...] highest first
export async function getLeaderboard() {
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error) throw new Error(error.message);
  return data;
}