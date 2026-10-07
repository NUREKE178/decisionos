import { html, useState } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { AuthLayout, AuthError } from "./AuthLayout.js";
import { Field, TextInput, Button } from "../../components/ui.js";
import { signIn, friendlyAuthError } from "../../lib/auth.js";
import { IS_CONFIGURED } from "../../lib/env.js";
import { useT } from "../../lib/i18n.js";

export function Login() {
  const t = useT();
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
      setError(friendlyAuthError(err, t));
    } finally {
      setLoading(false);
    }
  }

  return html`
    <${AuthLayout}
      title=${t("auth.login.title")}
      subtitle=${t("auth.login.subtitle")}
      footer=${html`${t("auth.login.noAccount")} <button class="text-indigo-400 hover:text-indigo-300" onClick=${() => navigate("/register")}>${t("auth.login.register")}<//>`}
    >
      ${!IS_CONFIGURED && html`<${AuthError} message=${t("auth.login.notConfigured")} />`}
      <${AuthError} message=${error} />
      <form onSubmit=${onSubmit}>
        <${Field} label=${t("auth.fields.email")} required>
          <${TextInput} type="email" required autocomplete="email" value=${email} onInput=${(e) => setEmail(e.target.value)} />
        <//>
        <${Field} label=${t("auth.fields.password")} required>
          <${TextInput} type="password" required autocomplete="current-password" value=${password} onInput=${(e) => setPassword(e.target.value)} />
        <//>
        <div class="flex justify-end mb-4 -mt-2">
          <button type="button" class="text-xs text-slate-500 hover:text-slate-300" onClick=${() => navigate("/forgot-password")}>${t("auth.login.forgotPassword")}</button>
        </div>
        <${Button} type="submit" className="w-full" disabled=${loading || !IS_CONFIGURED}>${loading ? t("auth.login.submitting") : t("auth.login.submit")}<//>
      </form>
    <//>
  `;
}
