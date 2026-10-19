import { z } from "zod";

export const desktopSqlStatementSchema = z.object({
  sql: z.string().min(1).max(32_000),
  params: z.array(z.union([z.string(), z.number().finite(), z.null()])).max(500).default([]),
});
export const desktopDatabaseRequestSchema = z.object({
  operation: z.enum(["exec", "run", "first", "all", "batch"]),
  sql: z.string().max(32_000).default(""),
  params: desktopSqlStatementSchema.shape.params,
  statements: z.array(desktopSqlStatementSchema).max(500).optional(),
});

export const desktopStorageRequestSchema = z.object({
  operation: z.enum(["get", "set", "remove"]),
  key: z.string().min(1).max(160),
  value: z.string().max(2_000_000).optional(),
});

export const desktopTrayStateSchema = z.object({
  startAt: z.string().datetime({ offset: true }).nullable(),
  language: z.enum(["en", "fa"]),
  isDark: z.boolean(),
});

export type DesktopDatabaseRequest = z.input<typeof desktopDatabaseRequestSchema>;
export type DesktopStorageRequest = z.input<typeof desktopStorageRequestSchema>;
export type DesktopTrayState = z.infer<typeof desktopTrayStateSchema>;

export type DesktopApi = {
  deviceName: string;
  database: (request: DesktopDatabaseRequest) => Promise<unknown>;
  storage: (request: DesktopStorageRequest) => Promise<string | null>;
  setTrayState: (state: DesktopTrayState) => Promise<void>;
  hide: () => Promise<void>;
  quit: () => Promise<void>;
  checkUpdates: () => Promise<"disabled" | "current" | "downloading" | "available">;
  installUpdate: () => Promise<void>;
  onShow: (listener: () => void) => () => void;
  onVisibilityChange: (listener: (visible: boolean) => void) => () => void;
};
