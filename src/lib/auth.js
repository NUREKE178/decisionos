import { useState, useEffect } from "./preact.js";
import { supabase, requireSupabase } from "./supabaseClient.js";
import { t as translate, getLocale } from "./i18n.js";
import { withTimeout } from "./async.js";

let currentSession = null;
let initialized = false;
const listeners = new Set();

function notify() {
  for (const l of listeners) l();
}

if (supabase) {
  withTimeout(supabase.auth.getSession(), 10000, "getSession timed out").then(({ data }) => {
    currentSession = data.session;
    initialized = true;
    notify();
  }).catch(() => {
    // Can't tell whether a session exists (corrupted storage, a failed
    // token-refresh request, etc.) -- fail closed to "signed out" instead of
    // leaving `initialized` false forever, which would hang every /app/* and
    // /profile route behind useSession().loading indefinitely.
    currentSession = null;
    initialized = true;
    notify();
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    initialized = true;
    notify();
  });
}

/** Reactive hook: { session, user, loading }. Re-renders on sign-in/out/refresh. */
export function useSession() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    // getSession()/onAuthStateChange's INITIAL_SESSION can resolve (it only
    // needs a few microtasks: a localStorage read, no network) before this
    // effect commits (Preact defers passive effects past a paint), i.e.
    // before any listener exists to catch notify() -- on a cold/direct load
    // with a large static import graph this race is won by auth almost
    // every time, permanently freezing this component on its first (stale
    // "still loading") render with no further notify() ever coming. Catch
    // up immediately so a change that already happened isn't silently lost.
    listener();
    return () => listeners.delete(listener);
  }, []);
  return { session: currentSession, user: currentSession?.user ?? null, loading: !initialized };
}

export function getCurrentUser() {
  return currentSession?.user ?? null;
}

export async function signUp({ email, password, fullName }) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const redirectTo = `${location.origin}${location.pathname}#/reset-password`;
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

/** Called on the /reset-password screen, after the user follows the email link (Supabase puts them in a transient "recovery" session). */
export async function updatePassword(newPassword) {
  const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
  if (error) throw error;
}

/** Starts an email change. Supabase sends a confirmation link to the new
 * address (and, depending on project settings, to the old one too) -- the
 * address in auth.users/profiles.email only actually changes once that link
 * is followed, so callers should tell the user to check their inbox rather
 * than assuming the change is immediate. */
export async function requestEmailChange(newEmail) {
  const { error } = await requireSupabase().auth.updateUser({ email: newEmail });
  if (error) throw error;
}

/** Maps Supabase auth error messages to friendly, localized copy. `t` is
 * the caller's useT()-bound translator -- stays a plain function (not a
 * hook) since it's called from inside event handlers (onSubmit), not
 * render. Falls back to the app's current locale when `t` is omitted, so
 * a call site not yet updated to pass one still works correctly. */
export function friendlyAuthError(error, t) {
  const tt = t ?? ((key) => translate(getLocale(), key));
  const msg = error?.message ?? String(error);
  if (/already registered/i.test(msg)) return tt("auth.errors.alreadyRegistered");
  if (/invalid login credentials/i.test(msg)) return tt("auth.errors.invalidCredentials");
  if (/email not confirmed/i.test(msg)) return tt("auth.errors.emailNotConfirmed");
  if (/password should be at least/i.test(msg)) return tt("auth.errors.passwordTooShort");
  if (/rate limit/i.test(msg)) return tt("auth.errors.rateLimit");
  return msg;
}
