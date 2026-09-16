import { LANGUAGE_LABEL, formatDurationShort, formatNumber, type Language, type TranslationKey, type Translator } from "@omam/i18n";

const ACTIONS: Record<string, TranslationKey> = {
  "organization.updated": "admin.audit.actions.organizationUpdated",
  "member.updated": "admin.audit.actions.memberUpdated",
  "member.password_reset": "admin.audit.actions.passwordReset",
  "member.joined": "admin.audit.actions.memberJoined",
  "invite.created": "admin.audit.actions.inviteCreated",
  "invite.revoked": "admin.audit.actions.inviteRevoked",
  "project.created": "admin.audit.actions.projectCreated",
  "project.updated": "admin.audit.actions.projectUpdated",
  "payroll.built": "admin.audit.actions.payrollBuilt",
  "payroll.draft": "admin.audit.actions.payrollDraft",
  "payroll.locked": "admin.audit.actions.payrollLocked",
  "payroll.paid": "admin.audit.actions.payrollPaid",
  "payroll.updated": "admin.audit.actions.payrollUpdated",
  "payroll.line_adjusted": "admin.audit.actions.payrollAdjusted",
  "timesheet.approved": "admin.audit.actions.timesheetApproved",
  "timesheet.rejected": "admin.audit.actions.timesheetRejected",
  "timesheet.bulk_approve": "admin.audit.actions.timesheetBulkApproved",
  "timesheet.bulk_reject": "admin.audit.actions.timesheetBulkRejected",
  "timesheet.edited": "admin.audit.actions.timesheetEdited",
  "timesheet.deleted": "admin.audit.actions.timesheetDeleted",
};

const FIELDS = [
  "name", "username", "label", "role", "status", "employeeCode", "jobTitle",
  "payType", "hourlyRate", "monthlySalary", "currency", "monthlyGoalHours",
  "defaultHourlyRate", "timezone", "calendar", "language", "requireApproval",
  "archived", "color", "month", "adjustment", "note", "reason", "count", "minutes",
] as const;

const VALUES: Record<string, TranslationKey> = {
  OWNER: "role.OWNER", MANAGER: "role.MANAGER", MEMBER: "role.MEMBER",
  ACTIVE: "admin.members.active", SUSPENDED: "admin.members.suspended",
  HOURLY: "payType.HOURLY", MONTHLY: "payType.MONTHLY",
  DRAFT: "admin.payroll.DRAFT", LOCKED: "admin.payroll.LOCKED", PAID: "admin.payroll.PAID",
  JALALI: "admin.settings.jalali", GREGORIAN: "admin.settings.gregorian",
  IRR: "units.toman", USD: "admin.currency.USD", EUR: "admin.currency.EUR",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function auditAction(action: string, t: Translator) {
  return t(Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : "admin.audit.actions.unknown");
}

export function auditDetails(metadata: unknown, language: Language, t: Translator) {
  if (!isRecord(metadata)) return [];

  const values = { ...metadata, ...(isRecord(metadata.changes) ? metadata.changes : {}) };

  return FIELDS.flatMap((key) => {
    if (!(key in values)) return [];
    const value = values[key];
    let text: string;

    if (value === null) text = t("admin.audit.notSet");
    else if (typeof value === "boolean") text = t(value ? "common.yes" : "common.no");
    else if (typeof value === "number") {
      text = key === "minutes" ? formatDurationShort(value, language) : formatNumber(value, Number.isInteger(value) ? 0 : 2);
    } else if (typeof value === "string") {
      if (key === "language" && (value === "en" || value === "fa")) text = LANGUAGE_LABEL[value];
      else if (["role", "status", "payType", "currency", "calendar"].includes(key) && Object.hasOwn(VALUES, value)) text = t(VALUES[value]);
      else text = value || t("admin.audit.notSet");
    } else return [];

    return [{ key, label: t(`admin.audit.fields.${key}`), value: text }];
  });
}
