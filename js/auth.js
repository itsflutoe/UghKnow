// ============================================================
// Authentication helpers (username-based via fake email)
// ============================================================

const EMAIL_DOMAIN = "@cyberuno.app";

function usernameToEmail(username) {
  return username.trim().toLowerCase() + EMAIL_DOMAIN;
}

async function register(username, password) {
  username = username.trim();
  if (username.length < 3 || username.length > 20) {
    throw new Error("Username must be 3-20 characters");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error("Username can only contain letters, numbers and underscore");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  // Check username availability
  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    throw new Error("Username already taken");
  }

  const email = usernameToEmail(username);

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) throw error;

  // Profile is auto-created by trigger
  return data;
}

async function login(username, password) {
  username = username.trim().toLowerCase();
  const email = usernameToEmail(username);

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

async function updateUsername(newUsername) {
  newUsername = newUsername.trim();
  if (newUsername.length < 3 || newUsername.length > 20) {
    throw new Error("Username must be 3-20 characters");
  }

  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await sb
    .from('profiles')
    .update({ username: newUsername, display_name: newUsername, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;

  // Also update auth metadata (best effort)
  await sb.auth.updateUser({
    data: { username: newUsername }
  });

  return true;
}
