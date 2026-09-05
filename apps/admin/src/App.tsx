import { Navigate, Route, Routes } from "react-router-dom";
import { useLanguage } from "./lib/i18n";
import { useSession } from "./lib/session";
import { Loading } from "./components/ui";
import { Shell } from "./routes/layout";
import { LoginPage } from "./routes/login";
import { DashboardPage } from "./routes/dashboard";
import { TimesheetsPage } from "./routes/timesheets";
import { MembersPage } from "./routes/members";
import { MemberDetailPage } from "./routes/member-detail";
import { ReportPage } from "./routes/report";
import { PayrollPage } from "./routes/payroll";
import { ProjectsPage } from "./routes/projects";
import { InvitesPage } from "./routes/invites";
import { SettingsPage } from "./routes/settings";
import { AuditPage } from "./routes/audit";

export function App() {
  const { user, isReady } = useSession();
  const { t } = useLanguage();

  if (!isReady) {
    return (
      <div className="auth-screen">
        <Loading label={t("admin.starting")} />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/timesheets" element={<TimesheetsPage />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/members/:userId" element={<MemberDetailPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/payroll" element={<PayrollPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/invites" element={<InvitesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
