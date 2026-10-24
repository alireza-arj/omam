import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CalendarSystem } from "@omam/calendar";
import type { Language } from "@omam/i18n";
import { LANGUAGE_LABEL, translateError } from "@omam/i18n";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { Badge, Button, ButtonLink, Card, CardHeader, Field, Input, Modal, RoleBadge, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { PageHeader } from "./layout";

export function TeamsPage() {
  const { teams, membership, selectTeam, can, refresh, isSwitching } = useSession();
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [name, setName] = useState("");
  const [calendar, setCalendar] = useState<CalendarSystem>("JALALI");
  const [teamLanguage, setTeamLanguage] = useState<Language>(language);
  const [error, setError] = useState<string | null>(null);
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });
  const save = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        const created = await api.createTeam({ name, calendar, language: teamLanguage });
        await selectTeam(created.organizationId);
      } else {
        await api.updateOrganization({ name, calendar, language: teamLanguage });
        await refresh();
      }
    },
    onSuccess: () => { setMode(null); },
    onError: (cause) => setError(translateError(cause, t)),
  });
  function open(next: "create" | "edit") {
    setName(next === "edit" ? membership?.organizationName ?? "" : "");
    setCalendar(next === "edit" ? membership?.calendar ?? "JALALI" : "JALALI");
    setTeamLanguage(next === "edit" ? membership?.language ?? language : language);
    setError(null); setMode(next);
  }
  return <>
    <PageHeader title={t("workspace.teams")} subtitle={t("workspace.teamHint")} actions={<Button variant="primary" onClick={() => open("create")}><Icon name="plus" />{t("workspace.createTeam")}</Button>} />
    <div className="page-body">
      <Card className="team-banner"><div className="row gap-7"><span className="team-logo"><Icon name="teams" /></span><div className="stack gap-3"><span className="page-eyebrow">{t("workspace.currentTeam")}</span><h2 className="t-title2">{membership?.organizationName}</h2><span className="t-body-sm muted">{t("workspace.memberCount", { count: members.data?.members.filter((member) => member.status === "ACTIVE").length ?? 0 })} · {t(`calendarName.${membership?.calendar ?? "JALALI"}`)}</span></div></div><div className="row gap-5 wrap"><ButtonLink primary to="/teams/invites"><Icon name="plus" />{t("workspace.inviteMembers")}</ButtonLink><ButtonLink to="/members">{t("workspace.manageTeam")}</ButtonLink>{can("OWNER") ? <Button variant="outline" onClick={() => open("edit")}>{t("workspace.editTeam")}</Button> : null}</div></Card>
      <div className="teams-grid">{teams.map((team) => <Card key={team.organizationId} className="team-card" ><div className="row between"><span className="team-logo small"><Icon name="teams" /></span>{team.organizationId === membership?.organizationId ? <Badge>{t("workspace.currentTeam")}</Badge> : <RoleBadge role={team.role} />}</div><div className="stack gap-3"><h2 className="t-title3">{team.organizationName}</h2><span className="t-caption muted">{t(`calendarName.${team.calendar}`)} · {t(`role.${team.role}`)}</span></div><Button variant={team.organizationId === membership?.organizationId ? "quiet" : "outline"} disabled={team.organizationId === membership?.organizationId || isSwitching} onClick={() => { void selectTeam(team.organizationId).catch(() => {}); }}>{t(team.organizationId === membership?.organizationId ? "workspace.currentTeam" : "workspace.switchTeam")}</Button></Card>)}</div>
      <Card flush><CardHeader title={t("workspace.inviteMembers")} subtitle={t("workspace.inviteHint")} actions={<ButtonLink to="/teams/invites">{t("admin.nav.invites")}<Icon name="arrow" /></ButtonLink>} /></Card>
    </div>
    {mode ? <Modal title={t(mode === "create" ? "workspace.createTeam" : "workspace.editTeam")} onClose={() => setMode(null)} footer={<><Button variant="ghost" onClick={() => setMode(null)}>{t("common.cancel")}</Button><Button variant="primary" loading={save.isPending} disabled={name.trim().length < 2} onClick={() => save.mutate()}>{t(mode === "create" ? "workspace.createTeam" : "workspace.rename")}</Button></>}>
      <Field label={t("workspace.teamName")}><Input value={name} maxLength={80} autoFocus onChange={(event) => setName(event.target.value)} placeholder={t("workspace.teamNamePlaceholder")} /></Field>
      <Field label={t("workspace.calendar")} hint={t("admin.settings.calendarHint")}><Select value={calendar} onValueChange={(value) => setCalendar(value as CalendarSystem)}><option value="JALALI">{t("calendarName.JALALI")}</option><option value="GREGORIAN">{t("calendarName.GREGORIAN")}</option></Select></Field>
      <Field label={t("language.label")}><Select value={teamLanguage} onValueChange={(value) => setTeamLanguage(value as Language)}><option value="fa">{LANGUAGE_LABEL.fa}</option><option value="en">{LANGUAGE_LABEL.en}</option></Select></Field>
      {error ? <p role="alert" className="error-message">{error}</p> : null}
    </Modal> : null}
  </>;
}
