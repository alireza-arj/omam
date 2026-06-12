import type { SQLiteDatabase } from "expo-sqlite";
import type { SettingsDto, UpdateSettingsInputDto } from "@omam/contracts";

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 25; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function now() {
  return new Date().toISOString();
}

type SettingsRow = {
  hourlyRate: number;
  currency: string;
  monthlyGoalHours: number;
};

function toSettingsDto(row: SettingsRow): SettingsDto {
  return {
    hourlyRate: row.hourlyRate,
    currency: row.currency as SettingsDto["currency"],
    monthlyGoalHours: row.monthlyGoalHours,
  };
}

export function getSettings(db: SQLiteDatabase, userId: string): SettingsDto {
  const row = db.getFirstSync<SettingsRow>(
    "SELECT hourlyRate, currency, monthlyGoalHours FROM AppSettings WHERE userId = ?",
    [userId],
  );

  if (!row) {
    return { hourlyRate: 0, currency: "IRR", monthlyGoalHours: 160 };
  }

  return toSettingsDto(row);
}

export function upsertSettings(
  db: SQLiteDatabase,
  userId: string,
  payload: UpdateSettingsInputDto,
): SettingsDto {
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM AppSettings WHERE userId = ?",
    [userId],
  );

  const ts = now();

  if (existing) {
    db.runSync(
      "UPDATE AppSettings SET hourlyRate = ?, currency = ?, monthlyGoalHours = ?, updatedAt = ? WHERE userId = ?",
      [payload.hourlyRate, payload.currency, payload.monthlyGoalHours, ts, userId],
    );
  } else {
    const id = generateId();
    db.runSync(
      "INSERT INTO AppSettings (id, userId, hourlyRate, currency, monthlyGoalHours, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, userId, payload.hourlyRate, payload.currency, payload.monthlyGoalHours, ts, ts],
    );
  }

  return getSettings(db, userId);
}
