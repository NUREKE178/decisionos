import { useState, useEffect } from "./preact.js";
import { supabase, requireSupabase } from "./supabaseClient.js";

let currentSession = null;
let initialized = false;
const listeners = new Set();

function notify() {
  for (const l of listeners) l();
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
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

/** Maps Supabase auth error messages to friendly, consistent copy. Real i18n lands in Phase 6 -- this keeps messages centralized so that swap is a one-file change. */
export function friendlyAuthError(error) {
  const msg = error?.message ?? String(error);
  if (/already registered/i.test(msg)) return "Пользователь с таким email уже зарегистрирован.";
  if (/invalid login credentials/i.test(msg)) return "Неверный email или пароль.";
  if (/email not confirmed/i.test(msg)) return "Подтвердите email по ссылке из письма перед входом.";
  if (/password should be at least/i.test(msg)) return "Пароль слишком короткий (минимум 6 символов).";
  if (/rate limit/i.test(msg)) return "Слишком много попыток. Попробуйте чуть позже.";
  return msg;
}
