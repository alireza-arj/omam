import type { SQLiteDatabase } from "expo-sqlite";
import { asCalendarSystem, DEFAULT_CALENDAR } from "@omam/calendar";
import { DEFAULT_LANGUAGE, asLanguage } from "@omam/i18n";
import type { SettingsDto, UpdateSettingsInputDto } from "@omam/contracts";
import { generateId } from "./id";

function now() {
  return new Date().toISOString();
}

type SettingsRow = {
  hourlyRate: number;
  currency: string;
  monthlyGoalHours: number;
  calendar: string | null;
  language: string | null;
};

function toSettingsDto(row: SettingsRow): SettingsDto {
  return {
    hourlyRate: row.hourlyRate,
    currency: row.currency as SettingsDto["currency"],
    monthlyGoalHours: row.monthlyGoalHours,
    // Rows written before the calendar migration read as Jalali, the default.
    calendar: asCalendarSystem(row.calendar),
    language: asLanguage(row.language),
  };
}

export async function getSettings(db: SQLiteDatabase, userId: string): Promise<SettingsDto> {
  const row = await db.getFirstAsync<SettingsRow>(
    "SELECT hourlyRate, currency, monthlyGoalHours, calendar, language FROM AppSettings WHERE userId = ?",
    [userId],
  );

  if (!row) {
    return {
      hourlyRate: 0,
      currency: "IRR",
      monthlyGoalHours: 160,
      calendar: DEFAULT_CALENDAR,
      language: DEFAULT_LANGUAGE,
    };
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
      "UPDATE AppSettings SET hourlyRate = ?, currency = ?, monthlyGoalHours = ?, calendar = ?, language = ?, updatedAt = ? WHERE userId = ?",
      [
        payload.hourlyRate,
        payload.currency,
        payload.monthlyGoalHours,
        payload.calendar,
        payload.language,
        ts,
        userId,
      ],
    );
  } else {
    const id = generateId();
    await db.runAsync(
      "INSERT INTO AppSettings (id, userId, hourlyRate, currency, monthlyGoalHours, calendar, language, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        userId,
        payload.hourlyRate,
        payload.currency,
        payload.monthlyGoalHours,
        payload.calendar,
        payload.language,
        ts,
        ts,
      ],
    );
  }

  return getSettings(db, userId);
}
