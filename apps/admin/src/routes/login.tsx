import { LANGUAGE_LABEL } from "@omam/i18n";
import { useState, type FormEvent } from "react";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useTheme } from "../lib/ui";
import { Button, Card, Field, Input } from "../components/ui";

export function LoginPage() {
  const { signIn, isSigningIn } = useSession();
  const { theme, toggle } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await signIn(username, password);
    } catch (cause) {
      setError(translateError(cause, t));
    }
  }

  return (
    <div className="auth-screen">
      <Card className="auth-card">
        <div className="stack gap-3">
          <span className="t-label muted">{t("admin.brand")}</span>
          <h1>{t("admin.signInTitle")}</h1>
          <p className="t-body-sm muted">
            {t("admin.signInSubtitle")}
          </p>
        </div>

        <form className="stack gap-6" onSubmit={onSubmit}>
          <Field label={t("auth.username")}>
            <Input
              dir="ltr"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>

          <Field label={t("auth.password")} error={error}>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" variant="primary" block loading={isSigningIn}>
            {t("auth.signIn")}
          </Button>
        </form>

        <div className="row between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLanguage(language === "fa" ? "en" : "fa")}
          >
            {LANGUAGE_LABEL[language === "fa" ? "en" : "fa"]}
          </Button>
          <Button variant="ghost" size="sm" onClick={toggle}>
            {theme === "dark" ? t("profile.themeLight") : t("profile.themeDark")}
          </Button>
        </div>

      </Card>
    </div>
  );
}
