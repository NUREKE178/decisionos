import { useState, useEffect } from "./preact.js";
import { useCurrentOrg } from "./currentOrg.js";
import { fetchExperiments } from "./experiments.js";

let state = { orgId: null, experiments: [], loading: true, error: null };
const listeners = new Set();
function notify() {
  for (const l of listeners) l();
}

async function load(orgId) {
  state = { ...state, loading: true };
  notify();
  try {
    const experiments = await fetchExperiments(orgId);
    state = { orgId, experiments, loading: false, error: null };
  } catch (error) {
    state = { orgId, experiments: [], loading: false, error };
  }
  notify();
}

/** Call after any create/update/delete/publish so every page sharing this
 * cache (Shell's active-count badge, Overview, Experiments list, Results
 * picker...) picks up the change without each one re-fetching independently. */
export function invalidateExperiments() {
  if (state.orgId) load(state.orgId);
}

export function useExperiments() {
  const { org } = useCurrentOrg();
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    listener(); // re-sync in case another mounted consumer's invalidateExperiments() resolved just before this subscribed
    if (org?.id && state.orgId !== org.id) load(org.id);
    return () => listeners.delete(listener);
  }, [org?.id]);

  return {
    experiments: org && state.orgId === org.id ? state.experiments : [],
    loading: state.loading,
    error: state.error,
  };
}
