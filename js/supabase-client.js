// Supabase client singleton
const { createClient } = supabase;

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Helper to get current user + profile
async function getCurrentUser() {
  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { user, profile };
}

// Check auth and redirect if needed
async function requireAuth(redirectTo = 'login.html') {
  const session = await getCurrentUser();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

// Simple toast
function showToast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `cyber-toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
