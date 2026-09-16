import type {
  AuditLogsResponseDto,
  AuthResponseDto,
  CreateInviteInputDto,
  CreateProjectInputDto,
  CreateSessionInputDto,
  DashboardDto,
  InviteDto,
  InvitesResponseDto,
  MemberDetailReportDto,
  MemberDto,
  MembersResponseDto,
  MonthlyReportDto,
  OrganizationDto,
  PayrollPeriodDetailDto,
  PayrollPeriodsResponseDto,
  ProjectDto,
  ProjectsResponseDto,
  SessionUserResponseDto,
  SettingsDto,
  UpdateSettingsInputDto,
  TimesheetResponseDto,
  TimesheetQueryDto,
  UpdateMemberInputDto,
  UpdateOrganizationInputDto,
  UpdatePayrollLineInputDto,
  UpdatePayrollPeriodInputDto,
  UpdateProjectInputDto,
} from "@omam/contracts";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

const TOKEN_KEY = "omam.admin.token";

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* a private window without storage still works for this session */
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Raised on a 401 so the app can drop the session instead of showing an error. */
export const SESSION_EXPIRED = "SESSION_EXPIRED";

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
};

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path, API_URL);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken();

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  if (response.status === 401) {
    writeToken(null);
    throw new ApiError(401, SESSION_EXPIRED, SESSION_EXPIRED);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const detail = payload as { message?: string; code?: string } | null;

    throw new ApiError(response.status, detail?.message ?? "REQUEST_FAILED", detail?.code);
  }

  return payload as T;
}

/** Downloads a CSV through the same auth as everything else. */
export async function downloadCsv(path: string, query: RequestOptions["query"], filename: string) {
  const token = readToken();
  const response = await fetch(buildUrl(path, query), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new ApiError(response.status, "EXPORT_FAILED");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type MonthQuery = { month?: string; calendar?: string };

export const api = {
  login: (username: string, password: string) =>
    request<AuthResponseDto>("/auth/login", {
      method: "POST",
      body: { username, password, deviceName: "Admin panel" },
    }),
  me: () => request<SessionUserResponseDto>("/auth/me"),
  logout: () => request<null>("/auth/logout", { method: "POST" }),
  changePassword: (currentPassword: string, nextPassword: string) =>
    request<{ token: string }>("/auth/change-password", {
      method: "POST",
      body: { currentPassword, nextPassword },
    }),

  settings: () => request<SettingsDto>("/settings"),
  updateSettings: (body: UpdateSettingsInputDto) =>
    request<SettingsDto>("/settings", { method: "PATCH", body }),

  organization: () => request<OrganizationDto>("/team/organization"),
  updateOrganization: (body: UpdateOrganizationInputDto) =>
    request<OrganizationDto>("/team/organization", { method: "PATCH", body }),

  members: () => request<MembersResponseDto>("/team/members"),
  updateMember: (membershipId: string, body: UpdateMemberInputDto) =>
    request<MemberDto>(`/team/members/${membershipId}`, { method: "PATCH", body }),
  resetMemberPassword: (membershipId: string, nextPassword: string) =>
    request<{ ok: boolean }>(`/team/members/${membershipId}/reset-password`, {
      method: "POST",
      body: { nextPassword },
    }),

  invites: () => request<InvitesResponseDto>("/team/invites"),
  createInvite: (body: CreateInviteInputDto) =>
    request<InviteDto>("/team/invites", { method: "POST", body }),
  revokeInvite: (id: string) => request<{ ok: boolean }>(`/team/invites/${id}`, { method: "DELETE" }),

  projects: (includeArchived = false) =>
    request<ProjectsResponseDto>("/projects", { query: { includeArchived: String(includeArchived) } }),
  createProject: (body: CreateProjectInputDto) =>
    request<ProjectDto>("/projects", { method: "POST", body }),
  updateProject: (id: string, body: UpdateProjectInputDto) =>
    request<ProjectDto>(`/projects/${id}`, { method: "PATCH", body }),

  timesheets: (query: Partial<TimesheetQueryDto>) =>
    request<TimesheetResponseDto>("/timesheets", { query }),
  editTimesheet: (id: string, body: CreateSessionInputDto) =>
    request<unknown>(`/timesheets/${id}`, { method: "PATCH", body }),
  deleteTimesheet: (id: string) =>
    request<{ ok: boolean }>(`/timesheets/${id}`, { method: "DELETE" }),

  dashboard: (query: MonthQuery) => request<DashboardDto>("/reports/dashboard", { query }),
  monthlyReport: (query: MonthQuery) => request<MonthlyReportDto>("/reports/monthly", { query }),
  memberReport: (userId: string, query: MonthQuery) =>
    request<MemberDetailReportDto>(`/reports/members/${userId}`, { query }),

  payrollPeriods: () => request<PayrollPeriodsResponseDto>("/payroll/periods"),
  buildPayroll: (month: string, calendar?: string) =>
    request<PayrollPeriodDetailDto>("/payroll/periods", { method: "POST", body: { month, calendar } }),
  payrollPeriod: (id: string) => request<PayrollPeriodDetailDto>(`/payroll/periods/${id}`),
  updatePayrollPeriod: (id: string, body: UpdatePayrollPeriodInputDto) =>
    request<PayrollPeriodDetailDto>(`/payroll/periods/${id}`, { method: "PATCH", body }),
  updatePayrollLine: (id: string, body: UpdatePayrollLineInputDto) =>
    request<PayrollPeriodDetailDto>(`/payroll/lines/${id}`, { method: "PATCH", body }),

  audit: (page: number, pageSize = 50) =>
    request<AuditLogsResponseDto>("/team/audit", { query: { page, pageSize } }),
};
