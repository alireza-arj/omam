import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Building2, ChevronLeft, Laptop, Trash2 } from "lucide-react-native";
import { dayKey, formatFullDate } from "@omam/calendar";
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
  Button,
  Card,
  ConfirmDialog,
  Icon,
  IconButton,
  Input,
  PageHeader,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
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
          <Icon glyph={Building2} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "REMOTE",
        label: t("category.REMOTE"),
        icon: (active) => (
          <Icon glyph={Laptop} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
    ],
    [colors.textMuted, colors.textTitle, t],
  );

  const calendarName = t(calendar === "JALALI" ? "calendarName.JALALI" : "calendarName.GREGORIAN");

  /** Today in the active calendar, so the field shows the shape it expects. */
  const datePlaceholder = useMemo(() => dayKey(new Date(), calendar), [calendar]);

  /** `10 Shahrivar 1405` under the field, so the digits are readable at a glance. */
  const dateHint = useMemo(() => {
    const parsed = parseLocalDateTime(dateText, "00:00", calendar);

    return parsed
      ? formatFullDate(parsed, calendar, language)
      : t("session.dateHint", { calendar: calendarName });
  }, [calendar, calendarName, dateText, language, t]);

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
      <Icon glyph={ChevronLeft} size={20} color={colors.textTitle} />
    </IconButton>
  );

  if (isLoading) {
    return (
      <Screen scroll gap={layout.gapDefault}>
        <PageHeader title={t("session.title")} trailing={back} />
        <Card style={{ gap: layout.gapLoose }}>
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </Card>
      </Screen>
    );
  }

  if (notFound) {
    return (
      <Screen gap={layout.gapDefault}>
        <PageHeader title={t("session.title")} trailing={back} />
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
        subtitle={durationLabel ?? undefined}
        trailing={back}
      />

      <Card style={{ gap: layout.gapLoose }}>
        <Input
          label={t("session.date", { calendar: calendarName })}
          autoCapitalize="none"
          autoCorrect={false}
          hint={dateHint}
          keyboardType="numbers-and-punctuation"
          onChangeText={(value) => {
            setDateText(value);
            setError(null);
          }}
          placeholder={datePlaceholder}
          value={dateText}
        />

        <View style={{ flexDirection: "row", gap: layout.gapDefault }}>
          <Input
            label={t("session.start")}
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
            keyboardType="numbers-and-punctuation"
            onChangeText={(value) => {
              setStartText(value);
              setError(null);
            }}
            placeholder="09:00"
            value={startText}
          />
          <Input
            label={t("session.end")}
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
            hint={isNew ? t("session.endHint") : undefined}
            keyboardType="numbers-and-punctuation"
            onChangeText={(value) => {
              setEndText(value);
              setError(null);
            }}
            placeholder="17:00"
            value={endText}
          />
        </View>

        {isDraftValid && draft.crossesMidnight ? (
          <Text role="caption" tone="muted">
            {t("session.overnight")}
          </Text>
        ) : null}

        <View style={{ gap: layout.gapTight }}>
          <Text role="label" tone="body">
            {t("session.category")}
          </Text>
          <SegmentedControl
            options={categoryOptions}
            value={category}
            onChange={setCategory}
            size="lg"
            full
          />
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

        {error ? (
          <Text accessibilityRole="alert" role="bodySm" tone="accent">
            {error}
          </Text>
        ) : null}

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
          variant="outline"
          onPress={() => setConfirmingDelete(true)}
          icon={<Icon glyph={Trash2} size={18} color={colors.textAccent} />}
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
