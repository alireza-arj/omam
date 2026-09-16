import { useState } from "react";
import { LANGUAGE_LABEL } from "@omam/i18n";
import { NavLink, Outlet } from "react-router-dom";
import { useSession } from "../lib/session";
import type { TranslationKey } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useTheme } from "../lib/ui";
import { displayName } from "../lib/format";
import { ActionMenu, Avatar, Button } from "../components/ui";

type NavItem = {
  to: string;
  key: TranslationKey;
  end?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", key: "admin.nav.overview", end: true },
  { to: "/timesheets", key: "admin.nav.timesheets" },
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

  const [navigationOpen, setNavigationOpen] = useState(false);


  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t("admin.table.skip")}
      </a>
      <aside className="sidebar" data-open={navigationOpen}>
        <div className="sidebar-brand stack gap-2">
          <span className="t-label muted">{t("admin.brand")}</span>
          <span className="t-title3">{membership?.organizationName ?? t("team.title")}</span>
        </div>

        <Button
          variant="ghost"
          className="navigation-toggle"
          aria-expanded={navigationOpen}
          aria-controls="main-navigation"
          onClick={() => setNavigationOpen(!navigationOpen)}
        >
          {t("admin.table.navigation")}
        </Button>

        <nav
          id="main-navigation"
          className="nav"
          aria-label={t("admin.table.navigation")}
          onClick={() => setNavigationOpen(false)}
        >
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {t(item.key)}
            </NavLink>
          ))}

          <span className="nav-group-label">{t("admin.nav.team")}</span>

          {TEAM_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account">
          <ActionMenu
            label={t("admin.table.account")}
            items={[
              {
                label: LANGUAGE_LABEL[language === "fa" ? "en" : "fa"],
                onAction: () => setLanguage(language === "fa" ? "en" : "fa"),
              },
              {
                label: theme === "dark" ? t("profile.themeLight") : t("profile.themeDark"),
                onAction: toggle,
              },
              { label: t("profile.signOut"), onAction: signOut },
            ]}
          >
            <Avatar name={user ? displayName(user) : "?"} src={user?.avatarUrl} size="sm" />
            <span className="stack grow">
              <span className="t-label">{user ? displayName(user) : ""}</span>
              <span className="t-caption muted">{membership ? t(`role.${membership.role}`) : ""}</span>
            </span>
          </ActionMenu>
        </div>
      </aside>

      <main className="main" id="main-content" tabIndex={-1}>
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
