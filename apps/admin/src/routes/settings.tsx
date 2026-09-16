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
      <PageHeader title={t("admin.nav.settings")} />

      <div className="page-body settings-body">
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

            <div className="card-body stack gap-7">
              <Field label={t("admin.settings.teamName")}>
                <Input
                  value={draft.name ?? ""}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
              </Field>

              <div className="form-grid">
                <Field label={t("admin.settings.calendar")} hint={t("admin.settings.calendarHint")}>
                  <Select
                    value={draft.calendar}
                    disabled={!can("OWNER")}
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        calendar: value as UpdateOrganizationInputDto["calendar"],
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
                    onValueChange={(value) =>
                      setDraft({
                        ...draft,
                        currency: value as UpdateOrganizationInputDto["currency"],
                      })
                    }
                  >
                    <option value="IRR">{t("units.toman")}</option>
                    <option value="USD">{t("admin.currency.USD")}</option>
                    <option value="EUR">{t("admin.currency.EUR")}</option>
                  </Select>
                </Field>
              </div>

              <Field label={t("admin.settings.timezone")} hint={t("admin.settings.timezoneHint")}>
                <Input
                  dir="ltr"
                  value={draft.timezone ?? ""}
                  disabled={!can("OWNER")}
                  onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                />
              </Field>

              <div className="form-grid">
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
                    onChange={(event) => setDraft({ ...draft, monthlyGoalHours: Number(event.target.value) })}
                  />
                </Field>
              </div>

            </div>
          </Card>
        ) : null}

        <Card>
          <Field label={t("language.label")}>
            <Select
              aria-label={t("language.label")}
              value={language}
              onValueChange={(value) => setLanguage(value as typeof language)}
            >
              {LANGUAGES.map((value) => (
                <option key={value} value={value}>
                  {LANGUAGE_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        <details className="settings-disclosure">
          <summary>{t("admin.settings.yourPassword")}</summary>
          <div className="card-body stack gap-7">
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
        </details>
      </div>
    </>
  );
}
