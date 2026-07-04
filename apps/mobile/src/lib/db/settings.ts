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

export async function getSettings(db: SQLiteDatabase, userId: string): Promise<SettingsDto> {
  const row = await db.getFirstAsync<SettingsRow>(
    "SELECT hourlyRate, currency, monthlyGoalHours FROM AppSettings WHERE userId = ?",
    [userId],
  );

  if (!row) {
    return { hourlyRate: 0, currency: "IRR", monthlyGoalHours: 160 };
  }

  return toSettingsDto(row);
}

export async function upsertSettings(
  db: SQLiteDatabase,
  userId: string,
  payload: UpdateSettingsInputDto,
): Promise<SettingsDto> {
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM AppSettings WHERE userId = ?",
    [userId],
  );

  const ts = now();

  if (existing) {
    await db.runAsync(
      "UPDATE AppSettings SET hourlyRate = ?, currency = ?, monthlyGoalHours = ?, updatedAt = ? WHERE userId = ?",
      [payload.hourlyRate, payload.currency, payload.monthlyGoalHours, ts, userId],
    );
  } else {
    const id = generateId();
    await db.runAsync(
      "INSERT INTO AppSettings (id, userId, hourlyRate, currency, monthlyGoalHours, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, userId, payload.hourlyRate, payload.currency, payload.monthlyGoalHours, ts, ts],
    );
  }

  return getSettings(db, userId);
}
