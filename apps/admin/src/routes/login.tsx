import { useState, type FormEvent } from "react";
import { useSession } from "../lib/session";
import { errorMessage, useTheme } from "../lib/ui";
import { Button, Card, Field, Input } from "../components/ui";

export function LoginPage() {
  const { signIn, isSigningIn } = useSession();
  const { theme, toggle } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      await signIn(username, password);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <div className="auth-screen">
      <Card className="auth-card">
        <div className="stack gap-3">
          <span className="t-overline accent">Omam</span>
          <h1>Team admin</h1>
          <p className="t-body-sm muted">
            Sign in with the manager or owner account for your team.
          </p>
        </div>

        <form className="stack gap-6" onSubmit={onSubmit}>
          <Field label="Username">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>

          <Field label="Password" error={error}>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" variant="primary" size="lg" block loading={isSigningIn}>
            Sign in
          </Button>
        </form>

        <div className="row between">
          <span className="t-caption faint">Members clock in from the mobile app.</span>
          <Button variant="ghost" size="sm" onClick={toggle}>
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
