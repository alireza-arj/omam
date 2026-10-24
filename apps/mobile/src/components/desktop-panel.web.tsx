import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { dayKey, formatDayLabel, formatMonthLabel } from "@omam/calendar";
import { translateError, type TranslationKey } from "@omam/i18n";
import type { SessionDto, WorkSessionCategory } from "@omam/contracts";
import SignInScreen from "../../app/(auth)/index";
import ProfileSetupScreen from "../../app/(auth)/profile";
import ReportScreen from "../../app/(tabs)/report";
import ProfileScreen from "../../app/(tabs)/profile";
import { useAuth } from "../providers/auth-provider";
import { useAttendance } from "../providers/attendance-provider";
import { useSync } from "../providers/sync-provider";
import { useSQLiteContext } from "../lib/sqlite-context";
import { getDesktopBridge } from "../lib/desktop";
import { getSessions } from "../lib/db/sessions";
import { formatClock, formatDurationHms, parseLocalDateTime, sessionMinutes, toDateInput, toTimeInput } from "../lib/format";
import { useLanguage, useTheme } from "../design/taraz";
import { desktopTokens } from "../design/taraz/tokens";
import "../design/taraz/desktop.css";

type Page = "timer" | "history" | "report" | "settings";
type Glyph = "clock" | "close" | "sync" | "plus" | "play" | "stop" | "remote" | "onsite" | "back" | "quit";
function Icon({ name }: { name: Glyph }) {
  const paths: Record<Glyph, string> = {
    clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    close: "m7 7 10 10 M17 7 7 17", sync: "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 3 M18 17a7 7 0 0 1-12 1l-2-3",
    plus: "M12 5v14 M5 12h14", play: "m6 3 15 9-15 9Z", stop: "M5 5h14v14H5Z",
    remote: "M5 4h14v12H5Z M3 20h18 M9 16v4 M15 16v4", onsite: "M5 21V3h14v18 M3 21h18 M9 7h1 M14 7h1 M9 11h1 M14 11h1 M10 21v-6h4v6",
    back: "m14 6-6 6 6 6", quit: "M12 3v9 M7 5a9 9 0 1 0 10 0",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function SessionEditor({ session, onClose }: { session: SessionDto | null; onClose: () => void }) {
  const { calendar, createSession, updateSession, deleteSession, isMutating } = useAttendance();
  const { t } = useLanguage();
  const start = session?.startAt ?? new Date().toISOString();
  const [date, setDate] = useState(toDateInput(start, calendar));
  const [time, setTime] = useState(toTimeInput(start));
  const [endDate, setEndDate] = useState(toDateInput(session?.endAt ?? start, calendar));
  const [end, setEnd] = useState(session?.endAt ? toTimeInput(session.endAt) : "");
  const [category, setCategory] = useState<WorkSessionCategory>(session?.category ?? "ONSITE");
  const [note, setNote] = useState(session?.note ?? "");
  const [error, setError] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    const from = parseLocalDateTime(date, time, calendar);
    const until = end ? parseLocalDateTime(endDate, end, calendar) : null;
    if (!from || (end && !until)) { setError(t("session.dateError", { calendar })); return; }
    try {
      const input = { startAt: from.toISOString(), endAt: until?.toISOString() ?? null, category, note: note.trim() || null };
      if (session) await updateSession(session.id, input); else await createSession(input);
      onClose();
    } catch (cause) { setError(translateError(cause, t)); }
  }
  async function remove() {
    if (!session) return;
    try { await deleteSession(session.id); onClose(); } catch (cause) { setError(translateError(cause, t)); }
  }
  return <section className="dt-editor">
    <button className="dt-link" onClick={onClose}><Icon name="back" />{t("common.back")}</button>
    <h1>{t(session ? "session.editTitle" : "session.newTitle")}</h1>
    <form onSubmit={(event) => void save(event)}>
      <div className="dt-fields">
        <label>{t("session.date", { calendar })}<input autoFocus dir="ltr" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label>{t("desktop.start")}<input type="time" dir="ltr" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
      </div>
      <div className="dt-fields">
        <label>{t("desktop.endDate")}<input dir="ltr" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <label>{t("desktop.end")}<input type="time" dir="ltr" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <label>{t("session.category")}<select value={category} onChange={(event) => setCategory(event.target.value as WorkSessionCategory)}><option value="ONSITE">{t("category.ONSITE")}</option><option value="REMOTE">{t("category.REMOTE")}</option></select></label>
      <label>{t("session.note")}<textarea value={note} maxLength={240} rows={3} placeholder={t("session.notePlaceholder")} onChange={(event) => setNote(event.target.value)} /></label>
      {error && <p role="alert" className="dt-error">{error}</p>}
      <button className="dt-primary" type="submit" disabled={isMutating}>{t(isMutating ? "common.saving" : "common.save")}</button>
    </form>
    {session && <div className="dt-editor-actions">
      {!confirmDelete ? <button className="dt-link" disabled={isMutating} onClick={() => setConfirmDelete(true)}>{t("session.deleteSession")}</button> : <div className="dt-error"><p>{t("desktop.deleteHint")}</p><button className="dt-link" disabled={isMutating} onClick={() => void remove()}>{t("common.delete")}</button><button className="dt-link" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</button></div>}
    </div>}
  </section>;
}

export default function DesktopPanel() {
  const { user, isAuthenticated, isReady, needsProfileSetup } = useAuth();
  const { sessions, summary, settings, calendar, month, clockIn, clockOut, isMutating } = useAttendance();
  const sync = useSync();
  const db = useSQLiteContext();
  const { t, language, direction, formatDuration } = useLanguage();
  const { colors, isDark } = useTheme();
  const [page, setPage] = useState<Page>("timer");
  const [now, setNow] = useState(Date.now());
  const [pickedCategory, setCategory] = useState<WorkSessionCategory | null>(null);
  const category = pickedCategory ?? sessions[0]?.category ?? "ONSITE";
  const [editor, setEditor] = useState<SessionDto | null | undefined>();
  const [history, setHistory] = useState<SessionDto[]>([]);
  const [error, setError] = useState<string>();
  const [updateReady, setUpdateReady] = useState(false);
  const [notice, setNotice] = useState<string>();
  const active = summary.activeSession;
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let visible = !document.hidden;
    const updateClock = () => {
      clearInterval(timer);
      if (!visible || (page !== "timer" && page !== "history")) return;
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), active?.startAt ? 1000 : 60_000);
    };
    updateClock();
    const visibilityChanged = () => { visible = !document.hidden; updateClock(); };
    document.addEventListener("visibilitychange", visibilityChanged);
    const unsubscribe = getDesktopBridge()?.onVisibilityChange((next) => { visible = next; updateClock(); });
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      unsubscribe?.();
    };
  }, [active?.startAt, page]);
  useEffect(() => {
    document.documentElement.dataset.desktop = "true";
    return () => { delete document.documentElement.dataset.desktop; };
  }, []);
  useEffect(() => {
    void getDesktopBridge()?.setTrayState({ startAt: active?.startAt ?? null, language, isDark });
  }, [active?.startAt, isDark, language]);
  useEffect(() => {
    if (!user || page !== "history") return;
    let current = true;
    void getSessions(db, user.id).then((rows) => { if (current) setHistory(rows); }, (cause: unknown) => { if (current) setError(translateError(cause, t)); });
    return () => { current = false; };
  }, [db, page, sessions, t, user]);
  useEffect(() => {
    const hide = (event: KeyboardEvent) => { if (event.key === "Escape") { if (editor !== undefined) setEditor(undefined); else void getDesktopBridge()?.hide(); } };
    window.addEventListener("keydown", hide);
    return () => window.removeEventListener("keydown", hide);
  }, [editor]);
  const style = {
    ...desktopTokens,
    "--dt-surface": colors.surfaceApp, "--dt-card": colors.surfaceCard, "--dt-text": colors.textTitle,
    "--dt-muted": colors.textMuted, "--dt-line": colors.lineHairline, "--dt-quiet": colors.fillQuiet,
    "--dt-accent": colors.fillAccent, "--dt-accent-pressed": colors.fillAccentPressed, "--dt-on-accent": colors.textOnAccent,
    "--dt-success": colors.successText, "--dt-warning": colors.warningText, "--dt-warning-fill": colors.warningFill,
  } as CSSProperties;
  async function toggleTimer() {
    setError(undefined);
    try { if (active) await clockOut(); else { await clockIn(category); setCategory(null); } } catch (cause) { setError(translateError(cause, t)); }
  }
  async function updates() {
    try {
      if (updateReady) { await getDesktopBridge()?.installUpdate(); return; }
      const status = await getDesktopBridge()?.checkUpdates();
      setUpdateReady(status === "available");
      setNotice(t(status === "disabled" || !status ? "desktop.updateDisabled" : status === "current" ? "desktop.updateCurrent" : "desktop.updateDownloading"));
    } catch (cause) { setError(translateError(cause, t)); }
  }
  const tabs: { id: Page; label: TranslationKey }[] = [{ id: "timer", label: "desktop.timer" }, { id: "history", label: "desktop.history" }, { id: "report", label: "tabs.report" }, { id: "settings", label: "desktop.settings" }];
  const syncLabel = !sync.isLinked || sync.lastError ? t("desktop.offline") : sync.pendingCount ? t("desktop.pending", { count: sync.pendingCount }) : t("desktop.synced");
  function sessionRow(session: SessionDto) {
    return <button className="dt-session" key={session.id} onClick={() => setEditor(session)} aria-label={`${t("common.edit")} ${formatDayLabel(new Date(session.startAt), calendar, language)} ${formatClock(session.startAt)}`}>
      <span className="dt-session-icon"><Icon name={session.category === "REMOTE" ? "remote" : "onsite"} /></span>
      <span className="dt-session-info"><strong>{session.note || t(session.category === "REMOTE" ? "category.REMOTE" : "category.ONSITE")}</strong><small>{formatDayLabel(new Date(session.startAt), calendar, language)} · <bdi>{formatClock(session.startAt)}{session.endAt ? ` – ${formatClock(session.endAt)}` : ""}</bdi></small></span>
      <span className="dt-duration">{session.endAt ? formatDuration(sessionMinutes(session)) : formatDurationHms((now - Date.parse(session.startAt)) / 1000)}</span>
    </button>;
  }
  const today = dayKey(new Date(now), calendar);
  const recent = sessions.filter((session) => session.endAt && dayKey(new Date(session.startAt), calendar) === today).slice(0, 3);
  return <div className="desktop-panel" style={style} dir={direction}>
    <header className="dt-header"><div className="dt-brand"><Icon name="clock" />{t("desktop.appName")}</div><div className="dt-header-actions"><button className="dt-icon-button" aria-label={t("desktop.quit")} title={t("desktop.quit")} onClick={() => void getDesktopBridge()?.quit()}><Icon name="quit" /></button><button className="dt-icon-button" aria-label={t("common.close")} title={t("common.close")} onClick={() => void getDesktopBridge()?.hide()}><Icon name="close" /></button></div></header>
    {isAuthenticated && !needsProfileSetup && <nav className="dt-nav" aria-label={t("desktop.appName")}>{tabs.map((tab) => <button key={tab.id} aria-pressed={page === tab.id} onClick={() => { setEditor(undefined); setPage(tab.id); setError(undefined); }}>{t(tab.label)}</button>)}</nav>}
    <main className="dt-content" aria-busy={!isReady}>
      {!isAuthenticated ? <div className="dt-embedded"><SignInScreen /></div> : needsProfileSetup ? <div className="dt-embedded"><ProfileSetupScreen /></div> : editor !== undefined ? <SessionEditor key={editor?.id ?? "new"} session={editor} onClose={() => setEditor(undefined)} /> : <>
        {(page === "timer" || page === "history") && <div className="dt-main">
          {error && <p className="dt-error" role="alert">{error}</p>}
          {sync.conflicts.length > 0 && <section className="dt-conflict" aria-labelledby="conflict-title"><h2 id="conflict-title">{t("desktop.conflictTitle")}</h2><p>{t("desktop.conflictHint")}</p>{sync.conflicts[0].sessions.map((session) => <button className="dt-choice" key={session.id} disabled={sync.isResolvingConflict} onClick={() => void sync.resolveConflict(sync.conflicts[0], session.id).catch((cause: unknown) => setError(translateError(cause, t)))}><span><strong>{session.deviceName || t("desktop.unknownDevice")}</strong><small>{formatDayLabel(new Date(session.startAt), calendar, language)} · <bdi>{formatClock(session.startAt)}{session.endAt ? ` – ${formatClock(session.endAt)}` : ""}</bdi></small></span><span className="dt-link">{t("desktop.keep")}</span></button>)}</section>}
          {page === "timer" ? <>
            <p className="dt-greeting">{t("desktop.greeting", { name: user?.nickname || user?.username || "" })}</p><p className="dt-date">{formatDayLabel(new Date(now), calendar, language)}</p>
            <section className="dt-timer" data-running={Boolean(active)} aria-label={t("desktop.timer")}><span className="dt-eyebrow"><span className="dt-status-dot" />{t(active ? "today.running" : "today.idle")}</span><div className="dt-time" aria-label={t(active ? "today.running" : "today.idle")}>{formatDurationHms(active ? (now - Date.parse(active.startAt)) / 1000 : 0)}</div><p className="dt-timer-note">{active ? t("desktop.started", { time: `\u2066${formatClock(active.startAt)}\u2069` }) : t("desktop.ready")}</p>
              <div className="dt-category" aria-label={t("session.category")}>{(["ONSITE", "REMOTE"] as const).map((value) => <button key={value} aria-pressed={(active?.category ?? category) === value} disabled={Boolean(active)} onClick={() => setCategory(value)}><Icon name={value === "REMOTE" ? "remote" : "onsite"} />{t(value === "REMOTE" ? "category.REMOTE" : "category.ONSITE")}</button>)}</div>
              <button className="dt-primary" disabled={isMutating || sync.conflicts.length > 0} onClick={() => void toggleTimer()}><Icon name={active ? "stop" : "play"} />{t(active ? "today.stop" : "today.start")}</button>
            </section>
            <div className="dt-month"><span>{formatMonthLabel(month, calendar, language)}</span><strong>{formatDuration(summary.completedMinutes)}</strong></div>
            <div className="dt-section-heading"><h2>{t("desktop.recent")}</h2><button className="dt-link" onClick={() => setPage("history")}>{t("desktop.viewAll")}</button></div>
            {recent.length ? recent.map(sessionRow) : <p className="dt-empty">{t("desktop.empty")}</p>}
          </> : <><div className="dt-section-heading"><h2>{t("desktop.history")}</h2><button className="dt-link" onClick={() => setEditor(null)}><Icon name="plus" />{t("session.add")}</button></div>{history.length ? history.map(sessionRow) : <p className="dt-empty">{t("report.emptyTitle")}</p>}</>}
        </div>}
        {page === "report" && <div className="dt-embedded"><ReportScreen /></div>}
        {page === "settings" && <><div className="dt-settings-extra"><button onClick={() => void updates()}>{t(updateReady ? "desktop.installUpdate" : "desktop.checkUpdates")}</button><button aria-label={t("desktop.quit")} onClick={() => void getDesktopBridge()?.quit()}>{t("desktop.quit")}</button></div>{notice && <p role="status" className="dt-empty">{notice}</p>}{error && <p role="alert" className="dt-error">{error}</p>}<div className="dt-embedded"><ProfileScreen /></div></>}
      </>}
    </main>
    <footer className="dt-footer"><span className="dt-sync" data-connected={sync.isLinked && !sync.lastError} title={sync.lastError ? translateError(new Error(sync.lastError), t) : undefined}><span className="dt-status-dot" />{syncLabel}</span><button className="dt-icon-button" title={t("team.syncNow")} aria-label={t("team.syncNow")} disabled={!sync.isLinked || sync.isSyncing} onClick={() => void sync.syncNow().catch((cause: unknown) => setError(translateError(cause, t)))}><Icon name="sync" /></button></footer>
  </div>;
}
