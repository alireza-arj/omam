import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "../../src/lib/sqlite-context";
import { Building2, ChevronLeft, Laptop, Trash2 } from "lucide-react-native";
import { dayKey } from "@omam/calendar";
import { translateError } from "@omam/i18n";
import type { WorkSessionCategory } from "@omam/contracts";
import { getSessionById } from "../../src/lib/db/sessions";
import {
  formatShortMinutes,
  parseLocalDateTime,
  toDateInput,
  toTimeInput,
} from "../../src/lib/format";
import { useAttendance, type SessionInput } from "../../src/providers/attendance-provider";
import { useAuth } from "../../src/providers/auth-provider";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DatePicker,
  Icon,
  IconButton,
  Input,
  Notice,
  PageHeader,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
  TimePicker,
  TimePickerPanel,
  layout,
  useColors,
  useLanguage,
  useToast,
  type SegmentOption,
} from "../../src/design/taraz";

const NEW_SESSION = "new";
const DAY_MS = 86_400_000;

export default function SessionEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { calendar, createSession, updateSession, deleteSession, isMutating } = useAttendance();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const colors = useColors();

  const isNew = id === NEW_SESSION;
  const userId = user?.id;

  const [isLoading, setIsLoading] = useState(!isNew);
  const [notFound, setNotFound] = useState(false);
  const [dateText, setDateText] = useState(() => dayKey(new Date(), calendar));
  const [startText, setStartText] = useState("09:00");
  const [endText, setEndText] = useState("17:00");
  const [category, setCategory] = useState<WorkSessionCategory>("ONSITE");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [openTime, setOpenTime] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    let active = true;

    if (isNew || !userId) {
      setIsLoading(false);
      return;
    }

    getSessionById(db, id, userId)
      .then((session) => {
        if (!active) return;

        if (!session) {
          setNotFound(true);
        } else {
          setDateText(toDateInput(session.startAt, calendar));
          setStartText(toTimeInput(session.startAt));
          setEndText(session.endAt ? toTimeInput(session.endAt) : "");
          setCategory(session.category);
          setNote(session.note ?? "");
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [calendar, db, id, isNew, userId]);

  const categoryOptions = useMemo<SegmentOption<WorkSessionCategory>[]>(
    () => [
      {
        value: "ONSITE",
        label: t("category.ONSITE"),
        icon: (active) => (
          <Icon glyph={Building2} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "REMOTE",
        label: t("category.REMOTE"),
        icon: (active) => (
          <Icon glyph={Laptop} size={layout.iconSm} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
    ],
    [colors.textMuted, colors.textTitle, t],
  );

  const calendarName = t(calendar === "JALALI" ? "calendarName.JALALI" : "calendarName.GREGORIAN");

  /**
   * A blank end time means the session is still running. An end earlier than
   * the start is read as an overnight shift and rolled to the next day rather
   * than rejected — that is what a night shift actually looks like.
   */
  const draft = useMemo<{ input: SessionInput; crossesMidnight: boolean } | string>(() => {
    const startAt = parseLocalDateTime(dateText, startText, calendar);

    if (!startAt) {
      return t("session.dateError", { calendar: calendarName });
    }

    const trimmedEnd = endText.trim();

    if (!trimmedEnd) {
      return {
        input: { startAt: startAt.toISOString(), endAt: null, category, note: note.trim() || null },
        crossesMidnight: false,
      };
    }

    const parsedEnd = parseLocalDateTime(dateText, trimmedEnd, calendar);

    if (!parsedEnd) {
      return t("session.endError");
    }

    const crossesMidnight = parsedEnd.getTime() < startAt.getTime();
    const endAt = crossesMidnight ? new Date(parsedEnd.getTime() + DAY_MS) : parsedEnd;

    return {
      input: {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        category,
        note: note.trim() || null,
      },
      crossesMidnight,
    };
  }, [calendar, calendarName, category, dateText, endText, note, startText, t]);

  const isDraftValid = typeof draft !== "string";

  const durationLabel = useMemo(() => {
    if (!isDraftValid) return null;
    if (!draft.input.endAt) return t("status.OPEN");

    const minutes = Math.round(
      (new Date(draft.input.endAt).getTime() - new Date(draft.input.startAt).getTime()) / 60000,
    );

    return formatShortMinutes(minutes, language);
  }, [draft, isDraftValid, language, t]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/report");
    }
  }, []);

  async function handleSave() {
    if (typeof draft === "string") {
      setError(draft);
      return;
    }

    setError(null);

    try {
      if (isNew) {
        await createSession(draft.input);
      } else {
        await updateSession(id, draft.input);
      }

      showToast({
        title: isNew ? t("session.added") : t("session.updated"),
        tone: "success",
      });
      goBack();
    } catch (caught) {
      const message = translateError(caught, t);

      setError(message);
      showToast({ title: t("session.saveFailed"), description: message, tone: "error" });
    }
  }

  async function handleDelete() {
    try {
      await deleteSession(id);
      setConfirmingDelete(false);
      showToast({ title: t("session.deleted"), tone: "success" });
      goBack();
    } catch (caught) {
      setConfirmingDelete(false);
      showToast({
        title: t("session.deleteFailed"),
        description: translateError(caught, t),
        tone: "error",
      });
    }
  }

  const back = (
    <IconButton label={t("common.back")} round onPress={goBack}>
      <Icon glyph={ChevronLeft} size={layout.iconMd} color={colors.textTitle} directional />
    </IconButton>
  );

  if (isLoading) {
    return (
      <Screen scroll gap={layout.gapDefault}>
        <PageHeader title={t("session.title")} leading={back} />
        <Card style={{ gap: layout.gapLoose }}>
          <Skeleton height={layout.controlField} />
          <Skeleton height={layout.controlField} />
          <Skeleton height={layout.controlField} />
        </Card>
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen gap={layout.gapDefault}>
        <PageHeader title={t("session.title")} leading={back} />
        <Card style={{ gap: layout.gapTight }}>
          <Text role="title3">{t("session.goneTitle")}</Text>
          <Text role="bodySm" tone="muted">
            {t("session.goneHint")}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll gap={layout.gapDefault}>
      <PageHeader
        title={isNew ? t("session.newTitle") : t("session.editTitle")}
        leading={back}
        trailing={durationLabel ? <Badge label={durationLabel} tone={isDraftValid && !draft.input.endAt ? "accent" : "neutral"} /> : null}
      />

      <Card style={{ gap: layout.gapLoose }}>
        <DatePicker
          label={t("session.date", { calendar: calendarName })}
          value={dateText}
          calendar={calendar}
          max={new Date()}
          onChange={(value) => {
            setDateText(value);
            setError(null);
          }}
        />

        <View style={{ gap: layout.gapTight }}>
          <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
            <TimePicker
              label={t("session.start")}
              value={startText}
              open={openTime === "start"}
              onOpenChange={(next) => setOpenTime(next ? "start" : null)}
              style={{ flex: 1 }}
            />
            <TimePicker
              label={t("session.end")}
              value={endText}
              emptyText={t("session.stillRunning")}
              open={openTime === "end"}
              onOpenChange={(next) => setOpenTime(next ? "end" : null)}
              style={{ flex: 1 }}
            />
          </View>
          <TimePickerPanel
            key={openTime ?? "closed"}
            open={openTime !== null}
            onOpenChange={(next) => { if (!next) setOpenTime(null); }}
            value={openTime === "end" ? endText : startText}
            clearLabel={openTime === "end" ? t("session.clearEnd") : undefined}
            onChange={(value) => {
              if (openTime === "end") setEndText(value);
              else setStartText(value);
              setError(null);
            }}
          />
          {openTime === null && isNew ? <Text role="caption" tone="muted">{t("session.endHint")}</Text> : null}
        </View>

        {isDraftValid && draft.crossesMidnight ? <Notice tone="default" title={t("session.overnight")} /> : null}

        <View style={{ gap: layout.gapTight }}>
          <Text role="label" tone="body">
            {t("session.category")}
          </Text>
          <SegmentedControl options={categoryOptions} value={category} onChange={setCategory} full />
        </View>

        <Input
          label={t("session.note")}
          freeText
          multiline
          numberOfLines={3}
          onChangeText={setNote}
          placeholder={t("session.notePlaceholder")}
          size="lg"
          value={note}
        />

        {error ? <Notice tone="danger" title={error} /> : null}

        <Button
          label={isNew ? t("session.add") : t("session.saveChanges")}
          full
          size="lg"
          disabled={!isDraftValid}
          loading={isMutating}
          onPress={handleSave}
        />
      </Card>

      {isNew ? null : (
        <Button
          label={t("session.deleteSession")}
          full
          size="lg"
          variant="dangerSoft"
          onPress={() => setConfirmingDelete(true)}
          icon={<Icon glyph={Trash2} size={layout.iconSm} color={colors.textAccent} />}
        />
      )}

      <ConfirmDialog
        visible={confirmingDelete}
        title={t("session.deleteTitle")}
        description={t("session.deleteDescription")}
        confirmLabel={t("common.delete")}
        destructive
        loading={isMutating}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      <View style={{ height: layout.gapDefault }} />
    </Screen>
  );
}
