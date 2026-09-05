import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "../lib/session";
import { useTheme } from "../lib/ui";
import { api } from "../lib/api";
import { displayName } from "../lib/format";
import { Avatar, Button } from "../components/ui";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/timesheets", label: "Timesheets", badge: "pending" as const },
  { to: "/report", label: "Monthly report" },
  { to: "/payroll", label: "Payroll" },
];

const TEAM_NAV = [
  { to: "/members", label: "Members" },
  { to: "/invites", label: "Invites" },
  { to: "/projects", label: "Projects" },
  { to: "/settings", label: "Settings" },
  { to: "/audit", label: "Activity" },
];

export function Shell() {
  const { user, membership, signOut } = useSession();
  const { theme, toggle } = useTheme();

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
          <span className="t-overline accent">Omam</span>
          <span className="t-title3">{membership?.organizationName ?? "Team"}</span>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
              {item.badge === "pending" && pending > 0 ? (
                <span className="nav-count">{pending}</span>
              ) : null}
            </NavLink>
          ))}

          <span className="nav-group-label">Team</span>

          {TEAM_NAV.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="stack gap-5" style={{ marginTop: "auto" }}>
          <div className="row gap-5">
            <Avatar name={user ? displayName(user) : "?"} src={user?.avatarUrl} size="sm" />
            <div className="stack grow">
              <span className="t-label">{user ? displayName(user) : ""}</span>
              <span className="t-caption faint">{membership?.role.toLowerCase()}</span>
            </div>
          </div>
          <div className="row gap-4">
            <Button variant="ghost" size="sm" onClick={toggle}>
              {theme === "dark" ? "Light" : "Dark"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
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
