import { html, useState, useEffect } from "../lib/preact.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { useSession, signOut } from "../lib/auth.js";
import { updateOrganizationName } from "../lib/org.js";
import { invalidateOrgs } from "../lib/currentOrg.js";
import { navigate } from "../router.js";
import { Card, SectionHeading, Field, TextInput, Button, Badge, toast } from "../components/ui.js";
import { Icon } from "../components/icons.js";

export function Settings() {
  const { org, loading } = useCurrentOrg();
  const { user } = useSession();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (org) setName(org.name); }, [org?.id]);

  async function saveName() {
    if (!name.trim() || name === org.name) return;
    setSaving(true);
    try {
      await updateOrganizationName(org.id, name.trim());
      invalidateOrgs();
      toast("Название сохранено");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !org) return html`<p class="text-sm text-slate-500">Загрузка…</p>`;

  return html`
    <div class="fade-in max-w-2xl space-y-6">
      <${SectionHeading} title="Настройки" subtitle="Рабочее пространство и параметры исследований по умолчанию." />

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-4">Организация</h3>
        <${Field} label="Название организации">
          <div class="flex gap-2">
            <${TextInput} value=${name} onInput=${(e) => setName(e.target.value)} />
            <${Button} size="sm" disabled=${saving || !name.trim() || name === org.name} onClick=${saveName}>${saving ? "…" : "Сохранить"}<//>
          </div>
        <//>
        <${Field} label="Ваша роль">
          <${Badge} tone="indigo">${org.role}<//>
        <//>
      <//>

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-4">Параметры исследований по умолчанию</h3>
        <div class="text-sm text-slate-400 space-y-2">
          <div class="flex justify-between"><span>Минимальная надёжная выборка</span><span class="text-slate-200">30 завершённых ответов</span></div>
          <div class="flex justify-between"><span>Доверительный интервал</span><span class="text-slate-200">95% (Wilson score)</span></div>
        </div>
        <p class="text-xs text-slate-500 mt-3">Эти пороги определяют предупреждения «недостаточно данных» в разделах Результаты и Инсайты.</p>
      <//>

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-4">Данные и конфиденциальность</h3>
        <ul class="text-sm text-slate-400 space-y-2 list-disc pl-4">
          <li>DecisionOS собирает только то, что участник явно отправляет: выбор, оценки, ранжирование, воспоминание и минимальные демографические поля, включённые исследователем.</li>
          <li>Камера, микрофон и биометрические данные никогда не собираются без отдельного явного согласия — и не собираются в этой версии вообще.</li>
          <li>Все данные хранятся в реальной базе данных (Supabase), защищённой политиками доступа на уровне строк (RLS) — одна организация никогда не видит данные другой.</li>
        </ul>
      <//>

      <${Card} className="p-5 border-amber-500/20 bg-amber-500/[0.04]">
        <div class="flex gap-3">
          <${Icon} name="shield" size=${18} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-amber-200 text-sm mb-1.5">Этическое заявление</h3>
            <p class="text-sm text-slate-400 leading-relaxed">
              DecisionOS не читает мысли, не определяет эмоции с полной уверенностью и не гарантирует будущее поведение потребителей.
              Весь контент, сгенерированный ИИ, — это статистическая оценка или предсказание на основе наблюдаемых ответов, и
              обозначается как таковой во всём продукте. Любое будущее отслеживание взгляда или веб-камеры потребует отдельного
              явного согласия участника и будет чётко отличаться от валидированных лабораторных измерений.
            </p>
          </div>
        </div>
      <//>

      <${Card} className="p-5">
        <h3 class="font-semibold text-slate-100 mb-2">Аккаунт</h3>
        <p class="text-sm text-slate-500 mb-4">${user?.email}</p>
        <${Button} variant="secondary" size="sm" onClick=${async () => { await signOut(); navigate("/"); }}>Выйти из аккаунта<//>
      <//>
    </div>
  `;
}
