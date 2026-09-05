import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberDto, UpdateMemberInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { displayName, formatMoney } from "../lib/format";
import { PageHeader } from "./layout";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  RoleBadge,
  Select,
} from "../components/ui";

type Draft = UpdateMemberInputDto;

export function MembersPage() {
  const { can } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [editing, setEditing] = useState<MemberDto | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [resetting, setResetting] = useState<MemberDto | null>(null);
  const [nextPassword, setNextPassword] = useState("");

  const members = useQuery({ queryKey: ["members"], queryFn: api.members });

  const save = useMutation({
    mutationFn: (input: { membershipId: string; body: Draft }) =>
      api.updateMember(input.membershipId, input.body),
    onSuccess: () => {
      toast(t("admin.members.updated"), "success");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
      setEditing(null);
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const resetPassword = useMutation({
    mutationFn: (input: { membershipId: string; password: string }) =>
      api.resetMemberPassword(input.membershipId, input.password),
    onSuccess: () => {
      toast(t("admin.members.resetDone"), "success");
      setResetting(null);
      setNextPassword("");
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  function startEdit(member: MemberDto) {
    setEditing(member);
    setDraft({
      role: member.role,
      status: member.status,
      employeeCode: member.employeeCode,
      jobTitle: member.jobTitle,
      payType: member.payType,
      hourlyRate: member.hourlyRate,
      monthlySalary: member.monthlySalary,
      monthlyGoalHours: member.monthlyGoalHours,
    });
  }

  return (
    <>
      <PageHeader
        title={t("admin.nav.members")}
        subtitle={t("admin.members.subtitle")}
        actions={
          <Link className="btn primary" to="/invites">
            {t("admin.members.inviteSomeone")}
          </Link>
        }
      />

      <div className="page-body">
        <Card flush>
          <CardHeader title={t("admin.members.onTheTeam", { count: members.data?.members.length ?? 0 })} />

          {members.isPending ? <Loading /> : null}
          {members.isError ? (
            <ErrorState message={translateError(members.error, t)} onRetry={() => members.refetch()} />
          ) : null}

          {members.data ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("admin.timesheets.member")}</th>
                    <th>{t("admin.members.code")}</th>
                    <th>{t("admin.members.role")}</th>
                    <th>{t("admin.members.pay")}</th>
                    <th className="num">{t("admin.members.goal")}</th>
                    <th>{t("admin.members.status")}</th>
                    <th className="tight" />
                  </tr>
                </thead>
                <tbody>
                  {members.data.members.map((member) => (
                    <tr key={member.membershipId}>
                      <td>
                        <div className="row gap-5">
                          <Avatar name={displayName(member)} src={member.avatarUrl} size="sm" />
                          <div className="stack">
                            <Link to={`/members/${member.userId}`}>{displayName(member)}</Link>
                            <span className="t-caption faint">
                              {member.jobTitle ?? `@${member.username}`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="t-mono muted">{member.employeeCode ?? "—"}</td>
                      <td>
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="t-mono">
                        {member.payType === "MONTHLY"
                          ? t("payType.perMonth", {
                              amount: formatMoney(member.monthlySalary, member.currency, t),
                            })
                          : t("payType.perHour", {
                              amount: formatMoney(member.hourlyRate, member.currency, t),
                            })}
                      </td>
                      <td className="num t-mono muted">{member.monthlyGoalHours}h</td>
                      <td>
                        {member.status === "ACTIVE" ? (
                          <Badge tone="success" dot>
                            {t("admin.members.active")}
                          </Badge>
                        ) : (
                          <Badge dot>{t("admin.members.suspended")}</Badge>
                        )}
                      </td>
                      <td className="tight">
                        <div className="row gap-3 end">
                          <Button size="sm" onClick={() => startEdit(member)}>
                            {t("common.edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResetting(member);
                              setNextPassword("");
                            }}
                          >
                            {t("admin.members.resetPassword")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>

      {editing ? (
        <Modal
          title={t("admin.members.editTitle", { name: displayName(editing) })}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() => save.mutate({ membershipId: editing.membershipId, body: draft })}
              >
                {t("admin.members.saveChanges")}
              </Button>
            </>
          }
        >
          <div className="stack gap-6">
            <Field label={t("admin.members.jobTitle")}>
              <Input
                value={draft.jobTitle ?? ""}
                onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value || null })}
                placeholder={t("admin.members.jobTitlePlaceholder")}
              />
            </Field>

            <Field label={t("admin.members.employeeCode")} hint={t("admin.members.employeeCodeHint")}>
              <Input
                value={draft.employeeCode ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, employeeCode: event.target.value || null })
                }
                placeholder={t("admin.members.employeeCodePlaceholder")}
              />
            </Field>

            <div className="row gap-6">
              <Field label={t("admin.members.role")}>
                <Select
                  value={draft.role}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as Draft["role"] })}
                >
                  <option value="MEMBER">{t("role.MEMBER")}</option>
                  <option value="MANAGER">{t("role.MANAGER")}</option>
                  <option value="OWNER">{t("role.OWNER")}</option>
                </Select>
              </Field>

              <Field label={t("admin.members.status")}>
                <Select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as Draft["status"] })
                  }
                >
                  <option value="ACTIVE">{t("admin.members.active")}</option>
                  <option value="SUSPENDED">{t("admin.members.suspended")}</option>
                </Select>
              </Field>
            </div>

            <Field label={t("admin.invites.payType")}>
              <Select
                value={draft.payType}
                onChange={(event) =>
                  setDraft({ ...draft, payType: event.target.value as Draft["payType"] })
                }
              >
                <option value="HOURLY">{t("payType.HOURLY")}</option>
                <option value="MONTHLY">{t("payType.MONTHLY")}</option>
              </Select>
            </Field>

            {draft.payType === "MONTHLY" ? (
              <Field label={t("admin.members.monthlySalary", { currency: editing.currency })}>
                <Input
                  type="number"
                  min={0}
                  value={draft.monthlySalary ?? 0}
                  onChange={(event) =>
                    setDraft({ ...draft, monthlySalary: Number(event.target.value) })
                  }
                />
              </Field>
            ) : (
              <Field
                label={t("admin.members.hourlyRate", { currency: editing.currency })}
                hint={t("admin.members.hourlyRateHint")}
              >
                <Input
                  type="number"
                  min={0}
                  value={draft.hourlyRate ?? 0}
                  onChange={(event) => setDraft({ ...draft, hourlyRate: Number(event.target.value) })}
                />
              </Field>
            )}

            <Field label={t("admin.members.monthlyGoalHours")}>
              <Input
                type="number"
                min={0}
                max={744}
                value={draft.monthlyGoalHours ?? 0}
                onChange={(event) =>
                  setDraft({ ...draft, monthlyGoalHours: Number(event.target.value) })
                }
              />
            </Field>
          </div>
        </Modal>
      ) : null}

      {resetting ? (
        <Modal
          title={t("admin.members.resetTitle", { name: displayName(resetting) })}
          onClose={() => setResetting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setResetting(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                loading={resetPassword.isPending}
                disabled={nextPassword.length < 6}
                onClick={() =>
                  resetPassword.mutate({
                    membershipId: resetting.membershipId,
                    password: nextPassword,
                  })
                }
              >
                {t("admin.members.resetPassword")}
              </Button>
            </>
          }
        >
          <p className="t-body-sm muted">
            {t("admin.members.resetIntro")}
          </p>
          <Field label={t("admin.members.newPassword")} hint={t("admin.members.newPasswordHint")}>
            <Input
              type="text"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              autoComplete="off"
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
