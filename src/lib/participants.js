import { requireSupabase } from "./supabaseClient.js";
import { useState, useEffect } from "./preact.js";
import { useCurrentOrg } from "./currentOrg.js";

function mapSession(row) {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    status: row.status,
    isDemo: false,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    consentGiven: row.consent_given,
    variantOrder: row.variant_order ?? [],
    questionOrder: row.question_order ?? [],
    demographics: row.demographics ?? {},
    responses: (row.responses ?? []).map((r) => ({
      questionId: r.question_id,
      variantId: r.variant_id,
      value: r.value,
      responseTimeMs: r.response_time_ms,
      shownAt: r.created_at,
    })),
  };
}

/** All participant sessions for one experiment (with their responses), in
 * the shape lib/stats.js and lib/insights.js already expect. */
export async function fetchSessionsForExperiment(experimentId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("participant_sessions")
    .select("*, responses(*)")
    .eq("experiment_id", experimentId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapSession);
}

/** Every session across every experiment in the org, with the parent
 * experiment's name attached -- used by the Participants page. Does not
 * pull response rows (not needed for that list view). */
export async function fetchSessionsForOrg(orgId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("participant_sessions")
    .select("*, experiments!inner(id, name, organization_id)")
    .eq("experiments.organization_id", orgId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...mapSession(row), experimentName: row.experiments?.name ?? null }));
}

// --- Shared reactive cache, org-wide sessions (Overview + Participants page) ---
let orgSessionsState = { orgId: null, sessions: [], loading: true, error: null };
const orgSessionsListeners = new Set();
function notifyOrgSessions() {
  for (const l of orgSessionsListeners) l();
}

async function loadOrgSessions(orgId) {
  orgSessionsState = { ...orgSessionsState, loading: true };
  notifyOrgSessions();
  try {
    const sessions = await fetchSessionsForOrg(orgId);
    orgSessionsState = { orgId, sessions, loading: false, error: null };
  } catch (error) {
    orgSessionsState = { orgId, sessions: [], loading: false, error };
  }
  notifyOrgSessions();
}

export function invalidateOrgSessions() {
  if (orgSessionsState.orgId) loadOrgSessions(orgSessionsState.orgId);
}

export function useOrgSessions() {
  const { org } = useCurrentOrg();
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    orgSessionsListeners.add(listener);
    if (org?.id && orgSessionsState.orgId !== org.id) loadOrgSessions(org.id);
    return () => orgSessionsListeners.delete(listener);
  }, [org?.id]);
  return {
    sessions: org && orgSessionsState.orgId === org.id ? orgSessionsState.sessions : [],
    loading: orgSessionsState.loading,
    error: orgSessionsState.error,
  };
}
