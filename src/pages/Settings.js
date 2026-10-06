import { html, useState } from "../lib/preact.js";
import { useStore, setState, resetDemoData } from "../lib/store.js";
import { Card, SectionHeading, Field, TextInput, Button, Switch, Badge } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { toast } from "../components/ui.js";

export function Settings() {
  const org = useStore((s) => s.org);
  const [confirmReset, setConfirmReset] = useState(false);

  function updateOrg(fields) { setState((s) => ({ ...s, org: { ...s.org, ...fields } })); }

  return html`
    <div class="fade-in max-w-2xl space-y-6">
      <${SectionHeading} title="Settings" subtitle="Workspace, data and research defaults." />

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-4">Organization</h3>
        <${Field} label="Organization name">
          <${TextInput} value=${org.name} onInput=${(e) => updateOrg({ name: e.target.value })} />
        <//>
        <${Field} label="Plan">
          <div class="flex items-center gap-2"><${Badge} tone="indigo">${org.plan}<//><span class="text-xs text-slate-500">Demo workspace — not billed</span></div>
        <//>
      <//>

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-4">Research defaults</h3>
        <div class="text-sm text-slate-400 space-y-2">
          <div class="flex justify-between"><span>Minimum reliable sample size</span><span class="text-slate-200">30 completed responses</span></div>
          <div class="flex justify-between"><span>Confidence interval</span><span class="text-slate-200">95% (Wilson score)</span></div>
        </div>
        <p class="text-xs text-slate-500 mt-3">These thresholds drive the "insufficient sample size" warnings across Results and Insights.</p>
      <//>

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-4">Data & privacy</h3>
        <ul class="text-sm text-slate-400 space-y-2 list-disc pl-4 mb-4">
          <li>DecisionOS only collects what a participant explicitly submits: choices, ratings, rankings, recall, and the minimal demographic fields you enable.</li>
          <li>No camera, microphone, or biometric data is ever collected without explicit, separate consent — and none is collected in this MVP.</li>
          <li>This demo stores all data locally in your browser (localStorage). Nothing is sent to a server.</li>
        </ul>
        <${Button} variant="secondary" size="sm" onClick=${() => setConfirmReset(true)}><${Icon} name="trash" size=${14}/> Reset to demo data<//>
      <//>

      <${Card} className="p-5 border-amber-500/20 bg-amber-500/[0.04]">
        <div class="flex gap-3">
          <${Icon} name="shield" size=${18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-amber-200 text-sm mb-1.5">Ethics statement</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              DecisionOS does not read minds, does not detect emotions with certainty, and does not guarantee future consumer
              behavior. All AI-generated content is a statistical estimate or prediction based on observed responses, and is
              labeled as such throughout the product. Any future eye-tracking or webcam-based research would require explicit,
              separate participant consent and would be clearly distinguished from validated laboratory measurement.
            </p>
          </div>
        </div>
      <//>

      ${confirmReset && html`
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick=${(e) => e.target === e.currentTarget && setConfirmReset(false)}>
          <${Card} className="max-w-sm p-5">
            <div class="font-semibold text-slate-100">Reset all data?</div>
            <p class="text-sm text-slate-500 mt-1.5">This replaces everything — including any experiments or responses you've created — with the original demo dataset. This cannot be undone.</p>
            <div class="flex justify-end gap-2 mt-5">
              <${Button} variant="secondary" size="sm" onClick=${() => setConfirmReset(false)}>Cancel<//>
              <${Button} variant="danger" size="sm" onClick=${() => { resetDemoData(); setConfirmReset(false); toast("Workspace reset to demo data"); }}>Reset<//>
            </div>
          <//>
        </div>
      `}
    </div>
  `;
}
