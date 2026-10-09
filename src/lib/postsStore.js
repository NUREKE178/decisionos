import { useState, useEffect } from "./preact.js";
import { requireSupabase } from "./supabaseClient.js";

function mapPost(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author?.full_name ?? null,
    authorUsername: row.author?.username ?? null,
    authorAvatarUrl: row.author?.avatar_url ?? null,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchPosts() {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("posts")
    .select("*, author:profiles(full_name, username, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapPost);
}

/** author_id is never sent -- the column defaults to auth.uid() server-side
 * (see migration 0009), the same pattern organizations/experiments use. */
export async function createPost(body) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("posts")
    .insert({ body })
    .select("*, author:profiles(full_name, username, avatar_url)")
    .single();
  if (error) throw error;
  invalidatePosts();
  return mapPost(data);
}

// --- Reactive cache, shared across every mounted consumer (Feed page, any
// future "latest posts" widget) -- same module-level state + listener-set
// pattern as experimentsStore.js. ---
let state = { posts: [], loading: false, error: null, loaded: false };
const listeners = new Set();
function notify() {
  for (const l of listeners) l();
}

async function load() {
  state = { ...state, loading: true };
  notify();
  try {
    const posts = await fetchPosts();
    state = { posts, loading: false, error: null, loaded: true };
  } catch (error) {
    state = { posts: [], loading: false, error, loaded: true };
  }
  notify();
}

export function invalidatePosts() {
  load();
}

export function usePosts() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    listener(); // re-sync in case a create/invalidate resolved just before this subscribed
    if (!state.loaded && !state.loading) load();
    return () => listeners.delete(listener);
  }, []);

  return { posts: state.posts, loading: state.loading, error: state.error };
}
