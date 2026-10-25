import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LANGUAGE_LABEL, type TranslationKey } from "@omam/i18n";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useIsMutating } from "@tanstack/react-query";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { useTheme } from "../lib/ui";
import { displayName } from "../lib/format";
import { ActionMenu, Button, Select } from "../components/ui";
import { Icon, type IconName } from "../components/icons";

const NAV: { to: string; key: TranslationKey; icon: IconName }[] = [
  { to: "/", key: "workspace.overview", icon: "overview" },
  { to: "/report", key: "workspace.monthlyReport", icon: "report" },
  { to: "/timesheets", key: "workspace.sessions", icon: "sessions" },
  { to: "/members", key: "workspace.members", icon: "members" },
  { to: "/teams", key: "workspace.teams", icon: "teams" },
];

export function Shell() {
  const { user, membership, signOut, teams, selectTeam, isSwitching } = useSession();
  const { theme, toggle } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const mutating = useIsMutating();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [clip, setClip] = useState("inset(0 0 100% 0)");
  const [pointerMotion, setPointerMotion] = useState(false);
  const navItems = [
    ...(membership ? NAV : []),
    ...(user?.isSuperAdmin ? [{ to: "/users", key: "users.title" as const, icon: "members" as const }] : []),
  ];
  const nav = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLElement>(null);
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)));
  useLayoutEffect(() => {
    main.current?.scrollTo({ top: 0 });
  }, [location.pathname, membership?.organizationId]);
  useLayoutEffect(() => {
    const root = nav.current;
    if (!root) return;
    const measure = () => {
      const item = root.querySelector<HTMLAnchorElement>("a.active");
      if (!item) return;
      const outer = root.getBoundingClientRect();
      const rect = item.getBoundingClientRect();
      setClip(`inset(${rect.top - outer.top}px ${outer.right - rect.right}px ${outer.bottom - rect.bottom}px ${rect.left - outer.left}px round var(--nav-radius))`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [location.pathname, navigationOpen, language, membership?.organizationId, user?.isSuperAdmin]);

  return <div className="shell workspace-shell">
    <a className="skip-link" href="#main-content">{t("admin.table.skip")}</a>
    <aside className="sidebar workspace-sidebar" data-open={navigationOpen}>
      <Link to="/" className="brand-mark" aria-label={t("admin.brand")} title={t("admin.brand")}><Icon name="sessions" /></Link>
      <Button variant="ghost" className="navigation-toggle" aria-expanded={navigationOpen} aria-controls="main-navigation" aria-label={t("admin.table.navigation")} onClick={() => setNavigationOpen(!navigationOpen)}><Icon name="menu" /></Button>
      <div className="workspace-nav" ref={nav} data-motion={pointerMotion}>
        <nav id="main-navigation" className="nav" aria-label={t("admin.table.navigation")} onPointerDown={() => setPointerMotion(true)} onKeyDown={() => setPointerMotion(false)}>
          {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === "/"} className="rail-link" title={t(item.key)} aria-label={t(item.key)} onClick={() => setNavigationOpen(false)}><Icon name={item.icon} /><span className="rail-label">{t(item.key)}</span></NavLink>)}
        </nav>
        <div className="nav-active-copy" aria-hidden="true" style={{ clipPath: clip }}>
          {navItems.map((item) => <span key={item.to} className="rail-link"><Icon name={item.icon} /><span className="rail-label">{t(item.key)}</span></span>)}
        </div>
      </div>
      <div className="sidebar-account">
        <ActionMenu label={t("admin.nav.settings")} showChevron={false} items={[
          { label: LANGUAGE_LABEL[language === "fa" ? "en" : "fa"], onAction: () => setLanguage(language === "fa" ? "en" : "fa") },
          { label: theme === "dark" ? t("profile.themeLight") : t("profile.themeDark"), onAction: toggle },
          { label: t("profile.signOut"), onAction: signOut },
        ]}><Icon name="settings" /></ActionMenu>
      </div>
    </aside>
    <main ref={main} className="main" id="main-content" tabIndex={-1}>
      <div className="workspace-topbar">
        <div className="breadcrumb"><span className="t-label">{t("admin.brand")}</span><span className="faint">/</span><span className="muted">{t(navItems[activeIndex].key)}</span></div>
        <div className="row gap-6 topbar-tools">
          {membership ? <Select aria-label={t("workspace.selectTeam")} value={membership?.organizationId} disabled={isSwitching || mutating > 0} onValueChange={(id) => { void selectTeam(id).catch(() => {}); }}>
            {teams.map((team) => <option key={team.organizationId} value={team.organizationId}>{team.organizationName}</option>)}
          </Select> : null}
          <span className="account-name t-caption muted">{user ? displayName(user) : ""}</span>
        </div>
      </div>
      <div className="workspace-content" key={membership?.organizationId}><Outlet /></div>
    </main>
  </div>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  const { membership } = useSession();
  return <header className="page-header"><div className="stack gap-3"><span className="page-eyebrow">{eyebrow ?? membership?.organizationName}</span><h1>{title}</h1>{subtitle ? <p className="t-body-sm muted">{subtitle}</p> : null}</div>{actions ? <div className="row gap-5 wrap">{actions}</div> : null}</header>;
}
