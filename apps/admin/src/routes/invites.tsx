import {
  ActionMenu,
  Badge,
  Button,
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
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createInviteInputSchema } from "@omam/contracts";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { formatDate } from "../lib/format";
import { PageHeader } from "./layout";

export function InvitesPage() {
  const { calendar, can, membership } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });
  const eligibleMembers = (members.data?.members ?? []).filter((member) => member.status === "ACTIVE" && (can("OWNER") || member.role === "MEMBER"));
  useEffect(() => { setCreating(false); setCreatedCode(null); setUserId(""); }, [membership?.organizationId]);
  useEffect(() => {
    const requested = searchParams.get("userId");
    if (requested) { setUserId(requested); setCreating(true); }
  }, [searchParams]);

  const invites = useQuery({ queryKey: ["invites"], queryFn: api.invites });

  const create = useMutation({
    mutationFn: () => api.createInvite(createInviteInputSchema.parse({ userId, expiresInDays })),
    onSuccess: (invite) => {
      setCreating(false);
      setCreatedCode(invite.code);
      setSearchParams({});
      setUserId("");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
  });

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
    }
  }

  function state(invite: { acceptedAt: string | null; revokedAt: string | null; expiresAt: string }) {
    if (invite.acceptedAt) return { tone: "success" as const, key: "admin.invites.used" as const };
    if (invite.revokedAt) return { tone: "neutral" as const, key: "admin.invites.revoked" as const };
    if (new Date(invite.expiresAt).getTime() < Date.now())
      return { tone: "neutral" as const, key: "admin.invites.expired" as const };

    return { tone: "info" as const, key: "admin.invites.open" as const };
  }

  const collection = useCollection(invites.data?.invites ?? [], (row) =>
    [row.code, row.label, row.acceptedByName].join(" "),
  );

  return (
    <>
      <PageHeader
        title={t("workspace.inviteMembers")}
        subtitle={t("workspace.inviteHint")}
        actions={
          <Button variant="primary" onClick={() => { setUserId(""); setCreating(true); }}>
            {t("admin.invites.newInvite")}
          </Button>
        }
      />

      <div className="page-body">
        <Card flush>
          <CollectionToolbar search={collection.search} onSearch={collection.setSearch} />
          {collection.search && !collection.total && invites.data ? (
            <EmptyState title={t("admin.table.noResults")} hint={t("admin.table.searchHint")} />
          ) : null}

          {invites.isPending ? <Loading /> : null}
          {invites.isError ? (
            <ErrorState message={translateError(invites.error, t)} onRetry={() => invites.refetch()} />
          ) : null}

          {collection.total > 0 ? (
            <TableScroll>
              <Table>
                <Table.Content aria-label={t("common.records")} className="omam-data">
                  <Table.Header>
                    <Table.Column isRowHeader>{t("admin.invites.code")}</Table.Column>
                    <Table.Column>{t("admin.invites.for")}</Table.Column>
                    <Table.Column>{t("admin.invites.role")}</Table.Column>
                    <Table.Column>{t("admin.invites.expires")}</Table.Column>
                    <Table.Column>{t("admin.invites.status")}</Table.Column>
                    <Table.Column className="tight" />
                  </Table.Header>
                  <Table.Body>
                    {collection.rows.map((invite) => {
                      const status = state(invite);
                      const open = status.key === "admin.invites.open";

                      return (
                        <Table.Row id={invite.id} key={invite.id}>
                          <Table.Cell>
                            <span className="code">{invite.code}</span>
                          </Table.Cell>
                          <Table.Cell className="muted">
                            {invite.label ?? invite.acceptedByName ?? <span className="faint">—</span>}
                          </Table.Cell>
                          <Table.Cell>
                            <RoleBadge role={invite.role} />
                          </Table.Cell>

                          <Table.Cell className="muted">
                            {formatDate(invite.expiresAt, calendar, language)}
                          </Table.Cell>
                          <Table.Cell>
                            <Badge tone={status.tone} dot={open}>
                              {t(status.key)}
                            </Badge>
                          </Table.Cell>
                          <Table.Cell className="tight">
                            {open ? (
                              <ActionMenu
                                label={t("admin.table.actionsFor", { name: invite.label ?? invite.code })}
                                disabled={revoke.isPending}
                                items={[
                                  {
                                    label: t("common.copy"),
                                    onAction: () => {
                                      void copy(invite.code);
                                    },
                                  },
                                  {
                                    label: t("admin.invites.revoke"),
                                    onAction: () => revoke.mutate(invite.id),
                                  },
                                ]}
                              />
                            ) : null}
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Content>
              </Table>
            </TableScroll>
          ) : invites.data && !collection.search ? (
            <EmptyState title={t("admin.invites.empty")} hint={t("admin.invites.emptyHint")} />
          ) : null}
          <Pagination {...collection} />
        </Card>
      </div>

      {createdCode ? <Modal title={t("admin.invites.newInvite")} onClose={() => setCreatedCode(null)} footer={<Button variant="primary" onClick={() => { void copy(createdCode); }}>{t("common.copy")}</Button>}>
        <p className="code" dir="ltr">{createdCode}</p>
        <p className="t-body-sm muted">{t("admin.invites.codeHint")}</p>
      </Modal> : null}
      {creating ? (
        <Modal
          title={t("admin.invites.newInvite")}
          onClose={() => { if (!create.isPending) { setCreating(false); setSearchParams({}); } }}
          footer={
            <>
              <Button variant="ghost" onClick={() => { setCreating(false); setSearchParams({}); }} disabled={create.isPending}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" loading={create.isPending} disabled={!eligibleMembers.some((member) => member.userId === userId) || !Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365} onClick={() => create.mutate()}>
                {t("admin.invites.create")}
              </Button>
            </>
          }
        >
          <Field label={t("admin.invites.whoFor")} hint={t("admin.invites.whoForHint")}>
            <Select value={userId} disabled={create.isPending} onValueChange={setUserId}>
              <option value="">{t("admin.invites.selectMember")}</option>
              {eligibleMembers.map((member) => <option key={member.userId} value={member.userId}>{member.username}</option>)}
            </Select>
          </Field>
          {members.isError ? <ErrorState message={translateError(members.error, t)} onRetry={() => members.refetch()} /> : null}
          {!members.isPending && !eligibleMembers.length ? <EmptyState title={t("admin.invites.noMembers")} hint={t("admin.invites.noMembersHint")} /> : null}

          <Field label={t("admin.invites.expiresIn")}>
            <Input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              disabled={create.isPending}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
