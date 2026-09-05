import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemberDto, UpdateMemberInputDto } from "@omam/contracts";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage, useToast } from "../lib/ui";
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

  const [editing, setEditing] = useState<MemberDto | null>(null);
  const [draft, setDraft] = useState<Draft>({});
  const [resetting, setResetting] = useState<MemberDto | null>(null);
  const [nextPassword, setNextPassword] = useState("");

  const members = useQuery({ queryKey: ["members"], queryFn: api.members });

  const save = useMutation({
    mutationFn: (input: { membershipId: string; body: Draft }) =>
      api.updateMember(input.membershipId, input.body),
    onSuccess: () => {
      toast("Member updated.", "success");
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
      setEditing(null);
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const resetPassword = useMutation({
    mutationFn: (input: { membershipId: string; password: string }) =>
      api.resetMemberPassword(input.membershipId, input.password),
    onSuccess: () => {
      toast("Password reset. Every device they signed in on is signed out.", "success");
      setResetting(null);
      setNextPassword("");
    },
    onError: (error) => toast(errorMessage(error), "error"),
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
        title="Members"
        subtitle="Roles and pay. What is set here is what payroll uses."
        actions={
          <Link className="btn primary" to="/invites">
            Invite someone
          </Link>
        }
      />

      <div className="page-body">
        <Card flush>
          <CardHeader title={`${members.data?.members.length ?? 0} on the team`} />

          {members.isPending ? <Loading /> : null}
          {members.isError ? (
            <ErrorState message={errorMessage(members.error)} onRetry={() => members.refetch()} />
          ) : null}

          {members.data ? (
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Code</th>
                    <th>Role</th>
                    <th>Pay</th>
                    <th className="num">Goal</th>
                    <th>Status</th>
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
                          ? `${formatMoney(member.monthlySalary, member.currency)} / month`
                          : `${formatMoney(member.hourlyRate, member.currency)} / hour`}
                      </td>
                      <td className="num t-mono muted">{member.monthlyGoalHours}h</td>
                      <td>
                        {member.status === "ACTIVE" ? (
                          <Badge tone="success" dot>
                            Active
                          </Badge>
                        ) : (
                          <Badge dot>Suspended</Badge>
                        )}
                      </td>
                      <td className="tight">
                        <div className="row gap-3 end">
                          <Button size="sm" onClick={() => startEdit(member)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setResetting(member);
                              setNextPassword("");
                            }}
                          >
                            Reset password
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
          title={`Edit ${displayName(editing)}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={save.isPending}
                onClick={() => save.mutate({ membershipId: editing.membershipId, body: draft })}
              >
                Save changes
              </Button>
            </>
          }
        >
          <div className="stack gap-6">
            <Field label="Job title">
              <Input
                value={draft.jobTitle ?? ""}
                onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value || null })}
                placeholder="Backend engineer"
              />
            </Field>

            <Field label="Employee code" hint="Shows up in the payroll export.">
              <Input
                value={draft.employeeCode ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, employeeCode: event.target.value || null })
                }
                placeholder="004"
              />
            </Field>

            <div className="row gap-6">
              <Field label="Role">
                <Select
                  value={draft.role}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as Draft["role"] })}
                >
                  <option value="MEMBER">Member</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </Select>
              </Field>

              <Field label="Status">
                <Select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as Draft["status"] })
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </Select>
              </Field>
            </div>

            <Field label="Pay type">
              <Select
                value={draft.payType}
                onChange={(event) =>
                  setDraft({ ...draft, payType: event.target.value as Draft["payType"] })
                }
              >
                <option value="HOURLY">Hourly</option>
                <option value="MONTHLY">Fixed monthly</option>
              </Select>
            </Field>

            {draft.payType === "MONTHLY" ? (
              <Field label={`Monthly salary (${editing.currency})`}>
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
                label={`Hourly rate (${editing.currency})`}
                hint="Payroll multiplies this by approved hours."
              >
                <Input
                  type="number"
                  min={0}
                  value={draft.hourlyRate ?? 0}
                  onChange={(event) => setDraft({ ...draft, hourlyRate: Number(event.target.value) })}
                />
              </Field>
            )}

            <Field label="Monthly goal hours">
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
          title={`Reset password for ${displayName(resetting)}`}
          onClose={() => setResetting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setResetting(null)}>
                Cancel
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
                Reset password
              </Button>
            </>
          }
        >
          <p className="t-body-sm muted">
            Give them the new password yourself, and ask them to change it. This signs them out of
            every device.
          </p>
          <Field label="New password" hint="At least 6 characters.">
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
