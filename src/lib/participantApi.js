import { requireSupabase } from "./supabaseClient.js";

// Thin wrappers around the three public Edge Functions a real (non-preview)
// participant run talks to. All three are unauthenticated by design (a
// participant has no account) -- supabase-js still attaches the anon apikey
// header automatically, which is all Supabase's Edge Function gateway
// requires. Server-side validation (published status, session token match,
// duplicate prevention) lives in the functions themselves; see
// supabase/functions/*.

async function invoke(name, body) {
  const sb = requireSupabase();
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    // supabase-js wraps a non-2xx response in a generic error; surface the
    // function's own JSON error message when present.
    const detail = error.context?.body ? await readJsonSafely(error.context) : null;
    throw new Error(detail?.message || detail?.error || error.message || "Network error");
  }
  if (data?.error) throw new Error(data.message || data.error);
  return data;
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function startSession(slug) {
  return invoke("start-session", { slug });
}

export function submitResponse({ sessionId, clientToken, questionId, variantId, value, responseTimeMs, position }) {
  return invoke("submit-response", {
    session_id: sessionId,
    client_token: clientToken,
    question_id: questionId,
    variant_id: variantId ?? null,
    value,
    response_time_ms: responseTimeMs,
    position,
  });
}

export function completeSession({ sessionId, clientToken, consentGiven, demographics }) {
  return invoke("complete-session", {
    session_id: sessionId,
    client_token: clientToken,
    consent_given: consentGiven,
    demographics,
  });
}
