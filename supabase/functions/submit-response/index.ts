// POST { session_id, client_token, question_id, variant_id?, value, response_time_ms, position }
// Public, unauthenticated. client_token is the unguessable (122-bit random
// uuid) credential handed back by start-session -- it is this request's
// only proof that the caller owns this particular session, since a
// participant never has an account. Idempotent: a retried submission for a
// question already answered returns success with duplicate:true instead of
// an error, so a flaky network never blocks a participant from finishing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { session_id, client_token, question_id, variant_id, value, response_time_ms, position } = await req.json();
    if (!session_id || !client_token || !question_id || value === undefined) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session, error: sessionError } = await supabase
      .from("participant_sessions")
      .select("id, status, client_token, experiment_id")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError) return jsonResponse({ error: "lookup_failed", detail: sessionError.message }, 500);
    if (!session || session.client_token !== client_token) return jsonResponse({ error: "invalid_session" }, 403);
    if (session.status !== "in_progress") return jsonResponse({ error: "session_closed" }, 409);

    const { error: insertError } = await supabase.from("responses").insert({
      session_id,
      question_id,
      variant_id: variant_id ?? null,
      value,
      response_time_ms: response_time_ms ?? null,
      position: position ?? 0,
    });

    if (insertError) {
      // unique_violation on (session_id, question_id) -- already answered,
      // most likely a client retry after a dropped response. Not an error.
      if (insertError.code === "23505") return jsonResponse({ ok: true, duplicate: true });
      return jsonResponse({ error: "insert_failed", detail: insertError.message }, 500);
    }

    await supabase.from("response_events").insert({
      session_id,
      event_type: "response_submitted",
      payload: { question_id, variant_id: variant_id ?? null },
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: "unexpected", detail: String(err) }, 500);
  }
});
