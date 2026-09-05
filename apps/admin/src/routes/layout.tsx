import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../lib/session";
import type { TranslationKey } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useTheme } from "../lib/ui";
import { api } from "../lib/api";
import { displayName } from "../lib/format";
import { Avatar, Button } from "../components/ui";

type NavItem = {
  to: string;
  key: TranslationKey;
  end?: boolean;
  /** Shows the review queue's size, so it is visible from anywhere. */
  showsPending?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", key: "admin.nav.overview", end: true },
  { to: "/timesheets", key: "admin.nav.timesheets", showsPending: true },
  { to: "/report", key: "admin.nav.report" },
  { to: "/payroll", key: "admin.nav.payroll" },
];

const TEAM_NAV: NavItem[] = [
  { to: "/members", key: "admin.nav.members" },
  { to: "/invites", key: "admin.nav.invites" },
  { to: "/projects", key: "admin.nav.projects" },
  { to: "/settings", key: "admin.nav.settings" },
  { to: "/audit", key: "admin.nav.audit" },
];

export function Shell() {
  const { user, membership, signOut } = useSession();
  const { theme, toggle } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  // Drives the pending count next to Timesheets, so the queue is visible from
  // anywhere in the panel.
  const dashboard = useQuery({
    queryKey: ["dashboard", "nav"],
    queryFn: () => api.dashboard({}),
    refetchInterval: 60_000,
  });

  const pending = dashboard.data?.pendingCount ?? 0;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="stack gap-2">
          <span className="t-overline accent">{t("admin.brand")}</span>
          <span className="t-title3">{membership?.organizationName ?? t("team.title")}</span>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {t(item.key)}
              {item.showsPending && pending > 0 ? (
                <span className="nav-count">{pending}</span>
              ) : null}
            </NavLink>
          ))}

          <span className="nav-group-label">{t("admin.nav.team")}</span>

          {TEAM_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="stack gap-5" style={{ marginTop: "auto" }}>
          <div className="row gap-5">
            <Avatar name={user ? displayName(user) : "?"} src={user?.avatarUrl} size="sm" />
            <div className="stack grow">
              <span className="t-label">{user ? displayName(user) : ""}</span>
              <span className="t-caption faint">
                {membership ? t(`role.${membership.role}`) : ""}
              </span>
            </div>
          </div>
          <div className="row gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === "fa" ? "en" : "fa")}
            >
              {language === "fa" ? "English" : "فارسی"}
            </Button>
            <Button variant="ghost" size="sm" onClick={toggle}>
              {theme === "dark" ? t("profile.themeLight") : t("profile.themeDark")}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              {t("profile.signOut")}
            </Button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="stack gap-2">
        <h1>{title}</h1>
        {subtitle ? <span className="t-body-sm muted">{subtitle}</span> : null}
      </div>
      {actions ? <div className="row gap-5 wrap">{actions}</div> : null}
    </header>
  );
}
