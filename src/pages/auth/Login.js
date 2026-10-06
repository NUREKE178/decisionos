import { html, useState } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { AuthLayout, AuthError } from "./AuthLayout.js";
import { Field, TextInput, Button } from "../../components/ui.js";
import { signIn, friendlyAuthError } from "../../lib/auth.js";
import { IS_CONFIGURED } from "../../lib/env.js";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ email, password });
      navigate("/app/overview");
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return html`
    <${AuthLayout}
      title="Войти в DecisionOS"
      subtitle="Платформа исследования потребительских решений."
      footer=${html`Нет аккаунта? <button class="text-indigo-400 hover:text-indigo-300" onClick=${() => navigate("/register")}>Зарегистрироваться<//>`}
    >
      ${!IS_CONFIGURED && html`<${AuthError} message="Supabase ещё не настроен (src/lib/env.js). Вход недоступен." />`}
      <${AuthError} message=${error} />
      <form onSubmit=${onSubmit}>
        <${Field} label="Email" required>
          <${TextInput} type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} />
        <//>
        <${Field} label="Пароль" required>
          <${TextInput} type="password" required autocomplete="current-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
        <//>
        <div class="flex justify-end mb-4 -mt-2">
          <button type="button" class="text-xs text-slate-500 hover:text-slate-300" onClick=${() => navigate("/forgot-password")}>Забыли пароль?</button>
        </div>
        <${Button} type="submit" className="w-full" disabled=${loading || !IS_CONFIGURED}>${loading ? "Входим…" : "Войти"}<//>
      </form>
    <//>
  `;
}
