import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useLanguage } from "./lib/i18n";
import { useSession } from "./lib/session";
import { Loading } from "./components/ui";
import { Shell } from "./routes/layout";
import { LoginPage } from "./routes/login";

const TeamsPage = lazy(() => import("./routes/teams").then((module) => ({ default: module.TeamsPage })));
const DashboardPage = lazy(() => import("./routes/dashboard").then((module) => ({ default: module.DashboardPage })));
const TimesheetsPage = lazy(() => import("./routes/timesheets").then((module) => ({ default: module.TimesheetsPage })));
const MembersPage = lazy(() => import("./routes/members").then((module) => ({ default: module.MembersPage })));
const MemberDetailPage = lazy(() => import("./routes/member-detail").then((module) => ({ default: module.MemberDetailPage })));
const ReportPage = lazy(() => import("./routes/report").then((module) => ({ default: module.ReportPage })));
const InvitesPage = lazy(() => import("./routes/invites").then((module) => ({ default: module.InvitesPage })));

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
    <Suspense fallback={<Loading label={t("common.loading")} />}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/members/:userId" element={<MemberDetailPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/invites" element={<InvitesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
