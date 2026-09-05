import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LANGUAGES, LANGUAGE_LABEL } from "@omam/i18n";
import type { UpdateOrganizationInputDto } from "@omam/contracts";
import { api, writeToken } from "../lib/api";
import { useSession } from "../lib/session";
import { translateError } from "@omam/i18n";
import { useLanguage } from "../lib/i18n";
import { useToast } from "../lib/ui";
import { PageHeader } from "./layout";
import { Button, Card, CardHeader, ErrorState, Field, Input, Loading, Select } from "../components/ui";

export function SettingsPage() {
  const { can, refresh } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { language, setLanguage, t } = useLanguage();

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
      toast(t("admin.settings.saved"), "success");
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      await refresh();
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  const changePassword = useMutation({
    mutationFn: () => api.changePassword(currentPassword, nextPassword),
    onSuccess: (result) => {
      // Changing a password revokes every other token, including this one.
      writeToken(result.token);
      toast(t("admin.settings.changed"), "success");
      setCurrentPassword("");
      setNextPassword("");
    },
    onError: (error) => toast(translateError(error, t), "error"),
  });

  return (
    <>
      <PageHeader title={t("admin.nav.settings")} subtitle={t("admin.settings.subtitle")} />

      <div className="page-body">
        {organization.isPending ? <Loading /> : null}
        {organization.isError ? (
          <ErrorState
            message={translateError(organization.error, t)}
            onRetry={() => organization.refetch()}
          />
        ) : null}

        {organization.data ? (
          <Card flush>
            <CardHeader
              title={t("admin.settings.team")}
              subtitle={can("OWNER") ? undefined : t("admin.settings.ownerOnly")}
              actions={
                can("OWNER") ? (
                  <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
                    {t("admin.settings.saveChanges")}
                  </Button>
                ) : null
              }
            />

            <div className="card-body stack gap-7" style={{ maxWidth: 560 }}>
              <Field label={t("admin.settings.teamName")}>
                <Input
                  value={draft.name ?? ""}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>

              <div className="row gap-6">
                <Field label={t("admin.settings.calendar")} hint={t("admin.settings.calendarHint")}>
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
                    <option value="JALALI">{t("admin.settings.jalali")}</option>
                    <option value="GREGORIAN">{t("admin.settings.gregorian")}</option>
                  </Select>
                </Field>

                <Field label={t("admin.settings.currency")}>
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
                label={t("admin.settings.timezone")}
                hint={t("admin.settings.timezoneHint")}
              >
                <Input
                  value={draft.timezone ?? ""}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                />
              </Field>

              <div className="row gap-6">
                <Field label={t("admin.settings.defaultRate")} hint={t("admin.settings.defaultRateHint")}>
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

                <Field label={t("admin.settings.monthlyGoalHours")}>
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
                label={t("admin.settings.approval")}
                hint={t("admin.settings.approvalHint")}
              >
                <Select
                  value={draft.requireApproval ? "yes" : "no"}
                  disabled={!can("OWNER")}
                  onChange={(event) =>
                    setDraft({ ...draft, requireApproval: event.target.value === "yes" })
                  }
                >
                  <option value="yes">{t("admin.settings.approvalOn")}</option>
                  <option value="no">{t("admin.settings.approvalOff")}</option>
                </Select>
              </Field>
            </div>
          </Card>
        ) : null}

        <Card flush>
          <CardHeader title={t("language.label")} subtitle={t("language.hint")} />
          <div className="card-body" style={{ maxWidth: 420 }}>
            <Field label={t("language.label")}>
              <Select
                value={language}
                onChange={(event) => setLanguage(event.target.value as typeof language)}
              >
                {LANGUAGES.map((value) => (
                  <option key={value} value={value}>
                    {LANGUAGE_LABEL[value]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card flush>
          <CardHeader title={t("admin.settings.yourPassword")} />
          <div className="card-body stack gap-7" style={{ maxWidth: 420 }}>
            <Field label={t("admin.settings.currentPassword")}>
              <Input
                type="password"
                value={currentPassword}
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>

            <Field label={t("admin.settings.newPassword")} hint={t("admin.settings.newPasswordHint")}>
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
                {t("admin.settings.changePassword")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
