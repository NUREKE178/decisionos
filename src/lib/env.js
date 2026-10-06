// Supabase project config. The anon key is safe to ship to the browser by
// design (Supabase's entire security model is "anon key + RLS"); it is NOT
// a secret. The service role key and any AI provider key must NEVER appear
// here or anywhere in frontend code -- they live only as Supabase Edge
// Function secrets (see supabase/functions/*).
//
// These two values get filled in once a Supabase project exists -- see
// README.md "Setup" for exactly where to get them (Project Settings > API).
export const SUPABASE_URL = "__SUPABASE_URL__";
export const SUPABASE_ANON_KEY = "__SUPABASE_ANON_KEY__";

export const IS_CONFIGURED = !SUPABASE_URL.startsWith("__") && !SUPABASE_ANON_KEY.startsWith("__");
