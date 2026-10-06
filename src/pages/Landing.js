import { html } from "../lib/preact.js";
import { navigate } from "../router.js";
import { Icon } from "../components/icons.js";
import { Button, Badge } from "../components/ui.js";

const STEPS = [
  { icon: "image", title: "Стимул", desc: "Загрузите варианты для теста — упаковку, рекламу, логотипы, цены, экраны." },
  { icon: "experiments", title: "Контролируемый эксперимент", desc: "Рандомизированный, уравновешенный показ — порядок никогда не определяет победителя." },
  { icon: "participants", title: "Ответ участника", desc: "Без отвлекающих элементов — фиксируются реальные решения, а не опрос о решениях." },
  { icon: "clock", title: "Поведенческие данные", desc: "Выбор, время реакции, запоминание и ранжирование — с метками времени." },
  { icon: "results", title: "Статистический анализ", desc: "Доля выбора, доверительные интервалы и проверка размера выборки — всегда." },
  { icon: "sparkle", title: "Интерпретация ИИ", desc: "Понятное объяснение того, что произошло и что это может объяснять." },
  { icon: "check", title: "Рекомендация по решению", desc: "Рекомендация с оценкой уверенности, на которую можно опереться — или оспорить." },
];

export function Landing() {
  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <header class="flex items-center justify-between px-6 py-5 lg:px-12 max-w-7xl mx-auto">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white"><${Icon} name="logo" size=${18} strokeWidth=${2} /></div>
          <span class="font-semibold text-lg">DecisionOS</span>
        </div>
        <div class="flex items-center gap-3">
          <${Button} variant="ghost" size="sm" onClick=${() => navigate("/login")}>Войти<//>
          <${Button} variant="primary" size="sm" onClick=${() => navigate("/register")}>Создать исследование<//>
        </div>
      </header>

      <section class="px-6 lg:px-12 max-w-5xl mx-auto text-center pt-14 pb-10">
        <${Badge} tone="indigo" className="mb-5">Платформа исследования потребительских решений<//>
        <h1 class="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] text-slate-50">
          Понимайте, <span class="text-indigo-400">почему</span> люди выбирают
        </h1>
        <p class="mt-5 text-lg text-slate-400 max-w-2xl mx-auto">
          DECISIONOS превращает реальные исследования потребительского поведения в понятные данные и практические решения.
        </p>
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <${Button} size="lg" onClick=${() => navigate("/register")}><${Icon} name="plus" size=${18}/> Создать исследование<//>
          <${Button} size="lg" variant="outline" onClick=${() => navigate("/login")}>Войти в кабинет<//>
        </div>
      </section>

      <section class="px-6 lg:px-12 max-w-6xl mx-auto py-10">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          ${STEPS.map(
            (s, i) => html`
              <div key=${s.title} class="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 relative">
                <div class="absolute top-4 right-4 text-xs text-slate-600 font-mono">${String(i + 1).padStart(2, "0")}</div>
                <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 mb-3"><${Icon} name=${s.icon} size=${18} /></div>
                <div class="font-semibold text-slate-100 text-sm">${s.title}</div>
                <div class="text-xs text-slate-500 mt-1.5 leading-relaxed">${s.desc}</div>
              </div>
            `
          )}
        </div>
      </section>

      <section class="px-6 lg:px-12 max-w-4xl mx-auto py-10">
        <div class="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
          <div class="flex items-start gap-3">
            <${Icon} name="shield" size=${20} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <div class="font-semibold text-amber-200 text-sm">Что DecisionOS умеет — а что нет</div>
              <p class="text-sm text-slate-400 mt-1.5 leading-relaxed">
                DecisionOS анализирует поведение, которое люди реально проявляют в контролируемой задаче — выбор, оценки, время
                реакции, запоминание — и превращает это в статистические оценки и предсказания на основе исследования. Платформа
                не читает мысли, не определяет эмоции с полной уверенностью и никогда не заявляет о точном предсказании реального
                поведения. Каждый инсайт, сгенерированный ИИ, обозначен как предсказание, а маленькие выборки всегда отмечаются
                как недостаточные для надёжного вывода.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer class="px-6 lg:px-12 max-w-6xl mx-auto py-10 text-center text-xs text-slate-600">
        DecisionOS — платформа исследования потребительских решений.
      </footer>
    </div>
  `;
}
