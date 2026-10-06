import { useState, useEffect } from "./preact.js";
import { generateDemoDataset } from "./demoData.js";
import { uid } from "./prng.js";

const STORAGE_KEY = "decisionos_v1";

function freshState() {
  const { experiments, participants } = generateDemoDataset();
  return {
    experiments,
    participants,
    team: [
      { id: uid("mem"), name: "Demo Researcher", email: "researcher@decisionos.demo", role: "Owner" },
      { id: uid("mem"), name: "Amara Okafor", email: "amara@decisionos.demo", role: "Analyst" },
      { id: uid("mem"), name: "Lucas Ferreira", email: "lucas@decisionos.demo", role: "Editor" },
    ],
    org: { name: "Northwind Consumer Insights", plan: "Growth" },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.experiments)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail (quota, private browsing) -- the app still works
    // in-memory for the current session, it just won't persist reloads.
  }
}

let state = load() ?? freshState();
if (!load()) persist();

const listeners = new Set();
function notify() {
  for (const l of listeners) l();
}

export function getState() {
  return state;
}

export function setState(updater) {
  state = typeof updater === "function" ? updater(state) : updater;
  persist();
  notify();
}

export function resetDemoData() {
  state = freshState();
  persist();
  notify();
}

export function useStore(selector) {
  const [snapshot, setSnapshot] = useState(() => selector(state));
  useEffect(() => {
    const listener = () => setSnapshot(selector(state));
    listeners.add(listener);
    listener();
    return () => listeners.delete(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return snapshot;
}

// --- Mutations -----------------------------------------------------------

export function addExperiment(experiment) {
  setState((s) => ({ ...s, experiments: [experiment, ...s.experiments] }));
}

export function updateExperiment(id, patch) {
  setState((s) => ({
    ...s,
    experiments: s.experiments.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)),
  }));
}

export function deleteExperiment(id) {
  setState((s) => ({
    ...s,
    experiments: s.experiments.filter((e) => e.id !== id),
    participants: s.participants.filter((p) => p.experimentId !== id),
  }));
}

export function addParticipant(participant) {
  setState((s) => ({ ...s, participants: [...s.participants, participant] }));
}

export function experimentById(id) {
  return state.experiments.find((e) => e.id === id) ?? null;
}

export function participantsFor(experimentId) {
  return state.participants.filter((p) => p.experimentId === experimentId);
}
