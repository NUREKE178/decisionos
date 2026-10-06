import { SUPABASE_URL, SUPABASE_ANON_KEY, IS_CONFIGURED } from "./env.js";

// vendor/supabase.umd.js (loaded as a classic <script> in index.html) exposes
// a `window.supabase.createClient` global, same pattern as Chart.js.
export const supabase = IS_CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured yet. Set SUPABASE_URL / SUPABASE_ANON_KEY in src/lib/env.js (see README.md)."
    );
  }
  return supabase;
}
