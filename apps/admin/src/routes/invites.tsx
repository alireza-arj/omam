import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInviteInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { formatDate, formatMoney } from "../lib/format";
import { PageHeader } from "./layout";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  RoleBadge,
  Select,
} from "../components/ui";

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

  return (
    <>
      <PageHeader
        title={t("admin.nav.invites")}
        subtitle={t("admin.invites.subtitle")}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t("admin.invites.newInvite")}
          </Button>
        }
      />

      <div className="page-body">
        <Card flush>
          <CardHeader title={t("admin.invites.count", { count: invites.data?.invites.length ?? 0 })} />

          {invites.isPending ? <Loading /> : null}
          {invites.isError ? (
            <ErrorState message={translateError(invites.error, t)} onRetry={() => invites.refetch()} />
          ) : null}

          {invites.data?.invites.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("admin.invites.code")}</th>
                    <th>{t("admin.invites.for")}</th>
                    <th>{t("admin.invites.role")}</th>
                    <th>{t("admin.invites.pay")}</th>
                    <th>{t("admin.invites.expires")}</th>
                    <th>{t("admin.invites.status")}</th>
                    <th className="tight" />
                  </tr>
                </thead>
                <tbody>
                  {invites.data.invites.map((invite) => {
                    const status = state(invite);
                    const open = status.key === "admin.invites.open";

                    return (
                      <tr key={invite.id}>
                        <td>
                          <span className="code">{invite.code}</span>
                        </td>
                        <td className="muted">
                          {invite.label ?? invite.acceptedByName ?? <span className="faint">—</span>}
                        </td>
                        <td>
                          <RoleBadge role={invite.role} />
                        </td>
                        <td className="t-mono muted">
                          {invite.payType === "MONTHLY"
                            ? t("payType.perMonth", {
                                amount: formatMoney(invite.monthlySalary, membership?.currency ?? "IRR", t),
                              })
                            : t("payType.perHour", {
                                amount: formatMoney(invite.hourlyRate, membership?.currency ?? "IRR", t),
                              })}
                        </td>
                        <td className="muted">{formatDate(invite.expiresAt, calendar, language)}</td>
                        <td>
                          <Badge tone={status.tone} dot={open}>
                            {t(status.key)}
                          </Badge>
                        </td>
                        <td className="tight">
                          <div className="row gap-3 end">
                            {open ? (
                              <>
                                <Button size="sm" onClick={() => copy(invite.code)}>
                                  {t("common.copy")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => revoke.mutate(invite.id)}
                                >
                                  {t("admin.invites.revoke")}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : invites.data ? (
            <EmptyState
              title={t("admin.invites.empty")}
              hint={t("admin.invites.emptyHint")}
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  {t("admin.invites.newInvite")}
                </Button>
              }
            />
          ) : null}
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

          <div className="row gap-6">
            <Field label={t("admin.invites.role")}>
              <Select
                value={draft.role}
                disabled={!can("OWNER")}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value as CreateInviteInputDto["role"] })
                }
              >
                <option value="MEMBER">{t("role.MEMBER")}</option>
                <option value="MANAGER">{t("role.MANAGER")}</option>
                <option value="OWNER">{t("role.OWNER")}</option>
              </Select>
            </Field>

            <Field label={t("admin.invites.payType")}>
              <Select
                value={draft.payType}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    payType: event.target.value as CreateInviteInputDto["payType"],
                  })
                }
              >
                <option value="HOURLY">{t("payType.HOURLY")}</option>
                <option value="MONTHLY">{t("payType.MONTHLY")}</option>
              </Select>
            </Field>
          </div>

          {draft.payType === "MONTHLY" ? (
            <Field label={t("admin.invites.monthlySalary", { currency: membership?.currency ?? "IRR" })}>
              <Input
                type="number"
                min={0}
                value={draft.monthlySalary}
                onChange={(event) =>
                  setDraft({ ...draft, monthlySalary: Number(event.target.value) })
                }
              />
            </Field>
          ) : (
            <Field
              label={t("admin.invites.hourlyRate", { currency: membership?.currency ?? "IRR" })}
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
              onChange={(event) =>
                setDraft({ ...draft, expiresInDays: Number(event.target.value) })
              }
            />
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
