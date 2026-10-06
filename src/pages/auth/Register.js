import { html, useState } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { AuthLayout, AuthError, AuthSuccess } from "./AuthLayout.js";
import { Field, TextInput, Button } from "../../components/ui.js";
import { signUp, friendlyAuthError } from "../../lib/auth.js";
import { IS_CONFIGURED } from "../../lib/env.js";

export function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await signUp({ email, password, fullName });
      if (data.session) {
        // Email confirmation disabled on this project -- signed in immediately.
        navigate("/onboarding");
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return html`
      <${AuthLayout} title="Проверьте почту" subtitle="Мы отправили письмо для подтверждения регистрации.">
        <${AuthSuccess} message=${`Письмо отправлено на ${email}. Перейдите по ссылке из письма, чтобы завершить регистрацию.`} />
        <${Button} variant="secondary" className="w-full" onClick=${() => navigate("/login")}>К странице входа<//>
      <//>
    `;
  }

  return html`
    <${AuthLayout}
      title="Создать аккаунт"
      subtitle="Начните собирать реальные данные о решениях потребителей."
      footer=${html`Уже есть аккаунт? <button class="text-indigo-400 hover:text-indigo-300" onClick=${() => navigate("/login")}>Войти<//>`}
    >
      ${!IS_CONFIGURED && html`<${AuthError} message="Supabase ещё не настроен (src/lib/env.js). Регистрация недоступна." />`}
      <${AuthError} message=${error} />
      <form onSubmit=${onSubmit}>
        <${Field} label="Имя" required>
          <${TextInput} required autocomplete="name" value=${fullName} onInput=${(e) => setFullName(e.target.value)} />
        <//>
        <${Field} label="Email" required>
          <${TextInput} type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} />
        <//>
        <${Field} label="Пароль" required hint="Минимум 6 символов.">
          <${TextInput} type="password" required minlength="6" autocomplete="new-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
        <//>
        <${Button} type="submit" className="w-full" disabled=${loading || !IS_CONFIGURED}>${loading ? "Создаём…" : "Зарегистрироваться"}<//>
      </form>
    <//>
  `;
}
