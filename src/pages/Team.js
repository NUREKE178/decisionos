import { html, useState } from "../lib/preact.js";
import { useStore, setState } from "../lib/store.js";
import { Card, SectionHeading, Badge, Button, Modal, Field, TextInput, Select } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { uid } from "../lib/prng.js";

const ROLES = ["Owner", "Admin", "Analyst", "Editor", "Viewer"];
const ROLE_TONE = { Owner: "indigo", Admin: "emerald", Analyst: "teal", Editor: "amber", Viewer: "slate" };

export function Team() {
  const team = useStore((s) => s.team);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Analyst");

  function invite() {
    if (!name.trim() || !email.trim()) return;
    setState((s) => ({ ...s, team: [...s.team, { id: uid("mem"), name, email, role }] }));
    setName(""); setEmail(""); setRole("Analyst"); setOpen(false);
  }
  function removeMember(id) {
    setState((s) => ({ ...s, team: s.team.filter((m) => m.id !== id) }));
  }

  return html`
    <div class="fade-in max-w-3xl">
      <${SectionHeading} title="Team" subtitle="Who has access to this research workspace."
        action=${html`<${Button} onClick=${() => setOpen(true)}><${Icon} name="plus" size=${16}/> Invite member<//>`} />

      <${Card} className="divide-y divide-slate-800">
        ${team.map(
          (m) => html`
            <div key=${m.id} class="flex items-center justify-between gap-3 px-5 py-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center text-xs font-semibold text-white shrink-0">
                  ${m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-slate-100 truncate">${m.name}</div>
                  <div class="text-xs text-slate-500 truncate">${m.email}</div>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <${Badge} tone=${ROLE_TONE[m.role] ?? "slate"}>${m.role}<//>
                ${m.role !== "Owner" && html`<button onClick=${() => removeMember(m.id)} class="text-slate-500 hover:text-rose-400"><${Icon} name="trash" size=${15} /></button>`}
              </div>
            </div>
          `
        )}
      <//>

      <${Modal} open=${open} onClose=${() => setOpen(false)} title="Invite a team member"
        footer=${html`<${Button} variant="secondary" size="sm" onClick=${() => setOpen(false)}>Cancel<//><${Button} size="sm" onClick=${invite}>Send invite<//>`}>
        <${Field} label="Full name"><${TextInput} value=${name} onInput=${(e) => setName(e.target.value)} placeholder="Jane Doe" /><//>
        <${Field} label="Email"><${TextInput} type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="jane@company.com" /><//>
        <${Field} label="Role"><${Select} options=${ROLES} value=${role} onChange=${(e) => setRole(e.target.value)} /><//>
      <//>
    </div>
  `;
}
