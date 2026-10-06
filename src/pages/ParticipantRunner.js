import { html, useState, useEffect, useMemo, useRef } from "../lib/preact.js";
import { navigate } from "../router.js";
import { useStore, addParticipant } from "../lib/store.js";
import { assignRandomization } from "../lib/randomization.js";
import { uid } from "../lib/prng.js";
import { Icon } from "../components/icons.js";
import { Button, Select, Checkbox, TextArea, TextInput } from "../components/ui.js";
import { AGE_RANGES, COUNTRIES, LANGUAGES } from "../lib/questionTypes.js";

function dedupeKey(experimentId) { return `decisionos_submitted_${experimentId}`; }

function StimulusCard({ variant, selected, onClick, size = "md" }) {
  const heights = { sm: "h-28", md: "h-40", lg: "h-48" };
  return html`
    <button
      onClick=${onClick}
      class=${`stimulus-card group text-left rounded-2xl border-2 overflow-hidden bg-slate-900 transition-all ${
        selected ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-slate-800 hover:border-slate-600"
      } ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <div class=${`${heights[size]} relative flex items-center justify-center overflow-hidden`} style=${{ background: variant.assetUrl ? undefined : `linear-gradient(135deg, ${variant.color ?? "#6366f1"}, #0f172a)` }}>
        ${variant.assetUrl
          ? html`<img src=${variant.assetUrl} class="h-full w-full object-cover" />`
          : html`
            <span class="text-5xl font-bold text-white/25 select-none">${variant.label}</span>
            <div class="absolute bottom-0 left-0 right-0 h-10 bg-black/20"></div>
          `}
        ${selected && html`<div class="absolute top-2 right-2 h-6 w-6 rounded-full bg-indigo-500 flex items-center justify-center text-white"><${Icon} name="check" size=${14} strokeWidth=${2.4} /></div>`}
      </div>
      <div class="px-3.5 py-2.5">
        <div class="text-xs font-semibold text-slate-500">Variant ${variant.label}</div>
        <div class="text-sm font-medium text-slate-100 truncate">${variant.name || "Untitled"}</div>
      </div>
    </button>
  `;
}

function ProgressBar({ current, total }) {
  return html`
    <div class="flex gap-1.5 mb-8">
      ${Array.from({ length: total }).map(
        (_, i) => html`<div key=${i} class=${`h-1.5 flex-1 rounded-full ${i < current ? "bg-indigo-500" : i === current ? "bg-indigo-500/40" : "bg-slate-800"}`}></div>`
      )}
    </div>
  `;
}

function TimerRing({ seconds, total }) {
  const pctLeft = Math.max(0, seconds / total);
  return html`
    <div class="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
      <${Icon} name="clock" size=${13} />
      <div class="h-1 w-24 rounded-full bg-slate-800 overflow-hidden"><div class="h-full bg-amber-500" style=${{ width: `${pctLeft * 100}%` }}></div></div>
      <span>${Math.ceil(seconds)}s</span>
    </div>
  `;
}

function variantsFor(experiment, variantOrder) {
  const map = new Map(experiment.variants.map((v) => [v.id, v]));
  return variantOrder.map((id) => map.get(id)).filter(Boolean);
}

function QuestionTask({ experiment, question, variants, onAnswer, timeLimitSeconds }) {
  const shownAt = useRef(performance.now());
  const [selected, setSelected] = useState(null);
  const [multi, setMulti] = useState([]);
  const [ratings, setRatings] = useState({});
  const [yesnos, setYesnos] = useState({});
  const [ranking, setRanking] = useState([]);
  const [text, setText] = useState("");
  const [timeLeft, setTimeLeft] = useState(timeLimitSeconds);
  const answeredRef = useRef(false);

  useEffect(() => {
    shownAt.current = performance.now();
    answeredRef.current = false;
    setSelected(null); setMulti([]); setRatings({}); setYesnos({}); setRanking([]); setText("");
    setTimeLeft(timeLimitSeconds);
  }, [question.id]);

  useEffect(() => {
    if (!timeLimitSeconds) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0.2) { clearInterval(interval); if (!answeredRef.current) submit(null); return 0; }
        return t - 0.2;
      });
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  function submit(value) {
    if (answeredRef.current) return;
    answeredRef.current = true;
    const responseTimeMs = Math.round(performance.now() - shownAt.current);
    onAnswer({ questionId: question.id, value, responseTimeMs, shownAt: new Date().toISOString() });
  }

  function pickSingleVariant(variantId) {
    setSelected(variantId);
    setTimeout(() => submit(variantId), 220);
  }

  const isVariantQuestion = question.appliesTo === "variants";

  return html`
    <div class="slide-up">
      ${timeLimitSeconds && html`<${TimerRing} seconds=${timeLeft} total=${timeLimitSeconds} />`}
      <h2 class="text-xl sm:text-2xl font-semibold text-slate-50 leading-snug mb-6">${question.prompt}</h2>

      ${isVariantQuestion && (question.type === "single_choice" || question.type === "recall") && html`
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
          ${variants.map((v) => html`<${StimulusCard} key=${v.id} variant=${v} selected=${selected === v.id} onClick=${() => pickSingleVariant(v.id)} />`)}
        </div>
      `}

      ${isVariantQuestion && question.type === "yes_no" && html`
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          ${variants.map(
            (v) => html`
              <div key=${v.id}>
                <${StimulusCard} variant=${v} size="sm" />
                <div class="flex gap-2 mt-2">
                  <button onClick=${() => setYesnos((y) => ({ ...y, [v.id]: true }))} class=${`flex-1 rounded-lg py-1.5 text-sm font-medium border ${yesnos[v.id] === true ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-700 text-slate-300"}`}>Yes</button>
                  <button onClick=${() => setYesnos((y) => ({ ...y, [v.id]: false }))} class=${`flex-1 rounded-lg py-1.5 text-sm font-medium border ${yesnos[v.id] === false ? "bg-rose-500 border-rose-500 text-white" : "border-slate-700 text-slate-300"}`}>No</button>
                </div>
              </div>
            `
          )}
        </div>
        <${Button} disabled=${Object.keys(yesnos).length < variants.length} onClick=${() => submit(yesnos)}>Continue<//>
      `}

      ${isVariantQuestion && question.type === "rating" && html`
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          ${variants.map((v) => {
            const max = question.scale?.max ?? 5;
            return html`
              <div key=${v.id}>
                <${StimulusCard} variant=${v} size="sm" />
                <div class="flex gap-1 mt-2 justify-center">
                  ${Array.from({ length: max }).map((_, i) => html`
                    <button key=${i} onClick=${() => setRatings((r) => ({ ...r, [v.id]: i + 1 }))}
                      class=${`h-7 w-7 rounded-md text-xs font-medium border ${ratings[v.id] === i + 1 ? "bg-indigo-500 border-indigo-500 text-white" : "border-slate-700 text-slate-400"}`}>${i + 1}</button>
                  `)}
                </div>
              </div>
            `;
          })}
        </div>
        <${Button} disabled=${Object.keys(ratings).length < variants.length} onClick=${() => submit(ratings)}>Continue<//>
      `}

      ${isVariantQuestion && question.type === "ranking" && html`
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          ${variants.map((v) => {
            const rank = ranking.indexOf(v.id);
            return html`
              <div key=${v.id} onClick=${() => setRanking((r) => (r.includes(v.id) ? r.filter((x) => x !== v.id) : [...r, v.id]))} class="relative cursor-pointer">
                <${StimulusCard} variant=${v} size="sm" selected=${rank >= 0} />
                ${rank >= 0 && html`<span class="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center">${rank + 1}</span>`}
              </div>
            `;
          })}
        </div>
        <p class="text-xs text-slate-500 mb-3">Click each option in order, most preferred first. ${ranking.length}/${variants.length} ranked.</p>
        <${Button} disabled=${ranking.length < variants.length} onClick=${() => submit(ranking)}>Continue<//>
      `}

      ${!isVariantQuestion && question.type === "single_choice" && html`
        <div class="space-y-2 max-w-md">
          ${(question.options ?? []).map(
            (opt) => html`
              <button key=${opt} onClick=${() => pickSingleVariant(opt)}
                class=${`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${selected === opt ? "border-indigo-500 bg-indigo-500/10 text-indigo-200" : "border-slate-800 text-slate-300 hover:border-slate-600"}`}>
                ${opt}
              </button>
            `
          )}
        </div>
      `}

      ${!isVariantQuestion && question.type === "multiple_choice" && html`
        <div class="space-y-2 max-w-md mb-5">
          ${(question.options ?? []).map(
            (opt) => html`<${Checkbox} key=${opt} label=${opt} checked=${multi.includes(opt)}
              onChange=${() => setMulti((m) => (m.includes(opt) ? m.filter((x) => x !== opt) : [...m, opt]))} />`
          )}
        </div>
        <${Button} disabled=${multi.length === 0} onClick=${() => submit(multi)}>Continue<//>
      `}

      ${!isVariantQuestion && question.type === "yes_no" && html`
        <div class="flex gap-3 max-w-xs">
          <${Button} variant=${selected === true ? "primary" : "outline"} className="flex-1" onClick=${() => pickSingleVariant(true)}>Yes<//>
          <${Button} variant=${selected === false ? "primary" : "outline"} className="flex-1" onClick=${() => pickSingleVariant(false)}>No<//>
        </div>
      `}

      ${question.type === "price_perception" && html`
        ${question.options
          ? html`
            <div class="flex flex-wrap gap-2">
              ${question.options.map((opt) => html`<button key=${opt} onClick=${() => pickSingleVariant(opt)} class=${`rounded-xl border px-4 py-2.5 text-sm font-medium ${selected === opt ? "border-indigo-500 bg-indigo-500/10 text-indigo-200" : "border-slate-800 text-slate-300 hover:border-slate-600"}`}>${opt}</button>`)}
            </div>
          `
          : html`
            <div class="max-w-xs">
              <${TextInput} type="number" min="0" step="0.01" placeholder="Enter an amount" onInput=${(e) => setText(e.target.value)} />
              <div class="mt-3"><${Button} disabled=${!text} onClick=${() => submit(Number(text))}>Continue<//></div>
            </div>
          `}
      `}

      ${question.type === "open_text" && html`
        <div class="max-w-md">
          <${TextArea} placeholder="Type your answer…" value=${text} onInput=${(e) => setText(e.target.value)} />
          <div class="mt-3"><${Button} disabled=${!text.trim()} onClick=${() => submit(text.trim())}>Continue<//></div>
        </div>
      `}
    </div>
  `;
}

function ConsentScreen({ experiment, onAgree }) {
  const [checked, setChecked] = useState(false);
  return html`
    <div class="max-w-md mx-auto text-center fade-in">
      <div class="mx-auto h-12 w-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-300 mb-5"><${Icon} name="shield" size=${22} /></div>
      <h1 class="text-xl font-semibold text-slate-50">Before you begin</h1>
      <p class="text-sm text-slate-400 mt-3 leading-relaxed">
        You'll be shown a few options and asked some quick questions. There are no right or wrong answers — we're interested
        in your honest first reaction. It should take about 2-3 minutes.
      </p>
      <p class="text-xs text-slate-500 mt-3">Your responses are recorded for research purposes${experiment.settings.anonymous ? " and are anonymous" : ""}. No camera, microphone, or biometric data is collected.</p>
      <div class="mt-6 text-left">
        <${Checkbox} label="I agree to take part in this research task." checked=${checked} onChange=${(e) => setChecked(e.target.checked)} />
      </div>
      <${Button} className="mt-5 w-full" disabled=${!checked} onClick=${onAgree}>Begin<//>
    </div>
  `;
}

function DemographicsScreen({ fields, onSubmit }) {
  const [ageRange, setAgeRange] = useState(AGE_RANGES[1]);
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  return html`
    <div class="max-w-sm mx-auto fade-in">
      <h1 class="text-xl font-semibold text-slate-50 mb-1.5">Quick background</h1>
      <p class="text-sm text-slate-400 mb-6">Just a few optional details to help us understand our panel.</p>
      ${fields.includes("ageRange") && html`<div class="mb-4"><label class="block text-sm text-slate-300 mb-1.5">Age range</label><${Select} options=${AGE_RANGES} value=${ageRange} onChange=${(e) => setAgeRange(e.target.value)} /></div>`}
      ${fields.includes("country") && html`<div class="mb-4"><label class="block text-sm text-slate-300 mb-1.5">Country</label><${Select} options=${COUNTRIES} value=${country} onChange=${(e) => setCountry(e.target.value)} /></div>`}
      ${fields.includes("language") && html`<div class="mb-4"><label class="block text-sm text-slate-300 mb-1.5">Language</label><${Select} options=${LANGUAGES} value=${language} onChange=${(e) => setLanguage(e.target.value)} /></div>`}
      <${Button} className="w-full mt-2" onClick=${() => onSubmit({ ageRange, country, language })}>Continue<//>
    </div>
  `;
}

function DoneScreen({ preview, onExitPreview }) {
  return html`
    <div class="max-w-sm mx-auto text-center fade-in">
      <div class="mx-auto h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-300 mb-5"><${Icon} name="check" size=${22} /></div>
      <h1 class="text-xl font-semibold text-slate-50">Thank you!</h1>
      <p class="text-sm text-slate-400 mt-3">Your responses have been recorded. You may now close this window.</p>
      ${preview
        ? html`<${Button} className="mt-6" variant="secondary" onClick=${onExitPreview}>Exit preview<//>`
        : html`<${Button} className="mt-6" variant="secondary" onClick=${() => navigate("/")}>Return home<//>`}
    </div>
  `;
}

export function ParticipantRunner({ experimentId, preview = false, previewExperiment = null, onExitPreview }) {
  const experiments = useStore((s) => s.experiments);
  const storeParticipants = useStore((s) => s.participants);

  const experiment = useMemo(() => {
    if (previewExperiment) return previewExperiment;
    if (experimentId === "demo") return experiments.find((e) => e.isDemo && e.status !== "draft") ?? experiments[0] ?? null;
    return experiments.find((e) => e.id === experimentId) ?? null;
  }, [previewExperiment, experiments, experimentId]);

  const alreadySubmitted = !preview && experiment && typeof localStorage !== "undefined" && experiment.settings.preventDuplicates
    ? !!localStorage.getItem(dedupeKey(experiment.id))
    : false;

  function firstPostConsentPhase(exp) {
    return exp.participantSettings.demographicQuestions.length > 0 ? "demographics" : "task";
  }

  const [phase, setPhase] = useState(() => {
    if (!experiment) return "notfound";
    if (alreadySubmitted) return "alreadyDone";
    if (experiment.settings.requireConsent && !preview) return "consent";
    return firstPostConsentPhase(experiment);
  });
  const [demographics, setDemographics] = useState(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [responses, setResponses] = useState([]);
  const startedAtRef = useRef(new Date().toISOString());

  const participantIndex = useMemo(() => (experiment ? storeParticipants.filter((p) => p.experimentId === experiment.id).length : 0), [experiment]);
  const { variantOrder, questionOrder } = useMemo(
    () => (experiment ? assignRandomization(experiment, participantIndex) : { variantOrder: [], questionOrder: [] }),
    [experiment, participantIndex]
  );
  const orderedVariants = useMemo(() => (experiment ? variantsFor(experiment, variantOrder) : []), [experiment, variantOrder]);
  const orderedQuestions = useMemo(() => {
    if (!experiment) return [];
    const map = new Map(experiment.questions.map((q) => [q.id, q]));
    return questionOrder.map((id) => map.get(id)).filter(Boolean);
  }, [experiment, questionOrder]);

  function finish(finalResponses) {
    if (!preview && experiment) {
      const record = {
        id: uid("p"),
        experimentId: experiment.id,
        status: "completed",
        isDemo: false,
        startedAt: startedAtRef.current,
        completedAt: new Date().toISOString(),
        variantOrder,
        questionOrder,
        demographics: demographics ?? {},
        responses: finalResponses,
      };
      addParticipant(record);
      if (experiment.settings.preventDuplicates && typeof localStorage !== "undefined") {
        try { localStorage.setItem(dedupeKey(experiment.id), "1"); } catch {}
      }
    }
    setPhase("done");
  }

  function handleAnswer(response) {
    const updated = [...responses, response];
    setResponses(updated);
    if (taskIndex + 1 >= orderedQuestions.length) finish(updated);
    else setTaskIndex((i) => i + 1);
  }

  if (phase === "notfound") {
    return html`
      <div class="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 px-6">
        <div class="text-center">
          <p class="font-medium">We couldn't find this study.</p>
          <${Button} className="mt-4" variant="secondary" onClick=${() => navigate("/")}>Return home<//>
        </div>
      </div>
    `;
  }

  if (phase === "alreadyDone") {
    return html`
      <div class="min-h-screen flex items-center justify-center bg-slate-950 px-6">
        <div class="max-w-sm text-center">
          <h1 class="text-xl font-semibold text-slate-50">You've already completed this study</h1>
          <p class="text-sm text-slate-400 mt-3">Thanks again for participating — duplicate submissions aren't accepted for this experiment.</p>
          <${Button} className="mt-6" variant="secondary" onClick=${() => navigate("/")}>Return home<//>
        </div>
      </div>
    `;
  }

  return html`
    <div class="min-h-screen bg-slate-950 text-slate-100 px-6 py-10 flex flex-col">
      ${preview && html`
        <div class="max-w-2xl w-full mx-auto mb-6 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-300">
          <${Icon} name="play" size=${13} /> Preview mode — responses are not recorded.
          <button class="ml-auto underline" onClick=${onExitPreview ?? (() => history.back())}>Exit</button>
        </div>
      `}

      <div class="flex-1 flex items-center justify-center">
        <div class="w-full max-w-2xl">
          ${phase === "consent" && html`<${ConsentScreen} experiment=${experiment} onAgree=${() => setPhase(firstPostConsentPhase(experiment))} />`}

          ${phase === "demographics" && html`
            <${DemographicsScreen} fields=${experiment.participantSettings.demographicQuestions} onSubmit=${(d) => { setDemographics(d); setPhase("task"); }} />
          `}

          ${phase === "task" && orderedQuestions.length > 0 && html`
            <${ProgressBar} current=${taskIndex} total=${orderedQuestions.length} />
            <${QuestionTask}
              key=${orderedQuestions[taskIndex].id}
              experiment=${experiment}
              question=${orderedQuestions[taskIndex]}
              variants=${orderedVariants}
              timeLimitSeconds=${experiment.settings.timeLimitSeconds}
              onAnswer=${handleAnswer}
            />
          `}

          ${phase === "task" && orderedQuestions.length === 0 && html`<${DoneScreen} preview=${preview} onExitPreview=${onExitPreview} />`}

          ${phase === "done" && html`<${DoneScreen} preview=${preview} onExitPreview=${onExitPreview} />`}
        </div>
      </div>
    </div>
  `;
}
