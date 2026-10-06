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

/** Members of an org, joined with their profile (name/email) -- relies on
 * the "profiles: org co-members can read" policy (0006_team.sql). */
export async function updateOrganizationName(organizationId, name) {
  const sb = requireSupabase();
  const { error } = await sb.from("organizations").update({ name }).eq("id", organizationId);
  if (error) throw error;
}

export async function fetchOrgMembers(organizationId) {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("organization_members")
    .select("id, role, user_id, created_at, profile:profiles(full_name, email)")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    name: row.profile?.full_name || row.profile?.email || "—",
    email: row.profile?.email ?? "",
  }));
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

/** Adds an EXISTING registered user as a member by email, via the
 * add_member_by_email() SECURITY DEFINER function (0006_team.sql), which
 * enforces owner/admin-only server-side. Inviting someone with no account
 * yet needs an email-sending Edge Function (Admin inviteUserByEmail) -- not
 * implemented; this only covers people who already have a DecisionOS account. */
export async function addMemberByEmail(organizationId, email, role) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("add_member_by_email", {
    org_id: organizationId,
    member_email: email,
    member_role: role,
  });
  if (error) throw error;
  return data;
}
