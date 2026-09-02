import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Building2, ChevronLeft, Laptop, Trash2 } from "lucide-react-native";
import { dayKey, formatFullDate } from "@omam/calendar";
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
        label: "On-site",
        icon: (active) => (
          <Icon glyph={Building2} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
      {
        value: "REMOTE",
        label: "Remote",
        icon: (active) => (
          <Icon glyph={Laptop} size={16} color={active ? colors.textTitle : colors.textMuted} />
        ),
      },
    ],
    [colors.textMuted, colors.textTitle],
  );

  const calendarName = calendar === "JALALI" ? "Shamsi" : "Gregorian";

  /** Today in the active calendar, so the field shows the shape it expects. */
  const datePlaceholder = useMemo(() => dayKey(new Date(), calendar), [calendar]);

  /** `10 Shahrivar 1405` under the field, so the digits are readable at a glance. */
  const dateHint = useMemo(() => {
    const parsed = parseLocalDateTime(dateText, "00:00", calendar);

    return parsed ? formatFullDate(parsed, calendar) : `A ${calendarName} date, as YYYY-MM-DD`;
  }, [calendar, calendarName, dateText]);

  /**
   * A blank end time means the session is still running. An end earlier than
   * the start is read as an overnight shift and rolled to the next day rather
   * than rejected — that is what a night shift actually looks like.
   */
  const draft = useMemo<{ input: SessionInput; crossesMidnight: boolean } | string>(() => {
    const startAt = parseLocalDateTime(dateText, startText, calendar);

    if (!startAt) {
      return `Enter a ${calendarName} date as YYYY-MM-DD and a start time as HH:MM.`;
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
      return "Enter an end time as HH:MM, or leave it empty for a running session.";
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
  }, [calendar, calendarName, category, dateText, endText, note, startText]);

  const isDraftValid = typeof draft !== "string";

  const durationLabel = useMemo(() => {
    if (!isDraftValid) return null;
    if (!draft.input.endAt) return "Running";

    const minutes = Math.round(
      (new Date(draft.input.endAt).getTime() - new Date(draft.input.startAt).getTime()) / 60000,
    );

    return formatShortMinutes(minutes);
  }, [draft, isDraftValid]);

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
        title: isNew ? "Session added" : "Session updated",
        tone: "success",
      });
      goBack();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Try again.";

      setError(message);
      showToast({ title: "Could not save the session", description: message, tone: "error" });
    }
  }

  async function handleDelete() {
    try {
      await deleteSession(id);
      setConfirmingDelete(false);
      showToast({ title: "Session deleted", tone: "success" });
      goBack();
    } catch (caught) {
      setConfirmingDelete(false);
      showToast({
        title: "Could not delete the session",
        description: caught instanceof Error ? caught.message : "Try again.",
        tone: "error",
      });
    }
  }

  const back = (
    <IconButton label="Back" round onPress={goBack}>
      <Icon glyph={ChevronLeft} size={20} color={colors.textTitle} />
    </IconButton>
  );

  if (isLoading) {
    return (
      <Screen scroll gap={layout.gapDefault}>
        <PageHeader title="Session" trailing={back} />
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
        <PageHeader title="Session" trailing={back} />
        <Card style={{ gap: layout.gapTight }}>
          <Text role="title3">That session is gone</Text>
          <Text role="bodySm" tone="muted">
            It may have been deleted on another screen.
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll gap={layout.gapDefault}>
      <PageHeader
        title={isNew ? "New session" : "Edit session"}
        subtitle={durationLabel ?? undefined}
        trailing={back}
      />

      <Card style={{ gap: layout.gapLoose }}>
        <Input
          label={`Date (${calendarName})`}
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
            label="Start"
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
            label="End"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ flex: 1 }}
            hint={isNew ? "Empty keeps it running" : undefined}
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
            Ends the next morning — counted as an overnight session.
          </Text>
        ) : null}

        <View style={{ gap: layout.gapTight }}>
          <Text role="label" tone="body">
            Category
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
          label="Note"
          multiline
          numberOfLines={3}
          onChangeText={setNote}
          placeholder="What did you work on?"
          size="lg"
          value={note}
        />

        {error ? (
          <Text accessibilityRole="alert" role="bodySm" tone="accent">
            {error}
          </Text>
        ) : null}

        <Button
          label={isNew ? "Add session" : "Save changes"}
          full
          size="lg"
          disabled={!isDraftValid}
          loading={isMutating}
          onPress={handleSave}
        />
      </Card>

      {isNew ? null : (
        <Button
          label="Delete session"
          full
          size="lg"
          variant="outline"
          onPress={() => setConfirmingDelete(true)}
          icon={<Icon glyph={Trash2} size={18} color={colors.textAccent} />}
        />
      )}

      <ConfirmDialog
        visible={confirmingDelete}
        title="Delete this session?"
        description="The recorded time and note are removed for good."
        confirmLabel="Delete"
        destructive
        loading={isMutating}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />

      <View style={{ height: layout.gapDefault }} />
    </Screen>
  );
}
