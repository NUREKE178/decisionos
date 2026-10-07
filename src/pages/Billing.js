import { html } from "../lib/preact.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { Card, SectionHeading, EmptyState, Badge } from "../components/ui.js";

export function Billing() {
  const { org, loading } = useCurrentOrg();
  if (loading || !org) return html`<p class="text-sm text-slate-500">Загрузка…</p>`;

  return html`
    <div class="fade-in max-w-2xl space-y-5">
      <${SectionHeading} title="Биллинг" subtitle="Тарифный план и оплата для «${org.name}»." />

      <${Card} className="p-5">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-slate-400">Текущий план</div>
            <div class="text-lg font-semibold text-slate-100 mt-0.5">Бесплатный доступ (ранний этап)</div>
          </div>
          <${Badge} tone="indigo">Активен<//>
        </div>
      <//>

      <${EmptyState}
        title="Платная подписка пока не подключена"
        body="DecisionOS сейчас не списывает и не хранит реальные платёжные данные. Когда появится платный план, оплата будет проходить через лицензированного платёжного провайдера — здесь не будет вымышленных сумм или балансов."
        icon="card"
      />
    </div>
  `;
}
