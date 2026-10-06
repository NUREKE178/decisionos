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

/** Creates a new org and seats the creator as its owner. Two inserts: RLS
 * (0002_rls.sql) specifically allows a brand-new org's `created_by` user to
 * insert themselves as the first `owner` member before any membership row
 * exists yet. */
export async function createOrganization(name) {
  const sb = requireSupabase();
  const { data: userRes } = await sb.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) throw new Error("Not signed in.");

  const { data: org, error: orgError } = await sb
    .from("organizations")
    .insert({ name, slug: slugify(name), created_by: userId })
    .select()
    .single();
  if (orgError) throw orgError;

  const { error: memberError } = await sb
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: userId, role: "owner" });
  if (memberError) throw memberError;

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
