// POST { session_id, client_token, consent_given?, demographics? }
// Marks a participant session completed. Also accepts the consent flag and
// demographics payload here (rather than a separate call) since they're
// both only ever written once, at the end of a successful run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { session_id, client_token, consent_given, demographics } = await req.json();
    if (!session_id || !client_token) return jsonResponse({ error: "missing_fields" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session, error: sessionError } = await supabase
      .from("participant_sessions")
      .select("id, status, client_token")
      .eq("id", session_id)
      .maybeSingle();

    if (sessionError) return jsonResponse({ error: "lookup_failed", detail: sessionError.message }, 500);
    if (!session || session.client_token !== client_token) return jsonResponse({ error: "invalid_session" }, 403);
    if (session.status === "completed") return jsonResponse({ ok: true, already_completed: true });

    const update: Record<string, unknown> = { status: "completed", completed_at: new Date().toISOString() };
    if (consent_given !== undefined) { update.consent_given = consent_given; update.consent_at = new Date().toISOString(); }
    if (demographics !== undefined) update.demographics = demographics;

    const { error: updateError } = await supabase.from("participant_sessions").update(update).eq("id", session_id);
    if (updateError) return jsonResponse({ error: "update_failed", detail: updateError.message }, 500);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: "unexpected", detail: String(err) }, 500);
  }
});
