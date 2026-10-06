import { html, useState } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { AuthLayout, AuthError, AuthSuccess } from "./AuthLayout.js";
import { Field, TextInput, Button } from "../../components/ui.js";
import { updatePassword, friendlyAuthError } from "../../lib/auth.js";
import { useSession } from "../../lib/auth.js";

export function ResetPassword() {
  const { session, loading: sessionLoading } = useSession();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Пароль слишком короткий (минимум 6 символов).");
    if (password !== confirm) return setError("Пароли не совпадают.");
    setLoading(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return html`
      <${AuthLayout} title="Пароль обновлён" subtitle="Теперь можно войти с новым паролем.">
        <${AuthSuccess} message="Пароль успешно изменён." />
        <${Button} className="w-full" onClick=${() => navigate("/app/overview")}>Перейти в DecisionOS<//>
      <//>
    `;
  }

  if (!sessionLoading && !session) {
    return html`
      <${AuthLayout} title="Ссылка недействительна" subtitle="Перейдите по свежей ссылке из письма восстановления.">
        <${Button} variant="secondary" className="w-full" onClick=${() => navigate("/forgot-password")}>Запросить новую ссылку<//>
      <//>
    `;
  }

  return html`
    <${AuthLayout} title="Новый пароль" subtitle="Придумайте новый пароль для входа.">
      <${AuthError} message=${error} />
      <form onSubmit=${onSubmit}>
        <${Field} label="Новый пароль" required hint="Минимум 6 символов.">
          <${TextInput} type="password" required minlength="6" autocomplete="new-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
        <//>
        <${Field} label="Повторите пароль" required>
          <${TextInput} type="password" required autocomplete="new-password" value=${confirm} onInput=${(e) => setConfirm(e.target.value)} />
        <//>
        <${Button} type="submit" className="w-full" disabled=${loading}>${loading ? "Сохраняем…" : "Сохранить пароль"}<//>
      </form>
    <//>
  `;
}
