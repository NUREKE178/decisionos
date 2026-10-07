import { html, useState, useEffect } from "../lib/preact.js";
import { useSession, updatePassword, requestEmailChange, friendlyAuthError } from "../lib/auth.js";
import { useCurrentOrg } from "../lib/currentOrg.js";
import { useMyProfile, updateMyProfile, uploadAvatar, fetchMyProfileStats, usernameAvailableLocally } from "../lib/profile.js";
import { Card, SectionHeading, Field, TextInput, TextArea, Select, Switch, Button, Badge, Tabs, toast } from "../components/ui.js";
import { Icon } from "../components/icons.js";
import { COUNTRIES } from "../lib/questionTypes.js";
import { shortDate } from "../lib/format.js";

const TABS = [
  { id: "personal", label: "Личная информация" },
  { id: "security", label: "Безопасность" },
  { id: "notifications", label: "Уведомления" },
  { id: "preferences", label: "Предпочтения" },
  { id: "sessions", label: "Сессии" },
];

const LOCALE_OPTIONS = [{ value: "ru", label: "Русский" }, { value: "kk", label: "Қазақша" }, { value: "en", label: "English" }];

const TIMEZONES = [
  "Asia/Almaty", "Asia/Astana", "Asia/Aqtobe", "Europe/Moscow", "Europe/London",
  "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Shanghai",
];

function initialsFor(nameOrEmail) {
  if (!nameOrEmail) return "?";
  const parts = nameOrEmail.split(/[\s@._]+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function AvatarEditor({ profile, displayName }) {
  const [uploading, setUploading] = useState(false);
  async function onFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(file);
      toast("Фото обновлено");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setUploading(false);
    }
  }
  return html`
    <label class="relative group cursor-pointer shrink-0">
      ${profile?.avatar_url
        ? html`<img src=${profile.avatar_url} class="h-20 w-20 rounded-full object-cover" />`
        : html`<div class="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 flex items-center justify-center text-2xl font-semibold text-white">${initialsFor(displayName)}</div>`}
      <div class="absolute inset-0 rounded-full bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
        ${uploading ? html`<span class="text-[11px] text-slate-200">Загрузка…</span>` : html`<${Icon} name="upload" size=${18} className="text-slate-100" />`}
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" disabled=${uploading} onChange=${(e) => onFile(e.target.files?.[0])} />
    </label>
  `;
}

function PersonalTab({ profile, user, org }) {
  const [form, setForm] = useState(() => ({
    full_name: profile?.full_name ?? "", username: profile?.username ?? "", role_title: profile?.role_title ?? "",
    country: profile?.country ?? "", bio: profile?.bio ?? "", research_interests: (profile?.research_interests ?? []).join(", "),
    public_profile_enabled: profile?.public_profile_enabled ?? false,
  }));
  const [saving, setSaving] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  useEffect(() => {
    setForm({
      full_name: profile?.full_name ?? "", username: profile?.username ?? "", role_title: profile?.role_title ?? "",
      country: profile?.country ?? "", bio: profile?.bio ?? "", research_interests: (profile?.research_interests ?? []).join(", "),
      public_profile_enabled: profile?.public_profile_enabled ?? false,
    });
  }, [profile?.id]);

  function patch(fields) { setForm((f) => ({ ...f, ...fields })); }

  const usernameValid = !form.username || usernameAvailableLocally(form.username);

  async function save() {
    if (!usernameValid) { toast("Имя пользователя: 3-30 символов, латиница в нижнем регистре, цифры, подчёркивание", "rose"); return; }
    setSaving(true);
    try {
      await updateMyProfile({
        full_name: form.full_name.trim() || null,
        username: form.username.trim().toLowerCase() || null,
        role_title: form.role_title.trim() || null,
        country: form.country || null,
        bio: form.bio.trim() || null,
        research_interests: form.research_interests.split(",").map((s) => s.trim()).filter(Boolean),
        public_profile_enabled: form.public_profile_enabled,
      });
      toast("Профиль сохранён");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    if (!emailDraft.trim() || emailDraft === user?.email) return;
    setChangingEmail(true);
    try {
      await requestEmailChange(emailDraft.trim());
      toast("Письмо для подтверждения отправлено на новый адрес");
      setEmailDraft("");
    } catch (err) {
      toast(friendlyAuthError(err), "rose");
    } finally {
      setChangingEmail(false);
    }
  }

  return html`
    <div class="space-y-6">
      <div class="flex items-center gap-4">
        <${AvatarEditor} profile=${profile} displayName=${form.full_name || user?.email} />
        <div>
          <div class="font-semibold text-slate-100">${form.full_name || "Без имени"}</div>
          <div class="text-sm text-slate-500">${org?.name ?? ""}${org?.role ? ` · ${org.role}` : ""}</div>
          ${profile?.username && html`<div class="text-xs text-slate-600 mt-0.5">decisionos.app/u/${profile.username}</div>`}
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-x-4">
        <${Field} label="Полное имя">
          <${TextInput} value=${form.full_name} onInput=${(e) => patch({ full_name: e.target.value })} />
        <//>
        <${Field} label="Имя пользователя" hint=${form.username && !usernameValid ? "3-30 символов: a-z, 0-9, _" : "Для публичного профиля, например nurlan"}>
          <${TextInput} value=${form.username} placeholder="nurlan" onInput=${(e) => patch({ username: e.target.value.toLowerCase() })} />
        <//>
      </div>
      <div class="grid sm:grid-cols-2 gap-x-4">
        <${Field} label="Должность / роль" hint="Например, Head of Research">
          <${TextInput} value=${form.role_title} onInput=${(e) => patch({ role_title: e.target.value })} />
        <//>
        <${Field} label="Страна">
          <${Select} options=${[{ value: "", label: "Не указано" }, ...COUNTRIES.map((c) => ({ value: c, label: c }))]} value=${form.country} onChange=${(e) => patch({ country: e.target.value })} />
        <//>
      </div>
      <${Field} label="О себе" hint="Короткая биография для публичного профиля.">
        <${TextArea} value=${form.bio} onInput=${(e) => patch({ bio: e.target.value })} />
      <//>
      <${Field} label="Исследовательские интересы" hint="Через запятую.">
        <${TextInput} value=${form.research_interests} placeholder="UX, ценообразование, упаковка" onInput=${(e) => patch({ research_interests: e.target.value })} />
      <//>

      <div class="rounded-lg border border-slate-800 p-3.5">
        <${Switch} label="Публичный профиль-исследователя" checked=${form.public_profile_enabled} onChange=${(v) => patch({ public_profile_enabled: v })} />
        <p class="text-xs text-slate-500 mt-1">Если включено, имя, должность, организация и биография будут видны всем по ссылке decisionos.app/u/${form.username || "username"}. Email и приватные исследования никогда не публикуются.</p>
      </div>

      <div class="flex justify-end">
        <${Button} onClick=${save} disabled=${saving}>${saving ? "Сохраняем…" : "Сохранить изменения"}<//>
      </div>

      <div class="pt-5 border-t border-slate-800">
        <h4 class="text-sm font-semibold text-slate-200 mb-3">Email</h4>
        <p class="text-sm text-slate-400 mb-3">Текущий: <span class="text-slate-200">${user?.email}</span></p>
        <div class="flex gap-2 max-w-md">
          <${TextInput} type="email" placeholder="новый@email.com" value=${emailDraft} onInput=${(e) => setEmailDraft(e.target.value)} />
          <${Button} variant="secondary" size="sm" disabled=${changingEmail || !emailDraft.trim()} onClick=${changeEmail}>${changingEmail ? "…" : "Изменить"}<//>
        </div>
        <p class="text-xs text-slate-500 mt-1.5">Потребуется подтверждение по ссылке из письма на новый адрес.</p>
      </div>
    </div>
  `;
}

function SecurityTab() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (password.length < 6) return toast("Пароль слишком короткий (минимум 6 символов).", "rose");
    if (password !== confirm) return toast("Пароли не совпадают.", "rose");
    setSaving(true);
    try {
      await updatePassword(password);
      toast("Пароль обновлён");
      setPassword(""); setConfirm("");
    } catch (err) {
      toast(friendlyAuthError(err), "rose");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="max-w-md space-y-4">
      <h4 class="text-sm font-semibold text-slate-200">Сменить пароль</h4>
      <${Field} label="Новый пароль" hint="Минимум 6 символов.">
        <${TextInput} type="password" autocomplete="new-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
      <//>
      <${Field} label="Повторите пароль">
        <${TextInput} type="password" autocomplete="new-password" value=${confirm} onInput=${(e) => setConfirm(e.target.value)} />
      <//>
      <${Button} onClick=${save} disabled=${saving || !password}>${saving ? "Сохраняем…" : "Обновить пароль"}<//>
    </div>
  `;
}

function NotificationsTab({ profile }) {
  const [responses, setResponses] = useState(profile?.notify_email_responses ?? true);
  const [digest, setDigest] = useState(profile?.notify_email_digest ?? true);

  async function toggle(key, value, setter) {
    setter(value);
    try {
      await updateMyProfile({ [key]: value });
    } catch (err) {
      setter(!value);
      toast(err.message ?? String(err), "rose");
    }
  }

  return html`
    <div class="max-w-md divide-y divide-slate-800">
      <${Switch} label="Email при новых ответах участников" checked=${responses} onChange=${(v) => toggle("notify_email_responses", v, setResponses)} />
      <${Switch} label="Еженедельный дайджест результатов" checked=${digest} onChange=${(v) => toggle("notify_email_digest", v, setDigest)} />
    </div>
  `;
}

function PreferencesTab({ profile }) {
  const [locale, setLocale] = useState(profile?.locale ?? "ru");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "Asia/Almaty");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateMyProfile({ locale, timezone });
      document.documentElement.lang = locale;
      toast("Предпочтения сохранены");
    } catch (err) {
      toast(err.message ?? String(err), "rose");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <div class="max-w-md space-y-4">
      <${Field} label="Язык интерфейса" hint="Полный перевод интерфейса на KZ/EN — в разработке.">
        <${Select} options=${LOCALE_OPTIONS} value=${locale} onChange=${(e) => setLocale(e.target.value)} />
      <//>
      <${Field} label="Часовой пояс">
        <${Select} options=${TIMEZONES.map((t) => ({ value: t, label: t }))} value=${timezone} onChange=${(e) => setTimezone(e.target.value)} />
      <//>
      <${Button} onClick=${save} disabled=${saving}>${saving ? "Сохраняем…" : "Сохранить"}<//>
    </div>
  `;
}

function SessionsTab({ user }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchMyProfileStats(user.id).then((s) => { if (!cancelled) setStats(s); });
    return () => { cancelled = true; };
  }, [user?.id]);

  return html`
    <div class="max-w-md space-y-5">
      <div class="rounded-lg border border-slate-800 p-3.5">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-300">Текущая сессия</span>
          <${Badge} tone="emerald">активна<//>
        </div>
        <p class="text-xs text-slate-500 mt-1.5">DecisionOS использует безопасные сессии Supabase Auth. Отдельное управление несколькими устройствами появится позже.</p>
      </div>
      <dl class="space-y-2.5 text-sm">
        <div class="flex justify-between"><dt class="text-slate-500">Аккаунт создан</dt><dd class="text-slate-200">${shortDate(user?.created_at)}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Экспериментов создано</dt><dd class="text-slate-200">${stats ? stats.experimentCount : "…"}</dd></div>
        <div class="flex justify-between"><dt class="text-slate-500">Завершивших участников</dt><dd class="text-slate-200">${stats ? stats.completedParticipants : "…"}</dd></div>
      </dl>
    </div>
  `;
}

export function Profile() {
  const { user } = useSession();
  const { org } = useCurrentOrg();
  const { profile, loading } = useMyProfile();
  const [tab, setTab] = useState("personal");

  if (loading || !profile) return html`<p class="text-sm text-slate-500">Загрузка…</p>`;

  return html`
    <div class="fade-in max-w-3xl">
      <${SectionHeading} title="Профиль" subtitle="Личные данные, безопасность и предпочтения." />
      <div class="mb-5"><${Tabs} tabs=${TABS} active=${tab} onChange=${setTab} /></div>
      <${Card} className="p-5 sm:p-7">
        ${tab === "personal" && html`<${PersonalTab} profile=${profile} user=${user} org=${org} />`}
        ${tab === "security" && html`<${SecurityTab} />`}
        ${tab === "notifications" && html`<${NotificationsTab} profile=${profile} />`}
        ${tab === "preferences" && html`<${PreferencesTab} profile=${profile} />`}
        ${tab === "sessions" && html`<${SessionsTab} user=${user} />`}
      <//>
    </div>
  `;
}
