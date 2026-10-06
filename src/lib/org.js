import { requireSupabase } from "./supabaseClient.js";

function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яёәіңғүұқөһ]+/giu, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "org"}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Orgs the current user belongs to, with their role in each. */
export async function fetchMyOrganizations() {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("organization_members")
    .select("role, organization:organizations(id, name, slug, created_at)")
    .order("created_at", { referencedTable: "organizations", ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row.organization, role: row.role }));
}

/** Creates a new org and seats the creator as its owner, atomically, via the
 * create_organization_with_owner() Postgres function (0004 migration) --
 * both inserts happen server-side in one statement using auth.uid()
 * directly, so there's no client-supplied id to ever drift out of sync with
 * what the server resolves the caller's identity to. */
export async function createOrganization(name) {
  const sb = requireSupabase();
  // create_organization_with_owner() returns a single `organizations` row
  // (not SETOF), so PostgREST already hands it back as one object -- no
  // .single() needed (that's for SETOF-returning calls).
  const { data: org, error } = await sb.rpc("create_organization_with_owner", {
    org_name: name,
    org_slug: slugify(name),
  });
  if (error) throw error;
  return org;
}

export async function fetchOrgMembers(organizationId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("organization_members")
    .select("id, role, user_id, created_at")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return data ?? [];
}

export async function updateMemberRole(memberId, role) {
  const sb = requireSupabase();
  const { error } = await sb.from("organization_members").update({ role }).eq("id", memberId);
  if (error) throw error;
}

export async function removeMember(memberId) {
  const sb = requireSupabase();
  const { error } = await sb.from("organization_members").delete().eq("id", memberId);
  if (error) throw error;
}

// NOTE: inviting someone who does NOT have an account yet requires sending
// them an email (Supabase Admin inviteUserByEmail, which needs the service
// role -- so it has to run from an Edge Function, not the browser). That's
// out of scope for Phase 1; for now, an org owner/admin can add any EXISTING
// registered user as a member once both the org and that user's account
// exist, via a server-side lookup. This function is intentionally not wired
// into the UI yet -- see README "Deferred to a later phase".
