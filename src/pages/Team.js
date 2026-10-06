import { html, useState, useEffect } from "../lib/preact.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { useSession } from "../lib/auth.js";
import { fetchOrgMembers, addMemberByEmail, updateMemberRole, removeMember } from "../lib/org.js";
import { Card, SectionHeading, Badge, Button, Modal, Field, TextInput, Select, toast } from "../components/ui.js";
import { Icon } from "../components/icons.js";

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "researcher", label: "Researcher" },
  { value: "viewer", label: "Viewer" },
];
const ROLE_TONE = { owner: "indigo", admin: "emerald", researcher: "teal", viewer: "slate" };

export function Team() {
  const { org, loading: orgLoading } = useCurrentOrg();
  const { user } = useSession();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("researcher");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!org) return;
    setLoading(true);
    try {
      setMembers(await fetchOrgMembers(org.id));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [org?.id]);

  const myRole = members.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  async function invite() {
    setError(null);
    setBusy(true);
    try {
      await addMemberByEmail(org.id, email.trim(), role);
      setEmail(""); setRole("researcher"); setOpen(false);
      toast("Участник добавлен");
      await load();
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(memberId, newRole) {
    try {
      await updateMemberRole(memberId, newRole);
      await load();
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    }
  }

  async function remove(memberId) {
    try {
      await removeMember(memberId);
      await load();
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    }
  }

  if (orgLoading || loading) return html`<p class="text-sm text-slate-500">Загрузка…</p>`;

  return html`
    <div class="fade-in max-w-3xl">
      <${SectionHeading} title="Команда" subtitle="Кто имеет доступ к этому рабочему пространству."
        action=${canManage && html`<${Button} onClick=${() => setOpen(true)}><${Icon} name="plus" size=${16}/> Добавить участника<//>`} />

      <${Card} className="divide-y divide-slate-800">
        ${members.map(
          (m) => html`
            <div key=${m.id} class="flex items-center justify-between gap-3 px-5 py-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  ${m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-slate-100 truncate">${m.name}</div>
                  <div class="text-xs text-slate-500 truncate">${m.email}</div>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                ${canManage && m.role !== "owner"
                  ? html`<${Select} className="w-auto text-xs" options=${ROLES.filter((r) => r.value !== "owner")} value=${m.role} onChange=${(e) => changeRole(m.id, e.target.value)} />`
                  : html`<${Badge} tone=${ROLE_TONE[m.role] ?? "slate"}>${m.role}<//>`}
                ${canManage && m.role !== "owner" && html`<button onClick=${() => remove(m.id)} class="text-slate-500 hover:text-rose-400"><${Icon} name="trash" size=${15} /></button>`}
              </div>
            </div>
          `
        )}
      <//>

      <${Modal} open=${open} onClose=${() => setOpen(false)} title="Добавить участника команды"
        footer=${html`<${Button} variant="secondary" size="sm" onClick=${() => setOpen(false)}>Отмена<//><${Button} size="sm" disabled=${busy || !email.trim()} onClick=${invite}>${busy ? "Добавляем…" : "Добавить"}<//>`}>
        ${error && html`<div class="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">${error}</div>`}
        <p class="text-xs text-slate-500 mb-4">Можно добавить только человека, у которого уже есть аккаунт DecisionOS. Приглашение по email для новых пользователей появится позже.</p>
        <${Field} label="Email"><${TextInput} type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="jane@company.com" /><//>
        <${Field} label="Роль"><${Select} options=${ROLES.filter((r) => r.value !== "owner")} value=${role} onChange=${(e) => setRole(e.target.value)} /><//>
      <//>
    </div>
  `;
}
