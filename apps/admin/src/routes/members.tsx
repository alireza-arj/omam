import {
  ActionMenu,
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  RoleBadge,
  Select,
  Table,
  TableScroll,
} from "../components/ui";
import { CollectionToolbar, Pagination } from "../components/collection";
import { useCollection } from "../lib/collection";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberDto, UpdateMemberInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { currencyLabel, displayName, formatMoney } from "../lib/format";
import { PageHeader } from "./layout";

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
      queryClient.invalidateQueries({ queryKey: ["member-report"] });
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

  const collection = useCollection(members.data?.members ?? [], (row) =>
    [displayName(row), row.username, row.employeeCode, row.jobTitle].join(" "),
  );

  return (
    <>
      <PageHeader
        title={t("admin.nav.members")}
        actions={
          <ButtonLink primary to="/invites">
            {t("admin.members.inviteSomeone")}
          </ButtonLink>
        }
      />

      <div className="page-body">
        <Card flush>
          <CollectionToolbar search={collection.search} onSearch={collection.setSearch} />
          {collection.search && !collection.total && members.data ? (
            <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
          ) : null}

          {members.isPending ? <Loading /> : null}
          {members.isError ? (
            <ErrorState message={translateError(members.error, t)} onRetry={() => members.refetch()} />
          ) : null}

          {collection.total > 0 ? (
            <TableScroll>
              <Table>
                <Table.Content aria-label={t("common.records")} className="omam-data">
                  <Table.Header>
                    <Table.Column isRowHeader>{t("admin.timesheets.member")}</Table.Column>
                    <Table.Column>{t("admin.members.code")}</Table.Column>
                    <Table.Column>{t("admin.members.role")}</Table.Column>
                    <Table.Column>{t("admin.members.pay")}</Table.Column>
                    <Table.Column className="num">{t("admin.members.goal")}</Table.Column>
                    <Table.Column>{t("admin.members.status")}</Table.Column>
                    <Table.Column className="tight" />
                  </Table.Header>
                  <Table.Body>
                    {collection.rows.map((member) => (
                      <Table.Row id={member.membershipId} key={member.membershipId}>
                        <Table.Cell>
                          <div className="row gap-5">
                            <Avatar name={displayName(member)} src={member.avatarUrl} size="sm" />
                            <div className="stack">
                              <Link to={`/members/${member.userId}`}>{displayName(member)}</Link>
                              <span className="t-caption faint">
                                {member.jobTitle ?? `@${member.username}`}
                              </span>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="t-mono muted">{member.employeeCode ?? "—"}</Table.Cell>
                        <Table.Cell>
                          <RoleBadge role={member.role} />
                        </Table.Cell>
                        <Table.Cell className="t-mono">
                          {member.payType === "MONTHLY"
                            ? t("payType.perMonth", {
                                amount: formatMoney(member.monthlySalary, member.currency, t),
                              })
                            : t("payType.perHour", {
                                amount: formatMoney(member.hourlyRate, member.currency, t),
                              })}
                        </Table.Cell>
                        <Table.Cell className="num t-mono muted">
                          {t("units.hoursShort", { value: member.monthlyGoalHours })}
                        </Table.Cell>
                        <Table.Cell>
                          {member.status === "ACTIVE" ? (
                            <Badge tone="success" dot>
                              {t("admin.members.active")}
                            </Badge>
                          ) : (
                            <Badge dot>{t("admin.members.suspended")}</Badge>
                          )}
                        </Table.Cell>
                        <Table.Cell className="tight">
                          <ActionMenu
                            label={t("admin.table.actionsFor", { name: displayName(member) })}
                            items={[
                              { label: t("common.edit"), onAction: () => startEdit(member) },
                              {
                                label: t("admin.members.resetPassword"),
                                onAction: () => {
                                  setResetting(member);
                                  setNextPassword("");
                                },
                              },
                            ]}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table>
            </TableScroll>
          ) : null}
          <Pagination {...collection} />
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

            <Field label={t("admin.members.employeeCode")}>
              <Input
                value={draft.employeeCode ?? ""}
                onChange={(event) => setDraft({ ...draft, employeeCode: event.target.value || null })}
                placeholder={t("admin.members.employeeCodePlaceholder")}
              />
            </Field>

            <div className="form-grid">
              <Field label={t("admin.members.role")}>
                <Select
                  value={draft.role}
                  disabled={!can("OWNER")}
                  onValueChange={(value) => setDraft({ ...draft, role: value as Draft["role"] })}
                >
                  <option value="MEMBER">{t("role.MEMBER")}</option>
                  <option value="MANAGER">{t("role.MANAGER")}</option>
                  <option value="OWNER">{t("role.OWNER")}</option>
                </Select>
              </Field>

              <Field label={t("admin.members.status")}>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setDraft({ ...draft, status: value as Draft["status"] })}
                >
                  <option value="ACTIVE">{t("admin.members.active")}</option>
                  <option value="SUSPENDED">{t("admin.members.suspended")}</option>
                </Select>
              </Field>
            </div>

            <Field label={t("admin.invites.payType")}>
              <Select
                value={draft.payType}
                onValueChange={(value) => setDraft({ ...draft, payType: value as Draft["payType"] })}
              >
                <option value="HOURLY">{t("payType.HOURLY")}</option>
                <option value="MONTHLY">{t("payType.MONTHLY")}</option>
              </Select>
            </Field>

            {draft.payType === "MONTHLY" ? (
              <Field
                label={t("admin.members.monthlySalary", { currency: currencyLabel(editing.currency, t) })}
              >
                <Input
                  type="number"
                  min={0}
                  value={draft.monthlySalary ?? 0}
                  onChange={(event) => setDraft({ ...draft, monthlySalary: Number(event.target.value) })}
                />
              </Field>
            ) : (
              <Field
                label={t("admin.members.hourlyRate", { currency: currencyLabel(editing.currency, t) })}
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
                onChange={(event) => setDraft({ ...draft, monthlyGoalHours: Number(event.target.value) })}
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
          <p className="t-body-sm muted">{t("admin.members.resetIntro")}</p>
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
