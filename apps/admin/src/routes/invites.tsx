import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInviteInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage, useToast } from "../lib/ui";
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

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<CreateInviteInputDto>(EMPTY);

  const invites = useQuery({ queryKey: ["invites"], queryFn: api.invites });

  const create = useMutation({
    mutationFn: () => api.createInvite(draft),
    onSuccess: (invite) => {
      toast(`Invite ${invite.code} created.`, "success");
      setCreating(false);
      setDraft(EMPTY);
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeInvite(id),
    onSuccess: () => {
      toast("Invite revoked.", "success");
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copied.", "success");
    } catch {
      toast("Copy the code manually.", "error");
    }
  }

  function state(invite: { acceptedAt: string | null; revokedAt: string | null; expiresAt: string }) {
    if (invite.acceptedAt) return { tone: "success" as const, label: "Used" };
    if (invite.revokedAt) return { tone: "neutral" as const, label: "Revoked" };
    if (new Date(invite.expiresAt).getTime() < Date.now())
      return { tone: "neutral" as const, label: "Expired" };

    return { tone: "info" as const, label: "Open" };
  }

  return (
    <>
      <PageHeader
        title="Invites"
        subtitle="Send someone a code, they sign up in the app and land on your team."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New invite
          </Button>
        }
      />

      <div className="page-body">
        <Card flush>
          <CardHeader title={`${invites.data?.invites.length ?? 0} invites`} />

          {invites.isPending ? <Loading /> : null}
          {invites.isError ? (
            <ErrorState message={errorMessage(invites.error)} onRetry={() => invites.refetch()} />
          ) : null}

          {invites.data?.invites.length ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>For</th>
                    <th>Role</th>
                    <th>Pay</th>
                    <th>Expires</th>
                    <th>Status</th>
                    <th className="tight" />
                  </tr>
                </thead>
                <tbody>
                  {invites.data.invites.map((invite) => {
                    const status = state(invite);
                    const open = status.label === "Open";

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
                            ? `${formatMoney(invite.monthlySalary, membership?.currency ?? "IRR")} / month`
                            : `${formatMoney(invite.hourlyRate, membership?.currency ?? "IRR")} / hour`}
                        </td>
                        <td className="muted">{formatDate(invite.expiresAt, calendar)}</td>
                        <td>
                          <Badge tone={status.tone} dot={open}>
                            {status.label}
                          </Badge>
                        </td>
                        <td className="tight">
                          <div className="row gap-3 end">
                            {open ? (
                              <>
                                <Button size="sm" onClick={() => copy(invite.code)}>
                                  Copy
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => revoke.mutate(invite.id)}
                                >
                                  Revoke
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
              title="No invites yet"
              hint="An invite is the only way onto the team, so nobody can sign themselves up."
              action={
                <Button variant="primary" onClick={() => setCreating(true)}>
                  New invite
                </Button>
              }
            />
          ) : null}
        </Card>
      </div>

      {creating ? (
        <Modal
          title="New invite"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
                Create invite
              </Button>
            </>
          }
        >
          <Field label="Who is this for" hint="Just a note for you — they never see it.">
            <Input
              value={draft.label ?? ""}
              onChange={(event) => setDraft({ ...draft, label: event.target.value || null })}
              placeholder="Sara, backend"
              autoFocus
            />
          </Field>

          <div className="row gap-6">
            <Field label="Role">
              <Select
                value={draft.role}
                disabled={!can("OWNER")}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value as CreateInviteInputDto["role"] })
                }
              >
                <option value="MEMBER">Member</option>
                <option value="MANAGER">Manager</option>
                <option value="OWNER">Owner</option>
              </Select>
            </Field>

            <Field label="Pay type">
              <Select
                value={draft.payType}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    payType: event.target.value as CreateInviteInputDto["payType"],
                  })
                }
              >
                <option value="HOURLY">Hourly</option>
                <option value="MONTHLY">Fixed monthly</option>
              </Select>
            </Field>
          </div>

          {draft.payType === "MONTHLY" ? (
            <Field label={`Monthly salary (${membership?.currency ?? "IRR"})`}>
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
              label={`Hourly rate (${membership?.currency ?? "IRR"})`}
              hint="Leave at zero to use the team default."
            >
              <Input
                type="number"
                min={0}
                value={draft.hourlyRate}
                onChange={(event) => setDraft({ ...draft, hourlyRate: Number(event.target.value) })}
              />
            </Field>
          )}

          <Field label="Expires in (days)">
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
