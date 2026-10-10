import { useState, useEffect } from "./preact.js";
import { requireSupabase } from "./supabaseClient.js";

function mapPost(row, author) {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: author?.full_name ?? null,
    authorUsername: author?.username ?? null,
    authorAvatarUrl: author?.avatar_url ?? null,
    authorRoleTitle: author?.role_title ?? null,
    authorBio: author?.bio ?? null,
    body: row.body,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** profiles' own RLS only lets a user read their own row, so a platform-wide
 * feed can't resolve other authors' names/avatars through it -- every post
 * not authored by the viewer would otherwise show as "unknown". Looked up
 * through profiles_public (migrations 0011 + 0013), a narrow view exposing
 * just the identity-adjacent columns for every user -- scoped to signed-in
 * platform members only (granted to `authenticated`, never `anon`), as a
 * separate query rather than a PostgREST embed (embedding resolves through
 * posts.author_id's real FK, which points at profiles, not at this view). */
async function fetchAuthorsById(authorIds) {
  if (!authorIds.length) return {};
  const sb = requireSupabase();
  const { data, error } = await sb.from("profiles_public").select("id, full_name, username, avatar_url, role_title, bio").in("id", authorIds);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((a) => [a.id, a]));
}

async function fetchPosts() {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = data ?? [];
  const authorsById = await fetchAuthorsById([...new Set(rows.map((r) => r.author_id))]);
  return rows.map((row) => mapPost(row, authorsById[row.author_id]));
}

/** author_id is never sent -- the column defaults to auth.uid() server-side
 * (see migration 0009), the same pattern organizations/experiments use.
 * imageUrl is optional; pass the URL uploadPostImage() returns, if any.
 * Doesn't bother resolving the author for its return value -- nothing reads
 * it; invalidatePosts() below triggers the real list refresh. */
export async function createPost(body, imageUrl = null) {
  const sb = requireSupabase();
  const { error } = await sb.from("posts").insert({ body, image_url: imageUrl });
  if (error) throw error;
  invalidatePosts();
}

/** RLS (0009 + 0012) allows this for the post's own author OR a profile
 * with is_admin = true -- enforced server-side either way, so a stray
 * delete button the UI shouldn't have shown still can't delete someone
 * else's post for a non-admin. */
export async function deletePost(id) {
  const sb = requireSupabase();
  const { error } = await sb.from("posts").delete().eq("id", id);
  if (error) throw error;
  invalidatePosts();
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
