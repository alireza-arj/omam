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
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createMemberInputSchema } from "@omam/contracts";
import type { CreateMemberInputDto, MemberDto, UpdateMemberInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError, type TranslationKey } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { displayName } from "../lib/format";
import { PageHeader } from "./layout";

type Draft = UpdateMemberInputDto;

type CreatingTarget = { organizationId: string; teamName: string };

type NewMemberDraft = {
  username: string;
  password: string;
  nickname: string;
};

type NewMemberField = "username" | "password" | "nickname";

const EMPTY_NEW_MEMBER: NewMemberDraft = { username: "", password: "", nickname: "" };

const NEW_MEMBER_FIELD_ERROR: Record<NewMemberField, TranslationKey> = {
  username: "admin.members.createUsernameInvalid",
  password: "admin.members.createPasswordInvalid",
  nickname: "admin.members.createNicknameInvalid",
};

export function MembersPage() {
  const navigate = useNavigate();
  const { can, membership, isSwitching } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [editing, setEditing] = useState<MemberDto | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [resetting, setResetting] = useState<MemberDto | null>(null);
  const [nextPassword, setNextPassword] = useState("");
  const [creating, setCreating] = useState<CreatingTarget | null>(null);
  const [newMember, setNewMember] = useState<NewMemberDraft>(EMPTY_NEW_MEMBER);
  const [newRole, setNewRole] = useState<CreateMemberInputDto["role"]>("MEMBER");
  const [formErrors, setFormErrors] = useState<Partial<Record<NewMemberField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const createFormId = useId();

  const members = useQuery({ queryKey: ["members"], queryFn: api.members });

  const teamChanged = Boolean(
    creating && membership && creating.organizationId !== membership.organizationId,
  );

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

  const createMember = useMutation({
    mutationFn: (input: CreateMemberInputDto) => api.createMember(input),
    onSuccess: () => {
      toast(t("admin.members.created"), "success");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
      queryClient.invalidateQueries({ queryKey: ["member-report"] });
      resetCreateForm();
    },
    onError: (error) => {
      const code = error instanceof Error && "code" in error ? error.code : null;

      if (code === "USERNAME_TAKEN") {
        setFormErrors((current) => ({ ...current, username: translateError(error, t) }));
        setFormError(null);
        return;
      }

      setFormError(translateError(error, t));
    },
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
      monthlyGoalHours: member.monthlyGoalHours,
    });
  }

  function resetCreateForm() {
    setCreating(null);
    setNewMember(EMPTY_NEW_MEMBER);
    setNewRole("MEMBER");
    setFormErrors({});
    setFormError(null);
  }

  function startCreate() {
    if (!membership) return;
    createMember.reset();
    setCreating({ organizationId: membership.organizationId, teamName: membership.organizationName });
    setNewMember(EMPTY_NEW_MEMBER);
    setNewRole("MEMBER");
    setFormErrors({});
    setFormError(null);
  }

  function closeCreate() {
    if (createMember.isPending) return;
    resetCreateForm();
  }

  function submitCreate() {
    if (!creating || createMember.isPending || isSwitching) return;

    const parsed = createMemberInputSchema.safeParse({
      organizationId: creating.organizationId,
      username: newMember.username,
      password: newMember.password,
      nickname: newMember.nickname.trim() || null,
      role: newRole,
    });

    if (!parsed.success) {
      const nextErrors: Partial<Record<NewMemberField, string>> = {};

      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (field === "username" || field === "password" || field === "nickname") {
          nextErrors[field] ??= t(NEW_MEMBER_FIELD_ERROR[field]);
        }
      }

      setFormErrors(nextErrors);
      setFormError(null);
      return;
    }

    setFormErrors({});
    setFormError(null);
    createMember.mutate(parsed.data);
  }

  const collection = useCollection(members.data?.members ?? [], (row) =>
    [displayName(row), row.username, row.employeeCode, row.jobTitle].join(" "),
  );

  return (
    <>
      <PageHeader
        title={t("workspace.members")}
        subtitle={t("workspace.membersHint")}
        actions={
          <>
            <ButtonLink to="/teams/invites">{t("admin.members.inviteSomeone")}</ButtonLink>
            <Button variant="primary" onClick={startCreate} disabled={!membership || isSwitching}>
              {t("admin.members.createUser")}
            </Button>
          </>
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
                    <Table.Column>{t("admin.members.jobTitle")}</Table.Column>
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
                          {member.jobTitle ?? t("common.none")}
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
                              { label: t("workspace.viewProfile"), onAction: () => { navigate(`/members/${member.userId}`); } },
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

      {creating ? (
        <Modal
          title={t("admin.members.createTitle")}
          onClose={closeCreate}
          footer={
            <>
              <Button variant="ghost" onClick={closeCreate} disabled={createMember.isPending}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                type="submit"
                form={createFormId}
                loading={createMember.isPending}
                disabled={teamChanged || isSwitching}
              >
                {t("admin.members.createAction")}
              </Button>
            </>
          }
        >
          <form
            id={createFormId}
            className="stack gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              submitCreate();
            }}
          >
            <p className="t-body-sm muted">
              {t("admin.members.createIntro", { team: creating.teamName })}
            </p>
            {teamChanged ? (
              <p className="t-body-sm" role="alert">{t("admin.members.teamChanged")}</p>
            ) : null}

            <Field label={t("admin.members.createNickname")} error={formErrors.nickname}>
              <Input
                value={newMember.nickname}
                onChange={(event) => setNewMember({ ...newMember, nickname: event.target.value })}
                placeholder={t("admin.members.createNicknamePlaceholder")}
                autoComplete="off"
                maxLength={80}
                disabled={createMember.isPending}
              />
            </Field>

            <Field
              label={t("admin.members.createUsername")}
              hint={t("admin.members.createUsernameHint")}
              error={formErrors.username}
            >
              <Input
                value={newMember.username}
                onChange={(event) => setNewMember({ ...newMember, username: event.target.value })}
                placeholder={t("admin.members.createUsernamePlaceholder")}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={32}
                disabled={createMember.isPending}
              />
            </Field>

            <Field label={t("admin.members.createPassword")} error={formErrors.password}>
              <Input
                type="password"
                value={newMember.password}
                onChange={(event) => setNewMember({ ...newMember, password: event.target.value })}
                placeholder={t("admin.members.createPasswordPlaceholder")}
                autoComplete="new-password"
                maxLength={72}
                disabled={createMember.isPending}
              />
            </Field>

            <Field label={t("admin.members.role")}>
              <Select
                value={newRole}
                disabled={!can("OWNER") || createMember.isPending}
                onValueChange={(value) => setNewRole(value as CreateMemberInputDto["role"])}
              >
                <option value="MEMBER">{t("role.MEMBER")}</option>
                <option value="MANAGER">{t("role.MANAGER")}</option>
              </Select>
            </Field>

            {formError ? (
              <p className="t-body-sm" role="alert">{formError}</p>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </>
  );
}
