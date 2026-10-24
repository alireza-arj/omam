import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dayKey, parseDayKey, toDate, type CalendarSystem } from "@omam/calendar";
import type { SessionDto, WorkSessionCategory } from "@omam/contracts";
import { translateError } from "@omam/i18n";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { useLanguage } from "../lib/i18n";
import { ActionMenu, Button, Field, Input, Modal, Select, Textarea } from "./ui";

type DateFields = { day: string; time: string };
function fields(iso: string | null, calendar: CalendarSystem): DateFields {
  if (!iso) return { day: "", time: "" };
  const date = new Date(iso);
  return { day: dayKey(date, calendar), time: [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":") };
}
function instant(value: DateFields, calendar: CalendarSystem) {
  const parts = parseDayKey(value.day, calendar);
  const [hours, minutes, seconds = 0] = value.time.split(":").map(Number);
  if (!parts || !value.time || ![hours, minutes, seconds].every(Number.isFinite) || hours < 0 || minutes < 0 || seconds < 0 || hours > 23 || minutes > 59 || seconds > 59) return null;
  return toDate(parts, calendar, hours, minutes, seconds)?.toISOString() ?? null;
}

function SessionEditor({ session, onClose }: { session: SessionDto; onClose: () => void }) {
  const { calendar } = useSession();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [start, setStart] = useState(() => fields(session.startAt, calendar));
  const [end, setEnd] = useState(() => fields(session.endAt, calendar));
  const [category, setCategory] = useState<WorkSessionCategory>(session.category);
  const [note, setNote] = useState(session.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: Parameters<typeof api.editTimesheet>[1]) => api.editTimesheet(session.id, body),
    onSuccess: () => { void queryClient.invalidateQueries(); onClose(); },
    onError: (cause) => setError(translateError(cause, t)),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const startAt = instant(start, calendar);
    const endAt = !end.day && !end.time ? null : instant(end, calendar);
    if (!startAt || ((end.day || end.time) && !endAt)) { setError(t("errors.VALIDATION_FAILED")); return; }
    if (endAt && new Date(endAt) < new Date(startAt)) { setError(t("errors.END_BEFORE_START")); return; }
    setError(null);
    save.mutate({ startAt, endAt, category, note: note.trim() || null, projectId: session.project?.id ?? null });
  }
  return <Modal title={t("workspace.editSession")} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" form="session-editor" variant="primary" loading={save.isPending}>{t("common.save")}</Button></>}>
    <form id="session-editor" className="stack gap-7" onSubmit={submit}>
      <Field label={t("workspace.start")} hint={t(`calendarName.${calendar}`)}><div className="date-time-fields"><Input dir="ltr" aria-label={`${t("workspace.start")} · ${t(`calendarName.${calendar}`)}`} value={start.day} onChange={(event) => setStart({ ...start, day: event.target.value })} placeholder={t("workspace.datePattern")} required /><Input type="time" step={1} dir="ltr" aria-label={t("workspace.start")} value={start.time} onChange={(event) => setStart({ ...start, time: event.target.value })} required /></div></Field>
      <Field label={t("workspace.end")} hint={t("workspace.runningHint")}><div className="date-time-fields"><Input dir="ltr" aria-label={`${t("workspace.end")} · ${t(`calendarName.${calendar}`)}`} value={end.day} onChange={(event) => setEnd({ ...end, day: event.target.value })} placeholder={t("workspace.datePattern")} /><Input type="time" step={1} dir="ltr" aria-label={t("workspace.end")} value={end.time} onChange={(event) => setEnd({ ...end, time: event.target.value })} /></div></Field>
      <Field label={t("admin.timesheets.where")}><Select value={category} onValueChange={(value) => setCategory(value as WorkSessionCategory)}><option value="ONSITE">{t("category.ONSITE")}</option><option value="REMOTE">{t("category.REMOTE")}</option></Select></Field>
      <Field label={t("admin.timesheets.note")}><Textarea maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} /></Field>
      {error ? <p className="error-message t-body-sm" role="alert">{error}</p> : null}
    </form>
  </Modal>;
}

export function SessionActions({ session }: { session: SessionDto }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.deleteTimesheet(session.id),
    onSuccess: () => { void queryClient.invalidateQueries(); },
  });
  return <><ActionMenu label={t("admin.table.actions")} disabled={remove.isPending} items={[
    { label: t("common.edit"), onAction: () => setEditing(true) },
    { label: t("common.delete"), onAction: () => { if (confirm(t("admin.timesheets.confirmDelete"))) remove.mutate(); } },
  ]} />{editing ? <SessionEditor session={session} onClose={() => setEditing(false)} /> : null}</>;
}
