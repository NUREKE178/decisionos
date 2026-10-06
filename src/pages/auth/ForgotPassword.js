import { html, useState } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { AuthLayout, AuthError, AuthSuccess } from "./AuthLayout.js";
import { Field, TextInput, Button } from "../../components/ui.js";
import { requestPasswordReset, friendlyAuthError } from "../../lib/auth.js";
import { IS_CONFIGURED } from "../../lib/env.js";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return html`
    <${AuthLayout}
      title="Восстановление пароля"
      subtitle="Укажите email, указанный при регистрации."
      footer=${html`<button class="text-indigo-400 hover:text-indigo-300" onClick=${() => navigate("/login")}>Вернуться ко входу<//>`}
    >
      ${!IS_CONFIGURED && html`<${AuthError} message="Supabase ещё не настроен (src/lib/env.js)." />`}
      ${sent
        ? html`<${AuthSuccess} message=${`Если аккаунт с ${email} существует, на него отправлена ссылка для сброса пароля.`} />`
        : html`
          <${AuthError} message=${error} />
          <form onSubmit=${onSubmit}>
            <${Field} label="Email" required>
              <${TextInput} type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} />
            <//>
            <${Button} type="submit" className="w-full" disabled=${loading || !IS_CONFIGURED}>${loading ? "Отправляем…" : "Отправить ссылку"}<//>
          </form>
        `}
    <//>
  `;
}
