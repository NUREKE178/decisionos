// POST { slug: string }
// Public, unauthenticated endpoint (the participant has no account). Looks
// up a PUBLISHED experiment by its public slug, computes server-side
// counterbalanced variant/question order for this new participant, and
// creates their session row. The service role key (set as this function's
// SUPABASE_SERVICE_ROLE_KEY env var by the Supabase platform automatically)
// is what lets this bypass RLS -- the anon key never could, by design (see
// supabase/migrations/0003_public_access.sql).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, handleOptions } from "../_shared/cors.ts";
import { counterbalancedOrder } from "../_shared/randomization.ts";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { slug } = await req.json();
    if (!slug || typeof slug !== "string") return jsonResponse({ error: "missing_slug" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: experiment, error: expError } = await supabase
      .from("experiments")
      .select("id, name, description, category, language, research_type, status, settings, participant_settings")
      .eq("public_slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (expError) return jsonResponse({ error: "lookup_failed", detail: expError.message }, 500);
    if (!experiment) return jsonResponse({ error: "not_found_or_not_published" }, 404);

    const [{ data: variants, error: vErr }, { data: questions, error: qErr }] = await Promise.all([
      supabase
        .from("experiment_variants")
        .select("id, label, name, description, asset_url, asset_type, color, position")
        .eq("experiment_id", experiment.id)
        .order("position"),
      supabase
        .from("experiment_questions")
        .select("id, type, applies_to, role, prompt, scale, required, position, experiment_question_options(id, label, position)")
        .eq("experiment_id", experiment.id)
        .order("position"),
    ]);
    if (vErr) return jsonResponse({ error: "variants_lookup_failed", detail: vErr.message }, 500);
    if (qErr) return jsonResponse({ error: "questions_lookup_failed", detail: qErr.message }, 500);

    const { count: participantIndex } = await supabase
      .from("participant_sessions")
      .select("id", { count: "exact", head: true })
      .eq("experiment_id", experiment.id);

    const settings = experiment.settings ?? {};
    const variantIds = (variants ?? []).map((v) => v.id);
    const questionIds = (questions ?? []).map((q) => q.id);

    const variantOrder = settings.randomizeVariantOrder
      ? counterbalancedOrder(variantIds, participantIndex ?? 0)
      : variantIds;
    const questionOrder = settings.randomizeQuestionOrder
      ? counterbalancedOrder(questionIds, participantIndex ?? 0)
      : questionIds;

    const { data: session, error: sessionError } = await supabase
      .from("participant_sessions")
      .insert({
        experiment_id: experiment.id,
        variant_order: variantOrder,
        question_order: questionOrder,
        status: "in_progress",
      })
      .select("id, client_token")
      .single();

    if (sessionError) return jsonResponse({ error: "session_create_failed", detail: sessionError.message }, 500);

    return jsonResponse({
      session_id: session.id,
      client_token: session.client_token,
      experiment: {
        id: experiment.id,
        name: experiment.name,
        description: experiment.description,
        category: experiment.category,
        language: experiment.language,
        research_type: experiment.research_type,
        settings: experiment.settings,
        participant_settings: experiment.participant_settings,
      },
      variants,
      questions,
      variant_order: variantOrder,
      question_order: questionOrder,
    });
  } catch (err) {
    return jsonResponse({ error: "unexpected", detail: String(err) }, 500);
  }
});
