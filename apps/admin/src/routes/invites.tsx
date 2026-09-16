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
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInviteInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { currencyLabel, formatDate, formatMoney } from "../lib/format";
import { PageHeader } from "./layout";

const EMPTY: CreateInviteInputDto = {
  role: "MEMBER",
  label: null,
  payType: "HOURLY",
  hourlyRate: 0,
  monthlySalary: 0,
  expiresInDays: 14,
};

export function InvitesPage() {
  const { calendar, can, membership } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { language, t } = useLanguage();

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreateInviteInputDto>(EMPTY);

  const invites = useQuery({ queryKey: ["invites"], queryFn: api.invites });

  const create = useMutation({
    mutationFn: () => api.createInvite(draft),
    onSuccess: (invite) => {
      toast(t("admin.invites.created", { code: invite.code }), "success");
      setCreating(false);
      setDraft(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeInvite(id),
    onSuccess: () => {
      toast(t("admin.invites.revokedToast"), "success");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast(t("admin.invites.copied"), "success");
    } catch {
      toast(t("admin.invites.copyManually"), "error");
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
        title={t("admin.nav.invites")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
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
                    <Table.Column>{t("admin.invites.pay")}</Table.Column>
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
                          <Table.Cell className="t-mono muted">
                            {invite.payType === "MONTHLY"
                              ? t("payType.perMonth", {
                                  amount: formatMoney(invite.monthlySalary, membership?.currency ?? "IRR", t),
                                })
                              : t("payType.perHour", {
                                  amount: formatMoney(invite.hourlyRate, membership?.currency ?? "IRR", t),
                                })}
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

      {creating ? (
        <Modal
          title={t("admin.invites.newInvite")}
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
                {t("admin.invites.create")}
              </Button>
            </>
          }
        >
          <Field label={t("admin.invites.whoFor")} hint={t("admin.invites.whoForHint")}>
            <Input
              value={draft.label ?? ""}
              onChange={(event) => setDraft({ ...draft, label: event.target.value || null })}
              placeholder={t("admin.invites.whoForPlaceholder")}
              autoFocus
            />
          </Field>

          <div className="form-grid">
            <Field label={t("admin.invites.role")}>
              <Select
                value={draft.role}
                disabled={!can("OWNER")}
                onValueChange={(value) => setDraft({ ...draft, role: value as CreateInviteInputDto["role"] })}
              >
                <option value="MEMBER">{t("role.MEMBER")}</option>
                <option value="MANAGER">{t("role.MANAGER")}</option>
                <option value="OWNER">{t("role.OWNER")}</option>
              </Select>
            </Field>

            <Field label={t("admin.invites.payType")}>
              <Select
                value={draft.payType}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    payType: value as CreateInviteInputDto["payType"],
                  })
                }
              >
                <option value="HOURLY">{t("payType.HOURLY")}</option>
                <option value="MONTHLY">{t("payType.MONTHLY")}</option>
              </Select>
            </Field>
          </div>

          {draft.payType === "MONTHLY" ? (
            <Field
              label={t("admin.invites.monthlySalary", {
                currency: currencyLabel(membership?.currency ?? "IRR", t),
              })}
            >
              <Input
                type="number"
                min={0}
                value={draft.monthlySalary}
                onChange={(event) => setDraft({ ...draft, monthlySalary: Number(event.target.value) })}
              />
            </Field>
          ) : (
            <Field
              label={t("admin.invites.hourlyRate", {
                currency: currencyLabel(membership?.currency ?? "IRR", t),
              })}
              hint={t("admin.invites.hourlyRateHint")}
            >
              <Input
                type="number"
                min={0}
                value={draft.hourlyRate}
                onChange={(event) => setDraft({ ...draft, hourlyRate: Number(event.target.value) })}
              />
            </Field>
          )}

          <Field label={t("admin.invites.expiresIn")}>
            <Input
              type="number"
              min={1}
              max={365}
              value={draft.expiresInDays}
              onChange={(event) => setDraft({ ...draft, expiresInDays: Number(event.target.value) })}
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
