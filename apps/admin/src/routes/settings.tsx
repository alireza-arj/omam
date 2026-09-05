import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateOrganizationInputDto } from "@omam/contracts";
import { api, writeToken } from "../lib/api";
import { useSession } from "../lib/session";
import { errorMessage, useToast } from "../lib/ui";
import { PageHeader } from "./layout";
import { Button, Card, CardHeader, ErrorState, Field, Input, Loading, Select } from "../components/ui";

export function SettingsPage() {
  const { can, refresh } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<UpdateOrganizationInputDto>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

  const organization = useQuery({ queryKey: ["organization"], queryFn: api.organization });

  useEffect(() => {
    if (organization.data) {
      setDraft({
        name: organization.data.name,
        timezone: organization.data.timezone,
        calendar: organization.data.calendar,
        currency: organization.data.currency,
        defaultHourlyRate: organization.data.defaultHourlyRate,
        monthlyGoalHours: organization.data.monthlyGoalHours,
        requireApproval: organization.data.requireApproval,
      });
    }
  }, [organization.data]);

  const save = useMutation({
    mutationFn: () => api.updateOrganization(draft),
    onSuccess: async () => {
      toast("Team settings saved.", "success");
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      await refresh();
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(currentPassword, nextPassword),
    onSuccess: (result) => {
      // Changing a password revokes every other token, including this one.
      writeToken(result.token);
      toast("Password changed. Other devices were signed out.", "success");
      setCurrentPassword("");
      setNextPassword("");
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  return (
    <>
      <PageHeader title="Settings" subtitle="How the team is set up." />

      <div className="page-body">
        {organization.isPending ? <Loading /> : null}
        {organization.isError ? (
          <ErrorState
            message={errorMessage(organization.error)}
            onRetry={() => organization.refetch()}
          />
        ) : null}

        {organization.data ? (
          <Card flush>
            <CardHeader
              title="Team"
              subtitle={can("OWNER") ? undefined : "Only an owner can change these."}
              actions={
                can("OWNER") ? (
                  <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
                    Save changes
                  </Button>
                ) : null
              }
            />

            <div className="card-body stack gap-7" style={{ maxWidth: 560 }}>
              <Field label="Team name">
                <Input
                  value={draft.name ?? ""}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>

              <div className="row gap-6">
                <Field label="Calendar" hint="Decides where a month starts.">
                  <Select
                    value={draft.calendar}
                    disabled={!can("OWNER")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        calendar: event.target.value as UpdateOrganizationInputDto["calendar"],
                      })
                    }
                  >
                    <option value="JALALI">Jalali (Shamsi)</option>
                    <option value="GREGORIAN">Gregorian</option>
                  </Select>
                </Field>

                <Field label="Currency">
                  <Select
                    value={draft.currency}
                    disabled={!can("OWNER")}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        currency: event.target.value as UpdateOrganizationInputDto["currency"],
                      })
                    }
                  >
                    <option value="IRR">IRR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </Field>
              </div>

              <Field
                label="Timezone"
                hint="Run the API with TZ set to this, so a month ends when the team's day does."
              >
                <Input
                  value={draft.timezone ?? ""}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                />
              </Field>

              <div className="row gap-6">
                <Field label="Default hourly rate" hint="Used for a new invite left at zero.">
                  <Input
                    type="number"
                    min={0}
                    disabled={!can("OWNER")}
                    value={draft.defaultHourlyRate ?? 0}
                    onChange={(event) =>
                      setDraft({ ...draft, defaultHourlyRate: Number(event.target.value) })
                    }
                  />
                </Field>

                <Field label="Monthly goal hours">
                  <Input
                    type="number"
                    min={0}
                    max={744}
                    disabled={!can("OWNER")}
                    value={draft.monthlyGoalHours ?? 0}
                    onChange={(event) =>
                      setDraft({ ...draft, monthlyGoalHours: Number(event.target.value) })
                    }
                  />
                </Field>
              </div>

              <Field
                label="Approval"
                hint="With approval off, submitted time counts towards pay the moment it is logged."
              >
                <Select
                  value={draft.requireApproval ? "yes" : "no"}
                  disabled={!can("OWNER")}
                  onChange={(event) =>
                    setDraft({ ...draft, requireApproval: event.target.value === "yes" })
                  }
                >
                  <option value="yes">A manager reviews every entry</option>
                  <option value="no">Approve automatically</option>
                </Select>
              </Field>
            </div>
          </Card>
        ) : null}

        <Card flush>
          <CardHeader title="Your password" />
          <div className="card-body stack gap-7" style={{ maxWidth: 420 }}>
            <Field label="Current password">
              <Input
                type="password"
                value={currentPassword}
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>

            <Field label="New password" hint="At least 6 characters.">
              <Input
                type="password"
                value={nextPassword}
                autoComplete="new-password"
                onChange={(event) => setNextPassword(event.target.value)}
              />
            </Field>

            <div>
              <Button
                variant="primary"
                loading={changePassword.isPending}
                disabled={currentPassword.length < 6 || nextPassword.length < 6}
                onClick={() => changePassword.mutate()}
              >
                Change password
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
