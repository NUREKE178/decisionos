// POST { experiment_id }
// Authenticated (Authorization: Bearer <user jwt>, forwarded automatically
// by supabase-js when invoked via supabase.functions.invoke). Requires the
// caller to be a member of the experiment's organization.
//
// NOT WIRED TO A REAL AI PROVIDER YET (deferred on purpose -- no AI_API_KEY
// configured). It builds the exact structured analytics context a model
// would need, records a `not_configured` ai_insights row so the UI can show
// "AI insights aren't turned on for this workspace yet" instead of either
// faking a result or silently failing, and leaves a single clearly marked
// spot to drop in the real call once a key exists. Until then it reports
// nothing fabricated: no insight text is produced at all.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "unauthenticated" }, 401);

    const { experiment_id } = await req.json();
    if (!experiment_id) return jsonResponse({ error: "missing_experiment_id" }, 400);

    // Client scoped to the CALLER's own JWT, so this read goes through the
    // normal RLS org-membership policies -- if they're not a member, this
    // (correctly) returns no row rather than us having to re-derive that
    // check by hand.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: experiment, error: expError } = await callerClient
      .from("experiments")
      .select("id, name, objective, research_type")
      .eq("id", experiment_id)
      .maybeSingle();

    if (expError) return jsonResponse({ error: "lookup_failed", detail: expError.message }, 500);
    if (!experiment) return jsonResponse({ error: "not_found_or_forbidden" }, 404);

    const aiKey = Deno.env.get("AI_API_KEY");

    // Service-role client only for the ai_insights write (needs to succeed
    // regardless of the caller's role tier being >= researcher, already
    // checked implicitly by the SELECT above returning a row).
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!aiKey) {
      const { data: row } = await adminClient
        .from("ai_insights")
        .insert({
          experiment_id,
          input_summary: { experiment: experiment.name, note: "AI_API_KEY not configured" },
          status: "not_configured",
        })
        .select()
        .single();
      return jsonResponse({
        status: "not_configured",
        message: "AI-инсайты ещё не подключены для этого проекта (нет AI_API_KEY). Настройте Edge Function secret, чтобы включить.",
        row,
      });
    }

    // --- Real call goes here once AI_API_KEY is set ---------------------
    // const analyticsContext = await buildAnalyticsContext(adminClient, experiment_id); // objective, sample size, variant stats, segment stats, limitations
    // const completion = await fetch("https://api.anthropic.com/v1/messages", {
    //   method: "POST",
    //   headers: { "x-api-key": aiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    //   body: JSON.stringify({
    //     model: "claude-sonnet-5",
    //     max_tokens: 1200,
    //     system: INSIGHTS_SYSTEM_PROMPT, // instructs: predictions not certainties, no causal claims from correlation, flag small samples, no fabricated stats
    //     messages: [{ role: "user", content: JSON.stringify(analyticsContext) }],
    //   }),
    // }).then((r) => r.json());
    // ... parse, validate against the analytics numbers, insert ai_insights with status: 'ready' ...
    // ----------------------------------------------------------------------

    return jsonResponse({ status: "not_configured", message: "AI provider key present but call not yet implemented." });
  } catch (err) {
    return jsonResponse({ error: "unexpected", detail: String(err) }, 500);
  }
});
