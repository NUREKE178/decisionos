import { html, useState, useEffect } from "../../lib/preact.js";
import { navigate } from "../../router.js";
import { AuthLayout, AuthError } from "./AuthLayout.js";
import { Field, TextInput, Button } from "../../components/ui.js";
import { createOrganization, fetchMyOrganizations } from "../../lib/org.js";
import { useT } from "../../lib/i18n.js";

export function Onboarding() {
  const t = useT();
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchMyOrganizations()
      .then((orgs) => {
        if (orgs.length > 0) navigate("/app/overview");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createOrganization(name.trim());
      navigate("/app/overview");
    } catch (err) {
      setError(err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;

  return html`
    <${AuthLayout} title=${t("auth.onboarding.title")} subtitle=${t("auth.onboarding.subtitle")}>
      <${AuthError} message=${error} />
      <form onSubmit=${onSubmit}>
        <${Field} label=${t("auth.onboarding.orgNameLabel")} required>
          <${TextInput} required placeholder=${t("auth.onboarding.orgNamePlaceholder")} value=${name} onInput=${(e) => setName(e.target.value)} />
        <//>
        <${Button} type="submit" className="w-full" disabled=${loading || !name.trim()}>${loading ? t("auth.onboarding.submitting") : t("auth.onboarding.submit")}<//>
      </form>
    <//>
  `;
}
